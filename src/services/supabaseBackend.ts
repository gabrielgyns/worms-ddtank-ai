import { createClient, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { fail, ok, type AuthApi, type Backend, type Result, type User } from './types';

function toUser(u: SbUser | null | undefined): User | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? null, guest: !!u.is_anonymous };
}

const msg = (e: { message?: string } | null): Result => (e ? fail(e.message ?? 'Erro desconhecido') : ok);

/** Volta para a mesma página depois do link mágico / Google. */
const redirectTo = (): string => location.href.split('#')[0];

class SupabaseAuth implements AuthApi {
  private user: User | null = null;
  private fns: Array<(u: User | null) => void> = [];

  constructor(private sb: SupabaseClient) {
    void sb.auth.getSession().then(({ data }) => this.set(toUser(data.session?.user)));
    sb.auth.onAuthStateChange((_ev, session) => this.set(toUser(session?.user)));
  }

  private set(u: User | null): void {
    this.user = u;
    for (const fn of this.fns) fn(u);
  }

  current(): User | null {
    return this.user;
  }
  onChange(fn: (u: User | null) => void): void {
    this.fns.push(fn);
    fn(this.user);
  }
  async signInEmail(email: string): Promise<Result> {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    return msg(error);
  }
  async signInGoogle(): Promise<Result> {
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    return msg(error);
  }
  async signInGuest(): Promise<Result> {
    const { error } = await this.sb.auth.signInAnonymously();
    return msg(error);
  }
  async upgradeEmail(email: string): Promise<Result> {
    const { error } = await this.sb.auth.updateUser({ email }, { emailRedirectTo: redirectTo() });
    return msg(error);
  }
  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase';
  readonly sb: SupabaseClient;
  readonly auth: SupabaseAuth;
  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    this.auth = new SupabaseAuth(this.sb);
  }
}
