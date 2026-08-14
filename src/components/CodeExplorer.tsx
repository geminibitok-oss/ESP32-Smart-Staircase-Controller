import React, { useState } from 'react';
import { FileCode, Copy, Check, Download, FolderGit2, Terminal } from 'lucide-react';
import { StaircaseConfig } from '../types';
import { generateProjectFiles, CodeFile } from '../data/codeTemplates';

interface CodeExplorerProps {
  config: StaircaseConfig;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({ config }) => {
  const files = generateProjectFiles(config);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = files[selectedFileIndex] || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="code-explorer" className="w-full bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-6 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-sky-400" />
            Исходный код проекта PlatformIO & C++
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Все файлы генерируются динамически на основе ваших настроек ступеней, пинов, Wi-Fi и репозитория
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-copy-code"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Копировать файл</span>
              </>
            )}
          </button>

          <button
            id="btn-download-single-file"
            onClick={handleDownloadSingle}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            title="Скачать данный файл"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>.zip / файл</span>
          </button>
        </div>
      </div>

      {/* Main IDE-like Layout: File Sidebar + Code Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
        
        {/* File Tree Sidebar (4 cols) */}
        <div className="md:col-span-4 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 space-y-1 overflow-y-auto max-h-[520px]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1 mb-1 flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
            Файлы репозитория ({files.length})
          </div>

          {files.map((file, idx) => {
            const isSelected = idx === selectedFileIndex;
            const isWorkflow = file.path.includes('.github');
            const isConfig = file.name === 'config.h' || file.name === 'platformio.ini';

            return (
              <button
                key={file.path}
                onClick={() => setSelectedFileIndex(idx)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between group ${
                  isSelected 
                    ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isWorkflow ? 'bg-purple-400' : isConfig ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  <span className="truncate">{file.path}</span>
                </div>

                {isSelected && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-200 shrink-0">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Code Content Viewer (8 cols) */}
        <div className="md:col-span-8 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
          {/* File Tab Bar */}
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-300">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span>{currentFile.path}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-sans">
              {currentFile.description}
            </span>
          </div>

          {/* Code Viewer with Monospace formatting and scroll */}
          <div className="p-4 overflow-x-auto max-h-[460px] overflow-y-auto text-xs font-mono text-slate-300 bg-slate-950/90 leading-relaxed select-text">
            <pre className="whitespace-pre">
              <code>{currentFile.content}</code>
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
};
