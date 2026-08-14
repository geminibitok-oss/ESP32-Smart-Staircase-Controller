import React, { useState } from 'react';
import { Smartphone, Zap, Wifi, RefreshCw, Save, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';
import { StaircaseConfig } from '../types';

interface DeviceWebPreviewProps {
  config: StaircaseConfig;
  onColorChange?: (hex: string) => void;
  onTrigger?: (isBottom: boolean) => void;
  onConfigUpdate?: (updated: Partial<StaircaseConfig>) => void;
}

export const DeviceWebPreview: React.FC<DeviceWebPreviewProps> = ({ config, onColorChange, onTrigger, onConfigUpdate }) => {
  const [selectedColor, setSelectedColor] = useState<string>(config.customHexColor || '#ffb450');
  const [statusTriggered, setStatusTriggered] = useState<string | null>(null);
  
  // Dynamic form state mirroring ESP32 web interface
  const [wifiSsid, setWifiSsid] = useState<string>(config.wifiSsid || 'MyHomeWiFi');
  const [wifiPass, setWifiPass] = useState<string>(config.wifiPassword || '');
  const [animSpeed, setAnimSpeed] = useState<number>(config.stepSpeedMs || 90);
  const [holdTime, setHoldTime] = useState<number>(config.holdTimeSec || 8);
  const [actBright, setActBright] = useState<number>(config.activeBrightness || 220);
  const [sbBright, setSbBright] = useState<number>(config.standbyBrightness || 25);
  const [sbMode, setSbMode] = useState<number>(1);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [wifiList, setWifiList] = useState<string[]>([]);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const handleColorChange = (hex: string) => {
    setSelectedColor(hex);
    if (onColorChange) onColorChange(hex);
    if (onConfigUpdate) onConfigUpdate({ customHexColor: hex });
  };

  const handleTrigger = (isBottom: boolean) => {
    setStatusTriggered(isBottom ? '⬆️ Запущена волна Снизу Вверх' : '⬇️ Запущена волна Сверху Вниз');
    if (onTrigger) onTrigger(isBottom);
    setTimeout(() => setStatusTriggered(null), 3000);
  };

  const scanWifiNetworks = () => {
    setIsScanning(true);
    setTimeout(() => {
      setWifiList(['Moy_Domashniy_WiFi (5G/2.4G) -48dBm', 'Keenetic-9431 -65dBm', 'TP-Link_Guest -78dBm']);
      setIsScanning(false);
    }, 800);
  };

  const handleSave = (reboot: boolean) => {
    if (onConfigUpdate) {
      onConfigUpdate({
        wifiSsid,
        wifiPassword: wifiPass,
        stepSpeedMs: animSpeed,
        holdTimeSec: holdTime,
        activeBrightness: actBright,
        standbyBrightness: sbBright,
      });
    }
    setSaveBanner(reboot ? '✅ Настройки Wi-Fi сохранены! Имитация перезагрузки...' : '✅ Параметры подсветки успешно сохранены в Flash-память!');
    setTimeout(() => setSaveBanner(null), 3500);
  };

  return (
    <div id="device-web-preview" className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            Интерактивный Веб-Интерфейс ESP32 (Live Web UI)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Точная копия страницы <code className="text-sky-400 font-mono">http://192.168.4.1</code>, встроенной в прошивку ESP32
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-sky-950/80 text-sky-300 border border-sky-800 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            ESPAsyncWebServer Port 80
          </span>
        </div>
      </div>

      {/* Simulated Device Screen */}
      <div className="max-w-lg mx-auto mt-6 bg-[#0f172a] rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden">
        {/* Browser Top Navigation Bar */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
            <span className="text-slate-400 ml-2">http://192.168.4.1</span>
          </div>
          <span className="text-sky-400 text-[11px] font-semibold">Wi-Fi AP</span>
        </div>

        {/* Real ESP32 Web Page Content Container */}
        <div className="p-5 md:p-6 bg-[#0f172a] text-slate-100 space-y-5">
          {/* Main Card Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              🌟 Контроллер Лестницы
            </h1>
            <span className="text-xs font-mono bg-sky-600 text-white px-2 py-0.5 rounded-full">
              v{config.firmwareVersion || '1.0.0'}
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Ступеней / LED:</span>
              <span className="text-sky-400 font-bold text-sm">{config.stepCount} / {config.stepCount * config.ledsPerStep} шт</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">IP в сети:</span>
              <span className="text-sky-400 font-bold text-sm">192.168.4.1</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Статус Wi-Fi:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <Wifi className="w-3.5 h-3.5" /> Точка Доступа (AP)
              </span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Астрономия / Время:</span>
              <span className="text-amber-300 font-semibold mt-0.5 block">21:40 (🌙 Ночь)</span>
            </div>
          </div>

          {/* Notification Alert Banner */}
          {saveBanner && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveBanner}</span>
            </div>
          )}

          {/* Trigger Section */}
          <div>
            <h2 className="text-sm font-semibold text-sky-400 pb-1 border-b border-slate-800 mb-2.5">
              🚶 Ручной запуск подсветки
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTrigger(true)}
                className="py-2.5 px-3 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 shadow"
              >
                ⬆️ Иду Снизу Вверх
              </button>
              <button
                onClick={() => handleTrigger(false)}
                className="py-2.5 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 shadow"
              >
                ⬇️ Иду Сверху Вниз
              </button>
            </div>
            {statusTriggered && (
              <div className="mt-2 p-2 rounded bg-sky-950/80 border border-sky-800 text-center text-xs text-sky-300">
                {statusTriggered}
              </div>
            )}
          </div>

          {/* Color Section */}
          <div>
            <h2 className="text-sm font-semibold text-sky-400 pb-1 border-b border-slate-800 mb-2.5">
              🎨 Цвет и Яркость
            </h2>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block">Цвет подсветки (WS2812B):</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-14 h-10 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
                />
                <div className="flex-1 flex gap-1.5 overflow-x-auto">
                  {['#ffb450', '#ffffff', '#ffa014', '#38bdf8', '#a855f7', '#10b981'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleColorChange(preset)}
                      className="w-8 h-8 rounded-md border border-slate-700 shrink-0 transition-transform hover:scale-110 active:scale-95"
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Animation Settings */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-sky-400 pb-1 border-b border-slate-800">
              ⚙️ Настройки Анимации
            </h2>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-400">Скорость ступени (мс):</label>
                <span className="font-mono text-sky-400 font-semibold">{animSpeed} мс</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                value={animSpeed}
                onChange={(e) => setAnimSpeed(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-400">Время свечения (сек):</label>
                <span className="font-mono text-sky-400 font-semibold">{holdTime} с</span>
              </div>
              <input
                type="range"
                min="3"
                max="60"
                value={holdTime}
                onChange={(e) => setHoldTime(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-400">Основная яркость (0-255):</label>
                <span className="font-mono text-sky-400 font-semibold">{actBright}</span>
              </div>
              <input
                type="range"
                min="10"
                max="255"
                value={actBright}
                onChange={(e) => setActBright(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Ночной дежурный режим (Standby):</label>
              <select
                value={sbMode}
                onChange={(e) => setSbMode(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-200"
              >
                <option value={0}>0 — Выключен</option>
                <option value={1}>1 — Первая и последняя ступени</option>
                <option value={2}>2 — Все ступени мягко светятся</option>
                <option value={3}>3 — Плавное дыхание</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-400">Яркость ночной подсветки:</label>
                <span className="font-mono text-sky-400 font-semibold">{sbBright}</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={sbBright}
                onChange={(e) => setSbBright(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleSave(false)}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Сохранить параметры подсветки
            </button>
          </div>

          {/* Wi-Fi Settings */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-sky-400 pb-1 border-b border-slate-800">
              📶 Настройки Домашнего Wi-Fi
            </h2>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-400">Имя домашней сети (SSID):</label>
                <button
                  type="button"
                  onClick={scanWifiNetworks}
                  disabled={isScanning}
                  className="px-2 py-0.5 text-[11px] bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Поиск...' : '🔍 Сканировать'}
                </button>
              </div>

              <input
                type="text"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="Имя вашей сети Wi-Fi"
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-200 font-mono"
              />

              {wifiList.length > 0 && (
                <select
                  onChange={(e) => setWifiSsid(e.target.value.split(' ')[0])}
                  className="w-full mt-1.5 bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-300"
                >
                  <option value="">-- Выберите найденную сеть --</option>
                  {wifiList.map((net) => (
                    <option key={net} value={net}>{net}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Пароль от Wi-Fi:</label>
              <input
                type="password"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                placeholder="Пароль от Wi-Fi сети"
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-200"
              />
            </div>

            <button
              onClick={() => handleSave(true)}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow flex items-center justify-center gap-1.5"
            >
              <Wifi className="w-3.5 h-3.5" /> Сохранить Wi-Fi и Перезагрузить ESP32
            </button>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span className="text-[11px] text-slate-400">
              ⚡ Ручная прошивка: <code className="text-sky-400">/update</code>
            </span>
            <button
              onClick={() => {
                setSaveBanner('🔄 ESP32 перезагружается...');
                setTimeout(() => setSaveBanner(null), 3000);
              }}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" /> Перезагрузить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

