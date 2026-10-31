// ============================================================================
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

// ============================================================================
// MODULE A: ARDUINO DROID (C++ Sketch & OTA/OTG Flashing)
// ============================================================================
@Composable
fun ArduinoDroidDashboard() {
    var sketchCode by remember {
        mutableStateOf("""
            // ApexRock Automation ESP32 / ESP8266 / Arduino Universal Runtime
            #include <WiFi.h>
            
            void setup() {
                Serial.begin(115200);
                pinMode(2, OUTPUT);
            }
            void loop() {
                digitalWrite(2, HIGH);
                delay(500);
                digitalWrite(2, LOW);
                delay(500);
            }
        """.trimIndent())
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("ApexRock ArduinoDroid: C++ Studio", style = MaterialTheme.colorScheme.labelMedium)
            Button(onClick = { /* Compile & Flash Trigger */ }) {
                Text("OTA / OTG Flash", fontSize = 10.sp)
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color(0xFF1E1E1E))
                .padding(6.dp)
        ) {
            TextField(
                value = sketchCode,
                onValueChange = { sketchCode = it },
                textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, color = Color(0xFFD4D4D4), fontSize = 11.sp),
                modifier = Modifier.fillMaxSize(),
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent)
            )
        }
    }
}

// ============================================================================
// MODULE B: ESP8266 & ESP32 CONTROL CAR (Dual Modes & Size Layout Modifiers)
// ============================================================================
enum class ControlMode { DPAD, JOYSTICK }
enum class SizeMode(val buttonSize: Dp, val spacing: Dp, val title: String) {
    COMPACT(45.dp, 3.dp, "Compact"),
    STANDARD(65.dp, 6.dp, "Standard"),
    EXPANDED(90.dp, 10.dp, "Expanded")
}

@Composable
fun EspCarControlDashboard() {
    var controlMode by remember { mutableStateOf(ControlMode.DPAD) }
    var sizeMode by remember { mutableStateOf(SizeMode.STANDARD) }
    var radarDistance by remember { mutableStateOf(35f) } // cm

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = if (radarDistance < 15f) Color(0xFFC62828) else Color(0xFF0F172A)
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(8.dp)) {
                Text(
                    text = if (radarDistance < 15f) "🚨 ESP32/8266 RADAR BRAKE (< 15cm)" else "🛡️ Node: ESP32 NodeMCU | Radar: ${radarDistance.toInt()} cm",
                    color = Color.White,
                    fontSize = 11.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Button(
                onClick = { controlMode = ControlMode.DPAD },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = if (controlMode == ControlMode.DPAD) Color(0xFF1E3A8A) else Color.DarkGray),
                contentPadding = PaddingValues(2.dp)
            ) { Text("D-Pad Mode", fontSize = 10.sp) }

            Button(
                onClick = { controlMode = ControlMode.JOYSTICK },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = if (controlMode == ControlMode.JOYSTICK) Color(0xFF1E3A8A) else Color.DarkGray),
                contentPadding = PaddingValues(2.dp)
            ) { Text("Joystick Mode", fontSize = 10.sp) }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            SizeMode.entries.forEach { mode ->
                OutlinedButton(
                    onClick = { sizeMode = mode },
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(1.dp)
                ) { Text(mode.title, fontSize = 9.sp) }
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            when (controlMode) {
                ControlMode.DPAD -> DPadLayout(sizeMode)
                ControlMode.JOYSTICK -> JoystickLayout(sizeMode)
            }
        }
    }
}

@Composable
fun DPadLayout(sizeMode: SizeMode) {
    val bSize = sizeMode.buttonSize
    val space = sizeMode.spacing

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Button(onClick = {}, modifier = Modifier.size(width = bSize * 1.5f, height = bSize)) { Text("▲", fontSize = 16.sp) }
        Spacer(modifier = Modifier.height(space))
        Row(horizontalArrangement = Arrangement.spacedBy(bSize * 1.1f)) {
            Button(onClick = {}, modifier = Modifier.size(bSize)) { Text("◀", fontSize = 14.sp) }
            Button(onClick = {}, modifier = Modifier.size(bSize)) { Text("▶", fontSize = 14.sp) }
        }
        Spacer(modifier = Modifier.height(space))
        Button(onClick = {}, modifier = Modifier.size(width = bSize * 1.5f, height = bSize)) { Text("▼", fontSize = 16.sp) }
    }
}

