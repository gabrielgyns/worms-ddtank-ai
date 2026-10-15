import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { G, MapBuilder } from '../src/domain/missions';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function flat(extra?: (b: MapBuilder) => MapBuilder): Match {
  const b = new MapBuilder().ground(200, 2600, G);
  const m = new Match({
    teams: [
      { ...cpuTeam('A'), spawns: [{ x: 600 }] },
      { ...cpuTeam('B'), spawns: [{ x: 1100 }] },
    ],
    unitsPerTeam: 1,
    theme: THEMES.prado,
    seed: 2,
    turnTime: 60,
    crates: false,
    objects: false,
    wind: 0,
    map: (extra ? extra(b) : b).encode(),
  });
  m.start();
  while (m.phase !== 'turn') m.step({});
  if (m.active!.x > 900) throw new Error('esperava o time A começando');
  return m;
}

function run(m: Match, ticks: number): void {
  for (let i = 0; i < ticks; i++) m.step({});
}

describe('ovelha', () => {
  it('anda até o inimigo e explode nele', () => {
    const m = flat();
    const enemy = m.units.find((u) => u.team !== m.active!.team)!;
    m.step({ weapon: 'sheep', face: 1 });
    m.step({ charge: 'start' });
    const sheep = m.projectiles[0];
    expect(sheep?.spec.kind).toBe('sheep');
    const x0 = sheep.x;
    run(m, 60);
    expect(sheep.x).toBeGreaterThan(x0 + 60); // andou
    run(m, 60 * 5);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('pula um degrau alto e sobe rampas', () => {
    const m = flat((b) => b.rect(800, G - 24, 2600, G));
    m.step({ weapon: 'sheep', face: 1 });
    m.step({ charge: 'start' });
    const sheep = m.projectiles[0];
    run(m, 60 * 3);
    expect(sheep.x).toBeGreaterThan(820);
  });

  it('Espaço de novo detona na hora', () => {
    const m = flat();
    m.step({ weapon: 'sheep', face: 1 });
    m.step({ charge: 'start' });
    run(m, 20);
    expect(m.projectiles.length).toBe(1);
    m.step({ charge: 'start' });
    m.step({});
    expect(m.projectiles.length).toBe(0);
  });

  it('snapshot no meio da caminhada reproduz igual', () => {
    const m = flat();
    m.step({ weapon: 'sheep', face: 1 });
    m.step({ charge: 'start' });
    run(m, 40);
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const r = flat();
    r.restore(snap);
    run(m, 120);
    run(r, 120);
    expect(r.checksum()).toBe(m.checksum());
  });
});

describe('bomba banana', () => {
  it('quica, explode e solta 5 bananas', () => {
    const m = flat();
    m.step({ weapon: 'banana', face: 1, aimTo: 0.6 });
    m.step({ charge: 'start' });
    run(m, 20);
    m.step({ charge: 'release' });
    let maxPieces = 0;
    for (let i = 0; i < 60 * 4; i++) {
      m.step({});
      maxPieces = Math.max(maxPieces, m.projectiles.filter((p) => p.spec.kind === 'banana' && p.spec.fuse === undefined).length);
    }
    expect(maxPieces).toBe(5);
  });
});
