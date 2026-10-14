import { describe, expect, it } from 'vitest';
import { blastDamage, stepProjectile, stepUnit, walk, type Projectile } from '../src/domain/physics';
import { Terrain } from '../src/domain/terrain';
import { Unit, type Team } from '../src/domain/unit';
import { weaponById } from '../src/domain/weapons';

const DT = 1 / 60;

function flatWorld(groundY = 300): Terrain {
  const t = new Terrain(600, 400, 390);
  for (let y = groundY; y < 400; y++) for (let x = 0; x < 600; x++) t.solid[y * 600 + x] = 1;
  return t;
}

const team = { id: 0 } as Team;

describe('física das bolotas', () => {
  it('cai e para no chão sem dano numa queda curta', () => {
    const t = flatWorld();
    const u = new Unit(0, team, 'a', 300, 280);
    let dmg = 0;
    for (let i = 0; i < 120; i++) dmg += stepUnit(t, u, DT);
    expect(u.onGround).toBe(true);
    expect(u.y).toBeGreaterThanOrEqual(299);
    expect(u.y).toBeLessThan(302);
    expect(dmg).toBe(0);
  });

  it('leva dano numa queda alta', () => {
    const t = flatWorld(390);
    const u = new Unit(0, team, 'a', 300, 0);
    let dmg = 0;
    for (let i = 0; i < 240; i++) dmg += stepUnit(t, u, DT);
    expect(dmg).toBeGreaterThan(0);
  });

  it('anda no plano', () => {
    const t = flatWorld();
    const u = new Unit(0, team, 'a', 300, 300);
    u.onGround = true;
    for (let i = 0; i < 60; i++) walk(t, u, 1, DT);
    expect(u.x).toBeGreaterThan(350);
    expect(u.facing).toBe(1);
  });
});

describe('projéteis', () => {
  it('bazuca explode ao tocar o chão', () => {
    const t = flatWorld();
    const spec = weaponById('bazooka').projectile!;
    const p: Projectile = { x: 300, y: 100, vx: 0, vy: 200, spec, age: 0, ownerId: 9, rot: 0 };
    let r = 'fly';
    for (let i = 0; i < 120 && r !== 'explode'; i++) r = stepProjectile(p, DT, { terrain: t, wind: 0, units: [] });
    expect(r).toBe('explode');
    expect(p.y).toBeLessThan(301);
  });

  it('granada só explode quando o pavio acaba', () => {
    const t = flatWorld();
    const spec = weaponById('grenade').projectile!;
    const p: Projectile = { x: 300, y: 250, vx: 50, vy: 0, spec, fuse: spec.fuse, age: 0, ownerId: 9, rot: 0 };
    let ticks = 0;
    let r = 'fly';
    while (r !== 'explode' && ticks < 600) {
      r = stepProjectile(p, DT, { terrain: t, wind: 0, units: [] });
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(179);
    expect(ticks).toBeLessThanOrEqual(181);
  });

  it('o vento empurra a bazuca', () => {
    const t = flatWorld(399);
    const spec = weaponById('bazooka').projectile!;
    const shoot = (wind: number) => {
      const p: Projectile = { x: 300, y: 100, vx: 0, vy: -100, spec, age: 0, ownerId: 9, rot: 0 };
      for (let i = 0; i < 30; i++) stepProjectile(p, DT, { terrain: t, wind, units: [] });
      return p.x;
    };
    expect(shoot(10)).toBeGreaterThan(shoot(0));
    expect(shoot(-10)).toBeLessThan(shoot(0));
  });

  it('dano cai com a distância', () => {
    const u = new Unit(0, team, 'a', 100, 100);
    const near = blastDamage(40, 50, u.cx, u.cy, u);
    const far = blastDamage(40, 50, u.cx + 40, u.cy, u);
    expect(near).toBe(50);
    expect(far).toBeLessThan(near);
    expect(blastDamage(40, 50, u.cx + 500, u.cy, u)).toBe(0);
  });
});
