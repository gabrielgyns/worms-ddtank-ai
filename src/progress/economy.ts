import type { MatchMode } from './achievements';
import type { TeamMatchStats } from './tracker';

/** Quanto vale cada coisa, em Bolotins. */
export const COIN_RULES = {
  play: 20,
  win: 50,
  perKill: 10,
  /** 1 moeda a cada X de dano */
  damagePerCoin: 10,
  damageCap: 50,
  difficulty: { facil: 0.5, normal: 1, dificil: 1.5 },
} as const;

export interface CoinBreakdown {
  label: string;
  coins: number;
}

/** Moedas de uma partida, com a conta explicada (aparece na tela de fim). */
export function coinsForMatch(
  s: TeamMatchStats,
  won: boolean,
  mode: MatchMode,
  difficulty: keyof typeof COIN_RULES.difficulty | null,
): { total: number; lines: CoinBreakdown[] } {
  const lines: CoinBreakdown[] = [{ label: 'Partida', coins: COIN_RULES.play }];
  if (won) lines.push({ label: 'Vitória', coins: COIN_RULES.win });
  if (s.kills) lines.push({ label: `${s.kills} eliminaç${s.kills > 1 ? 'ões' : 'ão'}`, coins: s.kills * COIN_RULES.perKill });
  const dmg = Math.min(COIN_RULES.damageCap, Math.floor(s.damage / COIN_RULES.damagePerCoin));
  if (dmg) lines.push({ label: 'Dano', coins: dmg });
  let total = lines.reduce((a, l) => a + l.coins, 0);
  if (mode === 'cpu' && difficulty) {
    const mult = COIN_RULES.difficulty[difficulty];
    if (mult !== 1) {
      const extra = Math.round(total * mult) - total;
      lines.push({ label: mult > 1 ? 'Bônus Difícil' : 'Fácil (metade)', coins: extra });
      total += extra;
    }
  }
  return { total, lines };
}
