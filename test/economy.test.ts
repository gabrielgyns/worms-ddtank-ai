import { describe, expect, it } from 'vitest';
import { coinsForMatch } from '../src/progress/economy';
import type { TeamMatchStats } from '../src/progress/tracker';

const stats = (p: Partial<TeamMatchStats> = {}): TeamMatchStats => ({
  damage: 0, selfDamage: 0, kills: 0, drowns: 0, shots: 0, hits: 0, longestShot: 0, multiHit: 0, multiKill: 0,
  weapons: {}, againstWind: false, lost: 0, damageTaken: 0, underdog: false, ...p,
});

describe('Bolotins', () => {
  it('só jogar já dá moedas', () => {
    expect(coinsForMatch(stats(), false, 'online', null).total).toBe(20);
  });
  it('vitória com eliminações e dano', () => {
    expect(coinsForMatch(stats({ kills: 2, damage: 250 }), true, 'online', null).total).toBe(20 + 50 + 20 + 25);
  });
  it('dano tem teto', () => {
    expect(coinsForMatch(stats({ damage: 5000 }), false, 'online', null).total).toBe(20 + 50);
  });
  it('dificuldade da CPU multiplica', () => {
    expect(coinsForMatch(stats(), true, 'cpu', 'dificil').total).toBe(Math.round(70 * 1.5));
    expect(coinsForMatch(stats(), true, 'cpu', 'facil').total).toBe(35);
  });
});
