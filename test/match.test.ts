import { describe, expect, it } from 'vitest';
import { newMatch, playOut } from './helpers';

describe('Match', () => {
  it('cria os times e as bolotas acima da água', () => {
    const m = newMatch(3, 4);
    expect(m.teams).toHaveLength(2);
    expect(m.units).toHaveLength(8);
    for (const u of m.units) expect(u.y).toBeLessThan(m.terrain.waterY);
  });

  it('CPU x CPU sempre termina, com um vencedor', () => {
    for (const seed of [11, 22, 33]) {
      const m = newMatch(seed);
      const t = playOut(m);
      expect(m.phase, `seed ${seed} travou após ${t}s`).toBe('over');
      const alive = m.aliveTeams();
      expect(alive.length).toBeLessThanOrEqual(1);
      if (m.winner) expect(alive[0]).toBe(m.winner);
    }
  }, 60_000);

  it('não deixa trocar de arma sem munição', () => {
    const m = newMatch(5);
    m.start();
    for (let i = 0; i < 200 && m.phase !== 'turn'; i++) m.update(1 / 60);
    expect(m.phase).toBe('turn');
    m.activeTeam!.ammo.set('dynamite', 0);
    expect(m.selectWeapon('dynamite')).toBe(false);
    expect(m.selectWeapon('grenade')).toBe(true);
    expect(m.weapon.id).toBe('grenade');
  });
});

describe('abandono', () => {
  it('forfeit encerra a partida com o outro time vencendo', () => {
    const m = newMatch(6);
    m.start();
    for (let i = 0; i < 200 && m.phase !== 'turn'; i++) m.step({});
    m.step({ forfeit: 1 });
    expect(m.phase).toBe('over');
    expect(m.winner?.id).toBe(0);
  });
});
