import type { Theme } from '../domain/theme';
import type { Camera } from './camera';

interface Cloud {
  x: number;
  y: number;
  s: number;
  puffs: Array<[number, number, number]>;
}

interface Layer {
  f: number;
  y: number;
  color: string;
  amp: number;
  freq: [number, number, number];
  phase: number;
  peaks: boolean;
}

const SPAN = 4200;

/** Céu, sol, nuvens e montanhas em paralaxe. Nuvens andam com o vento. */
export class Background {
  private clouds: Cloud[] = [];
  private layers: Layer[];

  constructor(
    private theme: Theme,
    private worldH: number,
  ) {
    for (let i = 0; i < 14; i++) {
      const puffs: Array<[number, number, number]> = [];
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) puffs.push([k * 26 - n * 13, Math.random() * 10 - 5, 20 + Math.random() * 18]);
      this.clouds.push({ x: Math.random() * SPAN, y: 60 + Math.random() * 420, s: 0.6 + Math.random() * 0.8, puffs });
    }
    const ph = Math.random() * 100;
    this.layers = [
      { f: 0.25, y: worldH * 0.55, color: theme.far, amp: 140, freq: [0.0023, 0.0061, 0.017], phase: ph, peaks: true },
      { f: 0.45, y: worldH * 0.58, color: theme.mid, amp: 90, freq: [0.0031, 0.0083, 0.02], phase: ph + 3, peaks: false },
      { f: 0.65, y: worldH * 0.66, color: theme.near, amp: 70, freq: [0.0042, 0.011, 0.025], phase: ph + 7, peaks: false },
    ];
  }

  update(dt: number, wind: number): void {
    for (const c of this.clouds) {
      c.x += (wind * 9 + 8) * c.s * dt;
      if (c.x > SPAN) c.x -= SPAN;
      if (c.x < 0) c.x += SPAN;
    }
  }

  draw(c: CanvasRenderingContext2D, cam: Camera, w: number, h: number, time: number): void {
    const t = this.theme;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, t.sky[0]);
    g.addColorStop(0.6, t.sky[1]);
    g.addColorStop(1, t.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    // sol com halo
    const sunX = w * 0.78 - cam.x * cam.zoom * 0.03;
    const sunY = h * 0.2 - (cam.y - 700) * cam.zoom * 0.05;
    const halo = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 220 * cam.zoom);
    halo.addColorStop(0, t.sun);
    halo.addColorStop(0.3, t.sun + '88');
    halo.addColorStop(1, t.sun + '00');
    c.fillStyle = halo;
    c.fillRect(sunX - 240 * cam.zoom, sunY - 240 * cam.zoom, 480 * cam.zoom, 480 * cam.zoom);
    c.fillStyle = t.sun;
    c.beginPath();
    c.arc(sunX, sunY, 48 * cam.zoom, 0, Math.PI * 2);
    c.fill();

    const z = cam.zoom;
    const toScreenY = (y: number, f: number) => h / 2 + (y - cam.y * f - (1 - f) * this.worldH * 0.5) * z;

    // nuvens distantes
    c.fillStyle = t.cloud;
    for (const cl of this.clouds) {
      const f = 0.12 * cl.s;
      let sx = (cl.x - cam.x * f) * z;
      sx = ((sx % (SPAN * z)) + SPAN * z) % (SPAN * z) - 200 * z;
      if (sx > w + 200) continue;
      const sy = toScreenY(cl.y, f);
      c.globalAlpha = 0.55 + cl.s * 0.3;
      for (const [px, py, r] of cl.puffs) {
        c.beginPath();
        c.arc(sx + px * cl.s * z, sy + py * cl.s * z, r * cl.s * z, 0, Math.PI * 2);
        c.fill();
      }
      const span = cl.puffs.length * 13 * cl.s * z;
      c.beginPath();
      c.ellipse(sx, sy + 8 * cl.s * z, span + 14 * cl.s * z, 16 * cl.s * z, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    for (const L of this.layers) {
      c.fillStyle = L.color;
      c.beginPath();
      c.moveTo(0, h);
      for (let sx = 0; sx <= w + 8; sx += 8) {
        const wx = sx / z + cam.x * L.f - w / 2 / z;
        let y =
          Math.sin(wx * L.freq[0] + L.phase) * L.amp +
          Math.sin(wx * L.freq[1] + L.phase * 2) * L.amp * 0.4 +
          Math.sin(wx * L.freq[2] + L.phase * 3) * L.amp * 0.12;
        if (L.peaks) y -= Math.abs(Math.sin(wx * 0.004 + L.phase)) * L.amp * 0.8;
        c.lineTo(sx, toScreenY(L.y + y, L.f));
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
      // brilho de topo
      if (L.peaks && this.theme.id !== 'deserto') {
        c.save();
        c.clip();
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(0, 0, w, toScreenY(L.y - L.amp * 0.6, L.f));
        c.restore();
      }
    }
    void time;
  }
}

/** Água com ondas: uma camada atrás do terreno, outra na frente. */
export function drawWater(
  c: CanvasRenderingContext2D,
  theme: Theme,
  waterY: number,
  x0: number,
  x1: number,
  bottom: number,
  time: number,
  front: boolean,
): void {
  const amp = front ? 6 : 8;
  const off = front ? 0 : -14;
  const speed = front ? 1.6 : -1.1;
  c.beginPath();
  c.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + 16; x += 16) {
    const y = waterY + off + Math.sin(x * 0.02 + time * speed) * amp + Math.sin(x * 0.047 - time * 2.1) * amp * 0.4;
    c.lineTo(x, y);
  }
  c.lineTo(x1 + 16, bottom);
  c.closePath();
  const g = c.createLinearGradient(0, waterY - 20, 0, bottom);
  g.addColorStop(0, theme.water[0]);
  g.addColorStop(1, theme.water[1]);
  c.fillStyle = g;
  c.globalAlpha = front ? 0.88 : 0.6;
  c.fill();
  c.globalAlpha = 1;
  if (front) {
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = x0; x <= x1 + 16; x += 16) {
      const y = waterY + Math.sin(x * 0.02 + time * speed) * amp + Math.sin(x * 0.047 - time * 2.1) * amp * 0.4;
      if (x === x0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
}
