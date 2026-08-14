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
    CRGB leds[MAX_TOTAL_LEDS];
    StairState currentState = STATE_IDLE_DAY;
    Direction currentDirection = DIR_NONE;
    
    CRGB primaryColor = CRGB(255, 180, 80); // Warm cozy incandescent amber
    uint8_t currentStepProgress = 0;
    unsigned long lastStepTime = 0;
    unsigned long motionHoldTimer = 0;

    uint8_t numSteps = DEFAULT_NUM_STEPS;
    uint8_t ledsPerStep = DEFAULT_LEDS_STEP;

    uint32_t stepAnimSpeed = STEP_ANIM_SPEED_MS;
    uint32_t holdTimeSec = HOLD_TIME_SECONDS;
    uint8_t activeBrightness = ACTIVE_BRIGHTNESS;
    uint8_t standbyBrightness = STANDBY_BRIGHTNESS;
    uint8_t standbyModeType = STANDBY_MODE_TYPE;
    uint8_t effectMode = 0; // 0=Wave Cascade, 1=Smooth Fade All, 2=Curtain Fill, 3=Center Spread, 4=Meteor Chase, 5=Firefly Sparkle, 6=Rainbow Flow

    void begin() {
        FastLED.addLeds<WS2812B, PIN_LED_DATA, GRB>(leds, MAX_TOTAL_LEDS).setCorrection(TypicalLEDStrip);
        FastLED.setBrightness(activeBrightness);
        FastLED.clear(true);
        Serial.println("[LEDS] FastLED initialized for up to " + String(MAX_TOTAL_LEDS) + " LEDs");
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
                if (effectMode == 1) {
                    // Smooth Fade All steps simultaneously
                    if (now - lastStepTime >= (stepAnimSpeed / 4)) {
                        lastStepTime = now;
                        currentStepProgress += 10;
                        uint8_t bri = (currentStepProgress > activeBrightness) ? activeBrightness : currentStepProgress;
                        for (int s = 0; s < numSteps; s++) {
                            lightUpStep(s, primaryColor, bri);
                        }
                        FastLED.show();
                        if (currentStepProgress >= activeBrightness) {
                            currentState = STATE_FULL_ACTIVE;
                            motionHoldTimer = now;
                        }
                    }
                } else if (effectMode == 3) {
                    // Center Spread outward
                    if (now - lastStepTime >= stepAnimSpeed) {
                        lastStepTime = now;
                        int mid = numSteps / 2;
                        int s1 = mid - currentStepProgress;
                        int s2 = mid + currentStepProgress;
                        if (s1 >= 0 && s1 < numSteps) lightUpStep(s1, primaryColor, activeBrightness);
                        if (s2 >= 0 && s2 < numSteps) lightUpStep(s2, primaryColor, activeBrightness);
                        FastLED.show();

                        currentStepProgress++;
                        if (currentStepProgress >= (numSteps / 2 + 1)) {
                            currentState = STATE_FULL_ACTIVE;
                            motionHoldTimer = now;
                        }
                    }
                } else if (effectMode == 4) {
                    // Meteor chase
                    if (now - lastStepTime >= (stepAnimSpeed / 2)) {
                        lastStepTime = now;
                        int targetStep = (currentDirection == DIR_UP) ? currentStepProgress : (numSteps - 1 - currentStepProgress);
                        
                        // Fade existing
                        fadeToBlackBy(leds, numSteps * ledsPerStep, 60);
                        lightUpStep(targetStep, CRGB::White, activeBrightness);
                        FastLED.show();

                        currentStepProgress++;
                        if (currentStepProgress >= numSteps) {
                            for (int s = 0; s < numSteps; s++) lightUpStep(s, primaryColor, activeBrightness);
                            FastLED.show();
                            currentState = STATE_FULL_ACTIVE;
                            motionHoldTimer = now;
                        }
                    }
                } else if (effectMode == 6) {
                    // Rainbow flow
                    if (now - lastStepTime >= stepAnimSpeed) {
                        lastStepTime = now;
                        int stepToLight = (currentDirection == DIR_UP) ? currentStepProgress : (numSteps - 1 - currentStepProgress);
                        uint8_t hue = (stepToLight * 255) / numSteps;
                        lightUpStep(stepToLight, CHSV(hue, 220, activeBrightness), activeBrightness);
                        FastLED.show();

                        currentStepProgress++;
                        if (currentStepProgress >= numSteps) {
                            currentState = STATE_FULL_ACTIVE;
                            motionHoldTimer = now;
                        }
                    }
                } else {
                    // Default: Wave cascade step by step
                    if (now - lastStepTime >= stepAnimSpeed) {
                        lastStepTime = now;
                        
                        int stepToLight = (currentDirection == DIR_UP) 
                            ? currentStepProgress 
                            : (numSteps - 1 - currentStepProgress);

                        lightUpStep(stepToLight, primaryColor, activeBrightness);
                        FastLED.show();

                        currentStepProgress++;
                        if (currentStepProgress >= numSteps) {
                            currentState = STATE_FULL_ACTIVE;
                            motionHoldTimer = now;
                        }
                    }
                }
                break;

            case STATE_FULL_ACTIVE:
                if (now - motionHoldTimer >= (holdTimeSec * 1000UL)) {
                    Serial.println("[STAIRS] Hold time expired -> Starting fade out");
                    currentState = STATE_ANIMATING_OUT;
                    currentStepProgress = 0;
                    lastStepTime = now;
                }
                break;

            case STATE_ANIMATING_OUT:
                if (now - lastStepTime >= stepAnimSpeed) {
                    lastStepTime = now;

                    int stepToDim = (currentDirection == DIR_UP) 
                        ? currentStepProgress 
                        : (numSteps - 1 - currentStepProgress);

                    clearStep(stepToDim);
                    FastLED.show();

                    currentStepProgress++;
                    if (currentStepProgress >= numSteps) {
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
        if (stepIndex < 0 || stepIndex >= numSteps) return;
        int startIdx = stepIndex * ledsPerStep;
        for (int i = 0; i < ledsPerStep; i++) {
            if (startIdx + i < MAX_TOTAL_LEDS) {
                leds[startIdx + i] = color;
            }
        }
    }

    void clearStep(int stepIndex) {
        if (stepIndex < 0 || stepIndex >= numSteps) return;
        int startIdx = stepIndex * ledsPerStep;
        for (int i = 0; i < ledsPerStep; i++) {
            if (startIdx + i < MAX_TOTAL_LEDS) {
                leds[startIdx + i] = CRGB::Black;
            }
        }
    }

    void renderStandbyGlow() {
        FastLED.clear();
        if (standbyModeType == 1) {
            lightUpStep(0, primaryColor, standbyBrightness);
            if (numSteps > 1) {
                lightUpStep(numSteps - 1, primaryColor, standbyBrightness);
            }
        } else if (standbyModeType == 2) {
            for (int s = 0; s < numSteps; s++) {
                lightUpStep(s, primaryColor, standbyBrightness);
            }
        } else if (standbyModeType == 3) {
            uint8_t breath = beatsin8(15, standbyBrightness / 3, standbyBrightness);
            for (int s = 0; s < numSteps; s++) {
                lightUpStep(s, primaryColor, breath);
            }
        }
    }

    void renderOtaAnimation() {
        static uint8_t hue = 140; // Cyan-Blue
        uint8_t beat = beatsin8(40, 50, 255);
        int totalActiveLeds = numSteps * ledsPerStep;
        if (totalActiveLeds > MAX_TOTAL_LEDS) totalActiveLeds = MAX_TOTAL_LEDS;
        for (int i = 0; i < totalActiveLeds; i++) {
            leds[i] = CHSV(hue + (i * 2), 220, beat);
        }
    }
};
