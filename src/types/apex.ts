// ============================================================================
// APEXROCK AUTOMATION: CORE TYPES & PROTOCOL DEFINITIONS
// ============================================================================

export enum DashboardMode {
  ARDUINO_DROID = 'ARDUINO_DROID',
  CONTROL_CAR = 'CONTROL_CAR',
  DABBLE_PROTOCOL = 'DABBLE_PROTOCOL',
  SERIAL_MONITOR = 'SERIAL_MONITOR'
}

export interface DashboardModeInfo {
  title: string;
  subtitle: string;
}

export const DASHBOARD_MODES: Record<DashboardMode, DashboardModeInfo> = {
  [DashboardMode.ARDUINO_DROID]: {
    title: 'Arduino Droid',
    subtitle: 'C++ Sketch Editor, USB OTG & Wireless OTA Flashing'
  },
  [DashboardMode.CONTROL_CAR]: {
    title: 'ESP8266 / ESP32 Car',
    subtitle: 'mDNS Node Scanner, Dual Joysticks & 15cm Radar E-Stop'
  },
  [DashboardMode.DABBLE_PROTOCOL]: {
    title: 'Dabble Protocol',
    subtitle: 'Virtual Gamepad, Phone Sensors (Accel/Gyro/Mic) & PWM Sliders'
  },
  [DashboardMode.SERIAL_MONITOR]: {
    title: 'High-Speed Monitor',
    subtitle: 'Framed Binary Protocol & 60fps LTTB Telemetry Plotter'
  }
};

export enum PacketPriority {
  EMERGENCY = 'EMERGENCY',
  COMMAND = 'COMMAND',
  STREAM = 'STREAM',
  BULK = 'BULK'
}

export enum ControlMode {
  DPAD = 'DPAD',
  JOYSTICK = 'JOYSTICK'
}

export enum SizeMode {
  COMPACT = 'COMPACT',
  STANDARD = 'STANDARD',
  EXPANDED = 'EXPANDED'
}

export interface SizeModeConfig {
  buttonSize: number; // in pixels
  spacing: number;
  title: string;
}

export const SIZE_MODE_CONFIGS: Record<SizeMode, SizeModeConfig> = {
  [SizeMode.COMPACT]: { buttonSize: 48, spacing: 6, title: 'Compact (45dp)' },
  [SizeMode.STANDARD]: { buttonSize: 68, spacing: 10, title: 'Standard (65dp)' },
  [SizeMode.EXPANDED]: { buttonSize: 92, spacing: 14, title: 'Expanded (90dp)' }
};

export interface TelemetryPoint {
  x: number;
  y: number;
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  type: 'RX' | 'TX' | 'INFO' | 'WARN' | 'ERROR';
  rawBytes?: Uint8Array;
  text: string;
  commandId?: number;
}

export interface DecodedPacket {
  commandId: number;
  commandName: string;
  payloadLength: number;
  payload: Uint8Array;
  crcReceived: number;
  crcCalculated: number;
  validCrc: boolean;
  priority: PacketPriority;
  timestamp: number;
}

export interface MdnsNode {
  id: string;
  name: string;
  ip: string;
  mac: string;
  chip: 'ESP32' | 'ESP8266' | 'ESP32-S3' | 'STM32';
  rssi: number;
  status: 'online' | 'busy' | 'offline';
  firmware: string;
  radarDistanceCm: number;
}
