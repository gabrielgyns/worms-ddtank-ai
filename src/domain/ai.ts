import { DEG } from '../core/math';
import type { Match } from './match';
import { blastDamage, stepProjectile, type Projectile } from './physics';
import type { Unit } from './unit';
import { weaponById, type ProjectileSpec, type WeaponId } from './weapons';

export type Difficulty = 'facil' | 'normal' | 'dificil';

interface Plan {
  weapon: WeaponId;
  facing: 1 | -1;
  aim: number;
  power: number;
  score: number;
  target?: { x: number; y: number };
}

const NOISE: Record<Difficulty, { aim: number; power: number; think: number }> = {
  facil: { aim: 7 * DEG, power: 0.07, think: 1.4 },
  normal: { aim: 2.5 * DEG, power: 0.025, think: 1.0 },
  dificil: { aim: 0.5 * DEG, power: 0.006, think: 0.7 },
};

/** Onde o tiro cairia? Usa exatamente a mesma física do jogo. */
function simulate(m: Match, u: Unit, spec: ProjectileSpec, maxSpeed: number, facing: 1 | -1, aim: number, power: number) {
  const dx = Math.cos(aim) * facing;
  const dy = -Math.sin(aim);
  const speed = maxSpeed * Math.max(0.06, power);
  const p: Projectile = {
    x: u.cx + dx * 16,
    y: u.cy + dy * 16,
    vx: dx * speed,
    vy: dy * speed,
    spec,
    fuse: spec.fuse,
    age: 0,
    ownerId: u.id,
    rot: 0,
  };
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 7; i++) {
    const r = stepProjectile(p, dt, m);
    if (r === 'explode') return { x: p.x, y: p.y };
    if (r === 'water' || r === 'lost') return null;
  }
  return null;
}

function scoreImpact(m: Match, me: Unit, x: number, y: number, blast: number, dmg: number): number {
  let s = 0;
  for (const u of m.units) {
    if (!u.alive) continue;
    const d = Math.min(blastDamage(blast, dmg, x, y, u), Math.max(0, u.hp));
    if (d <= 0) continue;
    if (u === me) s -= d * 2.2;
    else if (u.team === me.team) s -= d * 1.4;
    else s += d + (d >= u.hp ? 35 : 0);
  }
  // perto de inimigo já é alguma coisa — ajuda a IA a "chegar perto"
  let nearest = Infinity;
  for (const u of m.units) {
    if (u.alive && u.team !== me.team) nearest = Math.min(nearest, Math.hypot(u.cx - x, u.cy - y));
  }
  return s + Math.max(0, 8 - nearest / 40);
}

/**
 * IA da CPU. Pensa em pedaços por frame (para não travar),
 * depois mira e carrega a força como um jogador faria.
 */
export class AiController {
  private search: Generator<void, Plan, void> | null = null;
  private plan: Plan | null = null;
  private wait = 0;
  private walkTime = 0;
  private walkDir: 1 | -1 = 1;
  private turnSeen = -1;
  private walked = false;

  constructor(private readonly difficulty: Difficulty) {}

  update(m: Match, dt: number): void {
    const u = m.active;
    if (!u || m.phase !== 'turn') return;
    if (this.turnSeen !== m.turnNumber) {
      this.turnSeen = m.turnNumber;
      this.plan = null;
      this.search = null;
      this.walked = false;
      this.wait = NOISE[this.difficulty].think;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    if (this.walkTime > 0) {
      this.walkTime -= dt;
      m.walk(this.walkDir, dt);
      if (this.walkTime <= 0) this.wait = 0.4;
      return;
    }
    if (!u.onGround) return;

    if (!this.plan) {
      if (!this.search) this.search = this.think(m, u);
      const r = this.search.next();
      if (!r.done) return;
      this.search = null;
      const plan = r.value;
      if (plan.score <= 2 && !this.walked) {
        // nada bom daqui — anda um pouco na direção do inimigo e tenta de novo
        const enemy = this.nearestEnemy(m, u);
        this.walked = true;
        if (enemy) {
          this.walkDir = enemy.x > u.x ? 1 : -1;
          this.walkTime = 1.6;
          return;
        }
      }
      this.plan = this.applyNoise(plan);
      m.selectWeapon(this.plan.weapon);
      return;
    }

    const p = this.plan;
    if (p.target) {
      m.fireAt(p.target.x, p.target.y);
      return;
    }
    if (u.facing !== p.facing) {
      m.face(p.facing);
      this.wait = 0.25;
      return;
    }
    const diff = p.aim - u.aim;
    if (Math.abs(diff) > 0.004) {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), 1.3 * dt);
      m.aimBy(step);
      return;
    }
    if (!m.charging) m.startCharge(p.power);
  }

  private nearestEnemy(m: Match, u: Unit): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const o of m.units) {
      if (!o.alive || o.team === u.team) continue;
      const d = Math.abs(o.x - u.x);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private applyNoise(p: Plan): Plan {
    const n = NOISE[this.difficulty];
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    return {
      ...p,
      aim: p.aim + g() * n.aim,
      power: Math.min(1, Math.max(0.05, p.power + g() * n.power)),
      target: p.target ? { x: p.target.x + g() * n.aim * 400, y: p.target.y } : undefined,
    };
  }

  private *think(m: Match, u: Unit): Generator<void, Plan, void> {
    let best: Plan = { weapon: 'bazooka', facing: u.facing, aim: 0.6, power: 0.5, score: -Infinity };
    const candidates: WeaponId[] = ['bazooka', 'grenade'];
    let budget = 0;
    for (const id of candidates) {
      const w = weaponById(id);
      const spec = w.projectile!;
      for (const facing of [1, -1] as const) {
        for (let a = -25; a <= 86; a += 3) {
          for (let pw = 0.2; pw <= 1.0001; pw += 0.03) {
            const hit = simulate(m, u, spec, w.maxSpeed, facing, a * DEG, pw);
            if (hit) {
              const s = scoreImpact(m, u, hit.x, hit.y, spec.blast, spec.damage) - (id === 'grenade' ? 4 : 0);
              if (s > best.score) best = { weapon: id, facing, aim: a * DEG, power: pw, score: s };
            }
            if (++budget % 90 === 0) yield;
          }
        }
      }
    }

    // armas especiais: avalia no melhor ângulo da bazuca
    if (best.weapon === 'bazooka') {
      for (const id of ['triple', 'cluster'] as const) {
        if (m.ammoOf(id) <= 0) continue;
        const w = weaponById(id);
        const spec = w.projectile!;
        let s = 0;
        for (const extra of w.spread ?? [0]) {
          const hit = simulate(m, u, spec, w.maxSpeed, best.facing, best.aim + extra * DEG, best.power);
          if (!hit) continue;
          s += scoreImpact(m, u, hit.x, hit.y, spec.blast, spec.damage);
          if (spec.fragments) s += scoreImpact(m, u, hit.x, hit.y, 60, spec.fragments.spec.damage * 1.6);
        }
        if (s > best.score * 1.25 && s > 25) best = { ...best, weapon: id, score: s };
        yield;
      }
    }

    // sem tiro bom? chama o ataque aéreo
    if (best.score < 18 && m.ammoOf('airstrike') > 0) {
      const enemy = m.units
        .filter((o) => o.alive && o.team !== u.team)
        .sort((a, b) => a.hp - b.hp)[0];
      if (enemy && Math.abs(enemy.x - u.x) > 120) {
        best = { weapon: 'airstrike', facing: u.facing, aim: u.aim, power: 0, score: 30, target: { x: enemy.x, y: enemy.y } };
      }
    }
    return best;
  }
}
