/**
 * Trilha sonora sintetizada (WebAudio): um pequeno sequenciador com baixo,
 * acordes e melodia. Dois climas: calmo (mirando) e tenso (últimos segundos).
 */
export type Mood = 'off' | 'calm' | 'tense';

// progressões em semitons a partir de Dó; cada acorde dura um compasso (8 colcheias)
const CALM = { bpm: 104, chords: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], scale: [0, 2, 4, 7, 9] };
const TENSE = { bpm: 148, chords: [[9, 0, 4], [5, 9, 0], [2, 5, 9], [4, 8, 11]], scale: [9, 11, 0, 4, 5] };

const freq = (semi: number, octave: number) => 261.63 * 2 ** (semi / 12 + (octave - 4));

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private mood: Mood = 'off';
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private rng = 1;
  enabled = true;
  private volume = 0.7;

  /** 0..1 */
  setVolume(v: number): void {
    this.volume = v;
    if (this.out) this.out.gain.value = 0.26 * v;
  }

  attach(ctx: AudioContext, destination: AudioNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.26 * this.volume;
    this.out.connect(destination);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.setMood('off');
  }

  setMood(m: Mood): void {
    if (!this.enabled) m = 'off';
    if (m === this.mood) return;
    const from = this.mood;
    this.mood = m;
    if (!this.ctx || !this.out) return;
    if (m === 'off') {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    if (from === 'off') {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 50);
    }
  }

  private rand(): number {
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return this.rng / 0x7fffffff;
  }

  /** Agenda as notas dos próximos ~150 ms (lookahead). */
  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const song = this.mood === 'tense' ? TENSE : CALM;
      const eighth = 60 / song.bpm / 2;
      const bar = Math.floor(this.step / 8) % song.chords.length;
      const beat = this.step % 8;
      const chord = song.chords[bar];
      const t = this.nextTime;
      // baixo nas colcheias 0 e 4 (e todas no tenso)
      if (beat % 4 === 0 || this.mood === 'tense') this.note(freq(chord[0], 2), t, eighth * 0.9, 'triangle', 0.5);
      // acorde no tempo 1
      if (beat === 0) for (const n of chord) this.note(freq(n, 4), t, eighth * 7, 'sine', 0.12);
      // melodia: notas da escala, mais densa no tenso
      if (this.rand() < (this.mood === 'tense' ? 0.7 : 0.4)) {
        const s = song.scale[Math.floor(this.rand() * song.scale.length)];
        this.note(freq(s, 5), t, eighth * 0.8, 'square', 0.05);
      }
      // chimbal no tenso
      if (this.mood === 'tense') this.hat(t);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private note(f: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    s.connect(f).connect(g).connect(this.out!);
    s.start(t);
  }
}
