import { store } from './store';
import { fail, ok, type AuthApi, type Backend, type Result, type User } from './types';

const NO_SERVER = 'Contas online ainda não estão ligadas neste jogo. Seu progresso fica salvo neste aparelho.';

/** Sem servidor: um perfil convidado deste aparelho. */
class LocalAuth implements AuthApi {
  private user: User;
  constructor() {
    let id = store.get<string | null>('local-id', null);
    if (!id) {
      id = `local-${Math.random().toString(36).slice(2, 10)}`;
      store.set('local-id', id);
    }
    this.user = { id, email: null, guest: true };
  }
  current(): User {
    return this.user;
  }
  onChange(fn: (u: User | null) => void): void {
    fn(this.user);
  }
  async signInEmail(): Promise<Result> {
    return fail(NO_SERVER);
  }
  async signInGoogle(): Promise<Result> {
    return fail(NO_SERVER);
  }
  async signInGuest(): Promise<Result> {
    return ok;
  }
  async upgradeEmail(): Promise<Result> {
    return fail(NO_SERVER);
  }
  async signOut(): Promise<void> {
    // perfil local não sai
  }
}

export class LocalBackend implements Backend {
  readonly kind = 'local';
  readonly auth = new LocalAuth();
}
