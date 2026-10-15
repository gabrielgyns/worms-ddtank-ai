import { describe, expect, it } from 'vitest';
import { dailyShop, featuredShop, today } from '../src/progress/shop';
import { Progress } from '../src/progress/progress';

describe('loja', () => {
  it('a vitrine do dia é estável e tem um item em promoção', () => {
    const a = dailyShop('2026-10-15');
    expect(dailyShop('2026-10-15')).toEqual(a);
    expect(a).toHaveLength(6);
    expect(a.filter((o) => o.sale)).toHaveLength(1);
    expect(new Set(a.map((o) => o.item.id)).size).toBe(6);
    for (const o of a) expect(o.item.price).not.toBeNull();
  });
  it('bichos e vozes ficam sempre em destaque e fora do sorteio do dia', () => {
    expect(featuredShop().map((o) => o.item.id)).toEqual(['species-hamster', 'species-gato', 'voice-original']);
    for (const d of ['2026-10-15', '2026-10-16', '2026-11-01'])
      expect(dailyShop(d).some((o) => o.item.slot === 'species' || o.item.slot === 'voice')).toBe(false);
  });
  it('dias diferentes mudam a vitrine', () => {
    expect(dailyShop('2026-10-15').map((o) => o.item.id)).not.toEqual(dailyShop('2026-10-16').map((o) => o.item.id));
  });
  it('formata a data local', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('comprar debita e entrega; sem saldo não compra', () => {
    const p = new Progress();
    p.addCoins(200);
    expect(p.buy('hat-chef', 150)).toBe(true);
    expect(p.state.coins).toBe(50);
    expect(p.owns('hat-chef')).toBe(true);
    expect(p.buy('hat-cartola', 250)).toBe(false);
    expect(p.buy('hat-chef', 10)).toBe(false);
  });
});

describe('baús de conquista', () => {
  it('um baú a cada 3 conquistas, sempre com item novo', () => {
    const p = new Progress();
    expect(p.chestsAvailable).toBe(0);
    for (const id of ['a', 'b', 'c']) p.unlock(id);
    expect(p.chestsAvailable).toBe(1);
    const r = p.openChest(['hat-chef', 'hat-pirata'], () => 0)!;
    expect(r.item).toBe('hat-chef');
    expect(r.coins).toBe(100);
    expect(p.owns('hat-chef')).toBe(true);
    expect(p.chestsAvailable).toBe(0);
    expect(p.openChest(['hat-pirata'])).toBeNull();
  });
  it('quem já tem tudo ganha moedas', () => {
    const p = new Progress();
    p.give('hat-chef');
    for (const id of ['a', 'b', 'c']) p.unlock(id);
    expect(p.openChest(['hat-chef'])).toEqual({ item: null, coins: 400 });
  });
});

import { dailyScore, dailySpec } from '../src/progress/daily';

describe('desafio do dia', () => {
  it('mesmo dia, mesmo desafio', () => {
    expect(dailySpec('2026-10-15')).toEqual(dailySpec('2026-10-15'));
    expect(dailySpec('2026-10-15').seed).not.toBe(dailySpec('2026-10-16').seed);
  });
  it('pontuação premia dano, eliminação e vitória', () => {
    const s = { damage: 180, kills: 2 } as Parameters<typeof dailyScore>[0];
    expect(dailyScore(s, true, 10)).toBe(180 + 100 + 300 - 50);
    expect(dailyScore({ damage: 0, kills: 0 } as Parameters<typeof dailyScore>[0], false, 40)).toBe(0);
  });
});

import { daysLeft, previousSeason, seasonName, seasonOf } from '../src/progress/season';

describe('temporadas', () => {
  it('mês atual, anterior e nome', () => {
    const d = new Date(Date.UTC(2026, 0, 10));
    expect(seasonOf(d)).toBe('2026-01');
    expect(previousSeason(d)).toBe('2025-12');
    expect(seasonName('2026-10')).toBe('outubro de 2026');
    expect(daysLeft(new Date(Date.UTC(2026, 9, 31, 12)))).toBe(1);
  });
});
