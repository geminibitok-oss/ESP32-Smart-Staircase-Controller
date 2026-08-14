import React, { useState } from 'react';
import { MapPin, Navigation, Sun, Moon, Clock, Check, Sparkles } from 'lucide-react';
import { StaircaseConfig } from '../types';
import { calculateSolarTimes } from '../utils/solarCalculator';

export const CITY_PRESETS = [
  { name: 'Борисов, Беларусь', city: 'Борисов', country: 'Беларусь', lat: 54.2276, lon: 28.5052, tz: 3, isDefault: true, flag: '🇧🇾' },
  { name: 'Минск, Беларусь', city: 'Минск', country: 'Беларусь', lat: 53.9006, lon: 27.5590, tz: 3, flag: '🇧🇾' },
  { name: 'Брест, Беларусь', city: 'Брест', country: 'Беларусь', lat: 52.0976, lon: 23.7341, tz: 3, flag: '🇧🇾' },
  { name: 'Гродно, Беларусь', city: 'Гродно', country: 'Беларусь', lat: 53.6884, lon: 23.8258, tz: 3, flag: '🇧🇾' },
  { name: 'Гомель, Беларусь', city: 'Гомель', country: 'Беларусь', lat: 52.4345, lon: 30.9754, tz: 3, flag: '🇧🇾' },
  { name: 'Могилёв, Беларусь', city: 'Могилёв', country: 'Беларусь', lat: 53.8981, lon: 30.3325, tz: 3, flag: '🇧🇾' },
  { name: 'Витебск, Беларусь', city: 'Витебск', country: 'Беларусь', lat: 55.1904, lon: 30.2049, tz: 3, flag: '🇧🇾' },
  { name: 'Москва, Россия', city: 'Москва', country: 'Россия', lat: 55.7558, lon: 37.6173, tz: 3, flag: '🇷🇺' },
  { name: 'Санкт-Петербург', city: 'Санкт-Петербург', country: 'Россия', lat: 59.9343, lon: 30.3351, tz: 3, flag: '🇷🇺' },
  { name: 'Варшава, Польша', city: 'Варшава', country: 'Польша', lat: 52.2297, lon: 21.0122, tz: 2, flag: '🇵🇱' },
  { name: 'Киев, Украина', city: 'Киев', country: 'Украина', lat: 50.4501, lon: 30.5234, tz: 3, flag: '🇺🇦' },
  { name: 'Вильнюс, Литва', city: 'Вильнюс', country: 'Литва', lat: 54.6872, lon: 25.2797, tz: 3, flag: '🇱🇹' },
];

