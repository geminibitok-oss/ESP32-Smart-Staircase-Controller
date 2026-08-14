import React, { useState } from 'react';
import { GitPullRequest, CloudUpload, Radio, Wifi, ArrowRight, ShieldCheck, CheckCircle, Terminal, HelpCircle } from 'lucide-react';
import { StaircaseConfig } from '../types';

interface GitHubWorkflowGuideProps {
  config: StaircaseConfig;
}

export const GitHubWorkflowGuide: React.FC<GitHubWorkflowGuideProps> = ({ config }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  return (
    <div id="github-guide" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-purple-400" />
            Инструкция: GitHub CI/CD & Автоматические OTA-обновления
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Как загрузить код на GitHub, запускать авто-сборку с увеличением версии и обновлять ESP32 по Wi-Fi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-purple-950/80 text-purple-300 border border-purple-800 rounded-lg">
            GitHub Actions + PlatformIO + OTA
          </span>
        </div>
      </div>

      {/* Step Pipeline Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
        {[
          {
            step: 1,
            title: '1. Создание репозитория',
            desc: 'Инициализация git и отправка файлов',
            icon: CloudUpload,
          },
          {
            step: 2,
            title: '2. GitHub Actions Сборка',
            desc: 'Авто-инкремент версий и firmware.bin',
            icon: Terminal,
          },
          {
            step: 3,
            title: '3. Создание Релиза',
            desc: 'version.json + бинарник в Releases',
            icon: ShieldCheck,
          },
          {
            step: 4,
            title: '4. ESP32 OTA по Wi-Fi',
            desc: 'Микроконтроллер обновляется сам',
            icon: Wifi,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isCurrent = activeStep === item.step;

          return (
            <button
              key={item.step}
              onClick={() => setActiveStep(item.step)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isCurrent
                  ? 'bg-purple-950/70 border-purple-500 shadow-md shadow-purple-950/50 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-purple-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isCurrent ? 'bg-purple-900 text-purple-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  ШАГ {item.step}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-100">{item.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Step Detailed View */}
      <div className="mt-5 p-5 bg-slate-950/90 rounded-xl border border-slate-800 text-slate-300 space-y-4">
        {activeStep === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-purple-400" />
              Шаг 1: Загрузка репозитория на GitHub (через AI Studio или вручную)
            </h3>
            
            <div className="space-y-3">
              <div className="p-3.5 bg-gradient-to-r from-purple-950/80 to-slate-900 border border-purple-800/60 rounded-xl text-xs space-y-2">
                <div className="font-semibold text-purple-200 flex items-center gap-1.5">
                  ✨ <strong>Способ А: Загрузка напрямую через Google AI Studio</strong>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  В правом верхнем углу интерфейса Google AI Studio откройте меню настроек проекта (иконка <strong>шестеренки ⚙️ / Export</strong>) и выберите <strong>«Export to GitHub»</strong> (или «Push to GitHub»). AI Studio автоматически создаст репозиторий и загрузит все файлы!
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="font-semibold text-slate-200">
                  📁 <strong>Способ Б: Скачать ZIP и загрузить через Git CLI</strong>
                </div>
                <p className="text-slate-400">
                  Скачайте архив проекта кнопкой <strong>"Скачать весь проект (.ZIP)"</strong> выше, распакуйте его и отправьте командами:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-sky-300 space-y-1 overflow-x-auto border border-slate-800">
                  <div>git init</div>
                  <div>git add .</div>
                  <div>git commit -m "Initial commit: ESP32 Smart Staircase Controller"</div>
                  <div>git branch -M main</div>
                  <div>git remote add origin https://github.com/{config.githubUsername || 'YOUR_USERNAME'}/{config.githubRepo || 'esp32-stairs-lighting'}.git</div>
                  <div>git push -u origin main</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-xs text-indigo-200">
              💡 <strong>Совет:</strong> Сделайте репозиторий <strong>Public</strong>, чтобы ESP32 мог бесплатно скачивать файл <code className="font-mono text-indigo-300">version.json</code> и <code className="font-mono text-indigo-300">firmware.bin</code> без приватных токенов!
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              Шаг 2: Автоматическая сборка в GitHub Actions (Arduino CLI + FastLED)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              При каждом вашем <code className="font-mono text-purple-300">git push</code> файл рабочего процесса <code className="font-mono text-sky-300">.github/workflows/build_and_release.yml</code> запускает облачный раннер Ubuntu:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-slate-200 mb-1">1. Версионирование</div>
                <div className="text-[11px] text-slate-400">
                  Вычисляет версию <code className="font-mono text-purple-400">v1.0.${'{'}BUILD_NUM{'}'}</code> и генерирует заголовочный файл <code className="font-mono text-purple-300">version.h</code>.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-slate-200 mb-1">2. Компиляция Arduino CLI</div>
                <div className="text-[11px] text-slate-400">
                  Собирает скетч <code className="font-mono text-sky-400">StairsEsp.ino</code> под ESP32 с библиотеками FastLED, ArduinoJson, NTPClient, ESPAsyncWebServer.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-semibold text-slate-200 mb-1">3. Сборка архива прошивки</div>
                <div className="text-[11px] text-slate-400">
                  Скачивает <code className="font-mono text-amber-400">esptool.exe</code>, готовит <code className="font-mono text-amber-400">flash_windows.bat</code> и упаковывает готовый ZIP.
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-lg text-xs text-purple-200">
              🔑 <strong>Права Actions:</strong> В репозитории GitHub перейдите в <strong>Settings → Actions → General → Workflow permissions</strong> и выберите <strong>"Read and write permissions"</strong>, чтобы бот имел право создавать релизы.
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Шаг 3: Автоматический GitHub Release & Готовый архив для прошивки
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              GitHub Actions создаст официальный релиз с новым тегом версии. Внутри каждого релиза автоматически прикрепляются:
            </p>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs space-y-2">
              <div className="text-emerald-400 font-bold">📦 Прикрепленные файлы в каждом GitHub Release:</div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-purple-400">📦 esp32_stairs_flasher_v1.0.X.zip</span> — <strong>Готовый архив для Windows</strong> (включает <code className="text-purple-300">esptool.exe</code> + <code className="text-purple-300">flash_windows.bat</code> + <code className="text-purple-300">terminal.bat</code> + все <code className="text-purple-300">.bin</code> файлы)
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-sky-400">📄 firmware.bin / StairsEsp.ino.bin</span> — скомпилированная прошивка ESP32 для OTA
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-amber-400">📄 flash_windows.bat</span> — универсальный скрипт: выбор локальных .bin (Drag & Drop), скачивание версий с GitHub Releases и OTA по Wi-Fi
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-amber-300">📄 terminal.bat</span> — консоль мониторинга Serial порта (115200 бод)
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-slate-400">📄 bootloader.bin & partitions.bin</span> — загрузчик и таблица разделов
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">📄 version.json</span> — манифест для автоматического обновления по Wi-Fi
              </div>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
              ⚡ <strong>Как прошить через flash_windows.bat:</strong> просто скачайте <code className="text-purple-300 font-mono">esp32_stairs_flasher_vX.X.zip</code> из раздела Releases вашего репозитория, подключите ESP32 к USB и запустите <code className="text-amber-300 font-mono">flash_windows.bat</code>. Скрипт сам найдет порт и зальет прошивку!
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-sky-400" />
              Шаг 4: Как ESP32 забирает обновления "по воздуху" (Over-The-Air)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ESP32 работает автономно и управляет подсветкой лестницы. При этом в фоновом режиме:
            </p>

            <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
              <li>Каждые <strong>{config.otaCheckIntervalMinutes} минут</strong> ESP32 делает легкий HTTP GET запрос на <code className="font-mono text-sky-300">version.json</code> в вашем GitHub репозитории.</li>
              <li>Если в <code className="font-mono text-sky-300">version.json</code> номер версии больше, чем текущая зашитая версия, микроконтроллер включает режим обновления (светодиоды начинают плавно мигать синим цветом).</li>
              <li>ESP32 потоково скачивает <code className="font-mono text-sky-300">firmware.bin</code> во второй раздел флеш-памяти (OTA partition), валидирует контрольную сумму, перезагружается и сразу начинает работу на новой прошивке!</li>
            </ul>

            <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-emerald-200">
              ✨ <strong>Результат:</strong> Вам больше никогда не потребуется подключать лестницу к компьютеру кабелем — просто пишите код, делайте <code className="font-mono text-emerald-300">git push</code>, и лестница обновится сама!
            </div>
          </div>
        )}
      </div>

      {/* Interactive FAQ Accordion */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-3">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          Частые вопросы и решение проблем:
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div className="font-semibold text-slate-200">Что если пропадет интернет?</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Лестница продолжит работать в автономном режиме по датчикам движения. Астрономическое время сохранится во внутреннем RTC ESP32.
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div className="font-semibold text-slate-200">Как прошить плату в первый раз?</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Самый быстрый способ: распакуйте скачанный ZIP архив и запустите <strong>flasher.bat</strong> (он сам скачает esptool.exe и прошьет плату). Также можно открыть проект в VS Code с PlatformIO и нажать кнопку Upload.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