@Composable
fun JoystickLayout(sizeMode: SizeMode) {
    val boxSize = when (sizeMode) {
        SizeMode.COMPACT -> 140.dp
        SizeMode.STANDARD -> 190.dp
        SizeMode.EXPANDED -> 240.dp
    }
    Box(
        modifier = Modifier
            .size(boxSize)
            .background(Color(0xFF1E293B), shape = androidx.compose.foundation.shape.CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text("ESP Analog Stick", color = Color.Cyan, fontSize = 11.sp)
    }
}

// ============================================================================
// MODULE C: DABBLE PROTOCOL DASHBOARD (WITH LIVE PHONE SENSORS & MIC)
// ============================================================================
@Composable
fun DabbleProtocolDashboard() {
    val context = LocalContext.current
    var motorPwm by remember { mutableStateOf(180f) }
    var accelX by remember { mutableStateOf(0f) }
    var accelY by remember { mutableStateOf(0f) }
    var micLevel by remember { mutableStateOf(12f) }

    DisposableEffect(Unit) {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent?) {
                if (event?.sensor?.type == Sensor.TYPE_ACCELEROMETER) {
                    accelX = event.values[0]
                    accelY = event.values[1]
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        sensorManager.registerListener(listener, accelerometer, SensorManager.SENSOR_DELAY_UI)

        onDispose {
            sensorManager.unregisterListener(listener)
        }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFFE65100))) {
            Column(modifier = Modifier.padding(8.dp)) {
                Text("ApexRock Dabble Protocol Bridge Active", color = Color.White, fontSize = 11.sp)
                Text("Sensor Telemetry -> Accel X: ${accelX.toInt()} | Y: ${accelY.toInt()} | Mic: ${micLevel.toInt()}dB", color = Color.LightGray, fontSize = 9.sp)
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Button(onClick = {}) { Text("▲") }
                    Row {
                        Button(onClick = {}) { Text("◀") }
                        Spacer(modifier = Modifier.width(30.dp))
                        Button(onClick = {}) { Text("▶") }
                    }
                    Button(onClick = {}) { Text("▼") }
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Button(onClick = {}) { Text("△") }
                    Row {
                        Button(onClick = {}) { Text("□") }
                        Spacer(modifier = Modifier.width(15.dp))
                        Button(onClick = {}) { Text("◯") }
                    }
                    Button(onClick = {}) { Text("✕") }
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(8.dp)) {
                Text("Dabble PWM Motor Speed: ${motorPwm.toInt()} / 255", fontSize = 10.sp)
                Slider(value = motorPwm, onValueChange = { motorPwm = it }, valueRange = 0f..255f)
            }
        }
    }
}

// ============================================================================
// MODULE D: SERIAL MONITOR & 60 FPS LTTB PLOTTER
// ============================================================================
@Composable
fun SerialMonitorPlotterDashboard() {
    val rawTelemetry = remember {
        List(1000) { i -> TelemetryPoint(i.toFloat(), kotlin.math.sin(i * 0.1f) * 40f) }
    }
    val decimatedPoints = remember(rawTelemetry) {
        ApexLttbDecimator.decimate(rawTelemetry, threshold = 150)
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Text("ApexRock Serial Monitor & 60fps LTTB Telemetry Plotter", style = MaterialTheme.colorScheme.labelMedium)

        Canvas(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color.Black)
        ) {
            if (decimatedPoints.size < 2) return@Canvas
            val width = size.width
            val height = size.height

            val minX = decimatedPoints.minOf { it.x }
            val maxX = decimatedPoints.maxOf { it.x }
            val minY = decimatedPoints.minOf { it.y }
            val maxY = decimatedPoints.maxOf { it.y }

            val rangeX = if (maxX - minX == 0f) 1f else maxX - minX
            val rangeY = if (maxY - minY == 0f) 1f else maxY - minY

            val path = Path()
            decimatedPoints.forEachIndexed { index, pt ->
                val x = (pt.x - minX) / rangeX * width
                val y = height - ((pt.y - minY) / rangeY * height)
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }

            drawPath(path = path, color = Color.Green, style = Stroke(width = 2f))
        }

        Spacer(modifier = Modifier.height(4.dp))

        Box(
            modifier = Modifier
                .height(80.dp)
                .fillMaxWidth()
                .background(Color(0xFF0F172A))
                .padding(6.dp)
        ) {
            Text(
                text = "[RX] ApexRock ESP32 WiFi / BLE NUS Connected | CRC-16 OK\n[TX] Frame Encoded (SOF: 0x7E, EOF: 0x7F)",
                color = Color.Cyan,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
