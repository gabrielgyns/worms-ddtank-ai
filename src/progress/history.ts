import { store } from '../services/store';
import type { MatchMode } from './achievements';

export interface HistoryEntry {
  at: number;
  mode: MatchMode;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  damage: number;
}

const MAX = 100;

/** Histórico de partidas deste aparelho (base do "cara a cara" sem servidor). */
export function loadHistory(): HistoryEntry[] {
  return store.get<HistoryEntry[]>('history', []);
}

export function addHistory(e: HistoryEntry): void {
  const h = loadHistory();
  h.unshift(e);
  store.set('history', h.slice(0, MAX));
}

export interface Rival {
  opponent: string;
  wins: number;
  losses: number;
  draws: number;
  last: number;
}

/** Placar contra cada adversário humano (online e por link). */
export function rivals(h = loadHistory()): Rival[] {
  const by = new Map<string, Rival>();
  for (const e of h) {
    if (e.mode !== 'online' && e.mode !== 'mail') continue;
    const r = by.get(e.opponent) ?? { opponent: e.opponent, wins: 0, losses: 0, draws: 0, last: 0 };
    if (e.result === 'win') r.wins++;
    else if (e.result === 'loss') r.losses++;
    else r.draws++;
    r.last = Math.max(r.last, e.at);
    by.set(e.opponent, r);
  }
  return [...by.values()].sort((a, b) => b.last - a.last);
}
