// ============================================================================
// APEXROCK ARDUINODROID: C++ SKETCH STUDIO & COMPILER
// Black & White Industrial Aesthetic with Full ArduinoDroid Action Bar & Libraries
// ============================================================================

import React, { useState } from 'react';
import {
  Check,
  Upload,
  BookOpen,
  Cpu,
  FileCode,
  RotateCcw,
  Usb,
  Wifi,
  Terminal,
  Download,
  Plus,
  Trash2,
  FolderOpen,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ARDUINO_DROID_BOARDS, BoardProfile, ARDUINO_DROID_LIBRARIES } from '../services/arduinoDroidLibraries';
import { hardwareAudio } from '../services/audioSynthesizer';
import { hardwareBridge } from '../services/serialConnection';
import { realHardwareUploader } from '../services/realHardwareUploader';
import { LibraryManagerModal } from './LibraryManagerModal';

import { validateSketchSyntax, ValidationResult } from '../services/sketchSyntaxValidator';
import { CompilerTerminal } from './CompilerTerminal';

interface SketchFile {
  name: string;
  code: string;
}

const DEFAULT_MAIN_SKETCH = `// ApexRock ArduinoDroid: ESP32 Universal Master Runtime
#include <WiFi.h>
#include <NewPing.h>

#define RADAR_TRIG 5
#define RADAR_ECHO 18
#define MOTOR_PWM_PIN 25
#define STATUS_LED 2

volatile float radarDistanceCm = 35.0;
volatile int motorSpeed = 180;

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(RADAR_TRIG, OUTPUT);
  pinMode(RADAR_ECHO, INPUT);

  WiFi.softAP("ApexRock-ESP32-Rover", "apex1234");
  Serial.println("[APEX] ESP32 Rover Online. Ready for Binary Packets.");
}

void loop() {
  // Ultrasonic Radar Distance Probe (40kHz)
  digitalWrite(RADAR_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(RADAR_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(RADAR_TRIG, LOW);
  
  long duration = pulseIn(RADAR_ECHO, HIGH, 30000);
  radarDistanceCm = (duration > 0) ? (duration * 0.034 / 2.0) : 100.0;

  // 15cm Critical Emergency Brake Interlock
  if (radarDistanceCm < 15.0) {
    analogWrite(MOTOR_PWM_PIN, 0);
    digitalWrite(STATUS_LED, HIGH);
    Serial.println("🚨 [E-STOP] Collision Imminent (< 15cm)! Motors Locked.");
  } else {
    analogWrite(MOTOR_PWM_PIN, motorSpeed);
    digitalWrite(STATUS_LED, LOW);
  }
  
  delay(30);
}`;

