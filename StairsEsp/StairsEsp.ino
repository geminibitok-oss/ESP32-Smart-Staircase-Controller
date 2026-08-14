/**
 * ==============================================================================
 * ESP32 Smart Staircase Controller - Arduino IDE / Arduino CLI Sketch
 * WS2812B Addressable LED Strip + Dual PIR Sensors + Solar Schedule + GitHub OTA
 * ==============================================================================
 */
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>

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

// Sensor debounce variables
bool lastBottomState = LOW;
bool lastTopState = LOW;
unsigned long lastSolarCheck = 0;

void onStartOta() {
    Serial.println("[SYSTEM] OTA starting -> Switching LEDs to update mode");
    ledEngine.setOtaMode(true);
}

void onColorChanged(uint8_t r, uint8_t g, uint8_t b) {
    Serial.printf("[SYSTEM] New Color Set: R=%d G=%d B=%d\n", r, g, b);
    ledEngine.setColor(r, g, b);
}

void onManualTrigger(bool isBottom) {
    if (isBottom) ledEngine.triggerBottom();
    else ledEngine.triggerTop();
}

String getSystemStatusJson() {
    JsonDocument doc;
    doc["version"] = FIRMWARE_VERSION;
    doc["steps"] = NUM_STEPS;
    doc["leds"] = TOTAL_LEDS;
    doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    doc["ip"] = WiFi.localIP().toString();
    doc["time"] = solarEngine.getFormattedCurrentTime();
    doc["sunrise"] = solarEngine.getFormattedSunrise();
    doc["sunset"] = solarEngine.getFormattedSunset();
    doc["is_night_active"] = solarEngine.isNightTimeActive();
    doc["stair_state"] = (int)ledEngine.currentState;

    String output;
    serializeJson(doc, output);
    return output;
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n========================================================");
    Serial.println("   ESP32 SMART STAIRCASE CONTROLLER (v" FIRMWARE_VERSION ")");
    Serial.println("========================================================");

    // Initialize Sensor Pins
    pinMode(PIN_BOTTOM_PIR, INPUT_PULLDOWN);
    pinMode(PIN_TOP_PIR, INPUT_PULLDOWN);
    if (PIN_LDR_SENSOR > 0) {
        pinMode(PIN_LDR_SENSOR, INPUT);
    }

    // Initialize LED Controller
    ledEngine.begin();

    // Connect to Wi-Fi with fallback to AP
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
    
    Serial.print("[WIFI] Connecting to " DEFAULT_WIFI_SSID);
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
        Serial.printf("\n[WIFI] Failed to connect to '%s'. Starting AP Mode: %s\n", DEFAULT_WIFI_SSID, AP_SSID_NAME);
        WiFi.softAP(AP_SSID_NAME, AP_PASSWORD_NAME);
        Serial.printf("[WIFI] AP Started. Connect to '%s' (Password: %s) -> Open http://192.168.4.1\n", AP_SSID_NAME, AP_PASSWORD_NAME);
    }

    // Start Web Server
    webEngine.begin(onColorChanged, onManualTrigger, getSystemStatusJson);

    Serial.println("[SYSTEM] Ready! Waiting for sensor triggers...");
}

void loop() {
    // 1. Read Motion Sensors
    bool bottomMotion = digitalRead(PIN_BOTTOM_PIR);
    bool topMotion = digitalRead(PIN_TOP_PIR);

    // Check if night lighting is enabled (Sunset - 30m to Sunrise)
    bool isSolarActive = solarEngine.isNightTimeActive();

    // Bottom sensor triggered (rising edge)
    if (bottomMotion && !lastBottomState) {
        ledEngine.triggerBottom();
    }
    lastBottomState = bottomMotion;

    // Top sensor triggered (rising edge)
    if (topMotion && !lastTopState) {
        ledEngine.triggerTop();
    }
    lastTopState = topMotion;

    // 2. Update LED Animations
    ledEngine.update(isSolarActive);

    // 3. Periodic Solar & NTP refresh (every 60 seconds)
    unsigned long now = millis();
    if (now - lastSolarCheck >= 60000UL) {
        lastSolarCheck = now;
        solarEngine.updateTime();
    }

    // 4. Background GitHub Auto-OTA Handler
    otaEngine.handle(onStartOta);

    delay(10);
}
