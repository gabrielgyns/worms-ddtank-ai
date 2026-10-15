import { Container, Sprite, Texture } from 'pixi.js';
import type { ThemeId } from '../../domain/theme';
import type { Camera } from '../camera';
import type { VfxTextures } from './textures';

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return Texture.from(cv);
}

/** O que flutua no ar de cada cenário. */
interface AirKind {
  tex: (t: VfxTextures) => Texture;
  tints: number[];
  count: number;
  /** velocidade de queda (px/s) e quanto o vento empurra */
  fall: [number, number];
  wind: number;
  /** balanço de um lado para o outro */
  sway: number;
  size: [number, number];
  alpha: number;
  add: boolean;
  /** pisca (brilhos) */
  twinkle: boolean;
}

const AIR: Record<ThemeId, AirKind[]> = {
  // folhas caindo e pólen dourado
  prado: [
    { tex: (t) => t.leaf, tints: [0x7fd13b, 0xb6f05a, 0xe8c547], count: 14, fall: [25, 45], wind: 4, sway: 24, size: [0.7, 1.1], alpha: 0.9, add: false, twinkle: false },
    { tex: (t) => t.glow, tints: [0xfff3a0], count: 22, fall: [-6, 6], wind: 2, sway: 10, size: [0.03, 0.06], alpha: 0.8, add: true, twinkle: true },
  ],
  // poeira de areia levada pelo vento
  deserto: [{ tex: (t) => t.smoke[0], tints: [0xe8b98a, 0xd9a06a], count: 18, fall: [-4, 8], wind: 7, sway: 6, size: [0.05, 0.12], alpha: 0.35, add: false, twinkle: false }],
  // neve
  neve: [{ tex: (t) => t.glow, tints: [0xffffff, 0xeaf4ff], count: 70, fall: [30, 70], wind: 3, sway: 14, size: [0.04, 0.09], alpha: 0.95, add: false, twinkle: false }],
  // pétalas cor-de-rosa e brilhinhos de açúcar
  doce: [
    { tex: (t) => t.leaf, tints: [0xffb3d9, 0xff8fd0, 0xffe0f0], count: 16, fall: [20, 40], wind: 4, sway: 26, size: [0.6, 1], alpha: 0.9, add: false, twinkle: false },
    { tex: (t) => t.glow, tints: [0xffffff, 0xbfe8ff, 0xffd6f0], count: 24, fall: [-4, 6], wind: 2, sway: 8, size: [0.03, 0.06], alpha: 0.9, add: true, twinkle: true },
  ],
};

interface Mote {
  s: Sprite;
  kind: AirKind;
  x: number;
  y: number;
  vy: number;
  phase: number;
  spin: number;
}

/**
 * Clima do cenário na GPU: partículas no ar ao redor da câmera (folhas, neve, poeira,
 * pétalas) e a vinheta escurecendo as bordas da tela. Só enfeite, sem estado de jogo.
 */
export class Ambience {
  /** no mundo, na frente do terreno */
  readonly world = new Container();
  /** na tela, por cima de tudo */
  readonly vignette: Sprite;
  private motes: Mote[] = [];

  constructor(theme: ThemeId, tex: VfxTextures) {
    for (const kind of AIR[theme]) {
      for (let i = 0; i < kind.count; i++) {
        const s = new Sprite(kind.tex(tex));
        s.anchor.set(0.5);
        s.tint = kind.tints[i % kind.tints.length];
        s.blendMode = kind.add ? 'add' : 'normal';
        s.scale.set(kind.size[0] + Math.random() * (kind.size[1] - kind.size[0]));
        s.alpha = kind.alpha;
        this.world.addChild(s);
        this.motes.push({
          s,
          kind,
          x: NaN,
          y: NaN,
          vy: kind.fall[0] + Math.random() * (kind.fall[1] - kind.fall[0]),
          phase: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 2,
        });
      }
    }
    this.vignette = new Sprite(
      canvasTex(256, 256, (c) => {
        const g = c.createRadialGradient(128, 128, 70, 128, 128, 182);
        g.addColorStop(0, 'rgba(20,10,30,0)');
        g.addColorStop(1, 'rgba(20,10,30,0.38)');
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 256);
      }),
    );
  }

  update(cam: Camera, w: number, h: number, time: number, dt: number, wind: number): void {
    this.vignette.width = w;
    this.vignette.height = h;
    // retângulo visível do mundo, com folga: o que sai por um lado volta pelo outro
    const hw = w / 2 / cam.zoom + 60;
    const hh = h / 2 / cam.zoom + 60;
    const left = cam.x - hw;
    const top = cam.y - hh;
    for (const m of this.motes) {
      if (Number.isNaN(m.x)) {
        m.x = left + Math.random() * hw * 2;
        m.y = top + Math.random() * hh * 2;
      }
      m.x += wind * m.kind.wind * dt;
      m.y += m.vy * dt;
      // volta para dentro do quadro (a câmera anda, o clima vai junto)
      if (m.x < left) m.x += hw * 2;
      else if (m.x > left + hw * 2) m.x -= hw * 2;
      if (m.y < top) m.y += hh * 2;
      else if (m.y > top + hh * 2) m.y -= hh * 2;
      m.phase += dt * 1.6;
      m.s.position.set(m.x + Math.sin(m.phase) * m.kind.sway, m.y);
      m.s.rotation = m.kind.sway > 15 ? Math.sin(m.phase * 0.9) * 1.2 + m.spin : m.s.rotation;
      if (m.kind.twinkle) m.s.alpha = m.kind.alpha * (0.4 + 0.6 * Math.abs(Math.sin(time * 2.2 + m.phase * 3)));
    }
  }

  destroy(): void {
    this.world.destroy({ children: true });
    this.vignette.destroy();
  }
}
