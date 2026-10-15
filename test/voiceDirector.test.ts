import { describe, expect, it } from 'vitest';
import type { VoiceCue } from '../src/core/voicepacks';
import { VOICE_PACKS } from '../src/core/voicepacks';
import type { VoicePlayer } from '../src/core/voiceplayer';
import { COSMETICS } from '../src/domain/cosmetics';
import type { GameEvent } from '../src/domain/match';
import type { Effects } from '../src/render/effects';
import { VoiceDirector } from '../src/voiceDirector';
import { newMatch } from './helpers';

/** Partida com o time 0 usando a voz gravada e um tocador falso que anota as falas. */
function setup() {
  const m = newMatch(3, 2);
  m.teams[0].look = { voice: 'voice-original' };
  const said: VoiceCue[] = [];
  const player = {
    preload: () => {},
    ready: (id?: string) => id === 'voice-original',
    play: (_id: string, cue: VoiceCue) => (said.push(cue), { text: cue, dur: 0.5 }),
  } as unknown as VoicePlayer;
  const fx = { voiced: null, bubble: () => {} } as unknown as Effects;
  const d = new VoiceDirector(m, player, fx, () => true);
  const emit = (e: GameEvent) => m['emit'](e);
  const [a, b] = m.units.filter((u) => u.team.id === 0);
  const enemy = m.units.find((u) => u.team.id === 1)!;
  return { m, d, fx, said, emit, a, b, enemy };
}

describe('pacote de voz', () => {
  it('o catálogo cobre todos os momentos e o item existe na loja', () => {
    const cues = new Set(VOICE_PACKS['voice-original'].clips.map((c) => c[0]));
    for (const cue of ['turn', 'fire', 'hit', 'kill', 'miss', 'ouch', 'big', 'death', 'win', 'lose'] as const) expect(cues.has(cue)).toBe(true);
    expect(COSMETICS.some((c) => c.id === 'voice-original' && c.slot === 'voice')).toBe(true);
    // falas em ordem no mp3, sem se sobrepor
    const clips = VOICE_PACKS['voice-original'].clips;
    for (let i = 1; i < clips.length; i++) expect(clips[i][2]).toBeGreaterThan(clips[i - 1][2] + clips[i - 1][3]);
  });

  it('cada tipo de dano puxa a fala certa', () => {
    const { said, emit, a, b, enemy } = setup();
    emit({ type: 'damage', unit: a, amount: 10, by: a });
    emit({ type: 'damage', unit: b, amount: 10, by: a });
    emit({ type: 'damage', unit: a, amount: 40, by: enemy });
    expect(said).toEqual(['self', 'friendly', 'big']);
  });

  it('eliminar um inimigo rende provocação depois de um tempinho', () => {
    const { d, said, emit, a, enemy } = setup();
    enemy.alive = false;
    emit({ type: 'death', unit: enemy, by: a });
    expect(said).toEqual([]); // o inimigo não tem voz gravada
    d.update(1.2);
    expect(['kill', 'laugh']).toContain(said[0]);
  });

  it('tiro que não acerta ninguém vira "Errei!" (às vezes)', () => {
    let misses = 0;
    for (let i = 0; i < 40; i++) {
      const { d, said, emit, a } = setup();
      emit({ type: 'fire', weapon: 'bazooka', unit: a });
      emit({ type: 'explosion', x: 0, y: 0, r: 30, by: a });
      d.update(1);
      if (said.includes('miss')) misses++;
      expect(said).not.toContain('hit');
    }
    expect(misses).toBeGreaterThan(10);
  });

  it('time sem pacote fica no balbucio: o efeito continua sorteando as falas dele', () => {
    const { fx, a, enemy } = setup();
    expect(fx.voiced?.(a)).toBe(true);
    expect(fx.voiced?.(enemy)).toBe(false);
  });
});
