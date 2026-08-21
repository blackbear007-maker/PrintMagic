/**
 * Web Audio Synthetic Acoustic Feedback Engine
 * Pure mathematical sound synthesis for physical tactility without any external audio asset dependencies
 */

export class SoundEffects {
  private static audioCtx: AudioContext | null = null;
  private static isMuted: boolean = false;
  private static lastTickTime = 0;

  public static init(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('printmagic_muted');
      this.isMuted = saved === 'true';
    }
  }

  private static getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public static toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('printmagic_muted', String(this.isMuted));
    }
    if (!this.isMuted) {
      this.sliderTick();
    }
    return this.isMuted;
  }

  public static getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Gentle, low-frequency breathy physical paper landing sound
   */
  public static paperDrop(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // White noise buffer for paper friction
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(now);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Resonant futuristic laser pre-flight scan sound
   */
  public static laserScan(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.5);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.52);
    } catch {}
  }

  /**
   * Microscopic haptic mechanical tick for comparison slider drag
   */
  public static sliderTick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = performance.now();
    if (now - this.lastTickTime < 35) return; // Debounce to prevent flooding
    this.lastTickTime = now;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.015);

      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.018);
    } catch {}
  }

  /**
   * Pure crystal bell chime for successful optimization
   */
  public static purityChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

      freqs.forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.48);
      });
    } catch {}
  }

  /**
   * Leica-style crisp mechanical shutter click for export & mockup snapshot
   */
  public static shutterClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Click 1: shutter curtain open
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(800, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.02);

      // Click 2: shutter curtain close
      const t2 = now + 0.045;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(450, t2);
      gain2.gain.setValueAtTime(0.15, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.025);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.03);
    } catch {}
  }

  /**
   * Smooth tactile 3D card/paper flipping whoosh sound
   */
  public static cardFlip(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.16);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }
}

SoundEffects.init();
