import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameEvent, Match } from '../../domain/match';
import type { VfxTextures } from './textures';

/** Paleta do fogo ao longo da vida da partícula: branco → amarelo → laranja → vermelho → fuligem. */
const FIRE = [0xffffff, 0xfff1a0, 0xffc23a, 0xff7a1f, 0xd8401a, 0x5a2a20];

function lerpColor(stops: readonly number[], k: number): number {
  const x = Math.min(0.999, Math.max(0, k)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** escala inicial e final */
  s0: number;
  s1: number;
  a0: number;
  gravity: number;
  drag: number;
  spin: number;
  /** cor fixa ou paleta ao longo da vida */
  palette: readonly number[] | null;
  /** gira a partícula na direção do movimento (faíscas) */
  orient: boolean;
  flicker: number;
}

/** Um conjunto de partículas num container (fundo ou frente). */
class Pool {
  readonly view = new Container();
  private live: P[] = [];
  private free: Sprite[] = [];
  constructor(private max: number) {}

  spawn(tex: Texture, o: Partial<P> & { x: number; y: number; blend?: 'add' | 'normal'; tint?: number; anchorY?: number }): void {
    if (this.live.length >= this.max) return;
    const s = this.free.pop() ?? new Sprite();
    s.texture = tex;
    s.anchor.set(0.5, o.anchorY ?? 0.5);
    s.position.set(o.x, o.y);
    s.blendMode = o.blend ?? 'normal';
    s.tint = o.tint ?? 0xffffff;
    // quem segue o movimento já nasce virado para onde vai
    s.rotation = o.orient ? Math.atan2(o.vy ?? 0, o.vx ?? 0) : Math.random() * Math.PI * 2;
    s.visible = true;
    this.view.addChild(s);
    const life = o.life ?? 1;
    this.live.push({
      s,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      life,
      max: life,
      s0: o.s0 ?? 1,
      s1: o.s1 ?? o.s0 ?? 1,
      a0: o.a0 ?? 1,
      gravity: o.gravity ?? 0,
      drag: o.drag ?? 0,
      spin: o.spin ?? 0,
      palette: o.palette ?? null,
      orient: o.orient ?? false,
      flicker: o.flicker ?? 0,
    });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        this.view.removeChild(p.s);
        this.free.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      if (p.orient) p.s.rotation = Math.atan2(p.vy, p.vx);
      else p.s.rotation += p.spin * dt;
      const sc = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k));
      p.s.scale.set(sc);
      const fade = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      p.s.alpha = p.a0 * fade * (p.flicker ? 1 - p.flicker * Math.random() : 1);
      if (p.palette) p.s.tint = lerpColor(p.palette, k);
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.s.visible = false;
      this.view.removeChild(p.s);
      this.free.push(p.s);
    }
    this.live = [];
  }
}

const r = Math.random;

/**
 * Efeitos estilo Worms W.M.D./anime: fumaça atrás do terreno, fogo e faíscas na frente
 * com brilho aditivo, chamas que ficam na cratera e quadro de impacto nos golpes fortes.
 * Só escuta eventos e lê a partida; não muda nada.
 */
export class Vfx {
  /** atrás das bolotas: fumaça, poeira */
  readonly back = new Pool(700);
  /** na frente: fogo, brilho, faíscas, destroços */
  readonly front = new Pool(1600);
  /** em coordenadas de tela: flash, linhas de velocidade */
  readonly screen = new Pool(80);
  private match: Match | null = null;
  /** colunas de fumaça saindo das crateras recentes */
  private plumes: Array<{ x: number; y: number; t: number; clock: number; size: number }> = [];
  private trailClock = 0;
  /** pontos de impacto recentes para o quadro de impacto (mundo) */
  private impacts: Array<{ x: number; y: number; power: number }> = [];

  constructor(private tex: VfxTextures) {}

  attach(m: Match): void {
    if (this.match === m) return;
    this.match = m;
    this.back.clear();
    this.front.clear();
    this.screen.clear();
    this.plumes = [];
    m.on((e) => {
      if (this.match === m) this.onEvent(m, e);
    });
  }

