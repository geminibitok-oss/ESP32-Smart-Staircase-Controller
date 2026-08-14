import React from 'react';
import { Sliders, MapPin, Wifi, GitBranch, Sparkles, Cpu, Eye } from 'lucide-react';
import { StaircaseConfig } from '../types';
import { LocationPicker } from './LocationPicker';

interface ConfigPanelProps {
  config: StaircaseConfig;
  onChange: (updated: Partial<StaircaseConfig>) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange }) => {
  return (
    <div id="config-panel" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Параметры лестницы, датчиков, заката и GitHub OTA
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Изменяйте параметры здесь — код прошивки, схемы и тайминги обновляются моментально
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1 bg-slate-800 text-amber-300 border border-slate-700 rounded-lg">
          Всего диодов: {config.stepCount * config.ledsPerStep} шт
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1. Hardware & Physical Layout */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800/80">
            <Cpu className="w-4 h-4" />
            1. Физическая конструкция и пины
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">
                Количество ступеней: <span className="text-amber-400 font-bold font-mono">{config.stepCount}</span>
              </label>
              <input
                type="range"
                min="4"
                max="24"
                value={config.stepCount}
                onChange={(e) => onChange({ stepCount: Number(e.target.value) })}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">
                Диодов на одну ступень: <span className="text-amber-400 font-bold font-mono">{config.ledsPerStep}</span>
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

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">LED Data Pin</label>
                <input
                  type="number"
                  value={config.ledPin}
                  onChange={(e) => onChange({ ledPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-amber-300"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Нижний PIR</label>
                <input
                  type="number"
                  value={config.bottomSensorPin}
                  onChange={(e) => onChange({ bottomSensorPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Верхний PIR</label>
                <input
                  type="number"
                  value={config.topSensorPin}
                  onChange={(e) => onChange({ topSensorPin: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-red-300"
                />
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
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Начальная версия</label>
                <input
                  type="text"
                  value={config.firmwareVersion}
                  onChange={(e) => onChange({ firmwareVersion: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-mono text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Animation & Visual Effects Bar */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 pb-2 mb-3 border-b border-slate-800/80">
          <Sparkles className="w-4 h-4" />
          4. Световые эффекты, цветовая температура и тайминги задержки
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">
              Скорость волны: <span className="text-emerald-400 font-bold font-mono">{config.stepSpeedMs} мс/ступень</span>
            </label>
            <input
              type="range"
              min="30"
              max="400"
              step="10"
              value={config.stepSpeedMs}
              onChange={(e) => onChange({ stepSpeedMs: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">
              Время удержания: <span className="text-emerald-400 font-bold font-mono">{config.holdTimeSec} сек</span>
            </label>
            <input
              type="range"
              min="3"
              max="30"
              value={config.holdTimeSec}
              onChange={(e) => onChange({ holdTimeSec: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1">
              Яркость подсветки: <span className="text-amber-400 font-bold font-mono">{Math.round((config.activeBrightness / 255) * 100)}%</span>
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
