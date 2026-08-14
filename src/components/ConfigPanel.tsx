import React from 'react';
import { Sliders, MapPin, Wifi, GitBranch, Sparkles, Cpu, Eye, Wand2, Zap, ArrowDownUp } from 'lucide-react';
import { StaircaseConfig, LightingEffectMode } from '../types';
import { LocationPicker } from './LocationPicker';

interface ConfigPanelProps {
  config: StaircaseConfig;
  onChange: (updated: Partial<StaircaseConfig>) => void;
}

// Available ESP32 GPIOs safe for outputs/inputs
const SAFE_OUTPUT_PINS = [
  { pin: 16, desc: 'GPIO 16 (Рекомендуется для WS2812B Data)' },
  { pin: 18, desc: 'GPIO 18 (VSPI SCK / Резерв Data)' },
  { pin: 19, desc: 'GPIO 19 (VSPI MISO)' },
  { pin: 21, desc: 'GPIO 21 (I2C SDA)' },
  { pin: 22, desc: 'GPIO 22 (I2C SCL)' },
  { pin: 23, desc: 'GPIO 23 (VSPI MOSI)' },
  { pin: 4,  desc: 'GPIO 4 (D4 / Touch 0)' },
  { pin: 5,  desc: 'GPIO 5 (VSPI CS0)' },
  { pin: 17, desc: 'GPIO 17 (TX2)' },
  { pin: 25, desc: 'GPIO 25 (DAC1)' },
  { pin: 26, desc: 'GPIO 26 (DAC2)' },
  { pin: 27, desc: 'GPIO 27 (Touch 7)' },
  { pin: 32, desc: 'GPIO 32 (Touch 9)' },
  { pin: 33, desc: 'GPIO 33 (Touch 8)' },
];

const SAFE_INPUT_PINS = [
  { pin: 19, desc: 'GPIO 19 (Рекомендуется для Нижнего PIR)' },
  { pin: 18, desc: 'GPIO 18 (Рекомендуется для Верхнего PIR)' },
  { pin: 17, desc: 'GPIO 17' },
  { pin: 16, desc: 'GPIO 16' },
  { pin: 21, desc: 'GPIO 21' },
  { pin: 22, desc: 'GPIO 22' },
  { pin: 23, desc: 'GPIO 23' },
  { pin: 25, desc: 'GPIO 25' },
  { pin: 26, desc: 'GPIO 26' },
  { pin: 27, desc: 'GPIO 27' },
  { pin: 32, desc: 'GPIO 32' },
  { pin: 33, desc: 'GPIO 33' },
  { pin: 34, desc: 'GPIO 34 (Только вход / Input only)' },
  { pin: 35, desc: 'GPIO 35 (Только вход / Input only)' },
  { pin: 36, desc: 'GPIO 36 / VP (Только вход)' },
  { pin: 39, desc: 'GPIO 39 / VN (Только вход)' },
];

