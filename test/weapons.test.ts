import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/domain/weapons';

describe('catálogo de armas', () => {
  it('ids e teclas únicas', () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
    expect(new Set(WEAPONS.map((w) => w.key)).size).toBe(WEAPONS.length);
  });

  it('armas de carregar têm projétil e velocidade', () => {
    for (const w of WEAPONS.filter((w) => w.mode === 'charge')) {
      expect(w.projectile, w.id).toBeDefined();
      expect(w.maxSpeed, w.id).toBeGreaterThan(0);
    }
  });
});
