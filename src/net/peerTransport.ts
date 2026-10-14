import Peer, { type DataConnection } from 'peerjs';
import type { Transport } from './transport';

const PREFIX = 'bolotas-sala-';

/**
 * WebRTC ponto a ponto via PeerJS. O servidor público do PeerJS só apresenta
 * os dois navegadores; depois a conversa vai direto entre eles.
 */
export class PeerTransport implements Transport {
  readonly kind = 'peer';
  private peer: Peer;
  private conn: DataConnection | null = null;
  private msgFns: Array<(m: unknown) => void> = [];
  private errFns: Array<(r: string) => void> = [];
  private connectFns: Array<() => void> = [];
  private closed = false;

  constructor(
    private code: string,
    private role: 'host' | 'guest',
  ) {
    this.peer = role === 'host' ? new Peer(PREFIX + code) : new Peer();
    this.peer.on('open', () => {
      if (role === 'guest') this.dial();
    });
    this.peer.on('connection', (c) => {
      if (role !== 'host') return;
      // reconexão do convidado substitui a conexão antiga
      this.conn?.close();
      this.attach(c);
    });
    this.peer.on('disconnected', () => {
      if (!this.closed) this.peer.reconnect();
    });
    this.peer.on('error', (err) => {
      const type = (err as { type?: string }).type;
      const reason =
        type === 'unavailable-id'
          ? 'room-taken'
          : type === 'peer-unavailable'
            ? 'room-not-found'
            : type === 'network' || type === 'server-error' || type === 'socket-error'
              ? 'network'
              : (type ?? 'unknown');
      for (const fn of this.errFns) fn(reason);
    });
  }

  /** Convidado: (re)liga para o host. */
  dial(): void {
    if (this.closed || this.role !== 'guest') return;
    const c = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.attach(c);
  }

  private attach(c: DataConnection): void {
    this.conn = c;
    c.on('open', () => {
      for (const fn of this.connectFns) fn();
    });
    c.on('data', (d) => {
      for (const fn of this.msgFns) fn(d);
    });
  }

  send(msg: unknown): void {
    if (this.conn?.open) void this.conn.send(msg);
  }
  onMessage(fn: (m: unknown) => void): void {
    this.msgFns.push(fn);
  }
  onError(fn: (r: string) => void): void {
    this.errFns.push(fn);
  }
  onConnect(fn: () => void): void {
    this.connectFns.push(fn);
  }
  reconnect(): void {
    if (this.peer.disconnected) this.peer.reconnect();
    else this.dial();
  }
  close(): void {
    this.closed = true;
    this.conn?.close();
    this.peer.destroy();
  }
}
