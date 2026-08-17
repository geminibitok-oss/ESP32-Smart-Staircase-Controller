/**
 * ==============================================================================
 * ESP32 Smart Staircase Controller - Arduino IDE / Arduino CLI Sketch
 * WS2812B Addressable LED Strip + Dual PIR Sensors + Solar Schedule + GitHub OTA
 * ==============================================================================
 */
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#include "config.h"
#include "version.h"
#include "solar_scheduler.h"
#include "led_controller.h"
#include "ota_manager.h"
#include "web_server.h"

// Subsystem singletons
SolarScheduler solarEngine;
StairLedController ledEngine;
OtaManager otaEngine;
StairWebServer webEngine;
Preferences sysPrefs;

// Dynamic GPIO Pin Configuration
uint8_t pinLedData = PIN_LED_DATA;
uint8_t pinBottomPir = PIN_BOTTOM_PIR;
uint8_t pinTopPir = PIN_TOP_PIR;
uint8_t pinLdr = PIN_LDR_SENSOR;
uint8_t sensorActiveHigh = 1; // 1 = HIGH on motion (Active HIGH), 0 = LOW on motion (Active LOW)
uint8_t sensorPullMode = 0;   // 0 = INPUT_PULLDOWN, 1 = INPUT_PULLUP, 2 = INPUT (Floating)

// Sensor debounce variables
bool lastBottomState = false;
bool lastTopState = false;
bool currentBottomMotion = false;
bool currentTopMotion = false;
unsigned long lastSolarCheck = 0;

void onStartOta() {
    Serial.println("[SYSTEM] OTA starting -> Switching LEDs to update mode");
    ledEngine.setOtaMode(true);
}

void onOtaFailed(String err) {
    Serial.printf("[SYSTEM] OTA Flash Failed: %s -> Restoring normal LED mode\n", err.c_str());
    ledEngine.resetOtaMode();
}

void onOtaSuccess() {
    Serial.println("[SYSTEM] OTA Flash Succeeded! Restarting ESP32...");
}

void onColorChanged(uint8_t r, uint8_t g, uint8_t b) {
    Serial.printf("[SYSTEM] New Color Set: R=%d G=%d B=%d\n", r, g, b);
    ledEngine.setColor(r, g, b);
}

void onManualTrigger(bool isBottom) {
    if (isBottom) ledEngine.triggerBottom();
    else ledEngine.triggerTop();
}

void loadDynamicSettings() {
    sysPrefs.begin("stairs_cfg", true);
    uint8_t steps = sysPrefs.getUChar("num_steps", DEFAULT_NUM_STEPS);
    uint8_t ledsStep = sysPrefs.getUChar("leds_step", DEFAULT_LEDS_STEP);
    uint32_t animSpd = sysPrefs.getUInt("anim_spd", STEP_ANIM_SPEED_MS);
    uint32_t holdSec = sysPrefs.getUInt("hold_sec", HOLD_TIME_SECONDS);
    uint8_t actBri = sysPrefs.getUChar("act_bri", ACTIVE_BRIGHTNESS);
    uint8_t sbBri = sysPrefs.getUChar("sb_bri", STANDBY_BRIGHTNESS);
    uint8_t sbMode = sysPrefs.getUChar("sb_mode", STANDBY_MODE_TYPE);
    uint8_t r = sysPrefs.getUChar("col_r", 255);
    uint8_t g = sysPrefs.getUChar("col_g", 180);
    uint8_t b = sysPrefs.getUChar("col_b", 80);

    // GPIO Pins from NVS
    pinLedData = sysPrefs.getUChar("pin_led", PIN_LED_DATA);
    pinBottomPir = sysPrefs.getUChar("pin_bot", PIN_BOTTOM_PIR);
    pinTopPir = sysPrefs.getUChar("pin_top", PIN_TOP_PIR);
    pinLdr = sysPrefs.getUChar("pin_ldr", PIN_LDR_SENSOR);
    sensorActiveHigh = sysPrefs.getUChar("sensor_high", 1);
    sensorPullMode = sysPrefs.getUChar("pull_mode", 0);
    uint8_t autoOta = sysPrefs.getUChar("auto_ota", DEFAULT_AUTO_OTA);
    sysPrefs.end();

    otaEngine.autoOtaEnabled = (autoOta != 0);

    if (steps > 0 && steps <= MAX_STEPS) ledEngine.numSteps = steps;
    if (ledsStep > 0 && ledsStep <= MAX_LEDS_PER_STEP) ledEngine.ledsPerStep = ledsStep;
    ledEngine.stepAnimSpeed = animSpd;
    ledEngine.holdTimeSec = holdSec;
    ledEngine.activeBrightness = actBri;
    ledEngine.standbyBrightness = sbBri;
    ledEngine.standbyModeType = sbMode;
    ledEngine.setColor(r, g, b);
    FastLED.setBrightness(actBri);
}

