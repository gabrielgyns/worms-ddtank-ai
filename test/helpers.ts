import { AiController, type Difficulty } from '../src/domain/ai';
import { Match, type TeamSetup } from '../src/domain/match';
import { THEMES } from '../src/domain/theme';

export const DT = 1 / 60;

export function cpuTeam(name: string): TeamSetup {
  return { name, color: '#f80', light: '#fc8', dark: '#a40', control: 'cpu', names: ['A', 'B', 'C', 'D'] };
}

export function newMatch(seed = 1, unitsPerTeam = 3): Match {
  return new Match({ teams: [cpuTeam('A'), cpuTeam('B')], unitsPerTeam, theme: THEMES.prado, seed, turnTime: 30 });
}

/** Roda CPU x CPU até acabar (ou o limite de tempo de jogo). */
export function playOut(m: Match, maxSeconds = 60 * 25, levels: Difficulty[] = ['normal', 'dificil']): number {
  const ais = levels.map((d) => new AiController(d));
  m.start();
  let t = 0;
  while (m.phase !== 'over' && t < maxSeconds) {
    const team = m.activeTeam;
    m.step(team ? ais[team.id].decide(m) : {});
    t += DT;
  }
  return t;
}
