import { StaircaseConfig } from '../types';

export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export function generateProjectFiles(config: StaircaseConfig): CodeFile[] {
  const totalLeds = config.stepCount * config.ledsPerStep;

  // 1. platformio.ini
  const platformioIni = `; PlatformIO Project Configuration for ESP32 Smart Staircase
; Auto-build and OTA ready

[env:esp32dev]
platform = espressif32@^6.5.0
board = esp32dev
framework = arduino
monitor_speed = 115200
board_build.partitions = min_spiffs.csv  ; Provides 1.9MB app partition for OTA

build_flags = 
    -D CORE_DEBUG_LEVEL=3
    -D FIRMWARE_VERSION=\\"${config.firmwareVersion}\\"
    -D BOARD_NAME=\\"ESP32_Staircase_Controller\\"

lib_deps = 
    fastled/FastLED @ ^3.6.0
    bblanchon/ArduinoJson @ ^7.0.4
    arduino-libraries/NTPClient @ ^3.2.1
    https://github.com/me-no-dev/ESPAsyncWebServer.git
    https://github.com/me-no-dev/AsyncTCP.git
`;

  // 2. flash_windows.bat (Windows 1-Click Flasher with Auto esptool.exe download)
  const flashWindowsBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher

echo ======================================================
echo    ESP32 Smart Staircase Controller - Firmware Flasher
echo ======================================================
echo.

:: 1. Check or Auto-Download esptool.exe
if not exist "%~dp0esptool.exe" (
    echo [*] esptool.exe not found in this folder.
    echo [*] Downloading official esptool.exe for Windows from GitHub...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip', '%~dp0esptool.zip')"
    
    if exist "%~dp0esptool.zip" (
        echo [*] Unpacking esptool.exe...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0esptool.zip' -DestinationPath '%~dp0esptool_tmp' -Force"
        if exist "%~dp0esptool_tmp\\esptool-win64\\esptool.exe" (
            copy /y "%~dp0esptool_tmp\\esptool-win64\\esptool.exe" "%~dp0esptool.exe" >nul
        ) else (
            for /r "%~dp0esptool_tmp" %%F in (esptool.exe) do copy /y "%%F" "%~dp0esptool.exe" >nul
        )
        rd /s /q "%~dp0esptool_tmp" >nul 2>&1
        del /f /q "%~dp0esptool.zip" >nul 2>&1
    )
)

if not exist "%~dp0esptool.exe" (
    echo [ERROR] Failed to auto-download esptool.exe!
    echo Please download esptool.exe manually from https://github.com/espressif/esptool/releases
    echo and place it into this directory.
    echo.
    pause
    exit /b 1
)

echo [OK] esptool.exe is ready.
echo.

:: 2. Detect firmware binaries
set "FLASH_CMD="

if exist "%~dp0StairsEsp.ino.bootloader.bin" if exist "%~dp0StairsEsp.ino.partitions.bin" if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Arduino CLI package detected (StairsEsp.ino.*)
    set FLASH_CMD=0x1000 "%~dp0StairsEsp.ino.bootloader.bin" 0x8000 "%~dp0StairsEsp.ino.partitions.bin" 0x10000 "%~dp0StairsEsp.ino.bin"
    goto BIN_FOUND
)

if exist "%~dp0bootloader.bin" if exist "%~dp0partitions.bin" if exist "%~dp0firmware.bin" (
    echo [INFO] Full package detected (bootloader + partitions + firmware)
    set FLASH_CMD=0x1000 "%~dp0bootloader.bin" 0x8000 "%~dp0partitions.bin" 0x10000 "%~dp0firmware.bin"
    goto BIN_FOUND
)

if exist "%~dp0firmware.bin" (
    echo [INFO] Standard firmware.bin detected (flashing at offset 0x10000)
    set FLASH_CMD=0x10000 "%~dp0firmware.bin"
    goto BIN_FOUND
)

if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] StairsEsp.ino.bin detected (flashing at offset 0x10000)
    set FLASH_CMD=0x10000 "%~dp0StairsEsp.ino.bin"
    goto BIN_FOUND
)

for %%F in ("%~dp0stairs_*.bin") do (
    echo [INFO] Versioned binary detected: %%~nxF
    set FLASH_CMD=0x10000 "%%~fF"
    goto BIN_FOUND
)

echo [ERROR] Firmware .bin files not found in %~dp0!
echo Please compile or download firmware binaries into this folder first.
echo.
pause
exit /b 1

:BIN_FOUND

echo.
echo ======================================================
echo  1. Connect your ESP32 board to PC via USB cable.
echo  2. If the chip fails to connect, hold the BOOT button,
echo     press RESET, release BOOT and try again.
echo ======================================================
echo.
echo Press ANY KEY to begin flashing...
pause >nul

echo.
echo [*] Flashing ESP32 with esptool...
"%~dp0esptool.exe" --chip esp32 --baud 921600 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if errorlevel 1 (
    echo.
    echo ======================================================
    echo  [ERROR] Flash failed!
    echo.
    echo  Troubleshooting:
    echo  - Hold BOOT button on ESP32, press RESET, release BOOT and rerun.
    echo  - Ensure USB data cable is used (not charge-only cable).
    echo  - Close any open Serial Monitors (VS Code, Arduino IDE, PuTTY).
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  [SUCCESS] ESP32 flashed successfully!
    echo  The controller will reboot and start managing your stairs.
    echo ======================================================
)

