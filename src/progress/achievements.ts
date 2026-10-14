import type { LifetimeStats } from './profile';
import type { TeamMatchStats } from './tracker';

export type Rarity = 'facil' | 'media' | 'dificil' | 'lendaria';
export type MatchMode = 'cpu' | 'local' | 'online' | 'mail';

export interface Reward {
  coins?: number;
  item?: string;
}

/** O que a conquista pode olhar ao fim de uma partida. */
export interface AchievementContext {
  stats: TeamMatchStats;
  won: boolean;
  mode: MatchMode;
  difficulty: 'facil' | 'normal' | 'dificil' | null;
  unitsPerTeam: number;
  career: LifetimeStats;
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  reward: Reward;
  check(c: AchievementContext): boolean;
}

export const RARITY_NAME: Record<Rarity, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil', lendaria: 'Lendária' };

/** Catálogo de conquistas. Para criar uma nova, é só adicionar aqui. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'primeiro-bum', name: 'Primeiro Bum', desc: 'Cause dano pela primeira vez.', rarity: 'facil', reward: { coins: 50 }, check: (c) => c.stats.damage > 0 },
  { id: 'primeira-vitoria', name: 'Primeira Vitória', desc: 'Vença uma partida.', rarity: 'facil', reward: { coins: 100 }, check: (c) => c.won },
  { id: 'banho-frio', name: 'Banho Frio', desc: 'Derrube um inimigo na água.', rarity: 'facil', reward: { item: 'hat-boia' }, check: (c) => c.stats.drowns > 0 },
  { id: 'ninguem-viu', name: 'Ninguém Viu', desc: 'Acerte a si mesmo (ou um aliado).', rarity: 'facil', reward: { item: 'grave-ops' }, check: (c) => c.stats.selfDamage > 0 },
  { id: 'conexao', name: 'Conexão', desc: 'Termine uma partida online.', rarity: 'facil', reward: { coins: 100 }, check: (c) => c.mode === 'online' },
  { id: 'carteiro', name: 'Carteiro', desc: 'Termine uma partida por link.', rarity: 'media', reward: { coins: 150 }, check: (c) => c.mode === 'mail' },
  { id: 'atirador', name: 'Atirador de Elite', desc: 'Acerte um inimigo a mais de 120 m.', rarity: 'media', reward: { item: 'aim-gold' }, check: (c) => c.stats.longestShot >= 1200 },
  { id: 'contra-vento', name: 'Contra o Vento', desc: 'Acerte com vento 8 ou mais contra.', rarity: 'media', reward: { item: 'trail-leaves' }, check: (c) => c.stats.againstWind },
  { id: 'dois-coelhos', name: 'Dois Coelhos', desc: 'Atinja 2 inimigos num único turno.', rarity: 'media', reward: { coins: 200 }, check: (c) => c.stats.multiHit >= 2 },
  { id: 'veterano', name: 'Veterano', desc: 'Jogue 25 partidas.', rarity: 'media', reward: { coins: 300 }, check: (c) => c.career.games >= 25 },
  { id: 'strike', name: 'Strike!', desc: 'Elimine 3 bolotas num único turno.', rarity: 'dificil', reward: { item: 'boom-confetti' }, check: (c) => c.stats.multiKill >= 3 },
  { id: 'intocavel', name: 'Intocável', desc: 'Vença sem perder nenhuma bolota.', rarity: 'dificil', reward: { item: 'hat-crown' }, check: (c) => c.won && c.stats.lost === 0 && c.mode !== 'local' },
  {
    id: 'granadeiro',
    name: 'Granadeiro',
    desc: 'Vença usando só granadas.',
    rarity: 'dificil',
    reward: { item: 'skin-abacaxi' },
    check: (c) => c.won && c.stats.shots > 0 && c.stats.weapons.grenade === c.stats.shots,
  },
  { id: 'davi-golias', name: 'Davi e Golias', desc: 'Vença depois de ficar com 1 bolota contra 4.', rarity: 'lendaria', reward: { item: 'title-lenda' }, check: (c) => c.won && c.stats.underdog },
  {
    id: 'sem-ar',
    name: 'Sem Ar',
    desc: 'Vença a CPU no Difícil sem levar dano dela.',
    rarity: 'lendaria',
    reward: { item: 'skin-ouro' },
    check: (c) => c.won && c.mode === 'cpu' && c.difficulty === 'dificil' && c.stats.damageTaken === 0,
  },
];

/** Quais conquistas novas esta partida desbloqueia. */
export function evaluate(c: AchievementContext, unlocked: Record<string, number>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.check(c));
}
