// ============================================================================
// APEXROCK AUTOMATION: MODULE D - SERIAL MONITOR & 60 FPS LTTB PLOTTER
// High-Contrast Monochromatic Black & White Oscilloscope & WebSerial Terminal
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  DecodedPacket,
  PacketPriority,
  SerialLogEntry,
  TelemetryPoint
} from '../types/apex';
import { ApexLttbDecimator } from '../services/ApexLttbDecimator';
import { ApexBinaryProtocol } from '../services/ApexBinaryProtocol';
import { globalSendQueue } from '../services/ApexSendQueue';
import { hardwareAudio } from '../services/audioSynthesizer';
import { hardwareBridge } from '../services/serialConnection';
import { realHardwareUploader } from '../services/realHardwareUploader';
import {
  Activity,
  Terminal,
  Send,
  Trash2,
  Pause,
  Play,
  Download,
  Usb,
  CheckCircle,
  XCircle
} from 'lucide-react';

export const SerialMonitorView: React.FC = () => {
  // Plotter configuration
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [lttbThreshold, setLttbThreshold] = useState<number>(180);
  const [activeChannels, setActiveChannels] = useState<{
    radar: boolean;
    pwm: boolean;
    accel: boolean;
    mic: boolean;
  }>({
    radar: true,
    pwm: true,
    accel: true,
    mic: true
  });

  // Plotter telemetry stats
  const [rawCount, setRawCount] = useState<number>(0);
  const [decimatedCount, setDecimatedCount] = useState<number>(0);
  const [liveFps, setLiveFps] = useState<number>(60);

  // Terminal & Logs
  const [logs, setLogs] = useState<SerialLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'RX' | 'TX' | 'WARN'>('ALL');
  const [displayFormat, setDisplayFormat] = useState<'ASCII' | 'HEX'>('ASCII');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [txInput, setTxInput] = useState<string>('PING');
  const [selectedBaud, setSelectedBaud] = useState<number>(115200);

  // Decoded packet inspector
  const [latestPacket, setLatestPacket] = useState<DecodedPacket | null>(null);
  const [queueLengths, setQueueLengths] = useState<Record<PacketPriority, number>>({
    [PacketPriority.EMERGENCY]: 0,
    [PacketPriority.COMMAND]: 0,
    [PacketPriority.STREAM]: 0,
    [PacketPriority.BULK]: 0
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubLog = hardwareBridge.subscribeLog((entry) => {
      setLogs((prev) => [...prev.slice(-300), entry]);
    });

    const unsubPacket = hardwareBridge.subscribePackets((packet) => {
      setLatestPacket(packet);
    });

    return () => {
      unsubLog();
      unsubPacket();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setQueueLengths(globalSendQueue.getQueueLengths());
    }, 150);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // 60 FPS Canvas Plotter Loop with Monochromatic LTTB Render
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCounter = 0;

    const render = (time: number) => {
      frameCounter++;
      if (time - lastTime >= 1000) {
        setLiveFps(frameCounter);
        frameCounter = 0;
        lastTime = time;
      }

      if (!isPaused && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          // Pure Black Backdrop
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // Subtle hairline grid
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x < width; x += 60) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = 0; y < height; y += 40) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();

          // Raw points
          const rawRadar = hardwareBridge.getRawPoints('radar');
          const rawPwm = hardwareBridge.getRawPoints('pwm');
          const rawAccel = hardwareBridge.getRawPoints('accel');
          const rawMic = hardwareBridge.getRawPoints('mic');

          setRawCount(rawRadar.length);

          // Decimate and draw with high contrast monochrome lines
          if (activeChannels.radar && rawRadar.length > 2) {
            const decimated = ApexLttbDecimator.decimate(rawRadar, lttbThreshold);
            setDecimatedCount(decimated.length);
            drawChannelPath(ctx, decimated, '#ffffff', 2.0, width, height, 0, 160); // Pure White
          }
          if (activeChannels.pwm && rawPwm.length > 2) {
            const decimated = ApexLttbDecimator.decimate(rawPwm, lttbThreshold);
            drawChannelPath(ctx, decimated, '#a3a3a3', 1.6, width, height, 0, 260); // Neutral Silver
          }
          if (activeChannels.accel && rawAccel.length > 2) {
            const decimated = ApexLttbDecimator.decimate(rawAccel, lttbThreshold);
            drawChannelPath(ctx, decimated, '#737373', 1.4, width, height, 0, 200); // Muted Gray
          }
          if (activeChannels.mic && rawMic.length > 2) {
            const decimated = ApexLttbDecimator.decimate(rawMic, lttbThreshold);
            drawChannelPath(ctx, decimated, '#525252', 1.2, width, height, 0, 100); // Dark Gray
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, lttbThreshold, activeChannels]);

  const drawChannelPath = (
    ctx: CanvasRenderingContext2D,
    pts: TelemetryPoint[],
    color: string,
    lineWidth: number,
    width: number,
    height: number,
    minY: number,
    maxY: number
  ) => {
    if (pts.length < 2) return;

    const minX = pts[0].x;
    const maxX = pts[pts.length - 1].x;
    const rangeX = maxX - minX === 0 ? 1 : maxX - minX;
    const rangeY = maxY - minY === 0 ? 1 : maxY - minY;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    pts.forEach((pt, idx) => {
      const x = ((pt.x - minX) / rangeX) * width;
      const y = height - ((pt.y - minY) / rangeY) * (height - 20) - 10;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  const handleSendTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txInput.trim()) return;

    hardwareAudio.playClick(1000);
    const isHexInput = txInput.trim().includes(' ') && /^[0-9A-Fa-f\s]+$/.test(txInput.trim());

    if (isHexInput) {
      const hexParts = txInput.trim().split(/\s+/).map((h) => parseInt(h, 16));
      const bytes = new Uint8Array(hexParts);
      hardwareBridge.emitLog({
        type: 'TX',
        text: `[TX-RAW-HEX] ${txInput.toUpperCase()}`,
        rawBytes: bytes
      });
      if (realHardwareUploader.isConnected()) {
        realHardwareUploader.writeBytes(bytes);
      }
    } else {
      hardwareBridge.sendRawAscii(txInput.trim());
    }

    setTxInput('');
  };

  const handleBaudChange = (baud: number) => {
    setSelectedBaud(baud);
    hardwareBridge.setBaudRate(baud);
    hardwareAudio.playClick(900);
  };

  const handleConnectUsb = async () => {
    hardwareAudio.playClick(1100);
    await hardwareBridge.requestWebSerial();
  };

  const handleExportCsv = () => {
    hardwareAudio.playClick(1100);
    const radarPts = hardwareBridge.getRawPoints('radar');
    const pwmPts = hardwareBridge.getRawPoints('pwm');
    let csv = 'index,radar_cm,motor_pwm\n';
    const maxLen = Math.max(radarPts.length, pwmPts.length);
    for (let i = 0; i < maxLen; i++) {
      const r = radarPts[i]?.y ?? 0;
      const p = pwmPts[i]?.y ?? 0;
      csv += `${i},${r.toFixed(2)},${p.toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexrock_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'RX') return log.type === 'RX';
    if (logFilter === 'TX') return log.type === 'TX';
    if (logFilter === 'WARN') return log.type === 'WARN' || log.type === 'ERROR';
    return true;
  });

  return (
    <div className="flex flex-col gap-4 h-full text-white font-sans">
      {/* Top Telemetry Stats & Queue Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Priority Dispatcher */}
        <div className="p-3 bg-black rounded-xl border border-neutral-800 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>SendQueue Dispatcher</span>
            <span className="font-mono text-white">4-Tier</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-center">
            <div className="bg-neutral-900 border border-neutral-700 rounded py-1 text-white">
              <div className="font-bold">{queueLengths[PacketPriority.EMERGENCY]}</div>
              <div className="text-[9px] text-neutral-400">EMERG</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-700 rounded py-1 text-white">
              <div className="font-bold">{queueLengths[PacketPriority.COMMAND]}</div>
              <div className="text-[9px] text-neutral-400">CMD</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-700 rounded py-1 text-white">
              <div className="font-bold">{queueLengths[PacketPriority.STREAM]}</div>
              <div className="text-[9px] text-neutral-400">STREAM</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-700 rounded py-1 text-white">
              <div className="font-bold">{queueLengths[PacketPriority.BULK]}</div>
              <div className="text-[9px] text-neutral-400">BULK</div>
            </div>
          </div>
        </div>

        {/* LTTB Decimator Metric */}
        <div className="p-3 bg-black rounded-xl border border-neutral-800 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>LTTB Telemetry Decimator</span>
            <span className="font-mono text-white font-bold">{liveFps} FPS</span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <div>
              <span className="text-xl font-bold text-white">{rawCount}</span>
              <span className="text-xs text-neutral-400 ml-1">pts raw</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-neutral-400">↓ Decimated:</span>
              <span className="text-sm font-bold text-white ml-1.5">{decimatedCount}</span>
            </div>
          </div>
        </div>

        {/* Binary Protocol Frame Inspection */}
        <div className="col-span-1 md:col-span-2 p-3 bg-black rounded-xl border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            <span>Framed Binary Protocol (SOF: 0x7E, EOF: 0x7F)</span>
            {latestPacket && (
              <span className="flex items-center gap-1 font-mono text-[11px] text-white">
                {latestPacket.validCrc ? <CheckCircle className="w-3 h-3 text-white" /> : <XCircle className="w-3 h-3 text-neutral-400" />}
                CRC-16: 0x{latestPacket.crcReceived.toString(16).toUpperCase()} {latestPacket.validCrc ? 'OK' : 'ERR'}
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-neutral-300 truncate">
            {latestPacket ? (
              <span>
                Cmd: <strong className="text-white">{latestPacket.commandName}</strong> (0x{latestPacket.commandId.toString(16).padStart(4, '0')}) · Len: {latestPacket.payloadLength} B · Priority: {latestPacket.priority}
              </span>
            ) : (
              <span className="text-neutral-500">Awaiting binary frames...</span>
            )}
          </div>
        </div>
      </div>

      {/* 60 FPS Monochromatic Oscilloscope */}
      <div className="bg-black rounded-xl border border-neutral-800 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-white" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              60 FPS Oscilloscope Stream
            </h3>

            {/* Monochromatic Channel Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveChannels(prev => ({ ...prev, radar: !prev.radar }))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                  activeChannels.radar
                    ? 'bg-white text-black border-white font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}
              >
                <span>●</span>
                <span>Ch1: Radar (White)</span>
              </button>

              <button
                onClick={() => setActiveChannels(prev => ({ ...prev, pwm: !prev.pwm }))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                  activeChannels.pwm
                    ? 'bg-neutral-300 text-black border-neutral-300 font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}
              >
                <span>●</span>
                <span>Ch2: PWM (Silver)</span>
              </button>

              <button
                onClick={() => setActiveChannels(prev => ({ ...prev, accel: !prev.accel }))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                  activeChannels.accel
                    ? 'bg-neutral-400 text-black border-neutral-400 font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}
              >
                <span>●</span>
                <span>Ch3: Accel Y (Gray)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                hardwareAudio.playClick(900);
                setIsPaused(!isPaused);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              onClick={() => {
                hardwareAudio.playClick(900);
                hardwareBridge.clearHistory();
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-neutral-200 text-black rounded transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Canvas Oscilloscope Viewport */}
        <div className="relative rounded-lg overflow-hidden border border-neutral-800 h-64 bg-black">
          <canvas
            ref={canvasRef}
            width={1100}
            height={260}
            className="w-full h-full block cursor-crosshair"
          />

          <div className="absolute bottom-2 right-3 flex items-center gap-2 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800 text-[11px] font-mono text-neutral-300">
            <span>Threshold:</span>
            <input
              type="range"
              min="50"
              max="400"
              step="10"
              value={lttbThreshold}
              onChange={(e) => setLttbThreshold(Number(e.target.value))}
              className="w-20 accent-white cursor-pointer"
            />
            <span className="text-white font-bold">{lttbThreshold}</span>
          </div>
        </div>
      </div>

      {/* High-Speed Serial Monitor Terminal Console */}
      <div className="flex-1 bg-black rounded-xl border border-neutral-800 flex flex-col overflow-hidden min-h-[300px]">
        {/* Terminal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white">
              ArduinoDroid Serial Terminal
            </span>

            {/* Baud Picker */}
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <span>Baud:</span>
              <select
                value={selectedBaud}
                onChange={(e) => handleBaudChange(Number(e.target.value))}
                className="bg-black border border-neutral-700 text-white rounded px-2 py-0.5 font-mono outline-none"
              >
                <option value={9600}>9600</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
                <option value={921600}>921600</option>
              </select>
            </div>

            {/* Connect USB Port Button */}
            <button
              onClick={handleConnectUsb}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded transition-colors"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>Connect USB Port</span>
            </button>
          </div>

          {/* Filters & Format */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-neutral-800 text-[11px]">
              {(['ALL', 'RX', 'TX', 'WARN'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2 py-0.5 rounded ${
                    logFilter === filter
                      ? 'bg-white text-black font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-neutral-800 text-[11px]">
              <button
                onClick={() => setDisplayFormat('ASCII')}
                className={`px-2 py-0.5 rounded ${
                  displayFormat === 'ASCII' ? 'bg-white text-black font-semibold' : 'text-neutral-400'
                }`}
              >
                ASCII
              </button>
              <button
                onClick={() => setDisplayFormat('HEX')}
                className={`px-2 py-0.5 rounded ${
                  displayFormat === 'HEX' ? 'bg-white text-black font-semibold' : 'text-neutral-400'
                }`}
              >
                HEX
              </button>
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                autoScroll ? 'bg-white text-black border-white' : 'bg-black border-neutral-800 text-neutral-400'
              }`}
            >
              Autoscroll
            </button>

            <button
              onClick={() => setLogs([])}
              title="Clear terminal log"
              className="p-1 text-neutral-400 hover:text-white rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Text Body */}
        <div className="flex-1 p-3 bg-black font-mono text-xs overflow-y-auto space-y-1 max-h-72 leading-relaxed selection:bg-neutral-800">
          {filteredLogs.map((log) => {
            const isWarn = log.type === 'WARN' || log.type === 'ERROR';
            const isRx = log.type === 'RX';
            const isTx = log.type === 'TX';

            return (
              <div
                key={log.id}
                className={`flex items-start gap-2 ${
                  isWarn
                    ? 'text-white font-bold bg-neutral-900 px-1 rounded'
                    : isRx
                    ? 'text-neutral-200'
                    : isTx
                    ? 'text-white'
                    : 'text-neutral-400'
                }`}
              >
                <span className="text-neutral-600 select-none text-[10px]">
                  [{log.timestamp}]
                </span>
                <span className="flex-1 break-all">
                  {displayFormat === 'HEX' && log.rawBytes ? (
                    <span>
                      {log.text.split(']')[0]}] {ApexBinaryProtocol.bytesToHex(log.rawBytes)}
                    </span>
                  ) : (
                    log.text
                  )}
                </span>
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>

        {/* Send Command Input Form */}
        <form
          onSubmit={handleSendTerminal}
          className="p-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={txInput}
            onChange={(e) => setTxInput(e.target.value)}
            placeholder="Type command or hex bytes (e.g. 'PING', '7E 06 00 00 E3 12 7F')..."
            className="flex-1 bg-black border border-neutral-700 text-xs font-mono text-white rounded-lg px-3 py-2 outline-none focus:border-white"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-bold transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
