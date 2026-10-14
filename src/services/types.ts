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

export interface Backend {
  /** 'supabase' quando há servidor configurado */
  readonly kind: 'local' | 'supabase';
  readonly auth: AuthApi;
  readonly friends: FriendsApi;
}
