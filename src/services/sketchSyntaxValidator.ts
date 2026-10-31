// ============================================================================
// APEXROCK ARDUINODROID: SKETCH SYNTAX VALIDATOR & DIAGNOSTIC ANALYZER
// Analyzes C++ sketch code for syntax errors, missing tokens, and GCC error format
// ============================================================================

export interface CompilerDiagnostic {
  line: number;
  column: number;
  type: 'error' | 'warning' | 'fatal';
  message: string;
  snippet: string;
  caretOffset: number;
}

export interface ValidationResult {
  hasErrors: boolean;
  diagnostics: CompilerDiagnostic[];
  flashBytes: number;
  ramBytes: number;
  textSection: number;
  dataSection: number;
  bssSection: number;
  rodataSection: number;
}

const KNOWN_HEADERS = new Set([
  'WiFi.h',
  'WiFiClient.h',
  'WiFiUdp.h',
  'WebServer.h',
  'ESP8266WiFi.h',
  'ESP8266WebServer.h',
  'NewPing.h',
  'ESP32Servo.h',
  'Servo.h',
  'Wire.h',
  'SPI.h',
  'Adafruit_GFX.h',
  'Adafruit_SSD1306.h',
  'DabbleESP32.h',
  'freertos/FreeRTOS.h',
  'freertos/task.h',
  'freertos/queue.h',
  'PubSubClient.h',
  'ArduinoJson.h',
  'FastLED.h',
  'SoftwareSerial.h',
  'EEPROM.h',
  'definitions.h',
  'config.h'
]);

export function validateSketchSyntax(code: string, fileName = 'sketch.ino'): ValidationResult {
  const diagnostics: CompilerDiagnostic[] = [];
  const lines = code.split('\n');

  let openBraceCount = 0;
  let lastOpenBraceLine = 1;
  let hasSetup = false;
  let hasLoop = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check for setup and loop definitions
    if (/void\s+setup\s*\(\s*\)/.test(trimmed)) hasSetup = true;
    if (/void\s+loop\s*\(\s*\)/.test(trimmed)) hasLoop = true;

    // Track braces
    for (let c = 0; c < trimmed.length; c++) {
      if (trimmed[c] === '{') {
        openBraceCount++;
        lastOpenBraceLine = lineNum;
      } else if (trimmed[c] === '}') {
        openBraceCount--;
        if (openBraceCount < 0) {
          diagnostics.push({
            line: lineNum,
            column: c + 1,
            type: 'error',
            message: "extraneous closing brace '}'",
            snippet: rawLine,
            caretOffset: c
          });
          openBraceCount = 0;
        }
      }
    }

    // Check header includes
    const includeMatch = trimmed.match(/#include\s+[<"]([^>"]+)[>"]/);
    if (includeMatch) {
      const header = includeMatch[1];
      if (!KNOWN_HEADERS.has(header) && !header.endsWith('.h')) {
        diagnostics.push({
          line: lineNum,
          column: trimmed.indexOf(header),
          type: 'fatal',
          message: `${header}: No such file or directory`,
          snippet: rawLine,
          caretOffset: trimmed.indexOf(header)
        });
      }
    }

    // Check for missing semicolons on common statements
    if (
      !trimmed.endsWith(';') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      !trimmed.endsWith(':') &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('if') &&
      !trimmed.startsWith('for') &&
      !trimmed.startsWith('while') &&
      !trimmed.startsWith('switch') &&
      !trimmed.startsWith('else') &&
      !trimmed.startsWith('case') &&
      !trimmed.startsWith('default') &&
      !trimmed.startsWith('void')
    ) {
      // Common statements that require a semicolon
      if (
        trimmed.includes('Serial.begin') ||
        trimmed.includes('Serial.print') ||
        trimmed.includes('pinMode') ||
        trimmed.includes('digitalWrite') ||
        trimmed.includes('analogWrite') ||
        trimmed.includes('delay') ||
        trimmed.includes('delayMicroseconds') ||
        trimmed.includes('=') ||
        trimmed.startsWith('return')
      ) {
        diagnostics.push({
          line: lineNum,
          column: rawLine.length + 1,
          type: 'error',
          message: "expected ';' before end of line",
          snippet: rawLine,
          caretOffset: rawLine.length
        });
      }
    }
  }

  // Check unmatched open braces
  if (openBraceCount > 0) {
    diagnostics.push({
      line: lines.length,
      column: 1,
      type: 'error',
      message: `expected '}' at end of input (unclosed brace at line ${lastOpenBraceLine})`,
      snippet: lines[lines.length - 1] || '}',
      caretOffset: 0
    });
  }

  // Missing setup or loop warning
  if (!hasSetup && fileName.endsWith('.ino')) {
    diagnostics.push({
      line: 1,
      column: 1,
      type: 'warning',
      message: "undefined reference to 'setup()'",
      snippet: 'void setup() { ... }',
      caretOffset: 0
    });
  }
  if (!hasLoop && fileName.endsWith('.ino')) {
    diagnostics.push({
      line: 1,
      column: 1,
      type: 'warning',
      message: "undefined reference to 'loop()'",
      snippet: 'void loop() { ... }',
      caretOffset: 0
    });
  }

  const lineCount = lines.length;
  const textSection = 142000 + lineCount * 70;
  const dataSection = 8400 + lineCount * 8;
  const bssSection = 12400 + lineCount * 12;
  const rodataSection = 24600 + lineCount * 14;

  return {
    hasErrors: diagnostics.some(d => d.type === 'error' || d.type === 'fatal'),
    diagnostics,
    flashBytes: textSection + rodataSection,
    ramBytes: dataSection + bssSection,
    textSection,
    dataSection,
    bssSection,
    rodataSection
  };
}
