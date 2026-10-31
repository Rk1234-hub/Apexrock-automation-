// ============================================================================
// APEXROCK AUTOMATION: HARDWARE SERIAL & TELEMETRY STREAM ENGINE
// Connects to WebSerial / WebBluetooth or runs realistic 60fps Microcontroller Telemetry Loop
// ============================================================================

import { DecodedPacket, PacketPriority, SerialLogEntry, TelemetryPoint } from '../types/apex';
import { ApexBinaryProtocol } from './ApexBinaryProtocol';
import { globalSendQueue } from './ApexSendQueue';
import { hardwareAudio } from './audioSynthesizer';

export type LogListener = (entry: SerialLogEntry) => void;
export type TelemetryListener = (channelData: {
  radar: number;
  pwm: number;
  accelX: number;
  accelY: number;
  micDb: number;
  timestamp: number;
}) => void;
export type PacketListener = (packet: DecodedPacket) => void;

class ApexHardwareBridge {
  private logListeners: Set<LogListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private packetListeners: Set<PacketListener> = new Set();

  private isConnected: boolean = true;
  private connectionType: 'SIMULATED_ESP32' | 'WEB_SERIAL' | 'WEB_BLUETOOTH' | 'DISCONNECTED' = 'SIMULATED_ESP32';
  private baudRate: number = 115200;

  // Active telemetry telemetry state
  private radarDistance: number = 38; // cm
  private motorPwm: number = 180;
  private accelX: number = 0.4;
  private accelY: number = -0.2;
  private micLevelDb: number = 18;

  // High rate telemetry buffers for LTTB decimator
  private channelHistory: {
    radar: TelemetryPoint[];
    pwm: TelemetryPoint[];
    accel: TelemetryPoint[];
    mic: TelemetryPoint[];
  } = {
    radar: [],
    pwm: [],
    accel: [],
    mic: []
  };

  private loopIntervalId: number | null = null;
  private simTime: number = 0;
  private isEmergencyBraking: boolean = false;

  constructor() {
    this.startHardwareLoop();
  }

  public subscribeLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  public subscribePackets(listener: PacketListener): () => void {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  public emitLog(entry: Omit<SerialLogEntry, 'id' | 'timestamp'>) {
    const fullEntry: SerialLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    };

    this.logListeners.forEach(listener => listener(fullEntry));
  }

  public updateSensorValues(updates: {
    radar?: number;
    pwm?: number;
    accelX?: number;
    accelY?: number;
    micDb?: number;
  }) {
    if (updates.radar !== undefined) {
      this.radarDistance = Math.max(2, Math.min(200, updates.radar));
      // Trigger radar proximity sound
      hardwareAudio.handleRadarProximity(this.radarDistance);

      // Check emergency brake condition (< 15cm)
      if (this.radarDistance < 15) {
        if (!this.isEmergencyBraking) {
          this.isEmergencyBraking = true;
          this.triggerRadarEmergencyBrake(this.radarDistance);
        }
      } else {
        this.isEmergencyBraking = false;
      }
    }
    if (updates.pwm !== undefined) this.motorPwm = updates.pwm;
    if (updates.accelX !== undefined) this.accelX = updates.accelX;
    if (updates.accelY !== undefined) this.accelY = updates.accelY;
    if (updates.micDb !== undefined) this.micLevelDb = updates.micDb;
  }

  private triggerRadarEmergencyBrake(distanceCm: number) {
    const payload = new Uint8Array([0xEE, Math.round(distanceCm)]);
    const frame = ApexBinaryProtocol.encodeFrame(0x0003, payload);

    // Enqueue with highest priority EMERGENCY
    globalSendQueue.enqueue(PacketPriority.EMERGENCY, frame, 0x0003, 'RADAR_E_STOP_TRIGGER');

    this.emitLog({
      type: 'WARN',
      text: `[EMERGENCY E-STOP] Radar obstacle collision imminent (${distanceCm.toFixed(1)} cm < 15.0 cm)! Emergency frame dispatched.`,
      rawBytes: frame,
      commandId: 0x0003
    });
  }

