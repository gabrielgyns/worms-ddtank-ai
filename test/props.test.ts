import { describe, expect, it } from 'vitest';
import { METAL } from '../src/domain/terrain';
import { newMatch } from './helpers';

function toTurn(m: ReturnType<typeof newMatch>) {
  m.start();
  for (let i = 0; i < 400 && m.phase !== 'turn'; i++) m.step({});
}

describe('objetos no mapa', () => {
  it('gera vigas de metal, barris e minas', () => {
    const m = newMatch(41);
    expect(m.barrels.length).toBeGreaterThan(0);
    expect(m.mines.length).toBeGreaterThan(0);
    expect(m.terrain.solid.includes(METAL)).toBe(true);
  });

  it('metal não é escavado por explosões', () => {
    const m = newMatch(42);
    const t = m.terrain;
    const i = t.solid.indexOf(METAL);
    const x = i % t.width;
    const y = Math.floor(i / t.width);
    m.explode(x + 5, y + 5, 60, 0, -1);
    expect(t.solid[i]).toBe(METAL);
    expect(t.isSolid(x, y)).toBe(true);
  });

  it('explosão perto de barril causa reação em cadeia', () => {
    const m = newMatch(43);
    toTurn(m);
    const b = m.barrels[0];
    const n = m.barrels.length;
    let booms = 0;
    m.on((e) => e.type === 'explosion' && booms++);
    m.explode(b.x + 20, b.y - 10, 20, 0, -1);
    for (let i = 0; i < 60; i++) m.step({});
    expect(m.barrels.length).toBeLessThan(n);
    expect(booms).toBeGreaterThanOrEqual(2);
  });

  it('mina arma quando uma bolota chega perto e explode', () => {
    const m = newMatch(44);
    toTurn(m);
    const mn = m.mines[0];
    const u = m.active!;
    const events: string[] = [];
    m.on((e) => events.push(e.type));
    u.x = mn.x + 10;
    u.y = mn.y - 2;
    u.onGround = false;
    for (let i = 0; i < 200; i++) m.step({});
    expect(events).toContain('mineArmed');
    expect(m.mines.find((x) => x.id === mn.id)).toBeUndefined();
  });

  it('snapshot preserva objetos e metal', () => {
    const m = newMatch(45);
    toTurn(m);
    m.mines[0].fuse = 0.7;
    const snap = JSON.parse(JSON.stringify(m.snapshot()));
    const b = newMatch(45);
    b.restore(snap);
    expect(b.checksum()).toBe(m.checksum());
    expect(b.terrain.solid.includes(METAL)).toBe(true);
  });
});
