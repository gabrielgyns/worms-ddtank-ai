import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluate, type AchievementContext } from '../src/progress/achievements';

const base = (): AchievementContext => ({
  stats: {
    damage: 0, selfDamage: 0, kills: 0, drowns: 0, shots: 0, hits: 0, longestShot: 0, multiHit: 0, multiKill: 0,
    weapons: {}, againstWind: false, lost: 0, damageTaken: 0, underdog: false,
  },
  won: false,
  mode: 'cpu',
  difficulty: 'normal',
  unitsPerTeam: 3,
  career: { games: 1, wins: 0, losses: 1, damage: 0, kills: 0, shots: 0, hits: 0, longestShot: 0, weapons: {} },
});

describe('conquistas', () => {
  it('ids únicos e toda conquista tem recompensa', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.reward.coins || a.reward.item, a.id).toBeTruthy();
  });

  it('partida sem nada não desbloqueia nada', () => {
    expect(evaluate(base(), {})).toEqual([]);
  });

  it('vitória limpa com granadas no difícil desbloqueia várias', () => {
    const c = base();
    c.won = true;
    c.difficulty = 'dificil';
    c.stats.damage = 300;
    c.stats.shots = 4;
    c.stats.weapons = { grenade: 4 };
    const ids = evaluate(c, {}).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['primeiro-bum', 'primeira-vitoria', 'intocavel', 'granadeiro', 'sem-ar']));
  });

  it('não repete conquista já desbloqueada', () => {
    const c = base();
    c.stats.damage = 10;
    expect(evaluate(c, { 'primeiro-bum': 1 })).toEqual([]);
  });
});
