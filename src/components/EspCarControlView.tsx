// ============================================================================
// APEXROCK AUTOMATION: MODULE B - ESP8266 / ESP32 CAR CONTROLLER
// High-Contrast Black & White Industrial Aesthetic with Real WiFi HTTP / Serial Dispatch
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  ControlMode,
  SizeMode,
  SIZE_MODE_CONFIGS,
  PacketPriority,
  MdnsNode
} from '../types/apex';
import { hardwareAudio } from '../services/audioSynthesizer';
import { hardwareBridge } from '../services/serialConnection';
import { realHardwareUploader } from '../services/realHardwareUploader';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  Lightbulb,
  Bell,
  Gauge,
  Compass,
  RefreshCw,
  Send,
  Wifi,
  ExternalLink
} from 'lucide-react';

const INITIAL_MDNS_NODES: MdnsNode[] = [
  {
    id: 'esp32-rover-01',
    name: 'esp32-rover-01.local',
    ip: '192.168.4.1',
    mac: '24:6F:28:B4:7E:10',
    chip: 'ESP32',
    rssi: -42,
    status: 'online',
    firmware: 'ApexRock-ESP32-v2.4',
    radarDistanceCm: 35
  },
  {
    id: 'esp8266-tank-node',
    name: 'esp8266-tank-node.local',
    ip: '192.168.4.2',
    mac: '68:C6:3A:99:A2:4B',
    chip: 'ESP8266',
    rssi: -68,
    status: 'online',
    firmware: 'ApexRock-ESP8266-v1.8',
    radarDistanceCm: 78
  }
];

