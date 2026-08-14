/**
 * Smart Staircase Controller Configuration
 * Generated for ESP32 + WS2812B Pixel Strip
 */
#pragma once
#include <Arduino.h>

// ================= PHYSICAL CONFIGURATION =================
#define NUM_STEPS          16        // Total number of stairs/steps
#define LEDS_PER_STEP      30        // Number of WS2812B LEDs per step
#define TOTAL_LEDS         (NUM_STEPS * LEDS_PER_STEP)

// GPIO Pins (ESP32 DevKit V1)
#define PIN_LED_DATA       18       // Output to WS2812B Data In
#define PIN_BOTTOM_PIR     19       // Bottom Motion Sensor (PIR/Radar)
#define PIN_TOP_PIR        21       // Top Motion Sensor (PIR/Radar)
#define PIN_LDR_SENSOR     34       // Optional Analog Ambient Light Sensor

// ================= ANIMATION & LIGHTING =================
#define STEP_ANIM_SPEED_MS 60       // Delay between lighting consecutive steps (ms)
#define STEP_FADE_SPEED_MS 20       // Smooth fade transition speed (ms)
#define HOLD_TIME_SECONDS  15       // Time staircase stays lit after motion stops (s)
#define ACTIVE_BRIGHTNESS  220      // Maximum brightness when walking (0-255)
#define STANDBY_BRIGHTNESS 25       // Night standby glow brightness (0-255)

// Standby Mode: 0 = Off, 1 = First & Last Step Only, 2 = All Steps Dim, 3 = Soft Breathing
#define STANDBY_MODE_TYPE  1

// ================= SOLAR & GEOLOCATION =================
#define DEFAULT_LATITUDE   55.7558f    // Latitude for Sunset/Sunrise calculation (Moscow)
#define DEFAULT_LONGITUDE  37.6173f    // Longitude
#define TIMEZONE_OFFSET_H  3           // UTC Offset in hours (e.g. +3 for MSK)
#define SUNSET_OFFSET_MIN  -30         // Start lighting 30 min before sunset
#define SUNRISE_OFFSET_MIN 0           // Stop lighting at sunrise

#define NTP_SERVER_NAME    "pool.ntp.org"

// ================= WI-FI & GITHUB OTA =================
#define DEFAULT_WIFI_SSID  "MyHomeWiFi"
#define DEFAULT_WIFI_PASS  "SuperSecretPassword"
#define AP_SSID_NAME       "ESP32-Staircase-Setup"
#define AP_PASSWORD_NAME   "12345678"

// GitHub Auto-OTA Repository
#define GITHUB_USER        "geminibitok-oss"
#define GITHUB_REPO        "ESP32-Smart-Staircase-Controller"
#define GITHUB_BRANCH      "main"
#define OTA_CHECK_MINUTES  60       // Check GitHub for new releases every X min

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION   "1.0.0"
#endif