void configureSensorPinModes() {
    uint8_t mode = INPUT_PULLDOWN;
    if (sensorPullMode == 1) mode = INPUT_PULLUP;
    else if (sensorPullMode == 2) mode = INPUT;

    // GPIOs 34-39 on ESP32 have no internal pullup/pulldown resistors, forced to INPUT
    if (pinBottomPir >= 34 && pinBottomPir <= 39) {
        pinMode(pinBottomPir, INPUT);
    } else {
        pinMode(pinBottomPir, mode);
    }

    if (pinTopPir >= 34 && pinTopPir <= 39) {
        pinMode(pinTopPir, INPUT);
    } else {
        pinMode(pinTopPir, mode);
    }

    if (pinLdr > 0) {
        pinMode(pinLdr, INPUT);
    }

    Serial.printf("[PINS] Configured: LED_DATA=GPIO %d | BOTTOM_PIR=GPIO %d | TOP_PIR=GPIO %d | Mode=%d | ActiveHigh=%d\n",
                  pinLedData, pinBottomPir, pinTopPir, sensorPullMode, sensorActiveHigh);
}

String getSystemStatusJson() {
    JsonDocument doc;
    doc["version"] = FIRMWARE_VERSION;
    doc["steps"] = ledEngine.numSteps;
    doc["leds_per_step"] = ledEngine.ledsPerStep;
    doc["total_leds"] = ledEngine.numSteps * ledEngine.ledsPerStep;
    doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    doc["ip"] = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
    doc["time"] = solarEngine.getFormattedCurrentTime();
    doc["sunrise"] = solarEngine.getFormattedSunrise();
    doc["sunset"] = solarEngine.getFormattedSunset();
    doc["is_night_active"] = solarEngine.isNightTimeActive();
    doc["stair_state"] = (int)ledEngine.currentState;

    // Pin & Sensor Status
    doc["pin_led"] = pinLedData;
    doc["pin_bot"] = pinBottomPir;
    doc["pin_top"] = pinTopPir;
    doc["pin_ldr"] = pinLdr;
    doc["sensor_high"] = sensorActiveHigh;
    doc["pull_mode"] = sensorPullMode;
    doc["bottom_raw"] = digitalRead(pinBottomPir);
    doc["top_raw"] = digitalRead(pinTopPir);
    doc["bottom_motion"] = currentBottomMotion;
    doc["top_motion"] = currentTopMotion;

    String output;
    serializeJson(doc, output);
    return output;
}

bool onTriggerGithubOta(String binUrl) {
    Serial.println("[OTA] Triggering GitHub OTA update from Web UI: " + binUrl);
    return otaEngine.triggerCustomUpdate(binUrl, onStartOta, onOtaFailed, onOtaSuccess);
}

