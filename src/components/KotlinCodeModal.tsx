// ============================================================================
// APEXROCK AUTOMATION: ANDROID 17 JETPACK COMPOSE SOURCE CODE VIEWER
// Displays the original production Kotlin source with copy & export capabilities
// ============================================================================

import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode } from 'lucide-react';
import { hardwareAudio } from '../services/audioSynthesizer';

interface KotlinCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KOTLIN_CODE = `// ============================================================================
// APEXROCK AUTOMATION: ADVANCED UNIFIED MASTER WORKSTATION WITH SENSORS
// Target: Android 17 (API 37)+ / Jetpack Compose
// ============================================================================

package com.apexrock.automation

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.EnumMap
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.math.abs

// --- 1. CORE ROUTING & NAVIGATION ENUM ---
enum class DashboardMode(val title: String, val subtitle: String) {
    ARDUINO_DROID("Arduino Droid", "C++ Sketch Editor, USB OTG & Wireless OTA Flashing"),
    CONTROL_CAR("ESP8266 / ESP32 Car", "mDNS Node Scanner, Dual Joysticks & 15cm Radar E-Stop"),
    DABBLE_PROTOCOL("Dabble Protocol", "Virtual Gamepad, Phone Sensors (Accel/Gyro/Mic) & PWM Sliders"),
    SERIAL_MONITOR("High-Speed Monitor", "Framed Binary Protocol & 60fps LTTB Telemetry Plotter")
}

// --- 2. PRIORITY PACKET DISPATCHER (ApexSendQueue) ---
enum class PacketPriority { EMERGENCY, COMMAND, STREAM, BULK }

class ApexSendQueue {
    private val queues = EnumMap<PacketPriority, ConcurrentLinkedQueue<ByteArray>>(PacketPriority::class.java).apply {
        PacketPriority.entries.forEach { put(it, ConcurrentLinkedQueue()) }
    }

    fun enqueue(priority: PacketPriority, packet: ByteArray) {
        queues[priority]?.offer(packet)
    }

    fun pollNextPacket(): ByteArray? {
        for (priority in PacketPriority.entries) {
            val packet = queues[priority]?.poll()
            if (packet != null) return packet
        }
        return null
    }
}

// --- 3. FRAMED BINARY PROTOCOL & CRC-16 ---
object ApexBinaryProtocol {
    private const val SOF: Byte = 0x7E.toByte()
    private const val EOF: Byte = 0x7F.toByte()
    private const val ESC: Byte = 0x7D.toByte()

    fun calculateCrc16(data: ByteArray, length: Int): Int {
        var crc = 0xFFFF
        for (i in 0 until length) {
            crc = (crc xor ((data[i].toInt() and 0xFF) shl 8))
            for (j in 0 until 8) {
                crc = if ((crc and 0x8000) != 0) (crc shl 1) xor 0x1021 else (crc shl 1)
            }
        }
        return crc and 0xFFFF
    }

    fun encodeFrame(commandId: Short, payload: ByteArray): ByteArray {
        val raw = ByteBuffer.allocate(4 + payload.size).order(ByteOrder.LITTLE_ENDIAN)
            .putShort(commandId)
            .putShort(payload.size.toShort())
            .put(payload)
            .array()

        val crc = calculateCrc16(raw, raw.size)
        val packet = ByteBuffer.allocate(raw.size + 2).order(ByteOrder.LITTLE_ENDIAN)
            .put(raw)
            .putShort(crc.toShort())
            .array()

        val stuffed = mutableListOf<Byte>(SOF)
        for (b in packet) {
            if (b == SOF || b == EOF || b == ESC) {
                stuffed.add(ESC)
                stuffed.add((b.toInt() xor 0x20).toByte())
            } else {
                stuffed.add(b)
            }
        }
        stuffed.add(EOF)
        return stuffed.toByteArray()
    }
}

// --- 4. 60 FPS LTTB TELEMETRY DECIMATOR ---
data class TelemetryPoint(val x: Float, val y: Float)

object ApexLttbDecimator {
    fun decimate(data: List<TelemetryPoint>, threshold: Int): List<TelemetryPoint> {
        if (threshold >= data.size || threshold <= 2) return data
        val sampled = ArrayList<TelemetryPoint>(threshold)
        val bucketSize = (data.size - 2).toDouble() / (threshold - 2)

        sampled.add(data[0])
        var lastIndex = 0

        for (i in 0 until threshold - 2) {
            val rangeStart = ((i + 1) * bucketSize).toInt() + 1
            val rangeEnd = kotlin.math.min(((i + 2) * bucketSize).toInt() + 1, data.size)

            var avgX = 0f
            var avgY = 0f
            for (j in rangeStart until rangeEnd) {
                avgX += data[j].x
                avgY += data[j].y
            }
            val len = (rangeEnd - rangeStart).toFloat()
            if (len > 0f) {
                avgX /= len
                avgY /= len
            }

            val refX = data[lastIndex].x
            val refY = data[lastIndex].y
            var maxArea = -1.0
            var maxIdx = rangeStart

            for (j in ((i * bucketSize).toInt() + 1) until rangeStart) {
                val area = abs(
                    (refX - avgX) * (data[j].y - refY) -
                    (refX - data[j].x) * (avgY - refY)
                ) * 0.5
                if (area > maxArea) {
                    maxArea = area
                    maxIdx = j
                }
            }
            sampled.add(data[maxIdx])
            lastIndex = maxIdx
        }
        sampled.add(data[data.size - 1])
        return sampled
    }
}

// --- 5. MAIN ACTIVITY HOST WITH SENSOR PERMISSIONS ---
class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle sensor / microphone permissions result
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Request runtime permissions for sensors & microphone
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        )

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ApexRockMasterDashboard()
                }
            }
        }
    }
}

@Composable
fun ApexRockMasterDashboard() {
    var currentMode by remember { mutableStateOf(DashboardMode.ARDUINO_DROID) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(10.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // --- TOP NAVIGATION HUB BAR ---
        Column {
            Text(text = "ApexRock Automation: Master Suite", style = MaterialTheme.colorScheme.titleMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                DashboardMode.entries.forEach { mode ->
                    val isSelected = currentMode == mode
                    Button(
                        onClick = { currentMode = mode },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                        ),
                        contentPadding = PaddingValues(1.dp)
                    ) {
                        Text(text = mode.name.substringBefore("_"), fontSize = 9.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // --- ACTIVE DASHBOARD CONTAINER ---
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            when (currentMode) {
                DashboardMode.ARDUINO_DROID -> ArduinoDroidDashboard()
                DashboardMode.CONTROL_CAR -> EspCarControlDashboard()
                DashboardMode.DABBLE_PROTOCOL -> DabbleProtocolDashboard()
                DashboardMode.SERIAL_MONITOR -> SerialMonitorPlotterDashboard()
            }
        }
    }
}
`;

export const KotlinCodeModal: React.FC<KotlinCodeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(KOTLIN_CODE);
    hardwareAudio.playClick(1100);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    hardwareAudio.playClick(1200);
    const blob = new Blob([KOTLIN_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MainActivity.kt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-black border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-bold text-white">
                MainActivity.kt (Target: Android 17 / API 37+ Jetpack Compose)
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Package: com.apexrock.automation · ApexBinaryProtocol & ApexLttbDecimator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-200 text-black rounded-lg transition-colors font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .kt</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-black font-mono text-xs text-neutral-300 leading-relaxed selection:bg-neutral-800">
          <pre>{KOTLIN_CODE}</pre>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>Target Platform: Android Studio with Compose Material3</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded font-semibold text-xs transition-colors border border-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
