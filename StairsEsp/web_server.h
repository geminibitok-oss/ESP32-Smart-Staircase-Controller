/**
 * Embedded Web Configuration Interface & REST API
 * Provides a responsive control panel and fallback manual OTA file upload.
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Update.h>
#include "config.h"

class StairWebServer {
public:
    AsyncWebServer server;

    StairWebServer() : server(80) {}

    void begin(void (*onColorChange)(uint8_t r, uint8_t g, uint8_t b),
               void (*onTrigger)(bool isBottom),
               String (*getStatusJson)()) {

        server.on("/", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            String html = getIndexHtml();
            request->send(200, "text/html", html);
        });

        server.on("/api/status", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            request->send(200, "application/json", getStatusJson());
        });

        server.on("/api/trigger", HTTP_POST, [onTrigger](AsyncWebServerRequest *request) {
            if (request->hasParam("dir", true)) {
                String dir = request->getParam("dir", true)->value();
                if (dir == "up") onTrigger(true);
                else onTrigger(false);
            }
            request->send(200, "application/json", "{\"status\":\"triggered\"}");
        });

        server.on("/api/color", HTTP_POST, [onColorChange](AsyncWebServerRequest *request) {
            if (request->hasParam("r", true) && request->hasParam("g", true) && request->hasParam("b", true)) {
                int r = request->getParam("r", true)->value().toInt();
                int g = request->getParam("g", true)->value().toInt();
                int b = request->getParam("b", true)->value().toInt();
                onColorChange(r, g, b);
            }
            request->send(200, "application/json", "{\"status\":\"ok\"}");
        });

        server.on("/update", HTTP_GET, [](AsyncWebServerRequest *request) {
            String html = "<form method='POST' action='/update' enctype='multipart/form-data'>"
                          "<h2>ESP32 Manual Firmware Upload (.bin)</h2>"
                          "<input type='file' name='update'><br><br>"
                          "<input type='submit' value='Flash Firmware'>"
                          "</form>";
            request->send(200, "text/html", html);
        });

        server.on("/update", HTTP_POST, [](AsyncWebServerRequest *request) {
            bool shouldReboot = !Update.hasError();
            AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", shouldReboot ? "OK - Rebooting..." : "FAIL");
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
        Serial.println("[HTTP] Web Server listening on port 80");
    }

private:
    static String getIndexHtml() {
        return R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ESP32 Smart Staircase Controller</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .card { background: #1e293b; padding: 24px; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin-top: 0; font-size: 22px; color: #fbbf24; }
        .btn { background: #3b82f6; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 10px; font-weight: bold; }
        .btn-amber { background: #f59e0b; }
        .btn:hover { opacity: 0.9; }
        .row { display: flex; gap: 10px; margin-top: 10px; }
        .stat { background: #0f172a; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
        .stat span { color: #38bdf8; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🌟 Smart Staircase Controller</h1>
        <div class="stat">Version: <span>)rawliteral" + String(FIRMWARE_VERSION) + R"rawliteral(</span></div>
        <div class="stat">Steps: <span>)rawliteral" + String(NUM_STEPS) + R"rawliteral( ()rawliteral" + String(TOTAL_LEDS) + R"rawliteral( LEDs)</span></div>
        
        <div class="row">
            <button class="btn" onclick="fetch('/api/trigger', {method:'POST', body:new URLSearchParams({dir:'up'})})">🚶 Trigger UP</button>
            <button class="btn btn-amber" onclick="fetch('/api/trigger', {method:'POST', body:new URLSearchParams({dir:'down'})})">🚶 Trigger DOWN</button>
        </div>

        <div style="margin-top: 20px;">
            <label>Color Picker:</label><br>
            <input type="color" id="colorPicker" value="#ffb450" style="width:100%; height:45px; border:none; border-radius:8px; cursor:pointer;" onchange="updateColor(this.value)">
        </div>

        <div style="margin-top: 25px; text-align: center;">
            <a href="/update" style="color: #94a3b8; font-size: 13px;">Manual OTA Firmware Flash (.bin)</a>
        </div>
    </div>

    <script>
        function updateColor(hex) {
            const r = parseInt(hex.substr(1,2), 16);
            const g = parseInt(hex.substr(3,2), 16);
            const b = parseInt(hex.substr(5,2), 16);
            fetch('/api/color', {
                method: 'POST',
                body: new URLSearchParams({ r, g, b })
            });
        }
    </script>
</body>
</html>
)rawliteral";
    }
};
