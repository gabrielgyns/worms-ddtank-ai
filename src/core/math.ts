export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const DEG = Math.PI / 180;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Gerador pseudo-aleatório determinístico (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** estado interno, para salvar e restaurar a partida */
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/** Hash 2D barato para texturas procedurais. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor 2D suave, em [0,1). */
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/**
 * Hash FNV-1a incremental de 32 bits. Floats entram pelos bits exatos,
 * então qualquer diferença mínima entre dois computadores aparece.
 */
export class Hasher {
  private h = 0x811c9dc5;
  private readonly f64 = new Float64Array(1);
  private readonly u32 = new Uint32Array(this.f64.buffer);

  int(v: number): this {
    let h = this.h ^ (v | 0);
    h = Math.imul(h, 0x01000193);
    this.h = h >>> 0;
    return this;
  }
  num(v: number): this {
    this.f64[0] = v;
    return this.int(this.u32[0]).int(this.u32[1]);
  }
  bytes(b: Uint8Array): this {
    let h = this.h;
    for (let i = 0; i < b.length; i++) {
      h ^= b[i];
      h = Math.imul(h, 0x01000193);
    }
    this.h = h >>> 0;
    return this;
  }
  str(s: string): this {
    for (let i = 0; i < s.length; i++) this.int(s.charCodeAt(i));
    return this;
  }
  get value(): number {
    return this.h >>> 0;
  }
}