String getOtaStatusJson() {
    return otaEngine.getOtaStatusJson();
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n========================================================");
    Serial.println("   ESP32 SMART STAIRCASE CONTROLLER (v" FIRMWARE_VERSION ")");
    Serial.println("========================================================");

    loadDynamicSettings();
    configureSensorPinModes();

    // Initialize LED Controller on configured Pin
    ledEngine.begin(pinLedData);

    // Read stored WiFi credentials
    sysPrefs.begin("stairs_cfg", true);
    String ssid = sysPrefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
    String pass = sysPrefs.getString("wifi_pass", DEFAULT_WIFI_PASS);
    sysPrefs.end();

    // Connect to Wi-Fi with fallback to AP
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    Serial.print("[WIFI] Connecting to: " + ssid);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Connected! IP Address: %s\n", WiFi.localIP().toString().c_str());
        solarEngine.begin();
        solarEngine.updateTime();
        otaEngine.begin();
    } else {
        Serial.printf("\n[WIFI] Failed to connect to '%s'. Starting AP Mode: %s\n", ssid.c_str(), AP_SSID_NAME);
        WiFi.softAP(AP_SSID_NAME, AP_PASSWORD_NAME);
        Serial.printf("[WIFI] AP Started. Connect to '%s' (Password: %s) -> Open http://192.168.4.1\n", AP_SSID_NAME, AP_PASSWORD_NAME);
    }

    // Start Web Server
    webEngine.begin(onColorChanged, onManualTrigger, getSystemStatusJson, loadDynamicSettings, onTriggerGithubOta, getOtaStatusJson);

    Serial.println("[SYSTEM] Ready! Waiting for sensor triggers...");
}