interface LocationPickerProps {
  config: StaircaseConfig;
  onChange: (updated: Partial<StaircaseConfig>) => void;
  compact?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ config, onChange, compact = false }) => {
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState<boolean>(false);

  const solar = calculateSolarTimes(
    config.latitude, 
    config.longitude, 
    config.timezoneOffsetHours, 
    config.sunsetOffsetMinutes, 
    config.sunriseOffsetMinutes
  );

  // Check if current matches a preset
  const matchedPreset = CITY_PRESETS.find(
    (c) => Math.abs(c.lat - config.latitude) < 0.01 && Math.abs(c.lon - config.longitude) < 0.01
  );

  const handleSelectPreset = (preset: typeof CITY_PRESETS[0]) => {
    onChange({
      latitude: preset.lat,
      longitude: preset.lon,
      timezoneOffsetHours: preset.tz
    });
    setGpsError(null);
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Геолокация не поддерживается вашим браузером');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        // Estimate timezone
        const tz = Math.round(lon / 15);
        onChange({
          latitude: lat,
          longitude: lon,
          timezoneOffsetHours: tz
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError('Доступ к геолокации отклонен. Установите координаты вручную.');
      },
      { timeout: 8000 }
    );
  };

  if (compact) {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>Местоположение:</span>
          </label>
          <span className="font-mono text-sky-300 font-semibold">
            {matchedPreset ? `${matchedPreset.flag} ${matchedPreset.city}` : `${config.latitude.toFixed(2)}°, ${config.longitude.toFixed(2)}°`}
          </span>
        </div>

        {/* Quick presets pills */}
        <div className="flex flex-wrap gap-1">
          {CITY_PRESETS.slice(0, 6).map((c) => {
            const isSel = matchedPreset?.city === c.city;
            return (
              <button
                key={c.city}
                onClick={() => handleSelectPreset(c)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  isSel
                    ? 'bg-sky-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {c.flag} {c.city}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Геолокация и Солнечные Координаты
          </span>
        </div>

        {matchedPreset?.isDefault && (
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> По умолчанию: Борисов (Беларусь)
          </span>
        )}
      </div>

      {/* Selected City Highlight Card */}
      <div className="p-3 bg-gradient-to-r from-sky-950/60 to-slate-900 border border-sky-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <div className="text-slate-400 text-[11px]">Текущая выбранная локация:</div>
          <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <span>{matchedPreset ? `${matchedPreset.flag} ${matchedPreset.name}` : '📍 Пользовательские координаты'}</span>
            <span className="text-[11px] font-mono text-sky-300 bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700">
              UTC+{config.timezoneOffsetHours}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            Широта: <strong className="text-slate-200">{config.latitude}° N</strong> • Долгота: <strong className="text-slate-200">{config.longitude}° E</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDetectGps}
            disabled={gpsLoading}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow active:scale-95 disabled:opacity-50"
          >
            <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>{gpsLoading ? 'Определение...' : 'GPS авто-поиск'}</span>
          </button>
        </div>
      </div>

      {gpsError && (
        <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
          {gpsError}
        </div>
      )}

      {/* Preset Cities Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          🌍 Быстрый выбор города (Беларусь и соседние страны):
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {CITY_PRESETS.map((city) => {
            const isSelected = matchedPreset?.city === city.city;
            return (
              <button
                key={city.city}
                onClick={() => handleSelectPreset(city)}
                className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-sky-950 border-sky-500 text-white font-semibold shadow-sm ring-1 ring-sky-500'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span>{city.flag}</span>
                  <span className="truncate">{city.city}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Solar Astronomical Calculated Results for this location */}
      <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-300 font-semibold pb-1 border-b border-slate-800">
          <span className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            Астрономический расчет для {matchedPreset ? matchedPreset.city : 'выбранных координат'}:
          </span>
          <span className="text-[11px] font-mono text-slate-400">Световой день: {solar.dayLengthFormatted}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Рассвет солнца:</span>
            <span className="font-mono text-amber-300 font-bold text-sm">{solar.sunriseFormatted}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Закат солнца:</span>
            <span className="font-mono text-indigo-300 font-bold text-sm">{solar.sunsetFormatted}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Включение подсветки:</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">{solar.turnOnFormatted}</span>
            <span className="text-[9px] text-slate-500">(-30м до заката)</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-500 block">Выключение:</span>
            <span className="font-mono text-slate-300 font-bold text-sm">{solar.turnOffFormatted}</span>
            <span className="text-[9px] text-slate-500">(на рассвете)</span>
          </div>
        </div>
      </div>

      {/* Manual Coordinate Inputs Toggle */}
      <div className="pt-2 border-t border-slate-800/80">
        <button
          onClick={() => setCustomMode(!customMode)}
          className="text-xs text-sky-400 hover:text-sky-300 underline font-medium"
        >
          {customMode ? '▲ Скрыть ручной ввод координат' : '▼ Точная ручная настройка координат и часового пояса'}
        </button>

        {customMode && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Широта (Latitude, °N)</label>
              <input
                type="number"
                step="0.0001"
                value={config.latitude}
                onChange={(e) => onChange({ latitude: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Долгота (Longitude, °E)</label>
              <input
                type="number"
                step="0.0001"
                value={config.longitude}
                onChange={(e) => onChange({ longitude: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Смещение пояса (UTC, часы)</label>
              <input
                type="number"
                min="-12"
                max="14"
                value={config.timezoneOffsetHours}
                onChange={(e) => onChange({ timezoneOffsetHours: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300"
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
