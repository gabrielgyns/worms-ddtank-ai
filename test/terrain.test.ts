import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Terrain } from '../src/domain/terrain';

describe('Terrain', () => {
  it('gera chão sólido e céu vazio', () => {
    const t = new Terrain(800, 600, 560);
    t.generate(new Rng(7));
    expect(t.isSolid(400, 599)).toBe(true);
    expect(t.isSolid(400, 0)).toBe(false);
  });

  it('fora dos limites nunca é sólido', () => {
    const t = new Terrain(100, 100, 90);
    t.solid.fill(1);
    expect(t.isSolid(-1, 50)).toBe(false);
    expect(t.isSolid(100, 50)).toBe(false);
    expect(t.isSolid(50, 100)).toBe(false);
  });

  it('escavar abre um buraco redondo e avisa os ouvintes', () => {
    const t = new Terrain(200, 200, 190);
    t.solid.fill(1);
    const calls: number[][] = [];
    t.onCarve((x, y, r) => calls.push([x, y, r]));
    t.carve(100, 100, 20);
    expect(t.isSolid(100, 100)).toBe(false);
    expect(t.isSolid(119, 100)).toBe(false);
    expect(t.isSolid(125, 100)).toBe(true);
    expect(calls).toEqual([[100, 100, 20]]);
  });

  it('a normal aponta para fora do chão', () => {
    const t = new Terrain(200, 200, 190);
    for (let y = 100; y < 200; y++) for (let x = 0; x < 200; x++) t.solid[y * 200 + x] = 1;
    const n = t.normalAt(100, 100);
    expect(n.y).toBeLessThan(-0.9);
    expect(t.surfaceY(50)).toBe(100);
  });
});
