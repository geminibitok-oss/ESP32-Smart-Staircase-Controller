/**
 * Embedded Web Configuration Interface & REST API with full WiFi & parameter management
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Update.h>
#include <Preferences.h>
#include "config.h"

class StairWebServer {
public:
    AsyncWebServer server;
    Preferences prefs;

    StairWebServer() : server(80) {}

    void begin(void (*onColorChange)(uint8_t r, uint8_t g, uint8_t b),
               void (*onTrigger)(bool isBottom),
               String (*getStatusJson)(),
               void (*onConfigChange)()) {

        prefs.begin("stairs_cfg", false);

        server.on("/", HTTP_GET, [this, getStatusJson](AsyncWebServerRequest *request) {
            String html = getIndexHtml();
            request->send(200, "text/html", html);
        });

        server.on("/api/status", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            request->send(200, "application/json", getStatusJson());
        });

        // Scan available WiFi networks
        server.on("/api/scan_wifi", HTTP_GET, [](AsyncWebServerRequest *request) {
            int n = WiFi.scanComplete();
            if (n == -2) {
                WiFi.scanNetworks(true);
                request->send(200, "application/json", "{\"status\":\"scanning\"}");
            } else if (n) {
                String json = "{\"status\":\"done\",\"networks\":[";
                for (int i = 0; i < n; ++i) {
                    if (i) json += ",";
                    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
                }
                json += "]}";
                WiFi.scanDelete();
                WiFi.scanNetworks(true);
                request->send(200, "application/json", json);
            } else {
                WiFi.scanNetworks(true);
                request->send(200, "application/json", "{\"status\":\"scanning\"}");
            }
        });

        server.on("/api/trigger", HTTP_POST, [onTrigger](AsyncWebServerRequest *request) {
            if (request->hasParam("dir", true)) {
                String dir = request->getParam("dir", true)->value();
                if (dir == "up") onTrigger(true);
                else onTrigger(false);
            }
            request->send(200, "application/json", "{\"status\":\"triggered\"}");
        });

        server.on("/api/color", HTTP_POST, [onColorChange, this](AsyncWebServerRequest *request) {
            if (request->hasParam("r", true) && request->hasParam("g", true) && request->hasParam("b", true)) {
                int r = request->getParam("r", true)->value().toInt();
                int g = request->getParam("g", true)->value().toInt();
                int b = request->getParam("b", true)->value().toInt();
                prefs.putUChar("col_r", (uint8_t)r);
                prefs.putUChar("col_g", (uint8_t)g);
                prefs.putUChar("col_b", (uint8_t)b);
                onColorChange(r, g, b);
            }
            request->send(200, "application/json", "{\"status\":\"ok\"}");
        });

        // Save Wi-Fi Credentials & Parameters
        server.on("/api/save_config", HTTP_POST, [this, onConfigChange](AsyncWebServerRequest *request) {
            if (request->hasParam("ssid", true)) {
                String ssid = request->getParam("ssid", true)->value();
                String pass = request->hasParam("pass", true) ? request->getParam("pass", true)->value() : "";
                prefs.putString("wifi_ssid", ssid);
                prefs.putString("wifi_pass", pass);
            }

            if (request->hasParam("num_steps", true)) {
                prefs.putUChar("num_steps", (uint8_t)request->getParam("num_steps", true)->value().toInt());
            }
            if (request->hasParam("leds_step", true)) {
                prefs.putUChar("leds_step", (uint8_t)request->getParam("leds_step", true)->value().toInt());
            }
            if (request->hasParam("anim_speed", true)) {
                prefs.putUInt("anim_spd", request->getParam("anim_speed", true)->value().toInt());
            }
            if (request->hasParam("hold_time", true)) {
                prefs.putUInt("hold_sec", request->getParam("hold_time", true)->value().toInt());
            }
            if (request->hasParam("act_bright", true)) {
                prefs.putUChar("act_bri", (uint8_t)request->getParam("act_bright", true)->value().toInt());
            }
            if (request->hasParam("sb_bright", true)) {
                prefs.putUChar("sb_bri", (uint8_t)request->getParam("sb_bright", true)->value().toInt());
            }
            if (request->hasParam("sb_mode", true)) {
                prefs.putUChar("sb_mode", (uint8_t)request->getParam("sb_mode", true)->value().toInt());
            }

            if (onConfigChange) onConfigChange();

            bool reboot = request->hasParam("reboot", true) && request->getParam("reboot", true)->value() == "1";
            request->send(200, "application/json", "{\"status\":\"saved\",\"rebooting\":" + String(reboot ? "true" : "false") + "}");
            
            if (reboot) {
                delay(1000);
                ESP.restart();
            }
        });

        server.on("/api/restart", HTTP_POST, [](AsyncWebServerRequest *request) {
            request->send(200, "application/json", "{\"status\":\"restarting\"}");
            delay(1000);
            ESP.restart();
        });

        server.on("/update", HTTP_GET, [](AsyncWebServerRequest *request) {
            String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>OTA Upload</title>"
                          "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                          "<style>body{font-family:sans-serif;background:#0f172a;color:#fff;padding:20px;text-align:center;}"
                          ".card{background:#1e293b;padding:30px;border-radius:12px;display:inline-block;max-width:400px;width:100%;}"
                          "input{margin:15px 0;width:100%;padding:10px;border-radius:6px;box-sizing:border-box;}"
                          ".btn{background:#3b82f6;color:#fff;border:none;cursor:pointer;font-weight:bold;}</style></head><body>"
                          "<div class='card'><h2>⚡ ESP32 Firmware Flash</h2>"
                          "<form method='POST' action='/update' enctype='multipart/form-data'>"
                          "<input type='file' name='update' accept='.bin'><br>"
                          "<input type='submit' class='btn' value='Загрузить и прошить (.bin)'>"
                          "</form><br><a href='/' style='color:#38bdf8'>← Назад в панель</a></div></body></html>";
            request->send(200, "text/html", html);
        });

        server.on("/update", HTTP_POST, [](AsyncWebServerRequest *request) {
            bool shouldReboot = !Update.hasError();
            AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", shouldReboot ? "OK - Перезагрузка..." : "FAIL");
            response->addHeader("Connection", "close");
            request->send(response);
            if (shouldReboot) {
                delay(1000);
                ESP.restart();
            }
        }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
            if (!index) {
                Serial.printf("[MANUAL_OTA] Start update: %s\n", filename.c_str());
                if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                    Update.printError(Serial);
                }
            }
            if (Update.write(data, len) != len) {
                Update.printError(Serial);
            }
            if (final) {
                if (Update.end(true)) {
                    Serial.printf("[MANUAL_OTA] Success: %u B\n", index + len);
                } else {
                    Update.printError(Serial);
                }
            }
        });

        server.begin();
        Serial.println("[HTTP] Full Web Server listening on port 80");
    }

private:
    String getIndexHtml() {
        String savedSsid = prefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
        uint8_t numSteps = prefs.getUChar("num_steps", DEFAULT_NUM_STEPS);
        uint8_t ledsStep = prefs.getUChar("leds_step", DEFAULT_LEDS_STEP);
        uint32_t animSpd = prefs.getUInt("anim_spd", STEP_ANIM_SPEED_MS);
        uint32_t holdSec = prefs.getUInt("hold_sec", HOLD_TIME_SECONDS);
        uint8_t actBri = prefs.getUChar("act_bri", ACTIVE_BRIGHTNESS);
        uint8_t sbBri = prefs.getUChar("sb_bri", STANDBY_BRIGHTNESS);
        uint8_t sbMode = prefs.getUChar("sb_mode", STANDBY_MODE_TYPE);

        return R"rawliteral(
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP32 Умная Лестница</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --accent: #3b82f6; --text: #f8fafc; --muted: #94a3b8; }
        body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 16px; display: flex; justify-content: center; }
        .card { background: var(--card); padding: 24px; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin: 0 0 16px 0; font-size: 22px; color: #fbbf24; display: flex; align-items: center; gap: 8px; }
        h2 { font-size: 16px; color: #38bdf8; margin: 20px 0 10px 0; border-bottom: 1px solid #334155; padding-bottom: 6px; }
        .btn { background: var(--accent); color: white; border: none; padding: 12px 18px; border-radius: 8px; font-size: 15px; cursor: pointer; width: 100%; font-weight: bold; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn-green { background: #10b981; }
        .btn-amber { background: #f59e0b; }
        .btn-red { background: #ef4444; margin-top: 15px; }
        .row { display: flex; gap: 10px; margin-top: 10px; }
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .stat-box { background: #0f172a; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
        .stat-box span { color: #38bdf8; font-weight: bold; display: block; font-size: 15px; margin-top: 2px; }
        .form-group { margin-bottom: 12px; }
        label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
        input, select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 14px; box-sizing: border-box; }
        input[type="range"] { padding: 0; }
        .flex-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .badge { background: #0284c7; padding: 3px 8px; border-radius: 12px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🌟 Контроллер Лестницы <span class="badge">v)rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(</span></h1>
        
        <div class="stat-grid">
            <div class="stat-box">Ступеней / LED: <span id="dispSteps">)rawliteral" + String(numSteps) + " / " + String(numSteps * ledsStep) + R"rawliteral( шт</span></div>
            <div class="stat-box">IP в сети: <span id="dispIp">Загрузка...</span></div>
            <div class="stat-box">Статус Wi-Fi: <span id="dispWifi">Подключение...</span></div>
            <div class="stat-box">Астрономия / Время: <span id="dispTime">--:--</span></div>
        </div>

        <h2>🚶 Ручной запуск подсветки</h2>
        <div class="row">
            <button class="btn" onclick="triggerStairs('up')">⬆️ Иду Снизу Вверх</button>
            <button class="btn btn-amber" onclick="triggerStairs('down')">⬇️ Иду Сверху Вниз</button>
        </div>

        <h2>🎨 Цвет и Яркость</h2>
        <div class="form-group">
            <label>Цвет подсветки (WS2812B):</label>
            <input type="color" id="colorPicker" value="#ffb450" style="height:45px; cursor:pointer;" onchange="saveColor(this.value)">
        </div>

        <h2>🪜 Конфигурация Лестницы</h2>
        <div class="row">
            <div class="form-group" style="flex:1;">
                <label>Количество ступеней:</label>
                <input type="number" id="inpNumSteps" min="1" max="32" value=")rawliteral" + String(numSteps) + R"rawliteral(">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Диодов на ступень:</label>
                <input type="number" id="inpLedsStep" min="1" max="60" value=")rawliteral" + String(ledsStep) + R"rawliteral(">
            </div>
        </div>

        <h2>⚙️ Настройки Анимации</h2>
        <div class="form-group">
            <div class="flex-row">
                <label>Скорость ступени (мс):</label>
                <span id="lblSpeed">)rawliteral" + String(animSpd) + R"rawliteral(</span> мс
            </div>
            <input type="range" id="inpSpeed" min="20" max="250" value=")rawliteral" + String(animSpd) + R"rawliteral(" oninput="document.getElementById('lblSpeed').innerText=this.value">
        </div>

        <div class="form-group">
            <div class="flex-row">
                <label>Время свечения (сек):</label>
                <span id="lblHold">)rawliteral" + String(holdSec) + R"rawliteral(</span> с
            </div>
            <input type="range" id="inpHold" min="3" max="60" value=")rawliteral" + String(holdSec) + R"rawliteral(" oninput="document.getElementById('lblHold').innerText=this.value">
        </div>

        <div class="form-group">
            <div class="flex-row">
                <label>Основная яркость (0-255):</label>
                <span id="lblActBri">)rawliteral" + String(actBri) + R"rawliteral(</span>
            </div>
            <input type="range" id="inpActBri" min="10" max="255" value=")rawliteral" + String(actBri) + R"rawliteral(" oninput="document.getElementById('lblActBri').innerText=this.value">
        </div>

        <div class="form-group">
            <label>Ночной дежурный режим (Standby):</label>
            <select id="selSbMode">
                <option value="0" )rawliteral" + String(sbMode == 0 ? "selected" : "") + R"rawliteral(>0 — Выключен</option>
                <option value="1" )rawliteral" + String(sbMode == 1 ? "selected" : "") + R"rawliteral(>1 — Первая и последняя ступени</option>
                <option value="2" )rawliteral" + String(sbMode == 2 ? "selected" : "") + R"rawliteral(>2 — Все ступени мягко светятся</option>
                <option value="3" )rawliteral" + String(sbMode == 3 ? "selected" : "") + R"rawliteral(>3 — Плавное дыхание</option>
            </select>
        </div>

        <div class="form-group">
            <div class="flex-row">
                <label>Яркость ночной подсветки:</label>
                <span id="lblSbBri">)rawliteral" + String(sbBri) + R"rawliteral(</span>
            </div>
            <input type="range" id="inpSbBri" min="5" max="100" value=")rawliteral" + String(sbBri) + R"rawliteral(" oninput="document.getElementById('lblSbBri').innerText=this.value">
        </div>

        <button class="btn btn-green" onclick="saveSettings(false)">💾 Сохранить параметры подсветки</button>

        <h2>📶 Настройки Домашнего Wi-Fi</h2>
        <div class="form-group">
            <div class="flex-row">
                <label>Имя домашней сети (SSID):</label>
                <button type="button" onclick="scanWifi()" style="width:auto; padding:4px 8px; font-size:12px; background:#475569; color:#fff; border:none; border-radius:4px; cursor:pointer;">🔍 Сканировать</button>
            </div>
            <input type="text" id="wifiSsid" placeholder="Имя вашей сети Wi-Fi" value=")rawliteral" + savedSsid + R"rawliteral(">
            <select id="wifiList" style="display:none; margin-top:6px;" onchange="document.getElementById('wifiSsid').value=this.value"></select>
        </div>

        <div class="form-group">
            <label>Пароль от Wi-Fi:</label>
            <input type="password" id="wifiPass" placeholder="Пароль от сети">
        </div>

        <button class="btn btn-green" onclick="saveSettings(true)">💾 Сохранить Wi-Fi и Перезагрузить ESP32</button>

        <div style="margin-top: 25px; display:flex; justify-content:space-between; align-items:center;">
            <a href="/update" style="color: #94a3b8; font-size: 13px; text-decoration:none;">⚡ Ручная прошивка (.bin)</a>
            <button onclick="fetch('/api/restart',{method:'POST'}).then(()=>alert('Перезагрузка...'))" style="background:transparent; border:none; color:#ef4444; font-size:13px; cursor:pointer;">🔄 Перезагрузить</button>
        </div>
    </div>

    <script>
        function updateStatus() {
            fetch('/api/status').then(r => r.json()).then(d => {
                document.getElementById('dispIp').innerText = d.ip || '192.168.4.1';
                document.getElementById('dispWifi').innerText = d.wifi_connected ? '✅ Подключен' : '⚠️ AP Точка Доступа';
                document.getElementById('dispTime').innerText = (d.time || '--:--') + ' (' + (d.is_night_active ? '🌙 Ночь' : '☀️ День') + ')';
                if (d.steps) {
                    document.getElementById('dispSteps').innerText = d.steps + ' / ' + (d.total_leds || d.steps*30) + ' шт';
                }
            }).catch(()=>{});
        }
        setInterval(updateStatus, 3000);
        updateStatus();

        function triggerStairs(dir) {
            fetch('/api/trigger', { method: 'POST', body: new URLSearchParams({ dir }) });
        }

        function saveColor(hex) {
            const r = parseInt(hex.substr(1,2), 16);
            const g = parseInt(hex.substr(3,2), 16);
            const b = parseInt(hex.substr(5,2), 16);
            fetch('/api/color', { method: 'POST', body: new URLSearchParams({ r, g, b }) });
        }

        function scanWifi() {
            const list = document.getElementById('wifiList');
            list.style.display = 'block';
            list.innerHTML = '<option>Сканирование сетей...</option>';
            fetch('/api/scan_wifi').then(r => r.json()).then(data => {
                if (data.networks && data.networks.length) {
                    list.innerHTML = '<option value="">-- Выберите найденную сеть --</option>' + 
                        data.networks.map(n => `<option value="${n.ssid}">${n.ssid} (${n.rssi} dBm)</option>`).join('');
                } else {
                    list.innerHTML = '<option>Сети не найдены, попробуйте еще раз</option>';
                }
            });
        }

        function saveSettings(reboot) {
            const ssid = document.getElementById('wifiSsid').value;
            const pass = document.getElementById('wifiPass').value;
            const num_steps = document.getElementById('inpNumSteps').value;
            const leds_step = document.getElementById('inpLedsStep').value;
            const anim_speed = document.getElementById('inpSpeed').value;
            const hold_time = document.getElementById('inpHold').value;
            const act_bright = document.getElementById('inpActBri').value;
            const sb_bright = document.getElementById('inpSbBri').value;
            const sb_mode = document.getElementById('selSbMode').value;

            const params = new URLSearchParams({
                ssid, pass, num_steps, leds_step, anim_speed, hold_time, act_bright, sb_bright, sb_mode,
                reboot: reboot ? '1' : '0'
            });

            fetch('/api/save_config', { method: 'POST', body: params })
                .then(r => r.json())
                .then(res => {
                    if (reboot) {
                        alert('✅ Настройки сохранены! ESP32 перезагружается для подключения к ' + ssid + '...');
                    } else {
                        alert('✅ Параметры подсветки успешно применены!');
                    }
                });
        }
    </script>
</body>
</html>
)rawliteral";
    }
};

