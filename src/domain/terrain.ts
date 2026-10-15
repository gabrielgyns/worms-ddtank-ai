import { Rng, smoothstep, valueNoise } from '../core/math';

export interface CarveListener {
  (cx: number, cy: number, r: number): void;
}

export const AIR = 0;
export const DIRT = 1;
/** metal: sólido e indestrutível */
export const METAL = 2;

/**
 * Terreno destrutível: uma máscara por pixel (0 ar, 1 terra, 2 metal).
 * Não sabe desenhar — avisa os ouvintes quando é escavado.
 */
export class Terrain {
  readonly solid: Uint8Array;
  private listeners: CarveListener[] = [];
  private resetListeners: Array<() => void> = [];

  constructor(
    readonly width: number,
    readonly height: number,
    /** nível da água; sobe na morte súbita */
    public waterY: number,
  ) {
    this.solid = new Uint8Array(width * height);
  }

  onCarve(fn: CarveListener): void {
    this.listeners.push(fn);
  }

  private buildListeners: Array<(x0: number, y0: number, x1: number, y1: number) => void> = [];

  /** Avisado quando aparece terreno novo (viga), com o retângulo que mudou. */
  onBuild(fn: (x0: number, y0: number, x1: number, y1: number) => void): void {
    this.buildListeners.push(fn);
  }

  /**
   * Viga de metal girada: preenche só o que é ar. Devolve as células que
   * a viga ocupa (para checar se cobriria alguém antes de construir).
   */
  beamCells(cx: number, cy: number, angle: number, len: number, thick: number): number[] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ext = Math.ceil(len / 2 + thick);
    const out: number[] = [];
    for (let y = Math.max(0, Math.floor(cy - ext)); y <= Math.min(this.height - 1, Math.ceil(cy + ext)); y++) {
      for (let x = Math.max(0, Math.floor(cx - ext)); x <= Math.min(this.width - 1, Math.ceil(cx + ext)); x++) {
        const dx = x - cx;
        const dy = y - cy;
        // coordenadas no sistema da viga
        const along = dx * cos + dy * sin;
        const across = -dx * sin + dy * cos;
        if (Math.abs(along) <= len / 2 && Math.abs(across) <= thick / 2) out.push(y * this.width + x);
      }
    }
    return out;
  }

  addBeam(cx: number, cy: number, angle: number, len: number, thick: number): void {
    for (const i of this.beamCells(cx, cy, angle, len, thick)) if (this.solid[i] === AIR) this.solid[i] = METAL;
    const ext = len / 2 + thick;
    for (const fn of this.buildListeners) fn(cx - ext, cy - ext, cx + ext, cy + ext);
  }

  /** Avisado quando a máscara inteira é trocada (ressincronização, carregar partida). */
  onReset(fn: () => void): void {
    this.resetListeners.push(fn);
  }

  replace(mask: Uint8Array): void {
    this.solid.set(mask);
    for (const fn of this.resetListeners) fn();
  }

  isSolid(x: number, y: number): boolean {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) return false;
    return this.solid[yi * this.width + xi] !== AIR;
  }

  carve(cx: number, cy: number, r: number): void {
    this.fillCircle(cx, cy, r, 0);
    for (const fn of this.listeners) fn(cx, cy, r);
  }

  /** Normal aproximada da superfície (aponta para fora do chão). */
  normalAt(x: number, y: number, radius = 6): { x: number; y: number } {
    let nx = 0;
    let ny = 0;
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        if (dx * dx + dy * dy > radius * radius) continue;
        if (this.isSolid(x + dx, y + dy)) {
          nx -= dx;
          ny -= dy;
        }
      }
    }
    const len = Math.hypot(nx, ny);
    return len < 1e-6 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
  }

  /** Primeiro y sólido descendo a partir de `fromY` na coluna x. */
  surfaceY(x: number, fromY = 0): number {
    for (let y = Math.max(0, fromY | 0); y < this.height; y++) {
      if (this.isSolid(x, y)) return y;
    }
    return this.height;
  }

  generate(rng: Rng): void {
    const { width: w, height: h } = this;
    const base = h * rng.range(0.5, 0.6);
    const p1 = rng.range(0, 100);
    const p2 = rng.range(0, 100);
    const p3 = rng.range(0, 100);
    const amp = rng.range(110, 170);
    const heights = new Float32Array(w);

    for (let x = 0; x < w; x++) {
      const n =
        Math.sin(x * 0.0021 + p1) * amp +
        Math.sin(x * 0.0057 + p2) * amp * 0.45 +
        Math.sin(x * 0.013 + p3) * amp * 0.15 +
        (valueNoise(x * 0.02, p1) - 0.5) * 30;
      // bordas mergulham na água: o mapa vira uma ilha
      const edge = smoothstep(0, 220, x) * smoothstep(0, 220, w - x);
      heights[x] = base + n + (1 - edge) * (h * 0.6);
    }

    for (let x = 0; x < w; x++) {
      const top = Math.max(60, heights[x]) | 0;
      for (let y = top; y < h; y++) this.solid[y * w + x] = 1;
    }

    // ilhas flutuantes
    const islands = rng.int(2, 4);
    for (let i = 0; i < islands; i++) {
      const cx = rng.range(w * 0.15, w * 0.85);
      const cy = rng.range(h * 0.18, h * 0.38);
      const rx = rng.range(70, 140);
      const ry = rng.range(25, 45);
      this.blob(cx, cy, rx, ry, 1, rng);
    }

    // cavernas e crateras naturais
    const caves = rng.int(4, 7);
    for (let i = 0; i < caves; i++) {
      const cx = rng.range(w * 0.12, w * 0.88);
      const cy = heights[cx | 0] + rng.range(70, 220);
      this.blob(cx, cy, rng.range(45, 100), rng.range(30, 60), 0, rng);
    }
  }

  private blob(cx: number, cy: number, rx: number, ry: number, value: 0 | 1, rng: Rng): void {
    const seed = rng.range(0, 1000);
    const x0 = Math.max(0, (cx - rx * 1.4) | 0);
    const x1 = Math.min(this.width - 1, (cx + rx * 1.4) | 0);
    const y0 = Math.max(0, (cy - ry * 1.6) | 0);
    const y1 = Math.min(this.waterY - 4, (cy + ry * 1.6) | 0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        // ilhas têm base pontuda, tipo cenoura de terra
        const dy = value === 1 && y > cy ? (y - cy) / (ry * 1.6) : (y - cy) / ry;
        const wobble = (valueNoise(x * 0.03 + seed, y * 0.03) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 1 + wobble) this.solid[y * this.width + x] = value;
      }
    }
  }

  /** Vigas de metal flutuando acima do chão (indestrutíveis). */
  addGirders(rng: Rng, count: number): Array<{ x: number; y: number; w: number; h: number }> {
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < count; i++) {
      const w = Math.round(rng.range(90, 150));
      const h = 12;
      const x = Math.round(rng.range(200, this.width - 200 - w));
      const ground = this.surfaceY(x + w / 2);
      const y = Math.round(Math.max(120, Math.min(this.waterY - 140, ground - rng.range(90, 190))));
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.solid[yy * this.width + xx] = METAL;
      out.push({ x, y, w, h });
    }
    return out;
  }

  private fillCircle(cx: number, cy: number, r: number, value: 0 | 1): void {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const i = y * this.width + x;
        if (dx * dx + dy * dy <= r2 && this.solid[i] !== METAL) this.solid[i] = value;
      }
    }
  }
}
