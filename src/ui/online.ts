import { ERROR_TEXT, Room, type TransportKind } from '../net/room';
import { codeFromUrl, inviteLink, normalizeCode } from '../net/transport';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

export interface OnlineHooks {
  show(screen: string | null): void;
  /** sala aberta e o outro lado conectado */
  onRoom(room: Room): void;
}

/** Telas "Jogar online" e "Sala": criar, entrar, compartilhar o link. */
export class OnlineUi {
  room: Room | null = null;

  constructor(private hooks: OnlineHooks) {
    $('#online-btn').addEventListener('click', () => this.open());
    $('#online-back').addEventListener('click', () => hooks.show('menu'));
    $('#create-room').addEventListener('click', () => this.create());
    $('#join-room').addEventListener('click', () => this.joinTyped());
    $('#join-code').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.joinTyped();
    });
    $('#lobby-leave').addEventListener('click', () => this.leave());
    $('#copy-link').addEventListener('click', () => this.copy());
    const share = $('#share-link');
    if ('share' in navigator) share.hidden = false;
    share.addEventListener('click', () => {
      if (!this.room) return;
      void navigator.share?.({ title: 'Bolotas em Guerra', text: `Bora uma partida? Sala ${this.room.code}`, url: inviteLink(this.room.code) }).catch(() => undefined);
    });
  }

  private kind(): TransportKind {
    return ($('#local-net') as HTMLInputElement).checked || location.search.includes('local') ? 'local' : 'peer';
  }

  open(): void {
    $('#online-error').hidden = true;
    this.hooks.show('online');
  }

  /** Abriu o jogo por um link de convite? Entra direto. */
  autoJoin(): boolean {
    let code = codeFromUrl();
    if (!code) {
      // recarregou a página no meio de uma sala como convidado
      try {
        code = sessionStorage.getItem('bolotas-guest-room');
      } catch {
        code = null;
      }
    }
    if (!code) return false;
    history.replaceState(null, '', location.pathname + location.search);
    this.join(code);
    return true;
  }

  /** Cria uma sala (host) e devolve o código. */
  create(): string {
    this.leave(false);
    const room = Room.create(this.kind());
    this.enter(room);
    this.status('Esperando alguém entrar… mande o link!');
    return room.code;
  }

  private joinTyped(): void {
    const code = normalizeCode(($('#join-code') as HTMLInputElement).value);
    if (!code) {
      this.error('O código tem 4 letras.');
      return;
    }
    this.join(code);
  }

  join(code: string): void {
    this.leave(false);
    const room = Room.join(this.kind(), code);
    try {
      sessionStorage.setItem('bolotas-guest-room', code);
    } catch {
      // sem storage: só não volta sozinho se recarregar
    }
    this.enter(room);
    this.status('Entrando na sala…');
  }

  private enter(room: Room): void {
    this.room = room;
    $('#room-code').textContent = room.code;
    ($('#room-link') as HTMLInputElement).value = inviteLink(room.code);
    $('#lobby-body').innerHTML = '';
    room.transport.onError((reason) => {
      if (this.room !== room) return;
      this.leave(false);
      this.hooks.show('online');
      this.error(ERROR_TEXT[reason] ?? `Não deu para conectar (${reason}).`);
    });
    room.link.onFail((reason) => {
      if (this.room !== room) return;
      this.leave(false);
      this.hooks.show('online');
      this.error(ERROR_TEXT[reason] ?? reason);
    });
    let announced = false;
    const connected = () => {
      if (this.room !== room || announced) return;
      announced = true;
      this.status(room.role === 'host' ? 'Alguém entrou na sala!' : 'Conectado!', true);
      this.hooks.onRoom(room);
    };
    room.link.on('hello', connected);
    room.link.on('welcome', (m) => m.ok && connected());
    room.link.onAlive((alive) => {
      if (this.room !== room || !announced) return;
      this.status(alive ? 'Conectado!' : 'O outro jogador caiu… esperando voltar.', alive);
    });
    this.hooks.show('lobby');
  }

  status(text: string, ok = false): void {
    const el = $('#lobby-status');
    el.textContent = text;
    el.classList.toggle('ok', ok);
  }

  private error(text: string): void {
    const el = $('#online-error');
    el.textContent = text;
    el.hidden = false;
  }

  private async copy(): Promise<void> {
    const input = $('#room-link') as HTMLInputElement;
    try {
      await navigator.clipboard.writeText(input.value);
      $('#copy-link').textContent = 'Copiado!';
      setTimeout(() => ($('#copy-link').textContent = 'Copiar'), 1500);
    } catch {
      input.select();
    }
  }

  leave(toMenu = true): void {
    try {
      sessionStorage.removeItem('bolotas-guest-room');
    } catch {
      // nada
    }
    this.room?.close();
    this.room = null;
    if (toMenu) this.hooks.show('menu');
  }
}
