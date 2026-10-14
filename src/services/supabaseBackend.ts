import { createClient, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { fail, ok, type AuthApi, type Backend, type Friend, type FriendRequestResult, type FriendsApi, type Result, type User } from './types';

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

interface ProfileRow {
  id: string;
  name: string;
  color: number;
  friend_code: string;
}

interface FriendshipRow {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
}

class SupabaseFriends implements FriendsApi {
  constructor(
    private sb: SupabaseClient,
    private auth: SupabaseAuth,
  ) {}

  private get me(): string | null {
    return this.auth.current()?.id ?? null;
  }

  available(): boolean {
    return this.me !== null;
  }

  async myCode(): Promise<string | null> {
    if (!this.me) return null;
    const { data } = await this.sb.from('profiles').select('friend_code').eq('id', this.me).single<{ friend_code: string }>();
    return data?.friend_code ?? null;
  }

  async list(): Promise<Friend[]> {
    const me = this.me;
    if (!me) return [];
    const { data: rows } = await this.sb.from('friendships').select('requester, addressee, status').returns<FriendshipRow[]>();
    if (!rows?.length) return [];
    const others = rows.map((r) => (r.requester === me ? r.addressee : r.requester));
    const { data: profiles } = await this.sb.from('profiles').select('id, name, color, friend_code').in('id', others).returns<ProfileRow[]>();
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return rows
      .map((r): Friend | null => {
        const other = r.requester === me ? r.addressee : r.requester;
        const p = byId.get(other);
        if (!p) return null;
        const status = r.status === 'accepted' ? 'accepted' : r.requester === me ? 'outgoing' : 'incoming';
        return { id: p.id, name: p.name, color: p.color, code: p.friend_code, status };
      })
      .filter((f): f is Friend => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async request(code: string): Promise<FriendRequestResult> {
    const { data, error } = await this.sb.rpc('send_friend_request', { code });
    if (error) return 'error';
    return data as FriendRequestResult;
  }

  async accept(id: string): Promise<Result> {
    const me = this.me;
    if (!me) return fail('Entre na sua conta.');
    const { error } = await this.sb.from('friendships').update({ status: 'accepted' }).eq('requester', id).eq('addressee', me);
    return msg(error);
  }

  async remove(id: string): Promise<Result> {
    const me = this.me;
    if (!me) return fail('Entre na sua conta.');
    const { error } = await this.sb
      .from('friendships')
      .delete()
      .or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`);
    return msg(error);
  }
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase';
  readonly sb: SupabaseClient;
  readonly auth: SupabaseAuth;
  readonly friends: SupabaseFriends;
  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    this.auth = new SupabaseAuth(this.sb);
    this.friends = new SupabaseFriends(this.sb, this.auth);
  }
}
