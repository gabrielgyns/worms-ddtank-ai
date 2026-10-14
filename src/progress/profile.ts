import { store } from '../services/store';
import type { WeaponId } from '../domain/weapons';
import type { TeamMatchStats } from './tracker';

export interface Profile {
  name: string;
  teamName: string;
  /** índice em TEAM_COLORS */
  color: number;
}

export interface LifetimeStats {
  games: number;
  wins: number;
  losses: number;
  damage: number;
  kills: number;
  shots: number;
  hits: number;
  longestShot: number;
  weapons: Partial<Record<WeaponId, number>>;
}

export const DEFAULT_PROFILE: Profile = { name: 'Jogador', teamName: 'Laranjinhas', color: 0 };

export function loadProfile(): Profile {
  return { ...DEFAULT_PROFILE, ...store.get<Partial<Profile>>('profile', {}) };
}

export function saveProfile(p: Profile): void {
  store.set('profile', p);
  // o lobby online usa o nome salvo
  try {
    localStorage.setItem('bolotas-name', p.name);
  } catch {
    // sem storage
  }
}

export function loadStats(): LifetimeStats {
  return store.get<LifetimeStats>('stats', { games: 0, wins: 0, losses: 0, damage: 0, kills: 0, shots: 0, hits: 0, longestShot: 0, weapons: {} });
}

export function addMatchToStats(m: TeamMatchStats, won: boolean): LifetimeStats {
  const s = loadStats();
  s.games++;
  if (won) s.wins++;
  else s.losses++;
  s.damage += m.damage;
  s.kills += m.kills;
  s.shots += m.shots;
  s.hits += m.hits;
  s.longestShot = Math.max(s.longestShot, m.longestShot);
  for (const [w, n] of Object.entries(m.weapons)) s.weapons[w as WeaponId] = (s.weapons[w as WeaponId] ?? 0) + (n ?? 0);
  store.set('stats', s);
  return s;
}

export function favoriteWeapon(s: LifetimeStats): WeaponId | null {
  let best: WeaponId | null = null;
  let n = 0;
  for (const [w, c] of Object.entries(s.weapons)) {
    if ((c ?? 0) > n) {
      n = c ?? 0;
      best = w as WeaponId;
    }
  }
  return best;
}
