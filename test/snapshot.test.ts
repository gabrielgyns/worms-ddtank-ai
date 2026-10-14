import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { decodeMask, encodeMask } from '../src/domain/codec';
import { newMatch } from './helpers';

describe('snapshot', () => {
  it('codifica e decodifica a máscara sem perdas', () => {
    const m = newMatch(4);
    m.terrain.carve(1000, 700, 60);
    const t0 = performance.now();
    const enc = encodeMask(m.terrain.solid);
    const out = new Uint8Array(m.terrain.solid.length);
    decodeMask(enc, out);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(out.every((v, i) => v === m.terrain.solid[i])).toBe(true);
    expect(enc.length).toBeLessThan(m.terrain.solid.length / 50);
  });

  it('restaurar dá o mesmo checksum e a partida segue igual', () => {
    const a = newMatch(8);
    const ai = [new AiController('dificil'), new AiController('dificil')];
    a.start();
    // joga até haver projéteis no ar, para testar o pior caso
    for (let i = 0; i < 60 * 60 && !(a.projectiles.length > 0 && a.phase === 'retreat'); i++) {
      a.step(a.activeTeam ? ai[a.activeTeam.id].decide(a) : {});
    }
    expect(a.projectiles.length).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(a.snapshot()));
    const b = newMatch(8);
    b.restore(snap);
    expect(b.checksum()).toBe(a.checksum());
    for (let i = 0; i < 600; i++) {
      a.step({});
      b.step({});
    }
    expect(b.checksum()).toBe(a.checksum());
  }, 30_000);
});