export const LIGHTING_EFFECTS: { id: LightingEffectMode; name: string; desc: string; icon: string }[] = [
  {
    id: 'wave_cascade',
    name: 'Пошаговая волна (Каскад)',
    desc: 'Классическое поочередное зажигание ступеней друг за другом по ходу шага',
    icon: '🌊'
  },
  {
    id: 'smooth_fade_all',
    name: 'Плавный рассвет (Fade All)',
    desc: 'Все ступени одновременно плавно разгораются от 0% до 100% яркости',
    icon: '✨'
  },
  {
    id: 'curtain_fill',
    name: 'Шторка / Заполнение диодов',
    desc: 'Каждая ступень разворачивается от края к краю (бегущая линия диодов)',
    icon: '↔️'
  },
  {
    id: 'center_spread',
    name: 'Волна из центра / К центру',
    desc: 'Свет расходится из середины лестницы к краям при срабатывании',
    icon: '🌟'
  },
  {
    id: 'meteor_chase',
    name: 'Метеорный след (Meteor)',
    desc: 'Яркий световой импульс с затухающим хвостом пробегает по ступеням',
    icon: '☄️'
  },
  {
    id: 'firefly_sparkle',
    name: 'Мерцающие светлячки',
    desc: 'Мягкое органическое мерцание диодов с плавным переходом в полный свет',
    icon: '💡'
  },
  {
    id: 'rainbow_flow',
    name: 'Радужный перелив (Spectrum)',
    desc: 'Динамическая волна спектра цветов по длине всей лестницы',
    icon: '🌈'
  }
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange }) => {
  return (
    <div id="config-panel" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Параметры лестницы, пинов ESP32, эффектов и заката
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Настройте подключение ленты WS2812B, датчиков к GPIO и выберите визуальный эффект включения
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1 bg-slate-800 text-amber-300 border border-slate-700 rounded-lg">
          Всего диодов: {config.stepCount * config.ledsPerStep} шт (5V ~{(config.stepCount * config.ledsPerStep * 0.035).toFixed(1)}A)
        </div>
      </div>

      {/* Visual Lighting Effect Selector Box */}
      <div className="bg-slate-950/90 p-4 md:p-5 rounded-xl border-2 border-amber-500/30 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Wand2 className="w-4 h-4 text-amber-400" />
            Эффект включения лестницы при срабатывании датчика:
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            {LIGHTING_EFFECTS.find(e => e.id === config.effectMode)?.name || 'Пошаговая волна'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {LIGHTING_EFFECTS.map((eff) => {
            const isSelected = (config.effectMode || 'wave_cascade') === eff.id;
            return (
              <button
                key={eff.id}
                onClick={() => onChange({ effectMode: eff.id })}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-400' 
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start gap-2.5 mb-1.5">
                  <span className="text-xl shrink-0">{eff.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      {eff.name}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
                      {eff.desc}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="text-[10px] font-mono text-amber-400 font-bold self-end mt-1">
                    ✓ Активен
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of 3 Main Setup Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1. Hardware & Physical Layout + PIN SELECTION */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800/80">
            <Cpu className="w-4 h-4" />
            1. Подключение к пинам ESP32 (GPIO)
          </div>

          <div className="space-y-3 text-xs">
            {/* Step Count and LEDs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">
                  Ступеней: <span className="text-amber-400 font-bold font-mono">{config.stepCount}</span>
                </label>
                <input
                  type="range"
                  min="4"
                  max="32"
                  value={config.stepCount}
                  onChange={(e) => onChange({ stepCount: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  LED/ступень: <span className="text-amber-400 font-bold font-mono">{config.ledsPerStep}</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={config.ledsPerStep}
                  onChange={(e) => onChange({ ledsPerStep: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>

            {/* GPIO PIN SELECTORS: LED Data, Bottom Sensor, Top Sensor */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              
              {/* LED Strip Data Pin Selector */}
              <div>
                <label className="text-slate-300 flex items-center justify-between mb-1">
                  <span className="text-amber-400 font-semibold">🔴 Пин ленты WS2812B (Data):</span>
                  <span className="font-mono text-amber-300 font-bold">GPIO {config.ledPin}</span>
                </label>
                <select
                  value={config.ledPin}
                  onChange={(e) => onChange({ ledPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                >
                  {SAFE_OUTPUT_PINS.map((p) => (
                    <option key={p.pin} value={p.pin}>
                      {p.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bottom Motion Sensor Pin */}
              <div>
                <label className="text-slate-300 flex items-center justify-between mb-1">
                  <span className="text-emerald-400 font-semibold">🟢 Нижний датчик движения (PIR/Radar):</span>
                  <span className="font-mono text-emerald-300 font-bold">GPIO {config.bottomSensorPin}</span>
                </label>
                <select
                  value={config.bottomSensorPin}
                  onChange={(e) => onChange({ bottomSensorPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
                >
                  {SAFE_INPUT_PINS.map((p) => (
                    <option key={p.pin} value={p.pin}>
                      {p.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top Motion Sensor Pin */}
              <div>
                <label className="text-slate-300 flex items-center justify-between mb-1">
                  <span className="text-sky-400 font-semibold">🔵 Верхний датчик движения (PIR/Radar):</span>
                  <span className="font-mono text-sky-300 font-bold">GPIO {config.topSensorPin}</span>
                </label>
                <select
                  value={config.topSensorPin}
                  onChange={(e) => onChange({ topSensorPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-sky-500/50 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-mono focus:outline-none focus:border-sky-400"
                >
                  {SAFE_INPUT_PINS.map((p) => (
                    <option key={p.pin} value={p.pin}>
                      {p.desc}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* 2. Solar & Astronomical Schedule */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 pb-1 border-b border-slate-800/80">
            <MapPin className="w-4 h-4" />
            2. Солнечное расписание (Закат / Рассвет)
          </div>

          <LocationPicker compact config={config} onChange={onChange} />

          <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Смещение включения:</span>
              <span className="text-emerald-400 font-semibold font-mono">За 30 мин до заката</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Смещение выключения:</span>
              <span className="text-slate-300 font-semibold font-mono">В момент рассвета</span>
            </div>
          </div>
        </div>

        {/* 3. GitHub CI/CD & OTA Settings */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400 pb-1 border-b border-slate-800/80">
            <GitBranch className="w-4 h-4" />
            3. GitHub Репозиторий и OTA по Wi-Fi
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Ваш GitHub Username</label>
              <input
                type="text"
                placeholder="your-username"
                value={config.githubUsername}
                onChange={(e) => onChange({ githubUsername: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Название репозитория</label>
              <input
                type="text"
                placeholder="esp32-stairs-lighting"
                value={config.githubRepo}
                onChange={(e) => onChange({ githubRepo: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Версия прошивки (Выбор из GitHub Releases):</label>
              <select
                value={config.firmwareVersion || '1.0.4'}
                onChange={(e) => onChange({ firmwareVersion: e.target.value })}
                className="w-full bg-slate-900 border border-purple-500/50 rounded-md px-2 py-1.5 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-400"
              >
                <option value="1.0.4">v1.0.4 (Последняя стабильная сборка)</option>
                <option value="1.0.3">v1.0.3</option>
                <option value="1.0.2">v1.0.2</option>
                <option value="1.0.0">v1.0.0</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Опрос OTA (мин)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={config.otaCheckIntervalMinutes}
                  onChange={(e) => onChange({ otaCheckIntervalMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={config.enableAutoOta}
                    onChange={(e) => onChange({ enableAutoOta: e.target.checked })}
                    className="accent-purple-500 rounded"
                  />
                  <span>Включить Auto-OTA</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Animation & Visual Effects Bar */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 pb-2 mb-3 border-b border-slate-800/80">
          <Sparkles className="w-4 h-4" />
          4. Тайминги, скорость переключения и яркость
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">
              Скорость анимации: <span className="text-emerald-400 font-bold font-mono">{config.stepSpeedMs} мс</span>
            </label>
            <input
              type="range"
              min="20"
              max="350"
              step="10"
              value={config.stepSpeedMs}
              onChange={(e) => onChange({ stepSpeedMs: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">
              Время свечения (Hold): <span className="text-emerald-400 font-bold font-mono">{config.holdTimeSec} сек</span>
            </label>
            <input
              type="range"
              min="3"
              max="45"
              value={config.holdTimeSec}
              onChange={(e) => onChange({ holdTimeSec: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">
              Яркость подсветки: <span className="text-amber-400 font-bold font-mono">{Math.round((config.activeBrightness / 255) * 100)}% ({config.activeBrightness})</span>
            </label>
            <input
              type="range"
              min="20"
              max="255"
              value={config.activeBrightness}
              onChange={(e) => onChange({ activeBrightness: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">Дежурный ночник:</label>
            <select
              value={config.standbyMode}
              onChange={(e) => onChange({ standbyMode: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200"
            >
              <option value="edge_steps">Крайние ступени (1-я и последняя)</option>
              <option value="all_dim">Все ступени на 5% яркости</option>
              <option value="breathing">Мягкое дыхание (Pulse)</option>
              <option value="off">Полностью выключено</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
