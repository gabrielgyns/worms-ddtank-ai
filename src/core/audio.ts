import { Music } from './music';

/** Efeitos sonoros sintetizados na hora com WebAudio — nenhum arquivo externo. */
export class Sfx {
  readonly music = new Music();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.music.attach(this.ctx, this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, vol: number, q = 0.7): void {
    const c = this.ctx;
    if (!c || !this.master || !this.noise) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
  }

  explosion(r: number): void {
    const big = Math.min(1, r / 70);
    this.burst(0.5 + big * 0.9, 900 + big * 1400, 0.8 + big * 0.5);
    this.tone(90 - big * 30, 0.4 + big * 0.4, 'sine', 0.7, 30);
  }
  shoot(): void {
    this.burst(0.25, 2200, 0.4);
    this.tone(220, 0.18, 'square', 0.12, 90);
  }
  throwIt(): void {
    this.tone(500, 0.12, 'triangle', 0.18, 260);
  }
  bounce(): void {
    this.tone(320, 0.08, 'triangle', 0.2, 180);
  }
  jump(): void {
    this.tone(300, 0.16, 'square', 0.08, 640);
  }
  splash(): void {
    this.burst(0.6, 3000, 0.4, 3);
    this.tone(700, 0.25, 'sine', 0.15, 200);
  }
  select(): void {
    this.tone(660, 0.06, 'square', 0.07);
  }
  tick(): void {
    this.tone(1000, 0.05, 'square', 0.06);
  }
  teleport(): void {
    this.tone(300, 0.35, 'sine', 0.2, 1800);
    this.tone(1200, 0.3, 'triangle', 0.08, 400, 0.05);
  }
  death(): void {
    this.tone(500, 0.18, 'square', 0.1, 300);
    this.tone(300, 0.3, 'square', 0.1, 120, 0.18);
  }
  turn(): void {
    this.tone(523, 0.1, 'triangle', 0.15);
    this.tone(784, 0.16, 'triangle', 0.15, undefined, 0.09);
  }
  victory(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, undefined, i * 0.13));
  }
  pickup(): void {
    [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.15, undefined, i * 0.07));
  }
  beep(): void {
    [0, 0.25, 0.5, 0.75, 1.0, 1.2].forEach((d) => this.tone(1400, 0.06, 'square', 0.07, undefined, d));
  }
  whoosh(): void {
    this.burst(0.8, 1200, 0.15, 2);
  }
  ouch(): void {
    this.tone(700, 0.12, 'sawtooth', 0.06, 350);
  }

  chargeStart(): void {
    const c = this.ctx;
    if (!c || !this.master || this.chargeOsc) return;
    this.chargeOsc = c.createOscillator();
    this.chargeGain = c.createGain();
    this.chargeOsc.type = 'sawtooth';
    this.chargeOsc.frequency.value = 120;
    this.chargeGain.gain.value = 0.05;
    this.chargeOsc.connect(this.chargeGain).connect(this.master);
    this.chargeOsc.start();
  }
  chargeLevel(p: number): void {
    if (this.chargeOsc && this.ctx) this.chargeOsc.frequency.setTargetAtTime(120 + p * 520, this.ctx.currentTime, 0.02);
  }
  chargeStop(): void {
    if (!this.chargeOsc) return;
    this.chargeOsc.stop();
    this.chargeOsc.disconnect();
    this.chargeOsc = null;
    this.chargeGain = null;
  }
}