  /** Pega os impactos fortes deste frame (o palco converte para a tela). */
  takeImpacts(): Array<{ x: number; y: number; power: number }> {
    const out = this.impacts;
    this.impacts = [];
    return out;
  }

  private onEvent(m: Match, e: GameEvent): void {
    switch (e.type) {
      case 'explosion':
        this.explosion(m, e.x, e.y, e.r);
        break;
      case 'damage':
        if (e.amount >= 30) this.impacts.push({ x: e.unit.cx, y: e.unit.cy, power: Math.min(1, e.amount / 60) });
        break;
      case 'fire': {
        const u = e.unit;
        const x = u.cx + Math.cos(u.aim) * u.facing * 24;
        const y = u.cy - Math.sin(u.aim) * 24;
        this.front.spawn(this.tex.glow, { x, y, s0: 0.35, s1: 0.9, life: 0.16, blend: 'add', tint: 0xfff1a0 });
        for (let i = 0; i < 4; i++)
          this.back.spawn(this.tex.smoke[i % 3], { x, y, vx: (r() - 0.5) * 40, vy: -20 - r() * 30, s0: 0.15, s1: 0.45, life: 0.9, a0: 0.35, tint: 0xdddddd, drag: 2 });
        break;
      }
      case 'splash':
        this.splash(e.x, e.y, e.big);
        for (let i = 0; i < (e.big ? 26 : 12); i++)
          this.front.spawn(this.tex.glow, {
            x: e.x + (r() - 0.5) * 20,
            y: e.y,
            vx: (r() - 0.5) * 180,
            vy: -180 - r() * (e.big ? 360 : 220),
            gravity: 900,
            s0: 0.09,
            s1: 0.05,
            life: 0.9,
            tint: 0xcfefff,
          });
        break;
      case 'bat':
        this.impacts.push({ x: e.x, y: e.y, power: 0.8 });
        break;
    }
  }