echo.
pause
`;

  // 2b. terminal.bat (Windows Serial Monitor)
  const terminalBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Serial Monitor (115200 baud)

echo ======================================================
echo       ESP32 Serial Monitor & Debug Console
echo ======================================================
echo.
echo Scanning available COM ports on your PC...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.Ports.SerialPort]::getportnames()"
echo.
set /p COMPORT="Enter COM port (e.g. COM3, COM4, COM5): "
if "%COMPORT%"=="" set COMPORT=COM3

echo.
echo [*] Opening %COMPORT% at 115200 baud...
echo [*] Press Ctrl+C to exit monitor.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%COMPORT%',115200,None,8,one; try { $port.open(); Write-Host '--- Connected to %COMPORT% (115200 baud) ---' -ForegroundColor Green; while ($true) { $line = $port.ReadLine(); Write-Host $line } } catch { Write-Host 'Failed to connect or port is busy by another program.' -ForegroundColor Red } finally { $port.close() }"

echo.
pause
`;

  // 3. .github/workflows/build_and_release.yml (Arduino CLI + Auto-Versioning + Release)
  const githubActionsWorkflow = `name: Build and Release ESP32 Firmware

on:
  push:
    branches:
      - main
      - master
    paths:
      - 'src/**'
      - 'StairsEsp/**'
      - 'include/**'
      - 'platformio.ini'
      - 'version.json'
      - 'flash_windows.bat'
      - 'flasher.bat'
      - 'terminal.bat'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Arduino CLI
        uses: arduino/setup-arduino-cli@v2

      - name: Install ESP32 Core
        run: |
          arduino-cli config init
          arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
          arduino-cli core update-index
          arduino-cli core install esp32:esp32@2.0.17

      - name: Install Arduino Libraries
        run: |
          arduino-cli lib install FastLED@3.6.0
          arduino-cli lib install ArduinoJson@7.0.4
          arduino-cli lib install NTPClient@3.2.1
          mkdir -p ~/Arduino/libraries/
          git clone https://github.com/me-no-dev/ESPAsyncWebServer.git ~/Arduino/libraries/ESPAsyncWebServer
          git clone https://github.com/me-no-dev/AsyncTCP.git ~/Arduino/libraries/AsyncTCP
          if [ -d "libraries" ]; then cp -r libraries/* ~/Arduino/libraries/; fi

      - name: Determine Next Version
        id: versioning
        run: |
          BUILD_NUM="\${{ github.run_number }}"
          TAG_NAME="v1.0.\${BUILD_NUM}"
          echo "CURRENT_TAG=\${TAG_NAME}" >> $GITHUB_ENV
          echo "BUILD_NUMBER=\${BUILD_NUM}" >> $GITHUB_ENV
          echo "VERSION=1.0.\${BUILD_NUM}" >> $GITHUB_ENV

          mkdir -p StairsEsp
          echo "#pragma once" > StairsEsp/version.h
          echo "#define FIRMWARE_VERSION \"1.0.\${BUILD_NUM}\"" >> StairsEsp/version.h
          echo "#define BUILD_TIMESTAMP __DATE__ \" \" __TIME__" >> StairsEsp/version.h
          if [ -d "src" ]; then cp StairsEsp/version.h src/version.h 2>/dev/null || true; fi

      - name: Compile Sketch with Arduino CLI
        run: |
          mkdir -p build_output
          if [ -d "src" ]; then
            cp src/*.h StairsEsp/ 2>/dev/null || true
          fi
          if [ ! -f "StairsEsp/StairsEsp.ino" ] && [ -f "src/main.cpp" ]; then
            mkdir -p StairsEsp
            cp src/main.cpp StairsEsp/StairsEsp.ino
          fi
          arduino-cli compile --fqbn esp32:esp32:esp32 StairsEsp/StairsEsp.ino --output-dir build_output

      - name: Package Flasher and Download esptool
        run: |
          cp build_output/StairsEsp.ino.bin build_output/firmware.bin 2>/dev/null || true
          cp build_output/StairsEsp.ino.bin "build_output/stairs_\${CURRENT_TAG}.bin" 2>/dev/null || true

          mkdir -p temp_zip
          curl -sL -o esptool_win.zip https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip
          unzip -q esptool_win.zip -d temp_zip
          find temp_zip -name "esptool.exe" -exec cp {} build_output/esptool.exe \\;
          rm -rf temp_zip esptool_win.zip

          cp flash_windows.bat build_output/flash_windows.bat 2>/dev/null || cp flasher.bat build_output/flash_windows.bat 2>/dev/null || true
          cp terminal.bat build_output/terminal.bat 2>/dev/null || true
          sed -i 's/$/\\r/' build_output/flash_windows.bat 2>/dev/null || true
          sed -i 's/$/\\r/' build_output/terminal.bat 2>/dev/null || true

          echo "{" > build_output/version.json
          echo "  \"version\": \"\${VERSION}\"," >> build_output/version.json
          echo "  \"build\": \${BUILD_NUMBER}," >> build_output/version.json
          echo "  \"release_date\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"," >> build_output/version.json
          echo "  \"bin_url\": \"https://github.com/\${{ github.repository }}/releases/download/\${CURRENT_TAG}/firmware.bin\"," >> build_output/version.json
          echo "  \"changelog\": \"Automated build from commit \${{ github.sha }}\"" >> build_output/version.json
          echo "}" >> build_output/version.json

          # Формируем готовый ZIP-архив релиза
          cd build_output
          zip -r "../esp32_stairs_flasher_\${CURRENT_TAG}.zip" *
          cd ..
          cp "esp32_stairs_flasher_\${CURRENT_TAG}.zip" build_output/

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: esp32-firmware-\${{ env.CURRENT_TAG }}
          path: build_output/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        with:
          tag_name: \${{ env.CURRENT_TAG }}
          name: "Smart Staircase Firmware \${{ env.CURRENT_TAG }}"
          body: |
            ### 🚀 Автоматическая сборка прошивки ESP32 (\${{ env.CURRENT_TAG }})
            - **Версия:** \`\${{ env.CURRENT_TAG }}\`
            - **Номер сборки:** \`#\${{ env.BUILD_NUMBER }}\`
            - **Коммит:** \`\${{ github.sha }}\`
            
            ---
            ### ⚡ Инструкция по прошивке:
            1. **📦 Для первой прошивки по USB (Windows в 1 клик):**
               - Скачайте архив **\`esp32_stairs_flasher_\${{ env.CURRENT_TAG }}.zip\`**
               - Распакуйте и запустите **\`flash_windows.bat\`** (\`esptool.exe\` и все \`.bin\` уже внутри!)
               - Для вывода логов Serial порта запустите **\`terminal.bat\`**
            2. **📶 Обновление по воздуху (Wi-Fi OTA):**
               - Работающий ESP32 автоматически обнаружит новый релиз и обновится сам!
          draft: false
          prerelease: false
          files: |
            build_output/esp32_stairs_flasher_\${{ env.CURRENT_TAG }}.zip
            build_output/firmware.bin
            build_output/stairs_\${{ env.CURRENT_TAG }}.bin
            build_output/StairsEsp.ino.bin
            build_output/StairsEsp.ino.bootloader.bin
            build_output/StairsEsp.ino.partitions.bin
            build_output/esptool.exe
            build_output/flash_windows.bat
            build_output/terminal.bat
            build_output/version.json
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  // 3b. version.h
  const versionH = `/**
 * Firmware Version Header
 * Automatically updated by CI/CD Pipeline
 */
