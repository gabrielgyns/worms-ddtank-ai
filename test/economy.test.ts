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

import { rivals, type HistoryEntry } from '../src/progress/history';

describe('cara a cara local', () => {
  it('agrupa por adversário humano e ignora CPU', () => {
    const h: HistoryEntry[] = [
      { at: 3, mode: 'online', opponent: 'Esposa', result: 'loss', damage: 0 },
      { at: 2, mode: 'mail', opponent: 'Esposa', result: 'win', damage: 0 },
      { at: 1, mode: 'cpu', opponent: 'CPU', result: 'win', damage: 0 },
      { at: 4, mode: 'online', opponent: 'Primo', result: 'win', damage: 0 },
    ];
    expect(rivals(h)).toEqual([
      { opponent: 'Primo', wins: 1, losses: 0, draws: 0, last: 4 },
      { opponent: 'Esposa', wins: 1, losses: 1, draws: 0, last: 3 },
    ]);
  });
});
