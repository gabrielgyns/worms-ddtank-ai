import { quip, type QuipKind } from './quips';
import type { GameEvent, Match } from '../domain/match';
import type { Unit } from '../domain/unit';
import type { Camera } from './camera';
import type { Look } from '../domain/cosmetics';
import { weaponById } from '../domain/weapons';
import { trailParticle } from './cosmetics';
import { HIGH, type Quality } from './quality';
import { drawGrave, FONT, INK } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  gravity: number;
  drag: number;
  kind: 'dot' | 'ring' | 'text' | 'flash' | 'star';
  text?: string;
  stroke?: string;
}

interface Grave {
  x: number;
  y: number;
  vy: number;
  color: string;
  look: Look;
}

const COMIC = ['BUM!', 'POW!', 'KABUM!', 'BAM!', 'CABRUM!'];

/** Partículas, números de dano, lápides e tremidas de tela. */
export class Effects {
  private parts: Particle[] = [];
  readonly graves: Grave[] = [];
  /** balões: de um time (emotes) ou de uma bolota específica (falas) */
  private bubbles: Array<{ teamId: number; unitId?: number; text: string; life: number; max: number }> = [];
  private trailClock = 0;
  readonly hurt = new Map<number, number>();
  quality: Quality = HIGH;

  constructor(
    private m: Match,
    private cam: Camera,
  ) {
    m.on((e) => this.onEvent(e));
  }

