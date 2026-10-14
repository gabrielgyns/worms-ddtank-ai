import { Rng } from '../core/math';
import { COSMETICS, type Cosmetic } from '../domain/cosmetics';

export interface Offer {
  item: Cosmetic;
  price: number;
  sale: boolean;
}

/** Data local no formato AAAA-MM-DD (a vitrine vira à meia-noite do jogador). */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Vitrine do dia: 6 itens à venda (igual para todo mundo no mesmo dia),
 * um deles com 30% de desconto.
 */
export function dailyShop(date = today(), size = 6): Offer[] {
  const rng = new Rng(seedOf(`loja-${date}`));
  const pool = COSMETICS.filter((c) => c.price !== null);
  const picked: Cosmetic[] = [];
  const left = [...pool];
  while (picked.length < Math.min(size, pool.length)) picked.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]);
  const saleIdx = Math.floor(rng.next() * picked.length);
  return picked.map((item, i) => ({ item, sale: i === saleIdx, price: i === saleIdx ? Math.round((item.price! * 0.7) / 5) * 5 : item.price! }));
}
