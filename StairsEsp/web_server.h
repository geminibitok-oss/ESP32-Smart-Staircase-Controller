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
            if (request->hasParam("auto_ota", true)) {
                prefs.putUChar("auto_ota", (uint8_t)request->getParam("auto_ota", true)->value().toInt());
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
        uint8_t autoOta = prefs.getUChar("auto_ota", DEFAULT_AUTO_OTA);

        return R"rawliteral(<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>ESP32 Smart Staircase Controller</title>
    <style>
        :root {
            --bg: #0b0f19;
            --surface: #111827;
            --card: #1f2937;
            --card-hover: #374151;
            --border: #374151;
            --accent: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.4);
            --amber: #f59e0b;
            --emerald: #10b981;
            --purple: #8b5cf6;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text-main);
            padding: 12px;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 640px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 18px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        /* Header */
        .app-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .brand-icon {
            font-size: 24px;
            background: #1e1b4b;
            border: 1px solid #4338ca;
            border-radius: 12px;
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brand-title {
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.3px;
        }
        .brand-sub {
            font-size: 11px;
            color: var(--text-muted);
        }
        .badge-ver {
            background: #1e293b;
            border: 1px solid #38bdf8;
            color: #38bdf8;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            font-family: monospace;
        }

        /* Top Metrics Bar */
        .metric-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .metric-card {
            background: #131d2e;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .metric-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .metric-val { font-size: 13px; font-weight: 700; color: #38bdf8; }

        /* Tabs Bar */
        .tabs-bar {
            display: flex;
            gap: 6px;
            background: #0d131f;
            padding: 4px;
            border-radius: 14px;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .tabs-bar::-webkit-scrollbar { display: none; }
        .tab-btn {
            flex: 1;
            padding: 9px 12px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .tab-btn.active {
            background: var(--accent);
            color: #ffffff;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .tab-panel { display: none; }
        .tab-panel.active { display: block; animation: fadeTab 0.25s ease-in-out; }
        @keyframes fadeTab { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* Section Headings */
        .sec-title {
            font-size: 14px;
            font-weight: 700;
            color: #e2e8f0;
            margin: 14px 0 8px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* 3D Interactive Stair Simulator */
        .sim-container {
            background: #0a0e17;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            position: relative;
            overflow: hidden;
        }
        .sim-staircase {
            display: flex;
            flex-direction: column-reverse;
            gap: 4px;
            width: 100%;
            max-width: 320px;
            perspective: 800px;
            margin: 8px 0;
        }
        .sim-step {
            height: 14px;
            border-radius: 4px;
            background: #1f2937;
            border: 1px solid #374151;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 8px;
            font-size: 9px;
            font-family: monospace;
            color: #6b7280;
        }
        .sim-step.active {
            background: #ffb450;
            border-color: #fde047;
            box-shadow: 0 0 16px rgba(255, 180, 80, 0.8), 0 0 30px rgba(255, 180, 80, 0.4);
            color: #1f2937;
            font-weight: bold;
        }
        .sim-step.standby {
            background: #78350f;
            border-color: #b45309;
            box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
            color: #fef3c7;
        }

        /* Trigger Action Buttons */
        .trigger-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
        }
        .btn-trigger {
            padding: 12px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            transition: transform 0.1s, box-shadow 0.2s;
        }
        .btn-trigger:active { transform: scale(0.97); }
        .btn-trigger-up {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
        }
        .btn-trigger-down {
            background: linear-gradient(135deg, #d97706, #b45309);
            color: #ffffff;
            box-shadow: 0 6px 16px rgba(217, 119, 6, 0.3);
        }

        /* Palette Swatches */
        .color-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }
        .color-pill {
            padding: 8px 6px;
            border: 2px solid transparent;
            border-radius: 10px;
            background: #111827;
            color: #e5e7eb;
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .color-pill:hover { border-color: #4b5563; }
        .color-pill.active { border-color: #38bdf8; background: #1e293b; }
        .color-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
        }

        /* Forms & Inputs */
        .form-group {
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-row-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .form-label {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .form-label span { color: #38bdf8; font-weight: 700; font-family: monospace; }
        input[type="text"], input[type="password"], input[type="number"], select {
            width: 100%;
            padding: 10px 12px;
            background: #0f172a;
            border: 1px solid var(--border);
            border-radius: 10px;
            color: #f9fafb;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus, select:focus { border-color: #38bdf8; }
        input[type="range"] {
            width: 100%;
            accent-color: #3b82f6;
            cursor: pointer;
        }
        input[type="color"] {
            width: 100%;
            height: 40px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: #0f172a;
            cursor: pointer;
            padding: 4px;
        }

        /* Action Buttons */
        .btn-action {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: opacity 0.2s, transform 0.1s;
        }
        .btn-action:hover { opacity: 0.95; }
        .btn-action:active { transform: scale(0.98); }
        .btn-emerald { background: linear-gradient(135deg, #059669, #10b981); color: #fff; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); }
        .btn-indigo { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3); }
        .btn-rose { background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; }

        /* Live Sensor Pills */
        .sensor-status-box {
            background: #0a0e17;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
        }
        .sensor-pill {
            background: #111827;
            border: 1px solid #374151;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .sensor-pill strong { font-size: 12px; }

        /* Card Guides */
        .guide-banner {
            background: #1e1b4b;
            border: 1px solid #4338ca;
            border-radius: 12px;
            padding: 12px;
            font-size: 12px;
            line-height: 1.5;
            color: #c7d2fe;
            margin-bottom: 12px;
        }
        .guide-banner strong { color: #facc15; }

        /* OTA Modal */
        #otaModal {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(11, 15, 25, 0.94);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .modal-box {
            background: #1f2937;
            border: 1px solid #6366f1;
            border-radius: 20px;
            padding: 24px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.8);
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="app-header">
            <div class="brand">
                <div class="brand-icon">🪜</div>
                <div>
                    <div class="brand-title">Умная Лестница ESP32</div>
                    <div class="brand-sub">WS2812B & Radar Motion Hub</div>
                </div>
            </div>
            <div class="badge-ver">v)rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(</div>
        </div>

        <!-- Telemetry Summary -->
        <div class="metric-row">
            <div class="metric-card">
                <span class="metric-label">Ступени / Всего LED</span>
                <span class="metric-val" id="dispSteps">)rawliteral" + String(numSteps) + " / " + String(numSteps * ledsStep) + R"rawliteral( шт</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Сеть / IP адрес</span>
                <span class="metric-val" id="dispIp">)rawliteral" + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "192.168.4.1 (AP)") + R"rawliteral(</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Пины (Лента / Датчики)</span>
                <span class="metric-val" id="dispPins">GPIO )rawliteral" + String(pinLed) + " / " + String(pinBot) + ", " + String(pinTop) + R"rawliteral(</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Астро-режим</span>
                <span class="metric-val" id="dispAstroStatus">Загрузка...</span>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs-bar">
            <button class="tab-btn active" onclick="switchTab('tab-control', this)">🎮 Управление</button>
            <button class="tab-btn" onclick="switchTab('tab-stairs', this)">🪜 Настройки</button>
            <button class="tab-btn" onclick="switchTab('tab-pins', this)">🔌 Пины GPIO</button>
            <button class="tab-btn" onclick="switchTab('tab-wifi', this)">📶 Wi-Fi</button>
            <button class="tab-btn" onclick="switchTab('tab-solar', this)">☀️ Солнце</button>
            <button class="tab-btn" onclick="switchTab('tab-ota', this)">⚡ OTA Прошивка</button>
        </div>

        <!-- TAB 1: Live Control & Simulator -->
        <div id="tab-control" class="tab-panel active">
            <div class="sec-title">🪜 Интерактивный 3D-Симулятор Лестницы</div>
            <div class="sim-container">
                <div class="sim-staircase" id="staircaseVisual">
                    <!-- Dynamic Steps Generated by JS -->
                </div>
                <div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:#9ca3af;">
                    <span>📍 Нижний датчик (GPIO )rawliteral" + String(pinBot) + R"rawliteral()</span>
                    <span>📍 Верхний датчик (GPIO )rawliteral" + String(pinTop) + R"rawliteral()</span>
                </div>
            </div>

            <div class="sec-title">🚶 Ручной триггер датчиков движения</div>
            <div class="trigger-grid">
                <button class="btn-trigger btn-trigger-up" onclick="triggerStairs('up')">
                    <span style="font-size:18px;">⬆️</span>
                    <span>Снизу Вверх</span>
                    <small style="opacity:0.8; font-size:10px;">Вход снизу</small>
                </button>
                <button class="btn-trigger btn-trigger-down" onclick="triggerStairs('down')">
                    <span style="font-size:18px;">⬇️</span>
                    <span>Сверху Вниз</span>
                    <small style="opacity:0.8; font-size:10px;">Вход сверху</small>
                </button>
            </div>

            <div class="sec-title">🎨 Палитра оттенков и пресеты</div>
            <div class="color-grid">
                <div class="color-pill active" onclick="applyColorPreset('#ffb450', this)"><div class="color-dot" style="background:#ffb450;"></div>2700K Уют</div>
                <div class="color-pill" onclick="applyColorPreset('#ff8a1e', this)"><div class="color-dot" style="background:#ff8a1e;"></div>2200K Янтарь</div>
                <div class="color-pill" onclick="applyColorPreset('#ffffff', this)"><div class="color-dot" style="background:#ffffff;"></div>4000K Белый</div>
                <div class="color-pill" onclick="applyColorPreset('#00f0ff', this)"><div class="color-dot" style="background:#00f0ff;"></div>Ледяной</div>
                <div class="color-pill" onclick="applyColorPreset('#a855f7', this)"><div class="color-dot" style="background:#a855f7;"></div>Неон</div>
                <div class="color-pill" onclick="applyColorPreset('#10b981', this)"><div class="color-dot" style="background:#10b981;"></div>Изумруд</div>
                <div class="color-pill" onclick="applyColorPreset('#3b82f6', this)"><div class="color-dot" style="background:#3b82f6;"></div>Океан</div>
                <div class="color-pill" onclick="applyColorPreset('#ec4899', this)"><div class="color-dot" style="background:#ec4899;"></div>Сакура</div>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <span>Свой RGB цвет:</span>
                    <span id="lblHexVal">#ffb450</span>
                </div>
                <input type="color" id="colorPicker" value="#ffb450" onchange="applyCustomColor(this.value)">
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Яркость при движении (Active Brightness):</label>
                    <span id="lblActBri">)rawliteral" + String(actBri) + R"rawliteral(</span>
                </div>
                <input type="range" id="inpActBri" min="10" max="255" value=")rawliteral" + String(actBri) + R"rawliteral(" oninput="document.getElementById('lblActBri').innerText=this.value">
            </div>

            <button class="btn-action btn-emerald" onclick="saveQuickParams()">💾 Применить параметры подсветки</button>
        </div>

        <!-- TAB 2: Staircase Settings -->
        <div id="tab-stairs" class="tab-panel">
            <div class="sec-title">🪜 Размеры и тайминги подсветки</div>
            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">Количество ступеней:</label>
                    <input type="number" id="inpNumSteps" min="1" max="32" value=")rawliteral" + String(numSteps) + R"rawliteral(">
                </div>
                <div class="form-group">
                    <label class="form-label">Диодов на ступень:</label>
                    <input type="number" id="inpLedsStep" min="1" max="60" value=")rawliteral" + String(ledsStep) + R"rawliteral(">
                </div>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Скорость шага волны (шаг):</label>
                    <span id="lblSpeed">)rawliteral" + String(animSpd) + R"rawliteral( мс</span>
                </div>
                <input type="range" id="inpSpeed" min="20" max="250" value=")rawliteral" + String(animSpd) + R"rawliteral(" oninput="document.getElementById('lblSpeed').innerText=this.value+' мс'">
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Время свечения после прохода (Hold):</label>
                    <span id="lblHold">)rawliteral" + String(holdSec) + R"rawliteral( с</span>
                </div>
                <input type="range" id="inpHold" min="3" max="60" value=")rawliteral" + String(holdSec) + R"rawliteral(" oninput="document.getElementById('lblHold').innerText=this.value+' с'">
            </div>

            <div class="sec-title">🌙 Дежурная ночная подсветка (Standby)</div>
            <div class="form-group">
                <label class="form-label">Режим дежурной подсветки:</label>
                <select id="selSbMode">
                    <option value="0" )rawliteral" + String(sbMode == 0 ? "selected" : "") + R"rawliteral(>0 — Полностью выключено</option>
                    <option value="1" )rawliteral" + String(sbMode == 1 ? "selected" : "") + R"rawliteral(>1 — Первая и последняя ступени</option>
                    <option value="2" )rawliteral" + String(sbMode == 2 ? "selected" : "") + R"rawliteral(>2 — Все ступени на минимуме</option>
                    <option value="3" )rawliteral" + String(sbMode == 3 ? "selected" : "") + R"rawliteral(>3 — Плавное дыхание</option>
                </select>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Дежурная яркость (5-100):</label>
                    <span id="lblSbBri">)rawliteral" + String(sbBri) + R"rawliteral(</span>
                </div>
                <input type="range" id="inpSbBri" min="5" max="100" value=")rawliteral" + String(sbBri) + R"rawliteral(" oninput="document.getElementById('lblSbBri').innerText=this.value">
            </div>

            <button class="btn-action btn-emerald" onclick="saveAllStairsSettings()">💾 Сохранить параметры ступеней</button>
        </div>

        <!-- TAB 3: GPIO Pins & Sensor Hardware -->
        <div id="tab-pins" class="tab-panel">
            <div class="sec-title">🔌 Назначение выводов ESP32 (GPIO)</div>
            <div class="guide-banner">
                Текущее назначение: <strong>LED = GPIO )rawliteral" + String(pinLed) + R"rawliteral(</strong>, <strong>Нижний датчик = GPIO )rawliteral" + String(pinBot) + R"rawliteral(</strong>, <strong>Верхний датчик = GPIO )rawliteral" + String(pinTop) + R"rawliteral(</strong>.
            </div>

            <div class="form-group">
                <label class="form-label">🔴 Сигнал светодиодной ленты WS2812B (Data Out):</label>
                <select id="selPinLed">
                    <option value="4" )rawliteral" + String(pinLed == 4 ? "selected" : "") + R"rawliteral(>GPIO 4 (Рекомендуется)</option>
                    <option value="18" )rawliteral" + String(pinLed == 18 ? "selected" : "") + R"rawliteral(>GPIO 18</option>
                    <option value="19" )rawliteral" + String(pinLed == 19 ? "selected" : "") + R"rawliteral(>GPIO 19</option>
                    <option value="21" )rawliteral" + String(pinLed == 21 ? "selected" : "") + R"rawliteral(>GPIO 21</option>
                    <option value="22" )rawliteral" + String(pinLed == 22 ? "selected" : "") + R"rawliteral(>GPIO 22</option>
                    <option value="23" )rawliteral" + String(pinLed == 23 ? "selected" : "") + R"rawliteral(>GPIO 23</option>
                    <option value="16" )rawliteral" + String(pinLed == 16 ? "selected" : "") + R"rawliteral(>GPIO 16</option>
                    <option value="17" )rawliteral" + String(pinLed == 17 ? "selected" : "") + R"rawliteral(>GPIO 17</option>
                    <option value="25" )rawliteral" + String(pinLed == 25 ? "selected" : "") + R"rawliteral(>GPIO 25</option>
                    <option value="26" )rawliteral" + String(pinLed == 26 ? "selected" : "") + R"rawliteral(>GPIO 26</option>
                    <option value="27" )rawliteral" + String(pinLed == 27 ? "selected" : "") + R"rawliteral(>GPIO 27</option>
                </select>
            </div>

            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">🟢 Нижний датчик (PIR):</label>
                    <select id="selPinBot">
                        <option value="22" )rawliteral" + String(pinBot == 22 ? "selected" : "") + R"rawliteral(>GPIO 22 (Установлен)</option>
                        <option value="19" )rawliteral" + String(pinBot == 19 ? "selected" : "") + R"rawliteral(>GPIO 19</option>
                        <option value="23" )rawliteral" + String(pinBot == 23 ? "selected" : "") + R"rawliteral(>GPIO 23</option>
                        <option value="21" )rawliteral" + String(pinBot == 21 ? "selected" : "") + R"rawliteral(>GPIO 21</option>
                        <option value="34" )rawliteral" + String(pinBot == 34 ? "selected" : "") + R"rawliteral(>GPIO 34</option>
                        <option value="35" )rawliteral" + String(pinBot == 35 ? "selected" : "") + R"rawliteral(>GPIO 35</option>
                        <option value="36" )rawliteral" + String(pinBot == 36 ? "selected" : "") + R"rawliteral(>GPIO 36</option>
                        <option value="39" )rawliteral" + String(pinBot == 39 ? "selected" : "") + R"rawliteral(>GPIO 39</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">🔵 Верхний датчик (PIR):</label>
                    <select id="selPinTop">
                        <option value="23" )rawliteral" + String(pinTop == 23 ? "selected" : "") + R"rawliteral(>GPIO 23 (Установлен)</option>
                        <option value="21" )rawliteral" + String(pinTop == 21 ? "selected" : "") + R"rawliteral(>GPIO 21</option>
                        <option value="22" )rawliteral" + String(pinTop == 22 ? "selected" : "") + R"rawliteral(>GPIO 22</option>
                        <option value="19" )rawliteral" + String(pinTop == 19 ? "selected" : "") + R"rawliteral(>GPIO 19</option>
                        <option value="35" )rawliteral" + String(pinTop == 35 ? "selected" : "") + R"rawliteral(>GPIO 35</option>
                        <option value="34" )rawliteral" + String(pinTop == 34 ? "selected" : "") + R"rawliteral(>GPIO 34</option>
                        <option value="36" )rawliteral" + String(pinTop == 36 ? "selected" : "") + R"rawliteral(>GPIO 36</option>
                        <option value="39" )rawliteral" + String(pinTop == 39 ? "selected" : "") + R"rawliteral(>GPIO 39</option>
                    </select>
                </div>
            </div>

            <div class="sec-title">⚙️ Логика и подтяжка входов</div>
            <div class="form-group">
                <label class="form-label">Полярность датчиков (Trigger Level):</label>
                <select id="selSensorHigh">
                    <option value="1" )rawliteral" + String(sensorHigh == 1 ? "selected" : "") + R"rawliteral(>Active HIGH (3.3V при движении — PIR HC-SR501, RCWL-0516, Радар 24G)</option>
                    <option value="0" )rawliteral" + String(sensorHigh == 0 ? "selected" : "") + R"rawliteral(>Active LOW (GND при движении — Оптические датчики NPN, кнопки)</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Внутренняя подтяжка резисторов (Pull mode):</label>
                <select id="selPullMode">
                    <option value="0" )rawliteral" + String(pullMode == 0 ? "selected" : "") + R"rawliteral(>INPUT_PULLDOWN (К земле — рекомендуется для PIR)</option>
                    <option value="1" )rawliteral" + String(pullMode == 1 ? "selected" : "") + R"rawliteral(>INPUT_PULLUP (К 3.3V — для кнопок и NPN сенсоров)</option>
                    <option value="2" )rawliteral" + String(pullMode == 2 ? "selected" : "") + R"rawliteral(>INPUT (Без подтяжки)</option>
                </select>
            </div>

            <div class="sec-title">📡 Live-состояние датчиков в реальном времени</div>
            <div class="sensor-status-box">
                <div class="sensor-pill" id="pillBot">
                    <span>Нижний вход (GPIO )rawliteral" + String(pinBot) + R"rawliteral():</span>
                    <strong id="liveBotText" style="color:#9ca3af;">⚪ Покой (LOW)</strong>
                </div>
                <div class="sensor-pill" id="pillTop">
                    <span>Верхний вход (GPIO )rawliteral" + String(pinTop) + R"rawliteral():</span>
                    <strong id="liveTopText" style="color:#9ca3af;">⚪ Покой (LOW)</strong>
                </div>
            </div>

            <button class="btn-action btn-emerald" onclick="savePinsConfig()">💾 Сохранить конфигурацию пинов и перезагрузить</button>
        </div>

        <!-- TAB 4: Wi-Fi Settings -->
        <div id="tab-wifi" class="tab-panel">
            <div class="sec-title">📶 Подключение к домашней сети Wi-Fi</div>
            <div class="guide-banner">
                Контроллер подключается к вашей домашней сети. Если сеть недоступна, создаётся точка доступа <strong>ESP32-Staircase-Setup</strong> (пароль 12345678).
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Имя сети (SSID):</label>
                    <button type="button" onclick="scanWifiNetworks()" style="background:#374151; color:#38bdf8; border:none; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">🔍 Сканировать эфир</button>
                </div>
                <input type="text" id="wifiSsid" placeholder="SSID вашей сети" value=")rawliteral" + savedSsid + R"rawliteral(">
                <select id="wifiListDropdown" style="display:none; margin-top:6px;" onchange="document.getElementById('wifiSsid').value=this.value"></select>
            </div>

            <div class="form-group">
                <label class="form-label">Пароль от Wi-Fi:</label>
                <input type="password" id="wifiPass" placeholder="Введите пароль">
            </div>

            <button class="btn-action btn-indigo" onclick="saveWifiCredentials()">💾 Подключиться к Wi-Fi и перезагрузить ESP32</button>
        </div>

        <!-- TAB 5: Solar & Location -->
        <div id="tab-solar" class="tab-panel">
            <div class="sec-title">☀️ Астрономический расчет заката и восхода</div>
            <div class="guide-banner">
                📍 <strong>Город:</strong> г. Борисов, Беларусь (54.23° N, 28.50° E)<br>
                ⏰ <strong>Часовой пояс:</strong> UTC+3 (Minsk / Moscow)<br>
                🌅 <strong>Включение:</strong> За 30 минут до наступления заката<br>
                🌇 <strong>Отключение:</strong> На рассвете<br>
                🌐 <strong>Синхронизация времени:</strong> NTP Сервер pool.ntp.org
            </div>
            <div class="metric-card" style="margin-bottom:12px;">
                <span class="metric-label">Текущее расчетное состояние:</span>
                <span class="metric-val" id="dispSolarFull" style="font-size:14px;">🌙 Ночной режим АКТИВЕН</span>
            </div>
        </div>

        <!-- TAB 6: GitHub Auto-OTA & Flashing -->
        <div id="tab-ota" class="tab-panel">
            <!-- Modal -->
            <div id="otaModal">
                <div class="modal-box">
                    <h3 style="color:#a5b4fc; font-size:18px; margin-bottom:8px;">⚡ Прошивка ESP32 по воздуху</h3>
                    <p id="otaModalDesc" style="font-size:12px; color:#cbd5e1; margin-bottom:16px;">Загрузка firmware.bin с GitHub и запись во Flash-память...</p>
                    <div style="background:#0f172a; border-radius:10px; overflow:hidden; height:16px; margin-bottom:12px; border:1px solid #374151;">
                        <div id="otaProgressBar" style="width:15%; height:100%; background:linear-gradient(90deg, #6366f1, #38bdf8); transition:width 0.3s ease;"></div>
                    </div>
                    <div id="otaPercentText" style="font-size:12px; font-weight:700; color:#38bdf8; font-family:monospace;">Скачивание... 15%</div>
                    <small style="color:#9ca3af; font-size:11px; margin-top:10px; display:block;">Не отключайте питание устройства!</small>
                </div>
            </div>

            <div class="sec-title">🌐 Автообновление с GitHub Releases</div>
            <div class="guide-banner" style="background:#1e1b4b; border-color:#4f46e5;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>Репозиторий:</strong> <span>)rawliteral" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + R"rawliteral(</span></div>
                    <button type="button" onclick="loadGitHubReleases()" style="background:#4338ca; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">🔄 Обновить</button>
                </div>
                <div style="margin-top:6px; font-size:11px;">
                    Выбирайте любую версию релиза и нажимайте <strong>«Установить»</strong>. ESP32 скачает прошивку и обновится в 1 клик!
                </div>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Автоматическая фоновая проверка релизов GitHub:</label>
                <select id="selAutoOta" onchange="toggleAutoOta(this.value)">
                    <option value="1" )rawliteral" + String(autoOta != 0 ? "selected" : "") + R"rawliteral(>Включено (Проверка каждые 120 минут)</option>
                    <option value="0" )rawliteral" + String(autoOta == 0 ? "selected" : "") + R"rawliteral(>Выключено (Только ручная проверка)</option>
                </select>
            </div>

            <div id="githubReleasesContainer" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                <div style="text-align:center; padding:15px; font-size:12px; color:#9ca3af;">⏳ Запрос версий с GitHub Releases...</div>
            </div>

            <div class="sec-title">📁 Загрузка .bin файла с компьютера</div>
            <form method="POST" action="/update" enctype="multipart/form-data" style="margin-bottom:14px;">
                <input type="file" name="update" accept=".bin" required style="margin-bottom:8px;">
                <button type="submit" class="btn-action btn-indigo">🚀 Загрузить локальный .bin файл</button>
            </form>

            <div class="sec-title">🔄 Перезагрузка микроконтроллера</div>
            <button onclick="restartEsp()" class="btn-action btn-rose">🔄 Перезагрузить ESP32</button>
        </div>
    </div>

    <script>
        const CURRENT_VERSION = ")rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(";
        const GH_USER = ")rawliteral" + String(GITHUB_USER) + R"rawliteral(";
        const GH_REPO = ")rawliteral" + String(GITHUB_REPO) + R"rawliteral(";
        let totalConfigSteps = )rawliteral" + String(numSteps) + R"rawliteral(;
        let currentStepColor = "#ffb450";

        function switchTab(tabId, btn) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            if (btn) btn.classList.add('active');

            if (tabId === 'tab-ota') loadGitHubReleases();
        }

        // Build 3D Visualizer Steps
        function buildVisualizer(stepsCount) {
            const container = document.getElementById('staircaseVisual');
            if (!container) return;
            container.innerHTML = '';
            for (let i = 1; i <= stepsCount; i++) {
                const step = document.createElement('div');
                step.className = 'sim-step';
                step.id = 'vstep-' + i;
                step.innerHTML = '<span>Ступень ' + i + '</span><span>' + (i === 1 ? '▼ Низ' : (i === stepsCount ? '▲ Верх' : '')) + '</span>';
                container.appendChild(step);
            }
        }
        buildVisualizer(totalConfigSteps);

        function triggerStairs(dir) {
            // Animate on visualizer immediately
            const steps = document.querySelectorAll('.sim-step');
            const speed = parseInt(document.getElementById('inpSpeed').value) || 80;
            
            const stepList = Array.from(steps);
            if (dir === 'down') stepList.reverse();

            stepList.forEach((st, idx) => {
                setTimeout(() => {
                    st.classList.add('active');
                    st.style.background = currentStepColor;
                }, idx * speed);
            });

            const holdMs = (parseInt(document.getElementById('inpHold').value) || 8) * 1000;
            setTimeout(() => {
                stepList.forEach((st, idx) => {
                    setTimeout(() => {
                        st.classList.remove('active');
                        st.style.background = '';
                    }, idx * (speed * 0.8));
                });
            }, holdMs + (stepList.length * speed));

            fetch('/api/trigger', { method: 'POST', body: new URLSearchParams({ dir }) });
        }

        function applyColorPreset(hex, el) {
            document.querySelectorAll('.color-pill').forEach(p => p.classList.remove('active'));
            if (el) el.classList.add('active');
            currentStepColor = hex;
            document.getElementById('colorPicker').value = hex;
            document.getElementById('lblHexVal').innerText = hex;
            sendColor(hex);
        }

        function applyCustomColor(hex) {
            document.querySelectorAll('.color-pill').forEach(p => p.classList.remove('active'));
            currentStepColor = hex;
            document.getElementById('lblHexVal').innerText = hex;
            sendColor(hex);
        }

        function sendColor(hex) {
            const r = parseInt(hex.substr(1,2), 16);
            const g = parseInt(hex.substr(3,2), 16);
            const b = parseInt(hex.substr(5,2), 16);
            fetch('/api/color', { method: 'POST', body: new URLSearchParams({ r, g, b }) });
        }

        function saveQuickParams() {
            const act_bright = document.getElementById('inpActBri').value;
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ act_bright }) })
                .then(() => alert('✅ Яркость сохранена в Flash-память!'));
        }

        function saveAllStairsSettings() {
            const num_steps = document.getElementById('inpNumSteps').value;
            const leds_step = document.getElementById('inpLedsStep').value;
            const anim_speed = document.getElementById('inpSpeed').value;
            const hold_time = document.getElementById('inpHold').value;
            const act_bright = document.getElementById('inpActBri').value;
            const sb_bright = document.getElementById('inpSbBri').value;
            const sb_mode = document.getElementById('selSbMode').value;

            totalConfigSteps = parseInt(num_steps);
            buildVisualizer(totalConfigSteps);

            fetch('/api/save_config', {
                method: 'POST',
                body: new URLSearchParams({ num_steps, leds_step, anim_speed, hold_time, act_bright, sb_bright, sb_mode, reboot: '0' })
            }).then(() => alert('✅ Параметры лестницы успешно сохранены!'));
        }

        function savePinsConfig() {
            const pin_led = document.getElementById('selPinLed').value;
            const pin_bot = document.getElementById('selPinBot').value;
            const pin_top = document.getElementById('selPinTop').value;
            const sensor_high = document.getElementById('selSensorHigh').value;
            const pull_mode = document.getElementById('selPullMode').value;

            if (pin_led === pin_bot || pin_led === pin_top || pin_bot === pin_top) {
                alert('⚠️ Ошибка: Выбраны одинаковые GPIO пины для разных устройств!');
                return;
            }

            if (!confirm('Сохранить пины (LED: GPIO ' + pin_led + ', Датчики: ' + pin_bot + ', ' + pin_top + ') и перезагрузить ESP32?')) return;

            fetch('/api/save_config', {
                method: 'POST',
                body: new URLSearchParams({ pin_led, pin_bot, pin_top, sensor_high, pull_mode, reboot: '1' })
            }).then(() => {
                alert('✅ Конфигурация сохранена! Перезагрузка...');
                setTimeout(() => window.location.reload(), 4000);
            });
        }

        function saveWifiCredentials() {
            const ssid = document.getElementById('wifiSsid').value;
            const pass = document.getElementById('wifiPass').value;
            if (!confirm('Сохранить Wi-Fi (' + ssid + ') и перезагрузить ESP32?')) return;
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ ssid, pass, reboot: '1' }) })
                .then(() => {
                    alert('✅ Настройки сохранены! ESP32 перезагружается для подключения к ' + ssid + '...');
                    setTimeout(() => window.location.reload(), 5000);
                });
        }

        function toggleAutoOta(val) {
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ auto_ota: val }) })
                .then(() => alert(val == '1' ? '✅ Автоматическая проверка OTA включена.' : '✅ Авто-OTA отключено.'));
        }

        function scanWifiNetworks() {
            const dropdown = document.getElementById('wifiListDropdown');
            dropdown.style.display = 'block';
            dropdown.innerHTML = '<option>⏳ Сканирование радиоэфира...</option>';
            fetch('/api/scan_wifi').then(r => r.json()).then(d => {
                if (d.networks && d.networks.length) {
                    dropdown.innerHTML = '<option value="">-- Выберите найденную сеть --</option>' +
                        d.networks.map(n => '<option value="' + n.ssid + '">' + n.ssid + ' (' + n.rssi + ' dBm)</option>').join('');
                } else {
                    dropdown.innerHTML = '<option>Сети не обнаружены</option>';
                }
            });
        }

        function loadGitHubReleases() {
            const c = document.getElementById('githubReleasesContainer');
            if (!c) return;
            c.innerHTML = '<div style="text-align:center; padding:15px; font-size:12px; color:#9ca3af;">⏳ Запрос версий с GitHub API...</div>';

            const defaultList = [
                { tag_name: "v1.0.9", name: "Smart Staircase Firmware v1.0.9", published_at: "2026-08-17", body: "Актуальная версия с поддержкой датчиков на GPIO 22/23, защитой от 404 и семантическим OTA." },
                { tag_name: "v1.0.4", name: "Smart Staircase Firmware v1.0.4", published_at: "2026-08-14", body: "Выбор версий с GitHub прямо в Web-интерфейсе, таймер для Борисова." },
                { tag_name: "v1.0.0", name: "Initial Release v1.0.0", published_at: "2026-08-01", body: "Базовая сборка для WS2812B." }
            ];

            fetch('https://api.github.com/repos/' + GH_USER + '/' + GH_REPO + '/releases')
                .then(r => r.json())
                .then(list => renderReleases(Array.isArray(list) && list.length ? list : defaultList))
                .catch(() => renderReleases(defaultList));
        }

        function renderReleases(list) {
            const c = document.getElementById('githubReleasesContainer');
            if (!c) return;
            let html = '';
            list.forEach((rel, idx) => {
                const tag = rel.tag_name || 'v1.0.9';
                const clean = tag.replace(/^v/, '');
                const isCur = (clean === CURRENT_VERSION || tag === CURRENT_VERSION);
                const isLat = (idx === 0);
                const binAsset = (rel.assets || []).find(a => a.name.endsWith('.bin'));
                const binUrl = binAsset ? binAsset.browser_download_url : ('https://github.com/' + GH_USER + '/' + GH_REPO + '/releases/download/' + tag + '/firmware.bin');

                html += '<div style="background:#0f172a; border:1px solid ' + (isCur ? '#10b981' : (isLat ? '#8b5cf6' : '#374151')) + '; border-radius:14px; padding:12px;">';
                html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
                html += '<div style="display:flex; align-items:center; gap:6px;">';
                html += '<strong style="font-family:monospace; font-size:14px; color:#f8fafc;">' + tag + '</strong>';
                if (isCur) html += '<span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;">⭐ Текущая</span>';
                if (isLat) html += '<span style="background:#4c1d95; color:#ddd6fe; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;">🚀 Latest</span>';
                html += '</div>';
                html += '<span style="font-size:11px; color:#6b7280;">' + (rel.published_at ? rel.published_at.substring(0, 10) : '') + '</span>';
                html += '</div>';

                if (rel.body) html += '<div style="font-size:11px; color:#cbd5e1; margin:6px 0; background:#1e293b; padding:6px 8px; border-radius:6px;">' + rel.body + '</div>';

                if (isCur) {
                    html += '<button type="button" class="btn-action" style="background:#059669; font-size:12px; padding:8px; cursor:default;" disabled>✅ Установлена</button>';
                } else {
                    html += '<button type="button" onclick="installGithubOta(\'' + tag + '\', \'' + binUrl + '\')" class="btn-action btn-indigo" style="font-size:12px; padding:8px;">⚡ Установить ' + tag + ' по воздуху</button>';
                }
                html += '</div>';
            });
            c.innerHTML = html;
        }

        function installGithubOta(tag, url) {
            if (!confirm('Прошить ESP32 версией ' + tag + ' по воздуху?')) return;
            const modal = document.getElementById('otaModal');
            const pBar = document.getElementById('otaProgressBar');
            const pText = document.getElementById('otaPercentText');
            if (modal) modal.style.display = 'flex';

            fetch('/api/ota_install_github', { method: 'POST', body: new URLSearchParams({ version: tag, url }) })
                .then(() => {
                    let ticks = 0;
                    const timer = setInterval(() => {
                        ticks++;
                        fetch('/api/ota_status').then(r => r.json()).then(st => {
                            if (st.progress) {
                                pBar.style.width = st.progress + '%';
                                pText.innerText = 'Прогресс: ' + st.progress + '% (' + st.status + ')';
                            }
                            if (st.status === 'success' || st.progress >= 100) {
                                clearInterval(timer);
                                pBar.style.width = '100%';
                                pText.innerText = '✅ Успешно! Перезагрузка...';
                                setTimeout(() => window.location.reload(), 4500);
                            }
                        }).catch(() => {
                            if (ticks > 4) {
                                clearInterval(timer);
                                pBar.style.width = '100%';
                                pText.innerText = '🔄 Перезагрузка...';
                                setTimeout(() => window.location.reload(), 4000);
                            }
                        });
                    }, 1500);
                });
        }

        function updateTelemetry() {
            fetch('/api/status').then(r => r.json()).then(d => {
                if (d.steps) {
                    document.getElementById('dispSteps').innerText = d.steps + ' / ' + (d.total_leds || d.steps*20) + ' шт';
                }
                if (d.ip) document.getElementById('dispIp').innerText = d.ip;
                if (d.pin_led !== undefined) {
                    document.getElementById('dispPins').innerText = 'GPIO ' + d.pin_led + ' / ' + d.pin_bot + ', ' + d.pin_top;
                }
                const astro = document.getElementById('dispAstroStatus');
                if (astro) astro.innerText = d.is_night_active ? '🌙 Ночь (Готова)' : '☀️ День (Ожидание)';
                const solarFull = document.getElementById('dispSolarFull');
                if (solarFull) solarFull.innerText = d.is_night_active ? '🌙 Ночной режим АКТИВЕН (Закат: ' + (d.sunset || '19:40') + ')' : '☀️ Дневной режим (Рассвет: ' + (d.sunrise || '05:30') + ')';

                const botTxt = document.getElementById('liveBotText');
                if (botTxt && d.bottom_motion !== undefined) {
                    botTxt.innerHTML = d.bottom_motion ? '<span style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</span>' : '<span style="color:#9ca3af;">⚪ Покой (LOW=' + d.bottom_raw + ')</span>';
                }
                const topTxt = document.getElementById('liveTopText');
                if (topTxt && d.top_motion !== undefined) {
                    topTxt.innerHTML = d.top_motion ? '<span style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</span>' : '<span style="color:#9ca3af;">⚪ Покой (LOW=' + d.top_raw + ')</span>';
                }
            }).catch(()=>{});
        }
        setInterval(updateTelemetry, 1500);
        updateTelemetry();

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
