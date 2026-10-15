import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { MISSIONS, missionSetup, missionStars } from '../src/domain/missions';
import { cpuTeam } from './helpers';

const player = { ...cpuTeam('Eu'), control: 'human' as const };

describe('missões', () => {
  it('toda missão monta: jogador e alvos no chão, munição só a da missão', () => {
    for (const ms of MISSIONS) {
      const m = new Match(missionSetup(ms, player));
      const [me, targets] = m.teams;
      expect(me.units, ms.id).toHaveLength(ms.player.length);
      expect(targets.units, ms.id).toHaveLength(ms.targets.length);
      for (const u of m.units) expect(u.y, `${ms.id} ${u.name}`).toBeLessThan(m.terrain.waterY - 20);
      for (const [id, n] of me.ammo) expect(n, `${ms.id} ${id}`).toBe(ms.ammo[id] ?? 0);
    }
  });

  it('alvos nunca jogam; vento é fixo', () => {
    const ms = MISSIONS[1];
    const m = new Match(missionSetup(ms, player));
    m.start();
    for (let i = 0; i < 60 * 120 && m.phase !== 'over'; i++) {
      if (m.phase === 'turn') {
        expect(m.activeTeam!.id).toBe(0);
        expect(m.wind).toBe(ms.wind);
      }
      m.step({});
    }
  });

  it('sem munição de ataque e com alvo vivo, a missão falha', () => {
    const ms = MISSIONS[0];
    const m = new Match(missionSetup(ms, player));
    m.start();
    for (let i = 0; i < 400 && m.phase !== 'turn'; i++) m.step({});
    m.teams[0].ammo.set('bazooka', 0);
    for (let i = 0; i < 60 * 60 && m.phase !== 'over'; i++) m.step({});
    expect(m.phase).toBe('over');
    expect(m.winner?.id).toBe(1);
  });

  it('estrelas pelos tiros usados', () => {
    const ms = MISSIONS[0];
    expect(missionStars(ms, true, 1)).toBe(3);
    expect(missionStars(ms, true, 2)).toBe(2);
    expect(missionStars(ms, true, 3)).toBe(1);
    expect(missionStars(ms, false, 1)).toBe(0);
  });
});
