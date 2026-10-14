import { LocalTransport } from './localTransport';
import { PeerTransport } from './peerTransport';
import { Link, playerId } from './link';
import { newRoomCode, type Transport } from './transport';

export type Role = 'host' | 'guest';
export type TransportKind = 'peer' | 'local';

export function openTransport(kind: TransportKind, code: string, role: Role): Transport {
  return kind === 'local' ? new LocalTransport(code, role) : new PeerTransport(code, role);
}

/** Uma sala: código + papel + conversa tipada. A partida em si fica com a NetSession. */
export class Room {
  readonly transport: Transport;
  readonly link: Link;
  /** nome que este jogador escolheu */
  myName = 'Jogador';
  private constructor(
    readonly code: string,
    readonly role: Role,
    kind: TransportKind,
  ) {
    this.transport = openTransport(kind, code, role);
    this.link = new Link(this.transport, role, playerId(), () => this.myName);
  }

  static create(kind: TransportKind): Room {
    return new Room(newRoomCode(), 'host', kind);
  }

  static join(kind: TransportKind, code: string): Room {
    return new Room(code, 'guest', kind);
  }

  close(): void {
    this.link.close();
  }
}

export const ERROR_TEXT: Record<string, string> = {
  'room-taken': 'Esse código de sala já está em uso. Tente criar de novo.',
  'room-not-found': 'Sala não encontrada. Confira o código ou peça um link novo.',
  version: 'Vocês estão com versões diferentes do jogo. Recarreguem a página (puxe para baixo no celular).',
  network: 'Sem conexão com o servidor de salas. Verifique a internet e tente de novo.',
};
