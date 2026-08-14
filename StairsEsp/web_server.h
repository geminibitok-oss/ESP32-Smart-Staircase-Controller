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
        body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 12px; display: flex; justify-content: center; }
        .card { background: var(--card); padding: 20px; border-radius: 16px; width: 100%; max-width: 540px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        h1 { margin: 0; font-size: 20px; color: #fbbf24; display: flex; align-items: center; gap: 8px; }
        .badge { background: #0284c7; color:#fff; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        
        /* Tab Navigation Bar */
        .tabs-nav { display: flex; gap: 4px; background: #0f172a; padding: 4px; border-radius: 10px; margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
        .tab-btn { flex: 1; padding: 8px 10px; border: none; background: transparent; color: var(--muted); border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; white-space: nowrap; transition: all 0.2s; text-align: center; }
        .tab-btn.active { background: #3b82f6; color: #ffffff; box-shadow: 0 2px 8px rgba(59,130,246,0.4); }
        .tab-btn:hover:not(.active) { color: #f8fafc; background: #1e293b; }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }

        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .stat-box { background: #0f172a; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #334155; }
        .stat-box span { color: #38bdf8; font-weight: bold; display: block; font-size: 14px; margin-top: 2px; }
        
        h2 { font-size: 14px; color: #38bdf8; margin: 14px 0 8px 0; border-bottom: 1px solid #334155; padding-bottom: 4px; }
        .btn { background: var(--accent); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; width: 100%; font-weight: bold; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn-green { background: #10b981; }
        .btn-amber { background: #f59e0b; }
        .btn-purple { background: #8b5cf6; }
        .row { display: flex; gap: 8px; margin-top: 8px; }
        .form-group { margin-bottom: 12px; }
        label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        input, select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 13px; box-sizing: border-box; }
        input[type="range"] { padding: 0; }
        .flex-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .info-card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.5; color: #cbd5e1; margin-bottom: 12px; }
        .info-card strong { color: #38bdf8; }
        .guide-box { background: #1e1b4b; border: 1px solid #4338ca; border-radius: 8px; padding: 12px; font-size: 12px; color: #c7d2fe; margin-bottom: 12px; }
        .guide-box h3 { margin: 0 0 6px 0; font-size: 13px; color: #a5b4fc; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>🌟 Контроллер Лестницы</h1>
            <span class="badge">v)rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(</span>
        </div>
        
        <!-- Live Metrics Header -->
        <div class="stat-grid">
            <div class="stat-box">Ступеней / LED: <span id="dispSteps">)rawliteral" + String(numSteps) + " / " + String(numSteps * ledsStep) + R"rawliteral( шт</span></div>
            <div class="stat-box">IP в сети: <span id="dispIp">Загрузка...</span></div>
            <div class="stat-box">Статус Wi-Fi: <span id="dispWifi">Подключение...</span></div>
            <div class="stat-box">Солнце / Время: <span id="dispTime">--:--</span></div>
        </div>

        <!-- Tab Switcher Navigation -->
        <div class="tabs-nav">
            <button class="tab-btn active" onclick="openTab('tab-control')">🎮 Управление</button>
            <button class="tab-btn" onclick="openTab('tab-stairs')">🪜 Лестница</button>
            <button class="tab-btn" onclick="openTab('tab-wifi')">📶 Wi-Fi</button>
            <button class="tab-btn" onclick="openTab('tab-solar')">☀️ Солнце</button>
            <button class="tab-btn" onclick="openTab('tab-ota')">⚡ Прошивка (OTA)</button>
        </div>

        <!-- TAB 1: Control & Effects -->
        <div id="tab-control" class="tab-content active">
            <h2>🚶 Ручной запуск подсветки</h2>
            <div class="row">
                <button class="btn" onclick="triggerStairs('up')">⬆️ Иду Снизу Вверх</button>
                <button class="btn btn-amber" onclick="triggerStairs('down')">⬇️ Иду Сверху Вниз</button>
            </div>

            <h2>🎨 Цвет и Яркость</h2>
            <div class="form-group">
                <label>Цвет подсветки (WS2812B):</label>
                <input type="color" id="colorPicker" value="#ffb450" style="height:42px; cursor:pointer;" onchange="saveColor(this.value)">
            </div>

            <div class="form-group">
                <div class="flex-row">
                    <label>Основная яркость подсветки (10-255):</label>
                    <span id="lblActBri">)rawliteral" + String(actBri) + R"rawliteral(</span>
                </div>
                <input type="range" id="inpActBri" min="10" max="255" value=")rawliteral" + String(actBri) + R"rawliteral(" oninput="document.getElementById('lblActBri').innerText=this.value">
            </div>

            <button class="btn btn-green" style="margin-top:6px;" onclick="saveSettings(false)">💾 Применить яркость</button>
        </div>

        <!-- TAB 2: Staircase Settings -->
        <div id="tab-stairs" class="tab-content">
            <h2>🪜 Конфигурация ступеней</h2>
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

            <h2>⏱️ Тайминги анимации</h2>
            <div class="form-group">
                <div class="flex-row">
                    <label>Скорость шага анимации (мс):</label>
                    <span id="lblSpeed">)rawliteral" + String(animSpd) + R"rawliteral(</span> мс
                </div>
                <input type="range" id="inpSpeed" min="20" max="250" value=")rawliteral" + String(animSpd) + R"rawliteral(" oninput="document.getElementById('lblSpeed').innerText=this.value">
            </div>

            <div class="form-group">
                <div class="flex-row">
                    <label>Время свечения после прохода (сек):</label>
                    <span id="lblHold">)rawliteral" + String(holdSec) + R"rawliteral(</span> с
                </div>
                <input type="range" id="inpHold" min="3" max="60" value=")rawliteral" + String(holdSec) + R"rawliteral(" oninput="document.getElementById('lblHold').innerText=this.value">
            </div>

            <h2>🌙 Ночной дежурный режим (Standby)</h2>
            <div class="form-group">
                <label>Тип дежурной подсветки:</label>
                <select id="selSbMode">
                    <option value="0" )rawliteral" + String(sbMode == 0 ? "selected" : "") + R"rawliteral(>0 — Выключен</option>
                    <option value="1" )rawliteral" + String(sbMode == 1 ? "selected" : "") + R"rawliteral(>1 — Первая и последняя ступени</option>
                    <option value="2" )rawliteral" + String(sbMode == 2 ? "selected" : "") + R"rawliteral(>2 — Все ступени мягко светятся</option>
                    <option value="3" )rawliteral" + String(sbMode == 3 ? "selected" : "") + R"rawliteral(>3 — Плавное дыхание</option>
                </select>
            </div>

            <div class="form-group">
                <div class="flex-row">
                    <label>Яркость ночной подсветки (5-100):</label>
                    <span id="lblSbBri">)rawliteral" + String(sbBri) + R"rawliteral(</span>
                </div>
                <input type="range" id="inpSbBri" min="5" max="100" value=")rawliteral" + String(sbBri) + R"rawliteral(" oninput="document.getElementById('lblSbBri').innerText=this.value">
            </div>

            <button class="btn btn-green" onclick="saveSettings(false)">💾 Сохранить параметры ступеней</button>
        </div>

        <!-- TAB 3: Wi-Fi & Network -->
        <div id="tab-wifi" class="tab-content">
            <h2>📶 Подключение к домашней сети Wi-Fi</h2>
            <div class="info-card">
                При отсутствии сохраненной сети ESP32 создает собственную точку доступа <strong>ESP32-Staircase-Setup</strong> (IP: 192.168.4.1, пароль: 12345678).
            </div>

            <div class="form-group">
                <div class="flex-row">
                    <label>Имя домашней сети (SSID):</label>
                    <button type="button" onclick="scanWifi()" style="width:auto; padding:4px 8px; font-size:11px; background:#475569; color:#fff; border:none; border-radius:4px; cursor:pointer;">🔍 Сканировать</button>
                </div>
                <input type="text" id="wifiSsid" placeholder="SSID сети" value=")rawliteral" + savedSsid + R"rawliteral(">
                <select id="wifiList" style="display:none; margin-top:6px;" onchange="document.getElementById('wifiSsid').value=this.value"></select>
            </div>

            <div class="form-group">
                <label>Пароль от Wi-Fi:</label>
                <input type="password" id="wifiPass" placeholder="Пароль от сети">
            </div>

            <button class="btn btn-green" onclick="saveSettings(true)">💾 Сохранить Wi-Fi и Перезагрузить ESP32</button>
        </div>

        <!-- TAB 4: Solar Schedule & Coordinates -->
        <div id="tab-solar" class="tab-content">
            <h2>☀️ Астрономический расчет заката и рассвета</h2>
            <div class="info-card">
                📍 <strong>Локация:</strong> г. Борисов, Беларусь (54.2276° N, 28.5052° E)<br>
                ⏰ <strong>Часовой пояс:</strong> UTC+3 (Minsk / Moscow)<br>
                🌅 <strong>Активация подсветки:</strong> Автоматически за 30 минут до заката<br>
                🌇 <strong>Отключение подсветки:</strong> На рассвете<br>
                🌐 <strong>Синхронизация:</strong> NTP pool.ntp.org
            </div>
            <div class="stat-box" style="margin-top:10px;">
                Текущий статус: <span id="dispSolarMode">Автоматический расчет активен</span>
            </div>
        </div>

        <!-- TAB 5: OTA Firmware & Flashing Guide -->
        <div id="tab-ota" class="tab-content">
            <div class="guide-box">
                <h3>❓ КАКОЙ ФАЙЛ ВЫБИРАТЬ ДЛЯ ПРОШИВКИ?</h3>
                <p style="margin:4px 0 8px 0;">
                    • <strong>Для загрузки через браузер (Web OTA):</strong> выберите файл <code>firmware.bin</code> (или <code>StairsEsp.ino.bin</code>).<br>
                    • <strong>Для прошивки по USB (flash_windows.bat / esptool):</strong> используйте <code>firmware.bin</code> со смещением <code>0x10000</code>.<br>
                    • <strong>Для чистой платы с нуля:</strong> полный набор из 3 файлов (<code>bootloader.bin</code> 0x1000, <code>partitions.bin</code> 0x8000, <code>firmware.bin</code> 0x10000).
                </p>
            </div>

            <h2>⚡ Загрузка локального файла (.bin)</h2>
            <form method="POST" action="/update" enctype="multipart/form-data" style="margin-bottom:16px;">
                <input type="file" name="update" accept=".bin" required style="margin-bottom:8px;">
                <button type="submit" class="btn btn-purple">🚀 Загрузить и прошить по Wi-Fi</button>
            </form>

            <h2>🔄 Перезагрузка контроллера</h2>
            <button onclick="restartEsp()" class="btn" style="background:#ef4444;">🔄 Перезагрузить ESP32</button>
        </div>

        <!-- Quick Footer Navigation Links -->
        <div style="margin-top: 18px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#94a3b8; border-top:1px solid #334155; padding-top:10px;">
            <span>Умная Лестница ESP32</span>
            <a href="/update" style="color: #38bdf8; text-decoration:none;">⚡ Прямая страница /update</a>
        </div>
    </div>

    <script>
        function openTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            event.target.classList.add('active');
        }

        function updateStatus() {
            fetch('/api/status').then(r => r.json()).then(d => {
                document.getElementById('dispIp').innerText = d.ip || '192.168.4.1';
                document.getElementById('dispWifi').innerText = d.wifi_connected ? '✅ Подключен' : '⚠️ AP Точка Доступа';
                document.getElementById('dispTime').innerText = (d.time || '--:--') + ' (' + (d.is_night_active ? '🌙 Ночь' : '☀️ День') + ')';
                if (d.steps) {
                    document.getElementById('dispSteps').innerText = d.steps + ' / ' + (d.total_leds || d.steps*30) + ' шт';
                }
                const sm = document.getElementById('dispSolarMode');
                if (sm) sm.innerText = d.is_night_active ? '🌙 Ночной режим АКТИВЕН (подсветка готова)' : '☀️ Дневной режим (подсветка ожидает заката)';
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

        function restartEsp() {
            if (confirm('Перезагрузить контроллер ESP32?')) {
                fetch('/api/restart', { method: 'POST' }).then(() => alert('ESP32 перезагружается...'));
            }
        }
    </script>
</body>
</html>
)rawliteral";
    }
};

