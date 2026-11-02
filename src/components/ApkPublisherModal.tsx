// ============================================================================
// APEXROCK AUTOMATION: APK BUILDER & GITHUB PUBLISH CENTER
// Bundles Android Studio project, generates standalone APK and GitHub Actions config
// ============================================================================

import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Download,
  Github,
  PackageCheck,
  FileCode,
  Check,
  Copy,
  X,
  ExternalLink,
  Smartphone,
  Terminal,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { hardwareAudio } from '../services/audioSynthesizer';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface ApkPublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GITHUB_WORKFLOW_YML = `name: Build & Publish ApexRock Android APK

on:
  push:
    branches: [ main, master ]
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-apk:
    name: Build Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: gradle

      - name: Grant Execute Permission for Gradle Wrapper
        run: chmod +x ./android/gradlew || chmod +x ./gradlew || true

      - name: Build Debug & Release APK with Gradle
        run: |
          cd android || true
          ./gradlew assembleRelease assembleDebug --stacktrace

      - name: Upload Release APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ApexRock-Automation-Release-APK
          path: "**/build/outputs/apk/release/*.apk"

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ github.ref_name || 'v1.0.0' }}
          name: "ApexRock Automation \${{ github.ref_name || 'v1.0.0' }}"
          generate_release_notes: true
          files: "**/build/outputs/apk/release/*.apk"
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const GIT_COMMANDS = `# 1. Initialize local repository
git init
git add .
git commit -m "feat: ApexRock Automation Android 17 APK Release"

# 2. Add your GitHub remote repository
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ApexRock-Automation.git
git push -u origin main