#pragma once

#define FIRMWARE_VERSION "${config.firmwareVersion || '1.0.0'}"
#define BUILD_TIMESTAMP __DATE__ " " __TIME__
`;

  // 3c. StairsEsp/StairsEsp.ino (Arduino IDE Main Sketch)
  const stairsEspIno = `/**
 * Smart Staircase Controller - Arduino IDE Sketch
 * ESP32 + WS2812B Addressable LED Strips + PIR / Radar Sensors + Solar Math + GitHub OTA
 */
#include <Arduino.h>
#include "config.h"
#include "version.h"
#include "solar_scheduler.h"
#include "led_controller.h"
#include "ota_manager.h"
#include "web_server.h"

// Hardware Sensors & Flags
volatile bool g_bottomTriggered = false;
volatile bool g_topTriggered = false;
unsigned long g_lastBottomTriggerTime = 0;
unsigned long g_lastTopTriggerTime = 0;

void IRAM_ATTR onBottomSensorISR() {
  g_bottomTriggered = true;
}

void IRAM_ATTR onTopSensorISR() {
  g_topTriggered = true;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\\n==============================================");
  Serial.println("  ESP32 Smart Staircase Controller Initiated  ");
  Serial.printf("  Firmware: %s | Built: %s\\n", FIRMWARE_VERSION, BUILD_TIMESTAMP);
  Serial.println("==============================================\\n");

  // Setup Motion Sensor Pins with Internal Pull-Down
  pinMode(PIN_BOTTOM_PIR, INPUT_PULLDOWN);
  pinMode(PIN_TOP_PIR, INPUT_PULLDOWN);
  if (PIN_LDR_SENSOR > 0) {
    pinMode(PIN_LDR_SENSOR, INPUT);
  }

  attachInterrupt(digitalPinToInterrupt(PIN_BOTTOM_PIR), onBottomSensorISR, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_TOP_PIR), onTopSensorISR, RISING);

  // Initialize Subsystems
  LedController::init();
  SolarScheduler::init();
  WebServerManager::init();
  OtaManager::init();

  Serial.println("[OK] System initialized successfully.");
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Check Sensor Triggers with Debounce (500ms)
  if (g_bottomTriggered) {
    g_bottomTriggered = false;
    if (currentMillis - g_lastBottomTriggerTime > 500) {
      g_lastBottomTriggerTime = currentMillis;
      Serial.println("[SENSOR] Bottom sensor triggered -> Walking UP");
      if (SolarScheduler::isLightingAllowed()) {
        LedController::triggerUpward();
      } else {
        Serial.println("[SOLAR] Daylight detected: lighting wave suppressed.");
      }
    }
  }

  if (g_topTriggered) {
    g_topTriggered = false;
    if (currentMillis - g_lastTopTriggerTime > 500) {
      g_lastTopTriggerTime = currentMillis;
      Serial.println("[SENSOR] Top sensor triggered -> Walking DOWN");
      if (SolarScheduler::isLightingAllowed()) {
        LedController::triggerDownward();
      } else {
        Serial.println("[SOLAR] Daylight detected: lighting wave suppressed.");
      }
    }
  }

  // 2. Periodic Subsystems Update
  SolarScheduler::update();
  LedController::update();
  OtaManager::update();

  delay(5);
}
`;

  // 3. src/config.h
  const configH = `/**
 * Smart Staircase Controller Configuration
 * Generated for ESP32 + WS2812B Pixel Strip
 */
#pragma once
#include <Arduino.h>

// ================= PHYSICAL CONFIGURATION =================
#define NUM_STEPS          ${config.stepCount}        // Total number of stairs/steps
#define LEDS_PER_STEP      ${config.ledsPerStep}        // Number of WS2812B LEDs per step
#define TOTAL_LEDS         (NUM_STEPS * LEDS_PER_STEP)

// GPIO Pins (ESP32 DevKit V1)
#define PIN_LED_DATA       ${config.ledPin}       // Output to WS2812B Data In
#define PIN_BOTTOM_PIR     ${config.bottomSensorPin}       // Bottom Motion Sensor (PIR/Radar)
#define PIN_TOP_PIR        ${config.topSensorPin}       // Top Motion Sensor (PIR/Radar)
#define PIN_LDR_SENSOR     ${config.ldrSensorPin}       // Optional Analog Ambient Light Sensor

// ================= ANIMATION & LIGHTING =================
#define STEP_ANIM_SPEED_MS ${config.stepSpeedMs}       // Delay between lighting consecutive steps (ms)
#define STEP_FADE_SPEED_MS ${config.fadeSpeedMs}       // Smooth fade transition speed (ms)
#define HOLD_TIME_SECONDS  ${config.holdTimeSec}        // Time staircase stays lit after motion stops (s)
#define ACTIVE_BRIGHTNESS  ${config.activeBrightness}       // Maximum brightness when walking (0-255)
#define STANDBY_BRIGHTNESS ${config.standbyBrightness}        // Night standby glow brightness (0-255)

