// ============================================================================
// APEXROCK ARDUINODROID: COMPLETE BUILT-IN LIBRARY CATALOG & EXAMPLES
// Full library ecosystem matching ArduinoDroid app for AVR, ESP8266 & ESP32
// ============================================================================

export interface ArduinoLibrary {
  id: string;
  name: string;
  category: 'Communication' | 'Sensors' | 'Actuators & Display' | 'Robotics & Control' | 'Data & Utility';
  version: string;
  author: string;
  description: string;
  headers: string[];
  installed: boolean;
  exampleSketch: {
    title: string;
    code: string;
  };
}

export const ARDUINO_DROID_LIBRARIES: ArduinoLibrary[] = [
  {
    id: 'wifi',
    name: 'WiFi / ESP8266WiFi / WiFiMulti',
    category: 'Communication',
    version: '2.0.0',
    author: 'Espressif Systems / Arduino',
    description: 'Enables network connectivity, SoftAP hotspot creation, and TCP/UDP communication for ESP32 and ESP8266.',
    headers: ['#include <WiFi.h>', '#include <WiFiClient.h>', '#include <WiFiUdp.h>'],
    installed: true,
    exampleSketch: {
      title: 'WiFi SoftAP Web Server',
      code: `// ApexRock ArduinoDroid: ESP32 WiFi SoftAP Server
#include <WiFi.h>
#include <WiFiClient.h>
#include <WebServer.h>

const char *ssid = "ApexRock-ESP32-AP";
const char *password = "12345678";
WebServer server(80);

void handleRoot() {
  server.send(200, "text/plain", "ApexRock ESP32 Online. Status: NOMINAL");
}

void setup() {
  Serial.begin(115200);
  WiFi.softAP(ssid, password);
  IPAddress myIP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(myIP);

  server.on("/", handleRoot);
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}`
    }
  },
  {
    id: 'dabble',
    name: 'Dabble / DabbleESP32',
    category: 'Robotics & Control',
    version: '1.5.2',
    author: 'STEMpedia',
    description: 'Bluetooth and BLE protocol library for smartphone gamepad, sensors (accel/gyro), terminal, and camera control.',
    headers: ['#define CUSTOM_SETTINGS', '#define INCLUDE_GAMEPAD_MODULE', '#include <DabbleESP32.h>'],
    installed: true,
    exampleSketch: {
      title: 'Dabble Virtual Gamepad & PWM Controller',
      code: `// ApexRock ArduinoDroid: Dabble BLE Gamepad Controller
#define CUSTOM_SETTINGS
#define INCLUDE_GAMEPAD_MODULE
#define INCLUDE_SENSOR_MODULE
#include <DabbleESP32.h>

const int MOTOR_PWM = 25;
const int LED_PIN = 2;

void setup() {
  Serial.begin(115200);
  pinMode(MOTOR_PWM, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Dabble.begin("ApexRock-Dabble-Rover");
  Serial.println("Dabble BLE Bridge Initialized.");
}

void loop() {
  Dabble.processInput();

  if (GamePad.isUpPressed()) {
    analogWrite(MOTOR_PWM, 220);
    digitalWrite(LED_PIN, HIGH);
    Serial.println("FORWARD 220 PWM");
  } else if (GamePad.isDownPressed()) {
    analogWrite(MOTOR_PWM, 150);
    digitalWrite(LED_PIN, LOW);
    Serial.println("REVERSE 150 PWM");
  } else {
    analogWrite(MOTOR_PWM, 0);
  }

  if (GamePad.isTrianglePressed()) {
    Serial.println("Action: TRIANGLE - Horn Triggered");
  }
}`
    }
  },
  {
    id: 'newping',
    name: 'NewPing (Ultrasonic HC-SR04)',
    category: 'Sensors',
    version: '1.9.7',
    author: 'Tim Eckel',
    description: 'Ultra-fast ultrasonic distance sensor library with hardware timer support and 15cm radar collision mitigation.',
    headers: ['#include <NewPing.h>'],
    installed: true,
    exampleSketch: {
      title: 'Ultrasonic 15cm Radar E-Stop Interlock',
      code: `// ApexRock ArduinoDroid: HC-SR04 15cm Radar Safety
#include <NewPing.h>

#define TRIGGER_PIN  5
#define ECHO_PIN     18
#define MAX_DISTANCE 200 // Maximum distance in cm
#define E_STOP_LIMIT 15  // 15cm Emergency Stop

NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);
const int MOTOR_PIN = 25;

void setup() {
  Serial.begin(115200);
  pinMode(MOTOR_PIN, OUTPUT);
}

void loop() {
  delay(50);
  unsigned int uS = sonar.ping();
  int distanceCm = uS / US_ROUNDTRIP_CM;

  if (distanceCm > 0 && distanceCm < E_STOP_LIMIT) {
    // Critical 15cm Emergency Brake Trigger
    analogWrite(MOTOR_PIN, 0);
    Serial.print("🚨 E-STOP LOCK! Obstacle at: ");
    Serial.print(distanceCm);
    Serial.println(" cm");
  } else {
    analogWrite(MOTOR_PIN, 180);
    Serial.print("Distance: ");
    Serial.print(distanceCm);
    Serial.println(" cm - OK");
  }
}`
    }
  },
  {
    id: 'servo',
    name: 'ESP32Servo / Servo',
    category: 'Actuators & Display',
    version: '1.2.1',
    author: 'Kevin Harrington / Michael Margolis',
    description: 'Hardware PWM precision RC servo library supporting 0 to 180 degrees positioning for steering and pan/tilt gimbals.',
    headers: ['#include <ESP32Servo.h>'],
    installed: true,
    exampleSketch: {
      title: 'Pan/Tilt Gimbal Servo Control',
      code: `// ApexRock ArduinoDroid: Precision Servo Steering & Gimbal
#include <ESP32Servo.h>

Servo steeringServo;
const int SERVO_PIN = 13;

void setup() {
  Serial.begin(115200);
  steeringServo.attach(SERVO_PIN);
  steeringServo.write(90); // Center position
  Serial.println("Servo centered at 90 deg");
}

void loop() {
  // Sweep test
  for (int pos = 45; pos <= 135; pos += 5) {
    steeringServo.write(pos);
    delay(20);
  }
  for (int pos = 135; pos >= 45; pos -= 5) {
    steeringServo.write(pos);
    delay(20);
  }
}`
    }
  },
  {
    id: 'wire',
    name: 'Wire (I2C Master/Slave)',
    category: 'Communication',
    version: '1.0.0',
    author: 'Arduino / Espressif',
    description: 'Built-in Two-Wire Interface (I2C) for communicating with OLEDs, accelerometers, gyroscopes, and IMUs.',
    headers: ['#include <Wire.h>'],
    installed: true,
    exampleSketch: {
      title: 'I2C Device Scanner',
      code: `// ApexRock ArduinoDroid: I2C Bus Address Scanner
#include <Wire.h>

void setup() {
  Wire.begin();
  Serial.begin(115200);
  while (!Serial);
  Serial.println("\\nI2C Scanner scanning bus...");
}

void loop() {
  byte error, address;
  int nDevices = 0;

  for (address = 1; address < 127; address++ ) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.println(" !");
      nDevices++;
    }
  }
  if (nDevices == 0) Serial.println("No I2C devices found\\n");
  delay(3000);
}`
    }
  },
  {
    id: 'ssd1306',
    name: 'Adafruit SSD1306 & GFX',
    category: 'Actuators & Display',
    version: '2.5.9',
    author: 'Adafruit Industries',
    description: 'Driver for 128x64 and 128x32 monochrome I2C/SPI OLED displays with telemetry graphing support.',
    headers: ['#include <Adafruit_GFX.h>', '#include <Adafruit_SSD1306.h>'],
    installed: true,
    exampleSketch: {
      title: 'OLED Telemetry HUD',
      code: `// ApexRock ArduinoDroid: OLED 128x64 Dashboard
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(115200);
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 10);
  display.println("APEXROCK AUTOMATION");
  display.println("ESP32 Car Online");
  display.println("Radar: 35 cm");
  display.display();
}

void loop() {}`
    }
  },
  {
    id: 'freertos',
    name: 'FreeRTOS ESP32 Dual Core',
    category: 'Robotics & Control',
    version: '10.5.1',
    author: 'FreeRTOS / Amazon Web Services',
    description: 'Preemptive real-time operating system kernel for multi-tasking across Core 0 (WiFi/Comms) and Core 1 (Motor/Sensors).',
    headers: ['#include <freertos/FreeRTOS.h>', '#include <freertos/task.h>', '#include <freertos/queue.h>'],
    installed: true,
    exampleSketch: {
      title: 'Dual Core High-Speed Telemetry Task',
      code: `// ApexRock ArduinoDroid: FreeRTOS Dual Core Execution
TaskHandle_t TaskMotor;
TaskHandle_t TaskComms;

void TaskMotorCode(void * pvParameters) {
  for(;;) {
    // Real-time 100Hz motor control loop on Core 1
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

void TaskCommsCode(void * pvParameters) {
  for(;;) {
    // Network & Binary telemetry streaming on Core 0
    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

void setup() {
  Serial.begin(115200);
  xTaskCreatePinnedToCore(TaskMotorCode, "TaskMotor", 10000, NULL, 1, &TaskMotor, 1);
  xTaskCreatePinnedToCore(TaskCommsCode, "TaskComms", 10000, NULL, 1, &TaskComms, 0);
}

void loop() {
  vTaskDelay(1000 / portTICK_PERIOD_MS);
}`
    }
  },
  {
    id: 'pubsubclient',
    name: 'PubSubClient (MQTT Protocol)',
    category: 'Communication',
    version: '2.8.0',
    author: 'Nick O\\\'Leary',
    description: 'MQTT client for IoT robotics telemetry, cloud telemetry publishing, and remote command subscriptions.',
    headers: ['#include <PubSubClient.h>'],
    installed: false,
    exampleSketch: {
      title: 'MQTT Telemetry Publisher',
      code: `// ApexRock ArduinoDroid: MQTT Telemetry Client
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "broker.hivemq.com";
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    if (client.connect("ApexRockClient")) {
      client.publish("apexrock/status", "ONLINE");
    }
  }
  client.loop();
}`
    }
  },
  {
    id: 'arduinojson',
    name: 'ArduinoJson',
    category: 'Data & Utility',
    version: '7.0.4',
    author: 'Benoit Blanchon',
    description: 'High-performance C++ JSON parsing and serialization library for IoT configuration packets and web endpoints.',
    headers: ['#include <ArduinoJson.h>'],
    installed: true,
    exampleSketch: {
      title: 'JSON Packet Serialization',
      code: `// ApexRock ArduinoDroid: JSON Packet Encoding
#include <ArduinoJson.h>

void setup() {
  Serial.begin(115200);
  StaticJsonDocument<200> doc;
  doc["node"] = "esp32-rover-01";
  doc["radar_cm"] = 35.5;
  doc["pwm"] = 180;

  serializeJson(doc, Serial);
  Serial.println();
}

void loop() {}`
    }
  },
  {
    id: 'fastled',
    name: 'FastLED (WS2812B NeoPixel)',
    category: 'Actuators & Display',
    version: '3.6.0',
    author: 'Daniel Garcia',
    description: 'Ultra-fast LED animation library for RGB underglow, headlights, turn signals, and chassis status strips.',
    headers: ['#include <FastLED.h>'],
    installed: false,
    exampleSketch: {
      title: 'Vehicle Underglow & Status Strip',
      code: `// ApexRock ArduinoDroid: FastLED WS2812B Underglow
#include <FastLED.h>

#define NUM_LEDS 8
#define DATA_PIN 4
CRGB leds[NUM_LEDS];

void setup() {
  FastLED.addLeds<NEOPIXEL, DATA_PIN>(leds, NUM_LEDS);
}

void loop() {
  // Police strobe or headlights
  fill_solid(leds, NUM_LEDS, CRGB::White);
  FastLED.show();
  delay(200);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();
  delay(200);
}`
    }
  }
];

