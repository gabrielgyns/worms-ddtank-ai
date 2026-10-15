import { describe, expect, it } from 'vitest';
import { disabledWeapons, FLAGS, isOn } from '../src/domain/flags';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { WEAPONS } from '../src/domain/weapons';
import { cpuTeam } from './helpers';

describe('feature flags', () => {
  it('chave ausente = ligada; o catálogo cobre todas as armas', () => {
    expect(isOn({}, 'weapon:banana')).toBe(true);
    expect(isOn({ 'weapon:banana': false }, 'weapon:banana')).toBe(false);
    for (const w of WEAPONS) expect(FLAGS.some((f) => f.key === `weapon:${w.id}`)).toBe(true);
    expect(disabledWeapons({ 'weapon:banana': false, 'weapon:sheep': true })).toEqual(['banana']);
  });

  it('arma e item desligados no setup somem da partida', () => {
    const m = new Match({
      teams: [cpuTeam('A'), cpuTeam('B')],
      unitsPerTeam: 1,
      theme: THEMES.prado,
      seed: 1,
      turnTime: 30,
      disabledWeapons: ['banana', 'bazooka'],
      disabledItems: ['power'],
    });
    for (const t of m.teams) {
      expect(t.ammo.get('banana')).toBe(0);
      expect(t.ammo.get('bazooka')).toBe(0);
      expect(t.ammo.get('grenade')).toBeGreaterThan(0);
      expect(t.items.get('power')).toBe(0);
      expect(t.items.get('shield')).toBe(1);
    }
    m.start();
    while (m.phase !== 'turn') m.step({});
    // começa com uma arma que tem munição, não com a bazuca desligada
    expect(m.weapon.id).not.toBe('bazooka');
  });
});
