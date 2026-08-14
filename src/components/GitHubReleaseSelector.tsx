import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Download, 
  Sparkles, 
  ExternalLink, 
  RefreshCw, 
  Radio, 
  ShieldCheck, 
  CheckCircle2, 
  FolderArchive, 
  Terminal, 
  Cpu, 
  Zap, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { StaircaseConfig } from '../types';

interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
  downloadCount: number;
}

export interface GitHubReleaseItem {
  tag: string;
  name: string;
  publishedAt: string;
  isLatest: boolean;
  body: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
  zipUrl?: string;
  binUrl?: string;
}

interface GitHubReleaseSelectorProps {
  config: StaircaseConfig;
  onSelectVersion?: (version: string) => void;
}

export const GitHubReleaseSelector: React.FC<GitHubReleaseSelectorProps> = ({ config, onSelectVersion }) => {
  const [releases, setReleases] = useState<GitHubReleaseItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('v1.0.4');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [otaTriggerMessage, setOtaTriggerMessage] = useState<string | null>(null);

  const defaultMockReleases: GitHubReleaseItem[] = [
    {
      tag: 'v1.0.4',
      name: 'Smart Staircase Firmware v1.0.4',
      publishedAt: 'Сегодня',
      isLatest: true,
      body: `### 🚀 Релиз прошивки ESP32 \`v1.0.4\`
- **Версия:** \`1.0.4\`
- **Геолокация по умолчанию:** Борисов, Беларусь (54.2276° N, 28.5052° E)
- **Улучшения:**
  - Интерактивный консольный мастер настройки в \`flash_windows.bat\`
  - Авто-определение COM-портов с поддержкой одного клика в \`terminal.bat\`
  - Полный Live Web UI превью прямо в симуляторе
  - Поддержка мгновенного выбора версий и OTA обновления по Wi-Fi`,
      htmlUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/tag/v1.0.4`,
      zipUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/esp32_stairs_flasher_v1.0.4.zip`,
      binUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/firmware.bin`,
      assets: [
        { name: 'esp32_stairs_flasher_v1.0.4.zip', size: 15900000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/esp32_stairs_flasher_v1.0.4.zip`, downloadCount: 42 },
        { name: 'firmware.bin', size: 1024000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/firmware.bin`, downloadCount: 128 },
        { name: 'flash_windows.bat', size: 14200, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/flash_windows.bat`, downloadCount: 55 },
        { name: 'terminal.bat', size: 5500, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.4/terminal.bat`, downloadCount: 39 },
      ]
    },
    {
      tag: 'v1.0.3',
      name: 'Smart Staircase Firmware v1.0.3',
      publishedAt: 'Вчера',
      isLatest: false,
      body: `### 🚀 Релиз прошивки ESP32 \`v1.0.3\`
- **Версия:** \`1.0.3\`
- **Номер сборки:** \`#3\`
- **Инструкция по прошивке:**
  1. Скачайте архив \`esp32_stairs_flasher_v1.0.3.zip\`
  2. Распакуйте и запустите \`flash_windows.bat\``,
      htmlUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/tag/v1.0.3`,
      zipUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.3/esp32_stairs_flasher_v1.0.3.zip`,
      binUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.3/firmware.bin`,
      assets: [
        { name: 'esp32_stairs_flasher_v1.0.3.zip', size: 15300000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.3/esp32_stairs_flasher_v1.0.3.zip`, downloadCount: 89 },
        { name: 'firmware.bin', size: 1000000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.3/firmware.bin`, downloadCount: 95 },
      ]
    },
    {
      tag: 'v1.0.2',
      name: 'Smart Staircase Firmware v1.0.2',
      publishedAt: '2 дня назад',
      isLatest: false,
      body: `### Релиз v1.0.2
- Добавлен астрономический таймер заката/рассвета без сторонних API
- Базовая интеграция OTA проверок по таймеру`,
      htmlUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/tag/v1.0.2`,
      zipUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.2/esp32_stairs_flasher_v1.0.2.zip`,
      binUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.2/firmware.bin`,
      assets: [
        { name: 'esp32_stairs_flasher_v1.0.2.zip', size: 15100000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.2/esp32_stairs_flasher_v1.0.2.zip`, downloadCount: 31 },
        { name: 'firmware.bin', size: 980000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.2/firmware.bin`, downloadCount: 44 },
      ]
    },
    {
      tag: 'v1.0.0',
      name: 'Initial Release v1.0.0',
      publishedAt: 'Неделю назад',
      isLatest: false,
      body: `### Первая версия прошивки
- Поддержка лент WS2812B
- Базовый веб-сервер ESP32`,
      htmlUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/tag/v1.0.0`,
      zipUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.0/esp32_stairs_flasher_v1.0.0.zip`,
      binUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.0/firmware.bin`,
      assets: [
        { name: 'firmware.bin', size: 950000, downloadUrl: `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/v1.0.0/firmware.bin`, downloadCount: 12 },
      ]
    }
  ];

  const fetchReleases = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${config.githubUsername}/${config.githubRepo}/releases`);
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted: GitHubReleaseItem[] = data.map((r: any, idx: number) => {
          const zipAsset = r.assets?.find((a: any) => a.name.endsWith('.zip'));
          const binAsset = r.assets?.find((a: any) => a.name === 'firmware.bin' || a.name.endsWith('.bin'));
          return {
            tag: r.tag_name,
            name: r.name || r.tag_name,
            publishedAt: new Date(r.published_at).toLocaleDateString('ru-RU'),
            isLatest: idx === 0,
            body: r.body || '',
            htmlUrl: r.html_url,
            zipUrl: zipAsset?.browser_download_url,
            binUrl: binAsset?.browser_download_url,
            assets: (r.assets || []).map((a: any) => ({
              name: a.name,
              size: a.size,
              downloadUrl: a.browser_download_url,
              downloadCount: a.download_count || 0
            }))
          };
        });
        setReleases(formatted);
        setSelectedTag(formatted[0].tag);
        return;
      }
    } catch (e) {
      console.warn('Using local releases data:', e);
    } finally {
      setIsLoading(false);
    }
    setReleases(defaultMockReleases);
    setSelectedTag(defaultMockReleases[0].tag);
  };

  useEffect(() => {
    fetchReleases();
  }, [config.githubUsername, config.githubRepo]);

  const currentRelease = releases.find((r) => r.tag === selectedTag) || releases[0] || defaultMockReleases[0];

  const handleSelectRelease = (tag: string) => {
    setSelectedTag(tag);
    if (onSelectVersion) {
      const cleanVer = tag.replace(/^v/, '');
      onSelectVersion(cleanVer);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const triggerOtaCommand = (tag: string) => {
    const otaUrl = `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/${tag}/firmware.bin`;
    setOtaTriggerMessage(`Команда OTA для ESP32: OTA=${otaUrl}`);
    copyToClipboard(`OTA=${otaUrl}`, 'ota_cmd');
    setTimeout(() => setOtaTriggerMessage(null), 5000);
  };

  return (
    <div id="github-release-selector" className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              Выбор версии прошивки с GitHub Releases
            </h2>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
              CI/CD Релизы
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Выберите любую версию прошивки из репозитория <code className="text-purple-300 font-mono">{config.githubUsername}/{config.githubRepo}</code> для скачивания или установки
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReleases}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Обновить список</span>
          </button>

          <a
            href={`https://github.com/${config.githubUsername}/${config.githubRepo}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900/70 text-xs text-purple-300 border border-purple-800/60 flex items-center gap-1.5 transition-all"
          >
            <span>GitHub Releases</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Release Selection Bar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          📦 Доступные релизы и версии прошивки:
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {releases.map((rel) => {
            const isSelected = selectedTag === rel.tag;
            return (
              <button
                key={rel.tag}
                onClick={() => handleSelectRelease(rel.tag)}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-purple-950/80 border-purple-500 shadow-md shadow-purple-950/50 text-white ring-1 ring-purple-500/50'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-sm text-purple-300 flex items-center gap-1">
                    {rel.tag}
                  </span>
                  {rel.isLatest && (
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{rel.name}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{rel.publishedAt}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Release Details Card */}
      {currentRelease && (
        <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-4 md:p-5 space-y-4">
          
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{currentRelease.name}</span>
                <span className="text-xs font-mono bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded border border-purple-700">
                  {currentRelease.tag}
                </span>
                {currentRelease.isLatest && (
                  <span className="text-xs bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700 font-semibold">
                    ⭐ Актуальная версия
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">Опубликовано: {currentRelease.publishedAt}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary 1-Click Zip download button */}
              <a
                href={currentRelease.zipUrl || `https://github.com/${config.githubUsername}/${config.githubRepo}/releases/download/${currentRelease.tag}/esp32_stairs_flasher_${currentRelease.tag}.zip`}
                download
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Скачать Flasher ({currentRelease.tag}.zip)</span>
              </a>

              {/* OTA Trigger button */}
              <button
                onClick={() => triggerOtaCommand(currentRelease.tag)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>Скопировать OTA команду</span>
              </button>
            </div>
          </div>

          {/* OTA Trigger Notification */}
          {otaTriggerMessage && (
            <div className="p-3 bg-sky-950/80 border border-sky-700 text-sky-200 text-xs rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="font-mono">{otaTriggerMessage}</span>
              </div>
              <span className="text-[11px] bg-sky-900 px-2 py-0.5 rounded text-sky-100">
                Скопировано! Вставьте в terminal.bat
              </span>
            </div>
          )}

          {/* Release Notes & Changelog */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              📝 Описание релиза и список изменений:
            </h3>
            <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {currentRelease.body || 'Описание релиза отсутствует.'}
            </div>
          </div>

          {/* Assets Download List */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              📁 Файлы релиза (Assets):
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {currentRelease.assets.map((asset) => (
                <div 
                  key={asset.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    {asset.name.endsWith('.zip') ? (
                      <FolderArchive className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : asset.name.endsWith('.bin') ? (
                      <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <Terminal className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span className="truncate text-slate-200">{asset.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500">
                      {(asset.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <a
                      href={asset.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                      title="Скачать файл"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick How-to-Flash Guide for this version */}
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-900/40 text-xs space-y-1.5 text-purple-200">
            <div className="font-semibold flex items-center gap-1.5 text-purple-300">
              <Zap className="w-4 h-4 text-amber-400" />
              Как установить версию {currentRelease.tag} на контроллер:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>Скачайте архив <code className="text-amber-300 font-mono">esp32_stairs_flasher_{currentRelease.tag}.zip</code> выше.</li>
              <li>Распакуйте в любую папку и запустите <code className="text-amber-300 font-mono">flash_windows.bat</code>.</li>
              <li>Скрипт автоматически прошьёт контроллер ESP32 и откроет консоль настройки.</li>
              <li>Если плата уже прошита и подключена к Wi-Fi, отправьте команду <code className="text-sky-300 font-mono">OTA=...</code> в терминале для обновления по воздуху!</li>
            </ol>
          </div>

        </div>
      )}

    </div>
  );
};