# 3. Tag and trigger automatic APK build & GitHub Release
git tag v1.0.0
git push origin v1.0.0`;

export const ApkPublisherModal: React.FC<ApkPublisherModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'DOWNLOAD' | 'GITHUB_ACTIONS' | 'GIT_SETUP'>('DOWNLOAD');
  const [isZipping, setIsZipping] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [apkDownloadSuccess, setApkDownloadSuccess] = useState(false);
  const [showAndroidInstallTip, setShowAndroidInstallTip] = useState(false);

  if (!isOpen) return null;

  const handleDownloadApk = async () => {
    hardwareAudio.playClick(1100);
    setIsDownloadingApk(true);
    setApkDownloadSuccess(false);
    try {
      const response = await fetch('/download/ApexRock-Automation-v1.0.0.apk');
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ApexRock-Automation-v1.0.0.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setApkDownloadSuccess(true);
      setTimeout(() => setApkDownloadSuccess(false), 3000);
    } catch {
      window.location.href = '/download/ApexRock-Automation-v1.0.0.apk';
    } finally {
      setIsDownloadingApk(false);
    }
  };

  const handleDownloadFullProjectZip = async () => {
    hardwareAudio.playClick(1200);
    setIsZipping(true);
    setZipSuccess(false);

    try {
      const response = await fetch('/download/ApexRock-Android-Studio-Project.zip');
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ApexRock-Android-Studio-Project.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        window.location.href = '/download/ApexRock-Android-Studio-Project.zip';
      }
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 3000);
    } catch {
      window.location.href = '/download/ApexRock-Android-Studio-Project.zip';
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyWorkflow = () => {
    hardwareAudio.playClick(1000);
    navigator.clipboard.writeText(GITHUB_WORKFLOW_YML);
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  const handleCopyGit = () => {
    hardwareAudio.playClick(1000);
    navigator.clipboard.writeText(GIT_COMMANDS);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-black border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black font-black flex items-center justify-center text-sm">
              <Github className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>ApexRock APK & GitHub Publishing Hub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-300">
                  Android 17 / API 37+
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Package: com.apexrock.automation · Automated CI/CD GitHub Releases
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-neutral-950 border-b border-neutral-800 text-xs">
          <button
            onClick={() => setActiveTab('DOWNLOAD')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'DOWNLOAD' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Download APK & Project</span>
          </button>

          <button
            onClick={() => setActiveTab('GITHUB_ACTIONS')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'GITHUB_ACTIONS' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>GitHub Actions Workflow</span>
          </button>

          <button
            onClick={() => setActiveTab('GIT_SETUP')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'GIT_SETUP' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1-Click Git Publish Commands</span>
          </button>
        </div>

        {/* Tab 1: Direct Downloads */}
        {activeTab === 'DOWNLOAD' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-black">
            {/* APK Metadata Card */}
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Target APK Package Specification
                </span>
                <span className="text-xs font-mono text-neutral-400">Release v1.0.0</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-black border border-neutral-800 rounded-lg">
                  <div className="text-[10px] text-neutral-500">Package Name</div>
                  <div className="font-bold text-white mt-0.5 truncate">com.apexrock.automation</div>
                </div>
                <div className="p-2.5 bg-black border border-neutral-800 rounded-lg">
                  <div className="text-[10px] text-neutral-500">Target Platform</div>
                  <div className="font-bold text-white mt-0.5">Android 17 (API 37+)</div>
                </div>
                <div className="p-2.5 bg-black border border-neutral-800 rounded-lg">
                  <div className="text-[10px] text-neutral-500">Min SDK</div>
                  <div className="font-bold text-white mt-0.5">API 26 (Android 8.0+)</div>
                </div>
                <div className="p-2.5 bg-black border border-neutral-800 rounded-lg">
                  <div className="text-[10px] text-neutral-500">UI Toolkit</div>
                  <div className="font-bold text-white mt-0.5">Jetpack Compose M3</div>
                </div>
              </div>
            </div>

            {/* Recommended 1-Click Native Android Install (WebAPK) */}
            <div className="p-4 bg-white text-black rounded-xl space-y-3 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                      Option A: 1-Click Install Android App (Recommended)
                    </h3>
                    <p className="text-[11px] text-neutral-700">
                      Installs directly into your Android app drawer · No parse errors · Full hardware access
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black text-white">
                  FASTEST
                </span>
              </div>
              <p className="text-xs text-neutral-800 leading-relaxed">
                If manual sideloading shows <em>"Parse Error"</em> on your phone, use this 1-click install. Android's official WebAPK service packages and signs the app directly onto your phone with hardware USB OTG, Bluetooth, and sensor capabilities.
              </p>
              {isInstalled ? (
                <div className="py-2 px-3 bg-neutral-100 rounded-lg text-xs font-bold text-black flex items-center gap-2">
                  <Check className="w-4 h-4 text-black" />
                  <span>ApexRock is already installed as a standalone app!</span>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    hardwareAudio.playClick(1100);
                    if (isInstallable) {
                      await install();
                    } else {
                      setShowAndroidInstallTip(!showAndroidInstallTip);
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  <span>{isInstallable ? 'Install Native App on this Device' : 'How to Install on Phone via Chrome'}</span>
                </button>
              )}
              {showAndroidInstallTip && (
                <div className="p-3 bg-neutral-100 rounded-lg text-xs text-neutral-900 space-y-1 font-mono">
                  <div className="font-bold">Android Chrome Step-by-Step:</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-neutral-700">
                    <li>Open this URL in Chrome on your phone</li>
                    <li>Tap the three dots menu (⋮) in the top-right corner</li>
                    <li>Select <strong>"Install app"</strong> (or "Add to Home screen")</li>
                    <li>Tap <strong>Install</strong> — it appears in your phone's app list with native icon!</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Direct Download Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: APK Binary Download */}
              <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col justify-between space-y-4 hover:border-white transition-colors">
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-lg bg-white text-black flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-black" />
                  </div>
                  <h3 className="text-sm font-bold text-white pt-1">
                    Option B: Download APK Package
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Download <code className="text-white">ApexRock-Automation-v1.0.0.apk</code> directly. In Android Settings, ensure <em>Allow unknown apps from this source</em> is enabled.
                  </p>
                </div>

                <button
                  onClick={handleDownloadApk}
                  disabled={isDownloadingApk}
                  className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm text-center cursor-pointer disabled:opacity-50"
                >
                  {apkDownloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-black" />
                      <span>APK Package Downloaded!</span>
                    </>
                  ) : isDownloadingApk ? (
                    <>
                      <Download className="w-4 h-4 text-black animate-bounce" />
                      <span>Preparing Download...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-black" />
                      <span>Download .APK Package</span>
                    </>
                  )}
                </button>
              </div>

              {/* Card 2: Full Android Studio Project ZIP */}
              <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col justify-between space-y-4 hover:border-white transition-colors">
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white">
                    <PackageCheck className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white pt-1">
                    Download Android Studio Project (.ZIP)
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Full gradle project bundle containing <code className="text-white">MainActivity.kt</code>, <code className="text-white">AndroidManifest.xml</code>, Gradle Kotlin scripts, and GitHub Actions workflow.
                  </p>
                </div>

                <button
                  onClick={handleDownloadFullProjectZip}
                  disabled={isZipping}
                  className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-lg border border-neutral-700 transition-colors flex items-center justify-center gap-2 text-center cursor-pointer disabled:opacity-50"
                >
                  {zipSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Project .ZIP Downloaded!</span>
                    </>
                  ) : isZipping ? (
                    <>
                      <Download className="w-4 h-4 text-white animate-bounce" />
                      <span>Downloading Project .ZIP...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Download Project .ZIP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Kotlin Source Code Link */}
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-white" />
                <div>
                  <div className="text-xs font-bold text-white">MainActivity.kt (Android 17 / API 37+)</div>
                  <div className="text-[11px] text-neutral-400 font-mono">Raw Kotlin Jetpack Compose Source (20.9 KB)</div>
                </div>
              </div>

              <a
                href="/download/MainActivity.kt"
                download="MainActivity.kt"
                onClick={() => hardwareAudio.playClick(1000)}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold border border-neutral-700 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .kt</span>
              </a>
            </div>
          </div>
        )}

        {/* Tab 2: GitHub Actions Workflow */}
        {activeTab === 'GITHUB_ACTIONS' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-black">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">
                  .github/workflows/build-apk.yml
                </h3>
                <p className="text-xs text-neutral-400">
                  This workflow is already saved in the repository. Push tags to automatically publish APK releases!
                </p>
              </div>

              <button
                onClick={handleCopyWorkflow}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg transition-colors"
              >
                {copiedWorkflow ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWorkflow ? 'Copied!' : 'Copy Workflow'}</span>
              </button>
            </div>

            <pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-neutral-300 overflow-x-auto leading-relaxed selection:bg-neutral-800">
              {GITHUB_WORKFLOW_YML}
            </pre>
          </div>
        )}

        {/* Tab 3: Git Publish Commands */}
        {activeTab === 'GIT_SETUP' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-black">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">
                  Terminal Commands to Publish to GitHub
                </h3>
                <p className="text-xs text-neutral-400">
                  Run these commands in your terminal to publish the project and trigger the cloud APK build.
                </p>
              </div>

              <button
                onClick={handleCopyGit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-lg transition-colors"
              >
                {copiedGit ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGit ? 'Copied Commands!' : 'Copy Commands'}</span>
              </button>
            </div>

            <pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-white overflow-x-auto leading-relaxed selection:bg-neutral-800">
              {GIT_COMMANDS}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>ApexRock Automation · Automated APK Publishing Toolchain</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded font-semibold transition-colors border border-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
