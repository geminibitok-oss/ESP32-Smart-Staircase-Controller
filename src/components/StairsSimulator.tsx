import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Sun, Moon, Sparkles, Footprints, Wifi, Radio, Zap, AlertCircle } from 'lucide-react';
import { StaircaseConfig, AnimationState, SolarTimeInfo } from '../types';

interface StairsSimulatorProps {
  config: StaircaseConfig;
  onUpdateConfig?: (updates: Partial<StaircaseConfig>) => void;
}

export const StairsSimulator: React.FC<StairsSimulatorProps> = ({ config, onUpdateConfig }) => {
  // Simulator State
  const [animState, setAnimState] = useState<AnimationState>('IDLE_DAY');
  const [activeStepProgress, setActiveStepProgress] = useState<number>(0);
  const [direction, setDirection] = useState<'UP' | 'DOWN' | null>(null);
  const [simulatedMinutes, setSimulatedMinutes] = useState<number>(1260); // 21:00 (Night by default)
  const [holdTimerSec, setHoldTimerSec] = useState<number>(config.holdTimeSec);
  const [isBottomSensorActive, setIsBottomSensorActive] = useState<boolean>(false);
  const [isTopSensorActive, setIsTopSensorActive] = useState<boolean>(false);
  const [isOtaActive, setIsOtaActive] = useState<boolean>(false);

  // Calculate Astronomical Solar Times based on config
  const calculateSolarInfo = (mins: number): SolarTimeInfo => {
    // Approximate sunset around 20:00 (1200 mins), sunrise around 06:00 (360 mins)
    const sunsetMin = 1200;
    const sunriseMin = 360;
    const turnOnMin = sunsetMin + config.sunsetOffsetMinutes; // 1170 min (19:30)
    const turnOffMin = sunriseMin + config.sunriseOffsetMinutes; // 360 min (06:00)

    const isNight = mins >= turnOnMin || mins < turnOffMin;

    const formatTime = (m: number) => {
      const normalized = ((m % 1440) + 1440) % 1440;
      const h = Math.floor(normalized / 60);
      const min = normalized % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    return {
      sunsetTime: formatTime(sunsetMin),
      sunriseTime: formatTime(sunriseMin),
      turnOnTime: formatTime(turnOnMin),
      turnOffTime: formatTime(turnOffMin),
      isNightActive: isNight,
      currentSimulatedTime: mins,
    };
  };

  const solarInfo = calculateSolarInfo(simulatedMinutes);

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
      setAnimState(solarInfo.isNightActive ? 'STANDBY_NIGHT' : 'IDLE_DAY');
    }, 4500);
  };

  const handleReset = () => {
    setDirection(null);
    setActiveStepProgress(0);
    setHoldTimerSec(config.holdTimeSec);
    setIsOtaActive(false);
    setAnimState(solarInfo.isNightActive ? 'STANDBY_NIGHT' : 'IDLE_DAY');
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
            setAnimState(solarInfo.isNightActive ? 'STANDBY_NIGHT' : 'IDLE_DAY');
            setDirection(null);
            return 0;
          }
          return prev + 1;
        });
      }, Math.max(30, config.stepSpeedMs));
    } else if (!isOtaActive) {
      // Sync idle state with solar time
      if (solarInfo.isNightActive && animState === 'IDLE_DAY') {
        setAnimState('STANDBY_NIGHT');
      } else if (!solarInfo.isNightActive && animState === 'STANDBY_NIGHT') {
        setAnimState('IDLE_DAY');
      }
    }

    return () => clearInterval(interval);
  }, [animState, config.stepCount, config.stepSpeedMs, solarInfo.isNightActive, isOtaActive]);

  // Color Mapping
  const getColorRGB = () => {
    switch (config.colorScheme) {
      case 'warm_white': return 'rgb(255, 195, 120)';
      case 'natural_white': return 'rgb(250, 240, 230)';
      case 'amber_gold': return 'rgb(255, 155, 20)';
      case 'neon_ice': return 'rgb(56, 189, 248)';
      case 'rainbow_gradient': return 'rgb(168, 85, 247)';
      case 'cyberpunk': return 'rgb(236, 72, 153)';
      case 'custom': return config.customHexColor;
      default: return 'rgb(255, 190, 100)';
    }
  };

  const activeColor = getColorRGB();

  // Helper to determine single step brightness / state
  const getStepStatus = (stepIdx: number) => {
    if (animState === 'OTA_UPDATING') {
      return {
        isLit: true,
        color: 'rgb(59, 130, 246)',
        brightness: 0.9,
        glow: '0 0 16px rgba(59, 130, 246, 0.8)',
      };
    }

    if (animState === 'FULL_ON') {
      return {
        isLit: true,
        color: activeColor,
        brightness: config.activeBrightness / 255,
        glow: `0 0 20px ${activeColor}`,
      };
    }

    if (animState === 'UP_WAVE') {
      const isLit = stepIdx <= activeStepProgress;
      return {
        isLit,
        color: activeColor,
        brightness: isLit ? config.activeBrightness / 255 : 0.05,
        glow: isLit ? `0 0 18px ${activeColor}` : 'none',
      };
    }

    if (animState === 'DOWN_WAVE') {
      const isLit = stepIdx >= (config.stepCount - 1 - activeStepProgress);
      return {
        isLit,
        color: activeColor,
        brightness: isLit ? config.activeBrightness / 255 : 0.05,
        glow: isLit ? `0 0 18px ${activeColor}` : 'none',
      };
    }

    if (animState === 'FADING_OUT') {
      // Dims in direction of travel
      let isStillLit = false;
      if (direction === 'UP') {
        isStillLit = stepIdx > activeStepProgress;
      } else {
        isStillLit = stepIdx < (config.stepCount - 1 - activeStepProgress);
      }
      return {
        isLit: isStillLit,
        color: activeColor,
        brightness: isStillLit ? config.activeBrightness / 255 : 0.08,
        glow: isStillLit ? `0 0 12px ${activeColor}` : 'none',
      };
    }

    // Standby Night Mode
    if (animState === 'STANDBY_NIGHT') {
      if (config.standbyMode === 'edge_steps') {
        const isEdge = stepIdx === 0 || stepIdx === config.stepCount - 1;
        return {
          isLit: isEdge,
          color: activeColor,
          brightness: isEdge ? config.standbyBrightness / 255 : 0.03,
          glow: isEdge ? `0 0 8px ${activeColor}` : 'none',
        };
      }
      if (config.standbyMode === 'all_dim') {
        return {
          isLit: true,
          color: activeColor,
          brightness: config.standbyBrightness / 255,
          glow: `0 0 6px ${activeColor}`,
        };
      }
    }

    // Daylight / Off
    return {
      isLit: false,
      color: '#334155',
      brightness: 0.03,
      glow: 'none',
    };
  };

  return (
    <div id="stairs-simulator" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl backdrop-blur-sm text-slate-100">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              Симулятор умной лестницы (ESP32 Interactive Virtual Rig)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Симуляция пошаговой анимации ленты WS2812B, датчиков PIR и астрономического времени заката/рассвета
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono ${
            solarInfo.isNightActive ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60' : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
          }`}>
            {solarInfo.isNightActive ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span>{solarInfo.isNightActive ? 'Режим: НОЧЬ (Активно)' : 'Режим: ДЕНЬ (Ожидание)'}</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            State: <span className="text-sky-400 font-semibold">{animState}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Stairs Canvas + Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* Left Column: Interactive 3D Perspective Stairs Render (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950/80 rounded-xl border border-slate-800/80 p-5 relative overflow-hidden min-h-[420px]">
          
          {/* Ambient Lighting Glow Behind Stairs */}
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-700 opacity-20"
            style={{
              background: animState !== 'IDLE_DAY' 
                ? `radial-gradient(circle at 50% 50%, ${activeColor} 0%, transparent 70%)` 
                : 'none'
            }}
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
              const stepWidthPercent = 65 + (idx / config.stepCount) * 35; // perspective tapering

              return (
                <div 
                  key={idx} 
                  className="flex items-center justify-between gap-3 group transition-all duration-200"
                  style={{ width: `${stepWidthPercent}%`, margin: '0 auto' }}
                >
                  {/* Step Number */}
                  <span className="text-[10px] font-mono text-slate-500 w-5 text-right select-none">
                    #{idx + 1}
                  </span>

                  {/* Step Physical Plank with embedded WS2812B Pixel Bar */}
                  <div 
                    className="flex-1 h-5 rounded-md border flex items-center px-1.5 gap-1 transition-all duration-300 relative overflow-hidden"
                    style={{
                      backgroundColor: '#1e293b',
                      borderColor: stepStatus.isLit ? stepStatus.color : '#334155',
                      boxShadow: stepStatus.glow,
                    }}
                  >
                    {/* Simulated Pixel LEDs on each step */}
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

                    {/* Step Highlight Glare */}
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

        {/* Right Column: Solar Scheduler & Interactive Simulator Controls (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* 1. Solar & Internet Time Simulator Card */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Солнечное расписание (NTP + Астрономия)
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                {Math.floor(simulatedMinutes / 60).toString().padStart(2, '0')}:{(simulatedMinutes % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Time Scrubber Slider */}
            <div className="space-y-1.5">
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
                <span>00:00 (Ночь)</span>
                <span className="text-amber-300">Рассвет: {solarInfo.sunriseTime}</span>
                <span>12:00 (День)</span>
                <span className="text-indigo-300">Закат: {solarInfo.sunsetTime}</span>
                <span>23:59</span>
              </div>
            </div>

            {/* Astronomical Logic Explanation */}
            <div className="mt-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Включение подсветки:</span>
                <span className="font-mono text-emerald-400 font-semibold">{solarInfo.turnOnTime} (-30 мин до заката)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Выключение подсветки:</span>
                <span className="font-mono text-slate-300 font-semibold">{solarInfo.turnOffTime} (после рассвета)</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Координаты солнца:</span>
                <span className="font-mono text-slate-400">{config.latitude}° N, {config.longitude}° E</span>
              </div>
            </div>

            {/* Fast Presets */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setSimulatedMinutes(720)} // 12:00
                className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center justify-center gap-1"
              >
                <Sun className="w-3 h-3 text-amber-400" /> День (12:00)
              </button>
              <button
                onClick={() => setSimulatedMinutes(1170)} // 19:30 (-30m sunset)
                className="flex-1 py-1 px-2 rounded bg-indigo-950/80 hover:bg-indigo-900/80 text-[11px] text-indigo-300 border border-indigo-800/50 flex items-center justify-center gap-1"
              >
                <Moon className="w-3 h-3 text-indigo-400" /> Закат (19:30)
              </button>
              <button
                onClick={() => setSimulatedMinutes(1380)} // 23:00
                className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center justify-center gap-1"
              >
                Ночь (23:00)
              </button>
            </div>
          </div>

          {/* 2. Realtime Simulation Controls & OTA Tester */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                Инструменты тестирования
              </span>
              <button
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Сброс
              </button>
            </div>

            {/* Dwell Timer Gauge */}
            {animState === 'FULL_ON' && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs">
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Лестница полностью горит
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  Задержка: {holdTimerSec} сек
                </span>
              </div>
            )}

            {/* OTA Update Simulator Button */}
            <button
              id="btn-simulate-ota"
              onClick={handleTriggerOtaTest}
              disabled={isOtaActive}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                isOtaActive 
                  ? 'bg-blue-600 text-white animate-pulse' 
                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-sky-400" />
              {isOtaActive ? 'Прошивка OTA в процессе... (Светодиоды мигают синим)' : 'Симулировать получение OTA-прошивки по Wi-Fi'}
            </button>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-500">Ступеней / LED:</div>
                <div className="font-mono text-slate-200 font-semibold">
                  {config.stepCount} шт / {config.stepCount * config.ledsPerStep} диодов
                </div>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-500">Скорость волны:</div>
                <div className="font-mono text-slate-200 font-semibold">
                  {config.stepSpeedMs} мс на ступень
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
