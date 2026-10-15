import type { Terrain } from './terrain';
import type { Unit } from './unit';
import type { ProjectileSpec } from './weapons';

export const GRAVITY = 520;
export const WIND_ACCEL = 11;
const WALK_SPEED = 62;
const MAX_CLIMB = 7;
const SAFE_FALL = 540;

const BODY_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -2],
  [0, -12],
  [0, -22],
  [-7, -6],
  [7, -6],
  [-7, -16],
  [7, -16],
];

export function bodyCollides(t: Terrain, x: number, y: number, size = 1): boolean {
  for (const [dx, dy] of BODY_POINTS) if (t.isSolid(x + dx * size, y + dy * size)) return true;
  return false;
}

function groundAt(t: Terrain, x: number, y: number, size = 1): boolean {
  return t.isSolid(x, y) || t.isSolid(x - 4 * size, y) || t.isSolid(x + 4 * size, y);
}

/** Empurra a bolota para cima se ficou enterrada. */
export function unstick(t: Terrain, u: Unit): void {
  for (let i = 0; i < 40 * u.size && bodyCollides(t, u.x, u.y, u.size); i++) u.y -= 1;
}

/** Anda um passo na direção `dir`. Retorna true se se moveu. */
export function walk(t: Terrain, u: Unit, dir: 1 | -1, dt: number): boolean {
  u.facing = dir;
  if (!u.onGround) return false;
  u.walkAccum += WALK_SPEED * dt;
  let moved = false;
  while (u.walkAccum >= 1) {
    u.walkAccum -= 1;
    let stepped = false;
    for (let climb = 0; climb <= MAX_CLIMB; climb++) {
      if (!bodyCollides(t, u.x + dir, u.y - climb, u.size)) {
        u.x += dir;
        u.y -= climb;
        stepped = true;
        break;
      }
    }
    if (!stepped) {
      u.walkAccum = 0;
      break;
    }
    moved = true;
    // desce rampas
    let dropped = 0;
    while (!groundAt(t, u.x, u.y, u.size) && dropped < MAX_CLIMB) {
      u.y += 1;
      dropped++;
    }
    if (!groundAt(t, u.x, u.y, u.size)) {
      u.onGround = false;
      u.vx = dir * WALK_SPEED;
      u.vy = 0;
      break;
    }
  }
  if (moved) u.walkPhase += dt * 14;
  return moved;
}

/**
 * Física da bolota no ar. Retorna o dano de queda ao aterrissar (0 se nada).
 */
export function stepUnit(t: Terrain, u: Unit, dt: number, wind = 0): number {
  if (u.rope) return stepRope(t, u, dt);
  if (u.onGround) {
    u.chute = false;
    if (!groundAt(t, u.x, u.y, u.size)) {
      u.onGround = false;
      u.fallSpeed = 0;
    } else {
      u.vx = 0;
      u.vy = 0;
      return 0;
    }
  }
  u.vy += GRAVITY * dt;
  if (u.chute) {
    // paraquedas: desce devagar, vai com o vento e não leva dano
    u.vy = Math.min(u.vy, 60);
    u.vx += (wind * 9 - u.vx) * Math.min(1, dt * 2);
    u.fallSpeed = 0;
  }
  u.fallSpeed = Math.max(u.fallSpeed, u.vy);
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(u.vx), Math.abs(u.vy)) * dt) / 1.5));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const nx = u.x + u.vx * sdt;
    if (bodyCollides(t, nx, u.y, u.size)) {
      if (!bodyCollides(t, nx, u.y - 3, u.size)) {
        u.x = nx;
        u.y -= 3;
      } else u.vx = -u.vx * 0.3;
    } else u.x = nx;

    const ny = u.y + u.vy * sdt;
    if (bodyCollides(t, u.x, ny, u.size)) {
      if (u.vy > 0) {
        const impact = u.fallSpeed;
        u.onGround = true;
        u.chute = false;
        u.vx = 0;
        u.vy = 0;
        u.fallSpeed = 0;
        return impact > SAFE_FALL ? Math.round((impact - SAFE_FALL) / 9) : 0;
      }
      u.vy = 0;
    } else u.y = ny;
  }
  return 0;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spec: ProjectileSpec;
  fuse?: number;
  age: number;
  ownerId: number;
  rot: number;
  /** direção de quem anda (ovelha) */
  dir?: 1 | -1;
}

