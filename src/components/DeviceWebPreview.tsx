import React, { useState } from 'react';
import { Smartphone, RefreshCw, Sliders, Sun, Moon, Wifi, Check, ExternalLink, Zap } from 'lucide-react';
import { StaircaseConfig } from '../types';

interface DeviceWebPreviewProps {
  config: StaircaseConfig;
  onColorChange?: (hex: string) => void;
  onTrigger?: (isBottom: boolean) => void;
}

export const DeviceWebPreview: React.FC<DeviceWebPreviewProps> = ({ config, onColorChange, onTrigger }) => {
  const [selectedColor, setSelectedColor] = useState<string>(config.customHexColor || '#ffb450');
  const [statusTriggered, setStatusTriggered] = useState<string | null>(null);

  const handleColorChange = (hex: string) => {
    setSelectedColor(hex);
    if (onColorChange) onColorChange(hex);
  };

  const handleTrigger = (isBottom: boolean) => {
    setStatusTriggered(isBottom ? '🚶 Снизу ВВЕРХ' : '🚶 Сверху ВНИЗ');
    if (onTrigger) onTrigger(isBottom);
    setTimeout(() => setStatusTriggered(null), 2500);
  };

  return (
    <div id="device-web-preview" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            Встроенный Web-интерфейс ESP32 (Live Simulator)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Именно такую страницу отдает веб-сервер ESP32 при входе со смартфона по адресу <code className="text-emerald-400 font-mono">http://192.168.4.1</code> или по локальному IP
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ESPAsyncWebServer Port 80
          </span>
        </div>
      </div>

      {/* Simulated Smartphone Screen */}
      <div className="max-w-md mx-auto mt-6 bg-slate-950 rounded-2xl border-4 border-slate-800 p-4 shadow-2xl relative overflow-hidden">
        {/* Phone Top Notch Bar */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>ESP32-Stairs.local</span>
          </div>
          <span className="text-slate-400">192.168.1.145</span>
        </div>

        {/* Embedded Web App Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Подсветка Лестницы ESP32
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              v{config.firmwareVersion}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Статус Wi-Fi:</span>
              <span className="text-emerald-400 font-semibold">Подключено (2.4G)</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Ступени:</span>
              <span className="text-slate-200 font-semibold">{config.stepCount} шт ({config.stepCount * config.ledsPerStep} LED)</span>
            </div>
          </div>

          {/* Manual Trigger Buttons */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Ручной запуск анимации:</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTrigger(true)}
                className="py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
              >
                🚶 Вверх (Снизу)
              </button>
              <button
                onClick={() => handleTrigger(false)}
                className="py-2 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
              >
                🚶 Вниз (Сверху)
              </button>
            </div>

            {statusTriggered && (
              <div className="p-2 rounded bg-emerald-950/80 border border-emerald-800 text-center text-xs text-emerald-300 animate-fadeIn">
                Команда отправлена: {statusTriggered}
              </div>
            )}
          </div>

          {/* Color Chooser */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Выбор оттенка подсветки:</span>
              <span className="font-mono text-slate-400 text-[11px]">{selectedColor}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-12 h-9 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
              />
              <div className="flex-1 flex gap-1.5 overflow-x-auto">
                {['#ffb450', '#ffffff', '#ffa014', '#38bdf8', '#a855f7', '#ec4899'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleColorChange(preset)}
                    className="w-7 h-7 rounded-md border border-slate-700 shrink-0 transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Solar Times in Device View */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Закат солнца:</span>
              <span className="font-mono text-amber-300 font-bold">20:00 (Старт в 19:30)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Рассвет:</span>
              <span className="font-mono text-slate-300 font-bold">06:00 (Выкл)</span>
            </div>
          </div>

          {/* Manual Flash Link */}
          <div className="pt-2 text-center border-t border-slate-800/80">
            <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              Резервная загрузка: <code className="text-slate-400">/update</code> (.bin file)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
