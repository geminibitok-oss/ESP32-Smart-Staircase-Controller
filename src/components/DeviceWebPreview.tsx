import React, { useState } from 'react';
import { Smartphone, Zap, Wifi, RefreshCw, Save, Sliders, CheckCircle2, RotateCcw, HelpCircle, Sun, Moon, MapPin, Play, Layers, Compass, Upload, FileCode2, Terminal } from 'lucide-react';
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
  const [activeWebTab, setActiveWebTab] = useState<'control' | 'stairs' | 'wifi' | 'solar' | 'ota'>('control');
  
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
  const [uploadedFileName, setUploadedFileName] = useState<string>('firmware.bin');

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
      setWifiList(['Moy_Domashniy_WiFi (2.4G) -48dBm', 'Keenetic-9431 -65dBm', 'TP-Link_Guest -78dBm']);
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
    setSaveBanner(reboot ? '✅ Настройки Wi-Fi сохранены! Имитация перезагрузки ESP32...' : '✅ Параметры подсветки успешно сохранены в Flash-память!');
    setTimeout(() => setSaveBanner(null), 3500);
  };

  return (
    <div id="device-web-preview" className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            Интерактивный Веб-Интерфейс ESP32 (Разделение по вкладкам)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Точная копия страницы встроенного сервера <code className="text-sky-400 font-mono">http://192.168.4.1</code> с переключением вкладок
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-sky-950/80 text-sky-300 border border-sky-800 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            ESPAsyncWebServer Port 80
          </span>
        </div>
      </div>

      {/* Quick Guide Card: Which File to Flash */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-sky-950/60 border border-indigo-500/30">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <span>❓ Ручная прошивка: какой файл выбирать?</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Инструкция
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-slate-300">
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-sky-400 font-bold block mb-1">🌐 Через Web-интерфейс (OTA по Wi-Fi):</span>
                Выбирайте файл <code className="text-amber-300 font-bold font-mono">firmware.bin</code> (или <code className="text-amber-300 font-mono">StairsEsp.ino.bin</code>). Загружается на вкладке «⚡ Прошивка (OTA)» или по адресу <code className="text-sky-300 font-mono">/update</code>.
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-amber-400 font-bold block mb-1">🔌 По USB кабелю (flash_windows.bat):</span>
                Запустите <code className="text-amber-300 font-mono">flash_windows.bat</code> — скрипт сам найдет <code className="text-sky-300 font-mono">firmware.bin</code> и прошьет со смещением <code className="text-emerald-400 font-mono">0x10000</code>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Device Screen Container */}
      <div className="max-w-lg mx-auto bg-[#0f172a] rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden">
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
        <div className="p-5 md:p-6 bg-[#0f172a] text-slate-100 space-y-4">
          {/* Main Card Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-amber-400 flex items-center gap-2">
              🌟 Контроллер Лестницы
            </h1>
            <span className="text-xs font-mono bg-sky-600 text-white px-2 py-0.5 rounded-full font-bold">
              v{config.firmwareVersion || '1.0.4'}
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Ступеней / LED:</span>
              <span className="text-sky-400 font-bold text-sm">{config.stepCount} / {config.stepCount * config.ledsPerStep} шт</span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">IP в сети:</span>
              <span className="text-sky-400 font-bold text-sm">192.168.4.1</span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Статус Wi-Fi:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <Wifi className="w-3.5 h-3.5" /> Точка Доступа (AP)
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Солнце / Время:</span>
              <span className="text-amber-300 font-semibold mt-0.5 block">21:40 (🌙 Ночь)</span>
            </div>
          </div>

          {/* ESP32 Tabs Navigation Bar */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
            {[
              { id: 'control', label: '🎮 Управление' },
              { id: 'stairs', label: '🪜 Лестница' },
              { id: 'wifi', label: '📶 Wi-Fi' },
              { id: 'solar', label: '☀️ Солнце' },
              { id: 'ota', label: '⚡ OTA' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveWebTab(t.id as any)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all text-center ${
                  activeWebTab === t.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Notification Alert Banner */}
          {saveBanner && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveBanner}</span>
            </div>
          )}

          {/* TAB 1: Управление и эффекты */}
          {activeWebTab === 'control' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Trigger Section */}
              <div>
                <h2 className="text-xs font-semibold text-sky-400 pb-1 border-b border-slate-800 mb-2">
                  🚶 Ручной запуск подсветки
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTrigger(true)}
                    className="py-2 px-3 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 shadow"
                  >
                    ⬆️ Иду Снизу Вверх
                  </button>
                  <button
                    onClick={() => handleTrigger(false)}
                    className="py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 shadow"
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

              {/* Lighting Effects Mode Selection */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">
                  ✨ Световой Эффект Включения:
                </label>
                <select
                  value={config.effectMode || 'wave_cascade'}
                  onChange={(e) => onConfigUpdate && onConfigUpdate({ effectMode: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-sky-300 font-semibold"
                >
                  <option value="wave_cascade">🌊 Каскадная волна (Классика)</option>
                  <option value="smooth_fade_all">💡 Плавный розжиг всех ступеней</option>
                  <option value="curtain_fill">🎭 Театральный занавес (Шторка)</option>
                  <option value="center_spread">↔️ Из центра к краям (Симметрия)</option>
                  <option value="meteor_chase">☄️ Метеорный шлейф (Бегущий огонь)</option>
                  <option value="firefly_sparkle">✨ Светлячки (Мягкое мерцание)</option>
                  <option value="rainbow_flow">🌈 Радужный перелив (RGB эффект)</option>
                </select>
              </div>

              {/* Color Section */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Цвет подсветки (WS2812B):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-12 h-9 rounded-lg border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
                  />
                  <div className="flex-1 flex gap-1.5 overflow-x-auto">
                    {['#ffb450', '#ffffff', '#ffa014', '#38bdf8', '#a855f7', '#10b981'].map((preset) => (
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

              {/* Quick Brightness Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="text-slate-400">Основная яркость (10-255):</label>
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

              <button
                onClick={() => handleSave(false)}
                className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Применить параметры
              </button>
            </div>
          )}

          {/* TAB 2: Настройки ступеней */}
          {activeWebTab === 'stairs' && (
            <div className="space-y-3.5 animate-fadeIn">
              <h2 className="text-xs font-semibold text-sky-400 pb-1 border-b border-slate-800">
                🪜 Конфигурация ступеней
              </h2>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Количество ступеней:</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={config.stepCount}
                    onChange={(e) => onConfigUpdate && onConfigUpdate({ stepCount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Диодов на ступень:</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={config.ledsPerStep}
                    onChange={(e) => onConfigUpdate && onConfigUpdate({ ledsPerStep: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <h2 className="text-xs font-semibold text-sky-400 pb-1 border-b border-slate-800">
                ⏱️ Скорость и Тайминги
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
                  <label className="text-slate-400">Время свечения после прохода:</label>
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

              <h2 className="text-xs font-semibold text-sky-400 pb-1 border-b border-slate-800">
                🌙 Ночной дежурный режим (Standby)
              </h2>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Тип дежурной подсветки:</label>
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
                  <label className="text-slate-400">Яркость ночной подсветки (5-100):</label>
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
                <Save className="w-3.5 h-3.5" /> Сохранить параметры ступеней
              </button>
            </div>
          )}

          {/* TAB 3: Wi-Fi и Сеть */}
          {activeWebTab === 'wifi' && (
            <div className="space-y-3.5 animate-fadeIn">
              <h2 className="text-xs font-semibold text-sky-400 pb-1 border-b border-slate-800">
                📶 Подключение к домашней сети Wi-Fi
              </h2>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                ESP32 подключится к вашей домашней сети. Если роутер недоступен, плата поднимет резервную точку доступа <strong className="text-sky-300">ESP32-Staircase-Setup</strong> (IP: 192.168.4.1, пароль: 12345678).
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400">Имя сети (SSID):</label>
                  <button
                    type="button"
                    onClick={scanWifiNetworks}
                    disabled={isScanning}
                    className="px-2 py-0.5 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-sky-300 flex items-center gap-1 border border-slate-700"
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
          )}

          {/* TAB 4: Солнце и Астрономия */}
          {activeWebTab === 'solar' && (
            <div className="space-y-3.5 animate-fadeIn">
              <h2 className="text-xs font-semibold text-amber-400 pb-1 border-b border-slate-800">
                ☀️ Астрономический расчет заката и рассвета
              </h2>

              <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  г. Борисов, Беларусь
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <div>• <strong>Координаты:</strong> 54.2276° N, 28.5052° E</div>
                  <div>• <strong>Часовой пояс:</strong> UTC+3 (Minsk / Moscow)</div>
                  <div>• <strong>Включение:</strong> Автоматически за 30 минут до захода солнца</div>
                  <div>• <strong>Выключение:</strong> На рассвете</div>
                  <div>• <strong>Синхронизация:</strong> NTP pool.ntp.org</div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">Режим прямо сейчас:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5" /> 🌙 Ночной режим АКТИВЕН
                </span>
              </div>
            </div>
          )}

          {/* TAB 5: Прошивка и OTA */}
          {activeWebTab === 'ota' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Detailed File Choice Guide */}
              <div className="p-3 bg-indigo-950/80 rounded-xl border border-indigo-700/60 text-xs text-indigo-200 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-sky-300" />
                  КАКОЙ ФАЙЛ ВЫБИРАТЬ ДЛЯ ПРОШИВКИ?
                </div>
                <div className="text-[11px] space-y-1 text-slate-200">
                  <p>• <strong>Для этой формы (Web OTA):</strong> выберите <code className="bg-indigo-900 px-1 rounded text-amber-300 font-bold">firmware.bin</code> (или <code className="bg-indigo-900 px-1 rounded text-amber-300">StairsEsp.ino.bin</code>).</p>
                  <p>• <strong>Для прошивки по USB (flash_windows.bat):</strong> файл <code className="bg-indigo-900 px-1 rounded text-sky-300 font-bold">firmware.bin</code> с адресом <code className="text-emerald-300 font-mono">0x10000</code>.</p>
                  <p>• <strong>С нуля (новая плата):</strong> 3 файла (<code className="text-slate-300">bootloader 0x1000</code>, <code className="text-slate-300">partitions 0x8000</code>, <code className="text-slate-300">firmware 0x10000</code>).</p>
                </div>
              </div>

              {/* Local File Upload Form */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  📁 Ручная загрузка .bin файла с компьютера:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".bin"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadedFileName(e.target.files[0].name);
                      }
                    }}
                    className="text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSaveBanner(`🚀 Прошивка файла ${uploadedFileName} по Wi-Fi... (100%). Перезагрузка ESP32...`);
                    setTimeout(() => {
                      setSaveBanner(`✅ Прошивка успешно обновлена! ESP32 перезагрузился.`);
                    }, 3000);
                    setTimeout(() => setSaveBanner(null), 6000);
                  }}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> 🚀 Загрузить и прошить {uploadedFileName}
                </button>
              </div>

              {/* GitHub Releases OTA */}
              <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-900/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Обновление с GitHub Releases:</span>
                  <span className="font-mono text-purple-300 font-bold">v{config.firmwareVersion || '1.0.4'}</span>
                </div>
                <select
                  value={config.firmwareVersion || '1.0.4'}
                  onChange={(e) => onConfigUpdate && onConfigUpdate({ firmwareVersion: e.target.value })}
                  className="w-full bg-slate-900 border border-purple-700/60 rounded-lg p-2 text-xs text-purple-200 font-mono"
                >
                  <option value="1.0.4">v1.0.4 (Последний релиз — Борисов, эффекты, мастер .bat)</option>
                  <option value="1.0.3">v1.0.3 (Стабильная сборка)</option>
                  <option value="1.0.2">v1.0.2 (Астрономический расчет заката)</option>
                  <option value="1.0.0">v1.0.0 (Базовая версия)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSaveBanner(`🚀 Запущено OTA-обновление прошивки с GitHub Releases... Скачивание firmware.bin (100%)...`);
                    setTimeout(() => {
                      setSaveBanner(`✅ Прошивка успешно обновлена до v${config.firmwareVersion || '1.0.4'}!`);
                    }, 2500);
                    setTimeout(() => setSaveBanner(null), 5500);
                  }}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 🌐 Обновить по Wi-Fi с GitHub
                </button>
              </div>
            </div>
          )}

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
