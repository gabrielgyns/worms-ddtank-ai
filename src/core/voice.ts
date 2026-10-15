/**
 * Voz de balbucio (estilo Animal Crossing/Banjo-Kazooie): o texto do balão
 * vira sílabas sintetizadas com a vogal certa, no ritmo e na entonação da
 * frase. Nenhum arquivo de áudio; cada bicho tem seu timbre.
 */

export interface VoiceProfile {
  /** frequência base da voz (Hz) */
  pitch: number;
  /** duração de cada sílaba (s) */
  syl: number;
  wave: OscillatorType;
  /** quanto o tom escorrega dentro da sílaba (miado = muito) */
  glide: number;
  /** vibrato (Hz de profundidade) */
  wobble: number;
  /** multiplica os formantes: bicho pequeno = garganta pequena */
  throat: number;
}

/** Catálogo de vozes por bicho (dados, como as armas). */
export const VOICES: Record<'bolota' | 'gato' | 'hamster' | 'cachorro' | 'rei', VoiceProfile> = {
  bolota: { pitch: 240, syl: 0.085, wave: 'triangle', glide: 0.08, wobble: 6, throat: 1 },
  gato: { pitch: 400, syl: 0.1, wave: 'sawtooth', glide: 0.35, wobble: 10, throat: 1.25 },
  hamster: { pitch: 640, syl: 0.06, wave: 'square', glide: 0.12, wobble: 18, throat: 1.5 },
  // "au": cai de tom dentro da sílaba
  cachorro: { pitch: 300, syl: 0.09, wave: 'sawtooth', glide: -0.3, wobble: 5, throat: 0.95 },
  rei: { pitch: 105, syl: 0.12, wave: 'sawtooth', glide: 0.05, wobble: 4, throat: 0.8 },
};

/** Formantes F1/F2 de cada vogal do português (aproximados). */
const VOWEL: Record<string, [number, number]> = {
  a: [800, 1250],
  e: [480, 1950],
  i: [300, 2300],
  o: [500, 900],
  u: [340, 780],
};

interface Syllable {
  vowel: [number, number];
  /** consoante antes da vogal: chiado (s, x, f…), estalo (p, t, k…) ou nada */
  onset: 'hiss' | 'pop' | 'hum' | null;
}

const HISS = new Set('sxzfcçjv'.split(''));
const POP = new Set('ptkbdgq'.split(''));
const HUM = new Set('mnlrh'.split(''));

function fold(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Quebra a frase em sílabas (grupo de consoantes + vogal). Bom o bastante para balbucio. */
export function syllables(text: string, max = 14): Syllable[] {
  const out: Syllable[] = [];
  let onset: Syllable['onset'] = null;
  let lastVowel = false;
  for (const raw of text.toLowerCase()) {
    const ch = fold(raw);
    if (VOWEL[ch]) {
      // ditongo ("ai", "ou") fica numa sílaba só
      if (!lastVowel || onset) out.push({ vowel: VOWEL[ch], onset });
      onset = null;
      lastVowel = true;
    } else {
      lastVowel = false;
      if (HISS.has(ch)) onset = 'hiss';
      else if (POP.has(ch)) onset = onset ?? 'pop';
      else if (HUM.has(ch)) onset = onset ?? 'hum';
    }
    if (out.length >= max) break;
  }
  // grito sem vogal ("Hmpf!") ainda faz barulho
  if (!out.length && text.trim()) out.push({ vowel: VOWEL.a, onset: null });
  return out;
}

/** Contorno da frase: pergunta sobe no fim, exclamação começa alto, reticências caem. */
function intonation(text: string, i: number, n: number): number {
  const k = n > 1 ? i / (n - 1) : 0;
  const t = text.trim();
  if (t.endsWith('?')) return 1 + k * k * 0.45;
  if (t.endsWith('!')) return 1.18 - k * 0.22;
  if (t.endsWith('…') || t.endsWith('...')) return 1.02 - k * 0.3;
  return 1.05 - k * 0.12;
}

/**
 * Toca a frase. `variant` muda levemente o tom (cada bolota do time soa um pouco diferente).
 * Devolve a duração em segundos.
 */
export function babble(
  ctx: AudioContext,
  dest: AudioNode,
  noise: AudioBuffer | null,
  text: string,
  v: VoiceProfile,
  variant = 0,
): number {
  const syl = syllables(text);
  const shout = text === text.toUpperCase() && /[A-Z]/.test(fold(text));
  const base = v.pitch * (1 + variant * 0.12) * (shout ? 1.15 : 1);
  const speed = shout ? 0.85 : 1;
  let t = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = shout ? 0.5 : 0.36;
  out.connect(dest);

  syl.forEach((s, i) => {
    const dur = v.syl * speed * (0.8 + Math.random() * 0.45) * (i === syl.length - 1 ? 1.6 : 1);
    const f0 = base * intonation(text, i, syl.length) * (0.92 + Math.random() * 0.16);

    if (s.onset && noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = s.onset === 'hiss' ? 'highpass' : 'bandpass';
      f.frequency.value = (s.onset === 'hiss' ? 3800 : s.onset === 'pop' ? 1200 : 400) * v.throat;
      const g = ctx.createGain();
      const len = s.onset === 'hiss' ? 0.045 : 0.018;
      g.gain.setValueAtTime(s.onset === 'hum' ? 0.08 : 0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + len + 0.01);
      t += len * 0.6;
    }

    // fonte (pregas vocais) → dois formantes (a vogal) → envelope
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(f0 * (1 - v.glide * 0.5), t);
    osc.frequency.linearRampToValueAtTime(f0 * (1 + v.glide * 0.5), t + dur * 0.45);
    osc.frequency.linearRampToValueAtTime(f0 * (1 - v.glide * 0.3), t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7 + Math.random() * 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = v.wobble;
    lfo.connect(lfoGain).connect(osc.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.012);
    env.gain.setValueAtTime(1, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [k, freq] of s.vowel.entries()) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * v.throat;
      bp.Q.value = 6;
      const fg = ctx.createGain();
      fg.gain.value = k === 0 ? 2.2 : 1.3;
      osc.connect(bp).connect(fg).connect(env);
    }
    // um pouco do som cru para não ficar abafado
    const dry = ctx.createGain();
    dry.gain.value = 0.12;
    osc.connect(dry).connect(env);
    env.connect(out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
    t += dur + 0.012;
  });
  const total = t - ctx.currentTime;
  setTimeout(() => out.disconnect(), (total + 0.3) * 1000);
  return total;
}
