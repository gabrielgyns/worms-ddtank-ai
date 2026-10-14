import { Rng } from '../core/math';
import type { ThemeId } from '../domain/theme';
import { store } from '../services/store';
import { today } from './shop';
import type { TeamMatchStats } from './tracker';

/** Desafio do dia: mesmo mapa, mesmo tema e mesmos ventos para todo mundo. */
export interface DailySpec {
  day: string;
  seed: number;
  themeId: ThemeId;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function dailySpec(day = today()): DailySpec {
  const seed = hash(`desafio-${day}`) & 0x7fffffff;
  const themes: ThemeId[] = ['prado', 'deserto', 'neve', 'doce'];
  return { day, seed, themeId: themes[new Rng(seed).int(0, themes.length - 1)] };
}

/** Pontos: dano + eliminações + vitória, menos um pouco por turno usado. */
export function dailyScore(s: TeamMatchStats, won: boolean, turns: number): number {
  return Math.max(0, Math.round(s.damage + s.kills * 50 + (won ? 300 : 0) - turns * 5));
}

export interface DailyBest {
  day: string;
  score: number;
  won: boolean;
  attempts: number;
}

export function loadDailyBest(day = today()): DailyBest | null {
  const b = store.get<DailyBest | null>('daily', null);
  return b && b.day === day ? b : null;
}

/** Guarda a tentativa; devolve se foi recorde e se foi a primeira do dia. */
export function saveDailyAttempt(score: number, won: boolean, day = today()): { record: boolean; first: boolean } {
  const prev = loadDailyBest(day);
  const record = !prev || score > prev.score;
  const next: DailyBest = {
    day,
    score: record ? score : prev!.score,
    won: record ? won : prev!.won,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  store.set('daily', next);
  return { record, first: !prev };
}
