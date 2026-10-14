import { isNetMsg, PROTOCOL_VERSION, type MsgOf, type NetMsg } from './protocol';
import type { Role } from './room';
import type { Transport } from './transport';

const PING_EVERY = 1000;
const DEAD_AFTER = 4500;

type Handler<T extends NetMsg['t']> = (m: MsgOf<T>) => void;

/**
 * Conversa tipada sobre um Transport: aperto de mão com versão,
 * ping/pong para medir atraso e saber se o outro lado sumiu.
 */
export class Link {
  private handlers = new Map<string, Array<(m: NetMsg) => void>>();
  private lastSeen = 0;
  private timer: ReturnType<typeof setInterval>;
  rtt = 0;
  alive = false;
  /** aperto de mão concluído */
  ready = false;
  private aliveFns: Array<(alive: boolean) => void> = [];
  private failFns: Array<(reason: string) => void> = [];

  constructor(
    readonly transport: Transport,
    readonly role: Role,
    readonly pid: string,
    name: () => string,
  ) {
    transport.onMessage((raw) => {
      if (!isNetMsg(raw)) return;
      this.touch();
      this.dispatch(raw);
    });
    transport.onConnect(() => {
      this.touch();
      if (role === 'guest') this.send({ t: 'hello', v: PROTOCOL_VERSION, pid, name: name() });
    });
    this.on('ping', (m) => this.send({ t: 'pong', at: m.at }));
    this.on('pong', (m) => (this.rtt = performance.now() - m.at));
    this.on('hello', (m) => {
      const ok = m.v === PROTOCOL_VERSION;
      this.send({ t: 'welcome', v: PROTOCOL_VERSION, ok, reason: ok ? undefined : 'version' });
      if (ok) this.ready = true;
    });
    this.on('welcome', (m) => {
      if (m.ok) this.ready = true;
      else for (const fn of this.failFns) fn(m.reason ?? 'version');
    });
    this.on('bye', () => this.setAlive(false));
    this.timer = setInterval(() => {
      this.send({ t: 'ping', at: performance.now() });
      if (this.alive && performance.now() - this.lastSeen > DEAD_AFTER) this.setAlive(false);
    }, PING_EVERY);
    addEventListener('pagehide', this.onLeave);
  }

  private onLeave = (): void => this.send({ t: 'bye' });

  private touch(): void {
    this.lastSeen = performance.now();
    this.setAlive(true);
  }

  private setAlive(a: boolean): void {
    if (this.alive === a) return;
    this.alive = a;
    for (const fn of this.aliveFns) fn(a);
  }

  private dispatch(m: NetMsg): void {
    for (const fn of this.handlers.get(m.t) ?? []) fn(m);
  }

  on<T extends NetMsg['t']>(type: T, fn: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as (m: NetMsg) => void);
    this.handlers.set(type, list);
  }

  onAlive(fn: (alive: boolean) => void): void {
    this.aliveFns.push(fn);
  }

  /** Falha de aperto de mão (versões diferentes). */
  onFail(fn: (reason: string) => void): void {
    this.failFns.push(fn);
  }

  send(m: NetMsg): void {
    this.transport.send(m);
  }

  close(): void {
    this.send({ t: 'bye' });
    clearInterval(this.timer);
    removeEventListener('pagehide', this.onLeave);
    this.transport.close();
  }
}

/** Id estável do jogador nesta aba, para reconectar na mesma vaga. */
export function playerId(): string {
  try {
    let id = sessionStorage.getItem('bolotas-pid');
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('bolotas-pid', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}
