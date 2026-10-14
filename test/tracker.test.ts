import { describe, expect, it } from 'vitest';
import { MatchTracker } from '../src/progress/tracker';
import { newMatch, playOut } from './helpers';

describe('MatchTracker', () => {
  it('soma tiros, dano e eliminações coerentes com a partida', () => {
    const m = newMatch(21);
    const t = new MatchTracker(m);
    playOut(m);
    expect(m.phase).toBe('over');
    const [a, b] = t.teams;
    expect(a.shots + b.shots).toBeGreaterThan(0);
    expect(a.damage + b.damage).toBeGreaterThan(0);
    // eliminações creditadas nunca passam do número de bolotas perdidas pelo outro time
    expect(a.kills).toBeLessThanOrEqual(b.lost);
    expect(b.kills).toBeLessThanOrEqual(a.lost);
    const loser = m.teams.find((x) => x !== m.winner)!;
    expect(t.teams[loser.id].lost).toBe(3);
    for (const s of t.teams) expect(s.hits).toBeLessThanOrEqual(s.shots + 5);
  }, 60_000);
});
