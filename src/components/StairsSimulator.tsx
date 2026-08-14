import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RotateCcw, 
  Sun, 
  Moon, 
  Sparkles, 
  Footprints, 
  Wifi, 
  Radio, 
  Zap, 
  AlertCircle,
  Smartphone,
  Sliders,
  MapPin,
  Save,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { StaircaseConfig, AnimationState, SolarTimeInfo } from '../types';
import { calculateSolarTimes } from '../utils/solarCalculator';
import { LocationPicker, CITY_PRESETS } from './LocationPicker';

interface StairsSimulatorProps {
  config: StaircaseConfig;
  onUpdateConfig?: (updates: Partial<StaircaseConfig>) => void;
}

export const StairsSimulator: React.FC<StairsSimulatorProps> = ({ config, onUpdateConfig }) => {
  // Right panel view mode: 'esp_web' (Shows live ESP32 web interface), 'solar' (Solar & Location), 'testing' (Diagnostics & OTA)
  const [rightViewMode, setRightViewMode] = useState<'esp_web' | 'solar' | 'testing'>('esp_web');

  // Simulator State
  const [animState, setAnimState] = useState<AnimationState>('IDLE_DAY');
  const [activeStepProgress, setActiveStepProgress] = useState<number>(0);
  const [direction, setDirection] = useState<'UP' | 'DOWN' | null>(null);
  const [simulatedMinutes, setSimulatedMinutes] = useState<number>(1260); // 21:00 (Night by default)
  const [holdTimerSec, setHoldTimerSec] = useState<number>(config.holdTimeSec);
  const [isBottomSensorActive, setIsBottomSensorActive] = useState<boolean>(false);
  const [isTopSensorActive, setIsTopSensorActive] = useState<boolean>(false);
  const [isOtaActive, setIsOtaActive] = useState<boolean>(false);

  // ESP32 Web UI Embedded interactive controls state
  const [espWebColor, setEspWebColor] = useState<string>(config.customHexColor || '#ffb450');
  const [espWifiSsid, setEspWifiSsid] = useState<string>(config.wifiSsid || 'MyHomeWiFi');
  const [espWifiPass, setEspWifiPass] = useState<string>(config.wifiPassword || '');
  const [espSaveMsg, setEspSaveMsg] = useState<string | null>(null);

  // Calculate Astronomical Solar Times based on config coordinates
  const solarTimes = calculateSolarTimes(
    config.latitude, 
    config.longitude, 
    config.timezoneOffsetHours, 
    config.sunsetOffsetMinutes, 
    config.sunriseOffsetMinutes
  );

  const matchedCity = CITY_PRESETS.find(
    (c) => Math.abs(c.lat - config.latitude) < 0.02 && Math.abs(c.lon - config.longitude) < 0.02
  );

  const isNightActive = (mins: number) => {
    const turnOnMin = ((solarTimes.sunsetMinutes + config.sunsetOffsetMinutes) % 1440 + 1440) % 1440;
    const turnOffMin = ((solarTimes.sunriseMinutes + config.sunriseOffsetMinutes) % 1440 + 1440) % 1440;
    if (turnOnMin > turnOffMin) {
      return mins >= turnOnMin || mins < turnOffMin;
    } else {
      return mins >= turnOnMin && mins < turnOffMin;
    }
  };

  const isCurrentNight = isNightActive(simulatedMinutes);

  // Trigger handlers
  const handleTriggerBottom = () => {
    setIsBottomSensorActive(true);
    setTimeout(() => setIsBottomSensorActive(false), 800);

    if (animState === 'FULL_ON' || animState === 'UP_WAVE' || animState === 'DOWN_WAVE') {
      setHoldTimerSec(config.holdTimeSec);
      return;
    }

    setDirection('UP');
    setActiveStepProgress(0);
    setAnimState('UP_WAVE');
    setHoldTimerSec(config.holdTimeSec);
  };

  const handleTriggerTop = () => {
    setIsTopSensorActive(true);
    setTimeout(() => setIsTopSensorActive(false), 800);

    if (animState === 'FULL_ON' || animState === 'UP_WAVE' || animState === 'DOWN_WAVE') {
      setHoldTimerSec(config.holdTimeSec);
      return;
    }

    setDirection('DOWN');
    setActiveStepProgress(0);
    setAnimState('DOWN_WAVE');
    setHoldTimerSec(config.holdTimeSec);
  };

  const handleTriggerOtaTest = () => {
    setIsOtaActive(true);
    setAnimState('OTA_UPDATING');
    setTimeout(() => {
      setIsOtaActive(false);
      setAnimState(isCurrentNight ? 'STANDBY_NIGHT' : 'IDLE_DAY');
    }, 4500);
  };

  const handleReset = () => {
    setDirection(null);
    setActiveStepProgress(0);
    setHoldTimerSec(config.holdTimeSec);
    setIsOtaActive(false);
    setAnimState(isCurrentNight ? 'STANDBY_NIGHT' : 'IDLE_DAY');
  };

  // Color change from ESP32 Web UI
  const handleColorChange = (hex: string) => {
    setEspWebColor(hex);
    if (onUpdateConfig) {
      onUpdateConfig({ customHexColor: hex, colorScheme: 'custom' });
    }
  };

  const handleSaveFromEspWeb = (isReboot: boolean) => {
    if (onUpdateConfig) {
      onUpdateConfig({
        wifiSsid: espWifiSsid,
        wifiPassword: espWifiPass,
        customHexColor: espWebColor
      });
    }
    setEspSaveMsg(isReboot ? '✅ Настройки Wi-Fi сохранены! Имитация перезагрузки...' : '✅ Параметры подсветки сохранены в Flash память!');
    setTimeout(() => setEspSaveMsg(null), 3500);
  };

  // Animation Loop Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (animState === 'UP_WAVE' || animState === 'DOWN_WAVE') {
      interval = setInterval(() => {
        setActiveStepProgress((prev) => {
          if (prev + 1 >= config.stepCount) {
            setAnimState('FULL_ON');
            return config.stepCount;
          }
          return prev + 1;
        });
      }, Math.max(30, config.stepSpeedMs));
    } else if (animState === 'FULL_ON') {
      interval = setInterval(() => {
        setHoldTimerSec((prev) => {
          if (prev <= 1) {
            setAnimState('FADING_OUT');
            setActiveStepProgress(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (animState === 'FADING_OUT') {
      interval = setInterval(() => {
        setActiveStepProgress((prev) => {
          if (prev + 1 >= config.stepCount) {
            setAnimState(isCurrentNight ? 'STANDBY_NIGHT' : 'IDLE_DAY');
            setDirection(null);
            return 0;
          }
          return prev + 1;
        });
      }, Math.max(30, config.stepSpeedMs));
    } else if (!isOtaActive) {
      if (isCurrentNight && animState === 'IDLE_DAY') {
        setAnimState('STANDBY_NIGHT');
      } else if (!isCurrentNight && animState === 'STANDBY_NIGHT') {
        setAnimState('IDLE_DAY');
      }
    }

    return () => clearInterval(interval);
  }, [animState, config.stepCount, config.stepSpeedMs, isCurrentNight, isOtaActive]);

  // Color Mapping
  const getColorRGB = () => {
    switch (config.colorScheme) {
      case 'warm_white': return 'rgb(255, 195, 120)';
      case 'natural_white': return 'rgb(250, 240, 230)';
      case 'amber_gold': return 'rgb(255, 155, 20)';
      case 'neon_ice': return 'rgb(56, 189, 248)';
      case 'rainbow_gradient': return 'rgb(168, 85, 247)';
      case 'cyberpunk': return 'rgb(236, 72, 153)';
      case 'custom': return config.customHexColor || '#ffb450';
      default: return 'rgb(255, 190, 100)';
    }
  };

  const activeColor = getColorRGB();

  // Helper to determine step lighting and glow
  const getStepStatus = (stepIndex: number) => {
    if (isOtaActive) {
      const isBlinking = Math.floor(Date.now() / 200) % 2 === 0;
      return {
        isLit: true,
        color: isBlinking ? '#38bdf8' : '#1e3a8a',
        brightness: 0.9,
        glow: isBlinking ? '0 0 14px rgba(56, 189, 248, 0.8)' : 'none',
      };
    }

    if (animState === 'FULL_ON') {
      return {
        isLit: true,
        color: activeColor,
        brightness: config.activeBrightness / 255,
        glow: `0 0 16px ${activeColor}`,
      };
    }

    if (animState === 'UP_WAVE') {
      const isLit = stepIndex <= activeStepProgress;
      return {
        isLit,
        color: activeColor,
        brightness: isLit ? config.activeBrightness / 255 : 0.05,
        glow: isLit ? `0 0 14px ${activeColor}` : 'none',
      };
    }

    if (animState === 'DOWN_WAVE') {
      const topOffset = config.stepCount - 1 - stepIndex;
      const isLit = topOffset <= activeStepProgress;
      return {
        isLit,
        color: activeColor,
        brightness: isLit ? config.activeBrightness / 255 : 0.05,
        glow: isLit ? `0 0 14px ${activeColor}` : 'none',
      };
    }

    if (animState === 'FADING_OUT') {
      const isLit = direction === 'UP' ? stepIndex > activeStepProgress : (config.stepCount - 1 - stepIndex) > activeStepProgress;
      return {
        isLit,
        color: activeColor,
        brightness: isLit ? 0.3 : 0.05,
        glow: isLit ? `0 0 8px ${activeColor}` : 'none',
      };
    }

    if (animState === 'STANDBY_NIGHT') {
      const isEdgeStep = stepIndex === 0 || stepIndex === config.stepCount - 1;
      let shouldGlow = false;
      if (config.standbyMode === 'edge_steps' && isEdgeStep) shouldGlow = true;
      if (config.standbyMode === 'all_dim') shouldGlow = true;
      if (config.standbyMode === 'breathing') shouldGlow = true;

      return {
        isLit: shouldGlow,
        color: activeColor,
        brightness: shouldGlow ? (config.standbyBrightness / 255) : 0.05,
        glow: shouldGlow ? `0 0 8px ${activeColor}` : 'none',
      };
    }

    // IDLE_DAY
    return {
      isLit: false,
      color: '#334155',
      brightness: 0.03,
      glow: 'none',
    };
  };

  return (
    <div id="stairs-simulator" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100 space-y-5">
      
      {/* Top Header with Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white">
              Симулятор умной лестницы (ESP32 Virtual Rig)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Симуляция пошаговой анимации ленты WS2812B, датчиков PIR и Web-интерфейса ESP32
          </p>
        </div>

        {/* View Mode Switcher for the Right Panel */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setRightViewMode('esp_web')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              rightViewMode === 'esp_web'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Интерфейс ESP32</span>
          </button>

          <button
            onClick={() => setRightViewMode('solar')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              rightViewMode === 'solar'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Солнце & Локация</span>
          </button>

          <button
            onClick={() => setRightViewMode('testing')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              rightViewMode === 'testing'
                ? 'bg-purple-500 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Тест & OTA</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Stairs (7 cols) + Interactive Right Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Simulated Staircase Visualization (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/80 rounded-2xl border border-slate-800 p-4 md:p-5 flex flex-col justify-between relative overflow-hidden shadow-inner min-h-[460px]">
          
          {/* Ambient Lighting Background Glow */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none transition-all duration-700 blur-3xl"
            style={{ backgroundColor: activeColor }}
          />

          {/* Top Sensor Visual Indicator Bar */}
          <div className="relative z-10 flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isTopSensorActive ? 'bg-red-500 ring-4 ring-red-500/30' : 'bg-slate-700'
              }`} />
              <span className="text-xs font-mono text-slate-400">
                ВЕРХНИЙ ДАТЧИК (GPIO {config.topSensorPin})
              </span>
            </div>

            <button
              id="btn-trigger-top"
              onClick={handleTriggerTop}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isTopSensorActive 
                  ? 'bg-red-500 text-white shadow-red-500/30' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 text-amber-400" />
              Шаг сверху (ВНИЗ)
            </button>
          </div>

          {/* Isometric / Layered Stair Steps */}
          <div className="my-4 flex flex-col-reverse gap-2 max-w-md mx-auto w-full relative z-10 py-2">
            {Array.from({ length: config.stepCount }).map((_, idx) => {
              const stepStatus = getStepStatus(idx);
              const stepWidthPercent = 65 + (idx / config.stepCount) * 35;

              return (
                <div 
                  key={idx} 
                  className="flex items-center justify-between gap-3 group transition-all duration-200"
                  style={{ width: `${stepWidthPercent}%`, margin: '0 auto' }}
                >
                  <span className="text-[10px] font-mono text-slate-500 w-5 text-right select-none">
                    #{idx + 1}
                  </span>

                  <div 
                    className="flex-1 h-5 rounded-md border flex items-center px-1.5 gap-1 transition-all duration-300 relative overflow-hidden"
                    style={{
                      backgroundColor: '#1e293b',
                      borderColor: stepStatus.isLit ? stepStatus.color : '#334155',
                      boxShadow: stepStatus.glow,
                    }}
                  >
                    {Array.from({ length: Math.min(config.ledsPerStep, 18) }).map((_, ledIdx) => (
                      <div
                        key={ledIdx}
                        className="flex-1 h-2 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: stepStatus.isLit ? stepStatus.color : '#0f172a',
                          opacity: stepStatus.brightness,
                          boxShadow: stepStatus.isLit ? `0 0 6px ${stepStatus.color}` : 'none',
                        }}
                      />
                    ))}

                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Sensor Visual Indicator Bar */}
          <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isBottomSensorActive ? 'bg-emerald-500 ring-4 ring-emerald-500/30' : 'bg-slate-700'
              }`} />
              <span className="text-xs font-mono text-slate-400">
                НИЖНИЙ ДАТЧИК (GPIO {config.bottomSensorPin})
              </span>
            </div>

            <button
              id="btn-trigger-bottom"
              onClick={handleTriggerBottom}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isBottomSensorActive 
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                  : 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 text-white" />
              Шаг снизу (ВВЕРХ)
            </button>
          </div>
        </div>

        {/* Right Column (5 cols): Dynamic based on Selected View Mode */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* VIEW 1: ESP32 EMBEDDED WEB INTERFACE PREVIEW */}
          {rightViewMode === 'esp_web' && (
            <div className="bg-[#0f172a] rounded-2xl border-2 border-sky-800/60 shadow-xl overflow-hidden text-slate-100 flex flex-col">
              
              {/* Browser Address Bar */}
              <div className="bg-slate-950 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                  <span className="text-sky-300 ml-2 font-semibold">http://192.168.4.1</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  ESP32 AP
                </span>
              </div>

              {/* Web Page Body */}
              <div className="p-4 space-y-4 text-xs">
                
                {/* Title & Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                      🌟 Контроллер Лестницы
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Локация: <strong className="text-slate-200">{matchedCity ? matchedCity.city : 'Борисов'}</strong> (UTC+{config.timezoneOffsetHours})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-sky-600 text-white px-2 py-0.5 rounded-full font-bold">
                    v{config.firmwareVersion || '1.0.4'}
                  </span>
                </div>

                {/* Notification */}
                {espSaveMsg && (
                  <div className="p-2 bg-emerald-950 border border-emerald-700 text-emerald-200 text-[11px] rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{espSaveMsg}</span>
                  </div>
                )}

                {/* Quick Interactive Triggers */}
                <div>
                  <label className="text-slate-400 block mb-1.5 font-semibold text-[11px]">
                    🚶 Ручное включение подсветки:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleTriggerBottom}
                      className="py-2 px-2.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 shadow"
                    >
                      ⬆️ Иду Снизу
                    </button>
                    <button
                      onClick={handleTriggerTop}
                      className="py-2 px-2.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 shadow"
                    >
                      ⬇️ Иду Сверху
                    </button>
                  </div>
                </div>

                {/* Color Picker & Presets */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 block font-semibold text-[11px]">
                    🎨 Выбор цвета подсветки (WS2812B):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={espWebColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-10 h-8 rounded border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
                    />
                    <div className="flex-1 flex gap-1 overflow-x-auto">
                      {['#ffb450', '#ffffff', '#ffa014', '#38bdf8', '#a855f7', '#10b981'].map((c) => (
                        <button
                          key={c}
                          onClick={() => handleColorChange(c)}
                          className="w-7 h-7 rounded border border-slate-700 shrink-0 hover:scale-110 active:scale-95 transition-transform"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dynamic Configuration Sliders */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-400">Скорость ступени:</span>
                      <span className="font-mono text-sky-400 font-bold">{config.stepSpeedMs} мс</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="200"
                      value={config.stepSpeedMs}
                      onChange={(e) => onUpdateConfig && onUpdateConfig({ stepSpeedMs: Number(e.target.value) })}
                      className="w-full h-1.5 accent-sky-400 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-400">Время свечения (Hold):</span>
                      <span className="font-mono text-sky-400 font-bold">{config.holdTimeSec} сек</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="45"
                      value={config.holdTimeSec}
                      onChange={(e) => onUpdateConfig && onUpdateConfig({ holdTimeSec: Number(e.target.value) })}
                      className="w-full h-1.5 accent-sky-400 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-400">Яркость:</span>
                      <span className="font-mono text-sky-400 font-bold">{config.activeBrightness}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="255"
                      value={config.activeBrightness}
                      onChange={(e) => onUpdateConfig && onUpdateConfig({ activeBrightness: Number(e.target.value) })}
                      className="w-full h-1.5 accent-sky-400 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleSaveFromEspWeb(false)}
                  className="w-full py-2 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow flex items-center justify-center gap-1 text-xs"
                >
                  <Save className="w-3.5 h-3.5" /> Сохранить в память ESP32
                </button>
              </div>

              {/* Status bar */}
              <div className="bg-slate-950 px-3 py-1.5 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Wi-Fi: {config.wifiSsid}</span>
                <span className="text-emerald-400">● IP: 192.168.4.1</span>
              </div>
            </div>
          )}

          {/* VIEW 2: SOLAR & LOCATION PICKER */}
          {rightViewMode === 'solar' && (
            <div className="space-y-4">
              <LocationPicker 
                config={config} 
                onChange={(updates) => onUpdateConfig && onUpdateConfig(updates)} 
              />

              {/* Time Scrubber */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    Симуляция времени суток:
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {Math.floor(simulatedMinutes / 60).toString().padStart(2, '0')}:{(simulatedMinutes % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <input
                  id="slider-solar-time"
                  type="range"
                  min="0"
                  max="1439"
                  step="15"
                  value={simulatedMinutes}
                  onChange={(e) => setSimulatedMinutes(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />

                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>00:00</span>
                  <span className="text-amber-300">Рассвет: {solarTimes.sunriseFormatted}</span>
                  <span>12:00</span>
                  <span className="text-indigo-300">Закат: {solarTimes.sunsetFormatted}</span>
                  <span>23:59</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setSimulatedMinutes(720)}
                    className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                  >
                    ☀️ День (12:00)
                  </button>
                  <button
                    onClick={() => setSimulatedMinutes(solarTimes.sunsetMinutes + config.sunsetOffsetMinutes)}
                    className="flex-1 py-1 px-2 rounded bg-indigo-950 hover:bg-indigo-900 text-[11px] text-indigo-300 border border-indigo-800"
                  >
                    🌙 Закат ({solarTimes.turnOnFormatted})
                  </button>
                  <button
                    onClick={() => setSimulatedMinutes(1380)}
                    className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                  >
                    🌌 Ночь (23:00)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: TESTING & OTA */}
          {rightViewMode === 'testing' && (
            <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-400" />
                  Диагностика и симуляция OTA
                </span>
                <button
                  onClick={handleReset}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" /> Сброс
                </button>
              </div>

              {/* Dwell Timer Gauge */}
              {animState === 'FULL_ON' && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between">
                  <span className="text-emerald-300 flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Лестница горит
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Осталось: {holdTimerSec} сек
                  </span>
                </div>
              )}

              {/* OTA Button */}
              <button
                id="btn-simulate-ota"
                onClick={handleTriggerOtaTest}
                disabled={isOtaActive}
                className={`w-full py-2.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow ${
                  isOtaActive 
                    ? 'bg-blue-600 text-white animate-pulse' 
                    : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
                }`}
              >
                <Wifi className="w-4 h-4 text-sky-400" />
                {isOtaActive ? 'Прошивка по Wi-Fi... (Светодиоды мигают синим)' : 'Симулировать OTA обновление по Wi-Fi'}
              </button>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ступеней:</span>
                  <span className="font-mono font-bold text-slate-200">{config.stepCount} шт</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Всего светодиодов:</span>
                  <span className="font-mono font-bold text-slate-200">{config.stepCount * config.ledsPerStep} шт</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Текущий режим:</span>
                  <span className="font-mono text-amber-300 font-bold">{animState}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
