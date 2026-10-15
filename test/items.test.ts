import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

function ready(seed = 5): Match {
  const m = new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 1, theme: THEMES.prado, seed, turnTime: 30, crates: false, objects: false, wind: 0 });
  m.start();
  while (m.phase !== 'turn') m.step({});
  return m;
}

function blastOn(m: Match, target: { cx: number; cy: number }): number {
  let total = 0;
  const off = m.on((e) => e.type === 'damage' && (total += e.amount));
  m.explode(target.cx + 10, target.cy, 40, 40, m.active!.id);
  void off;
  return total;
}

describe('itens de turno', () => {
  it('cada time começa com um de cada', () => {
    const m = ready();
    for (const t of m.teams) expect([...t.items.values()]).toEqual([1, 1, 1]);
  });

  it('força +50% aumenta o dano dos tiros da vez', () => {
    const a = ready();
    const b = ready();
    const enemyA = a.units.find((u) => u.team !== a.active!.team)!;
    const enemyB = b.units.find((u) => u.team !== b.active!.team)!;
    b.step({ item: 'power' });
    a.step({});
    const plain = blastOn(a, enemyA);
    const strong = blastOn(b, enemyB);
    expect(plain).toBeGreaterThan(0);
    expect(strong).toBe(Math.round(plain * 1.5));
    expect(b.active!.team.items.get('power')).toBe(0);
  });

  it('escudo corta o dano pela metade até a próxima vez do time', () => {
    const m = ready();
    const me = m.active!;
    m.step({ item: 'shield' });
    expect(me.shield).toBe(true);
    const dmg = blastOn(m, me);
    const ref = ready();
    const plain = blastOn(ref, ref.active!);
    expect(dmg).toBe(Math.max(1, Math.round(plain * 0.5)));
  });

  it('tiro duplo deixa atirar duas vezes e gasta munição das duas', () => {
    const m = ready();
    const team = m.active!.team;
    m.step({ weapon: 'grenade' });
    const before = team.ammo.get('grenade')!;
    m.step({ item: 'double' });
    m.step({ charge: 'start' });
    for (let i = 0; i < 10; i++) m.step({});
    m.step({ charge: 'release' });
    expect(m.phase).toBe('turn');
    m.step({ charge: 'start' });
    for (let i = 0; i < 10; i++) m.step({});
    m.step({ charge: 'release' });
    expect(m.phase).toBe('retreat');
    expect(m.projectiles.length).toBe(2);
    if (before !== Infinity) expect(team.ammo.get('grenade')).toBe(before - 2);
  });

  it('não usa item depois de atirar nem sem estoque', () => {
    const m = ready();
    expect(m.useItem('power')).toBe(true);
    expect(m.useItem('power')).toBe(false); // já ligado
    m.step({ charge: 'start' });
    m.step({ charge: 'release' });
    expect(m.useItem('shield')).toBe(false); // já atirou
  });

  it('snapshot leva itens, efeitos e escudo', () => {
    const m = ready();
    m.step({ item: 'shield' });
    m.step({ item: 'power' });
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const r = ready(99);
    r.restore(snap);
    expect(r.checksum()).toBe(m.checksum());
    expect(r.boost.power).toBe(true);
    expect(r.units.find((u) => u.id === m.active!.id)!.shield).toBe(true);
  });
});
