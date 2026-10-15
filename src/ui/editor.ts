import { Rng } from '../core/math';
import { decodeMask, encodeMask } from '../domain/codec';
import { WATER_Y, WORLD_H, WORLD_W } from '../domain/match';
import { AIR, DIRT, METAL, Terrain } from '../domain/terrain';
import { THEMES, type ThemeId } from '../domain/theme';
import { deleteMap, loadMaps, mapLink, saveMap, type SavedMap } from '../progress/maps';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const SCALE = 4; // 1 pixel da prévia = 4×4 do mundo

type Tool = 'dirt' | 'metal' | 'erase';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Editor de mapas: desenhe terra, metal ou buracos com o dedo ou o mouse. */
export class EditorUi {
  private mask = new Uint8Array(WORLD_W * WORLD_H);
  private tool: Tool = 'dirt';
  private brush = 40;
  private theme: ThemeId = 'prado';
  private name = 'Meu mapa';
  private id = '';
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  private notice = '';

  constructor(
    private show: (id: string | null) => void,
    private onTest: (map: string, theme: ThemeId) => void,
  ) {
    $('#editor-btn').addEventListener('click', () => this.open());
  }

  open(map?: SavedMap): void {
    if (map) this.load(map);
    else if (!this.id) this.random();
    this.show('editor');
    this.render();
  }

  private load(m: SavedMap): void {
    this.mask.fill(0);
    decodeMask(m.data, this.mask);
    this.theme = m.theme;
    this.name = m.name;
    this.id = m.id;
  }

  private random(): void {
    const t = new Terrain(WORLD_W, WORLD_H, WATER_Y);
    t.generate(new Rng((Math.random() * 2 ** 31) | 0));
    this.mask.set(t.solid);
    this.id = `m${Date.now().toString(36)}`;
  }

  private flat(): void {
    this.mask.fill(AIR);
    const top = Math.round(WORLD_H * 0.62);
    for (let y = top; y < WORLD_H; y++) this.mask.fill(DIRT, y * WORLD_W + 160, y * WORLD_W + WORLD_W - 160);
  }

  /** Tem chão suficiente para as bolotas? */
  private playable(): boolean {
    let cols = 0;
    for (let x = 0; x < WORLD_W; x += 20) {
      for (let y = 0; y < WATER_Y - 30; y += 4) {
        if (this.mask[y * WORLD_W + x] !== AIR) {
          cols++;
          break;
        }
      }
    }
    return cols >= (WORLD_W / 20) * 0.3;
  }

  private current(): SavedMap {
    return { id: this.id, name: this.name, theme: this.theme, data: encodeMask(this.mask), at: Date.now() };
  }

