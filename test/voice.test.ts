import { describe, expect, it } from 'vitest';
import { syllables } from '../src/core/voice';

describe('voz de balbucio', () => {
  it('quebra a frase em sílabas com a vogal e a consoante de ataque', () => {
    const s = syllables('Toma!');
    expect(s).toHaveLength(2);
    expect(s[0].onset).toBe('pop');
    expect(s[1].onset).toBe('hum');
  });

  it('acento e ditongo não viram sílaba extra', () => {
    expect(syllables('Ai!')).toHaveLength(1);
    expect(syllables('Opa!')).toHaveLength(2);
    expect(syllables('Ninguém viu isso.').length).toBeGreaterThanOrEqual(5);
  });

  it('grito sem vogal ainda faz som e frase longa tem limite', () => {
    expect(syllables('Hmpf!')).toHaveLength(1);
    expect(syllables('a'.repeat(5) + ' banana '.repeat(20)).length).toBeLessThanOrEqual(14);
    expect(syllables('')).toHaveLength(0);
  });
});
