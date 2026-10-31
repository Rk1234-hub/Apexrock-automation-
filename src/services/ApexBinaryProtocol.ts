// ============================================================================
// APEXROCK AUTOMATION: FRAMED BINARY PROTOCOL & CRC-16-CCITT
// ============================================================================

export class ApexBinaryProtocol {
  public static readonly SOF = 0x7e;
  public static readonly EOF = 0x7f;
  public static readonly ESC = 0x7d;
  public static readonly XOR_BYTE = 0x20;

  /**
   * CRC-16-CCITT implementation (Poly 0x1021, Init 0xFFFF)
   * Matches the Android Jetpack Compose / C++ firmware calculation exactly
   */
  public static calculateCrc16(data: Uint8Array, length: number = data.length): number {
    let crc = 0xffff;
    for (let i = 0; i < length; i++) {
      crc = (crc ^ ((data[i] & 0xff) << 8)) & 0xffff;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc & 0xffff;
  }

  /**
   * Encodes a commandId and payload into a framed, escaped binary packet
   * Format: SOF | Stuffed[ CmdId (2B LE) + Len (2B LE) + Payload + CRC (2B LE) ] | EOF
   */
  public static encodeFrame(commandId: number, payload: Uint8Array): Uint8Array {
    const rawLen = 4 + payload.length;
    const raw = new Uint8Array(rawLen);
    const view = new DataView(raw.buffer);

    // Little Endian commandId & payload length
    view.setUint16(0, commandId, true);
    view.setUint16(2, payload.length, true);
    raw.set(payload, 4);

    const crc = this.calculateCrc16(raw, raw.length);

    // Combine raw payload + CRC16
    const packet = new Uint8Array(rawLen + 2);
    packet.set(raw, 0);
    const packetView = new DataView(packet.buffer);
    packetView.setUint16(rawLen, crc, true);

    // Byte stuffing for SOF, EOF, and ESC
    const stuffed: number[] = [this.SOF];
    for (let i = 0; i < packet.length; i++) {
      const b = packet[i];
      if (b === this.SOF || b === this.EOF || b === this.ESC) {
        stuffed.push(this.ESC);
        stuffed.push(b ^ this.XOR_BYTE);
      } else {
        stuffed.push(b);
      }
    }
    stuffed.push(this.EOF);

    return new Uint8Array(stuffed);
  }

  /**
   * Decodes and validates a raw framed binary packet
   */
  public static decodeFrame(bytes: Uint8Array): {
    commandId: number;
    payload: Uint8Array;
    crcReceived: number;
    crcCalculated: number;
    validCrc: boolean;
  } | null {
    if (bytes.length < 8) return null;
    if (bytes[0] !== this.SOF || bytes[bytes.length - 1] !== this.EOF) {
      return null;
    }

    // Un-stuff bytes
    const unstuffed: number[] = [];
    let isEscaped = false;

    for (let i = 1; i < bytes.length - 1; i++) {
      const b = bytes[i];
      if (isEscaped) {
        unstuffed.push(b ^ this.XOR_BYTE);
        isEscaped = false;
      } else if (b === this.ESC) {
        isEscaped = true;
      } else {
        unstuffed.push(b);
      }
    }

    if (unstuffed.length < 6) return null; // 2B Cmd + 2B Len + 2B CRC min

    const unpacket = new Uint8Array(unstuffed);
    const view = new DataView(unpacket.buffer);

    const commandId = view.getUint16(0, true);
    const payloadLen = view.getUint16(2, true);

    if (unpacket.length < 4 + payloadLen + 2) {
      return null;
    }

    const payload = unpacket.slice(4, 4 + payloadLen);
    const crcReceived = view.getUint16(4 + payloadLen, true);

    const rawDataForCrc = unpacket.slice(0, 4 + payloadLen);
    const crcCalculated = this.calculateCrc16(rawDataForCrc, rawDataForCrc.length);

    return {
      commandId,
      payload,
      crcReceived,
      crcCalculated,
      validCrc: crcReceived === crcCalculated
    };
  }

  /**
   * Format bytes to hexadecimal uppercase string (e.g., "7E 01 00 04 ... 7F")
   */
  public static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * Known Command IDs mapping
   */
  public static getCommandName(cmdId: number): string {
    switch (cmdId) {
      case 0x0001: return 'MOTOR_CONTROL_PWM';
      case 0x0002: return 'SENSOR_TELEMETRY';
      case 0x0003: return 'RADAR_ESTOP_EVENT';
      case 0x0004: return 'GAMEPAD_INPUT_STATE';
      case 0x0005: return 'OTA_FLASH_BLOCK';
      case 0x0006: return 'HEARTBEAT_PING';
      case 0x0007: return 'SERVO_ANGLES';
      case 0x0008: return 'MIC_AUDIO_RMS';
      default: return `CUSTOM_CMD_0x${cmdId.toString(16).padStart(4, '0').toUpperCase()}`;
    }
  }
}
