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

/** Arremessa o tatu: mira baixa para a frente e força pequena (cai perto e anda o resto). */
function throwTatu(m: Match, power = 12): void {
  m.step({ weapon: 'sheep', face: 1, aimTo: 0.5 });
  m.step({ charge: 'start' });
  run(m, power);
  m.step({ charge: 'release' });
}

describe('tatu-bomba', () => {
  it('voa como granada, cai e só então sai andando', () => {
    const m = flat();
    throwTatu(m);
    const tatu = m.projectiles[0];
    expect(tatu?.spec.kind).toBe('sheep');
    expect(tatu.landed).toBeFalsy();
    expect(tatu.fuse).toBeUndefined(); // o pavio só conta no chão
    for (let i = 0; i < 60 * 3 && !tatu.landed; i++) m.step({});
    expect(tatu.landed).toBe(true);
    expect(tatu.fuse).toBeGreaterThan(4.9);
    const xLand = tatu.x;
    run(m, 60);
    expect(tatu.x).toBeGreaterThan(xLand + 60); // andou a partir de onde caiu
  });

  it('anda até o inimigo e explode nele', () => {
    const m = flat();
    const enemy = m.units.find((u) => u.team !== m.active!.team)!;
    throwTatu(m);
    run(m, 60 * 7);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('acertando alguém em cheio no ar, explode na hora', () => {
    const m = flat();
    const enemy = m.units.find((u) => u.team !== m.active!.team)!;
    enemy.x = m.active!.x + 60;
    enemy.y = m.terrain.surfaceY(enemy.x) - 1;
    m.step({ weapon: 'sheep', face: 1, aimTo: 0.15 });
    m.step({ charge: 'start' });
    run(m, 40);
    m.step({ charge: 'release' });
    run(m, 40);
    expect(enemy.hp).toBeLessThan(100);
  });

  it('pula um degrau alto e sobe rampas', () => {
    const m = flat((b) => b.rect(800, G - 24, 2600, G));
    throwTatu(m);
    const tatu = m.projectiles[0];
    run(m, 60 * 4);
    expect(tatu.x).toBeGreaterThan(820);
  });

  it('Espaço de novo detona na hora, no ar ou andando', () => {
    const m = flat();
    throwTatu(m);
    run(m, 5);
    expect(m.projectiles.length).toBe(1);
    m.step({ charge: 'start' });
    m.step({});
    expect(m.projectiles.length).toBe(0);
  });

  it('snapshot no meio da caminhada reproduz igual', () => {
    const m = flat();
    throwTatu(m);
    run(m, 90);
    expect(m.projectiles[0].landed).toBe(true);
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
