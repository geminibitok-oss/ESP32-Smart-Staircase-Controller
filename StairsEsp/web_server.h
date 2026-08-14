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
               void (*onConfigChange)(),
               bool (*onTriggerOta)(String binUrl) = nullptr,
               String (*getOtaStatus)() = nullptr) {

        prefs.begin("stairs_cfg", false);

        server.on("/", HTTP_GET, [this, getStatusJson](AsyncWebServerRequest *request) {
            String html = getIndexHtml();
            request->send(200, "text/html", html);
        });

        server.on("/api/status", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            request->send(200, "application/json", getStatusJson());
        });

        server.on("/api/ota_status", HTTP_GET, [getOtaStatus](AsyncWebServerRequest *request) {
            if (getOtaStatus) {
                request->send(200, "application/json", getOtaStatus());
            } else {
                request->send(200, "application/json", "{\"is_updating\":false,\"progress\":0,\"status\":\"idle\"}");
            }
        });

        // Trigger Direct OTA from GitHub URL
        server.on("/api/ota_install_github", HTTP_POST, [onTriggerOta](AsyncWebServerRequest *request) {
            if (!onTriggerOta) {
                request->send(500, "application/json", "{\"error\":\"OTA engine unavailable\"}");
                return;
            }
            String binUrl = "";
            if (request->hasParam("url", true)) {
                binUrl = request->getParam("url", true)->value();
            } else if (request->hasParam("version", true)) {
                String ver = request->getParam("version", true)->value();
                binUrl = "https://github.com/" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + "/releases/download/" + ver + "/firmware.bin";
            }
            if (binUrl.length() == 0) {
                request->send(400, "application/json", "{\"error\":\"Missing binary URL or version\"}");
                return;
            }

            request->send(200, "application/json", "{\"status\":\"started\",\"bin_url\":\"" + binUrl + "\"}");
            
            // Execute flash in background or after response
            delay(200);
            onTriggerOta(binUrl);
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

            // GPIO Pins Configuration
            if (request->hasParam("pin_led", true)) {
                prefs.putUChar("pin_led", (uint8_t)request->getParam("pin_led", true)->value().toInt());
            }
            if (request->hasParam("pin_bot", true)) {
                prefs.putUChar("pin_bot", (uint8_t)request->getParam("pin_bot", true)->value().toInt());
            }
            if (request->hasParam("pin_top", true)) {
                prefs.putUChar("pin_top", (uint8_t)request->getParam("pin_top", true)->value().toInt());
            }
            if (request->hasParam("pin_ldr", true)) {
                prefs.putUChar("pin_ldr", (uint8_t)request->getParam("pin_ldr", true)->value().toInt());
            }
            if (request->hasParam("sensor_high", true)) {
                prefs.putUChar("sensor_high", (uint8_t)request->getParam("sensor_high", true)->value().toInt());
            }
            if (request->hasParam("pull_mode", true)) {
                prefs.putUChar("pull_mode", (uint8_t)request->getParam("pull_mode", true)->value().toInt());
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

        uint8_t pinLed = prefs.getUChar("pin_led", PIN_LED_DATA);
        uint8_t pinBot = prefs.getUChar("pin_bot", PIN_BOTTOM_PIR);
        uint8_t pinTop = prefs.getUChar("pin_top", PIN_TOP_PIR);
        uint8_t sensorHigh = prefs.getUChar("sensor_high", 1);
        uint8_t pullMode = prefs.getUChar("pull_mode", 0);

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
        .tab-btn { flex: 1; padding: 8px 8px; border: none; background: transparent; color: var(--muted); border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap; transition: all 0.2s; text-align: center; }
        .tab-btn.active { background: #3b82f6; color: #ffffff; box-shadow: 0 2px 8px rgba(59,130,246,0.4); }
        .tab-btn:hover:not(.active) { color: #f8fafc; background: #1e293b; }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.2s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }

        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .stat-box { background: #0f172a; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #334155; }
        .stat-box span { color: #38bdf8; font-weight: bold; display: block; font-size: 13px; margin-top: 2px; }
        
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
            <div class="stat-box">Пины (LED/Датчики): <span id="dispPins">GPIO )rawliteral" + String(pinLed) + " / " + String(pinBot) + ", " + String(pinTop) + R"rawliteral(</span></div>
        </div>

        <!-- Tab Switcher Navigation -->
        <div class="tabs-nav">
            <button class="tab-btn active" onclick="openTab('tab-control')">🎮 Управление</button>
            <button class="tab-btn" onclick="openTab('tab-stairs')">🪜 Лестница</button>
            <button class="tab-btn" onclick="openTab('tab-pins')">🔌 Пины / GPIO</button>
            <button class="tab-btn" onclick="openTab('tab-wifi')">📶 Wi-Fi</button>
            <button class="tab-btn" onclick="openTab('tab-solar')">☀️ Солнце</button>
            <button class="tab-btn" onclick="openTab('tab-ota')">⚡ Прошивка</button>
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

        <!-- TAB: GPIO Pin Assignment & Sensor Logic -->
        <div id="tab-pins" class="tab-content">
            <h2>🔌 Назначение пинов ESP32 (GPIO)</h2>
            <div class="info-card">
                Назначьте пины подключения адресной ленты и датчиков движения. Настройки сохраняются во Flash-память ESP32.
            </div>

            <div class="form-group">
                <label>🔴 Пин адресной ленты WS2812B (Data Out):</label>
                <select id="selPinLed">
                    <option value="18" )rawliteral" + String(pinLed == 18 ? "selected" : "") + R"rawliteral(>GPIO 18 (VSPI SCK / Рекомендуется)</option>
                    <option value="16" )rawliteral" + String(pinLed == 16 ? "selected" : "") + R"rawliteral(>GPIO 16 (UART2 RX / Резервный)</option>
                    <option value="17" )rawliteral" + String(pinLed == 17 ? "selected" : "") + R"rawliteral(>GPIO 17 (UART2 TX)</option>
                    <option value="19" )rawliteral" + String(pinLed == 19 ? "selected" : "") + R"rawliteral(>GPIO 19 (VSPI MISO)</option>
                    <option value="21" )rawliteral" + String(pinLed == 21 ? "selected" : "") + R"rawliteral(>GPIO 21 (I2C SDA)</option>
                    <option value="22" )rawliteral" + String(pinLed == 22 ? "selected" : "") + R"rawliteral(>GPIO 22 (I2C SCL)</option>
                    <option value="23" )rawliteral" + String(pinLed == 23 ? "selected" : "") + R"rawliteral(>GPIO 23 (VSPI MOSI)</option>
                    <option value="4" )rawliteral" + String(pinLed == 4 ? "selected" : "") + R"rawliteral(>GPIO 4 (D4 / Touch 0)</option>
                    <option value="5" )rawliteral" + String(pinLed == 5 ? "selected" : "") + R"rawliteral(>GPIO 5 (VSPI CS0)</option>
                    <option value="25" )rawliteral" + String(pinLed == 25 ? "selected" : "") + R"rawliteral(>GPIO 25 (DAC1)</option>
                    <option value="26" )rawliteral" + String(pinLed == 26 ? "selected" : "") + R"rawliteral(>GPIO 26 (DAC2)</option>
                    <option value="27" )rawliteral" + String(pinLed == 27 ? "selected" : "") + R"rawliteral(>GPIO 27 (Touch 7)</option>
                    <option value="32" )rawliteral" + String(pinLed == 32 ? "selected" : "") + R"rawliteral(>GPIO 32 (Touch 9)</option>
                    <option value="33" )rawliteral" + String(pinLed == 33 ? "selected" : "") + R"rawliteral(>GPIO 33 (Touch 8)</option>
                    <option value="2" )rawliteral" + String(pinLed == 2 ? "selected" : "") + R"rawliteral(>GPIO 2 (Встроенный LED)</option>
                    <option value="12" )rawliteral" + String(pinLed == 12 ? "selected" : "") + R"rawliteral(>GPIO 12 (HSPI MISO)</option>
                    <option value="13" )rawliteral" + String(pinLed == 13 ? "selected" : "") + R"rawliteral(>GPIO 13 (HSPI MOSI)</option>
                    <option value="14" )rawliteral" + String(pinLed == 14 ? "selected" : "") + R"rawliteral(>GPIO 14 (HSPI CLK)</option>
                    <option value="15" )rawliteral" + String(pinLed == 15 ? "selected" : "") + R"rawliteral(>GPIO 15 (HSPI CS)</option>
                </select>
            </div>

            <div class="form-group">
                <label>🟢 Нижний датчик движения (PIR / Радар / Сенсор):</label>
                <select id="selPinBot">
                    <option value="19" )rawliteral" + String(pinBot == 19 ? "selected" : "") + R"rawliteral(>GPIO 19 (Рекомендуется)</option>
                    <option value="34" )rawliteral" + String(pinBot == 34 ? "selected" : "") + R"rawliteral(>GPIO 34 (Только вход / Input-Only)</option>
                    <option value="35" )rawliteral" + String(pinBot == 35 ? "selected" : "") + R"rawliteral(>GPIO 35 (Только вход / Input-Only)</option>
                    <option value="36" )rawliteral" + String(pinBot == 36 ? "selected" : "") + R"rawliteral(>GPIO 36 / VP (Только вход)</option>
                    <option value="39" )rawliteral" + String(pinBot == 39 ? "selected" : "") + R"rawliteral(>GPIO 39 / VN (Только вход)</option>
                    <option value="18" )rawliteral" + String(pinBot == 18 ? "selected" : "") + R"rawliteral(>GPIO 18</option>
                    <option value="17" )rawliteral" + String(pinBot == 17 ? "selected" : "") + R"rawliteral(>GPIO 17</option>
                    <option value="16" )rawliteral" + String(pinBot == 16 ? "selected" : "") + R"rawliteral(>GPIO 16</option>
                    <option value="21" )rawliteral" + String(pinBot == 21 ? "selected" : "") + R"rawliteral(>GPIO 21</option>
                    <option value="22" )rawliteral" + String(pinBot == 22 ? "selected" : "") + R"rawliteral(>GPIO 22</option>
                    <option value="23" )rawliteral" + String(pinBot == 23 ? "selected" : "") + R"rawliteral(>GPIO 23</option>
                    <option value="25" )rawliteral" + String(pinBot == 25 ? "selected" : "") + R"rawliteral(>GPIO 25</option>
                    <option value="26" )rawliteral" + String(pinBot == 26 ? "selected" : "") + R"rawliteral(>GPIO 26</option>
                    <option value="27" )rawliteral" + String(pinBot == 27 ? "selected" : "") + R"rawliteral(>GPIO 27</option>
                    <option value="32" )rawliteral" + String(pinBot == 32 ? "selected" : "") + R"rawliteral(>GPIO 32</option>
                    <option value="33" )rawliteral" + String(pinBot == 33 ? "selected" : "") + R"rawliteral(>GPIO 33</option>
                    <option value="4" )rawliteral" + String(pinBot == 4 ? "selected" : "") + R"rawliteral(>GPIO 4</option>
                    <option value="5" )rawliteral" + String(pinBot == 5 ? "selected" : "") + R"rawliteral(>GPIO 5</option>
                    <option value="12" )rawliteral" + String(pinBot == 12 ? "selected" : "") + R"rawliteral(>GPIO 12</option>
                    <option value="13" )rawliteral" + String(pinBot == 13 ? "selected" : "") + R"rawliteral(>GPIO 13</option>
                    <option value="14" )rawliteral" + String(pinBot == 14 ? "selected" : "") + R"rawliteral(>GPIO 14</option>
                </select>
            </div>

            <div class="form-group">
                <label>🔵 Верхний датчик движения (PIR / Радар / Сенсор):</label>
                <select id="selPinTop">
                    <option value="21" )rawliteral" + String(pinTop == 21 ? "selected" : "") + R"rawliteral(>GPIO 21 (Рекомендуется)</option>
                    <option value="35" )rawliteral" + String(pinTop == 35 ? "selected" : "") + R"rawliteral(>GPIO 35 (Только вход / Input-Only)</option>
                    <option value="34" )rawliteral" + String(pinTop == 34 ? "selected" : "") + R"rawliteral(>GPIO 34 (Только вход / Input-Only)</option>
                    <option value="36" )rawliteral" + String(pinTop == 36 ? "selected" : "") + R"rawliteral(>GPIO 36 / VP (Только вход)</option>
                    <option value="39" )rawliteral" + String(pinTop == 39 ? "selected" : "") + R"rawliteral(>GPIO 39 / VN (Только вход)</option>
                    <option value="18" )rawliteral" + String(pinTop == 18 ? "selected" : "") + R"rawliteral(>GPIO 18</option>
                    <option value="19" )rawliteral" + String(pinTop == 19 ? "selected" : "") + R"rawliteral(>GPIO 19</option>
                    <option value="17" )rawliteral" + String(pinTop == 17 ? "selected" : "") + R"rawliteral(>GPIO 17</option>
                    <option value="16" )rawliteral" + String(pinTop == 16 ? "selected" : "") + R"rawliteral(>GPIO 16</option>
                    <option value="22" )rawliteral" + String(pinTop == 22 ? "selected" : "") + R"rawliteral(>GPIO 22</option>
                    <option value="23" )rawliteral" + String(pinTop == 23 ? "selected" : "") + R"rawliteral(>GPIO 23</option>
                    <option value="25" )rawliteral" + String(pinTop == 25 ? "selected" : "") + R"rawliteral(>GPIO 25</option>
                    <option value="26" )rawliteral" + String(pinTop == 26 ? "selected" : "") + R"rawliteral(>GPIO 26</option>
                    <option value="27" )rawliteral" + String(pinTop == 27 ? "selected" : "") + R"rawliteral(>GPIO 27</option>
                    <option value="32" )rawliteral" + String(pinTop == 32 ? "selected" : "") + R"rawliteral(>GPIO 32</option>
                    <option value="33" )rawliteral" + String(pinTop == 33 ? "selected" : "") + R"rawliteral(>GPIO 33</option>
                    <option value="4" )rawliteral" + String(pinTop == 4 ? "selected" : "") + R"rawliteral(>GPIO 4</option>
                    <option value="5" )rawliteral" + String(pinTop == 5 ? "selected" : "") + R"rawliteral(>GPIO 5</option>
                    <option value="12" )rawliteral" + String(pinTop == 12 ? "selected" : "") + R"rawliteral(>GPIO 12</option>
                    <option value="13" )rawliteral" + String(pinTop == 13 ? "selected" : "") + R"rawliteral(>GPIO 13</option>
                    <option value="14" )rawliteral" + String(pinTop == 14 ? "selected" : "") + R"rawliteral(>GPIO 14</option>
                </select>
            </div>

            <h2>⚙️ Логика срабатывания и подтяжка</h2>
            <div class="form-group">
                <label>Логический уровень срабатывания датчиков:</label>
                <select id="selSensorHigh">
                    <option value="1" )rawliteral" + String(sensorHigh == 1 ? "selected" : "") + R"rawliteral(>Active HIGH (3.3V при движении — стандартные PIR, Радар 24GHz)</option>
                    <option value="0" )rawliteral" + String(sensorHigh == 0 ? "selected" : "") + R"rawliteral(>Active LOW (GND при движении — Инверсные / Оптические NPN / Геркон)</option>
                </select>
            </div>

            <div class="form-group">
                <label>Внутренняя подтяжка пинов (Pull Mode):</label>
                <select id="selPullMode">
                    <option value="0" )rawliteral" + String(pullMode == 0 ? "selected" : "") + R"rawliteral(>INPUT_PULLDOWN (К земле — рекомендуется для PIR HC-SR501/RCWL)</option>
                    <option value="1" )rawliteral" + String(pullMode == 1 ? "selected" : "") + R"rawliteral(>INPUT_PULLUP (К 3.3V — для кнопок, герконов и открытого коллектора)</option>
                    <option value="2" )rawliteral" + String(pullMode == 2 ? "selected" : "") + R"rawliteral(>INPUT (Без подтяжки / Внешняя подтяжка на плате)</option>
                </select>
            </div>

            <h2>📡 Live-монитор датчиков (Проверка в реальном времени)</h2>
            <div class="stat-grid" style="margin-bottom:14px;">
                <div class="stat-box">Нижний сенсор: <span id="liveBotState" style="color:#94a3b8;">⚪ Покой (LOW)</span></div>
                <div class="stat-box">Верхний сенсор: <span id="liveTopState" style="color:#94a3b8;">⚪ Покой (LOW)</span></div>
            </div>

            <button class="btn btn-green" onclick="savePinsConfig()">💾 Сохранить пины и Перезагрузить ESP32</button>
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
            <!-- Modal for OTA Progress -->
            <div id="otaModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.92); z-index:9999; justify-content:center; align-items:center; padding:20px; box-sizing:border-box;">
                <div style="background:#1e293b; border:1px solid #6366f1; border-radius:16px; padding:24px; max-width:440px; width:100%; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.8);">
                    <h3 id="otaModalTitle" style="color:#a5b4fc; margin-top:0; font-size:18px;">⚡ Обновление прошивки по воздуху</h3>
                    <p id="otaModalDesc" style="font-size:13px; color:#cbd5e1; line-height:1.5;">Загрузка firmware.bin с GitHub и запись в память ESP32...</p>
                    <div style="background:#0f172a; border-radius:10px; overflow:hidden; height:18px; margin:16px 0; border:1px solid #334155; position:relative;">
                        <div id="otaProgressBar" style="width:15%; height:100%; background:linear-gradient(90deg, #6366f1, #38bdf8); transition:width 0.4s ease;"></div>
                    </div>
                    <div id="otaPercentText" style="font-size:12px; font-weight:bold; color:#38bdf8; font-family:monospace;">Скачивание... 15%</div>
                    <div id="otaStatusDetails" style="font-size:11px; color:#94a3b8; margin-top:12px;">Не выключайте питание контроллера!</div>
                </div>
            </div>

            <!-- GitHub Releases Direct Selection & 1-Click Flash -->
            <h2>🌐 Выбор и установка версий с GitHub Releases</h2>
            <div class="guide-box" style="background:#1e1b4b; border-color:#4f46e5;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>Репозиторий:</strong> <span style="color:#facc15;">)rawliteral" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + R"rawliteral(</span></div>
                    <button type="button" onclick="loadGitHubReleases()" style="background:#4338ca; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">🔄 Обновить</button>
                </div>
                <div style="margin-top:6px; font-size:11px; color:#c7d2fe;">
                    Выберите нужную версию прошивки и нажмите <strong>«Установить»</strong> — ESP32 автоматически скачает бинарный файл <code>firmware.bin</code> и прошьёт его по Wi-Fi!
                </div>
            </div>

            <div id="githubReleasesContainer" style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
                <div style="text-align:center; padding:15px; font-size:12px; color:#94a3b8;">
                    Загрузка списка версий с GitHub...
                </div>
            </div>

            <!-- Manual File Upload (Fallback) -->
            <h2>📁 Ручная загрузка .bin файла с компьютера</h2>
            <div class="guide-box" style="background:#0f172a; border-color:#334155;">
                <strong>Памятка по файлам:</strong><br>
                • Для Web OTA формы: <code>firmware.bin</code><br>
                • Для USB прошивки (flash_windows.bat): <code>firmware.bin</code> со смещением <code>0x10000</code>.
            </div>

            <form method="POST" action="/update" enctype="multipart/form-data" style="margin-bottom:16px;">
                <input type="file" name="update" accept=".bin" required style="margin-bottom:8px;">
                <button type="submit" class="btn btn-purple">🚀 Загрузить локальный .bin по Wi-Fi</button>
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
        const CURRENT_VERSION = ")rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(";
        const GH_USER = ")rawliteral" + String(GITHUB_USER) + R"rawliteral(";
        const GH_REPO = ")rawliteral" + String(GITHUB_REPO) + R"rawliteral(";

        function openTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            if (event && event.target) event.target.classList.add('active');

            if (tabId === 'tab-ota') {
                loadGitHubReleases();
            }
        }

        function loadGitHubReleases() {
            const container = document.getElementById('githubReleasesContainer');
            if (!container) return;
            container.innerHTML = '<div style="text-align:center; padding:15px; font-size:12px; color:#94a3b8;">⏳ Запрос версий с GitHub...</div>';

            const defaultReleases = [
                {
                    tag_name: "v1.0.4",
                    name: "Smart Staircase Firmware v1.0.4",
                    published_at: "2026-08-14",
                    body: "Выбор версий с GitHub прямо в Web-интерфейсе, таймер для Борисова, эффекты волны, мастер прошивки.",
                    assets: [{ name: "firmware.bin", browser_download_url: "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/download/v1.0.4/firmware.bin" }]
                },
                {
                    tag_name: "v1.0.3",
                    name: "Smart Staircase Firmware v1.0.3",
                    published_at: "2026-08-13",
                    body: "Стабильная сборка с расширенным веб-сервером и таймингами.",
                    assets: [{ name: "firmware.bin", browser_download_url: "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/download/v1.0.3/firmware.bin" }]
                },
                {
                    tag_name: "v1.0.2",
                    name: "Smart Staircase Firmware v1.0.2",
                    published_at: "2026-08-12",
                    body: "Астрономический расчет заката и восхода без сторонних ключей.",
                    assets: [{ name: "firmware.bin", browser_download_url: "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/download/v1.0.2/firmware.bin" }]
                },
                {
                    tag_name: "v1.0.0",
                    name: "Initial Release v1.0.0",
                    published_at: "2026-08-01",
                    body: "Базовая версия для ESP32 и ленты WS2812B.",
                    assets: [{ name: "firmware.bin", browser_download_url: "https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/download/v1.0.0/firmware.bin" }]
                }
            ];

            fetch("https://api.github.com/repos/" + GH_USER + "/" + GH_REPO + "/releases")
                .then(r => r.json())
                .then(releases => {
                    if (Array.isArray(releases) && releases.length > 0) {
                        renderReleasesList(releases);
                    } else {
                        renderReleasesList(defaultReleases);
                    }
                })
                .catch(() => {
                    renderReleasesList(defaultReleases);
                });
        }

        function renderReleasesList(releases) {
            const container = document.getElementById('githubReleasesContainer');
            if (!container) return;

            let html = '';
            releases.forEach((rel, idx) => {
                const tag = rel.tag_name || rel.tag || "v1.0.0";
                const cleanTag = tag.replace(/^v/, '');
                const isCurrent = (cleanTag === CURRENT_VERSION || tag === CURRENT_VERSION);
                const isLatest = (idx === 0);
                const binAsset = (rel.assets || []).find(a => a.name === 'firmware.bin' || a.name.endsWith('.bin'));
                const binUrl = binAsset ? binAsset.browser_download_url : ("https://github.com/" + GH_USER + "/" + GH_REPO + "/releases/download/" + tag + "/firmware.bin");
                const pubDate = rel.published_at ? rel.published_at.substring(0, 10) : "";

                html += '<div style="background:#0f172a; border:1px solid ' + (isCurrent ? '#10b981' : (isLatest ? '#8b5cf6' : '#334155')) + '; border-radius:12px; padding:12px; position:relative;">';
                
                html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
                html += '<div style="display:flex; align-items:center; gap:6px;">';
                html += '<span style="font-family:monospace; font-weight:bold; font-size:14px; color:#f8fafc;">' + tag + '</span>';
                if (isCurrent) {
                    html += '<span style="background:#065f46; color:#a7f3d0; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:bold;">⭐ Текущая</span>';
                }
                if (isLatest) {
                    html += '<span style="background:#4c1d95; color:#ddd6fe; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:bold;">🚀 Latest</span>';
                }
                html += '</div>';
                html += '<span style="font-size:11px; color:#64748b;">' + pubDate + '</span>';
                html += '</div>';

                if (rel.name && rel.name !== tag) {
                    html += '<div style="font-size:12px; color:#94a3b8; margin-bottom:4px; font-weight:500;">' + rel.name + '</div>';
                }

                if (rel.body) {
                    const cleanBody = rel.body.substring(0, 140) + (rel.body.length > 140 ? '...' : '');
                    html += '<div style="font-size:11px; color:#cbd5e1; margin-bottom:8px; line-height:1.4; background:#1e293b; padding:6px 8px; border-radius:6px;">' + cleanBody + '</div>';
                }

                html += '<div style="display:flex; gap:8px; align-items:center; margin-top:8px;">';
                if (isCurrent) {
                    html += '<button type="button" class="btn" style="background:#059669; cursor:default; font-size:12px; padding:8px;" disabled>✅ Установлена (v' + CURRENT_VERSION + ')</button>';
                } else {
                    html += '<button type="button" onclick="installGithubVersion(\'' + tag + '\', \'' + binUrl + '\')" class="btn btn-purple" style="font-size:12px; padding:8px;">⚡ Установить ' + tag + ' по воздуху</button>';
                }
                html += '</div>';

                html += '</div>';
            });

            container.innerHTML = html;
        }

        function installGithubVersion(tag, binUrl) {
            if (!confirm('Вы уверены, что хотите установить прошивку ' + tag + ' на ESP32 по воздуху (OTA)?')) {
                return;
            }

            const modal = document.getElementById('otaModal');
            const pBar = document.getElementById('otaProgressBar');
            const pText = document.getElementById('otaPercentText');
            const desc = document.getElementById('otaModalDesc');
            
            if (modal) modal.style.display = 'flex';
            if (pBar) pBar.style.width = '20%';
            if (pText) pText.innerText = 'Отправка команды на ESP32...';
            if (desc) desc.innerText = 'Подключение к GitHub и скачивание ' + tag + '...';

            fetch('/api/ota_install_github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ version: tag, url: binUrl })
            }).then(r => r.json()).then(res => {
                if (pBar) pBar.style.width = '60%';
                if (pText) pText.innerText = 'Запись во Flash-память... 60%';
                if (desc) desc.innerText = 'Прошивка микроконтроллера. Не отключайте питание!';

                // Poll OTA status
                let pollCount = 0;
                const pollTimer = setInterval(() => {
                    pollCount++;
                    fetch('/api/ota_status').then(r => r.json()).then(stat => {
                        if (stat.progress) {
                            if (pBar) pBar.style.width = stat.progress + '%';
                            if (pText) pText.innerText = 'Прогресс: ' + stat.progress + '% (' + stat.status + ')';
                        }
                        if (stat.status === 'success' || stat.progress >= 100) {
                            clearInterval(pollTimer);
                            if (pBar) pBar.style.width = '100%';
                            if (pText) pText.innerText = '✅ Успешно прошито! 100%';
                            if (desc) desc.innerText = 'ESP32 перезагружается... Страница обновится через 5 секунд.';
                            setTimeout(() => {
                                window.location.reload();
                            }, 5000);
                        }
                    }).catch(() => {
                        // Controller might be rebooting
                        if (pollCount > 3) {
                            clearInterval(pollTimer);
                            if (pBar) pBar.style.width = '100%';
                            if (pText) pText.innerText = '🔄 Перезагрузка ESP32...';
                            if (desc) desc.innerText = 'Подключение к обновленному контроллеру...';
                            setTimeout(() => { window.location.reload(); }, 4000);
                        }
                    });
                }, 1500);

            }).catch(err => {
                alert('Ошибка отправки команды OTA: ' + err);
                if (modal) modal.style.display = 'none';
            });
        }

        function updateStatus() {
            fetch('/api/status').then(r => r.json()).then(d => {
                document.getElementById('dispIp').innerText = d.ip || '192.168.4.1';
                document.getElementById('dispWifi').innerText = d.wifi_connected ? '✅ Подключен' : '⚠️ AP Точка Доступа';
                document.getElementById('dispTime').innerText = (d.time || '--:--') + ' (' + (d.is_night_active ? '🌙 Ночь' : '☀️ День') + ')';
                if (d.steps) {
                    document.getElementById('dispSteps').innerText = d.steps + ' / ' + (d.total_leds || d.steps*30) + ' шт';
                }
                const dp = document.getElementById('dispPins');
                if (dp && d.pin_led !== undefined) {
                    dp.innerText = 'GPIO ' + d.pin_led + ' / ' + d.pin_bot + ', ' + d.pin_top;
                }
                const sm = document.getElementById('dispSolarMode');
                if (sm) sm.innerText = d.is_night_active ? '🌙 Ночной режим АКТИВЕН (подсветка готова)' : '☀️ Дневной режим (подсветка ожидает заката)';

                const lb = document.getElementById('liveBotState');
                if (lb && d.bottom_motion !== undefined) {
                    lb.innerHTML = d.bottom_motion ? '<strong style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</strong>' : '<span style="color:#64748b;">⚪ Покой (LOW=' + d.bottom_raw + ')</span>';
                }
                const lt = document.getElementById('liveTopState');
                if (lt && d.top_motion !== undefined) {
                    lt.innerHTML = d.top_motion ? '<strong style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</strong>' : '<span style="color:#64748b;">⚪ Покой (LOW=' + d.top_raw + ')</span>';
                }
            }).catch(()=>{});
        }
        setInterval(updateStatus, 2000);
        updateStatus();

        function savePinsConfig() {
            const pin_led = document.getElementById('selPinLed').value;
            const pin_bot = document.getElementById('selPinBot').value;
            const pin_top = document.getElementById('selPinTop').value;
            const sensor_high = document.getElementById('selSensorHigh').value;
            const pull_mode = document.getElementById('selPullMode').value;

            if (pin_led === pin_bot || pin_led === pin_top || pin_bot === pin_top) {
                alert('⚠️ Ошибка: Назначены одинаковые GPIO пины для разных функций!');
                return;
            }

            if (!confirm('Сохранить новую конфигурацию пинов (LED: GPIO ' + pin_led + ', Датчики: ' + pin_bot + ', ' + pin_top + ') и перезагрузить ESP32?')) {
                return;
            }

            const params = new URLSearchParams({
                pin_led, pin_bot, pin_top, sensor_high, pull_mode, reboot: '1'
            });

            fetch('/api/save_config', { method: 'POST', body: params })
                .then(r => r.json())
                .then(() => {
                    alert('✅ Конфигурация пинов сохранена! ESP32 перезагружается...');
                    setTimeout(() => window.location.reload(), 4000);
                }).catch(() => {
                    alert('✅ Команда отправлена, контроллер перезагружается...');
                    setTimeout(() => window.location.reload(), 4000);
                });
        }

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
                        data.networks.map(n => '<option value="' + n.ssid + '">' + n.ssid + ' (' + n.rssi + ' dBm)</option>').join('');
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

