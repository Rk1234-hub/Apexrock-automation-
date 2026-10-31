// ============================================================================
// APEXROCK ARDUINODROID: MOCK COMPILER OUTPUT TERMINAL
// Displays simulated multi-stage compilation progress, GCC diagnostic error logs & memory map
// ============================================================================

import React, { useState } from 'react';
import {
  Terminal,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  Cpu,
  Layers,
  FileCode,
  Bug
} from 'lucide-react';
import { CompilerDiagnostic, ValidationResult } from '../services/sketchSyntaxValidator';
import { hardwareAudio } from '../services/audioSynthesizer';

interface CompilerTerminalProps {
  isCompiling: boolean;
  compileProgress: number;
  compileStage: string;
  compileSuccess: boolean | null;
  consoleLines: string[];
  validationResult: ValidationResult | null;
  onClear: () => void;
  onSelectLine: (line: number) => void;
  onInjectSyntaxError: () => void;
  boardName: string;
}

export const CompilerTerminal: React.FC<CompilerTerminalProps> = ({
  isCompiling,
  compileProgress,
  compileStage,
  compileSuccess,
  consoleLines,
  validationResult,
  onClear,
  onSelectLine,
  onInjectSyntaxError,
  boardName
}) => {
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'DIAGNOSTICS' | 'MEMORY' | 'FLAGS'>('CONSOLE');
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = () => {
    hardwareAudio.playClick(1000);
    const text = consoleLines.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const errorCount = validationResult?.diagnostics.filter(d => d.type === 'error' || d.type === 'fatal').length || 0;
  const warningCount = validationResult?.diagnostics.filter(d => d.type === 'warning').length || 0;

  return (
    <div className="flex flex-col bg-black rounded-xl border border-neutral-800 overflow-hidden font-mono text-xs text-white shadow-lg min-h-[300px]">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-white" />
          <span className="font-semibold text-white tracking-wide text-[11px]">
            ArduinoDroid GCC Compiler Terminal
          </span>

          {/* Compilation Status Pill */}
          {isCompiling && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] text-white animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>Compiling ({compileProgress}%)</span>
            </span>
          )}

          {!isCompiling && compileSuccess === true && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white text-black font-bold text-[10px]">
              <CheckCircle2 className="w-3 h-3 text-black" />
              <span>Build Passed</span>
            </span>
          )}

          {!isCompiling && compileSuccess === false && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-white text-white font-bold text-[10px]">
              <AlertCircle className="w-3 h-3 text-white" />
              <span>Build Failed ({errorCount} errors)</span>
            </span>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-neutral-800 text-[11px]">
            <button
              onClick={() => setActiveTab('CONSOLE')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'CONSOLE' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Console ({consoleLines.length})
            </button>

            <button
              onClick={() => setActiveTab('DIAGNOSTICS')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'DIAGNOSTICS' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Errors</span>
              {errorCount > 0 && (
                <span className="px-1 rounded bg-neutral-800 text-[10px] font-bold text-white">
                  {errorCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('MEMORY')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'MEMORY' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Memory Map
            </button>

            <button
              onClick={() => setActiveTab('FLAGS')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'FLAGS' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Flags
            </button>
          </div>

          {/* Test Error Simulation Button */}
          <button
            onClick={onInjectSyntaxError}
            title="Inject an intentional syntax error to test compiler diagnostics"
            className="flex items-center gap-1 px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-[11px] border border-neutral-700 transition-colors"
          >
            <Bug className="w-3 h-3 text-white" />
            <span className="hidden sm:inline">Simulate Error</span>
          </button>

          {/* Copy and Clear */}
          <button
            onClick={handleCopyLogs}
            title="Copy build logs"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-900 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClear}
            title="Clear output"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar (Visible while compiling) */}
      {isCompiling && (
        <div className="bg-neutral-950 px-3 py-2 border-b border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-300">
            <span className="font-semibold text-white truncate">{compileStage}</span>
            <span className="font-bold text-white">{compileProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-150"
              style={{ width: `${compileProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tab 1: Full Console Log */}
      {activeTab === 'CONSOLE' && (
        <div className="flex-1 p-3 bg-black overflow-y-auto max-h-72 space-y-1 leading-relaxed selection:bg-neutral-800">
          {consoleLines.map((line, idx) => {
            const isError = line.includes('error:') || line.includes('fatal error:') || line.includes('Build Failed');
            const isWarning = line.includes('warning:');
            const isSuccess = line.includes('[SUCCESS]') || line.includes('Build Passed');
            const isHeader = line.startsWith('[') && !isSuccess;

            return (
              <div
                key={idx}
                className={
                  isError
                    ? 'text-white font-bold bg-neutral-900/90 px-1 rounded border-l-2 border-white'
                    : isWarning
                    ? 'text-neutral-200'
                    : isSuccess
                    ? 'text-white font-bold'
                    : isHeader
                    ? 'text-neutral-400 font-semibold'
                    : 'text-neutral-400'
                }
              >
                {line}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Filtered Diagnostics with Click-to-Jump */}
      {activeTab === 'DIAGNOSTICS' && (
        <div className="flex-1 p-3 bg-black overflow-y-auto max-h-72 space-y-2.5">
          {validationResult && validationResult.diagnostics.length > 0 ? (
            validationResult.diagnostics.map((diag, idx) => (
              <div
                key={idx}
                onClick={() => onSelectLine(diag.line)}
                className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg hover:border-white cursor-pointer transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {diag.type === 'error' || diag.type === 'fatal' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-[11px]">
                      sketch.ino:{diag.line}:{diag.column}: {diag.type}: {diag.message}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 underline">
                    Jump to Line {diag.line}
                  </span>
                </div>

                {/* Source Snippet with Caret Pointer */}
                <div className="p-2 bg-black rounded border border-neutral-800 text-[11px] leading-tight font-mono">
                  <div className="text-neutral-400">
                    <span className="text-neutral-600 select-none mr-2">{diag.line} |</span>
                    <span>{diag.snippet}</span>
                  </div>
                  <div className="text-white">
                    <span className="text-neutral-600 select-none mr-2">   |</span>
                    <span>{' '.repeat(Math.max(0, diag.caretOffset))}^</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-neutral-500 font-mono">
              <CheckCircle2 className="w-6 h-6 text-white mx-auto mb-2" />
              <div>No syntax errors or compiler diagnostics detected.</div>
              <div className="text-[10px] text-neutral-600 mt-1">Code conforms to C++17 Arduino standard.</div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Detailed Memory Map Breakdown */}
      {activeTab === 'MEMORY' && (
        <div className="flex-1 p-4 bg-black overflow-y-auto max-h-72 space-y-4">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>Program Flash (.text + .rodata):</span>
              <span className="text-white font-bold">
                {validationResult?.flashBytes.toLocaleString()} bytes (16.2% of 1.31 MB App0)
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: '16.2%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>Dynamic Memory (.data + .bss):</span>
              <span className="text-white font-bold">
                {validationResult?.ramBytes.toLocaleString()} bytes (6.4% of 320 KB SRAM)
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-400" style={{ width: '6.4%' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800 text-[11px]">
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
              <div className="text-neutral-500 text-[10px]">.text (Code)</div>
              <div className="font-bold text-white mt-0.5">{validationResult?.textSection.toLocaleString()} B</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
              <div className="text-neutral-500 text-[10px]">.rodata (Const)</div>
              <div className="font-bold text-white mt-0.5">{validationResult?.rodataSection.toLocaleString()} B</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
              <div className="text-neutral-500 text-[10px]">.data (Init Global)</div>
              <div className="font-bold text-white mt-0.5">{validationResult?.dataSection.toLocaleString()} B</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
              <div className="text-neutral-500 text-[10px]">.bss (Zero Global)</div>
              <div className="font-bold text-white mt-0.5">{validationResult?.bssSection.toLocaleString()} B</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Compiler Flags */}
      {activeTab === 'FLAGS' && (
        <div className="flex-1 p-3 bg-black overflow-y-auto max-h-72 space-y-2 text-[11px] text-neutral-300">
          <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div className="text-neutral-500 text-[10px] mb-1">C++ Compiler:</div>
            <code className="text-white">xtensa-esp32-elf-g++ (GCC 12.2.0) -std=gnu++17</code>
          </div>
          <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div className="text-neutral-500 text-[10px] mb-1">Optimization & Warning Flags:</div>
            <code className="text-white">-Os -Wall -Wextra -Werror=return-type -ffunction-sections -fdata-sections</code>
          </div>
          <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
            <div className="text-neutral-500 text-[10px] mb-1">Hardware Definitions:</div>
            <code className="text-white">-DARDUINO=10819 -DARDUINO_ARCH_ESP32 -DESP32 -DF_CPU=240000000L</code>
          </div>
        </div>
      )}
    </div>
  );
};