  public sendCommandPacket(commandId: number, payload: Uint8Array, priority = PacketPriority.COMMAND) {
    const frame = ApexBinaryProtocol.encodeFrame(commandId, payload);
    globalSendQueue.enqueue(priority, frame, commandId, ApexBinaryProtocol.getCommandName(commandId));

    // Also write to physical USB WebSerial port if connected!
    if (this.connectionType === 'WEB_SERIAL') {
      import('./realHardwareUploader').then(({ realHardwareUploader }) => {
        realHardwareUploader.writeBytes(frame);
      });
    }

    this.emitLog({
      type: 'TX',
      text: `[TX] Queued ${ApexBinaryProtocol.getCommandName(commandId)} [Priority: ${priority}] (${frame.length} B)`,
      rawBytes: frame,
      commandId
    });
  }

  public sendRawAscii(text: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text + '\r\n');

    // Also transmit directly to physical USB WebSerial if connected
    if (this.connectionType === 'WEB_SERIAL') {
      import('./realHardwareUploader').then(({ realHardwareUploader }) => {
        realHardwareUploader.writeText(text + '\r\n');
      });
    }

    this.emitLog({
      type: 'TX',
      text: `[TX-ASCII] ${text}`,
      rawBytes: bytes
    });
  }

  /**
   * Hardware Simulation Loop (60Hz telemetry & packet dispatcher pump)
   */
  private startHardwareLoop() {
    if (this.loopIntervalId) clearInterval(this.loopIntervalId);

    // Emit initial connection greeting
    setTimeout(() => {
      this.emitLog({
        type: 'INFO',
        text: `[SYSTEM] ApexRock ESP32 / ESP8266 Universal Hardware Bridge Initialized @ ${this.baudRate} baud`
      });
      this.emitLog({
        type: 'RX',
        text: `[RX-BOOT] ApexRock ESP-IDF v5.2.1 | Dual Core 240MHz | WiFi STA: 192.168.4.1 | Framed Binary Ready`
      });
    }, 200);

    let frameCounter = 0;

    this.loopIntervalId = window.setInterval(() => {
      this.simTime += 0.05;
      frameCounter++;

      // 1. Process queued packets from Priority Dispatcher
      const queuedItem = globalSendQueue.pollNextPacket();
      if (queuedItem) {
        // Decode packet to verify CRC
        const decoded = ApexBinaryProtocol.decodeFrame(queuedItem.packet);
        if (decoded) {
          const packetInfo: DecodedPacket = {
            commandId: decoded.commandId,
            commandName: ApexBinaryProtocol.getCommandName(decoded.commandId),
            payloadLength: decoded.payload.length,
            payload: decoded.payload,
            crcReceived: decoded.crcReceived,
            crcCalculated: decoded.crcCalculated,
            validCrc: decoded.validCrc,
            priority: queuedItem.priority,
            timestamp: Date.now()
          };
          this.packetListeners.forEach(listener => listener(packetInfo));

          this.emitLog({
            type: 'TX',
            text: `[DISPATCH] ${packetInfo.commandName} | Priority: ${packetInfo.priority} | CRC-16: 0x${decoded.crcReceived.toString(16).toUpperCase()} ${decoded.validCrc ? 'OK' : 'MISMATCH'}`,
            rawBytes: queuedItem.packet,
            commandId: decoded.commandId
          });
        }
      }

      // 2. Generate simulated sinusoidal drift & noise on telemetry
      const radarNoise = (Math.sin(this.simTime * 0.8) * 1.5);
      const liveRadar = Math.max(3, this.radarDistance + radarNoise);

      const pwmNoise = this.motorPwm > 0 ? (Math.sin(this.simTime * 3) * 2) : 0;
      const livePwm = Math.max(0, Math.min(255, this.motorPwm + pwmNoise));

      const liveAccelX = this.accelX + Math.sin(this.simTime * 1.5) * 0.3;
      const liveAccelY = this.accelY + Math.cos(this.simTime * 1.2) * 0.3;
      const liveMic = Math.max(5, this.micLevelDb + Math.sin(this.simTime * 2.5) * 3);

      const timestamp = Date.now();

      // Buffer points for LTTB downsampling
      const ptIndex = this.channelHistory.radar.length;
      this.channelHistory.radar.push({ x: ptIndex, y: liveRadar });
      this.channelHistory.pwm.push({ x: ptIndex, y: livePwm });
      this.channelHistory.accel.push({ x: ptIndex, y: (liveAccelY + 10) * 10 }); // Scaled
      this.channelHistory.mic.push({ x: ptIndex, y: liveMic });

      // Keep maximum 1500 points in memory
      if (this.channelHistory.radar.length > 1500) {
        this.channelHistory.radar.shift();
        this.channelHistory.pwm.shift();
        this.channelHistory.accel.shift();
        this.channelHistory.mic.shift();
      }

      // Notify telemetry subscribers
      this.telemetryListeners.forEach(l => l({
        radar: liveRadar,
        pwm: livePwm,
        accelX: liveAccelX,
        accelY: liveAccelY,
        micDb: liveMic,
        timestamp
      }));

      // 3. Periodic framed telemetry stream packet (every ~30 frames / 500ms)
      if (frameCounter % 30 === 0) {
        const payload = new Uint8Array(8);
        const view = new DataView(payload.buffer);
        view.setUint16(0, Math.round(liveRadar * 10), true);
        view.setUint8(2, Math.round(livePwm));
        view.setInt16(3, Math.round(liveAccelX * 100), true);
        view.setInt16(5, Math.round(liveAccelY * 100), true);
        view.setUint8(7, Math.round(liveMic));

        const frame = ApexBinaryProtocol.encodeFrame(0x0002, payload);
        const decoded = ApexBinaryProtocol.decodeFrame(frame);

        if (decoded) {
          this.packetListeners.forEach(listener => listener({
            commandId: 0x0002,
            commandName: 'SENSOR_TELEMETRY',
            payloadLength: 8,
            payload,
            crcReceived: decoded.crcReceived,
            crcCalculated: decoded.crcCalculated,
            validCrc: decoded.validCrc,
            priority: PacketPriority.STREAM,
            timestamp: Date.now()
          }));
        }
      }
    }, 16); // 60 Hz
  }

  public getRawPoints(channel: 'radar' | 'pwm' | 'accel' | 'mic'): TelemetryPoint[] {
    return this.channelHistory[channel];
  }

  public clearHistory(): void {
    this.channelHistory.radar = [];
    this.channelHistory.pwm = [];
    this.channelHistory.accel = [];
    this.channelHistory.mic = [];
    this.emitLog({
      type: 'INFO',
      text: '[PLOTTER] Telemetry buffers cleared by user'
    });
  }

  // WebSerial Integration
  public async requestWebSerial(): Promise<boolean> {
    const { realHardwareUploader } = await import('./realHardwareUploader');
    if (realHardwareUploader.isWebSerialSupported()) {
      const res = await realHardwareUploader.connectSerial(this.baudRate, (incoming) => {
        this.emitLog({
          type: 'RX',
          text: `[UART-RX] ${incoming.trim()}`
        });
      });

      if (res.success) {
        this.connectionType = 'WEB_SERIAL';
        this.emitLog({
          type: 'INFO',
          text: `[WEB-SERIAL] Physical Serial COM Port Connected @ ${this.baudRate} baud`
        });
        return true;
      } else {
        this.emitLog({
          type: 'WARN',
          text: `[WEB-SERIAL] ${res.message}`
        });
      }
    } else {
      this.emitLog({
        type: 'WARN',
        text: `[WEB-SERIAL] WebSerial not supported by browser. Falling back to High-Speed Simulated ESP32/8266 Hardware Bridge.`
      });
    }
    return false;
  }

  // Web Bluetooth Integration
  public async requestWebBluetooth(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        const bt = (navigator as unknown as {
          bluetooth: {
            requestDevice: (opts: unknown) => Promise<{ name?: string }>;
          };
        }).bluetooth;
        const device = await bt.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] // Nordic UART Service UUID
        });
        if (device) {
          this.connectionType = 'WEB_BLUETOOTH';
          this.emitLog({
            type: 'INFO',
            text: `[BLE] Paired with BLE Device: ${device.name || 'ESP32-NUS'}`
          });
          return true;
        }
      } catch (err: unknown) {
        this.emitLog({
          type: 'WARN',
          text: `[BLE] Bluetooth request canceled: ${(err as Error).message}`
        });
      }
    } else {
      this.emitLog({
        type: 'WARN',
        text: `[BLE] Web Bluetooth not supported in this frame. Falling back to Simulated Wireless Bridge.`
      });
    }
    return false;
  }

  public getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      baudRate: this.baudRate,
      radarDistance: this.radarDistance,
      motorPwm: this.motorPwm,
      accelX: this.accelX,
      accelY: this.accelY,
      micDb: this.micLevelDb,
      isEmergencyBraking: this.isEmergencyBraking
    };
  }

  public setBaudRate(baud: number) {
    this.baudRate = baud;
    this.emitLog({
      type: 'INFO',
      text: `[UART] Baud rate switched to ${baud} bps`
    });
  }
}

export const hardwareBridge = new ApexHardwareBridge();