// Standby Mode: 0 = Off, 1 = First & Last Step Only, 2 = All Steps Dim, 3 = Soft Breathing
#define STANDBY_MODE_TYPE  ${config.standbyMode === 'off' ? 0 : config.standbyMode === 'edge_steps' ? 1 : config.standbyMode === 'all_dim' ? 2 : 3}

// ================= SOLAR & GEOLOCATION =================
#define DEFAULT_LATITUDE   ${config.latitude}f    // Latitude for Sunset/Sunrise calculation
#define DEFAULT_LONGITUDE  ${config.longitude}f    // Longitude
#define TIMEZONE_OFFSET_H  ${config.timezoneOffsetHours}        // UTC Offset in hours (e.g. +3 for MSK)
#define SUNSET_OFFSET_MIN  ${config.sunsetOffsetMinutes}       // Start lighting 30 min before sunset
#define SUNRISE_OFFSET_MIN ${config.sunriseOffsetMinutes}         // Stop lighting at sunrise

#define NTP_SERVER_NAME    "${config.ntpServer || 'pool.ntp.org'}"

// ================= WI-FI & GITHUB OTA =================
#define DEFAULT_WIFI_SSID  "${config.wifiSsid || 'MyHomeWiFi'}"
#define DEFAULT_WIFI_PASS  "${config.wifiPassword || 'SuperSecretPassword'}"
#define AP_SSID_NAME       "${config.apSsid || 'ESP32-Staircase-Setup'}"
#define AP_PASSWORD_NAME   "${config.apPassword || '12345678'}"

// GitHub Auto-OTA Repository
#define GITHUB_USER        "${config.githubUsername || 'geminibitok-oss'}"
#define GITHUB_REPO        "${config.githubRepo || 'ESP32-Smart-Staircase-Controller'}"
#define GITHUB_BRANCH      "${config.githubBranch || 'main'}"
#define OTA_CHECK_MINUTES  ${config.otaCheckIntervalMinutes}       // Check GitHub for new releases every X min

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION   "${config.firmwareVersion}"
#endif
`;

  // 4. src/solar_scheduler.h
  const solarSchedulerH = `/**
 * Solar & Astronomical Calculation Engine
 * Accurately calculates Sunset and Sunrise without external API dependencies.
 * Uses exact solar declination and equation of time.
 */
#pragma once
#include <Arduino.h>
#include <time.h>
#include <WiFi.h>
#include "config.h"

class SolarScheduler {
public:
    int sunriseMinuteOfDay = 360;  // Default 06:00
    int sunsetMinuteOfDay = 1200;  // Default 20:00
    bool timeSynchronized = false;
    
    void begin() {
        // Configure standard SNTP
        configTime(TIMEZONE_OFFSET_H * 3600, 0, NTP_SERVER_NAME, "time.nist.gov", "time.google.com");
        Serial.println("[SOLAR] Initializing NTP synchronization...");
    }

    void updateTime() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 2000)) {
            Serial.println("[SOLAR] Waiting for NTP time sync...");
            return;
        }
        timeSynchronized = true;

        // Calculate astronomical sunrise and sunset for current day of year
        int dayOfYear = timeinfo.tm_yday; // 0 - 365
        calculateSunTimes(DEFAULT_LATITUDE, DEFAULT_LONGITUDE, dayOfYear, TIMEZONE_OFFSET_H);
    }

    /**
     * Checks if current time is within active illumination window:
     * Starts (Sunset + SUNSET_OFFSET_MIN) -> Ends (Sunrise + SUNRISE_OFFSET_MIN)
     */
    bool isNightTimeActive() {
        if (!timeSynchronized) {
            // Fallback if Wi-Fi/NTP is unavailable: activate based on LDR if available, or default active
            return true;
        }

        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 500)) return true;

        int currentMin = timeinfo.tm_hour * 60 + timeinfo.tm_min;

        int turnOnMinute = sunsetMinuteOfDay + SUNSET_OFFSET_MIN;   // Sunset - 30 minutes
        int turnOffMinute = sunriseMinuteOfDay + SUNRISE_OFFSET_MIN; // Sunrise

        // Wrap around midnight logic (e.g. Turn on at 18:30 (1110), Turn off at 06:00 (360))
        if (turnOnMinute > turnOffMinute) {
            return (currentMin >= turnOnMinute || currentMin < turnOffMinute);
        } else {
            return (currentMin >= turnOnMinute && currentMin < turnOffMinute);
        }
    }

    String getFormattedCurrentTime() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 200)) return "00:00:00 (NTP Pending)";
        char buf[32];
        strftime(buf, sizeof(buf), "%H:%M:%S (%d.%m.%Y)", &timeinfo);
        return String(buf);
    }

    String getFormattedSunset() {
        int h = sunsetMinuteOfDay / 60;
        int m = sunsetMinuteOfDay % 60;
        char buf[16];
        snprintf(buf, sizeof(buf), "%02d:%02d", h, m);
        return String(buf);
    }

    String getFormattedSunrise() {
        int h = sunriseMinuteOfDay / 60;
        int m = sunriseMinuteOfDay % 60;
        char buf[16];
        snprintf(buf, sizeof(buf), "%02d:%02d", h, m);
        return String(buf);
    }

