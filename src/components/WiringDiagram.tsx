import React, { useState } from 'react';
import { Cpu, Zap, ShieldAlert, CheckCircle2, Sliders, Info } from 'lucide-react';
import { StaircaseConfig } from '../types';

interface WiringDiagramProps {
  config: StaircaseConfig;
}

export const WiringDiagram: React.FC<WiringDiagramProps> = ({ config }) => {
  const [highlightedPin, setHighlightedPin] = useState<number | null>(null);

  const totalLeds = config.stepCount * config.ledsPerStep;
  // Maximum current at 100% white is 0.06A per LED. Typical warm white mix is ~0.035A per LED.
  const maxCurrentAmps = (totalLeds * 0.06).toFixed(1);
  const typicalCurrentAmps = (totalLeds * 0.035).toFixed(1);
  const powerWatts = (Number(maxCurrentAmps) * 5).toFixed(0);
  const recommendedPsuAmps = Math.ceil(Number(maxCurrentAmps) * 1.25); // +25% safety headroom

  return (
    <div id="wiring-diagram-card" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            Схема подключения и расчет питания (Hardware & Wiring)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Подключение адресной ленты WS2812B, датчиков движения PIR к плате ESP32 DevKit V1
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-indigo-950/80 text-indigo-300 border border-indigo-800 rounded-lg">
            ESP32 DevKit V1 (30 pins)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Left Column: Visual Pinout & Connection List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            Назначение выводов (Pin Mapping)
          </h3>

          <div className="space-y-2.5">
            {/* LED Data Pin */}
            <div 
              onMouseEnter={() => setHighlightedPin(config.ledPin)}
              onMouseLeave={() => setHighlightedPin(null)}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-amber-400 text-xs">
                  G{config.ledPin}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                    WS2812B Data In (Сигнал ленты)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Через резистор 330–470 Ом к первой ступени (DIN)
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                GPIO {config.ledPin}
              </span>
            </div>

            {/* Bottom Motion Sensor */}
            <div 
              onMouseEnter={() => setHighlightedPin(config.bottomSensorPin)}
              onMouseLeave={() => setHighlightedPin(null)}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-emerald-400 text-xs">
                  G{config.bottomSensorPin}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    Нижний датчик движения (СНИЗУ)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Сигнальный провод OUT от датчика PIR (HC-SR501 / RCWL-0516)
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                GPIO {config.bottomSensorPin}
              </span>
            </div>

            {/* Top Motion Sensor */}
            <div 
              onMouseEnter={() => setHighlightedPin(config.topSensorPin)}
              onMouseLeave={() => setHighlightedPin(null)}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-red-500/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center font-mono font-bold text-red-400 text-xs">
                  G{config.topSensorPin}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-red-300 transition-colors">
                    Верхний датчик движения (СВЕРХУ)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Сигнальный провод OUT от верхнего датчика движения
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-red-300">
                GPIO {config.topSensorPin}
              </span>
            </div>

            {/* Power & Ground */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-mono font-bold text-sky-400 text-xs">
                  5V/GND
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    Питание ESP32 и ленты (+5V & GND)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Общая земля (Common GND) обязательна для ESP32 и БП
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                VIN / GND
              </span>
            </div>
          </div>

          {/* Important Schematic Hints */}
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs space-y-2 text-amber-200/90">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Важные правила долговечности оборудования:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/80 ml-1">
              <li>Установите конденсатор <strong>1000 мкФ 6.3V/10V</strong> прямо на клеммы питания ленты для сглаживания бросков напряжения.</li>
              <li>Резистор <strong>330–470 Ом</strong> на проводе данных (GPIO {config.ledPin}) защитит первый диод ленты от пробоя.</li>
              <li>При длине лестницы более 10 ступеней подавайте питание 5V с обоих концов ленты (или параллельной шиной).</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Power Consumption Calculator (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950/80 rounded-xl border border-slate-800 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              Калькулятор блока питания 5V
            </h3>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Всего светодиодов:</div>
                <div className="text-lg font-bold font-mono text-white mt-0.5">
                  {totalLeds} <span className="text-xs font-normal text-slate-400">LED</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  ({config.stepCount} ступ. × {config.ledsPerStep} шт)
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Пиковая мощность:</div>
                <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                  ~{powerWatts} <span className="text-xs font-normal text-slate-400">Вт</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  при 100% белом цвете
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Типовой ток (Warm):</div>
                <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
                  {typicalCurrentAmps} <span className="text-xs font-normal text-slate-400">А</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  при теплом свечении
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-800/60">
                <div className="text-[11px] text-indigo-300">Рекомендуемый БП:</div>
                <div className="text-lg font-bold font-mono text-indigo-200 mt-0.5">
                  5V {recommendedPsuAmps}A
                </div>
                <div className="text-[10px] text-indigo-400 mt-1">
                  с запасом 25%
                </div>
              </div>
            </div>

            {/* Bill of Materials / Suggested Sensors */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-semibold text-slate-300">
                Рекомендуемые комплектующие (BOM):
              </span>

              <div className="text-[11px] space-y-1.5 text-slate-400">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>ESP32 DevKit V1:</strong> 30-pin или 38-pin (Wi-Fi + BLE).</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Лента WS2812B:</strong> IP30 (в профиль) или IP65, плотность 60 led/m.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Датчики:</strong> PIR HC-SR501 (инфракрасный) или микроволновый RCWL-0516 (скрытый монтаж за плинтусом).</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Сечение питающего провода:</strong> ШВВП 2x0.75 мм² или 2x1.0 мм².</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
