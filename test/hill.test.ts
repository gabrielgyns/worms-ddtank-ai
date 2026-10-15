import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function hillMatch(seed: number): Match {
  return new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 2, theme: THEMES.prado, seed, turnTime: 30, hill: 4 });
}

describe('rei da colina', () => {
  it('a colina fica no alto do meio do mapa', () => {
    const m = hillMatch(3);
    const h = m.hill!;
    expect(h.x).toBeGreaterThan(m.terrain.width * 0.3);
    expect(h.x).toBeLessThan(m.terrain.width * 0.7);
    expect(m.terrain.isSolid(h.x, h.y)).toBe(false);
  });

  it('quem fica sozinho no topo marca ponto; com os dois lados lá, ninguém marca', () => {
    const m = hillMatch(3);
    m.start();
    while (m.phase !== 'turn') m.step({});
    const h = m.hill!;
    const others = m.units.filter((u) => u.team.side === 1);
    const a = m.teams[0].units[0];
    const endTurn = () => {
      const n = m.turnNumber;
      m.turnTimer = 0.01;
      for (let i = 0; i < 60 * 10 && m.turnNumber === n; i++) m.step({});
    };
    // só o lado 0 no topo
    a.x = h.x;
    a.y = h.y + 10;
    for (const o of others) if (Math.abs(o.x - h.x) < 200) o.x = h.x + 600;
    endTurn();
    expect(m.sidesOnHill()).toEqual([0]);
    expect(m.hillScore[0]).toBe(1);
    // os dois lados no topo: disputado, ninguém marca
    const b = others[0];
    b.x = h.x + 12;
    b.y = h.y + 10;
    b.vx = b.vy = 0;
    a.x = h.x - 12;
    a.y = h.y + 10;
    endTurn();
    expect(m.sidesOnHill().length).toBe(2);
    expect(m.hillScore).toEqual([1, 0]);
  });

  it('partida CPU x CPU termina por pontos ou eliminação, e o snapshot leva o placar', () => {
    const m = hillMatch(8);
    m.start();
    const ais = [new AiController('dificil'), new AiController('dificil')];
    let snapAt = -1;
    for (let t = 0; t < 60 * 60 * 25 && m.phase !== 'over'; t++) {
      const team = m.activeTeam;
      m.step(team ? ais[team.id].decide(m) : {});
      if (snapAt < 0 && m.hillScore.some((p) => p > 0)) {
        snapAt = t;
        const r = hillMatch(8);
        r.restore(JSON.parse(JSON.stringify(m.snapshot())));
        expect(r.checksum()).toBe(m.checksum());
        expect(r.hillScore).toEqual(m.hillScore);
      }
    }
    expect(m.phase).toBe('over');
    const byPoints = m.hillScore.some((p) => p >= 4);
    const byKills = m.aliveSides().length <= 1;
    expect(byPoints || byKills).toBe(true);
  }, 30_000);
});
