import { describe, expect, it } from 'vitest';
import { isNetMsg } from '../src/net/protocol';
import { newRoomCode, normalizeCode } from '../src/net/transport';

describe('sala', () => {
  it('códigos têm 4 letras sem I e O', () => {
    for (let i = 0; i < 200; i++) expect(newRoomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
  it('normaliza o que o jogador digitou', () => {
    expect(normalizeCode(' ab-cd ')).toBe('ABCD');
    expect(normalizeCode('abc')).toBeNull();
  });
  it('reconhece mensagens do protocolo', () => {
    expect(isNetMsg({ t: 'ping', at: 1 })).toBe(true);
    expect(isNetMsg('oi')).toBe(false);
    expect(isNetMsg(null)).toBe(false);
  });
});

import { decodeLetter, encodeLetter, type Letter } from '../src/net/mail';
import { PROTOCOL_VERSION } from '../src/net/protocol';

describe('partida por link', () => {
  it('a carta vai e volta igual', async () => {
    const l: Letter = {
      v: PROTOCOL_VERSION,
      setup: { teams: [], unitsPerTeam: 3, themeId: 'neve', seed: 5, turnTime: 45 },
      snap: null,
      cmds: [{ tick: 3, input: { walk: 1 } }],
      endTick: 99,
      sum: 1234,
      to: 1,
    };
    const code = await encodeLetter(l);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeLetter(code)).toEqual(l);
    expect(await decodeLetter('lixo!!')).toBeNull();
  });
});

import { pack, unpack } from '../src/core/pack';
import { encodeMask } from '../src/domain/codec';
import { Match } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';
import { cpuTeam } from './helpers';

describe('mapas desenhados', () => {
  it('um mapa empacotado cabe num link e volta igual', async () => {
    const mask = new Uint8Array(2800 * 1400);
    for (let y = 900; y < 1400; y++) mask.fill(1, y * 2800 + 200, y * 2800 + 2600);
    const code = await pack(JSON.stringify({ n: 'Plano', t: 'prado', d: encodeMask(mask) }));
    expect(code.length).toBeLessThan(4000);
    const back = JSON.parse((await unpack(code))!);
    const m = new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam: 2, theme: THEMES[back.t as 'prado'], seed: 1, turnTime: 30, map: back.d, objects: false });
    expect(m.terrain.isSolid(1400, 1000)).toBe(true);
    expect(m.terrain.isSolid(1400, 800)).toBe(false);
    for (const u of m.units) expect(Math.abs(u.y - 900)).toBeLessThan(30);
  });
});
