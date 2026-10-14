/**
 * Serviços "de conta" do jogo. Duas implementações:
 * - local: guarda tudo neste aparelho (funciona sem configuração);
 * - supabase: contas reais, amigos, presença e ranking compartilhados.
 */

export type Result = { ok: true } | { ok: false; error: string };

export const ok: Result = { ok: true };
export const fail = (error: string): Result => ({ ok: false, error });

export interface User {
  id: string;
  email: string | null;
  /** conta convidado (sem e-mail); pode virar conta de verdade depois */
  guest: boolean;
}

export interface AuthApi {
  current(): User | null;
  onChange(fn: (u: User | null) => void): void;
  /** link mágico por e-mail */
  signInEmail(email: string): Promise<Result>;
  signInGoogle(): Promise<Result>;
  signInGuest(): Promise<Result>;
  /** convidado vira conta de verdade, mantendo o progresso */
  upgradeEmail(email: string): Promise<Result>;
  signOut(): Promise<void>;
}

export interface Friend {
  id: string;
  name: string;
  color: number;
  code: string;
  /** accepted = amigos; incoming = pediu para mim; outgoing = eu pedi */
  status: 'accepted' | 'incoming' | 'outgoing';
}

export type FriendRequestResult = 'sent' | 'accepted' | 'already_sent' | 'already_friends' | 'not_found' | 'self' | 'error';

export interface FriendsApi {
  /** precisa de servidor e de estar logado */
  available(): boolean;
  myCode(): Promise<string | null>;
  list(): Promise<Friend[]>;
  request(code: string): Promise<FriendRequestResult>;
  accept(id: string): Promise<Result>;
  remove(id: string): Promise<Result>;
}

export type PresenceStatus = 'online' | 'playing';

export interface Invite {
  fromId: string;
  fromName: string;
  room: string;
}

export interface PresenceApi {
  available(): boolean;
  setStatus(s: PresenceStatus): void;
  /** quem está online agora (id → status) */
  status(id: string): PresenceStatus | null;
  onChange(fn: () => void): void;
  invite(friendId: string, room: string): Promise<Result>;
  onInvite(fn: (inv: Invite) => void): void;
}

export interface RemoteProfile {
  name: string;
  teamName: string;
  color: number;
}

export interface MatchReport {
  key: string;
  mode: 'online' | 'mail';
  theme: string;
  team: number;
  result: 'win' | 'loss' | 'draw';
  damage: number;
  kills: number;
  shots: number;
  hits: number;
  longestShot: number;
}

/** Perfil e histórico no servidor (no modo local, tudo fica no aparelho). */
export interface ProfileApi {
  load(): Promise<RemoteProfile | null>;
  save(p: RemoteProfile): Promise<Result>;
  reportMatch(r: MatchReport): Promise<Result>;
  /** rating Elo (só com servidor e partidas online relatadas pelos dois) */
  rating(): Promise<{ rating: number; games: number } | null>;
}

/** Espelho do progresso no servidor (formato igual ao do aparelho). */
export interface SyncedProgress {
  coins: number;
  unlocked: Record<string, number>;
  owned: string[];
  equipped: Record<string, string>;
  chestsOpened: number;
  updatedAt: number;
}

export interface ProgressSyncApi {
  pull(): Promise<SyncedProgress | null>;
  push(p: SyncedProgress): Promise<Result>;
}

export interface LeaderRow {
  id: string;
  name: string;
  color: number;
  rating: number;
  games: number;
  wins: number;
}

export interface HeadToHead {
  wins: number;
  losses: number;
  draws: number;
}

export interface RankingApi {
  available(): boolean;
  leaderboard(period: 'all' | 'week'): Promise<LeaderRow[]>;
  headToHead(friendId: string): Promise<HeadToHead | null>;
}

export interface DailyRow {
  id: string;
  name: string;
  color: number;
  score: number;
  won: boolean;
  attempts: number;
}

export interface DailyApi {
  available(): boolean;
  submit(day: string, score: number, won: boolean): Promise<Result>;
  board(day: string): Promise<DailyRow[]>;
}

export interface Backend {
  /** 'supabase' quando há servidor configurado */
  readonly kind: 'local' | 'supabase';
  readonly auth: AuthApi;
  readonly friends: FriendsApi;
  readonly presence: PresenceApi;
  readonly profile: ProfileApi;
  readonly progress: ProgressSyncApi;
  readonly ranking: RankingApi;
  readonly daily: DailyApi;
}
