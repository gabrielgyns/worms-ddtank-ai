import { MISSIONS } from '../domain/missions';
import { store } from '../services/store';

/** Melhor resultado de cada missão (estrelas 1–3). */
export type MissionStars = Record<string, number>;

/** Moedas pela primeira vez que completa cada missão. */
export const MISSION_REWARD = 60;

export function loadMissionStars(): MissionStars {
  return store.get<MissionStars>('missions', {});
}

/** A missão abre quando a anterior foi cumprida (a primeira já vem aberta). */
export function missionUnlocked(index: number, stars = loadMissionStars()): boolean {
  return index === 0 || (stars[MISSIONS[index - 1].id] ?? 0) > 0;
}

/** Guarda o resultado; devolve se foi a primeira vez e se melhorou. */
export function saveMissionResult(id: string, stars: number): { first: boolean; better: boolean } {
  const all = loadMissionStars();
  const prev = all[id] ?? 0;
  if (stars > prev) {
    all[id] = stars;
    store.set('missions', all);
  }
  return { first: prev === 0 && stars > 0, better: stars > prev };
}

export function totalMissionStars(stars = loadMissionStars()): number {
  return MISSIONS.reduce((n, m) => n + (stars[m.id] ?? 0), 0);
}
