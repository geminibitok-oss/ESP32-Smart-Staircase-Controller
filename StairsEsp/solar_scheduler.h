/**
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

        int dayOfYear = timeinfo.tm_yday; // 0 - 365
        calculateSunTimes(DEFAULT_LATITUDE, DEFAULT_LONGITUDE, dayOfYear, TIMEZONE_OFFSET_H);
    }

    bool isNightTimeActive() {
        if (!timeSynchronized) {
            return true;
        }

        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 500)) return true;

        int currentMin = timeinfo.tm_hour * 60 + timeinfo.tm_min;

        int turnOnMinute = sunsetMinuteOfDay + SUNSET_OFFSET_MIN;   // Sunset - 30 minutes
        int turnOffMinute = sunriseMinuteOfDay + SUNRISE_OFFSET_MIN; // Sunrise

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
        float gamma = 2.0f * PI / 365.0f * (dayOfYear - 1);
        
        float eqtime = 229.18f * (0.000075f + 0.001868f * cos(gamma) - 0.032077f * sin(gamma) 
                       - 0.014615f * cos(2 * gamma) - 0.040849f * sin(2 * gamma));
        
        float decl = 0.006918f - 0.399912f * cos(gamma) + 0.070257f * sin(gamma) 
                     - 0.006758f * cos(2 * gamma) + 0.000907f * sin(2 * gamma);

        float latRad = lat * DEG_TO_RAD;
        float zenith = 90.833f * DEG_TO_RAD;

        float cosHourAngle = (cos(zenith) / (cos(latRad) * cos(decl))) - (tan(latRad) * tan(decl));

        if (cosHourAngle > 1.0f) {
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 0;
            return;
        }
        if (cosHourAngle < -1.0f) {
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 1440;
            return;
        }

        float hourAngle = acos(cosHourAngle) * RAD_TO_DEG;
        float solarNoonUtc = 720.0f - (4.0f * lon) - eqtime;

        sunriseMinuteOfDay = (int)(solarNoonUtc - (hourAngle * 4.0f) + (tzOffset * 60));
        sunsetMinuteOfDay  = (int)(solarNoonUtc + (hourAngle * 4.0f) + (tzOffset * 60));

        if (sunriseMinuteOfDay < 0) sunriseMinuteOfDay += 1440;
        if (sunsetMinuteOfDay < 0) sunsetMinuteOfDay += 1440;

        Serial.printf("[SOLAR] Calculated for Day %d -> Sunrise: %02d:%02d, Sunset: %02d:%02d (Active Window: %02d:%02d to %02d:%02d)\n",
                      dayOfYear, 
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60,
                      sunsetMinuteOfDay / 60, sunsetMinuteOfDay % 60,
                      (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) / 60, (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) % 60,
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60);
    }
};