export interface BoardProfile {
  id: string;
  name: string;
  family: 'ESP32' | 'ESP8266' | 'AVR' | 'ARM';
  cpuFreq: string;
  flashSize: string;
  ramSize: string;
  defaultBaud: number;
  uploadProtocols: string[];
}

export const ARDUINO_DROID_BOARDS: BoardProfile[] = [
  {
    id: 'esp32-dev',
    name: 'ESP32 Dev Module',
    family: 'ESP32',
    cpuFreq: '240 MHz Dual-Core',
    flashSize: '4 MB (32 Mb)',
    ramSize: '520 KB SRAM',
    defaultBaud: 115200,
    uploadProtocols: ['USB OTG / WebSerial', 'Wireless OTA (WiFi)', 'ESP-PROG JTAG']
  },
  {
    id: 'esp8266-nodemcu',
    name: 'NodeMCU 1.0 (ESP-12E Module)',
    family: 'ESP8266',
    cpuFreq: '80 MHz',
    flashSize: '4 MB',
    ramSize: '80 KB SRAM',
    defaultBaud: 115200,
    uploadProtocols: ['USB OTG / WebSerial', 'ArduinoOTA (WiFi)']
  },
  {
    id: 'esp32-s3',
    name: 'ESP32-S3 DevKitC-1',
    family: 'ESP32',
    cpuFreq: '240 MHz Dual-Core LX7',
    flashSize: '8 MB Octal Flash',
    ramSize: '512 KB SRAM + 8 MB PSRAM',
    defaultBaud: 921600,
    uploadProtocols: ['USB-OTG Native CDC', 'Wireless OTA']
  },
  {
    id: 'arduino-uno',
    name: 'Arduino Uno R3 (ATmega328P)',
    family: 'AVR',
    cpuFreq: '16 MHz',
    flashSize: '32 KB (0.5KB bootloader)',
    ramSize: '2 KB SRAM',
    defaultBaud: 115200,
    uploadProtocols: ['USB-Serial (CH340/ATmega16U2)', 'Arduino as ISP']
  },
  {
    id: 'arduino-nano',
    name: 'Arduino Nano (ATmega328P Old Bootloader)',
    family: 'AVR',
    cpuFreq: '16 MHz',
    flashSize: '32 KB',
    ramSize: '2 KB SRAM',
    defaultBaud: 57600,
    uploadProtocols: ['USB-Serial (CH340/FTDI)']
  },
  {
    id: 'arduino-mega',
    name: 'Arduino Mega 2560 R3',
    family: 'AVR',
    cpuFreq: '16 MHz',
    flashSize: '256 KB',
    ramSize: '8 KB SRAM',
    defaultBaud: 115200,
    uploadProtocols: ['USB-Serial (ATmega16U2)']
  }
];
