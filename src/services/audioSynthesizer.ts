// ============================================================================
// APEXROCK AUTOMATION: HARDWARE AUDIO SYNTHESIZER
// Generates realistic tactical audio for Radar E-Stop, Horn, and UI clicks
// ============================================================================

class HardwareAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastRadarBeepTime: number = 0;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.motorGain && this.ctx) {
      this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Short tactile button click
   */
  public playClick(freq = 1200) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {
      // Audio playback non-fatal
    }
  }

  /**
   * Radar proximity alert tick/beep
   * Rate scales inversely with distance
   */
  public handleRadarProximity(distanceCm: number) {
    if (this.isMuted) return;
    const now = Date.now();

    // Below 15cm: continuous rapid alarm
    if (distanceCm < 15) {
      if (now - this.lastRadarBeepTime > 120) {
        this.lastRadarBeepTime = now;
        this.playEmergencyBrakeAlarm();
      }
      return;
    }

    // Between 15cm and 80cm: interval gets shorter as distance gets smaller
    if (distanceCm < 80) {
      const intervalMs = Math.max(150, (distanceCm - 15) * 15);
      if (now - this.lastRadarBeepTime > intervalMs) {
        this.lastRadarBeepTime = now;
        this.playRadarBeep(distanceCm);
      }
    }
  }

  private playRadarBeep(distanceCm: number) {
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      // Frequency rises as distance shrinks
      const freq = 600 + (80 - distanceCm) * 12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    } catch {
      // ignore
    }
  }

  /**
   * Critical emergency e-stop double-tone screech
   */
  public playEmergencyBrakeAlarm() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc2.frequency.setValueAtTime(440, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 0.1);
      osc2.stop(this.ctx.currentTime + 0.1);
    } catch {
      // ignore
    }
  }

  /**
   * Vehicle Horn
   */
  public playHorn(durationMs = 250) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(415, this.ctx.currentTime); // G#4
      osc2.frequency.setValueAtTime(494, this.ctx.currentTime); // B4

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + durationMs / 1000 - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationMs / 1000);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + durationMs / 1000);
      osc2.stop(this.ctx.currentTime + durationMs / 1000);
    } catch {
      // ignore
    }
  }
}

export const hardwareAudio = new HardwareAudioSynthesizer();
