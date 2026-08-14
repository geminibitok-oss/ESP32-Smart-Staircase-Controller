/**
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

    void triggerBottom() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
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

    void triggerTop() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
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
        lightUpStep(0, primaryColor, STANDBY_BRIGHTNESS);
        lightUpStep(NUM_STEPS - 1, primaryColor, STANDBY_BRIGHTNESS);
#elif STANDBY_MODE_TYPE == 2
        for (int s = 0; s < NUM_STEPS; s++) {
            lightUpStep(s, primaryColor, STANDBY_BRIGHTNESS);
        }
#elif STANDBY_MODE_TYPE == 3
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