private:
    void calculateSunTimes(float lat, float lon, int dayOfYear, int tzOffset) {
        // High precision astronomical NOAA algorithm
        float gamma = 2.0f * PI / 365.0f * (dayOfYear - 1);
        
        // Equation of time (in minutes)
        float eqtime = 229.18f * (0.000075f + 0.001868f * cos(gamma) - 0.032077f * sin(gamma) 
                       - 0.014615f * cos(2 * gamma) - 0.040849f * sin(2 * gamma));
        
        // Solar declination angle (radians)
        float decl = 0.006918f - 0.399912f * cos(gamma) + 0.070257f * sin(gamma) 
                     - 0.006758f * cos(2 * gamma) + 0.000907f * sin(2 * gamma);

        float latRad = lat * DEG_TO_RAD;
        float zenith = 90.833f * DEG_TO_RAD; // Standard atmospheric refraction zenith

        float cosHourAngle = (cos(zenith) / (cos(latRad) * cos(decl))) - (tan(latRad) * tan(decl));

        if (cosHourAngle > 1.0f) {
            // Polar night (sun never rises)
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 0;
            return;
        }
        if (cosHourAngle < -1.0f) {
            // Midnight sun (sun never sets)
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 1440;
            return;
        }

        float hourAngle = acos(cosHourAngle) * RAD_TO_DEG; // degrees
        
        // Solar noon in minutes (UTC)
        float solarNoonUtc = 720.0f - (4.0f * lon) - eqtime;

        // Sunrise and Sunset in minutes (Local Time)
        sunriseMinuteOfDay = (int)(solarNoonUtc - (hourAngle * 4.0f) + (tzOffset * 60));
        sunsetMinuteOfDay  = (int)(solarNoonUtc + (hourAngle * 4.0f) + (tzOffset * 60));

        // Normalize within 0-1440 min
        if (sunriseMinuteOfDay < 0) sunriseMinuteOfDay += 1440;
        if (sunsetMinuteOfDay < 0) sunsetMinuteOfDay += 1440;

        Serial.printf("[SOLAR] Calculated for Day %d -> Sunrise: %02d:%02d, Sunset: %02d:%02d (Active Window: %02d:%02d to %02d:%02d)\\n",
                      dayOfYear, 
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60,
                      sunsetMinuteOfDay / 60, sunsetMinuteOfDay % 60,
                      (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) / 60, (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) % 60,
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60);
    }
};
`;

  // 5. src/led_controller.h
  const ledControllerH = `/**
 * WS2812B Addressable LED Staircase Animation Engine
 * Smooth step-by-step ripples, direction sensing, crossfades, and standby night light.
 */
#pragma once
#include <FastLED.h>
#include "config.h"

enum Direction {
    DIR_NONE,
    DIR_UP,     // Moving Bottom -> Top
    DIR_DOWN    // Moving Top -> Bottom
};

enum StairState {
    STATE_IDLE_DAY,       // Daylight - LEDs completely off
    STATE_STANDBY_NIGHT,  // Nighttime - subtle low glow or edge markers
    STATE_ANIMATING_IN,   // Step-by-step turning ON in trigger direction
    STATE_FULL_ACTIVE,    // Fully lit while dwell timer counts down
    STATE_ANIMATING_OUT,  // Step-by-step turning OFF in walk direction
    STATE_OTA_BUSY        // Flashing blue progress during firmware update
};

class StairLedController {
public:
    CRGB leds[TOTAL_LEDS];
    StairState currentState = STATE_IDLE_DAY;
    Direction currentDirection = DIR_NONE;
    
    CRGB primaryColor = CRGB(255, 180, 80); // Warm cozy incandescent amber
    uint8_t currentStepProgress = 0;
    unsigned long lastStepTime = 0;
    unsigned long motionHoldTimer = 0;

    void begin() {
        FastLED.addLeds<WS2812B, PIN_LED_DATA, GRB>(leds, TOTAL_LEDS).setCorrection(TypicalLEDStrip);
        FastLED.setBrightness(ACTIVE_BRIGHTNESS);
        FastLED.clear(true);
        Serial.println("[LEDS] FastLED initialized for " + String(NUM_STEPS) + " steps (" + String(TOTAL_LEDS) + " total LEDs)");
    }

    void setColor(uint8_t r, uint8_t g, uint8_t b) {
        primaryColor = CRGB(r, g, b);
    }

    /**
     * Trigger from Bottom Sensor (Walking UP)
     */
    void triggerBottom() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
            // Extend hold timer if already active
            motionHoldTimer = millis();
            return;
        }
        Serial.println("[MOTION] Bottom sensor triggered -> Lighting UP");
        currentDirection = DIR_UP;
        currentStepProgress = 0;
        currentState = STATE_ANIMATING_IN;
        lastStepTime = millis();
        motionHoldTimer = millis();
    }

    /**
     * Trigger from Top Sensor (Walking DOWN)
     */
    void triggerTop() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
            // Extend hold timer
            motionHoldTimer = millis();
            return;
        }
        Serial.println("[MOTION] Top sensor triggered -> Lighting DOWN");
        currentDirection = DIR_DOWN;
        currentStepProgress = 0;
        currentState = STATE_ANIMATING_IN;
        lastStepTime = millis();
        motionHoldTimer = millis();
    }

    /**
     * Main animation tick - call repeatedly in loop()
     */
    void update(bool isSolarNightActive) {
        unsigned long now = millis();

        switch (currentState) {
            case STATE_IDLE_DAY:
                if (isSolarNightActive) {
                    currentState = STATE_STANDBY_NIGHT;
                }
                FastLED.clear();
                FastLED.show();
                break;

            case STATE_STANDBY_NIGHT:
                if (!isSolarNightActive) {
                    currentState = STATE_IDLE_DAY;
                    FastLED.clear();
                    FastLED.show();
                    break;
                }
                renderStandbyGlow();
                FastLED.show();
                break;

            case STATE_ANIMATING_IN:
                if (now - lastStepTime >= STEP_ANIM_SPEED_MS) {
                    lastStepTime = now;
                    
                    int stepToLight = (currentDirection == DIR_UP) 
                        ? currentStepProgress 
                        : (NUM_STEPS - 1 - currentStepProgress);

                    lightUpStep(stepToLight, primaryColor, ACTIVE_BRIGHTNESS);
                    FastLED.show();

                    currentStepProgress++;
                    if (currentStepProgress >= NUM_STEPS) {
                        currentState = STATE_FULL_ACTIVE;
                        motionHoldTimer = now;
                    }
                }
                break;

            case STATE_FULL_ACTIVE:
                // Keep fully lit for HOLD_TIME_SECONDS
                if (now - motionHoldTimer >= (HOLD_TIME_SECONDS * 1000UL)) {
                    Serial.println("[STAIRS] Hold time expired -> Starting fade out");
                    currentState = STATE_ANIMATING_OUT;
                    currentStepProgress = 0;
                    lastStepTime = now;
                }
                break;

            case STATE_ANIMATING_OUT:
                if (now - lastStepTime >= STEP_ANIM_SPEED_MS) {
                    lastStepTime = now;

                    int stepToDim = (currentDirection == DIR_UP) 
                        ? currentStepProgress 
                        : (NUM_STEPS - 1 - currentStepProgress);

                    // Dim step off or back to standby
                    clearStep(stepToDim);
                    FastLED.show();

                    currentStepProgress++;
                    if (currentStepProgress >= NUM_STEPS) {
                        currentState = isSolarNightActive ? STATE_STANDBY_NIGHT : STATE_IDLE_DAY;
                        currentDirection = DIR_NONE;
                    }
                }
                break;

            case STATE_OTA_BUSY:
                // OTA Animation: pulse or step progress
                renderOtaAnimation();
                FastLED.show();
                break;
        }
    }

    void setOtaMode(bool active) {
        if (active) {
            currentState = STATE_OTA_BUSY;
        } else {
            currentState = STATE_IDLE_DAY;
        }
    }

