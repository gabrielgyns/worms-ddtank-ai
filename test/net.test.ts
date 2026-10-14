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
