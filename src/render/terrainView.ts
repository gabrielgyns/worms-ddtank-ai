import { hash2, valueNoise } from '../core/math';
import { METAL, type Terrain } from '../domain/terrain';
import type { Theme } from '../domain/theme';

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Viga de metal: cinza com borda escura, faixa clara e rebites. */
function metalColor(x: number, y: number, solid: Uint8Array, i: number, w: number): [number, number, number] {
  const edge = solid[i - w] !== METAL || solid[i + w] !== METAL || solid[i - 1] !== METAL || solid[i + 1] !== METAL;
  if (edge) return [42, 32, 30];
  if (solid[i - 2 * w] !== METAL) return [214, 220, 228];
  const rivet = (x % 18 === 6 || x % 18 === 7) && (solid[i - 4 * w] !== METAL || solid[i + 4 * w] !== METAL);
  if (rivet) return [90, 96, 108];
  return y % 2 ? [150, 158, 170] : [160, 168, 180];
}

/** Pinta a máscara do terreno numa textura cartoon e mantém a cratera atualizada. */
export class TerrainView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(
    private terrain: Terrain,
    private theme: Theme,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = terrain.width;
    this.canvas.height = terrain.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.paint();
    terrain.onCarve((x, y, r) => this.carve(x, y, r));
    terrain.onReset(() => this.paint());
  }

  private paint(): void {
    const { width: w, height: h, solid } = this.terrain;
    const img = this.ctx.createImageData(w, h);
    const d = img.data;
    const g0 = hex(this.theme.grass[0]);
    const g1 = hex(this.theme.grass[1]);
    const g2 = hex(this.theme.grass[2]);
    const d0 = hex(this.theme.dirt[0]);
    const d1 = hex(this.theme.dirt[1]);
    const sp = hex(this.theme.speck);
    const ol = hex(this.theme.outline);
    const candy = this.theme.id === 'doce';

    for (let x = 0; x < w; x++) {
      let depth = 0;
      // grama com borda ondulada
      const grassLen = 11 + Math.round(valueNoise(x * 0.08, 3) * 6);
      for (let y = 0; y < h; y++) {
        const i = y * w + x;
        if (!solid[i]) {
          depth = 0;
          continue;
        }
        depth++;
        const o = i * 4;
        if (solid[i] === METAL) {
          const m = metalColor(x, y, solid, i, w);
          d[o] = m[0];
          d[o + 1] = m[1];
          d[o + 2] = m[2];
          d[o + 3] = 255;
          continue;
        }
        let c: [number, number, number];
        const edgeSide =
          (x > 0 && !solid[i - 1]) || (x < w - 1 && !solid[i + 1]) || (x > 1 && !solid[i - 2]) || (x < w - 2 && !solid[i + 2]);
        const below = y < h - 2 && !solid[i + w * 2];
        if (depth <= 3 || edgeSide || below) c = ol;
        else if (depth <= 6) c = g0;
        else if (depth <= grassLen - 3) c = g1;
        else if (depth <= grassLen) c = g2;
        else {
          const n = valueNoise(x * 0.035, y * 0.035) * 0.6 + valueNoise(x * 0.12, y * 0.12) * 0.4;
          const deep = Math.min(1, y / h) * 0.35;
          const t = Math.min(1, Math.max(0, n * 0.9 + deep));
          c = [d0[0] + (d1[0] - d0[0]) * t, d0[1] + (d1[1] - d0[1]) * t, d0[2] + (d1[2] - d0[2]) * t];
          const hv = hash2(x >> 2, y >> 2);
          if (hv > 0.965) c = candy ? (hash2(x >> 2, (y >> 2) + 7) > 0.5 ? [255, 140, 200] : [140, 220, 255]) : sp;
          // pedrinhas
          const rock = valueNoise(x * 0.06 + 50, y * 0.06);
          if (rock > 0.82) {
            const k = rock > 0.86 ? 0.75 : 0.55;
            c = [c[0] * k + 60 * (1 - k), c[1] * k + 50 * (1 - k), c[2] * k + 50 * (1 - k)];
          }
        }
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  private carve(x: number, y: number, r: number): void {
    const c = this.ctx;
    c.save();
    // borda queimada da cratera
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = this.theme.outline;
    c.beginPath();
    c.arc(x, y, r + 4, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.35;
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(x, y, r + 10, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
    this.repaintMetal(x - r - 12, y - r - 12, x + r + 12, y + r + 12);
  }

  /** O metal não queima nem some: repinta o que a explosão sujou. */
  private repaintMetal(x0: number, y0: number, x1: number, y1: number): void {
    const { width: w, height: h, solid } = this.terrain;
    const ax = Math.max(0, Math.floor(x0));
    const ay = Math.max(0, Math.floor(y0));
    const bx = Math.min(w, Math.ceil(x1));
    const by = Math.min(h, Math.ceil(y1));
    if (bx <= ax || by <= ay) return;
    let any = false;
    for (let y = ay; y < by && !any; y++) for (let x = ax; x < bx; x++) if (solid[y * w + x] === METAL) { any = true; break; }
    if (!any) return;
    const img = this.ctx.getImageData(ax, ay, bx - ax, by - ay);
    const d = img.data;
    for (let y = ay; y < by; y++) {
      for (let x = ax; x < bx; x++) {
        const i = y * w + x;
        if (solid[i] !== METAL) continue;
        const o = ((y - ay) * (bx - ax) + (x - ax)) * 4;
        const m = metalColor(x, y, solid, i, w);
        d[o] = m[0];
        d[o + 1] = m[1];
        d[o + 2] = m[2];
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(img, ax, ay);
  }
}
