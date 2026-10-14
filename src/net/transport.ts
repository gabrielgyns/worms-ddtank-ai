/**
 * Canal entre os dois jogadores. Só entrega mensagens JSON em ordem;
 * quem decide o que elas significam é a NetSession.
 */
export interface Transport {
  readonly kind: 'peer' | 'local';
  send(msg: unknown): void;
  onMessage(fn: (msg: unknown) => void): void;
  /** problema de conexão (sala não existe, broker fora do ar…) */
  onError(fn: (reason: string) => void): void;
  /** o outro lado (re)conectou — no host, um convidado chegou */
  onConnect(fn: () => void): void;
  /** convidado: tenta reconectar depois de perder o contato */
  reconnect(): void;
  close(): void;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O, que confundem com 1 e 0

export function newRoomCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return c.length === 4 ? c : null;
}

/** Link de convite: abre o jogo direto na sala. */
export function inviteLink(code: string): string {
  const base = location.href.split('#')[0];
  return `${base}#sala-${code}`;
}

/** Lê `#sala-ABCD` da URL. */
export function codeFromUrl(): string | null {
  const m = /#sala-([A-Za-z]{4})/.exec(location.hash);
  return m ? m[1].toUpperCase() : null;
}
