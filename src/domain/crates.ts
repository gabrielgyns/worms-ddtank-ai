import type { Terrain } from './terrain';
import type { Unit } from './unit';
import type { WeaponId } from './weapons';

/** Caixa que cai de paraquedas entre os turnos. */
export interface Crate {
  id: number;
  x: number;
  y: number;
  vy: number;
  kind: 'health' | 'weapon';
  /** arma que vem dentro (caixa de arma) */
  weapon: WeaponId | null;
  landed: boolean;
}

export const CRATE_CHANCE = 0.4;
export const CRATE_HEALTH = 25;
export const CRATE_WEAPONS: readonly WeaponId[] = ['triple', 'cluster', 'dynamite', 'airstrike', 'teleport'];
const FALL_SPEED = 70;
const PICK_RADIUS = 18;

/** Cai devagar (paraquedas) até tocar o chão. Retorna false se caiu na água. */
export function stepCrate(t: Terrain, c: Crate, dt: number): boolean {
  if (c.landed) {
    // o chão sumiu embaixo (explosão)? volta a cair, agora sem paraquedas
    if (!t.isSolid(c.x, c.y + 1) && !t.isSolid(c.x - 6, c.y + 1) && !t.isSolid(c.x + 6, c.y + 1)) {
      c.landed = false;
      c.vy = 0;
    } else return true;
  }
  c.vy = Math.min(c.vy + 600 * dt, c.y < 0 || c.vy <= FALL_SPEED ? FALL_SPEED : 400);
  const steps = Math.max(1, Math.ceil((c.vy * dt) / 2));
  for (let i = 0; i < steps; i++) {
    const ny = c.y + (c.vy * dt) / steps;
    if (t.isSolid(c.x, ny) || t.isSolid(c.x - 6, ny) || t.isSolid(c.x + 6, ny)) {
      c.landed = true;
      c.vy = 0;
      break;
    }
    c.y = ny;
  }
  return c.y < t.waterY;
}

export function touches(c: Crate, u: Unit): boolean {
  return Math.abs(u.x - c.x) < PICK_RADIUS && Math.abs(u.cy - (c.y - 8)) < PICK_RADIUS + 6;
}
