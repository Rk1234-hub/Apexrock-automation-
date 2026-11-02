/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DashboardMode, DASHBOARD_MODES } from './types/apex';
import { HeaderNav } from './components/HeaderNav';
import { ArduinoDroidView } from './components/ArduinoDroidView';
import { EspCarControlView } from './components/EspCarControlView';
import { DabbleProtocolView } from './components/DabbleProtocolView';
import { SerialMonitorView } from './components/SerialMonitorView';
import { KotlinCodeModal } from './components/KotlinCodeModal';
import { ApkPublisherModal } from './components/ApkPublisherModal';
import { hardwareBridge } from './services/serialConnection';
import { hardwareAudio } from './services/audioSynthesizer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BookOpen, Github, Download } from 'lucide-react';

export default function App() {
  const [currentMode, setCurrentMode] = useState<DashboardMode>(DashboardMode.ARDUINO_DROID);
  const [isKotlinModalOpen, setIsKotlinModalOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<{
    radar: number;
    pwm: number;
    accelX: number;
    accelY: number;
    micDb: number;
  }>({
    radar: 35,
    pwm: 180,
    accelX: 0.2,
    accelY: -0.4,
    micDb: 14
  });

  useEffect(() => {
    const unsub = hardwareBridge.subscribeTelemetry((data) => {
      setTelemetry({
        radar: data.radar,
        pwm: data.pwm,
        accelX: data.accelX,
        accelY: data.accelY,
        micDb: data.micDb
      });
    });
    return unsub;
  }, []);

  const activeModeMeta = DASHBOARD_MODES[currentMode];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-neutral-800">
      {/* Top Bar Navigation (Black & White Contract) */}
      <HeaderNav
        currentMode={currentMode}
        onSelectMode={(mode) => setCurrentMode(mode)}
        onOpenKotlinModal={() => setIsKotlinModalOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
      />

      {/* Main Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col">
        {/* Quick APK Download Callout Banner */}
        <div className="mb-4 p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black font-bold flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>ApexRock Automation APK Ready</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
                  v1.0.0 · Android 17 / API 37+
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                Save the Android APK installer package directly to your phone or tablet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/download/ApexRock-Automation-v1.0.0.apk"
              download="ApexRock-Automation-v1.0.0.apk"
              onClick={async (e) => {
                hardwareAudio.playClick(1100);
                try {
                  const res = await fetch('/download/ApexRock-Automation-v1.0.0.apk');
                  if (res.ok) {
                    e.preventDefault();
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'ApexRock-Automation-v1.0.0.apk';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                } catch {
                  // Fall back to standard anchor download
                }
              }}
              className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Download APK</span>
            </a>

            <PWAInstallButton onOpenApkModal={() => setIsApkModalOpen(true)} />

            <button
              onClick={() => {
                hardwareAudio.playClick(1000);
                setIsApkModalOpen(true);
              }}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold border border-neutral-700 flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5 text-white" />
              <span>APK & GitHub Hub</span>
            </button>
          </div>
        </div>

        {/* Module Sub-Header & Mode Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{activeModeMeta.title}</span>
              <span className="text-neutral-600 font-normal">/</span>
              <span className="text-xs font-mono font-normal text-neutral-400">
                ARDUINODROID-APEX
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {activeModeMeta.subtitle}
            </p>
          </div>

          {/* Quick Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
            {(Object.keys(DASHBOARD_MODES) as DashboardMode[]).map((mode) => {
              const isSelected = currentMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    hardwareAudio.playClick(900);
                    setCurrentMode(mode);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isSelected
                      ? 'bg-white text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  {DASHBOARD_MODES[mode].title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Module Container */}
        <div className="flex-1 flex flex-col">
          {currentMode === DashboardMode.ARDUINO_DROID && <ArduinoDroidView />}
          {currentMode === DashboardMode.CONTROL_CAR && <EspCarControlView />}
          {currentMode === DashboardMode.DABBLE_PROTOCOL && <DabbleProtocolView />}
          {currentMode === DashboardMode.SERIAL_MONITOR && <SerialMonitorView />}
        </div>
      </main>

      {/* Persistent Bottom Hardware Telemetry Tray */}
      <footer className="border-t border-neutral-800 bg-neutral-950 px-4 lg:px-6 py-2.5 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white font-semibold">ESP32 Rover STA: 192.168.4.1</span>
            </div>
            <span aria-hidden="true" className="text-neutral-700 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span>Radar:</span>
              <strong className={telemetry.radar < 15 ? 'text-white bg-neutral-800 px-1 rounded' : 'text-white'}>
                {telemetry.radar.toFixed(0)} cm
              </strong>
            </div>
            <span aria-hidden="true" className="text-neutral-700 hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-1.5">
              <span>Motor PWM:</span>
              <strong className="text-white">{telemetry.pwm.toFixed(0)} / 255</strong>
            </div>
            <span aria-hidden="true" className="text-neutral-700 hidden lg:inline">|</span>
            <div className="hidden lg:flex items-center gap-1.5">
              <span>Sensor Tilt:</span>
              <strong className="text-white">{telemetry.accelY.toFixed(1)} m/s²</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-neutral-500 text-[11px]">ApexBinaryProtocol CRC-16</span>
            <button
              onClick={() => setIsKotlinModalOpen(true)}
              className="text-white hover:underline font-semibold text-[11px] transition-colors"
            >
              View Kotlin Android 17 (API 37)+ Code
            </button>
          </div>
        </div>
      </footer>

      {/* Android Kotlin Source Code Modal */}
      <KotlinCodeModal
        isOpen={isKotlinModalOpen}
        onClose={() => setIsKotlinModalOpen(false)}
      />

      {/* Android APK & GitHub Publishing Modal */}
      <ApkPublisherModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />
    </div>
  );
}