void handleSerialCommands() {
    if (Serial.available() > 0) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) return;

        if (line.equalsIgnoreCase("HELP") || line.equals("?")) {
            Serial.println("\n--- [ESP32 STAIRS COMMAND CONSOLE] ---");
            Serial.println("  WIFI=<SSID>,<PASS>       - Set Wi-Fi credentials");
            Serial.println("  STEPS=<count>            - Set stairs count (1-32)");
            Serial.println("  LEDS=<count>             - Set LEDs per step (1-60)");
            Serial.println("  SPEED=<ms>               - Animation delay per step");
            Serial.println("  HOLD=<sec>               - Hold timer in seconds");
            Serial.println("  BRI=<0-255>              - Active brightness");
            Serial.println("  STANDBY=<mode>,<0-255>   - Standby mode (0-3) and brightness");
            Serial.println("  COLOR=<R>,<G>,<B>        - Strip color (e.g. COLOR=255,180,80)");
            Serial.println("  PINS=<led>,<bot>,<top>   - Dynamic GPIO pin assignment");
            Serial.println("  SENSORS=<bot>,<top>      - Set sensor GPIO pins (e.g. SENSORS=22,23)");
            Serial.println("  BOT=<gpio> / TOP=<gpio>  - Set individual sensor pin");
            Serial.println("  TRIGGER=<UP|DOWN>        - Test trigger stairs");
            Serial.println("  OTA=<ON|OFF|CHECK>       - Control GitHub Auto-OTA updates");
            Serial.println("  STATUS                   - Print current configuration");
            Serial.println("  REBOOT                   - Restart controller");
            Serial.println("--------------------------------------\n");
            return;
        }

        if (line.startsWith("PINS=")) {
            String val = line.substring(5);
            int c1 = val.indexOf(',');
            int c2 = val.indexOf(',', c1 + 1);
            if (c1 != -1 && c2 != -1) {
                int pLed = val.substring(0, c1).toInt();
                int pBot = val.substring(c1 + 1, c2).toInt();
                int pTop = val.substring(c2 + 1).toInt();
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("pin_led", (uint8_t)pLed);
                sysPrefs.putUChar("pin_bot", (uint8_t)pBot);
                sysPrefs.putUChar("pin_top", (uint8_t)pTop);
                sysPrefs.end();
                pinLedData = pLed;
                pinBottomPir = pBot;
                pinTopPir = pTop;
                configureSensorPinModes();
                Serial.printf("[CONFIG] Pins updated: LED=%d, BOT=%d, TOP=%d. Saved!\n", pLed, pBot, pTop);
            }
            return;
        }

        if (line.startsWith("SENSORS=")) {
            String val = line.substring(8);
            int c1 = val.indexOf(',');
            if (c1 != -1) {
                int pBot = val.substring(0, c1).toInt();
                int pTop = val.substring(c1 + 1).toInt();
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("pin_bot", (uint8_t)pBot);
                sysPrefs.putUChar("pin_top", (uint8_t)pTop);
                sysPrefs.end();
                pinBottomPir = pBot;
                pinTopPir = pTop;
                configureSensorPinModes();
                Serial.printf("[CONFIG] Sensors updated: BOTTOM=GPIO %d, TOP=GPIO %d. Saved!\n", pBot, pTop);
            }
            return;
        }

        if (line.startsWith("BOT=")) {
            int pBot = line.substring(4).toInt();
            sysPrefs.begin("stairs_cfg", false);
            sysPrefs.putUChar("pin_bot", (uint8_t)pBot);
            sysPrefs.end();
            pinBottomPir = pBot;
            configureSensorPinModes();
            Serial.printf("[CONFIG] Bottom sensor set to GPIO %d. Saved!\n", pBot);
            return;
        }

        if (line.startsWith("TOP=")) {
            int pTop = line.substring(4).toInt();
            sysPrefs.begin("stairs_cfg", false);
            sysPrefs.putUChar("pin_top", (uint8_t)pTop);
            sysPrefs.end();
            pinTopPir = pTop;
            configureSensorPinModes();
            Serial.printf("[CONFIG] Top sensor set to GPIO %d. Saved!\n", pTop);
            return;
        }

        if (line.equalsIgnoreCase("STATUS")) {
            Serial.println(getSystemStatusJson());
            return;
        }

        if (line.equalsIgnoreCase("REBOOT")) {
            Serial.println("[SYSTEM] Rebooting ESP32...");
            delay(500);
            ESP.restart();
            return;
        }

        if (line.startsWith("WIFI=")) {
            String val = line.substring(5);
            int commaIdx = val.indexOf(',');
            String ssid = (commaIdx != -1) ? val.substring(0, commaIdx) : val;
            String pass = (commaIdx != -1) ? val.substring(commaIdx + 1) : "";
            sysPrefs.begin("stairs_cfg", false);
            sysPrefs.putString("wifi_ssid", ssid);
            sysPrefs.putString("wifi_pass", pass);
            sysPrefs.end();
            Serial.printf("[CONFIG] Wi-Fi updated: SSID='%s', Pass='%s'. Saved!\n", ssid.c_str(), pass.c_str());
            return;
        }

        if (line.startsWith("STEPS=")) {
            int steps = line.substring(6).toInt();
            if (steps >= 1 && steps <= MAX_STEPS) {
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("num_steps", (uint8_t)steps);
                sysPrefs.end();
                ledEngine.numSteps = steps;
                Serial.printf("[CONFIG] Steps count set to: %d\n", steps);
            } else {
                Serial.println("[ERROR] Steps must be between 1 and 32");
            }
            return;
        }

        if (line.startsWith("LEDS=")) {
            int leds = line.substring(5).toInt();
            if (leds >= 1 && leds <= MAX_LEDS_PER_STEP) {
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("leds_step", (uint8_t)leds);
                sysPrefs.end();
                ledEngine.ledsPerStep = leds;
                Serial.printf("[CONFIG] LEDs per step set to: %d\n", leds);
            } else {
                Serial.println("[ERROR] LEDs per step must be between 1 and 60");
            }
            return;
        }

        if (line.startsWith("SPEED=")) {
            int spd = line.substring(6).toInt();
            if (spd >= 10 && spd <= 1000) {
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUInt("anim_spd", spd);
                sysPrefs.end();
                ledEngine.stepAnimSpeed = spd;
                Serial.printf("[CONFIG] Animation speed set to: %d ms\n", spd);
            }
            return;
        }

        if (line.startsWith("HOLD=")) {
            int h = line.substring(5).toInt();
            if (h >= 1 && h <= 300) {
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUInt("hold_sec", h);
                sysPrefs.end();
                ledEngine.holdTimeSec = h;
                Serial.printf("[CONFIG] Hold time set to: %d sec\n", h);
            }
            return;
        }

        if (line.startsWith("BRI=")) {
            int b = line.substring(4).toInt();
            if (b >= 5 && b <= 255) {
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("act_bri", (uint8_t)b);
                sysPrefs.end();
                ledEngine.activeBrightness = b;
                FastLED.setBrightness(b);
                Serial.printf("[CONFIG] Brightness set to: %d\n", b);
            }
            return;
        }

        if (line.startsWith("STANDBY=")) {
            String val = line.substring(8);
            int commaIdx = val.indexOf(',');
            int mode = (commaIdx != -1) ? val.substring(0, commaIdx).toInt() : val.toInt();
            int bri = (commaIdx != -1) ? val.substring(commaIdx + 1).toInt() : 25;
            sysPrefs.begin("stairs_cfg", false);
            sysPrefs.putUChar("sb_mode", (uint8_t)mode);
            sysPrefs.putUChar("sb_bri", (uint8_t)bri);
            sysPrefs.end();
            ledEngine.standbyModeType = mode;
            ledEngine.standbyBrightness = bri;
            Serial.printf("[CONFIG] Standby mode: %d, Brightness: %d\n", mode, bri);
            return;
        }

        if (line.startsWith("COLOR=")) {
            String val = line.substring(6);
            int c1 = val.indexOf(',');
            int c2 = val.indexOf(',', c1 + 1);
            if (c1 != -1 && c2 != -1) {
                int r = val.substring(0, c1).toInt();
                int g = val.substring(c1 + 1, c2).toInt();
                int b = val.substring(c2 + 1).toInt();
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("col_r", (uint8_t)r);
                sysPrefs.putUChar("col_g", (uint8_t)g);
                sysPrefs.putUChar("col_b", (uint8_t)b);
                sysPrefs.end();
                ledEngine.setColor(r, g, b);
                Serial.printf("[CONFIG] Color set: R=%d G=%d B=%d\n", r, g, b);
            }
            return;
        }

        if (line.startsWith("TRIGGER=")) {
            String d = line.substring(8);
            if (d.equalsIgnoreCase("UP")) ledEngine.triggerBottom();
            else if (d.equalsIgnoreCase("DOWN")) ledEngine.triggerTop();
            Serial.printf("[TEST] Triggered: %s\n", d.c_str());
            return;
        }

        if (line.startsWith("OTA=")) {
            String v = line.substring(4);
            v.toUpperCase();
            if (v == "ON" || v == "1") {
                otaEngine.autoOtaEnabled = true;
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("auto_ota", 1);
                sysPrefs.end();
                Serial.println("[CONFIG] Auto-OTA is now ENABLED.");
            } else if (v == "OFF" || v == "0") {
                otaEngine.autoOtaEnabled = false;
                sysPrefs.begin("stairs_cfg", false);
                sysPrefs.putUChar("auto_ota", 0);
                sysPrefs.end();
                Serial.println("[CONFIG] Auto-OTA is now DISABLED.");
            } else if (v == "CHECK") {
                Serial.println("[OTA] Manual update check initiated via Serial...");
                otaEngine.checkForUpdate(onStartOta, onOtaFailed, onOtaSuccess);
            }
            return;
        }

        Serial.println("[CMD] Unknown command: " + line + ". Type HELP for instructions.");
    }
}

