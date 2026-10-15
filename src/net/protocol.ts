import type { Command, TickInput } from '../domain/commands';
import type { MatchSnapshot, TeamSetup } from '../domain/match';
import type { ThemeId } from '../domain/theme';
import type { Look } from '../domain/cosmetics';

/** Suba quando mudar mensagens ou regras que afetem a simulação. */
export const PROTOCOL_VERSION = 3;

/** MatchSetup em forma de JSON (tema por id). */
export interface WireSetup {
  teams: TeamSetup[];
  unitsPerTeam: number;
  themeId: ThemeId;
  seed: number;
  turnTime: number;
  crates?: boolean;
  suddenDeath?: number;
  bossHp?: number;
  objects?: boolean;
  map?: string;
}

export interface LobbyPlayer {
  name: string;
  color: number;
  ready: boolean;
  connected: boolean;
  look?: Look;
}

export interface LobbyState {
  host: LobbyPlayer;
  guest: LobbyPlayer | null;
  units: number;
  themeId: ThemeId | 'random';
  /** duelo (um contra o outro), chefão (juntos contra o Rei Bolotão) ou 2x2 (dupla em cada aparelho) */
  mode?: 'duel' | 'boss' | 'duo';
  /** nome do mapa desenhado escolhido pelo host (o mapa vai no setup) */
  mapName?: string;
}

/**
 * Mensagens entre host e convidado.
 * O host é o relógio da partida: decide em que tick cada entrada é aplicada.
 */
export type NetMsg =
  // conexão
  | { t: 'hello'; v: number; pid: string; name: string }
  | { t: 'welcome'; v: number; ok: boolean; reason?: string }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'bye' }
  // sala
  | { t: 'lobby'; state: LobbyState }
  | { t: 'me'; name: string; color: number; ready: boolean; look?: Look }
  | { t: 'start'; setup: WireSetup; guestTeam: number; guestTeams?: number[]; rejoin?: boolean }
  // partida (lockstep)
  | { t: 'frame'; upTo: number; cmds: Command[] }
  | { t: 'input'; input: TickInput }
  | { t: 'sum'; turn: number; tick: number; sum: number }
  | { t: 'resyncReq' }
  | { t: 'resync'; snap: MatchSnapshot; log: Command[] }
  // diversão
  | { t: 'emote'; id: string; team: number };

export type MsgOf<T extends NetMsg['t']> = Extract<NetMsg, { t: T }>;

export function isNetMsg(x: unknown): x is NetMsg {
  return typeof x === 'object' && x !== null && typeof (x as { t?: unknown }).t === 'string';
}
