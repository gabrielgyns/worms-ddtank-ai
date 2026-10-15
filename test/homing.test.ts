import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { G, MapBuilder } from '../src/domain/missions';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function flat(): Match {
  const m = new Match({
    teams: [
      { ...cpuTeam('A'), spawns: [{ x: 600 }] },
      { ...cpuTeam('B'), spawns: [{ x: 700 }] },
    ],
    unitsPerTeam: 1,
    theme: THEMES.prado,
    seed: 4,
    turnTime: 60,
    crates: false,
    objects: false,
    wind: 8,
    map: new MapBuilder().ground(200, 2600, G).encode(),
  });
  m.start();
  while (m.phase !== 'turn') m.step({});
  return m;
}

describe('míssil teleguiado', () => {
  it('atirado para cima, curva e cai na marca (o vento não desvia depois que trava)', () => {
    const m = flat();
    const target = { x: 1500, y: G - 10 };
    m.step({ weapon: 'homing', face: 1, aimTo: 1.45 });
    m.step({ target });
    expect(m.homingTarget).toEqual(target);
    m.step({ charge: 'start' });
    for (let i = 0; i < 40; i++) m.step({});
    m.step({ charge: 'release' });
    let boom: { x: number; y: number } | null = null;
    m.on((e) => e.type === 'explosion' && !boom && (boom = { x: e.x, y: e.y }));
    for (let i = 0; i < 60 * 8 && !boom; i++) m.step({});
    expect(boom).not.toBeNull();
    expect(Math.hypot(boom!.x - target.x, boom!.y - target.y)).toBeLessThan(80);
  });
});

describe('taco', () => {
  it('arremessa quem está na frente na direção da mira e passa a vez', () => {
    const m = flat();
    const me = m.active!;
    const other = m.units.find((u) => u !== me)!;
    // encosta um no outro
    other.x = me.x + me.facing * 24;
    other.y = me.y;
    m.step({ weapon: 'bat', aimTo: 0.5 });
    const hp = other.hp;
    m.step({ charge: 'start' });
    expect(other.hp).toBeLessThan(hp);
    expect(Math.sign(other.vx)).toBe(me.facing);
    expect(other.vy).toBeLessThan(0);
    expect(m.phase).toBe('retreat');
  });

  it('errar o taco gasta a vez sem machucar ninguém', () => {
    const m = flat();
    const other = m.units.find((u) => u !== m.active)!;
    other.x = m.active!.x + 300;
    m.step({ weapon: 'bat' });
    m.step({ charge: 'start' });
    expect(other.hp).toBe(100);
    expect(m.phase).toBe('retreat');
  });
});
