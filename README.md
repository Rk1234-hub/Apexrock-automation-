# ApexRock Automation: Master Workstation & Android APK

[![Build & Publish Android APK](https://github.com/apexrock/automation/actions/workflows/build-apk.yml/badge.svg)](https://github.com/apexrock/automation/actions/workflows/build-apk.yml)
[![Target: Android 17 (API 37)+ / Jetpack Compose](https://img.shields.io/badge/Platform-Android%2017%20%28API%2037%2B%29-black.svg)](https://developer.android.com)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-white.svg)](LICENSE)

Universal robotics and telemetry workstation featuring **ArduinoDroid C++ Studio**, **ESP8266/ESP32 Car Controller with 15cm Radar E-Stop**, **Dabble Protocol Gamepad with phone sensors**, and **60 FPS LTTB Serial Telemetry Plotter**.

---

## 📱 Android APK: GitHub Publishing & Automated CI/CD

This repository includes a full Android Studio project (`/android`) and a GitHub Actions workflow (`.github/workflows/build-apk.yml`) to automatically compile and release Android APKs on every push.

### 🚀 Automated GitHub Release (1-Step)
1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: ApexRock Automation Android APK Release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ApexRock-Automation.git
   git push -u origin main
   ```
2. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions will immediately:
   - Check out code and set up JDK 17
   - Compile `ApexRock-Automation-Release.apk` and `ApexRock-Automation-Debug.apk`
   - Create a GitHub Release with download links to the compiled APK binaries!

---

## 🛠️ Local Android Studio Build

1. Open Android Studio (Iguana, Jellyfish, Ladybug, or newer).
2. Select **Open an Existing Project** and navigate to the `android/` directory.
3. Allow Gradle to sync dependencies.
4. Run or Build:
   - **Build Debug APK**: `Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - **Command Line**:
     ```bash
     cd android
     ./gradlew assembleDebug
     # Output: android/app/build/outputs/apk/debug/app-debug.apk
     ```

---

## 🏎️ Core Modules

1. **Arduino Droid C++ Studio**: Full sketch editor, GCC compiler diagnostic simulator, complete ArduinoDroid libraries (`WiFi`, `NewPing`, `Servo`, `SSD1306`, `FreeRTOS`, `FastLED`), and USB-OTG/OTA flasher.
2. **ESP8266 & ESP32 Car**: Dual joysticks & D-Pad, mDNS discovery, and 15cm autonomous ultrasonic radar brake interlock.
3. **Dabble Protocol**: Virtual gamepad, mobile accelerometer/gyroscope phone tilt sensors, live microphone dB monitor, and PWM motor sliders.
4. **Serial Monitor & 60 FPS Plotter**: Framed Binary Protocol (`SOF: 0x7E, EOF: 0x7F, CRC-16`), 4-tier priority packet dispatcher, and Largest Triangle Three Buckets (LTTB) decimation engine.
