import type { Terrain } from './terrain';
import type { Unit } from './unit';

/** Barril explosivo: estoura quando uma explosão chega perto. */
export interface Barrel {
  id: number;
  x: number;
  y: number;
  vy: number;
  landed: boolean;
  /** segundos até estourar (corrente de explosões), ou null */
  fuse: number | null;
}

/** Mina: arma quando alguém chega perto e explode pouco depois. */
export interface Mine {
  id: number;
  x: number;
  y: number;
  vy: number;
  landed: boolean;
  fuse: number | null;
}

export const BARREL_BLAST = { r: 48, dmg: 34 };
export const MINE_BLAST = { r: 38, dmg: 40 };
export const MINE_TRIGGER = 28;
export const MINE_FUSE = 1.5;

type Falling = { x: number; y: number; vy: number; landed: boolean };

/** Cai até apoiar no chão. Retorna false se afundou na água. */
export function stepFalling(t: Terrain, o: Falling, dt: number, halfW: number): boolean {
  const ground = (y: number) => t.isSolid(o.x, y) || t.isSolid(o.x - halfW, y) || t.isSolid(o.x + halfW, y);
  if (o.landed) {
    if (ground(o.y + 1)) return true;
    o.landed = false;
    o.vy = 0;
  }
  o.vy = Math.min(o.vy + 600 * dt, 500);
  const steps = Math.max(1, Math.ceil((o.vy * dt) / 2));
  for (let i = 0; i < steps; i++) {
    const ny = o.y + (o.vy * dt) / steps;
    if (ground(ny)) {
      o.landed = true;
      o.vy = 0;
      break;
    }
    o.y = ny;
  }
  return o.y < t.waterY;
}

export function nearMine(m: Mine, u: Unit): boolean {
  return Math.hypot(u.x - m.x, u.cy - (m.y - 4)) < MINE_TRIGGER + u.radius * 0.5;
}
