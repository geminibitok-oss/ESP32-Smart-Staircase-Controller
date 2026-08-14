export interface StaircaseConfig {
  // Physical configuration
  stepCount: number;
  ledsPerStep: number;
  ledPin: number;
  bottomSensorPin: number;
  topSensorPin: number;
  ldrSensorPin: number; // Optional LDR analog pin
  useLdr: boolean;

  // Visual & Animation
  colorScheme: 'warm_white' | 'natural_white' | 'amber_gold' | 'neon_ice' | 'rainbow_gradient' | 'cyberpunk' | 'custom';
  customHexColor: string;
  stepSpeedMs: number; // speed of step propagation
  fadeSpeedMs: number; // transition smooth fade
  holdTimeSec: number; // dwell time before auto turn off
  activeBrightness: number; // 0-255
  standbyBrightness: number; // 0-255 (night glow)
  standbyMode: 'off' | 'edge_steps' | 'all_dim' | 'breathing';

  // Solar & Time Scheduling
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number; // e.g. +3 for MSK
  sunsetOffsetMinutes: number; // e.g. -30 (starts 30 min before sunset)
  sunriseOffsetMinutes: number; // e.g. 0 (ends at sunrise)
  ntpServer: string;

  // Wi-Fi & OTA Configuration
  wifiSsid: string;
  wifiPassword: string;
  apSsid: string;
  apPassword: string;
  githubUsername: string;
  githubRepo: string;
  githubBranch: string;
  firmwareVersion: string;
  otaCheckIntervalMinutes: number;
  enableAutoOta: boolean;
}

export type AnimationState = 
  | 'IDLE_DAY' 
  | 'STANDBY_NIGHT' 
  | 'UP_WAVE' 
  | 'DOWN_WAVE' 
  | 'FULL_ON' 
  | 'FADING_OUT'
  | 'OTA_UPDATING';

export interface SolarTimeInfo {
  sunriseTime: string; // HH:MM
  sunsetTime: string;  // HH:MM
  turnOnTime: string;  // HH:MM (sunset - 30 min)
  turnOffTime: string; // HH:MM (sunrise)
  isNightActive: boolean;
  currentSimulatedTime: number; // minutes from 0:00 (0 to 1439)
}