  private render(): void {
    const body = $('#editor-body');
    const saved = loadMaps();
    body.innerHTML = `
      <div class="ed-tools">
        <div class="seg">${(['dirt', 'metal', 'erase'] as Tool[])
          .map((t) => `<button data-tool="${t}" class="${this.tool === t ? 'on' : ''}">${t === 'dirt' ? '🟫 Terra' : t === 'metal' ? '⬜ Metal' : '🕳️ Apagar'}</button>`)
          .join('')}</div>
        <label class="brush">Pincel <input id="ed-brush" type="range" min="12" max="120" value="${this.brush}" /></label>
      </div>
      <canvas id="ed-canvas" width="${WORLD_W / SCALE}" height="${WORLD_H / SCALE}"></canvas>
      <div class="ed-row">
        <input id="ed-name" maxlength="24" value="${esc(this.name)}" />
        <select id="ed-theme">${(Object.keys(THEMES) as ThemeId[]).map((t) => `<option value="${t}" ${t === this.theme ? 'selected' : ''}>${THEMES[t].name}</option>`).join('')}</select>
      </div>
      <div class="ed-row wrap">
        <button id="ed-random">Aleatório</button>
        <button id="ed-flat">Plano</button>
        <button id="ed-save">Salvar</button>
        <button id="ed-share">Compartilhar</button>
        <button id="ed-test" class="go">Testar ▶</button>
      </div>
      ${this.notice ? `<p class="notice">${esc(this.notice)}</p>` : ''}
      ${
        saved.length
          ? `<span class="lbl">Meus mapas</span><ul class="people">${saved
              .map((m) => `<li><b>${esc(m.name)}</b><span class="actions"><button data-open="${m.id}">Abrir</button><button data-del="${m.id}" title="Apagar">✕</button></span></li>`)
              .join('')}</ul>`
          : ''
      }`;
    this.canvas = body.querySelector<HTMLCanvasElement>('#ed-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.paint(0, 0, WORLD_W, WORLD_H);
    this.bind(body, saved);
  }

  private bind(body: HTMLElement, saved: SavedMap[]): void {
    body.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tool = b.dataset.tool as Tool;
        body.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    body.querySelector<HTMLInputElement>('#ed-brush')!.addEventListener('input', (e) => (this.brush = Number((e.target as HTMLInputElement).value)));
    const name = body.querySelector<HTMLInputElement>('#ed-name')!;
    name.addEventListener('keydown', (e) => e.stopPropagation());
    name.addEventListener('change', () => (this.name = name.value.trim() || 'Meu mapa'));
    body.querySelector<HTMLSelectElement>('#ed-theme')!.addEventListener('change', (e) => {
      this.theme = (e.target as HTMLSelectElement).value as ThemeId;
      this.paint(0, 0, WORLD_W, WORLD_H);
    });
    const say = (t: string) => {
      this.notice = t;
      this.render();
    };
    body.querySelector('#ed-random')!.addEventListener('click', () => {
      this.random();
      say('');
    });
    body.querySelector('#ed-flat')!.addEventListener('click', () => {
      this.flat();
      say('');
    });
    body.querySelector('#ed-save')!.addEventListener('click', () => {
      saveMap(this.current());
      say('Mapa salvo! Ele aparece na lista e no lobby online.');
    });
    body.querySelector('#ed-share')!.addEventListener('click', async () => {
      const link = await mapLink(this.current());
      try {
        if (typeof navigator.share === 'function') await navigator.share({ title: this.name, text: 'Fiz um mapa no Bolotas em Guerra!', url: link });
        else await navigator.clipboard.writeText(link);
        say('Link do mapa copiado. Quem abrir pode jogar e salvar.');
      } catch {
        say(link);
      }
    });
    body.querySelector('#ed-test')!.addEventListener('click', () => {
      if (!this.playable()) return say('Desenhe mais chão acima da água para as bolotas pisarem.');
      this.onTest(encodeMask(this.mask), this.theme);
    });
    body.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = saved.find((x) => x.id === b.dataset.open);
        if (m) this.load(m);
        say('');
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        deleteMap(b.dataset.del!);
        say('');
      }),
    );

    const c = this.canvas;
    const toWorld = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * WORLD_W, y: ((e.clientY - r.top) / r.height) * WORLD_H };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.drawing = true;
      this.last = toWorld(e);
      this.stroke(this.last, this.last);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drawing) return;
      const p = toWorld(e);
      this.stroke(this.last ?? p, p);
      this.last = p;
    });
    const end = () => {
      this.drawing = false;
      this.last = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  /** Pinta um traço (círculos ao longo do segmento) na máscara e na prévia. */
  private stroke(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const value = this.tool === 'dirt' ? DIRT : this.tool === 'metal' ? METAL : AIR;
    const r = this.tool === 'metal' ? Math.max(6, this.brush / 3) : this.brush;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 2)));
    for (let i = 0; i <= steps; i++) {
      const cx = a.x + ((b.x - a.x) * i) / steps;
      const cy = a.y + ((b.y - a.y) * i) / steps;
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(WORLD_W - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(WORLD_H - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.mask[y * WORLD_W + x] = value;
        }
      }
    }
    this.paint(Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r);
  }

  /** Redesenha a prévia (em escala 1:4) na região indicada (coordenadas do mundo). */
  private paint(wx0: number, wy0: number, wx1: number, wy1: number): void {
    const th = THEMES[this.theme];
    const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const sky = hex(th.sky[1]);
    const dirt = hex(th.dirt[0]);
    const grass = hex(th.grass[1]);
    const water = hex(th.water[0]);
    const metal = [160, 168, 180];
    const px0 = Math.max(0, Math.floor(wx0 / SCALE));
    const py0 = Math.max(0, Math.floor(wy0 / SCALE));
    const px1 = Math.min(this.canvas.width, Math.ceil(wx1 / SCALE) + 1);
    const py1 = Math.min(this.canvas.height, Math.ceil(wy1 / SCALE) + 1);
    if (px1 <= px0 || py1 <= py0) return;
    const img = this.ctx.createImageData(px1 - px0, py1 - py0);
    const d = img.data;
    for (let py = py0; py < py1; py++) {
      for (let px = px0; px < px1; px++) {
        const v = this.mask[py * SCALE * WORLD_W + px * SCALE];
        const above = py > 0 ? this.mask[(py - 1) * SCALE * WORLD_W + px * SCALE] : AIR;
        let c = v === METAL ? metal : v === DIRT ? (above === AIR ? grass : dirt) : sky;
        if (v === AIR && py * SCALE >= WATER_Y) c = water;
        const o = ((py - py0) * (px1 - px0) + (px - px0)) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(img, px0, py0);
  }
}
