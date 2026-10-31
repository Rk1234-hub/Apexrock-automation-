// ============================================================================
// APEXROCK ARDUINODROID: TOP BAR NAVIGATION
// Clean Black & White Monochromatic Layout conforming to Top Bar Contract
// ============================================================================

import React, { useState, useEffect } from 'react';
import { DashboardMode, DASHBOARD_MODES } from '../types/apex';
import { hardwareAudio } from '../services/audioSynthesizer';
import { hardwareBridge } from '../services/serialConnection';
import { Cpu, Volume2, VolumeX, Code2, Radio, Github } from 'lucide-react';

interface HeaderNavProps {
  currentMode: DashboardMode;
  onSelectMode: (mode: DashboardMode) => void;
  onOpenKotlinModal: () => void;
  onOpenApkModal: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentMode,
  onSelectMode,
  onOpenKotlinModal,
  onOpenApkModal
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('SIMULATED_ESP32');
  const [isBraking, setIsBraking] = useState<boolean>(false);

  useEffect(() => {
    const unsub = hardwareBridge.subscribeTelemetry(() => {
      const status = hardwareBridge.getConnectionStatus();
      setConnectionType(status.connectionType);
      setIsBraking(status.isEmergencyBraking);
    });
    return unsub;
  }, []);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    hardwareAudio.setMuted(next);
    if (!next) {
      hardwareAudio.playClick(1000);
    }
  };

  return (
    <header className="border-b border-neutral-800 bg-black sticky top-0 z-40 px-4 lg:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white text-black font-black flex items-center justify-center text-sm">
            AD
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              ArduinoDroid Workstation
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              ApexRock Universal Hardware Suite
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single-Line, Tabular Selection) */}
        <nav className="hidden md:flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {(Object.keys(DASHBOARD_MODES) as DashboardMode[]).map((mode) => {
            const isSelected = currentMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  hardwareAudio.playClick(900);
                  onSelectMode(mode);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
                }`}
              >
                {DASHBOARD_MODES[mode].title}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Connection & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isBraking && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white bg-neutral-900 px-2 py-1 rounded font-mono font-bold animate-pulse border border-neutral-700">
              <span>●</span>
              <span>15cm E-STOP ACTIVE</span>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-neutral-400">
            <Radio className="w-3.5 h-3.5 text-white" />
            <span className="text-neutral-300">ESP32 Rover</span>
            <span aria-hidden="true" className="text-neutral-700">·</span>
            <span className="text-white">115200 bps</span>
          </div>

          <button
            onClick={toggleSound}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg border border-neutral-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>

          <button
            onClick={() => {
              hardwareAudio.playClick();
              onOpenKotlinModal();
            }}
            title="View Android 17 Kotlin Jetpack Compose code"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5 text-white" />
            <span>Android Code</span>
          </button>

          {/* Prominent APK & GitHub Publish Button */}
          <button
            onClick={() => {
              hardwareAudio.playClick(1100);
              onOpenApkModal();
            }}
            title="Download APK and publish to GitHub"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-black bg-white hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap shadow-sm"
          >
            <Github className="w-4 h-4 text-black" />
            <span>Publish APK</span>
          </button>
        </div>
      </div>

      {/* Mobile Row */}
      <div className="md:hidden mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between gap-1 overflow-x-auto">
        {(Object.keys(DASHBOARD_MODES) as DashboardMode[]).map((mode) => {
          const isSelected = currentMode === mode;
          return (
            <button
              key={mode}
              onClick={() => {
                hardwareAudio.playClick(900);
                onSelectMode(mode);
              }}
              className={`flex-1 min-w-[76px] py-1 text-[11px] font-semibold rounded text-center transition-all ${
                isSelected
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {DASHBOARD_MODES[mode].title.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </header>
  );
};
