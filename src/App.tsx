import React, { useState } from 'react';
import { 
  Sparkles, 
  Download, 
  Cpu, 
  FileCode, 
  GitPullRequest, 
  Smartphone, 
  Sliders, 
  Play, 
  Sun, 
  Moon, 
  Wifi, 
  Layers, 
  ShieldCheck, 
  Check, 
  ArrowRight,
  FolderArchive,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { StaircaseConfig } from './types';
import { StairsSimulator } from './components/StairsSimulator';
import { WiringDiagram } from './components/WiringDiagram';
import { CodeExplorer } from './components/CodeExplorer';
import { GitHubWorkflowGuide } from './components/GitHubWorkflowGuide';
import { GitHubReleaseSelector } from './components/GitHubReleaseSelector';
import { DeviceWebPreview } from './components/DeviceWebPreview';
import { ConfigPanel } from './components/ConfigPanel';
import { downloadProjectAsZip } from './utils/zipExporter';

export default function App() {
  // Master Configuration State (Default: Borisov, Belarus)
  const [config, setConfig] = useState<StaircaseConfig>({
    stepCount: 14,
    ledsPerStep: 20,
    ledPin: 4,
    bottomSensorPin: 22,
    topSensorPin: 23,
    ldrSensorPin: 34,
    useLdr: false,

    effectMode: 'wave_cascade',
    colorScheme: 'warm_white',
    customHexColor: '#ffb450',
    stepSpeedMs: 90,
    fadeSpeedMs: 300,
    holdTimeSec: 8,
    activeBrightness: 220,
    standbyBrightness: 25,
    standbyMode: 'edge_steps',

    latitude: 54.2276, // Borisov, Belarus (По умолчанию)
    longitude: 28.5052,
    timezoneOffsetHours: 3, // UTC+3 Europe/Minsk
    sunsetOffsetMinutes: -30, // 30 mins before sunset
    sunriseOffsetMinutes: 0,
    ntpServer: 'pool.ntp.org',

    wifiSsid: 'MyHomeWiFi',
    wifiPassword: 'SuperSecretPassword',
    apSsid: 'ESP32-Stairs-Setup',
    apPassword: '12345678',
    githubUsername: 'geminibitok-oss',
    githubRepo: 'ESP32-Smart-Staircase-Controller',
    githubBranch: 'main',
    firmwareVersion: '1.0.4',
    otaCheckIntervalMinutes: 60,
    enableAutoOta: true,
  });

  const [activeTab, setActiveTab] = useState<
    'simulator' | 'wiring' | 'code' | 'github' | 'device' | 'settings'
  >('simulator');

  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const handleUpdateConfig = (updates: Partial<StaircaseConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleDownloadZip = async () => {
    try {
      setIsExportingZip(true);
      await downloadProjectAsZip(config);
      setDownloadSuccess(true);
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });

      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export ZIP:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo and Project Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base md:text-lg tracking-tight text-white">
                  ESP32 Smart Staircase Controller
                </h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  WS2812B + Solar + OTA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Умная подсветка лестницы • Датчики движения • Закат/Рассвет • GitHub CI/CD Auto-OTA
              </p>
            </div>
          </div>

          {/* Quick Actions & 1-Click ZIP Download */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-quick-github-ota"
              onClick={() => setActiveTab('github')}
              className="px-3 py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/80 text-purple-300 hover:text-white transition-all shadow-sm active:scale-95"
              title="Открыть менеджер версий и обновление прошивки с GitHub"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              <span>Обновление с GitHub (v{config.firmwareVersion || '1.0.4'})</span>
            </button>

            <button
              id="btn-download-zip"
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25'
              }`}
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Архив скачан!</span>
                </>
              ) : isExportingZip ? (
                <>
                  <FolderArchive className="w-4 h-4 animate-spin" />
                  <span>Сборка архива...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Скачать проект (.ZIP для GitHub)</span>
                </>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none text-xs">
          {[
            { id: 'simulator', label: '1. Виртуальный симулятор', icon: Play },
            { id: 'wiring', label: '2. Схема и питание (Wiring)', icon: Cpu },
            { id: 'code', label: '3. Исходный код (C++ & PlatformIO)', icon: FileCode },
            { id: 'github', label: '4. Выбор версий и обновление с GitHub (OTA)', icon: GitPullRequest },
            { id: 'device', label: '5. Web-интерфейс ESP32', icon: Smartphone },
            { id: 'settings', label: '6. Параметры лестницы', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 transition-all shrink-0 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Quick Highlights Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Авто-расписание заката:</div>
              <div className="text-xs font-semibold text-slate-100">За 30 мин до захода солнца</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Ступени & LED:</div>
              <div className="text-xs font-semibold text-slate-100">
                {config.stepCount} ступеней ({config.stepCount * config.ledsPerStep} диодов)
              </div>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('github')}
            className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-600/50 cursor-pointer flex items-center gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">GitHub Releases & OTA:</div>
              <div className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                Версия v{config.firmwareVersion || '1.0.4'} <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('github')}
            className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-600/50 cursor-pointer flex items-center gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">OTA Обновление по Wi-Fi:</div>
              <div className="text-xs font-semibold text-sky-300 flex items-center gap-1">
                Каждые {config.otaCheckIntervalMinutes} мин <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: Stairs Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <StairsSimulator config={config} onUpdateConfig={handleUpdateConfig} />
            <ConfigPanel config={config} onChange={handleUpdateConfig} />
          </div>
        )}

        {/* Tab 2: Wiring & Power Diagram */}
        {activeTab === 'wiring' && (
          <div className="space-y-6">
            <WiringDiagram config={config} />
          </div>
        )}

        {/* Tab 3: Code Explorer */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <CodeExplorer config={config} />
          </div>
        )}

        {/* Tab 4: GitHub CI/CD & OTA Workflow & Release Selector */}
        {activeTab === 'github' && (
          <div className="space-y-6">
            <GitHubReleaseSelector 
              config={config} 
              onSelectVersion={(ver) => handleUpdateConfig({ firmwareVersion: ver })} 
            />
            <GitHubWorkflowGuide config={config} />
          </div>
        )}

        {/* Tab 5: Embedded Device Web Preview */}
        {activeTab === 'device' && (
          <div className="space-y-6">
            <DeviceWebPreview 
              config={config} 
              onColorChange={(hex) => handleUpdateConfig({ customHexColor: hex, colorScheme: 'custom' })}
              onConfigUpdate={handleUpdateConfig}
            />
          </div>
        )}

        {/* Tab 6: Configuration Panel */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <ConfigPanel config={config} onChange={handleUpdateConfig} />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900/60 border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500">
        ESP32 Smart Staircase Controller • Ready to flash & deploy with PlatformIO & GitHub Actions OTA
      </footer>

    </div>
  );
}
