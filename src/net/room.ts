import { LocalTransport } from './localTransport';
import { PeerTransport } from './peerTransport';
import { newRoomCode, type Transport } from './transport';

export type Role = 'host' | 'guest';
export type TransportKind = 'peer' | 'local';

export function openTransport(kind: TransportKind, code: string, role: Role): Transport {
  return kind === 'local' ? new LocalTransport(code, role) : new PeerTransport(code, role);
}

/** Uma sala: código + papel + canal. A partida em si fica com a NetSession. */
export class Room {
  readonly transport: Transport;
  private constructor(
    readonly code: string,
    readonly role: Role,
    kind: TransportKind,
  ) {
    this.transport = openTransport(kind, code, role);
  }

  static create(kind: TransportKind): Room {
    return new Room(newRoomCode(), 'host', kind);
  }

  static join(kind: TransportKind, code: string): Room {
    return new Room(code, 'guest', kind);
  }

  close(): void {
    this.transport.close();
  }
}

export const ERROR_TEXT: Record<string, string> = {
  'room-taken': 'Esse código de sala já está em uso. Tente criar de novo.',
  'room-not-found': 'Sala não encontrada. Confira o código ou peça um link novo.',
  network: 'Sem conexão com o servidor de salas. Verifique a internet e tente de novo.',
};
