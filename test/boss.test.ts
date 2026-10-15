import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { BossAi } from '../src/domain/boss';
import { Match, BOSS_SIZE } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function coop(seed: number) {
  return new Match({
    teams: [
      { ...cpuTeam('A'), side: 0 },
      { ...cpuTeam('B'), side: 0 },
      { ...cpuTeam('Rei'), side: 1, boss: true, names: ['Rei Bolotão'] },
    ],
    unitsPerTeam: 2,
    theme: THEMES.prado,
    seed,
    turnTime: 30,
    bossHp: 300,
    crates: false,
  });
}

describe('co-op contra o chefão', () => {
  it('monta dois times aliados e um chefão gigante', () => {
    const m = coop(1);
    const boss = m.units.find((u) => u.team.boss)!;
    expect(boss.size).toBe(BOSS_SIZE);
    expect(boss.hp).toBe(300);
    expect(m.units.filter((u) => !u.team.boss)).toHaveLength(4);
    expect(m.teams[0].side).toBe(m.teams[1].side);
  });

  it('a partida termina e o chefão usa seus ataques', () => {
    for (const seed of [3, 4]) {
      const m = coop(seed);
      const ai = [new AiController('dificil'), new AiController('dificil')];
      const boss = new BossAi();
      const used = new Set<string>();
      m.on((e) => e.type === 'fire' && e.unit.team.boss && used.add(e.weapon));
      m.start();
      for (let i = 0; i < 60 * 60 * 20 && m.phase !== 'over'; i++) {
        const t = m.activeTeam;
        m.step(!t ? {} : t.boss ? boss.decide(m) : ai[t.id].decide(m));
      }
      expect(m.phase, `seed ${seed}`).toBe('over');
      expect(used.size).toBeGreaterThan(0);
      // aliados nunca "vencem" um do outro: o vencedor é de um lado inteiro
      const sides = m.aliveSides();
      expect(sides.length).toBeLessThanOrEqual(1);
    }
  }, 120_000);
});
