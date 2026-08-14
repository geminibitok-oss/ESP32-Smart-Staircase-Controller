/**
 * GitHub Releases Auto-OTA Manager
 * Periodically queries GitHub repository for version.json and downloads firmware.bin
 * Supports TLS / SSL redirects directly from GitHub Release Assets.
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"

class OtaManager {
public:
    unsigned long lastCheckTime = 0;
    bool isUpdating = false;

    void begin() {
        Serial.println("[OTA] GitHub Auto-OTA Manager initialized.");
        Serial.printf("[OTA] Target Repository: %s/%s on branch '%s'\n", GITHUB_USER, GITHUB_REPO, GITHUB_BRANCH);
        Serial.printf("[OTA] Current Firmware Version: %s\n", FIRMWARE_VERSION);
    }

    void handle(void (*onStartUpdate)()) {
        if (WiFi.status() != WL_CONNECTED || isUpdating) return;

        unsigned long now = millis();
        if (lastCheckTime == 0 || (now - lastCheckTime >= (OTA_CHECK_MINUTES * 60 * 1000UL))) {
            lastCheckTime = now;
            checkForUpdate(onStartUpdate);
        }
    }

    void checkForUpdate(void (*onStartUpdate)()) {
        Serial.println("[OTA] Checking GitHub for new firmware version...");

        WiFiClientSecure client;
        client.setInsecure();

        HTTPClient http;
        String url = "https://raw.githubusercontent.com/" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + "/" + String(GITHUB_BRANCH) + "/version.json";
        
        http.begin(client, url);
        http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        http.setTimeout(10000);

        int httpCode = http.GET();
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            Serial.println("[OTA] Received version manifest: " + payload);

            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, payload);

            if (!error) {
                String remoteVersion = doc["version"].as<String>();
                int remoteBuild = doc["build"].as<int>();
                String binUrl = doc["bin_url"].as<String>();

                Serial.printf("[OTA] Local: %s | Remote: %s (Build #%d)\n", FIRMWARE_VERSION, remoteVersion.c_str(), remoteBuild);

                if (remoteVersion != FIRMWARE_VERSION && binUrl.length() > 0) {
                    Serial.println("[OTA] ⚡ NEW FIRMWARE DETECTED! Initiating over-the-air flash...");
                    if (onStartUpdate) onStartUpdate();
                    performOtaUpdate(binUrl);
                } else {
                    Serial.println("[OTA] Firmware is already up to date.");
                }
            } else {
                Serial.println("[OTA] Failed to parse version.json: " + String(error.c_str()));
            }
        } else {
            Serial.printf("[OTA] HTTP check failed, error: %s (code: %d)\n", http.errorToString(httpCode).c_str(), httpCode);
        }
        http.end();
    }

private:
    void performOtaUpdate(String binUrl) {
        isUpdating = true;
        WiFiClientSecure secureClient;
        secureClient.setInsecure();

        httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        httpUpdate.rebootOnUpdate(true);

        Serial.println("[OTA] Downloading binary from: " + binUrl);
        t_httpUpdate_return ret = httpUpdate.update(secureClient, binUrl);

        switch (ret) {
            case HTTP_UPDATE_FAILED:
                Serial.printf("[OTA] Update FAILED! Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
                isUpdating = false;
                break;
            case HTTP_UPDATE_NO_UPDATES:
                Serial.println("[OTA] No updates available.");
                isUpdating = false;
                break;
            case HTTP_UPDATE_OK:
                Serial.println("[OTA] UPDATE SUCCESSFUL! Rebooting ESP32 into new firmware...");
                break;
        }
    }
};
