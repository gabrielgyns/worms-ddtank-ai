import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import { isEmptyInput, type Command } from '../src/domain/commands';
import { newMatch } from './helpers';

/** Joga com CPUs gravando os comandos; devolve o log e o checksum de cada turno. */
function record(seed: number, ticks: number) {
  const m = newMatch(seed);
  const ais = [new AiController('normal'), new AiController('dificil')];
  const log: Command[] = [];
  const sums: number[] = [];
  let turn = m.turnNumber;
  m.start();
  for (let i = 0; i < ticks && m.phase !== 'over'; i++) {
    const input = m.activeTeam ? ais[m.activeTeam.id].decide(m) : {};
    if (!isEmptyInput(input)) log.push({ tick: m.tick, input: structuredClone(input) });
    m.step(input);
    if (m.turnNumber !== turn) {
      turn = m.turnNumber;
      sums.push(m.checksum());
    }
  }
  return { log, sums, final: m.checksum(), ticks: m.tick };
}

function replay(seed: number, log: Command[], ticks: number) {
  const m = newMatch(seed);
  const sums: number[] = [];
  let turn = m.turnNumber;
  let k = 0;
  m.start();
  while (m.tick < ticks) {
    const input = log[k]?.tick === m.tick ? log[k++].input : {};
    m.step(input);
    if (m.turnNumber !== turn) {
      turn = m.turnNumber;
      sums.push(m.checksum());
    }
  }
  return { sums, final: m.checksum() };
}

describe('determinismo', () => {
  it('mesma seed + mesmos comandos ⇒ mesmo checksum', () => {
    const a = record(42, 60 * 120);
    const b = replay(42, a.log, a.ticks);
    expect(a.sums.length).toBeGreaterThan(3);
    expect(b.sums).toEqual(a.sums);
    expect(b.final).toBe(a.final);
  }, 60_000);

  it('seeds diferentes geram partidas diferentes', () => {
    expect(newMatch(1).checksum()).not.toBe(newMatch(2).checksum());
  });

  it('o checksum muda quando o estado muda', () => {
    const m = newMatch(9);
    const before = m.checksum();
    m.units[0].hp -= 1;
    expect(m.checksum()).not.toBe(before);
  });
});
