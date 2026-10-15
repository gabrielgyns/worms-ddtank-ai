import { describe, expect, it } from 'vitest';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

describe('prévia do tiro', () => {
  it('segue o mesmo caminho do projétil de verdade e não muda a partida', () => {
    const m = new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 1, theme: THEMES.prado, seed: 3, turnTime: 30, crates: false, objects: false, wind: 7 });
    m.start();
    while (m.phase !== 'turn') m.step({});
    expect(m.previewShot(0.4)).toEqual([]); // sem carregar, sem prévia
    m.step({ weapon: 'bazooka', aimTo: 0.9 });
    m.step({ charge: 'start' });
    for (let i = 0; i < 25; i++) m.step({});
    const before = m.checksum();
    const pts = m.previewShot(0.4);
    expect(m.checksum()).toBe(before);
    expect(pts.length).toBeGreaterThan(5);
    m.step({ charge: 'release' });
    // o tiro nasce depois de mais um tick de carga: compara pela forma, não pelo ponto exato
    const p = m.projectiles[0];
    expect(p).toBeDefined();
    const dirPreview = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    expect(Math.abs(Math.atan2(p.vy, p.vx) - dirPreview)).toBeLessThan(0.15);
  });
});
