import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Theme } from '../../domain/theme';
import type { Camera } from '../camera';
import { hash } from './textures';

/** Mistura duas cores #rrggbb (k=0 → a, k=1 → b). */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return Texture.from(cv);
}

const LAYER_W = 3072;
const LAYER_H = 760;

interface LayerDef {
  /** fator de paralaxe (0 = parado no céu, 1 = junto do terreno) */
  f: number;
  /** linha de base no mundo */
  y: number;
  amp: number;
  /** 0 = longe (some na névoa), 1 = perto (cor cheia) */
  near: number;
  kind: 'peaks' | 'hills' | 'trees';
}

/**
 * Céu e cenário de fundo pintados, em camadas de paralaxe.
 * Cada camada é desenhada uma vez numa faixa larga que se repete na horizontal.
 */
export class Backdrop {
  readonly view = new Container();
  private sky: Sprite;
  private sunGlow: Sprite;
  private sun: Sprite;
  /** cópias lado a lado (repetir só na horizontal; TilingSprite vazaria a borda de cima) */
  private layers: Array<{ def: LayerDef; tex: Texture; parts: Sprite[]; holder: Container; fill: Graphics }> = [];
  private clouds: Array<{ s: Sprite; x: number; y: number; f: number; speed: number }> = [];

  constructor(
    private theme: Theme,
    private worldH: number,
    glow: Texture,
  ) {
    const t = theme;
    this.sky = new Sprite(
      canvasTex(4, 512, (c) => {
        const g = c.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, mix(t.sky[0], '#1b2a5a', 0.15));
        g.addColorStop(0.45, t.sky[0]);
        g.addColorStop(0.8, t.sky[1]);
        g.addColorStop(1, t.sky[2]);
        c.fillStyle = g;
        c.fillRect(0, 0, 4, 512);
      }),
    );
    this.view.addChild(this.sky);

