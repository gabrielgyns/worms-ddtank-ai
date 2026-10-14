import { createClient, type RealtimeChannel, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import {
  fail,
  ok,
  type AuthApi,
  type Backend,
  type Friend,
  type FriendRequestResult,
  type FriendsApi,
  type Invite,
  type PresenceApi,
  type PresenceStatus,
  type MatchReport,
  type ProfileApi,
  type ProgressSyncApi,
  type SyncedProgress,
  type RemoteProfile,
  type Result,
  type User,
} from './types';

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

/**
 * Presença via Realtime: um canal global onde cada jogador logado "aparece"
 * com seu status, e uma caixa de entrada pessoal para convites.
 */
class SupabasePresence implements PresenceApi {
  private global: RealtimeChannel | null = null;
  private inbox: RealtimeChannel | null = null;
  private state = new Map<string, PresenceStatus>();
  private mine: PresenceStatus = 'online';
  private name = 'Jogador';
  private changeFns: Array<() => void> = [];
  private inviteFns: Array<(i: Invite) => void> = [];

  constructor(
    private sb: SupabaseClient,
    private auth: SupabaseAuth,
  ) {
    auth.onChange((u) => void this.connect(u));
  }

  private async connect(u: User | null): Promise<void> {
    if (this.global) await this.sb.removeChannel(this.global);
    if (this.inbox) await this.sb.removeChannel(this.inbox);
    this.global = this.inbox = null;
    this.state.clear();
    this.emit();
    if (!u) return;
    const { data } = await this.sb.from('profiles').select('name').eq('id', u.id).single<{ name: string }>();
    this.name = data?.name ?? 'Jogador';

    const global = this.sb.channel('presenca', { config: { presence: { key: u.id } } });
    global
      .on('presence', { event: 'sync' }, () => {
        this.state.clear();
        const st = global.presenceState<{ status: PresenceStatus }>();
        for (const [id, metas] of Object.entries(st)) {
          const playing = metas.some((m) => m.status === 'playing');
          this.state.set(id, playing ? 'playing' : 'online');
        }
        this.emit();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void global.track({ status: this.mine });
      });
    this.global = global;

    const inbox = this.sb.channel(`convites:${u.id}`);
    inbox
      .on('broadcast', { event: 'invite' }, ({ payload }) => {
        const inv = payload as Invite;
        if (typeof inv?.room === 'string') for (const fn of this.inviteFns) fn(inv);
      })
      .subscribe();
    this.inbox = inbox;
  }

  private emit(): void {
    for (const fn of this.changeFns) fn();
  }

  available(): boolean {
    return this.auth.current() !== null;
  }
  setStatus(s: PresenceStatus): void {
    this.mine = s;
    void this.global?.track({ status: s });
  }
  status(id: string): PresenceStatus | null {
    return this.state.get(id) ?? null;
  }
  onChange(fn: () => void): void {
    this.changeFns.push(fn);
  }
  async invite(friendId: string, room: string): Promise<Result> {
    const me = this.auth.current();
    if (!me) return fail('Entre na sua conta.');
    const ch = this.sb.channel(`convites:${friendId}`);
    await new Promise<void>((resolve) => ch.subscribe((s) => (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && resolve()));
    const r = await ch.send({ type: 'broadcast', event: 'invite', payload: { fromId: me.id, fromName: this.name, room } satisfies Invite });
    await this.sb.removeChannel(ch);
    return r === 'ok' ? ok : fail('Não deu para mandar o convite.');
  }
  onInvite(fn: (i: Invite) => void): void {
    this.inviteFns.push(fn);
  }
}

class SupabaseProfile implements ProfileApi {
  constructor(
    private sb: SupabaseClient,
    private auth: SupabaseAuth,
  ) {}

  async load(): Promise<RemoteProfile | null> {
    const me = this.auth.current();
    if (!me) return null;
    const { data } = await this.sb
      .from('profiles')
      .select('name, team_name, color')
      .eq('id', me.id)
      .single<{ name: string; team_name: string; color: number }>();
    return data ? { name: data.name, teamName: data.team_name, color: data.color } : null;
  }

  async save(p: RemoteProfile): Promise<Result> {
    const me = this.auth.current();
    if (!me) return ok; // sem conta: fica só no aparelho
    const { error } = await this.sb.from('profiles').update({ name: p.name, team_name: p.teamName, color: p.color }).eq('id', me.id);
    return msg(error);
  }

  async reportMatch(r: MatchReport): Promise<Result> {
    if (!this.auth.current()) return ok;
    const { error } = await this.sb.rpc('report_match', {
      p_key: r.key,
      p_mode: r.mode,
      p_theme: r.theme,
      p_team: r.team,
      p_result: r.result,
      p_damage: r.damage,
      p_kills: r.kills,
      p_shots: r.shots,
      p_hits: r.hits,
      p_longest: r.longestShot,
    });
    return msg(error);
  }
}

class SupabaseProgress implements ProgressSyncApi {
  constructor(
    private sb: SupabaseClient,
    private auth: SupabaseAuth,
  ) {}

  async pull(): Promise<SyncedProgress | null> {
    const me = this.auth.current();
    if (!me) return null;
    const { data } = await this.sb
      .from('progress')
      .select('coins, unlocked, owned, equipped, chests_opened, updated_at')
      .eq('user_id', me.id)
      .maybeSingle<{
        coins: number;
        unlocked: Record<string, number>;
        owned: string[];
        equipped: Record<string, string>;
        chests_opened: number;
        updated_at: number;
      }>();
    if (!data) return null;
    return {
      coins: data.coins,
      unlocked: data.unlocked,
      owned: data.owned,
      equipped: data.equipped,
      chestsOpened: data.chests_opened,
      updatedAt: Number(data.updated_at),
    };
  }

  async push(p: SyncedProgress): Promise<Result> {
    const me = this.auth.current();
    if (!me) return ok;
    const { error } = await this.sb.from('progress').upsert({
      user_id: me.id,
      coins: p.coins,
      unlocked: p.unlocked,
      owned: p.owned,
      equipped: p.equipped,
      chests_opened: p.chestsOpened,
      updated_at: p.updatedAt,
    });
    return msg(error);
  }
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase';
  readonly sb: SupabaseClient;
  readonly auth: SupabaseAuth;
  readonly friends: SupabaseFriends;
  readonly presence: SupabasePresence;
  readonly profile: SupabaseProfile;
  readonly progress: SupabaseProgress;
  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    this.auth = new SupabaseAuth(this.sb);
    this.friends = new SupabaseFriends(this.sb, this.auth);
    this.presence = new SupabasePresence(this.sb, this.auth);
    this.profile = new SupabaseProfile(this.sb, this.auth);
    this.progress = new SupabaseProgress(this.sb, this.auth);
  }
}