  private explosion(m: Match, x: number, y: number, rad: number): void {
    const T = this.tex;
    const big = rad >= 45;
    // clarão e onda de choque
    this.front.spawn(T.glow, { x, y, s0: rad / 22, s1: rad / 14, life: 0.18, blend: 'add', tint: 0xfffbe0 });
    this.front.spawn(T.ring, { x, y, s0: rad / 300, s1: rad / 70, life: 0.4, blend: 'add', a0: 0.85, tint: 0xfff2c0 });
    // bola de fogo: corpo de "fumaça de fogo" (cor sólida, aparece em céu claro)
    // com miolo de brilho aditivo por cima
    const fire = Math.round(10 + rad * 0.3);
    for (let i = 0; i < fire; i++) {
      const a = r() * Math.PI * 2;
      const sp = r() * rad * 2.2;
      this.front.spawn(T.smoke[i % 3], {
        x: x + Math.cos(a) * rad * 0.25,
        y: y + Math.sin(a) * rad * 0.25,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        s0: (rad / 128) * (0.7 + r() * 0.5),
        s1: (rad / 128) * (1.5 + r() * 0.8),
        life: 0.45 + r() * 0.4,
        drag: 4,
        gravity: -140,
        spin: (r() - 0.5) * 3,
        a0: 0.95,
        palette: FIRE.slice(1),
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      this.front.spawn(T.glow, {
        x: x + Math.cos(a) * rad * 0.3,
        y: y + Math.sin(a) * rad * 0.3,
        vx: Math.cos(a) * rad,
        vy: Math.sin(a) * rad - 40,
        s0: (rad / 64) * 0.5,
        s1: (rad / 64) * 0.9,
        life: 0.3 + r() * 0.2,
        drag: 4,
        blend: 'add',
        a0: 0.8,
        palette: FIRE,
      });
    }
    // fumaça grossa que sobe devagar (atrás das bolotas)
    const smoke = Math.round(6 + rad * 0.22);
    for (let i = 0; i < smoke; i++) {
      const a = r() * Math.PI * 2;
      this.back.spawn(T.smoke[i % 3], {
        x: x + Math.cos(a) * rad * 0.5,
        y: y + Math.sin(a) * rad * 0.4,
        vx: Math.cos(a) * 30 + (m.wind ?? 0) * 3,
        vy: -30 - r() * 50,
        s0: (rad / 128) * 0.8,
        s1: (rad / 128) * (2 + r() * 1.4),
        life: 1.6 + r() * 1.6,
        a0: 0.55,
        drag: 0.8,
        spin: (r() - 0.5) * 0.6,
        tint: [0x3a3236, 0x4a4246, 0x5a5052][i % 3],
      });
    }
    // faíscas riscando
    for (let i = 0; i < 14 + rad * 0.3; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.6;
      const sp = 260 + r() * rad * 9;
      this.front.spawn(T.spark, {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        gravity: 700,
        drag: 1.2,
        s0: 0.35 + r() * 0.35,
        s1: 0.15,
        life: 0.45 + r() * 0.4,
        blend: 'add',
        orient: true,
        tint: 0xffd36a,
      });
    }
    // brasas que flutuam e piscam
    for (let i = 0; i < 8 + rad * 0.2; i++)
      this.front.spawn(T.glow, {
        x: x + (r() - 0.5) * rad,
        y: y + (r() - 0.5) * rad * 0.6,
        vx: (r() - 0.5) * 60,
        vy: -40 - r() * 80,
        gravity: -20,
        drag: 0.6,
        s0: 0.07,
        s1: 0.03,
        life: 1.2 + r() * 1.4,
        blend: 'add',
        tint: 0xff9a3a,
        flicker: 0.6,
      });
    // pedaços de terra voando (na cor do terreno)
    const dirt = parseInt(m.theme.dirt[0].slice(1), 16);
    const grass = parseInt(m.theme.grass[1].slice(1), 16);
    for (let i = 0; i < 6 + rad * 0.25; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const sp = 200 + r() * rad * 6;
      this.front.spawn(T.chunk[i % 4], {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        gravity: 1100,
        s0: 0.35 + r() * 0.5,
        s1: 0.3,
        life: 0.9 + r() * 0.6,
        spin: (r() - 0.5) * 14,
        tint: i % 4 === 0 ? grass : dirt,
      });
    }
    // chamas que ficam queimando na borda da cratera
    for (let i = 0; i < (big ? 7 : 4); i++) {
      const a = Math.PI * (0.15 + r() * 0.7);
      const fx = x + Math.cos(a) * rad * (0.7 + r() * 0.3) * (r() > 0.5 ? 1 : -1);
      const fy = y + Math.sin(a) * rad * 0.8;
      if (!m.terrain.isSolid(fx, fy + 4)) continue;
      const life = 1.2 + r() * 1.6;
      for (let k = 0; k < 3; k++)
        this.front.spawn(T.flame, { x: fx + (k - 1) * 4, y: fy + 4, anchorY: 0.95, s0: 0.24, s1: 0.34, life, palette: FIRE.slice(1, 5), flicker: 0.3 });
      this.front.spawn(T.glow, { x: fx, y: fy - 8, s0: 0.4, s1: 0.5, life, blend: 'add', a0: 0.6, tint: 0xff8a2a, flicker: 0.4 });
    }
    // coluna de fumaça que continua subindo da cratera por alguns segundos
    this.plumes.push({ x, y: y - rad * 0.3, t: big ? 4 : 2.2, clock: 0, size: rad / 128 });
    if (this.plumes.length > 8) this.plumes.shift();
    // onda de poeira correndo rente ao chão nos dois sentidos
    if (big) {
      const dust = parseInt(m.theme.dirt[0].slice(1), 16);
      for (let i = 0; i < 12; i++) {
        const dir = i % 2 ? 1 : -1;
        this.back.spawn(T.smoke[i % 3], {
          x: x + dir * rad * 0.6,
          y: y + rad * 0.45,
          vx: dir * (220 + r() * 220),
          vy: -10 - r() * 30,
          drag: 3.2,
          s0: 0.2,
          s1: 0.65 + r() * 0.3,
          life: 0.7 + r() * 0.5,
          a0: 0.6,
          tint: dust,
        });
      }
    }
    if (big) this.impacts.push({ x, y, power: Math.min(1, rad / 80) });
  }

  /** Respingo: coluna d'água que sobe e desaba, espuma que fica boiando um pouco. */
  private splash(x: number, y: number, big: boolean): void {
    const T = this.tex;
    const h = big ? 1 : 0.6;
    for (let i = 0; i < (big ? 8 : 5); i++)
      this.front.spawn(T.smoke[i % 3], {
        x: x + (r() - 0.5) * 10,
        y,
        vx: (r() - 0.5) * 50,
        vy: -(260 + r() * 260) * h,
        gravity: 820,
        drag: 0.6,
        s0: 0.12,
        s1: 0.32 * h + 0.1,
        life: 0.8 + r() * 0.3,
        a0: 0.85,
        tint: i % 2 ? 0xffffff : 0xd8f2ff,
      });
    for (let i = 0; i < (big ? 12 : 7); i++)
      this.front.spawn(T.smoke[i % 3], {
        x: x + (r() - 0.5) * 30,
        y: y + 2,
        vx: (r() - 0.5) * 140,
        vy: -8 - r() * 10,
        drag: 3,
        s0: 0.12,
        s1: 0.32 + r() * 0.15,
        life: 1.2 + r() * 0.9,
        a0: 0.75,
        tint: 0xffffff,
      });
  }

  /** Rastro de fogo e fumaça dos mísseis, a cada frame. */
  update(dt: number): void {
    const m = this.match;
    if (m) {
      this.trailClock += dt;
      if (this.trailClock > 1 / 45) {
        this.trailClock = 0;
        for (const p of m.projectiles) {
          if (p.spec.kind !== 'missile' && p.spec.kind !== 'homing' && p.spec.kind !== 'cluster') continue;
          const bx = p.x - p.vx * 0.015;
          const by = p.y - p.vy * 0.015;
          this.front.spawn(this.tex.glow, { x: bx, y: by, s0: 0.22, s1: 0.08, life: 0.18, blend: 'add', palette: FIRE.slice(0, 4) });
          this.back.spawn(this.tex.smoke[(Math.random() * 3) | 0], { x: bx, y: by, vx: (r() - 0.5) * 20, vy: -10, s0: 0.06, s1: 0.22, life: 0.9, a0: 0.45, tint: 0xd8d4d0, drag: 1 });
        }
      }
    }
    for (const p of this.plumes) {
      p.t -= dt;
      p.clock -= dt;
      if (p.clock > 0) continue;
      p.clock = 0.11;
      const fade = Math.min(1, p.t / 1.5);
      // na frente do terreno: explosão dentro do morro também solta fumaça visível
      this.front.spawn(this.tex.smoke[(Math.random() * 3) | 0], {
        x: p.x + (r() - 0.5) * 10,
        y: p.y,
        vx: (m?.wind ?? 0) * 2.5 + (r() - 0.5) * 12,
        vy: -45 - r() * 25,
        drag: 0.3,
        s0: 0.18 + p.size * 0.3,
        s1: 0.6 + p.size * 1.2,
        life: 2.4 + r(),
        a0: 0.3 * fade,
        spin: (r() - 0.5) * 0.5,
        tint: [0x4a4246, 0x5a5254, 0x6a6264][(Math.random() * 3) | 0],
      });
    }
    this.plumes = this.plumes.filter((p) => p.t > 0);
    this.back.update(dt);
    this.front.update(dt);
    this.screen.update(dt);
  }

  /** Quadro de impacto de anime: flash e linhas de velocidade em volta do ponto (tela). */
  impactFrame(sx: number, sy: number, power: number, w: number, h: number): void {
    const T = this.tex;
    this.screen.spawn(T.glow, { x: sx, y: sy, s0: (Math.max(w, h) / 64) * 0.6, s1: (Math.max(w, h) / 64) * 0.9, life: 0.14, blend: 'add', a0: 0.35 * power + 0.2 });
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.2;
      const d = 110 + r() * 80;
      this.screen.spawn(T.speed, {
        x: sx + Math.cos(a) * d,
        y: sy + Math.sin(a) * d,
        vx: Math.cos(a) * 900,
        vy: Math.sin(a) * 900,
        s0: 0.6 + r() * 0.5 * power,
        s1: 0.9,
        life: 0.16 + r() * 0.06,
        orient: true,
        a0: 0.7,
        // traço escuro de mangá
        tint: 0x1a1010,
      });
    }
  }
}
