// ============================================================================
// APEXROCK AUTOMATION: MODULE C - DABBLE PROTOCOL DASHBOARD
// Black & White Industrial Aesthetic with Real iOS/Android Sensors & Virtual Gamepad
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { hardwareAudio } from '../services/audioSynthesizer';
import { hardwareBridge } from '../services/serialConnection';
import { realHardwareUploader } from '../services/realHardwareUploader';
import { PacketPriority } from '../types/apex';
import {
  Smartphone,
  Mic,
  MicOff,
  Layers,
  Compass,
  Check,
  Radio
} from 'lucide-react';

export const DabbleProtocolView: React.FC = () => {
  // PWM & Actuator sliders
  const [motorPwm, setMotorPwm] = useState<number>(180);
  const [servoAngle, setServoAngle] = useState<number>(90); // 0 to 180 deg

  // Sensor state: Accelerometer & Mic
  const [accelX, setAccelX] = useState<number>(0.2);
  const [accelY, setAccelY] = useState<number>(-0.4);
  const [accelZ, setAccelZ] = useState<number>(9.81);
  const [pitchDeg, setPitchDeg] = useState<number>(0);
  const [rollDeg, setRollDeg] = useState<number>(0);
  const [micDb, setMicDb] = useState<number>(14);
  const [isRealMicActive, setIsRealMicActive] = useState<boolean>(false);
  const [sensorSource, setSensorSource] = useState<'INTERACTIVE_SIM' | 'DEVICE_HARDWARE'>('INTERACTIVE_SIM');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // Active gamepad buttons
  const [pressedButtons, setPressedButtons] = useState<Record<string, boolean>>({});

  // Web Audio Context for real mic
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync to hardware bridge
  useEffect(() => {
    hardwareBridge.updateSensorValues({
      pwm: motorPwm,
      accelX,
      accelY,
      micDb
    });
  }, [motorPwm, accelX, accelY, micDb]);

  // Real Hardware Device Orientation listener if enabled
  useEffect(() => {
    if (sensorSource === 'DEVICE_HARDWARE' && typeof window !== 'undefined') {
      const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.beta !== null && e.gamma !== null) {
          const beta = e.beta;
          const gamma = e.gamma;
          setPitchDeg(Math.round(beta));
          setRollDeg(Math.round(gamma));
          setAccelX(Number((Math.sin((gamma * Math.PI) / 180) * 9.81).toFixed(2)));
          setAccelY(Number((Math.sin((beta * Math.PI) / 180) * 9.81).toFixed(2)));
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [sensorSource]);

  // Request Mobile Hardware Sensor Permission
  const handleToggleDeviceSensors = async () => {
    hardwareAudio.playClick(1000);
    if (sensorSource === 'INTERACTIVE_SIM') {
      const granted = await realHardwareUploader.requestDeviceOrientationPermission();
      if (granted) {
        setPermissionGranted(true);
        setSensorSource('DEVICE_HARDWARE');
        hardwareBridge.emitLog({
          type: 'INFO',
          text: '[DABBLE-SENSORS] DeviceOrientationEvent permission granted by user.'
        });
      } else {
        alert('Device orientation sensors permission was denied or not supported on this device.');
      }
    } else {
      setSensorSource('INTERACTIVE_SIM');
    }
  };

  // Real Web Audio Mic toggle
  const toggleRealMic = async () => {
    hardwareAudio.playClick(1000);
    if (isRealMicActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setIsRealMicActive(false);
      setMicDb(12);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsRealMicActive(true);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateMicLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const val = (buffer[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const db = Math.round(Math.max(0, Math.min(100, 20 * Math.log10(rms * 10 + 0.0001) + 80)));
        setMicDb(db);

        animFrameRef.current = requestAnimationFrame(updateMicLevel);
      };
      updateMicLevel();

      hardwareBridge.emitLog({
        type: 'INFO',
        text: '[DABBLE-MIC] Real microphone audio stream active via Web Audio API'
      });
    } catch {
      hardwareBridge.emitLog({
        type: 'WARN',
        text: '[DABBLE-MIC] Microphone permission denied. Ambient fallback active.'
      });
    }
  };

  const handleGamepadPress = (btn: string) => {
    hardwareAudio.playClick(900);
    setPressedButtons(prev => ({ ...prev, [btn]: true }));

    const payload = new Uint8Array(3);
    payload[0] = btn.charCodeAt(0);
    payload[1] = 1;
    payload[2] = Math.round(motorPwm);

    hardwareBridge.sendCommandPacket(0x0004, payload, PacketPriority.COMMAND);
  };

  const handleGamepadRelease = (btn: string) => {
    setPressedButtons(prev => ({ ...prev, [btn]: false }));

    const payload = new Uint8Array(3);
    payload[0] = btn.charCodeAt(0);
    payload[1] = 0;
    payload[2] = Math.round(motorPwm);

    hardwareBridge.sendCommandPacket(0x0004, payload, PacketPriority.COMMAND);
  };

  const handleMasterPwmChange = (val: number) => {
    setMotorPwm(val);
    const payload = new Uint8Array([Math.round(val), Math.round(val)]);
    hardwareBridge.sendCommandPacket(0x0001, payload, PacketPriority.COMMAND);
  };

  const handleServoChange = (angle: number) => {
    setServoAngle(angle);
    hardwareBridge.sendCommandPacket(0x0007, new Uint8Array([Math.round(angle)]), PacketPriority.COMMAND);
  };

  return (
    <div className="flex flex-col gap-4 h-full text-white font-sans">
      {/* Top Dabble Bridge Telemetry Card (Monochrome High Contrast) */}
      <div className="p-4 bg-black border border-neutral-800 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-white">
              <span>●</span> ApexRock Dabble Protocol Bridge Active
            </h3>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              Sensor Telemetry → Accel X: <strong className="text-white">{accelX.toFixed(1)}</strong> m/s² | Y: <strong className="text-white">{accelY.toFixed(1)}</strong> m/s² | Mic: <strong className="text-white">{micDb.toFixed(0)} dB</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleDeviceSensors}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                sensorSource === 'DEVICE_HARDWARE'
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700'
              }`}
            >
              {sensorSource === 'DEVICE_HARDWARE' ? 'Phone Sensors: ON' : 'Enable Phone Tilt'}
            </button>

            <button
              onClick={toggleRealMic}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isRealMicActive
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700'
              }`}
            >
              {isRealMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{isRealMicActive ? 'Mic: LIVE' : 'Enable Mic'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Virtual Gamepad (D-Pad + △ □ ◯ ✕) */}
        <div className="lg:col-span-7 bg-black rounded-xl border border-neutral-800 p-6 flex flex-col justify-between select-none min-h-[360px]">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Virtual Gamepad (Dabble BLE Protocol)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              Binary Command 0x0004
            </span>
          </div>

          {/* Gamepad Stage */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-around gap-8 my-6">
            {/* Left Cluster: D-Pad */}
            <div className="flex flex-col items-center">
              <button
                onPointerDown={() => handleGamepadPress('UP')}
                onPointerUp={() => handleGamepadRelease('UP')}
                className={`w-14 h-12 rounded-t-xl border font-bold text-base transition-all active:scale-95 ${
                  pressedButtons['UP']
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                ▲
              </button>

              <div className="flex items-center">
                <button
                  onPointerDown={() => handleGamepadPress('LEFT')}
                  onPointerUp={() => handleGamepadRelease('LEFT')}
                  className={`w-14 h-12 rounded-l-xl border font-bold text-base transition-all active:scale-95 ${
                    pressedButtons['LEFT']
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  ◀
                </button>

                <div className="w-12 h-12 bg-neutral-900 border-y border-neutral-800 flex items-center justify-center text-[9px] font-mono text-neutral-400">
                  APEX
                </div>

                <button
                  onPointerDown={() => handleGamepadPress('RIGHT')}
                  onPointerUp={() => handleGamepadRelease('RIGHT')}
                  className={`w-14 h-12 rounded-r-xl border font-bold text-base transition-all active:scale-95 ${
                    pressedButtons['RIGHT']
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  ▶
                </button>
              </div>

              <button
                onPointerDown={() => handleGamepadPress('DOWN')}
                onPointerUp={() => handleGamepadRelease('DOWN')}
                className={`w-14 h-12 rounded-b-xl border font-bold text-base transition-all active:scale-95 ${
                  pressedButtons['DOWN']
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                ▼
              </button>
            </div>

            {/* Right Cluster: Action Buttons △ □ ◯ ✕ */}
            <div className="flex flex-col items-center">
              {/* △ Triangle */}
              <button
                onPointerDown={() => handleGamepadPress('TRIANGLE')}
                onPointerUp={() => handleGamepadRelease('TRIANGLE')}
                className={`w-14 h-14 rounded-full border-2 font-bold text-lg transition-all active:scale-90 flex items-center justify-center ${
                  pressedButtons['TRIANGLE']
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                △
              </button>

              <div className="flex items-center gap-6 my-1">
                {/* □ Square */}
                <button
                  onPointerDown={() => handleGamepadPress('SQUARE')}
                  onPointerUp={() => handleGamepadRelease('SQUARE')}
                  className={`w-14 h-14 rounded-full border-2 font-bold text-lg transition-all active:scale-90 flex items-center justify-center ${
                    pressedButtons['SQUARE']
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  □
                </button>

                {/* ◯ Circle */}
                <button
                  onPointerDown={() => handleGamepadPress('CIRCLE')}
                  onPointerUp={() => handleGamepadRelease('CIRCLE')}
                  className={`w-14 h-14 rounded-full border-2 font-bold text-lg transition-all active:scale-90 flex items-center justify-center ${
                    pressedButtons['CIRCLE']
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                  }`}
                >
                  ◯
                </button>
              </div>

              {/* ✕ Cross */}
              <button
                onPointerDown={() => handleGamepadPress('CROSS')}
                onPointerUp={() => handleGamepadRelease('CROSS')}
                className={`w-14 h-14 rounded-full border-2 font-bold text-lg transition-all active:scale-90 flex items-center justify-center ${
                  pressedButtons['CROSS']
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-neutral-950 hover:bg-neutral-900 text-white border-neutral-700 hover:border-white'
                }`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Actuator Sliders (PWM & Servo) */}
          <div className="pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-neutral-400">Dabble PWM Motor Speed:</span>
                <span className="text-white font-bold">{motorPwm} / 255</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={motorPwm}
                onChange={(e) => handleMasterPwmChange(Number(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-neutral-400">Pan/Tilt Servo Angle:</span>
                <span className="text-white font-bold">{servoAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                value={servoAngle}
                onChange={(e) => handleServoChange(Number(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Phone Sensors & Microphone Spectrum */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* 3D Virtual Phone Sensor Tilt Visualizer */}
          <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Phone Sensors (Accel & Gyro)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                6-DOF Real-Time
              </span>
            </div>

            {/* 3D Visualizer Box */}
            <div className="h-36 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center relative overflow-hidden [perspective:500px]">
              <div
                style={{
                  transform: `rotateX(${-pitchDeg}deg) rotateY(${rollDeg}deg)`
                }}
                className="w-24 h-40 bg-neutral-900 rounded-xl border-2 border-white shadow-2xl transition-transform duration-100 flex flex-col items-center justify-between p-2"
              >
                <div className="w-6 h-1 bg-neutral-600 rounded-full" />
                <div className="text-center font-mono text-[9px] text-white">
                  <div>X: {accelX.toFixed(1)}</div>
                  <div>Y: {accelY.toFixed(1)}</div>
                </div>
                <div className="w-3 h-3 rounded-full border border-neutral-600" />
              </div>
            </div>

            {/* Interactive Tilt Sliders */}
            <div className="space-y-2 text-xs font-mono">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Pitch (Y-Axis):</span>
                  <span className="text-white font-bold">{pitchDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={pitchDeg}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    setPitchDeg(p);
                    setAccelY(Number((Math.sin((p * Math.PI) / 180) * 9.81).toFixed(2)));
                  }}
                  className="w-full accent-white cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Roll (X-Axis):</span>
                  <span className="text-white font-bold">{rollDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={rollDeg}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setRollDeg(r);
                    setAccelX(Number((Math.sin((r * Math.PI) / 180) * 9.81).toFixed(2)));
                  }}
                  className="w-full accent-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Microphone Decibel SPL Meter */}
          <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Microphone Decibel Monitor
                </h3>
              </div>
              <span className="font-mono text-xs text-white font-bold">
                {micDb.toFixed(0)} dB SPL
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800 flex">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{ width: `${Math.min(100, (micDb / 90) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                <span>0 dB</span>
                <span>30 dB</span>
                <span>60 dB (Voice)</span>
                <span>90+ dB (Loud)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