  private add(p: Partial<Particle> & Pick<Particle, 'x' | 'y'>): void {
    if (this.parts.length >= this.quality.maxParticles && p.kind !== 'text') return;
    this.parts.push({
      vx: 0,
      vy: 0,
      life: 1,
      max: 1,
      size: 4,
      grow: 0,
      color: '#fff',
      gravity: 0,
      drag: 0,
      kind: 'dot',
      ...p,
    } as Particle);
  }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'explosion':
        this.explosion(e.x, e.y, e.r);
        this.boomStyle(e.x, e.y, e.r, e.by?.team.look.boom);
        break;
      case 'damage': {
        this.hurt.set(e.unit.id, 1.2);
        if (e.unit.alive && e.amount >= 8 && Math.random() < 0.75) {
          const own = e.by && e.by.team === e.unit.team;
          this.speak(e.unit, e.by === e.unit ? 'self' : own ? 'friendly' : e.amount >= 35 ? 'big' : 'ouch');
        }
        this.add({
          x: e.unit.cx,
          y: e.unit.y - 50,
          vy: -45,
          life: 1.6,
          max: 1.6,
          size: 22,
          color: e.unit.team.light,
          stroke: INK,
          kind: 'text',
          text: `-${e.amount}`,
          drag: 1.5,
        });
        break;
      }
      case 'splash':
        for (let i = 0; i < (e.big ? 30 : 14); i++) {
          this.add({
            x: e.x + (Math.random() - 0.5) * 16,
            y: e.y,
            vx: (Math.random() - 0.5) * 160,
            vy: -Math.random() * (e.big ? 380 : 260) - 60,
            life: 1,
            max: 1,
            size: 3 + Math.random() * 4,
            color: Math.random() > 0.5 ? '#ffffff' : this.m.theme.water[0],
            gravity: 700,
          });
        }
        break;
      case 'death':
        if (e.by && e.by.alive && e.by.team !== e.unit.team && Math.random() < 0.8) this.speak(e.by, 'taunt');
        if (!e.unit.drowned) this.graves.push({ x: e.unit.x, y: e.unit.y, vy: -120, color: e.unit.team.color, look: e.unit.team.look });
        break;
      case 'teleport':
        this.sparkles(e.fromX, e.fromY - 12);
        this.sparkles(e.unit.x, e.unit.y - 12);
        break;
      case 'fire': {
        const u = this.m.active;
        if (!u) break;
        for (let i = 0; i < 6; i++) {
          this.add({
            x: u.cx + Math.cos(u.aim) * u.facing * 22,
            y: u.cy - Math.sin(u.aim) * 22,
            vx: (Math.random() - 0.5) * 60,
            vy: -Math.random() * 40,
            life: 0.6,
            max: 0.6,
            size: 5,
            grow: 18,
            color: 'rgba(230,230,230,0.8)',
            drag: 2,
          });
        }
        break;
      }
      case 'cratePick': {
        const text = e.crate.kind === 'health' ? '+25 ❤' : `+1 ${weaponById(e.crate.weapon!).name}`;
        this.add({ x: e.crate.x, y: e.crate.y - 40, vy: -40, life: 1.8, max: 1.8, size: 18, kind: 'text', text, color: '#fff', stroke: INK, drag: 1.2 });
        this.sparkles(e.crate.x, e.crate.y - 10);
        break;
      }
      case 'bounce':
        this.add({ x: e.x, y: e.y, life: 0.25, max: 0.25, size: 3, grow: 30, kind: 'ring', color: '#fff' });
        break;
      default:
        break;
    }
  }

  private sparkles(x: number, y: number): void {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.9,
        max: 0.9,
        size: 4 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#c8f7ff' : '#b49bff',
        kind: 'star',
        drag: 2.5,
      });
    }
  }

  /** Explosão cosmética extra (confete, corações). */
  private boomStyle(x: number, y: number, r: number, boom: string | undefined): void {
    if (!boom) return;
    const n = Math.round(r * 0.5 * this.quality.particles);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 120 + Math.random() * r * 5;
      const confetti = boom === 'boom-confetti';
      this.add({
        x,
        y: y - r * 0.3,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1.4,
        max: 1.4,
        size: confetti ? 3 : 6,
        color: confetti ? `hsl(${Math.random() * 360} 90% 60%)` : Math.random() > 0.5 ? '#ff5a8a' : '#ff9ac0',
        gravity: confetti ? 260 : -40,
        drag: 2,
        kind: confetti ? 'dot' : 'text',
        text: confetti ? undefined : '❤',
        stroke: confetti ? undefined : '#7a1d3a',
      });
    }
  }

  private explosion(x: number, y: number, r: number): void {
    this.cam.shake = Math.min(26, this.cam.shake + r * 0.28);
    this.add({ x, y, life: 0.18, max: 0.18, size: r * 1.3, kind: 'flash', color: '#fffbe0' });
    this.add({ x, y, life: 0.45, max: 0.45, size: r * 0.5, grow: r * 3.2, kind: 'ring', color: '#fff6c8' });
    const n = Math.round(r * 0.6 * this.quality.particles);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * r * 3.5;
      this.add({
        x: x + Math.cos(a) * r * 0.2,
        y: y + Math.sin(a) * r * 0.2,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        size: r * (0.18 + Math.random() * 0.22),
        grow: -r * 0.2,
        color: ['#fff3a0', '#ffc23a', '#ff8a2a', '#ff5a1f'][(Math.random() * 4) | 0],
        drag: 3,
      });
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * r * 1.4;
      this.add({
        x: x + Math.cos(a) * r * 0.4,
        y: y + Math.sin(a) * r * 0.4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 1 + Math.random() * 1.2,
        max: 2.2,
        size: r * 0.2,
        grow: r * 0.5,
        color: 'rgba(90,80,80,0.5)',
        drag: 1.8,
        gravity: -30,
      });
    }
    const dirt = this.m.theme.dirt;
    const grass = this.m.theme.grass;
    for (let i = 0; i < n * 0.8; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const s = 150 + Math.random() * r * 6;
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.8 + Math.random() * 0.8,
        max: 1.6,
        size: 2 + Math.random() * 3.5,
        color: Math.random() > 0.8 ? grass[1] : dirt[(Math.random() * 2) | 0],
        gravity: 800,
        drag: 0.4,
        stroke: INK,
      });
    }
    if (r >= 30) {
      this.add({
        x,
        y: y - r * 0.9,
        vy: -60,
        life: 0.9,
        max: 0.9,
        size: 18 + r * 0.35,
        kind: 'text',
        text: COMIC[(Math.random() * COMIC.length) | 0],
        color: '#ffe14a',
        stroke: INK,
        drag: 2,
      });
    }
  }

  /** Balão de fala sobre uma bolota do time. */
  say(teamId: number, text: string): void {
    this.bubbles = this.bubbles.filter((b) => b.teamId !== teamId);
    this.bubbles.push({ teamId, text, life: 2.8, max: 2.8 });
  }

  /** Fala de uma bolota (dano, eliminação). Não atropela emote nem outra fala dela. */
  speak(u: Unit, kind: QuipKind): void {
    if (this.bubbles.some((b) => b.unitId === u.id || (b.unitId === undefined && b.teamId === u.team.id))) return;
    this.bubbles.push({ teamId: u.team.id, unitId: u.id, text: quip(kind), life: 1.9, max: 1.9 });
  }

  update(dt: number): void {
    for (const b of this.bubbles) b.life -= dt;
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    for (const [id, t] of this.hurt) {
      if (t - dt <= 0) this.hurt.delete(id);
      else this.hurt.set(id, t - dt);
    }
    // rastros
    this.trailClock += dt;
    if (this.trailClock > 0.025) {
      this.trailClock = 0;
      // bolota arremessada deixa rastro de poeira
      for (const u of this.m.units) {
        if (!u.alive || u.onGround || u.rope || u.chute) continue;
        if (u.vx * u.vx + u.vy * u.vy < 260 * 260) continue;
        this.add({
          x: u.cx + (Math.random() - 0.5) * 8,
          y: u.cy + (Math.random() - 0.5) * 8,
          vx: -u.vx * 0.08,
          vy: -u.vy * 0.08,
          life: 0.5,
          max: 0.5,
          size: 6 * u.size,
          grow: 10,
          color: u.team.light,
          drag: 2,
        });
      }
      for (const p of this.m.projectiles) {
        if (p.spec.kind === 'missile' || p.spec.kind === 'cluster') {
          const owner = this.m.units.find((u) => u.id === p.ownerId);
          const style = trailParticle(owner?.team.look.trail, this.m.time + p.x * 0.001);
          if (style) {
            this.add({
              x: p.x - p.vx * 0.012,
              y: p.y - p.vy * 0.012,
              vx: (Math.random() - 0.5) * 30,
              vy: (Math.random() - 0.5) * 30,
              life: 0.9,
              max: 0.9,
              size: style.size,
              color: style.color,
              kind: style.kind,
              drag: 1,
            });
            continue;
          }
          this.add({
            x: p.x - p.vx * 0.012,
            y: p.y - p.vy * 0.012,
            life: 0.7,
            max: 0.7,
            size: 3,
            grow: 12,
            color: 'rgba(255,255,255,0.75)',
            drag: 1,
          });
        }
      }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0.1, p.size + p.grow * dt);
      // detritos param no chão
      if (p.stroke && p.kind === 'dot' && this.m.terrain.isSolid(p.x, p.y)) {
        p.vx *= 0.3;
        p.vy = -p.vy * 0.25;
        p.y -= 1;
      }
    }
    const t = this.m.terrain;
    for (const g of this.graves) {
      if (!t.isSolid(g.x, g.y + 1)) {
        g.vy = Math.min(600, g.vy + 700 * dt);
        g.y += g.vy * dt;
        if (t.isSolid(g.x, g.y)) {
          while (t.isSolid(g.x, g.y) && g.y > 0) g.y -= 1;
          g.vy = 0;
        }
      } else g.vy = 0;
    }
    for (let i = this.graves.length - 1; i >= 0; i--) if (this.graves[i].y > t.waterY + 20) this.graves.splice(i, 1);
  }

  drawBubbles(c: CanvasRenderingContext2D, zoom: number): void {
    const s = 1 / Math.max(0.75, Math.min(1.3, zoom));
    for (const b of this.bubbles) {
      const team = this.m.teams[b.teamId];
      if (!team) continue;
      const u =
        b.unitId !== undefined
          ? team.units.find((x) => x.id === b.unitId && x.alive)
          : ((this.m.active?.team === team ? this.m.active : null) ?? team.units.find((x) => x.alive));
      if (!u) continue;
      const pop = Math.min(1, (b.max - b.life) * 6);
      c.save();
      c.translate(u.x, u.y - 82);
      c.scale(s * pop, s * pop);
      c.globalAlpha = Math.min(1, b.life * 3);
      c.font = `16px ${FONT}`;
      const w = c.measureText(b.text).width + 22;
      c.fillStyle = '#fff';
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(-w / 2, -16, w, 30, 15);
      c.moveTo(-6, 13);
      c.lineTo(0, 24);
      c.lineTo(6, 13);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.fillRect(-5, 11, 10, 4);
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(b.text, 0, 0);
      c.restore();
    }
  }

  drawGraves(c: CanvasRenderingContext2D): void {
    for (const g of this.graves) drawGrave(c, g.x, g.y, g.color, g.look);
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'text') {
        c.globalAlpha = Math.min(1, a * 2);
        const pop = 1 + Math.max(0, (p.life - p.max + 0.15) / 0.15) * 0.6;
        c.font = `${Math.round(p.size * pop)}px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 5;
        c.strokeStyle = p.stroke ?? INK;
        c.lineJoin = 'round';
        c.strokeText(p.text!, p.x, p.y);
        c.fillStyle = p.color;
        c.fillText(p.text!, p.x, p.y);
      } else if (p.kind === 'flash') {
        c.globalAlpha = a;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
      } else if (p.kind === 'ring') {
        c.globalAlpha = a;
        c.strokeStyle = p.color;
        c.lineWidth = 4 * a + 1;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.stroke();
      } else if (p.kind === 'star') {
        c.globalAlpha = a;
        c.fillStyle = p.color;
        const s = p.size * a;
        c.beginPath();
        c.moveTo(p.x, p.y - s);
        c.lineTo(p.x + s * 0.3, p.y - s * 0.3);
        c.lineTo(p.x + s, p.y);
        c.lineTo(p.x + s * 0.3, p.y + s * 0.3);
        c.lineTo(p.x, p.y + s);
        c.lineTo(p.x - s * 0.3, p.y + s * 0.3);
        c.lineTo(p.x - s, p.y);
        c.lineTo(p.x - s * 0.3, p.y - s * 0.3);
        c.closePath();
        c.fill();
      } else {
        c.globalAlpha = Math.min(1, a * 1.5);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
        if (p.stroke) {
          c.lineWidth = 1;
          c.strokeStyle = p.stroke;
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
  }
}
