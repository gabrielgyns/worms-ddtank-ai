import { Application, BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Match } from '../../domain/match';
import type { Camera } from '../camera';
import type { TerrainView } from '../terrainView';
import { Ambience } from './ambience';
import { Backdrop } from './backdrop';
import { makeVfxTextures, type VfxTextures } from './textures';
import { Vfx } from './vfx';

export interface GpuFrame {
  match: Match;
  cam: Camera;
  terrain: TerrainView;
  /** largura/altura em pixels CSS */
  w: number;
  h: number;
  time: number;
  dt: number;
  waterY: number;
  /** deslocamento da tremida de tela (o mesmo do desenho 2D, para as camadas não descolarem) */
  shakeX: number;
  shakeY: number;
  /** ondulação dos impactos na água (deslocamento vertical por x) */
  ripple?: (x: number) => number;
}

/**
 * Visual novo na GPU (PixiJS), em duas camadas em volta do desenho 2D que ainda existe:
 * - atrás: céu, cenário pintado, água do fundo, terreno com sombra, fumaça;
 * - na frente: fogo, brilho, faíscas, destroços e o quadro de impacto.
 * O desenho 2D (bolotas, projéteis, rótulos) fica no meio até ser migrado também.
 */
export class GpuStage {
  private backdrop: Backdrop | null = null;
  private ambience: Ambience | null = null;
  private themeId = '';
  private backWorld = new Container();
  private frontWorld = new Container();
  private terrainSprite: Sprite | null = null;
  private terrainShadow: Sprite | null = null;
  private terrainSource: HTMLCanvasElement | null = null;
  private terrainTex: Texture | null = null;
  private terrainDirty = false;
  private waterBack = new Graphics();
  readonly vfx: Vfx;
  private tex: VfxTextures;

  private constructor(
    private back: Application,
    private front: Application,
  ) {
    this.tex = makeVfxTextures();
    this.vfx = new Vfx(this.tex);
    back.stage.addChild(this.backWorld);
    front.stage.addChild(this.frontWorld, this.vfx.screen.view);
  }

  /** Cria as duas camadas; null se o aparelho não tiver WebGL. */
  static async create(backCanvas: HTMLCanvasElement, frontCanvas: HTMLCanvasElement, dpr: number): Promise<GpuStage | null> {
    try {
      const opts = { backgroundAlpha: 0, antialias: true, resolution: dpr, autoDensity: true, preference: 'webgl' as const, width: innerWidth, height: innerHeight };
      const back = new Application();
      await back.init({ ...opts, canvas: backCanvas, backgroundAlpha: 1, background: '#000000' });
      const front = new Application();
      await front.init({ ...opts, canvas: frontCanvas });
      // quem manda no relógio é o loop do jogo
      back.ticker.stop();
      front.ticker.stop();
      return new GpuStage(back, front);
    } catch {
      return null;
    }
  }

  private setup(f: GpuFrame): void {
    const m = f.match;
    if (this.themeId !== m.theme.id) {
      this.themeId = m.theme.id;
      if (this.backdrop) this.back.stage.removeChild(this.backdrop.view);
      this.backdrop = new Backdrop(m.theme, m.terrain.height, this.tex.glow);
      this.back.stage.addChildAt(this.backdrop.view, 0);
      if (this.ambience) {
        this.front.stage.removeChild(this.ambience.vignette);
        this.ambience.destroy();
      }
      this.ambience = new Ambience(m.theme.id, this.tex);
      this.front.stage.addChild(this.ambience.vignette);
      this.frontWorld.addChild(this.ambience.world);
    }
    if (this.terrainSource !== f.terrain.canvas) {
      this.terrainSource = f.terrain.canvas;
      this.terrainTex?.destroy(false);
      this.terrainTex = Texture.from(f.terrain.canvas);
      this.backWorld.removeChildren();
      // sombra do terreno sobre o cenário: dá profundidade (o terreno "descola" do fundo)
      this.terrainShadow = new Sprite(this.terrainTex);
      this.terrainShadow.tint = 0x000000;
      this.terrainShadow.alpha = 0.28;
      this.terrainShadow.position.set(10, 14);
      this.terrainShadow.filters = [new BlurFilter({ strength: 10, quality: 2 })];
      this.terrainSprite = new Sprite(this.terrainTex);
      this.backWorld.addChild(this.waterBack, this.vfx.back.view, this.terrainShadow, this.terrainSprite);
      const dirty = () => (this.terrainDirty = true);
      m.terrain.onCarve(dirty);
      m.terrain.onBuild(dirty);
      m.terrain.onReset(dirty);
      this.frontWorld.removeChildren();
      this.frontWorld.addChild(this.vfx.front.view);
      if (this.ambience) this.frontWorld.addChild(this.ambience.world);
    }
    this.vfx.attach(m);
  }

  render(f: GpuFrame): void {
    this.setup(f);
    const { w, h, cam } = f;
    if (this.back.renderer.screen.width !== w || this.back.renderer.screen.height !== h) {
      this.back.renderer.resize(w, h);
      this.front.renderer.resize(w, h);
    }
    if (this.terrainDirty && this.terrainTex) {
      this.terrainTex.source.update();
      this.terrainDirty = false;
    }
    this.backdrop!.update(cam, w, h, f.time, f.match.wind);
    const z = cam.zoom;
    for (const world of [this.backWorld, this.frontWorld]) {
      world.scale.set(z);
      world.position.set(w / 2 - cam.x * z + f.shakeX, h / 2 - cam.y * z + f.shakeY);
    }
    this.drawWaterBack(f);
    this.ambience!.update(cam, w, h, f.time, f.dt, f.match.wind);
    this.vfx.update(f.dt);
    for (const imp of this.vfx.takeImpacts()) {
      this.vfx.impactFrame((imp.x - cam.x) * z + w / 2, (imp.y - cam.y) * z + h / 2, imp.power, w, h);
    }
    this.back.renderer.render(this.back.stage);
    this.front.renderer.render(this.front.stage);
  }

  /** Água de trás do terreno: ondas suaves, mais escura que a da frente. */
  private drawWaterBack(f: GpuFrame): void {
    const g = this.waterBack;
    const m = f.match;
    const left = f.cam.x - f.w / 2 / f.cam.zoom - 40;
    const right = f.cam.x + f.w / 2 / f.cam.zoom + 40;
    const bottom = f.cam.y + f.h / 2 / f.cam.zoom + 40;
    g.clear();
    g.moveTo(left, bottom);
    const step = f.ripple ? 6 : 16;
    for (let x = left; x <= right; x += step) g.lineTo(x, f.waterY - 14 + Math.sin(x * 0.02 + f.time * 1.6) * 5 + (f.ripple ? f.ripple(x) * 0.7 : 0));
    g.lineTo(right, bottom);
    g.closePath();
    g.fill({ color: m.theme.water[1], alpha: 0.85 });
  }
}