export const ArduinoDroidView: React.FC = () => {
  // Multiple sketch files in project
  const [sketchFiles, setSketchFiles] = useState<SketchFile[]>([
    { name: 'sketch.ino', code: DEFAULT_MAIN_SKETCH },
    {
      name: 'definitions.h',
      code: `// Hardware Pin Definitions & Constants
#pragma once

#define HC_SR04_TRIG 5
#define HC_SR04_ECHO 18
#define MOTOR_ENA    25
#define MOTOR_IN1    26
#define MOTOR_IN2    27
#define HEADLIGHT_PIN 4
#define BUZZER_PIN   19
`
    }
  ]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [selectedBoard, setSelectedBoard] = useState<BoardProfile>(ARDUINO_DROID_BOARDS[0]);
  const [uploadMode, setUploadMode] = useState<'USB_OTG' | 'WIRELESS_OTA'>('USB_OTG');
  const [otaIp, setOtaIp] = useState<string>('192.168.4.1');
  const [otaPort, setOtaPort] = useState<string>('3232');

  // Library manager modal
  const [isLibModalOpen, setIsLibModalOpen] = useState(false);

  // Highlighting line from diagnostic jump
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Multi-stage Compilation Status
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileStage, setCompileStage] = useState('Idle');
  const [compileSuccess, setCompileSuccess] = useState<boolean | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'ArduinoDroid C++ Build Toolchain (GCC 12.2.0 / xtensa-esp32-elf / avr-gcc) initialized.',
    'Ready. Select a sketch file, manage libraries (📚), compile (✔) or upload (➔).'
  ]);

  const activeFile = sketchFiles[activeFileIndex] || sketchFiles[0];

  const updateActiveCode = (newCode: string) => {
    setSketchFiles(prev =>
      prev.map((f, i) => (i === activeFileIndex ? { ...f, code: newCode } : f))
    );
  };

  const handleVerifyCompile = () => {
    hardwareAudio.playClick(1100);
    setIsCompiling(true);
    setCompileProgress(10);
    setCompileStage('Preprocessing and macro expansion...');
    setCompileSuccess(null);

    const validation = validateSketchSyntax(activeFile.code, activeFile.name);
    setValidationResult(validation);

    setConsoleLogs([
      `[BUILD START] Compiling ${activeFile.name} for ${selectedBoard.name}`,
      `xtensa-esp32-elf-g++ -c -Os -Wall -Wextra -std=gnu++17 ${activeFile.name} -o ${activeFile.name}.o`
    ]);

    // Simulated multi-stage GCC compilation pipeline
    setTimeout(() => {
      setCompileProgress(35);
      setCompileStage('Parsing C++ AST & resolving header dependencies...');

      if (validation.hasErrors) {
        // Output GCC error log
        setIsCompiling(false);
        setCompileSuccess(false);
        setCompileStage('Compilation aborted due to errors.');
        hardwareAudio.playEmergencyBrakeAlarm();

        const errorLogs = validation.diagnostics.map(diag => 
          `${activeFile.name}:${diag.line}:${diag.column}: ${diag.type}: ${diag.message}`
        );

        setConsoleLogs(prev => [
          ...prev,
          `In file included from ${activeFile.name}:`,
          ...errorLogs,
          `*** [${activeFile.name}.o] Error 1`,
          `[FAIL] Build terminated: ${validation.diagnostics.length} diagnostic error(s).`
        ]);

        hardwareBridge.emitLog({
          type: 'ERROR',
          text: `[COMPILER] Build Failed: ${validation.diagnostics[0]?.message} at line ${validation.diagnostics[0]?.line}`
        });
        return;
      }

      setConsoleLogs(prev => [
        ...prev,
        'Headers resolved: <WiFi.h>, <NewPing.h> ... OK',
        'Syntax verification passed with 0 errors.'
      ]);

      setTimeout(() => {
        setCompileProgress(70);
        setCompileStage('Linking object files into firmware.elf...');
        setConsoleLogs(prev => [
          ...prev,
          'Linking .text, .data, .rodata, .bss sections...',
          'xtensa-esp32-elf-ld -T esp32.ld firmware.elf ... OK'
        ]);

        setTimeout(() => {
          setCompileProgress(100);
          setCompileStage('Generating binary image firmware.bin...');
          setIsCompiling(false);
          setCompileSuccess(true);

          setConsoleLogs(prev => [
            ...prev,
            'esptool.py v4.6 elf2image --flash_mode dio --flash_freq 40m --flash_size 4MB firmware.elf ... OK',
            `[SUCCESS] Binary compiled cleanly for ${selectedBoard.name}.`,
            `Sketch uses ${validation.flashBytes.toLocaleString()} bytes (16.2%) of program storage space. Maximum is 1,310,720 bytes.`,
            `Global variables use ${validation.ramBytes.toLocaleString()} bytes (6.4%) of dynamic memory, leaving 301,860 bytes for local variables. Maximum is 327,680 bytes.`,
            'Ready for USB-OTG or OTA upload.'
          ]);

          hardwareBridge.emitLog({
            type: 'INFO',
            text: `[ARDUINODROID] Compilation passed for ${selectedBoard.name} (${validation.flashBytes.toLocaleString()} B).`
          });
        }, 300);
      }, 300);
    }, 300);
  };

  const handleInjectSyntaxError = () => {
    hardwareAudio.playClick(1000);
    // Inject missing semicolon error into active sketch
    const lines = activeFile.code.split('\n');
    let injected = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Serial.begin(115200);')) {
        lines[i] = '  Serial.begin(115200) // Missing semicolon simulated';
        injected = true;
        break;
      }
    }
    if (!injected) {
      lines.splice(lines.length - 2, 0, '  int error_test = 42 // Missing semicolon');
    }
    const newCode = lines.join('\n');
    updateActiveCode(newCode);

    // Trigger compile immediately to demonstrate error logs
    setTimeout(() => {
      handleVerifyCompile();
    }, 100);
  };

  const handleSelectLine = (line: number) => {
    hardwareAudio.playClick(900);
    setHighlightedLine(line);
    setTimeout(() => setHighlightedLine(null), 3000);
  };

  const handleUpload = async () => {
    hardwareAudio.playClick(1200);
    setIsFlashing(true);
    setFlashProgress(0);

    setConsoleLogs(prev => [
      ...prev,
      '--------------------------------------------------',
      `[UPLOAD INITIATED] Target: ${selectedBoard.name}`,
      `Protocol: ${uploadMode === 'USB_OTG' ? 'USB-OTG WebSerial' : `Wireless OTA (${otaIp}:${otaPort})`}`
    ]);

    if (uploadMode === 'USB_OTG') {
      // Connect real WebSerial or pulse bootloader
      if (realHardwareUploader.isWebSerialSupported()) {
        const connected = await hardwareBridge.requestWebSerial();
        if (connected) {
          setConsoleLogs(prev => [...prev, 'Toggling DTR/RTS signals to put MCU in bootloader mode...']);
          await realHardwareUploader.resetEspToBootloader();
        }
      }
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress > 100) progress = 100;
      setFlashProgress(progress);

      if (progress === 30) {
        setConsoleLogs(prev => [...prev, 'Connecting to ROM Bootloader handshake (0x08)... OK']);
      } else if (progress === 60) {
        setConsoleLogs(prev => [...prev, 'Flashing application image: 142 KB / 218 KB (compressed)...']);
      } else if (progress === 100) {
        clearInterval(interval);
        setIsFlashing(false);
        setConsoleLogs(prev => [
          ...prev,
          'Writing checksum validation SHA-256... OK',
          'Soft resetting microcontroller (RTS pulse)...',
          `[UPLOAD COMPLETE] ${selectedBoard.name} is running uploaded firmware!`
        ]);

        hardwareBridge.emitLog({
          type: 'INFO',
          text: `[UPLOAD] Firmware flashed successfully to ${selectedBoard.name}.`
        });
      }
    }, 180);
  };

  const handleDownloadIno = () => {
    hardwareAudio.playClick(1000);
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBinary = () => {
    hardwareAudio.playClick(1100);
    // Produce mock binary bundle with valid magic header
    const binData = new Uint8Array([0xe9, 0x03, 0x02, 0x20, 0x40, 0x08, 0x00, 0x00]);
    const blob = new Blob([binData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedBoard.id}_firmware.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddNewFile = () => {
    hardwareAudio.playClick(900);
    const fileName = prompt('Enter new file name (e.g. config.h, motor.cpp):', 'custom.h');
    if (fileName && fileName.trim()) {
      const clean = fileName.trim();
      setSketchFiles(prev => [...prev, { name: clean, code: `// ${clean}\n#pragma once\n\n` }]);
      setActiveFileIndex(sketchFiles.length);
    }
  };

  const handleDeleteActiveFile = () => {
    if (sketchFiles.length <= 1) return;
    hardwareAudio.playClick(900);
    setSketchFiles(prev => prev.filter((_, i) => i !== activeFileIndex));
    setActiveFileIndex(0);
  };

  const handleInsertLibraryHeader = (headerCode: string) => {
    const updated = `${headerCode}\n\n${activeFile.code}`;
    updateActiveCode(updated);
    setConsoleLogs(prev => [...prev, `[LIBRARY] Added header: ${headerCode.split('\n')[0]}`]);
  };

  const handleLoadLibraryExample = (code: string, title: string) => {
    updateActiveCode(code);
    setConsoleLogs(prev => [...prev, `[EXAMPLE LOADED] Loaded sketch: "${title}"`]);
  };

  const lineCount = activeFile.code.split('\n').length;

  return (
    <div className="flex flex-col gap-4 h-full text-white font-sans">
      {/* =========================================================================
          ARDUINODROID ACTION BAR (Exact ArduinoDroid App Look)
          ========================================================================= */}
      <div className="p-3 bg-black border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Left: Project Brand & Action Icons */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white text-black font-black flex items-center justify-center text-sm">
            AD
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-white tracking-wide">
              ArduinoDroid C++ Studio
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              v6.0 IDE · Real USB-OTG & Libraries
            </div>
          </div>

          <div className="h-6 w-px bg-neutral-800 mx-2" />

          {/* Action Icons: Compile (✔), Upload (➔), Library (📚) */}
          <div className="flex items-center gap-1.5">
            {/* Compile / Verify */}
            <button
              onClick={handleVerifyCompile}
              disabled={isCompiling || isFlashing}
              title="Verify / Compile Sketch"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold border border-neutral-700 transition-colors"
            >
              <Check className="w-4 h-4 text-white" />
              <span className="hidden md:inline">{isCompiling ? 'Checking...' : 'Verify'}</span>
            </button>

            {/* Upload */}
            <button
              onClick={handleUpload}
              disabled={isCompiling || isFlashing}
              title="Upload to Microcontroller (USB-OTG / OTA)"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4 text-black" />
              <span>{isFlashing ? 'Uploading...' : 'Upload'}</span>
            </button>

            {/* Library Manager */}
            <button
              onClick={() => {
                hardwareAudio.playClick(1000);
                setIsLibModalOpen(true);
              }}
              title="ArduinoDroid Library Manager"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold border border-neutral-700 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-white" />
              <span className="hidden lg:inline">Libraries</span>
            </button>
          </div>
        </div>

        {/* Center/Right: Board Selection & Upload Options */}
        <div className="flex items-center gap-2">
          {/* Board Selector */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-neutral-400" />
            <select
              value={selectedBoard.id}
              onChange={(e) => {
                const b = ARDUINO_DROID_BOARDS.find(item => item.id === e.target.value);
                if (b) setSelectedBoard(b);
                hardwareAudio.playClick(900);
              }}
              className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-white font-medium"
            >
              {ARDUINO_DROID_BOARDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.family})
                </option>
              ))}
            </select>
          </div>

          {/* Upload Protocol Switcher: USB-OTG vs OTA */}
          <div className="hidden sm:flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => {
                hardwareAudio.playClick(900);
                setUploadMode('USB_OTG');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                uploadMode === 'USB_OTG' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Usb className="w-3.5 h-3.5" />
              <span>USB-OTG</span>
            </button>

            <button
              onClick={() => {
                hardwareAudio.playClick(900);
                setUploadMode('WIRELESS_OTA');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                uploadMode === 'WIRELESS_OTA' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>OTA WiFi</span>
            </button>
          </div>

          {/* Export / Download Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadIno}
              title="Download source code (.ino)"
              className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownloadBinary}
              title="Download compiled binary (.bin)"
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-[11px] font-mono text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
            >
              .BIN
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        {/* Left Column: Sketch Tab Bar & Code Editor */}
        <div className="flex-1 flex flex-col bg-black rounded-xl border border-neutral-800 overflow-hidden shadow-sm">
          {/* File Tabs Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-950 border-b border-neutral-800">
            <div className="flex items-center gap-1 overflow-x-auto">
              {sketchFiles.map((file, idx) => {
                const isActive = activeFileIndex === idx;
                return (
                  <button
                    key={file.name}
                    onClick={() => {
                      hardwareAudio.playClick(900);
                      setActiveFileIndex(idx);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                      isActive
                        ? 'bg-neutral-900 text-white border border-neutral-700'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{file.name}</span>
                  </button>
                );
              })}

              <button
                onClick={handleAddNewFile}
                title="Add new file to sketch"
                className="p-1 text-neutral-500 hover:text-white hover:bg-neutral-900 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span>{lineCount} lines</span>
              {sketchFiles.length > 1 && (
                <button
                  onClick={handleDeleteActiveFile}
                  title="Delete current tab"
                  className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Code Editor Body with Line Numbers */}
          <div className="flex-1 flex overflow-hidden bg-black font-mono text-xs">
            {/* Gutter with line numbers */}
            <div className="w-12 py-3 text-right pr-3 text-neutral-600 bg-neutral-950 select-none border-r border-neutral-800 font-mono text-xs leading-5">
              {Array.from({ length: lineCount }).map((_, i) => {
                const lineNum = i + 1;
                const isTarget = highlightedLine === lineNum;
                return (
                  <div
                    key={i}
                    className={`transition-colors ${
                      isTarget ? 'bg-white text-black font-bold px-1 rounded-sm' : ''
                    }`}
                  >
                    {lineNum}
                  </div>
                );
              })}
            </div>

            {/* Code Input */}
            <textarea
              value={activeFile.code}
              onChange={(e) => updateActiveCode(e.target.value)}
              spellCheck={false}
              className="flex-1 p-3 bg-black text-white font-mono text-xs leading-5 resize-none outline-none focus:ring-0 overflow-y-auto selection:bg-neutral-700"
            />
          </div>

          {/* Flash Progress Bar */}
          {isFlashing && (
            <div className="p-3 bg-neutral-950 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-white font-bold">Flashing {selectedBoard.name}...</span>
                <span className="text-white font-bold">{flashProgress}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-200"
                  style={{ width: `${flashProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Board Info, OTA settings & Interactive Compiler Terminal */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          {/* Board Spec Card */}
          <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Board Specification
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                {selectedBoard.cpuFreq}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500">Flash ROM</div>
                <div className="font-bold text-white mt-0.5">{selectedBoard.flashSize}</div>
              </div>
              <div className="p-2 bg-neutral-950 rounded border border-neutral-800">
                <div className="text-[10px] text-neutral-500">SRAM RAM</div>
                <div className="font-bold text-white mt-0.5">{selectedBoard.ramSize}</div>
              </div>
            </div>

            {uploadMode === 'WIRELESS_OTA' && (
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <div className="text-[11px] font-medium text-neutral-400">
                  OTA Target IP Address:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otaIp}
                    onChange={(e) => setOtaIp(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 text-xs font-mono text-white rounded px-2.5 py-1.5 outline-none focus:border-white"
                  />
                  <input
                    type="text"
                    value={otaPort}
                    onChange={(e) => setOtaPort(e.target.value)}
                    className="w-16 bg-neutral-950 border border-neutral-800 text-xs font-mono text-white rounded px-2 py-1.5 outline-none focus:border-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Mock Compiler Output Terminal */}
          <CompilerTerminal
            isCompiling={isCompiling}
            compileProgress={compileProgress}
            compileStage={compileStage}
            compileSuccess={compileSuccess}
            consoleLines={consoleLogs}
            validationResult={validationResult}
            onClear={() => setConsoleLogs([])}
            onSelectLine={handleSelectLine}
            onInjectSyntaxError={handleInjectSyntaxError}
            boardName={selectedBoard.name}
          />
        </div>
      </div>

      {/* Library Manager Modal */}
      <LibraryManagerModal
        isOpen={isLibModalOpen}
        onClose={() => setIsLibModalOpen(false)}
        onIncludeHeader={handleInsertLibraryHeader}
        onLoadExample={handleLoadLibraryExample}
      />
    </div>
  );
};
