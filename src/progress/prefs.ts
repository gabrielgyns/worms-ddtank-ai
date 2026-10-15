import { store } from '../services/store';

/** Preferências deste aparelho (não sobem para a conta). */
export interface Prefs {
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
  /** segundos por turno nas partidas que eu crio */
  turnTime: 20 | 30 | 45 | 60;
  /** quanto acelera a partida durante a vez da CPU (só offline) */
  cpuSpeed: 1 | 1.6 | 2.5;
  shake: boolean;
  /** símbolos por time além da cor */
  colorblind: boolean;
  /** visual: clássico (Canvas 2D) ou novo (GPU) */
  gfx: 'classic' | 'gpu';
  /** vozes de balbucio nas falas */
  voices: boolean;
}

export const DEFAULT_PREFS: Prefs = { music: 0.7, sfx: 0.8, turnTime: 30, cpuSpeed: 1, shake: true, colorblind: false, gfx: 'gpu', voices: true };

export function loadPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...store.get<Partial<Prefs>>('prefs', {}) };
}

export function savePrefs(p: Prefs): void {
  store.set('prefs', p);
}
