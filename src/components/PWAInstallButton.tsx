/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Check, X, ShieldCheck, Share, MoreVertical } from 'lucide-react';
import { hardwareAudio } from '../services/audioSynthesizer';

interface PWAInstallButtonProps {
  onOpenApkModal?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenApkModal }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone mode on Android/Desktop
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white">
        <Check className="w-3.5 h-3.5 text-white" />
        <span>App Installed (Native)</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    hardwareAudio.playClick(1100);
    if (isInstallable) {
      setIsInstalling(true);
      await install();
      setIsInstalling(false);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors shadow-sm cursor-pointer"
        title="Install as Android App on your device"
      >
        <Smartphone className="w-3.5 h-3.5 text-black" />
        <span>{isInstallable ? 'Install App on Phone' : 'Install App'}</span>
      </button>

      {/* Guided Install Modal for devices or when prompt is ambient */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-black border border-neutral-800 rounded-2xl shadow-2xl p-6 text-white font-sans space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Install ApexRock on Android / Device
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Instant WebAPK & Standalone App
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <p>
                You can install ApexRock directly as a standalone app on your Android phone, tablet, or desktop:
              </p>

              {isIOS ? (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 font-mono text-[11px]">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5" />
                    <span>Safari on iPhone / iPad:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                    <li>Tap the <strong>Share</strong> button in Safari toolbar</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                    <li>Tap <strong>Add</strong> in the top-right corner</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 font-mono text-[11px]">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <MoreVertical className="w-3.5 h-3.5" />
                    <span>Chrome / Browser on Android:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                    <li>Tap the <strong>three dots menu (⋮)</strong> in Chrome</li>
                    <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></li>
                    <li>Android will automatically create and install the native application package</li>
                  </ol>
                </div>
              )}

              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>Want the raw .apk file or source?</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Download the project bundle or trigger automated GitHub APK build.
                  </p>
                </div>
                {onOpenApkModal && (
                  <button
                    onClick={() => {
                      setShowGuide(false);
                      onOpenApkModal();
                    }}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    APK Hub
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg border border-neutral-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
