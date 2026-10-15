import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

describe('2x2', () => {
  it('a vez alterna entre as duplas e o lado inteiro vence junto', () => {
    const m = new Match({
      teams: [0, 1, 0, 1].map((side, i) => ({ ...cpuTeam(`T${i}`), side })),
      unitsPerTeam: 2,
      theme: THEMES.prado,
      seed: 11,
      turnTime: 30,
    });
    m.start();
    const ais = m.teams.map(() => new AiController('dificil'));
    // só conta a alternância enquanto os quatro times têm alguém vivo
    const sides: number[] = [];
    m.on((e) => {
      if (e.type === 'turnStart' && m.teams.every((t) => t.units.some((u) => u.alive))) sides.push(e.unit.team.side);
    });
    for (let t = 0; t < 60 * 60 * 25 && m.phase !== 'over'; t++) {
      const team = m.activeTeam;
      m.step(team ? ais[team.id].decide(m) : {});
    }
    expect(m.phase).toBe('over');
    // enquanto os dois lados têm gente, ninguém joga duas vezes seguidas pelo mesmo lado
    expect(sides.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1]);
    // fogo amigo é possível, mas a CPU mira em quem é do outro lado
    expect(m.winner).not.toBeNull();
    const winSide = m.winner!.side;
    expect(m.teams.filter((t) => t.side !== winSide).every((t) => t.units.every((u) => !u.alive))).toBe(true);
  });
});
