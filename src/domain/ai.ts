import { DEG } from '../core/math';
import { DT, NO_INPUT, type TickInput } from './commands';
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
export function simulate(m: Match, u: Unit, spec: ProjectileSpec, maxSpeed: number, facing: 1 | -1, aim: number, power: number) {
  const dx = Math.cos(aim) * facing;
  const dy = -Math.sin(aim);
  const speed = maxSpeed * Math.max(0.06, power);
  const p: Projectile = {
    x: u.cx + dx * 16 * u.size,
    y: u.cy + dy * 16 * u.size,
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
    else if (u.team.side === me.team.side) s -= d * 1.4;
    else s += d + (d >= u.hp ? 35 : 0);
  }
  // perto de inimigo já é alguma coisa — ajuda a IA a "chegar perto"
  let nearest = Infinity;
  for (const u of m.units) {
    if (u.alive && u.team.side !== me.team.side) nearest = Math.min(nearest, Math.hypot(u.cx - x, u.cy - y));
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

  /** Decide a entrada deste tick. Não mexe na partida: quem aplica é o `Match.step`. */
  decide(m: Match): TickInput {
    const dt = DT;
    const u = m.active;
    if (!u || m.phase !== 'turn') return NO_INPUT;
    if (this.turnSeen !== m.turnNumber) {
      this.turnSeen = m.turnNumber;
      this.plan = null;
      this.search = null;
      this.walked = false;
      this.wait = NOISE[this.difficulty].think;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      return NO_INPUT;
    }
    if (this.walkTime > 0) {
      this.walkTime -= dt;
      if (this.walkTime <= 0) this.wait = 0.4;
      return { walk: this.walkDir };
    }
    if (!u.onGround) return NO_INPUT;

    if (!this.plan) {
      if (!this.search) this.search = this.think(m, u);
      const r = this.search.next();
      if (!r.done) return NO_INPUT;
      this.search = null;
      const plan = r.value;
      if (plan.score <= 2 && !this.walked) {
        // nada bom daqui: anda um pouco na direção do inimigo e tenta de novo
        const enemy = this.nearestEnemy(m, u);
        this.walked = true;
        if (enemy) {
          this.walkDir = enemy.x > u.x ? 1 : -1;
          this.walkTime = 1.6;
          return NO_INPUT;
        }
      }
      this.plan = this.applyNoise(plan);
      return { weapon: this.plan.weapon };
    }

    const p = this.plan;
    if (p.target) return { target: { x: p.target.x, y: p.target.y } };
    if (u.facing !== p.facing) {
      this.wait = 0.25;
      return { face: p.facing };
    }
    const diff = p.aim - u.aim;
    if (Math.abs(diff) > 0.004) {
      return { aim: Math.sign(diff) * Math.min(Math.abs(diff), 1.3 * dt) };
    }
    if (!m.charging) return { charge: 'start', chargeLimit: p.power };
    return NO_INPUT;
  }

  private nearestEnemy(m: Match, u: Unit): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const o of m.units) {
      if (!o.alive || o.team.side === u.team.side) continue;
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
    // Math.random aqui é ok: só muda a DECISÃO da CPU, que vira TickInput e é gravada/transmitida.
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
    // só armas com munição (nas missões a bazuca pode estar zerada)
    const candidates = (['bazooka', 'grenade', 'triple', 'cluster'] as WeaponId[]).filter((id) => m.ammoOf(id) > 0);
    const basic = candidates.filter((id) => id === 'bazooka' || id === 'grenade');
    const searched = basic.length ? basic : candidates.slice(0, 1);
    let budget = 0;
    for (const id of searched) {
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

    // ataque aéreo: estima os 5 mísseis caindo em volta de cada inimigo
    if (m.ammoOf('airstrike') > 0) {
      const spec = weaponById('airstrike').projectile!;
      for (const enemy of m.units.filter((o) => o.alive && o.team.side !== u.team.side)) {
        if (Math.abs(enemy.x - u.x) < 120) continue;
        let s = 0;
        for (let i = 0; i < 5; i++) {
          const x = enemy.x + (i - 2) * 34;
          s += scoreImpact(m, u, x, m.terrain.surfaceY(x), spec.blast, spec.damage) * 0.8;
        }
        // guarda o ataque aéreo para quando ele rende mais que o tiro normal
        if (s > best.score * 1.3 && s > 25) {
          best = { weapon: 'airstrike', facing: u.facing, aim: u.aim, power: 0, score: s, target: { x: enemy.x, y: enemy.y } };
        }
      }
    }
    return best;
  }
}
