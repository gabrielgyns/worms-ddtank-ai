import { hash2, valueNoise } from '../core/math';
import { METAL, type Terrain } from '../domain/terrain';
import type { Theme } from '../domain/theme';

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Ruído suave amostrado numa grade e interpolado: o mesmo desenho com uma fração das
 * contas (o terreno inteiro tem milhões de pixels). Só para ruídos que variam devagar
 * em relação ao passo da grade.
 */
function noiseGrid(w: number, h: number, step: number, f: (x: number, y: number) => number): (x: number, y: number) => number {
  const gw = Math.ceil(w / step) + 2;
  const gh = Math.ceil(h / step) + 2;
  const data = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) data[gy * gw + gx] = f(gx * step, gy * step);
  return (x, y) => {
    const fx = Math.max(0, x) / step;
    const fy = Math.max(0, y) / step;
    const ix = fx | 0;
    const iy = fy | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const i = iy * gw + ix;
    const a = data[i];
    const b = data[i + 1];
    const c = data[i + gw];
    const d = data[i + gw + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
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
    terrain.onBuild((x0, y0, x1, y1) => this.repaintMetal(x0 - 3, y0 - 3, x1 + 3, y1 + 3));
  }

  /**
   * Pinta o terreno como cenário de desenho animado:
   * camadas de solo, pedras com volume, luz vindo de cima-esquerda,
   * sombra embaixo das saliências e grama com tufos e franjas caindo.
   */
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

    // distâncias até o ar: abaixo (para a sombra das saliências) e dos lados (luz lateral)
    const below = new Uint16Array(w * h);
    for (let x = 0; x < w; x++) {
      let run = 0;
      for (let y = h - 1; y >= 0; y--) {
        const i = y * w + x;
        run = solid[i] ? Math.min(run + 1, 999) : 0;
        below[i] = run;
      }
    }
    const fromLeft = new Uint16Array(w * h);
    const fromRight = new Uint16Array(w * h);
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        run = solid[i] ? Math.min(run + 1, 999) : 0;
        fromLeft[i] = run;
      }
      run = 0;
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        run = solid[i] ? Math.min(run + 1, 999) : 0;
        fromRight[i] = run;
      }
    }

    // ruídos lentos numa grade (camadas, manchas grandes, pedras); o fino continua exato
    const strataN = noiseGrid(w, h, 8, (x, y) => valueNoise(x * 0.01, y * 0.004));
    const blotch = noiseGrid(w, h, 4, (x, y) => valueNoise(x * 0.035, y * 0.035));
    const rockN = noiseGrid(w, h, 2, (x, y) => valueNoise(x * 0.05 + 50, y * 0.05));

    // profundidade desde a superfície e altura da grama, por coluna; o laço anda linha a
    // linha (memória em sequência) e sem criar arrays por pixel: são milhões de pixels
    const depthCol = new Int32Array(w);
    const grassCol = new Int32Array(w);
    for (let x = 0; x < w; x++) grassCol[x] = 12 + Math.round(valueNoise(x * 0.08, 3) * 7);
    const [olR, olG, olB] = ol;
    for (let y = 0; y < h; y++) {
      const deep = Math.min(1, y / h) * 0.35;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!solid[i]) {
          depthCol[x] = 0;
          continue;
        }
        const depth = ++depthCol[x];
        const grassLen = grassCol[x];
        const o = i * 4;
        d[o + 3] = 255;
        if (solid[i] === METAL) {
          const m = metalColor(x, y, solid, i, w);
          d[o] = m[0];
          d[o + 1] = m[1];
          d[o + 2] = m[2];
          continue;
        }
        if (depth <= 3 || fromLeft[i] <= 2 || fromRight[i] <= 2 || below[i] <= 2) {
          d[o] = olR;
          d[o + 1] = olG;
          d[o + 2] = olB;
          continue;
        }
        if (depth <= grassLen) {
          const g = depth <= 6 ? g0 : depth <= grassLen - 4 ? g1 : g2;
          d[o] = g[0];
          d[o + 1] = g[1];
          d[o + 2] = g[2];
          continue;
        }
        // camadas de solo onduladas
        const strata = Math.sin(y * 0.09 + strataN(x, y) * 6) * 0.5 + 0.5;
        const n = blotch(x, y) * 0.55 + valueNoise(x * 0.12, y * 0.12) * 0.25 + strata * 0.2;
        const t = Math.min(1, Math.max(0, n * 0.85 + deep));
        let r = d0[0] + (d1[0] - d0[0]) * t;
        let g = d0[1] + (d1[1] - d0[1]) * t;
        let b = d0[2] + (d1[2] - d0[2]) * t;
        if (hash2(x >> 2, y >> 2) > 0.968) {
          if (candy) {
            const pink = hash2(x >> 2, (y >> 2) + 7) > 0.5;
            r = pink ? 255 : 140;
            g = pink ? 140 : 220;
            b = pink ? 200 : 255;
          } else [r, g, b] = sp;
        }
        // pedras com volume: claro em cima-esquerda, escuro embaixo-direita
        const rock = rockN(x, y);
        if (rock > 0.8) {
          // dentro da pedra o ruído sobe: borda de cima-esquerda tem o "de dentro" embaixo-direita → clara
          const lit = rockN(x + 3, y + 3) - rockN(x - 3, y - 3);
          const base = rock > 0.84 ? 0.78 : 0.62;
          const k = base + lit * 3;
          r = r * k + 70 * (1 - base);
          g = g * k + 62 * (1 - base);
          b = b * k + 60 * (1 - base);
          if (rock < 0.81) {
            r *= 0.55;
            g *= 0.5;
            b *= 0.5;
          }
        }
        // luz: borda de cima clara, saliência de baixo escura, lado direito mais escuro
        let light = 1;
        if (below[i] < 22) light -= (1 - below[i] / 22) * 0.45;
        if (fromLeft[i] < 12) light += (1 - fromLeft[i] / 12) * 0.12;
        if (fromRight[i] < 14) light -= (1 - fromRight[i] / 14) * 0.2;
        if (depth < grassLen + 10) light -= (1 - (depth - grassLen) / 10) * 0.25; // sombra da grama
        // ImageData já corta em 0..255
        d[o] = r * light;
        d[o + 1] = g * light;
        d[o + 2] = b * light;
      }
    }
    this.ctx.putImageData(img, 0, 0);
    this.paintGrass();
  }

  /** Tufos de grama no topo e franjas caindo das beiradas (desenhados por cima, com traço). */
  private paintGrass(): void {
    const { width: w, solid } = this.terrain;
    const c = this.ctx;
    const t = this.theme;
    const surf = (x: number): number => {
      for (let y = 0; y < this.terrain.height; y++) if (solid[y * w + x] && solid[y * w + x] !== METAL) return y;
      return -1;
    };
    c.save();
    c.lineCap = 'round';
    let prev = surf(0);
    for (let x = 4; x < w - 4; x += 5) {
      const y = surf(x);
      if (y < 0 || y > this.terrain.waterY - 4) {
        prev = y;
        continue;
      }
      // tufo: 3 folhinhas curvas
      const k = hash2(x, 17);
      if (k > 0.35) {
        for (let b = 0; b < 3; b++) {
          const bx = x + (b - 1) * 2.5;
          const len = 5 + hash2(x, b) * 7;
          const lean = (hash2(b, x) - 0.5) * 6;
          c.strokeStyle = t.outline;
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(bx, y + 3);
          c.quadraticCurveTo(bx + lean * 0.3, y - len * 0.5, bx + lean, y - len);
          c.stroke();
          c.strokeStyle = b === 1 ? t.grass[0] : t.grass[1];
          c.lineWidth = 1.6;
          c.stroke();
        }
      }
      // beirada: o terreno cai de repente ao lado → franja de grama pendurada
      const next = surf(Math.min(w - 1, x + 5));
      for (const [edgeY, dir] of [
        [prev, -1],
        [next, 1],
      ] as const) {
        if (edgeY < 0 || edgeY - y < 14) continue;
        const ex = x + dir * 3;
        for (let s2 = 0; s2 < 4; s2++) {
          const len = 8 + hash2(x + s2, 5) * 16;
          const sx = ex + (s2 - 1.5) * 2;
          c.strokeStyle = t.outline;
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(sx, y + 2);
          c.quadraticCurveTo(sx + dir * 4, y + len * 0.5, sx + dir * 2, y + len);
          c.stroke();
          c.strokeStyle = s2 % 2 ? t.grass[1] : t.grass[2];
          c.lineWidth = 1.7;
          c.stroke();
        }
      }
      prev = y;
    }
    c.restore();
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
