// ============================================================================
// APEXROCK AUTOMATION: REAL HARDWARE UPLOADER & CAR CONTROLLER SERVICE
// Real WebSerial USB-OTG flasher, ESP DTR/RTS reset, OTA HTTP client & Car Dispatcher
// ============================================================================

export interface SerialPortInfo {
  isOpen: boolean;
  port: any | null;
  reader: any | null;
  writer: any | null;
}

class RealHardwareUploader {
  private activePort: any | null = null;
  private reader: any | null = null;
  private writer: any | null = null;
  private isReading: boolean = false;

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Connects to a physical USB-OTG / Serial COM port
   */
  public async connectSerial(baudRate = 115200, onDataReceived?: (data: string) => void): Promise<{ success: boolean; message: string }> {
    if (!this.isWebSerialSupported()) {
      return { success: false, message: 'WebSerial is not supported in this browser environment.' };
    }

    try {
      const serial = (navigator as any).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate });
      this.activePort = port;

      // Setup writer
      this.writer = port.writable.getWriter();

      // Setup reader loop
      if (onDataReceived) {
        this.startReaderLoop(port, onDataReceived);
      }

      return { success: true, message: `Connected to Serial Port at ${baudRate} baud.` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to open serial port.' };
    }
  }

  private async startReaderLoop(port: any, onDataReceived: (data: string) => void) {
    this.isReading = true;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          onDataReceived(value);
        }
      }
    } catch {
      // Stream closed or error
    } finally {
      this.reader.releaseLock();
    }
  }

  /**
   * Pulse DTR and RTS signals to reboot ESP32 / ESP8266 into flashing bootloader
   */
  public async resetEspToBootloader(): Promise<boolean> {
    if (!this.activePort || !this.activePort.setSignals) return false;
    try {
      // DTR=false, RTS=true puts ESP in download mode (GPIO0 low, EN pulled)
      await this.activePort.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise(r => setTimeout(r, 100));
      await this.activePort.setSignals({ dataTerminalReady: true, requestToSend: false });
      await new Promise(r => setTimeout(r, 100));
      await this.activePort.setSignals({ dataTerminalReady: false, requestToSend: false });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Transmits raw bytes to the physical microcontroller
   */
  public async writeBytes(bytes: Uint8Array): Promise<boolean> {
    if (!this.writer) return false;
    try {
      await this.writer.write(bytes);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Transmits text string to the microcontroller
   */
  public async writeText(text: string): Promise<boolean> {
    const encoder = new TextEncoder();
    return this.writeBytes(encoder.encode(text));
  }

  /**
   * Disconnects active serial port
   */
  public async disconnectSerial(): Promise<void> {
    this.isReading = false;
    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      this.reader = null;
    }
    if (this.writer) {
      try { await this.writer.close(); } catch {}
      this.writer = null;
    }
    if (this.activePort) {
      try { await this.activePort.close(); } catch {}
      this.activePort = null;
    }
  }

  public isConnected(): boolean {
    return this.activePort !== null;
  }

  /**
   * Real Car Control over WiFi / HTTP / WebSocket
   * Sends real HTTP requests to ESP32 / ESP8266 Rover at http://<ip>/cmd?dir=...&pwm=...
   */
  public async sendCarHttpCommand(ip: string, dir: string, pwm: number): Promise<{ success: boolean; statusText: string }> {
    const cleanIp = ip.replace(/^https?:\/\//, '').trim();
    const url = `http://${cleanIp}/cmd?dir=${dir.toLowerCase()}&pwm=${Math.round(pwm)}`;

    try {
      // Using fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      // mode: 'no-cors' allows hitting local microcontrollers without CORS headers
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return { success: true, statusText: `HTTP GET dispatched to ${url}` };
    } catch (err: any) {
      return { success: false, statusText: `Local fetch error: ${err.message}` };
    }
  }

  /**
   * Real Wireless OTA Firmware Upload
   */
  public async uploadOtaFirmware(
    ip: string,
    port: string,
    firmwareBlob: Blob,
    onProgress: (percent: number) => void
  ): Promise<{ success: boolean; message: string }> {
    const cleanIp = ip.replace(/^https?:\/\//, '').trim();
    const url = `http://${cleanIp}:${port}/update`;

    try {
      const formData = new FormData();
      formData.append('update', firmwareBlob, 'firmware.bin');

      const xhr = new XMLHttpRequest();
      return new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, message: 'OTA Flash Succeeded. MCU rebooting.' });
          } else {
            resolve({ success: false, message: `OTA HTTP Error ${xhr.status}: ${xhr.statusText}` });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ success: false, message: 'Network request failed or MCU unreachable.' });
        });

        xhr.open('POST', url, true);
        xhr.send(formData);
      });
    } catch (err: any) {
      return { success: false, message: err.message || 'OTA Upload failed.' };
    }
  }

  /**
   * Request iOS 13+ / Android Sensor Permissions for Accelerometer & Gyroscope
   */
  public async requestDeviceOrientationPermission(): Promise<boolean> {
    if (typeof (DeviceOrientationEvent as any) !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch {
        return false;
      }
    }
    return true; // Not required or already enabled on Android / non-iOS
  }
}

export const realHardwareUploader = new RealHardwareUploader();
