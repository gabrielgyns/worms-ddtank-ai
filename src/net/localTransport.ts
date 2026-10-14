import type { Transport } from './transport';

/**
 * Duas abas do mesmo navegador conversando por BroadcastChannel.
 * Serve para testar o online sem internet e para jogar em duas janelas.
 */
export class LocalTransport implements Transport {
  readonly kind = 'local';
  private ch: BroadcastChannel;
  private msgFns: Array<(m: unknown) => void> = [];
  private connectFns: Array<() => void> = [];
  private readonly me = Math.random().toString(36).slice(2);

  constructor(
    code: string,
    private readonly role: 'host' | 'guest',
  ) {
    this.ch = new BroadcastChannel(`bolotas-sala-${code}`);
    this.ch.onmessage = (e: MessageEvent<{ from: string; role: string; body?: unknown; knock?: boolean }>) => {
      const d = e.data;
      if (d.from === this.me || d.role === role) return;
      if (d.knock) {
        // convidado bateu na porta: o host avisa que chegou alguém e responde
        if (role === 'host') this.ch.postMessage({ from: this.me, role, knock: true });
        for (const fn of this.connectFns) fn();
        return;
      }
      for (const fn of this.msgFns) fn(d.body);
    };
    if (role === 'guest') this.ch.postMessage({ from: this.me, role, knock: true });
  }

  send(msg: unknown): void {
    this.ch.postMessage({ from: this.me, role: this.role, body: msg });
  }
  onMessage(fn: (m: unknown) => void): void {
    this.msgFns.push(fn);
  }
  onError(): void {
    // BroadcastChannel não falha
  }
  onConnect(fn: () => void): void {
    this.connectFns.push(fn);
  }
  reconnect(): void {
    if (this.role === 'guest') this.ch.postMessage({ from: this.me, role: this.role, knock: true });
  }
  close(): void {
    this.ch.close();
  }
}