    this.sunGlow = new Sprite(glow);
    this.sunGlow.anchor.set(0.5);
    this.sunGlow.tint = t.sun;
    this.sunGlow.alpha = 0.75;
    this.sunGlow.blendMode = 'add';
    this.sun = new Sprite(
      canvasTex(128, 128, (c) => {
        const g = c.createRadialGradient(54, 54, 4, 64, 64, 60);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.7, t.sun);
        g.addColorStop(1, mix(t.sun, t.sky[2], 0.4));
        c.fillStyle = g;
        c.beginPath();
        c.arc(64, 64, 58, 0, Math.PI * 2);
        c.fill();
      }),
    );
    this.sun.anchor.set(0.5);
    this.view.addChild(this.sunGlow, this.sun);

    // nuvens fofas com sombra embaixo
    const cloudTex = [0, 1, 2].map((k) => this.cloudTexture(k));
    for (let i = 0; i < 12; i++) {
      const s = new Sprite(cloudTex[i % 3]);
      s.anchor.set(0.5);
      const f = 0.06 + hash(i, 4) * 0.12;
      this.clouds.push({ s, x: hash(i, 1) * 4000, y: 80 + hash(i, 2) * 380, f, speed: 6 + hash(i, 3) * 10 });
      s.alpha = 0.8 + f;
      this.view.addChild(s);
    }

    const defs: LayerDef[] = [
      { f: 0.18, y: worldH * 0.52, amp: 170, near: 0, kind: 'peaks' },
      { f: 0.32, y: worldH * 0.56, amp: 110, near: 0.35, kind: 'peaks' },
      { f: 0.5, y: worldH * 0.62, amp: 80, near: 0.65, kind: 'hills' },
      { f: 0.7, y: worldH * 0.7, amp: 60, near: 1, kind: 'trees' },
    ];
    defs.forEach((def, i) => {
      const tex = this.layerTexture(def, i);
      const holder = new Container();
      const fill = new Graphics();
      this.layers.push({ def, tex, parts: [], holder, fill });
      this.view.addChild(holder, fill);
    });
  }

  private layerColor(def: LayerDef): { top: string; bottom: string } {
    const t = this.theme;
    // perto: cor do tema; longe: puxada para o céu (perspectiva de ar)
    const base = def.near > 0.8 ? t.near : def.near > 0.5 ? t.mid : t.far;
    const haze = (1 - def.near) * 0.55;
    return { top: mix(base, t.sky[1], haze), bottom: mix(mix(base, '#1a2030', 0.18), t.sky[1], haze * 0.7) };
  }

  private layerTexture(def: LayerDef, seed: number): Texture {
    const t = this.theme;
    const { top, bottom } = this.layerColor(def);
    const pad = 220;
    return canvasTex(LAYER_W, LAYER_H, (c) => {
      // silhueta que se repete sem emenda: só senos com período que divide a largura
      const k = (Math.PI * 2) / LAYER_W;
      const yAt = (x: number) => {
        let y = Math.sin(x * k * 2 + seed) * def.amp * 0.55 + Math.sin(x * k * 5 + seed * 2) * def.amp * 0.3 + Math.sin(x * k * 13 + seed * 3) * def.amp * 0.12;
        if (def.kind === 'peaks') y -= Math.pow(Math.abs(Math.sin(x * k * 7 + seed)), 3) * def.amp * 0.9;
        return pad + def.amp + y;
      };
      const path = () => {
        c.beginPath();
        c.moveTo(0, LAYER_H);
        for (let x = 0; x <= LAYER_W; x += 6) c.lineTo(x, yAt(x));
        c.lineTo(LAYER_W, LAYER_H);
        c.closePath();
      };
      const g = c.createLinearGradient(0, pad, 0, LAYER_H);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      c.fillStyle = g;
      path();
      c.fill();
      c.save();
      path();
      c.clip();
      // pinceladas: manchas mais claras e mais escuras, como tinta
      for (let i = 0; i < 260; i++) {
        const x = hash(i, seed + 1) * LAYER_W;
        const y = yAt(x) + 10 + hash(seed, i) * (LAYER_H - pad);
        const r = 20 + hash(i + 5, seed) * 60;
        c.fillStyle = hash(i, 7) > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        c.beginPath();
        c.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      }
      // neve nos picos de longe (menos no deserto e no doce)
      if (def.kind === 'peaks' && t.id !== 'deserto') {
        c.fillStyle = t.id === 'doce' ? 'rgba(255,220,240,0.75)' : 'rgba(255,255,255,0.7)';
        for (let x = 0; x <= LAYER_W; x += 4) {
          const y = yAt(x);
          if (y < pad + def.amp * 0.55) c.fillRect(x, y, 4, (pad + def.amp * 0.55 - y) * 0.6 + 4);
        }
      }
      c.restore();
      // luz de borda no topo da silhueta (o "brilho" dos cenários do Worms)
      c.strokeStyle = mix(top, '#ffffff', 0.35);
      c.lineWidth = 3;
      c.beginPath();
      for (let x = 0; x <= LAYER_W; x += 6) c.lineTo(x, yAt(x) + 1.5);
      c.stroke();
      if (def.kind === 'trees') this.paintTrees(c, yAt, seed);
    });
  }

  /** Árvores de desenho animado na camada mais perto (pinheiro na neve, cacto no deserto, pirulito no doce). */
  private paintTrees(c: CanvasRenderingContext2D, yAt: (x: number) => number, seed: number): void {
    const t = this.theme;
    const { top } = this.layerColor({ f: 0, y: 0, amp: 0, near: 1, kind: 'trees' });
    const dark = mix(top, '#102018', 0.25);
    for (let i = 0; i < 46; i++) {
      const x = hash(i, seed + 20) * LAYER_W;
      const y = yAt(x) + 4;
      const s = 0.7 + hash(i, 33) * 0.7;
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      if (t.id === 'deserto') {
        c.fillStyle = dark;
        c.fillRect(-5, -46, 10, 46);
        c.fillRect(-18, -30, 8, 14);
        c.fillRect(-18, -22, 18, 7);
        c.fillRect(10, -38, 8, 18);
        c.fillRect(2, -26, 16, 7);
      } else if (t.id === 'neve') {
        c.fillStyle = dark;
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          c.moveTo(0, -70 + k * 16);
          c.lineTo(-22 + k * 2, -28 + k * 14);
          c.lineTo(22 - k * 2, -28 + k * 14);
          c.closePath();
          c.fill();
        }
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.beginPath();
        c.moveTo(0, -70);
        c.lineTo(-8, -56);
        c.lineTo(8, -56);
        c.closePath();
        c.fill();
      } else {
        c.fillStyle = mix(dark, '#4a2c18', 0.5);
        c.fillRect(-3, -26, 6, 26);
        c.fillStyle = t.id === 'doce' ? mix(top, '#ff8fd0', 0.35) : dark;
        c.beginPath();
        c.arc(0, -40, 20, 0, Math.PI * 2);
        c.arc(-12, -30, 13, 0, Math.PI * 2);
        c.arc(13, -31, 14, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.beginPath();
        c.arc(-6, -47, 9, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  }

  private cloudTexture(k: number): Texture {
    const t = this.theme;
    return canvasTex(320, 150, (c) => {
      const puffs: Array<[number, number, number]> = [];
      const n = 4 + k;
      for (let i = 0; i < n; i++) puffs.push([60 + (i / (n - 1)) * 200, 80 + (hash(i, k) - 0.5) * 20, 30 + hash(k, i) * 26]);
      // sombra azulada embaixo, branco em cima
      const shade = mix(t.cloud, t.sky[0], 0.35);
      for (const [layer, dy, col] of [
        [0, 10, shade],
        [1, 0, t.cloud],
      ] as const) {
        c.fillStyle = col;
        for (const [x, y, r] of puffs) {
          c.beginPath();
          c.arc(x, y + dy - layer * 4, r, 0, Math.PI * 2);
          c.fill();
        }
        c.beginPath();
        c.ellipse(160, 100 + dy, 130, 26, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (const [x, y, r] of puffs) {
        c.beginPath();
        c.arc(x - r * 0.25, y - r * 0.35, r * 0.45, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  update(cam: Camera, w: number, h: number, time: number, wind: number): void {
    const z = cam.zoom;
    this.sky.width = w;
    this.sky.height = h;
    const sunX = w * 0.78 - cam.x * z * 0.03;
    const sunY = h * 0.2 - (cam.y - 700) * z * 0.05;
    this.sun.position.set(sunX, sunY);
    this.sun.scale.set(z * 0.85);
    this.sunGlow.position.set(sunX, sunY);
    this.sunGlow.scale.set(z * 4.2 + Math.sin(time * 0.8) * 0.08);

    const toScreenY = (y: number, f: number) => h / 2 + (y - cam.y * f - (1 - f) * this.worldH * 0.5) * z;
    for (const c of this.clouds) {
      c.x += (wind * 9 + c.speed) * (1 / 60);
      const span = 4000;
      let sx = (c.x - cam.x * c.f) * z;
      sx = (((sx % (span * z)) + span * z) % (span * z)) - 300 * z;
      c.s.position.set(sx, toScreenY(c.y, c.f));
      c.s.scale.set(z * (0.6 + c.f * 3));
    }
    for (const L of this.layers) {
      const pad = 220;
      const topY = toScreenY(L.def.y - L.def.amp - pad, L.def.f);
      const pw = LAYER_W * z;
      const off = -((cam.x * L.def.f - w / 2 / z) * z);
      let x = (((off % pw) + pw) % pw) - pw;
      let i = 0;
      for (; x < w; x += pw, i++) {
        let sp = L.parts[i];
        if (!sp) {
          sp = new Sprite(L.tex);
          L.parts.push(sp);
          L.holder.addChild(sp);
        }
        sp.visible = true;
        sp.position.set(x, topY);
        sp.scale.set(z);
      }
      for (; i < L.parts.length; i++) L.parts[i].visible = false;
      // abaixo da faixa pintada, cor sólida até o fim da tela
      const bottomY = topY + LAYER_H * z - 1;
      L.fill.clear();
      if (bottomY < h) L.fill.rect(0, bottomY, w, h - bottomY).fill(this.layerColor(L.def).bottom);
    }
  }
}
