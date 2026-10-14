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

export interface Backend {
  /** 'supabase' quando há servidor configurado */
  readonly kind: 'local' | 'supabase';
  readonly auth: AuthApi;
}