private:
    void lightUpStep(int stepIndex, CRGB color, uint8_t brightness) {
        if (stepIndex < 0 || stepIndex >= NUM_STEPS) return;
        int startIdx = stepIndex * LEDS_PER_STEP;
        for (int i = 0; i < LEDS_PER_STEP; i++) {
            leds[startIdx + i] = color;
        }
    }

    void clearStep(int stepIndex) {
        if (stepIndex < 0 || stepIndex >= NUM_STEPS) return;
        int startIdx = stepIndex * LEDS_PER_STEP;
        for (int i = 0; i < LEDS_PER_STEP; i++) {
            leds[startIdx + i] = CRGB::Black;
        }
    }

    void renderStandbyGlow() {
        FastLED.clear();
#if STANDBY_MODE_TYPE == 1
        // First and Last step subtle glow
        lightUpStep(0, primaryColor, STANDBY_BRIGHTNESS);
        lightUpStep(NUM_STEPS - 1, primaryColor, STANDBY_BRIGHTNESS);
#elif STANDBY_MODE_TYPE == 2
        // All steps dim glow
        for (int s = 0; s < NUM_STEPS; s++) {
            lightUpStep(s, primaryColor, STANDBY_BRIGHTNESS);
        }
#elif STANDBY_MODE_TYPE == 3
        // Soft breathing pulse
        uint8_t breath = beatsin8(15, STANDBY_BRIGHTNESS / 3, STANDBY_BRIGHTNESS);
        for (int s = 0; s < NUM_STEPS; s++) {
            lightUpStep(s, primaryColor, breath);
        }
#endif
    }

    void renderOtaAnimation() {
        static uint8_t hue = 140; // Cyan-Blue
        uint8_t beat = beatsin8(40, 50, 255);
        for (int i = 0; i < TOTAL_LEDS; i++) {
            leds[i] = CHSV(hue + (i * 2), 220, beat);
        }
    }
};
`;

  // 6. src/ota_manager.h
  const otaManagerH = `/**
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
        Serial.printf("[OTA] Target Repository: %s/%s on branch '%s'\\n", GITHUB_USER, GITHUB_REPO, GITHUB_BRANCH);
        Serial.printf("[OTA] Current Firmware Version: %s\\n", FIRMWARE_VERSION);
    }

    /**
     * Check if it's time to query GitHub for new releases
     */
    void handle(void (*onStartUpdate)()) {
        if (WiFi.status() != WL_CONNECTED || isUpdating) return;

        unsigned long now = millis();
        // Check on boot (after 15 seconds) and every OTA_CHECK_MINUTES
        if (lastCheckTime == 0 || (now - lastCheckTime >= (OTA_CHECK_MINUTES * 60 * 1000UL))) {
            lastCheckTime = now;
            checkForUpdate(onStartUpdate);
        }
    }

    void checkForUpdate(void (*onStartUpdate)()) {
        Serial.println("[OTA] Checking GitHub for new firmware version...");

        WiFiClientSecure client;
        client.setInsecure(); // Bypass root CA validation for GitHub redirects

        HTTPClient http;
        // Direct raw URL for version.json on main branch
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

                Serial.printf("[OTA] Local: %s | Remote: %s (Build #%d)\\n", FIRMWARE_VERSION, remoteVersion.c_str(), remoteBuild);

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
            Serial.printf("[OTA] HTTP check failed, error: %s (code: %d)\\n", http.errorToString(httpCode).c_str(), httpCode);
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
                Serial.printf("[OTA] Update FAILED! Error (%d): %s\\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
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
`;

  // 7. src/web_server.h
  const webServerH = `/**
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

        // Serve Web UI
        server.on("/", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            String html = getIndexHtml();
            request->send(200, "text/html", html);
        });

        // API Status
        server.on("/api/status", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            request->send(200, "application/json", getStatusJson());
        });

        // API Trigger Staircase manually
        server.on("/api/trigger", HTTP_POST, [onTrigger](AsyncWebServerRequest *request) {
            if (request->hasParam("dir", true)) {
                String dir = request->getParam("dir", true)->value();
                if (dir == "up") onTrigger(true);
                else onTrigger(false);
            }
            request->send(200, "application/json", "{\\"status\\":\\"triggered\\"}");
        });

        // API Set Color
        server.on("/api/color", HTTP_POST, [onColorChange](AsyncWebServerRequest *request) {
            if (request->hasParam("r", true) && request->hasParam("g", true) && request->hasParam("b", true)) {
                int r = request->getParam("r", true)->value().toInt();
                int g = request->getParam("g", true)->value().toInt();
                int b = request->getParam("b", true)->value().toInt();
                onColorChange(r, g, b);
            }
            request->send(200, "application/json", "{\\"status\\":\\"ok\\"}");
        });

        // Manual OTA Upload Page
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
                Serial.printf("[MANUAL_OTA] Start update: %s\\n", filename.c_str());
                if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                    Update.printError(Serial);
                }
            }
            if (Update.write(data, len) != len) {
                Update.printError(Serial);
            }
            if (final) {
                if (Update.end(true)) {
                    Serial.printf("[MANUAL_OTA] Success: %u B\\n", index + len);
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
`;

  // 8. src/main.cpp
  const mainCpp = `/**
 * ==============================================================================
 * ESP32 Smart Staircase Controller
 * WS2812B Addressable LED Strip + Dual PIR Motion Sensors + Astronomical Solar Schedule + GitHub CI/CD Auto-OTA
 * ==============================================================================
 */
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#include "config.h"
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
    Serial.printf("[SYSTEM] New Color Set: R=%d G=%d B=%d\\n", r, g, b);
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
    Serial.println("\\n========================================================");
    Serial.println("   ESP32 SMART STAIRCASE CONTROLLER (v" FIRMWARE_VERSION ")");
    Serial.println("========================================================");

    // Initialize Pins
    pinMode(PIN_BOTTOM_PIR, INPUT_PULLDOWN);
    pinMode(PIN_TOP_PIR, INPUT_PULLDOWN);

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
        Serial.printf("\\n[WIFI] Connected! IP Address: %s\\n", WiFi.localIP().toString().c_str());
        // Initialize Solar & NTP
        solarEngine.begin();
        solarEngine.updateTime();
        // Initialize OTA Manager
        otaEngine.begin();
    } else {
        Serial.printf("\\n[WIFI] Failed to connect to '%s'. Starting AP Mode: %s\\n", DEFAULT_WIFI_SSID, AP_SSID_NAME);
        WiFi.softAP(AP_SSID_NAME, AP_PASSWORD_NAME);
        Serial.printf("[WIFI] AP Started. Connect to '%s' (Password: %s) -> Open http://192.168.4.1\\n", AP_SSID_NAME, AP_PASSWORD_NAME);
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
`;

  // 9. version.json
  const versionJson = `{
  "version": "${config.firmwareVersion}",
  "build": 1,
  "release_date": "${new Date().toISOString()}",
  "bin_url": "https://github.com/${config.githubUsername || 'USER'}/${config.githubRepo || 'REPO'}/releases/download/v${config.firmwareVersion}/firmware.bin",
  "changelog": "Initial ESP32 Smart Staircase Release with WS2812B, Solar Schedule & GitHub OTA"
}`;

  // 10. README.md
  const readmeMd = `# 🌟 ESP32 Smart Staircase Controller (Умная подсветка лестницы)

Комплексный проект умной пошаговой подсветки лестницы на микроконтроллере **ESP32** с адресной светодиодной лентой **WS2812B**, датчиками движения сверху и снизу, расчетом заката/рассвета по интернету и автоматическими **OTA-обновлениями через GitHub Actions**.

---

## 📋 Основные возможности

1. **Адресная лента WS2812B/WS2811:**
   - Пошаговое плавное зажигание ступеней по направлению движения:
     - Снизу вверх при срабатывании нижнего датчика.
     - Сверху вниз при срабатывании верхнего датчика.
   - Плавное затухание по завершению таймера задержки.
   - Дежурная подсветка (ночник): мягкое свечение крайних ступеней или всех ступеней на минимальной яркости.

2. **Астрономическое расписание (Закат / Рассвет):**
   - Синхронизация точного времени по NTP (\`pool.ntp.org\`).
   - Встроенный расчет солнечного заката и рассвета по координатам (Широта: \`${config.latitude}\`, Долгота: \`${config.longitude}\`).
   - Подсветка активируется **за 30 минут до заката** и выключается **после рассвета**.

3. **GitHub Actions CI/CD & Автоматическая сборка:**
   - При любом \`git push\` в репозиторий GitHub автоматически компилирует прошивку в облаке с помощью PlatformIO.
   - Автоматически инкрементирует номер версии (например \`v1.0.1\`, \`v1.0.2\`).
   - Создает GitHub Release и прикрепляет файл прошивки \`firmware.bin\` и манифест \`version.json\`.

4. **Автоматическое OTA-обновление по Wi-Fi:**
   - ESP32 периодически опрашивает ваш GitHub-репозиторий.
   - При появлении новой сборки автоматически скачивает \`firmware.bin\` и безопасно прошивается "по воздуху".
   - Визуальная индикация процесса обновления на светодиодах.

5. **Встроенный Web-интерфейс:**
   - Локальная страница управления \`http://<IP_ESP32>\` или в режиме точки доступа \`http://192.168.4.1\`.
   - Ручное переключение цветов, тестирование датчиков, ручная прошивка через браузер (\`/update\`).

---

## 🛠 Схема подключения (Hardware Wiring)

| Компонент | Пин ESP32 | Примечание |
|---|---|---|
| **WS2812B Data In** | **GPIO ${config.ledPin}** | Рекомендуется резистор 330–470 Ом в разрыв сигнального провода |
| **Нижний датчик (PIR / Radar)** | **GPIO ${config.bottomSensorPin}** | Выход \`OUT\` датчика движения (HC-SR501 / RCWL-0516) |
| **Верхний датчик (PIR / Radar)** | **GPIO ${config.topSensorPin}** | Выход \`OUT\` датчика движения |
| **Питание 5V** | **5V / VIN** | Блок питания 5V (расчет: ~60мА на 1 LED при белом цвете) |
| **GND** | **GND** | Общая земля для ESP32, ленты и датчиков |

> ⚠️ **Важно:** На линии питания светодиодной ленты рекомендуется установить электролитический конденсатор 1000 мкФ 6.3V/10V параллельно питанию (+ и GND) для сглаживания бросков тока.

---

## 🚀 Прошивка ESP32 и Быстрый старт

### Вариант 1: Загрузка через Google AI Studio прямо на GitHub
1. **Экспорт в GitHub:**
   - В Google AI Studio откройте меню проекта / настройки (**Settings**) и нажмите **Export to GitHub** (или скачайте ZIP-архив).
   - В репозитории GitHub перейдите в **Settings** -> **Actions** -> **General** -> **Workflow permissions**, выберите **Read and write permissions** и сохраните.
2. **Автоматическая сборка:**
   - GitHub Actions автоматически скомпилирует скетч с помощью \`arduino-cli\` и создаст официальный Release со всеми бинарниками и скриптом прошивки!

---

### Вариант 2: Прошивка по USB в 1 клик на Windows (flash_windows.bat)
1. **Готовый архив из GitHub Releases:**
   - Скачайте архив **\`esp32_stairs_flasher_vX.X.zip\`** из раздела **Releases** вашего репозитория.
   - Подключите ESP32 к компьютеру по USB и дважды кликните по **\`flash_windows.bat\`**.
   - Скрипт прошьет плату. Для чтения логов в реальном времени запустите **\`terminal.bat\`**.
2. **Из исходного архива проекта:**
   - Скрипт **\`flash_windows.bat\`** автоматически скачает официальный \`esptool.exe\` из репозитория Espressif при первом запуске, если его нет в папке!

---

### Вариант 3: Ручная загрузка в репозиторий через Git
\`\`\`bash
git init
git add .
git commit -m "Initial commit for Smart Staircase"
git remote add origin https://github.com/${config.githubUsername || 'YOUR_USERNAME'}/${config.githubRepo || 'esp32-stairs-lighting'}.git
git branch -M main
git push -u origin main
\`\`\`

---

## ⚙️ Текущая конфигурация

- **Количество ступеней:** ${config.stepCount} шт.
- **Диодов на ступень:** ${config.ledsPerStep} шт. (Всего: ${totalLeds} LED)
- **Координаты солнца:** ${config.latitude}°N, ${config.longitude}°E (Часовой пояс: UTC${config.timezoneOffsetHours >= 0 ? '+' : ''}${config.timezoneOffsetHours})
- **Срабатывание:** За ${Math.abs(config.sunsetOffsetMinutes)} мин до заката -> До рассвета
`;

  return [
    {
      name: 'flash_windows.bat',
      path: 'flash_windows.bat',
      language: 'bat',
      description: 'Windows 1-Click flasher script with automatic esptool.exe downloader',
      content: flashWindowsBat,
    },
    {
      name: 'terminal.bat',
      path: 'terminal.bat',
      language: 'bat',
      description: 'Windows Serial Monitor console (115200 baud) for live debugging',
      content: terminalBat,
    },
    {
      name: 'build_and_release.yml',
      path: '.github/workflows/build_and_release.yml',
      language: 'yaml',
      description: 'GitHub Actions CI/CD with Arduino CLI, auto-versioning and release packaging',
      content: githubActionsWorkflow,
    },
    {
      name: 'StairsEsp.ino',
      path: 'StairsEsp/StairsEsp.ino',
      language: 'cpp',
      description: 'Arduino IDE & Arduino CLI main sketch entry point',
      content: stairsEspIno,
    },
    {
      name: 'version.h',
      path: 'StairsEsp/version.h',
      language: 'cpp',
      description: 'Dynamic firmware version header managed by GitHub Actions',
      content: versionH,
    },
    {
      name: 'platformio.ini',
      path: 'platformio.ini',
      language: 'ini',
      description: 'PlatformIO build configuration with FastLED, ArduinoJson & partitions',
      content: platformioIni,
    },
    {
      name: 'config.h',
      path: 'src/config.h',
      language: 'cpp',
      description: 'Pin definitions, step counts, solar parameters, and Wi-Fi constants',
      content: configH,
    },
    {
      name: 'solar_scheduler.h',
      path: 'src/solar_scheduler.h',
      language: 'cpp',
      description: 'Astronomical sunrise/sunset math & NTP synchronization engine',
      content: solarSchedulerH,
    },
    {
      name: 'led_controller.h',
      path: 'src/led_controller.h',
      language: 'cpp',
      description: 'WS2812B step-by-step wave animations, crossfades & standby mode',
      content: ledControllerH,
    },
    {
      name: 'ota_manager.h',
      path: 'src/ota_manager.h',
      language: 'cpp',
      description: 'GitHub Releases auto-OTA update client over Wi-Fi',
      content: otaManagerH,
    },
    {
      name: 'web_server.h',
      path: 'src/web_server.h',
      language: 'cpp',
      description: 'Embedded Web UI & manual .bin firmware flash endpoint',
      content: webServerH,
    },
    {
      name: 'main.cpp',
      path: 'src/main.cpp',
      language: 'cpp',
      description: 'Main ESP32 application entry point & FreeRTOS loop',
      content: mainCpp,
    },
    {
      name: 'version.json',
      path: 'version.json',
      language: 'json',
      description: 'Firmware version manifest queried by ESP32 OTA',
      content: versionJson,
    },
    {
      name: 'README.md',
      path: 'README.md',
      language: 'markdown',
      description: 'Complete Russian and English wiring, flashing & AI Studio / GitHub setup',
      content: readmeMd,
    },
  ];
}
