import { describe, expect, it } from 'vitest';
import { newMatch } from './helpers';

describe('caixas', () => {
  it('caem, pousam e são coletadas por quem encosta', () => {
    const m = newMatch(31);
    m.start();
    for (let i = 0; i < 300 && m.phase !== 'turn'; i++) m.step({});
    const u = m.active!;
    // derruba uma caixa de vida em cima da bolota da vez
    const events: string[] = [];
    m.on((e) => events.push(e.type));
    m.crates.push({ id: 99, x: Math.round(u.x), y: u.y - 120, vy: 0, kind: 'health', weapon: null, landed: false });
    const hp = u.hp;
    for (let i = 0; i < 240 && m.crates.length; i++) m.step({});
    expect(m.crates).toHaveLength(0);
    expect(u.hp).toBe(hp + 25);
    expect(events).toContain('cratePick');
  });

  it('caixa de arma soma munição ao time', () => {
    const m = newMatch(32);
    m.start();
    for (let i = 0; i < 300 && m.phase !== 'turn'; i++) m.step({});
    const u = m.active!;
    const before = u.team.ammo.get('dynamite')!;
    m.crates.push({ id: 7, x: Math.round(u.x), y: u.y - 60, vy: 0, kind: 'weapon', weapon: 'dynamite', landed: false });
    for (let i = 0; i < 240 && m.crates.length; i++) m.step({});
    expect(u.team.ammo.get('dynamite')).toBe(before + 1);
  });

  it('partidas longas soltam caixas e o snapshot as preserva', () => {
    const m = newMatch(33);
    m.start();
    let drops = 0;
    m.on((e) => e.type === 'crateDrop' && drops++);
    // passa turnos sem fazer nada (o tempo acaba)
    for (let i = 0; i < 60 * 60 * 6 && drops === 0; i++) m.step({});
    expect(drops).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const b = newMatch(33);
    b.restore(snap);
    expect(b.checksum()).toBe(m.checksum());
    expect(b.crates.length).toBe(m.crates.length);
  }, 30_000);

  it('dá para desligar as caixas', () => {
    const m = newMatch(34);
    expect(m.cratesOn).toBe(true);
  });
});

describe('morte súbita', () => {
  it('a água sobe a cada turno depois do turno marcado', async () => {
    const { Match } = await import('../src/domain/match');
    const { THEMES } = await import('../src/domain/theme');
    const { cpuTeam } = await import('./helpers');
    const m = new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 2, theme: THEMES.neve, seed: 5, turnTime: 1, suddenDeath: 3 });
    const start = m.terrain.waterY;
    const events: string[] = [];
    m.on((e) => events.push(e.type));
    m.start();
    for (let i = 0; i < 60 * 60 && m.turnNumber < 6 && m.phase !== 'over'; i++) m.step({});
    expect(events).toContain('suddenDeath');
    expect(m.terrain.waterY).toBeLessThan(start);
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const b = new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 2, theme: THEMES.neve, seed: 5, turnTime: 1, suddenDeath: 3 });
    b.restore(snap);
    expect(b.terrain.waterY).toBe(m.terrain.waterY);
    expect(b.checksum()).toBe(m.checksum());
  }, 30_000);
});
