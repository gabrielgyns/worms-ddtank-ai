import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { G, MapBuilder } from '../src/domain/missions';
import { METAL } from '../src/domain/terrain';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function flat(): Match {
  const m = new Match({
    teams: [
      { ...cpuTeam('A'), spawns: [{ x: 600 }] },
      { ...cpuTeam('B'), spawns: [{ x: 1400 }] },
    ],
    unitsPerTeam: 1,
    theme: THEMES.prado,
    seed: 6,
    turnTime: 60,
    crates: false,
    objects: false,
    wind: 0,
    map: new MapBuilder().ground(200, 2600, G).encode(),
  });
  m.start();
  while (m.phase !== 'turn') m.step({});
  return m;
}

describe('viga', () => {
  it('constrói metal no ângulo da mira e encerra a vez', () => {
    const m = flat();
    m.step({ weapon: 'girder', aimTo: 0 });
    const x = m.active!.cx + 150;
    const y = G - 120;
    const before = m.checksum();
    m.step({ target: { x, y } });
    expect(m.terrain.solid[y * m.terrain.width + x]).toBe(METAL);
    expect(m.terrain.solid[y * m.terrain.width + x + 50]).toBe(METAL); // horizontal: 110 de largura
    expect(m.terrain.solid[(y + 30) * m.terrain.width + x]).not.toBe(METAL);
    expect(m.checksum()).not.toBe(before);
    expect(m.phase).toBe('retreat');
  });

  it('não constrói em cima de ninguém nem longe demais', () => {
    const m = flat();
    m.step({ weapon: 'girder', aimTo: 0 });
    const u = m.active!;
    m.step({ target: { x: Math.round(u.cx), y: Math.round(u.cy) } });
    expect(m.phase).toBe('turn');
    m.step({ target: { x: Math.round(u.cx) + 900, y: G - 100 } });
    expect(m.phase).toBe('turn');
    expect(u.team.ammo.get('girder')).toBe(2);
  });

  it('é indestrutível como o metal do mapa', () => {
    const m = flat();
    m.step({ weapon: 'girder', aimTo: 0 });
    const x = m.active!.cx + 150;
    const y = G - 120;
    m.step({ target: { x, y } });
    m.explode(x, y, 60, 50, -1);
    expect(m.terrain.solid[y * m.terrain.width + x]).toBe(METAL);
  });
});