void loop() {
    // 0. Handle CLI Serial commands from USB / terminal.bat / flash_windows.bat
    handleSerialCommands();

    // 1. Read Motion Sensors with dynamic pin configuration & inverted logic support
    currentBottomMotion = (digitalRead(pinBottomPir) == (sensorActiveHigh ? HIGH : LOW));
    currentTopMotion = (digitalRead(pinTopPir) == (sensorActiveHigh ? HIGH : LOW));

    // Check if night lighting is enabled (Sunset - 30m to Sunrise)
    bool isSolarActive = solarEngine.isNightTimeActive();

    // Bottom sensor triggered (rising edge of detected motion)
    if (currentBottomMotion && !lastBottomState) {
        ledEngine.triggerBottom();
    }
    lastBottomState = currentBottomMotion;

    // Top sensor triggered (rising edge of detected motion)
    if (currentTopMotion && !lastTopState) {
        ledEngine.triggerTop();
    }
    lastTopState = currentTopMotion;

    // 2. Update LED Animations
    ledEngine.update(isSolarActive);

    // 3. Periodic Solar & NTP refresh (every 60 seconds)
    unsigned long now = millis();
    if (now - lastSolarCheck >= 60000UL) {
        lastSolarCheck = now;
        solarEngine.updateTime();
    }

    // 4. Background GitHub Auto-OTA Handler
    otaEngine.handle(onStartOta, onOtaFailed, onOtaSuccess);

    delay(10);
}