export interface SimWorld {
  terrain: Terrain;
  wind: number;
  units: readonly Unit[];
}

export type FlightResult = 'fly' | 'explode' | 'water' | 'lost' | 'bounce';

/** Avança um projétil. Compartilhado pelo jogo e pela simulação da IA. */
export function stepProjectile(p: Projectile, dt: number, w: SimWorld): FlightResult {
  const t = w.terrain;
  p.age += dt;
  if (p.fuse !== undefined) {
    p.fuse -= dt;
    if (p.fuse <= 0) return 'explode';
  }
  if (p.spec.walker) return stepWalker(p, dt, w);
  p.vx += w.wind * WIND_ACCEL * p.spec.windFactor * dt;
  p.vy += GRAVITY * dt;
  p.rot += p.vx * dt * 0.04;

  const speed = Math.hypot(p.vx, p.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / 2));
  const sdt = dt / steps;
  let result: FlightResult = 'fly';
  for (let i = 0; i < steps; i++) {
    const nx = p.x + p.vx * sdt;
    const ny = p.y + p.vy * sdt;
    if (ny > t.waterY) {
      p.x = nx;
      p.y = ny;
      return 'water';
    }
    if (nx < -400 || nx > t.width + 400) return 'lost';

    if (p.spec.fuse === undefined) {
      for (const u of w.units) {
        if (!u.alive || (u.id === p.ownerId && p.age < 0.3)) continue;
        const dx = nx - u.cx;
        const dy = ny - u.cy;
        const r = u.radius + p.spec.size;
        if (dx * dx + dy * dy < r * r) {
          p.x = nx;
          p.y = ny;
          return 'explode';
        }
      }
    }

    if (t.isSolid(nx, ny)) {
      if (p.spec.fuse === undefined) return 'explode';
      const n = t.normalAt(nx, ny);
      const dot = p.vx * n.x + p.vy * n.y;
      if (dot < 0) {
        const e = p.spec.bounce;
        p.vx -= (1 + e) * dot * n.x;
        p.vy -= (1 + e) * dot * n.y;
        p.vx *= 0.85;
        p.vy *= 0.85;
        if (-dot > 90) result = 'bounce';
      }
      // se ainda estiver dentro do chão, empurra para fora pela normal
      if (t.isSolid(p.x, p.y)) {
        p.x += n.x * 2;
        p.y += n.y * 2;
      }
      break;
    }
    p.x = nx;
    p.y = ny;
  }
  return result;
}

const WALKER_STEP = 10; // degrau que sobe andando
const WALKER_HOP = 270; // pulo quando dá de cara com parede

