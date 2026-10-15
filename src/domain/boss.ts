import { simulate } from './ai';
import { DEG } from '../core/math';
import { DT, NO_INPUT, type TickInput } from './commands';
import type { Match } from './match';
import type { Unit } from './unit';
import { weaponById } from './weapons';

type Plan =
  | { kind: 'meteoro'; x: number; y: number }
  | { kind: 'pisao' }
  | { kind: 'rajada'; facing: 1 | -1; aim: number; power: number };

/**
 * IA do Rei Bolotão. Padrões de ataque, estilo chefe de DDTank:
 * - alguém colado nele → Pisão Sísmico;
 * - turnos alternados → Chuva de Meteoros no mais fraco ou Rajada Real no mais perto.
 */
export class BossAi {
  private turnSeen = -1;
  private wait = 0;
  private plan: Plan | null = null;
  private selected = false;

  decide(m: Match): TickInput {
    const u = m.active;
    if (!u || !u.team.boss || m.phase !== 'turn') return NO_INPUT;
    if (this.turnSeen !== m.turnNumber) {
      this.turnSeen = m.turnNumber;
      this.wait = 1.1;
      this.plan = this.choose(m, u);
      this.selected = false;
    }
    if (this.wait > 0) {
      this.wait -= DT;
      return NO_INPUT;
    }
    const p = this.plan;
    if (!p) return NO_INPUT;
    if (!this.selected) {
      this.selected = true;
      return { weapon: p.kind === 'meteoro' ? 'boss-meteoro' : p.kind === 'pisao' ? 'boss-pisao' : 'boss-rajada' };
    }
    if (p.kind === 'meteoro') return { target: { x: Math.round(p.x), y: Math.round(p.y) } };
    if (p.kind === 'pisao') return m.charging ? NO_INPUT : { charge: 'start' };
    if (u.facing !== p.facing) return { face: p.facing };
    if (Math.abs(p.aim - u.aim) > 0.004) return { aimTo: p.aim };
    return m.charging ? NO_INPUT : { charge: 'start', chargeLimit: p.power };
  }

  private enemies(m: Match, u: Unit): Unit[] {
    return m.units.filter((o) => o.alive && o.team.side !== u.team.side);
  }

  private choose(m: Match, u: Unit): Plan | null {
    const foes = this.enemies(m, u);
    if (!foes.length) return null;
    const close = foes.some((f) => Math.hypot(f.x - u.x, f.cy - u.cy) < 130);
    if (close) return { kind: 'pisao' };
    if (m.turnNumber % 2 === 0) {
      const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0];
      return { kind: 'meteoro', x: weakest.x, y: weakest.y };
    }
    // rajada: procura o tiro central que cai mais perto do inimigo mais próximo
    const target = [...foes].sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
    const w = weaponById('boss-rajada');
    const facing: 1 | -1 = target.x >= u.x ? 1 : -1;
    let best = { aim: 45 * DEG, power: 0.7, dist: Infinity };
    for (let a = 10; a <= 80; a += 5) {
      for (let pw = 0.3; pw <= 1.0001; pw += 0.05) {
        const hit = simulate(m, u, w.projectile!, w.maxSpeed, facing, a * DEG, pw);
        if (!hit) continue;
        const d = Math.hypot(hit.x - target.cx, hit.y - target.cy);
        if (d < best.dist) best = { aim: a * DEG, power: pw, dist: d };
      }
    }
    return { kind: 'rajada', facing, aim: best.aim, power: best.power };
  }
}