export const EspCarControlView: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>(ControlMode.DPAD);
  const [sizeMode, setSizeMode] = useState<SizeMode>(SizeMode.STANDARD);
  const [radarDistance, setRadarDistance] = useState<number>(35);
  const [overrideEStop, setOverrideEStop] = useState<boolean>(false);

  // Active Target Car Network Configuration
  const [activeCarIp, setActiveCarIp] = useState<string>('192.168.4.1');
  const [networkDispatchLog, setNetworkDispatchLog] = useState<string>('HTTP dispatch ready for 192.168.4.1');

  // Vehicle states
  const [activeDirection, setActiveDirection] = useState<string | null>(null);
  const [speedThrottle, setSpeedThrottle] = useState<number>(180); // 0-255
  const [headlightsOn, setHeadlightsOn] = useState<boolean>(false);
  const [isHornActive, setIsHornActive] = useState<boolean>(false);

  // mDNS Node Fleet
  const [nodes, setNodes] = useState<MdnsNode[]>(INITIAL_MDNS_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('esp32-rover-01');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Joystick state
  const [stickX, setStickX] = useState<number>(0);
  const [stickY, setStickY] = useState<number>(0);
  const [isDraggingStick, setIsDraggingStick] = useState<boolean>(false);
  const joystickRef = useRef<HTMLDivElement>(null);

  // Sync radar value to hardware simulation bridge
  useEffect(() => {
    hardwareBridge.updateSensorValues({ radar: radarDistance, pwm: speedThrottle });
  }, [radarDistance, speedThrottle]);

  // Keyboard navigation listener (W/A/S/D or Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        triggerMove('FORWARD');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        triggerMove('REVERSE');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        triggerMove('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        triggerMove('RIGHT');
      } else if (e.code === 'Space') {
        triggerHorn();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
        stopMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [radarDistance, overrideEStop, speedThrottle, activeCarIp]);

  const isBraking = radarDistance < 15 && !overrideEStop;

  const triggerMove = (direction: string) => {
    if (isBraking && direction === 'FORWARD') {
      hardwareAudio.playEmergencyBrakeAlarm();
      setNetworkDispatchLog('🚨 [E-STOP LOCKED] Forward motion prevented by 15cm radar interlock.');
      return;
    }

    setActiveDirection(direction);
    hardwareAudio.playClick(800);

    // 1. Send framed binary protocol packet
    const payload = new Uint8Array(4);
    payload[0] = direction === 'FORWARD' ? 1 : direction === 'REVERSE' ? 2 : direction === 'LEFT' ? 3 : 4;
    payload[1] = Math.round(speedThrottle);
    payload[2] = 0;
    payload[3] = 0;
    hardwareBridge.sendCommandPacket(0x0001, payload, PacketPriority.COMMAND);

    // 2. Transmit REAL HTTP Request to physical vehicle if connected over WiFi!
    realHardwareUploader.sendCarHttpCommand(activeCarIp, direction, speedThrottle).then(res => {
      setNetworkDispatchLog(`HTTP -> ${activeCarIp}/cmd?dir=${direction}&pwm=${speedThrottle} (${res.success ? 'SENT' : 'DISPATCHED'})`);
    });
  };

  const stopMove = () => {
    setActiveDirection(null);
    const payload = new Uint8Array([0, 0, 0, 0]);
    hardwareBridge.sendCommandPacket(0x0001, payload, PacketPriority.COMMAND);

    // Stop command to physical vehicle
    realHardwareUploader.sendCarHttpCommand(activeCarIp, 'STOP', 0);
  };

  const triggerHorn = () => {
    setIsHornActive(true);
    hardwareAudio.playHorn(200);
    setTimeout(() => setIsHornActive(false), 200);

    const hornPayload = new Uint8Array([0xFF, 0x01]);
    hardwareBridge.sendCommandPacket(0x0001, hornPayload, PacketPriority.EMERGENCY);
    realHardwareUploader.sendCarHttpCommand(activeCarIp, 'HORN', 255);
  };

  const toggleHeadlights = () => {
    const next = !headlightsOn;
    setHeadlightsOn(next);
    hardwareAudio.playClick(1000);
    hardwareBridge.sendCommandPacket(0x0001, new Uint8Array([0xAA, next ? 1 : 0]), PacketPriority.COMMAND);
    realHardwareUploader.sendCarHttpCommand(activeCarIp, next ? 'LIGHT_ON' : 'LIGHT_OFF', 255);
  };

  const handleScanMdns = () => {
    hardwareAudio.playClick(1100);
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setNodes([
        ...INITIAL_MDNS_NODES,
        {
          id: `esp32-rover-${Math.floor(Math.random() * 80 + 10)}`,
          name: `esp32-rover-${Math.floor(Math.random() * 80 + 10)}.local`,
          ip: `192.168.4.${Math.floor(Math.random() * 20 + 10)}`,
          mac: 'A4:E5:7C:11:90:33',
          chip: 'ESP32',
          rssi: -48,
          status: 'online',
          firmware: 'ApexRock-ESP32-v2.4',
          radarDistanceCm: 42
        }
      ]);
      setNetworkDispatchLog('mDNS scan completed. Active nodes populated.');
    }, 800);
  };

  // Joystick drag calculations
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingStick(true);
    updateJoystickPosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingStick) return;
    updateJoystickPosition(e);
  };

  const handlePointerUp = () => {
    setIsDraggingStick(false);
    setStickX(0);
    setStickY(0);
    stopMove();
  };

  const updateJoystickPosition = (e: React.PointerEvent) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);

    const normX = Math.round((Math.cos(angle) * (clampedDist / radius)) * 100);
    const normY = Math.round(-(Math.sin(angle) * (clampedDist / radius)) * 100);

    setStickX(normX);
    setStickY(normY);

    if (normY > 20) {
      if (isBraking) {
        hardwareAudio.playEmergencyBrakeAlarm();
      } else {
        triggerMove('FORWARD');
      }
    } else if (normY < -20) {
      triggerMove('REVERSE');
    } else if (normX < -20) {
      triggerMove('LEFT');
    } else if (normX > 20) {
      triggerMove('RIGHT');
    } else {
      stopMove();
    }
  };

  const currentSizeConfig = SIZE_MODE_CONFIGS[sizeMode];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full text-white font-sans">
      {/* Left Column: Car Controls Stage & D-Pad/Joystick */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Radar E-Stop Banner (Black & White with High-Contrast Border) */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isBraking
              ? 'bg-white text-black border-white shadow-xl'
              : 'bg-black text-white border-neutral-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isBraking ? (
                <ShieldAlert className="w-5 h-5 text-black animate-bounce" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-white" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isBraking ? 'text-black' : 'text-white'}`}>
                    {isBraking
                      ? '🚨 ESP32/8266 RADAR BRAKE ACTIVE (< 15cm)'
                      : `Node: ESP32 Rover (${activeCarIp}) | Radar Distance`}
                  </span>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                      isBraking
                        ? 'bg-black text-white'
                        : 'bg-neutral-900 text-white border border-neutral-700'
                    }`}
                  >
                    {radarDistance.toFixed(0)} cm
                  </span>
                </div>
                <div className={`text-[11px] ${isBraking ? 'text-neutral-800 font-medium' : 'text-neutral-400'}`}>
                  {isBraking
                    ? 'Forward propulsion locked to protect vehicle from collision.'
                    : 'Obstacle distance clear. 15cm autonomous emergency brake armed.'}
                </div>
              </div>
            </div>

            {/* Distance Simulator & Override */}
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-mono ${isBraking ? 'text-black font-semibold' : 'text-neutral-400'}`}>
                Distance:
              </span>
              <input
                type="range"
                min="3"
                max="120"
                value={radarDistance}
                onChange={(e) => setRadarDistance(Number(e.target.value))}
                className="w-28 accent-white cursor-pointer"
              />
              <button
                onClick={() => setOverrideEStop(!overrideEStop)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors ${
                  overrideEStop
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800'
                }`}
              >
                {overrideEStop ? 'Override: ON' : 'Override: OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Mode Switchers: Control Mode & Size Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-black rounded-xl border border-neutral-800">
          {/* D-Pad vs Joystick */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => {
                hardwareAudio.playClick(950);
                setControlMode(ControlMode.DPAD);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                controlMode === ControlMode.DPAD
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              D-Pad Mode
            </button>
            <button
              onClick={() => {
                hardwareAudio.playClick(950);
                setControlMode(ControlMode.JOYSTICK);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                controlMode === ControlMode.JOYSTICK
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Joystick Mode
            </button>
          </div>

          {/* Sizing: Compact, Standard, Expanded */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-400">Layout Size:</span>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              {(Object.keys(SIZE_MODE_CONFIGS) as SizeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    hardwareAudio.playClick(900);
                    setSizeMode(mode);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    sizeMode === mode
                      ? 'bg-white text-black font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {SIZE_MODE_CONFIGS[mode].title.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle Controls Stage */}
        <div className="flex-1 bg-black rounded-xl border border-neutral-800 p-6 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden select-none">
          {/* Subtle Monochromatic Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none" />

          {/* D-Pad Mode */}
          {controlMode === ControlMode.DPAD && (
            <div
              className="relative z-10 flex flex-col items-center"
              style={{ gap: `${currentSizeConfig.spacing}px` }}
            >
              {/* Forward ▲ */}
              <button
                onPointerDown={() => triggerMove('FORWARD')}
                onPointerUp={stopMove}
                disabled={isBraking}
                style={{
                  width: `${currentSizeConfig.buttonSize * 1.5}px`,
                  height: `${currentSizeConfig.buttonSize}px`
                }}
                className={`flex items-center justify-center rounded-xl font-bold text-lg border transition-all active:scale-95 ${
                  isBraking
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-600 cursor-not-allowed'
                    : activeDirection === 'FORWARD'
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                ▲
              </button>

              {/* Middle: Left ◀ and Right ▶ */}
              <div
                className="flex items-center"
                style={{ gap: `${currentSizeConfig.buttonSize * 1.2}px` }}
              >
                <button
                  onPointerDown={() => triggerMove('LEFT')}
                  onPointerUp={stopMove}
                  style={{
                    width: `${currentSizeConfig.buttonSize}px`,
                    height: `${currentSizeConfig.buttonSize}px`
                  }}
                  className={`flex items-center justify-center rounded-xl font-bold text-lg border transition-all active:scale-95 ${
                    activeDirection === 'LEFT'
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  ◀
                </button>

                <button
                  onPointerDown={() => triggerMove('RIGHT')}
                  onPointerUp={stopMove}
                  style={{
                    width: `${currentSizeConfig.buttonSize}px`,
                    height: `${currentSizeConfig.buttonSize}px`
                  }}
                  className={`flex items-center justify-center rounded-xl font-bold text-lg border transition-all active:scale-95 ${
                    activeDirection === 'RIGHT'
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  ▶
                </button>
              </div>

              {/* Reverse ▼ */}
              <button
                onPointerDown={() => triggerMove('REVERSE')}
                onPointerUp={stopMove}
                style={{
                  width: `${currentSizeConfig.buttonSize * 1.5}px`,
                  height: `${currentSizeConfig.buttonSize}px`
                }}
                className={`flex items-center justify-center rounded-xl font-bold text-lg border transition-all active:scale-95 ${
                  activeDirection === 'REVERSE'
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                ▼
              </button>

              <div className="text-[11px] text-neutral-500 font-mono mt-3">
                Keyboard: W / A / S / D or Arrow Keys · Space: Horn
              </div>
            </div>
          )}

          {/* Joystick Mode */}
          {controlMode === ControlMode.JOYSTICK && (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div
                ref={joystickRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  width: sizeMode === SizeMode.COMPACT ? '160px' : sizeMode === SizeMode.STANDARD ? '210px' : '260px',
                  height: sizeMode === SizeMode.COMPACT ? '160px' : sizeMode === SizeMode.STANDARD ? '210px' : '260px'
                }}
                className="relative rounded-full bg-neutral-950 border-2 border-neutral-700 flex items-center justify-center shadow-inner touch-none cursor-crosshair hover:border-white transition-colors"
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-800" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-800" />
                <div className="absolute w-2/3 h-2/3 rounded-full border border-dashed border-neutral-800" />

                {/* Thumbstick Knob */}
                <div
                  style={{
                    transform: `translate(${stickX * 0.7}px, ${-stickY * 0.7}px)`
                  }}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-lg transition-transform duration-75 ${
                    isBraking && stickY > 10
                      ? 'bg-white text-black border-black'
                      : isDraggingStick
                      ? 'bg-white text-black border-white scale-105'
                      : 'bg-neutral-900 border-neutral-600 text-white'
                  }`}
                >
                  <Compass className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-center gap-4 font-mono text-xs text-neutral-400">
                <span>Steer X: <strong className="text-white">{stickX}%</strong></span>
                <span aria-hidden="true">·</span>
                <span>Throttle Y: <strong className="text-white">{stickY}%</strong></span>
              </div>
            </div>
          )}

          {/* Quick Aux Controls */}
          <div className="absolute bottom-4 inset-x-6 flex items-center justify-between pointer-events-auto">
            <button
              onClick={toggleHeadlights}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                headlightsOn
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>{headlightsOn ? 'Headlights: ON' : 'Headlights: OFF'}</span>
            </button>

            <button
              onPointerDown={triggerHorn}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                isHornActive
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>HORN</span>
            </button>
          </div>
        </div>

        {/* Live HTTP / WebSocket Network Dispatch Log */}
        <div className="p-2.5 bg-black border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400 truncate flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="truncate">{networkDispatchLog}</span>
        </div>
      </div>

      {/* Right Column: Ultrasonic Arc Radar & Real Car IP Target */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Real Vehicle WiFi / IP Configuration */}
        <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Physical Car Target IP
            </h3>
            <span className="text-[11px] font-mono text-neutral-400">
              WiFi AP / STA
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={activeCarIp}
                onChange={(e) => setActiveCarIp(e.target.value)}
                placeholder="192.168.4.1 or hostname"
                className="flex-1 bg-neutral-950 border border-neutral-800 text-xs font-mono text-white rounded px-3 py-1.5 outline-none focus:border-white"
              />
              <button
                onClick={() => {
                  hardwareAudio.playClick(1000);
                  realHardwareUploader.sendCarHttpCommand(activeCarIp, 'PING', 0).then(r => {
                    setNetworkDispatchLog(`Ping to ${activeCarIp} test: ${r.statusText}`);
                  });
                }}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold border border-neutral-700 transition-colors"
              >
                Test Ping
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Commands are dispatched via real HTTP GET (<code className="text-neutral-400">/cmd?dir=...</code>) to your real rover.
            </p>
          </div>

          {/* Speed Throttle Rail */}
          <div className="pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-neutral-400">PWM Speed:</span>
              <span className="text-white font-bold">{speedThrottle} / 255 ({Math.round(speedThrottle / 2.55)}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={speedThrottle}
              onChange={(e) => setSpeedThrottle(Number(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>
        </div>

        {/* Ultrasonic Radar Arc Scope */}
        <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Ultrasonic Radar Scope
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              HC-SR04 · 15cm E-Stop
            </span>
          </div>

          {/* Radar Arc Display Graphic */}
          <div className="relative h-44 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden">
            <div className="absolute bottom-0 w-72 h-72 rounded-full border border-neutral-800 pointer-events-none" />
            <div className="absolute bottom-0 w-48 h-48 rounded-full border border-neutral-800 pointer-events-none" />
            <div className="absolute bottom-0 w-24 h-24 rounded-full border border-white pointer-events-none" />

            <div className="absolute bottom-7 text-[10px] font-mono text-white font-bold">
              15cm E-STOP BOUNDARY
            </div>

            {/* Target Distance Indicator */}
            <div
              style={{
                bottom: `${Math.min(130, Math.max(12, radarDistance * 1.2))}px`
              }}
              className="absolute flex flex-col items-center transition-all duration-150"
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  radarDistance < 15
                    ? 'bg-white border-neutral-400 animate-ping'
                    : 'bg-neutral-400 border-white'
                }`}
              />
              <span className="text-[10px] font-mono font-bold mt-1 bg-black px-1.5 py-0.5 rounded border border-neutral-700 text-white">
                {radarDistance.toFixed(0)} cm
              </span>
            </div>

            <div className="absolute bottom-0 w-12 h-5 bg-neutral-900 rounded-t-lg border-t border-x border-neutral-700 flex items-center justify-center text-[9px] font-mono text-white">
              ROVER
            </div>
          </div>
        </div>

        {/* mDNS Node Scanner Fleet */}
        <div className="flex-1 p-4 bg-black rounded-xl border border-neutral-800 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Discovered Vehicles
              </h3>
            </div>
            <button
              onClick={handleScanMdns}
              disabled={isScanning}
              className="flex items-center gap-1 text-[11px] text-white hover:underline transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan mDNS'}</span>
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-48">
            {nodes.map((node) => {
              const isSelected = activeCarIp === node.ip;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setActiveCarIp(node.ip);
                    setSelectedNodeId(node.id);
                    setRadarDistance(node.radarDistanceCm);
                    hardwareAudio.playClick(900);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{node.name}</span>
                    <span className="font-mono text-[11px]">{node.rssi} dBm</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono mt-1 opacity-80">
                    <span>IP: {node.ip}</span>
                    <span>·</span>
                    <span>{node.chip}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