/** Ovelha: anda no chão, sobe degraus, pula paredes, explode em quem encostar. */
function stepWalker(p: Projectile, dt: number, w: SimWorld): FlightResult {
  const t = w.terrain;
  const r = p.spec.size;
  const dir = p.dir ?? 1;
  for (const u of w.units) {
    if (!u.alive || (u.id === p.ownerId && p.age < 1)) continue;
    const dx = p.x - u.cx;
    const dy = p.y - u.cy;
    const rr = u.radius + r;
    if (dx * dx + dy * dy < rr * rr) return 'explode';
  }
  const grounded = t.isSolid(p.x, p.y + r + 1);
  p.vy += GRAVITY * dt;
  if (grounded && p.vy > 0) p.vy = 0;
  // anda (no ar também, para conseguir passar por cima do que pulou)
  const nx = p.x + dir * p.spec.walker! * dt;
  if (!t.isSolid(nx + dir * r, p.y)) p.x = nx;
  else {
    let climbed = false;
    for (let s = 1; s <= WALKER_STEP; s++) {
      if (!t.isSolid(nx + dir * r, p.y - s)) {
        p.x = nx;
        p.y -= s;
        climbed = true;
        break;
      }
    }
    if (!climbed) {
      if (grounded) p.vy = -WALKER_HOP;
      else if (p.vy > 0) p.dir = dir === 1 ? -1 : 1; // pulou e não passou: dá meia-volta
    }
  }
  // ladeira acima: não deixa o pé afundar no chão
  for (let s = 0; s < WALKER_STEP && t.isSolid(p.x, p.y + r - 1); s++) p.y -= 1;
  // vertical
  const ny = p.y + p.vy * dt;
  if (p.vy > 0 && t.isSolid(p.x, ny + r)) {
    p.vy = 0;
    while (t.isSolid(p.x, p.y + r) && p.y > 0) p.y -= 1;
  } else if (p.vy < 0 && t.isSolid(p.x, ny - r)) p.vy = 0;
  else p.y = ny;
  p.rot += dt * 10; // passinhos (só visual)
  if (p.y > t.waterY) return 'water';
  if (p.x < -400 || p.x > t.width + 400) return 'lost';
  return 'fly';
}

/** Dano de uma explosão em uma bolota (0 se longe demais). */
export function blastDamage(blast: number, damage: number, ex: number, ey: number, u: Unit): number {
  const reach = blast + u.radius + 6;
  const d = Math.hypot(u.cx - ex, u.cy - ey);
  if (d >= reach) return 0;
  const f = 1 - d / reach;
  return Math.round(damage * (0.35 + 0.65 * f));
}

export const ROPE_RANGE = 480;
export const ROPE_MIN = 24;

/** Lança a corda na direção (dx, dy). Devolve o ponto onde prendeu, ou null. */
export function castRope(t: Terrain, x: number, y: number, dx: number, dy: number): { x: number; y: number } | null {
  for (let d = 14; d <= ROPE_RANGE; d += 3) {
    const px = x + dx * d;
    const py = y + dy * d;
    if (t.isSolid(px, py)) return { x: px, y: py };
  }
  return null;
}

/** Pêndulo da corda ninja: gravidade + fio de comprimento fixo. */
export function stepRope(t: Terrain, u: Unit, dt: number): number {
  const r = u.rope!;
  // o chão onde a corda prendeu explodiu? solta
  if (!t.isSolid(r.ax, r.ay)) {
    u.rope = null;
    return 0;
  }
  u.onGround = false;
  u.fallSpeed = 0;
  u.vy += GRAVITY * dt;
  u.vx *= 0.998;
  u.vy *= 0.998;
  const steps = Math.max(1, Math.ceil((Math.hypot(u.vx, u.vy) * dt) / 1.5));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    let px = u.x + u.vx * sdt;
    let py = u.cy + u.vy * sdt;
    const dx = px - r.ax;
    const dy = py - r.ay;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > r.len) {
      const nx = dx / dist;
      const ny = dy / dist;
      px = r.ax + nx * r.len;
      py = r.ay + ny * r.len;
      const radial = u.vx * nx + u.vy * ny;
      if (radial > 0) {
        u.vx -= radial * nx;
        u.vy -= radial * ny;
      }
    }
    let footY = py + 12 * u.size;
    if (bodyCollides(t, px, footY, u.size)) {
      // raspou no chão: tenta deslizar por cima de degraus pequenos
      let lifted = false;
      for (let up = 1; up <= 6; up++) {
        if (!bodyCollides(t, px, footY - up, u.size)) {
          footY -= up;
          lifted = true;
          break;
        }
      }
      if (!lifted) {
        u.vx *= -0.25;
        u.vy *= -0.25;
        break;
      }
    }
    u.x = px;
    u.y = footY;
  }
  return 0;
}
