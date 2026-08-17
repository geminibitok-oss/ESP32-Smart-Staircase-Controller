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
    int progressPercent = 0;
    String statusMessage = "idle";
    String lastError = "";
    bool autoOtaEnabled = true;

    static bool isRemoteNewer(const String& remoteVer, int remoteBuild, const String& localVer, int localBuild) {
        if (remoteVer.length() == 0) return false;

        int rMajor = 0, rMinor = 0, rPatch = 0;
        int lMajor = 0, lMinor = 0, lPatch = 0;

        sscanf(remoteVer.c_str(), "%d.%d.%d", &rMajor, &rMinor, &rPatch);
        sscanf(localVer.c_str(), "%d.%d.%d", &lMajor, &lMinor, &lPatch);

        if (rMajor > lMajor) return true;
        if (rMajor < lMajor) return false;

        if (rMinor > lMinor) return true;
        if (rMinor < lMinor) return false;

        if (rPatch > lPatch) return true;
        if (rPatch < lPatch) return false;

        // If versions are equal, compare build number
        if (remoteBuild > localBuild) return true;

        return false;
    }

    void begin() {
        Serial.println("[OTA] GitHub Auto-OTA Manager initialized.");
        Serial.printf("[OTA] Target Repository: %s/%s on branch '%s'\n", GITHUB_USER, GITHUB_REPO, GITHUB_BRANCH);
        Serial.printf("[OTA] Current Firmware Version: %s (Build #%d)\n", FIRMWARE_VERSION, FIRMWARE_BUILD);
    }

    void handle(void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (!autoOtaEnabled || WiFi.status() != WL_CONNECTED || isUpdating) return;

        unsigned long now = millis();
        if (lastCheckTime == 0 || (now - lastCheckTime >= (OTA_CHECK_MINUTES * 60 * 1000UL))) {
            lastCheckTime = now;
            checkForUpdate(onStartUpdate, onUpdateFailed, onUpdateSuccess);
        }
    }

    void checkForUpdate(void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
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

                Serial.printf("[OTA] Local: %s (Build #%d) | Remote: %s (Build #%d)\n", FIRMWARE_VERSION, FIRMWARE_BUILD, remoteVersion.c_str(), remoteBuild);

                if (isRemoteNewer(remoteVersion, remoteBuild, FIRMWARE_VERSION, FIRMWARE_BUILD) && binUrl.length() > 0) {
                    Serial.println("[OTA] ⚡ NEW FIRMWARE DETECTED! Initiating over-the-air flash...");
                    performOtaUpdate(binUrl, onStartUpdate, onUpdateFailed, onUpdateSuccess);
                } else {
                    Serial.println("[OTA] Firmware is up to date. No update needed.");
                }
            } else {
                Serial.println("[OTA] Failed to parse version.json: " + String(error.c_str()));
            }
        } else {
            Serial.printf("[OTA] HTTP check failed, error: %s (code: %d)\n", http.errorToString(httpCode).c_str(), httpCode);
        }
        http.end();
    }

    bool triggerCustomUpdate(String binUrl, void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (isUpdating) return false;
        if (binUrl.length() == 0) return false;

        Serial.println("[OTA] ⚡ Manual GitHub OTA update requested for URL: " + binUrl);
        performOtaUpdate(binUrl, onStartUpdate, onUpdateFailed, onUpdateSuccess);
        return true;
    }

    String getOtaStatusJson() {
        JsonDocument doc;
        doc["is_updating"] = isUpdating;
        doc["progress"] = progressPercent;
        doc["status"] = statusMessage;
        doc["error"] = lastError;
        doc["current_version"] = FIRMWARE_VERSION;
        doc["auto_ota"] = autoOtaEnabled;

        String out;
        serializeJson(doc, out);
        return out;
    }

    void performOtaUpdate(String binUrl, void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (onStartUpdate) onStartUpdate();
        
        isUpdating = true;
        statusMessage = "downloading";
        progressPercent = 10;
        lastError = "";

        WiFiClientSecure secureClient;
        secureClient.setInsecure();

        httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        httpUpdate.rebootOnUpdate(true);

        Serial.println("[OTA] Downloading binary from: " + binUrl);
        statusMessage = "flashing";
        progressPercent = 50;

        t_httpUpdate_return ret = httpUpdate.update(secureClient, binUrl);

        switch (ret) {
            case HTTP_UPDATE_FAILED:
                lastError = String(httpUpdate.getLastErrorString());
                statusMessage = "failed";
                Serial.printf("[OTA] Update FAILED! Error (%d): %s\n", httpUpdate.getLastError(), lastError.c_str());
                isUpdating = false;
                if (onUpdateFailed) onUpdateFailed(lastError);
                break;
            case HTTP_UPDATE_NO_UPDATES:
                statusMessage = "no_updates";
                Serial.println("[OTA] No updates available.");
                isUpdating = false;
                if (onUpdateFailed) onUpdateFailed("No updates available");
                break;
            case HTTP_UPDATE_OK:
                statusMessage = "success";
                progressPercent = 100;
                Serial.println("[OTA] UPDATE SUCCESSFUL! Rebooting ESP32 into new firmware...");
                if (onUpdateSuccess) onUpdateSuccess();
                break;
        }
    }
};
