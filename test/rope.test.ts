import { describe, expect, it } from 'vitest';
import { DEG } from '../src/core/math';
import { newMatch } from './helpers';

function toTurn(seed: number) {
  const m = newMatch(seed);
  m.start();
  for (let i = 0; i < 400 && m.phase !== 'turn'; i++) m.step({});
  return m;
}

describe('corda ninja', () => {
  it('prende no teto, balança, não gasta a vez e solta', () => {
    const m = toTurn(51);
    const u = m.active!;
    // cria um teto bem em cima da bolota
    const t = m.terrain;
    for (let y = Math.round(u.cy) - 130; y < Math.round(u.cy) - 110; y++) t.solid.fill(1, y * t.width + Math.round(u.x) - 60, y * t.width + Math.round(u.x) + 60);
    m.step({ weapon: 'rope' });
    m.step({ aimTo: 88 * DEG });
    const ammo = u.team.ammo.get('rope')!;
    m.step({ charge: 'start' });
    expect(u.rope).not.toBeNull();
    expect(u.team.ammo.get('rope')).toBe(ammo - 1);
    expect(m.phase).toBe('turn');
    const x0 = u.x;
    for (let i = 0; i < 40; i++) m.step({ walk: 1 });
    expect(u.x).not.toBe(x0);
    // ↑ encurta
    const len = u.rope!.len;
    for (let i = 0; i < 20; i++) m.step({ aim: 0.02 });
    expect(u.rope!.len).toBeLessThan(len);
    m.step({ charge: 'start' });
    expect(u.rope).toBeNull();
    expect(m.phase).toBe('turn');
  });

  it('errar a corda não gasta munição', () => {
    const m = toTurn(52);
    const u = m.active!;
    m.step({ weapon: 'rope' });
    m.step({ aimTo: 88 * DEG });
    // céu aberto acima (topo do mapa)
    u.y = 60;
    u.onGround = false;
    const ammo = u.team.ammo.get('rope')!;
    m.step({ charge: 'start' });
    expect(u.rope).toBeNull();
    expect(u.team.ammo.get('rope')).toBe(ammo);
  });
});

describe('paraquedas', () => {
  it('abre no ar e evita dano de queda', () => {
    const m = toTurn(53);
    const u = m.active!;
    u.y -= 400;
    u.onGround = false;
    m.step({ weapon: 'parachute' });
    m.step({ charge: 'start' });
    expect(u.chute).toBe(true);
    const hp = u.hp;
    for (let i = 0; i < 60 * 15 && !u.onGround; i++) m.step({});
    expect(u.onGround).toBe(true);
    expect(u.hp).toBe(hp);
    expect(u.chute).toBe(false);
  });
});
