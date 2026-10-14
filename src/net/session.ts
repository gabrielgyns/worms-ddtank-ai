import { isEmptyInput, NO_INPUT, type Command, type TickInput } from '../domain/commands';
import type { MatchSetup } from '../domain/match';
import { THEMES } from '../domain/theme';
import type { Game, TickDriver } from '../game';
import type { MsgOf, WireSetup } from './protocol';
import type { Room } from './room';

export function toWire(s: MatchSetup): WireSetup {
  return { teams: s.teams, unitsPerTeam: s.unitsPerTeam, themeId: s.theme.id, seed: s.seed, turnTime: s.turnTime };
}

export function fromWire(w: WireSetup): MatchSetup {
  return { teams: w.teams, unitsPerTeam: w.unitsPerTeam, theme: THEMES[w.themeId], seed: w.seed, turnTime: w.turnTime };
}

/** Atraso-alvo do convidado em ticks: absorve variação de rede sem travar. */
const GUEST_BUFFER = 4;

/**
 * Lockstep por turno.
 *
 * O host é o relógio: simula normalmente e, a cada frame, manda ao convidado
 * até que tick já simulou (`upTo`) e as entradas não vazias de cada tick.
 * O convidado simula exatamente os mesmos ticks com as mesmas entradas e
 * nunca passa do `upTo`. Na vez do convidado, ele manda suas entradas ao host,
 * que as aplica no próximo tick e as devolve carimbadas com o tick.
 *
 * Analogia: xadrez por carta. Ninguém manda foto do tabuleiro, só os lances.
 */
export class NetSession {
  game: Game | null = null;
  // host
  private remoteQueue: TickInput[] = [];
  private outCmds: Command[] = [];
  // convidado
  private upTo = 0;
  private buffer: Command[] = [];

  constructor(readonly room: Room) {
    const link = room.link;
    if (room.role === 'host') {
      link.on('input', (m) => this.remoteQueue.push(m.input));
    } else {
      link.on('frame', (m) => this.onFrame(m));
    }
  }

  get role(): 'host' | 'guest' {
    return this.room.role;
  }

  /** Começa uma partida nova (os dois lados chamam com o mesmo setup). */
  reset(): void {
    this.remoteQueue = [];
    this.outCmds = [];
    this.upTo = 0;
    this.buffer = [];
  }

  private onFrame(m: MsgOf<'frame'>): void {
    for (const c of m.cmds) this.buffer.push(c);
    this.upTo = Math.max(this.upTo, m.upTo);
  }

  driver(): TickDriver {
    return this.role === 'host' ? this.hostDriver() : this.guestDriver();
  }

  private hostDriver(): TickDriver {
    return {
      next: (g) => {
        const team = g.match.activeTeam;
        if (!team) return NO_INPUT;
        if (g.isLocal(team.id)) return g.humanInput();
        // vez do convidado: aplica uma entrada recebida por tick
        return this.remoteQueue.shift() ?? NO_INPUT;
      },
      afterStep: (_g, input, tick) => {
        if (!isEmptyInput(input)) this.outCmds.push({ tick, input });
      },
      afterFrame: (g) => {
        this.room.link.send({ t: 'frame', upTo: g.match.tick, cmds: this.outCmds });
        this.outCmds = [];
      },
    };
  }

  private guestDriver(): TickDriver {
    return {
      beforeFrame: (g) => {
        if (!g.humanTurn) return;
        const input = g.humanInput();
        if (!isEmptyInput(input)) this.room.link.send({ t: 'input', input });
      },
      next: (g) => {
        const tick = g.match.tick;
        if (tick >= this.upTo) return null;
        // descarta comandos antigos (depois de uma ressincronização)
        while (this.buffer.length && this.buffer[0].tick < tick) this.buffer.shift();
        if (this.buffer[0]?.tick === tick) return this.buffer.shift()!.input;
        return NO_INPUT;
      },
      catchUp: (g) => {
        const lag = this.upTo - g.match.tick;
        return lag > GUEST_BUFFER * 2 ? Math.min(lag - GUEST_BUFFER, 8) : 0;
      },
    };
  }

  /** Atraso atual do convidado em relação ao host (ticks). */
  get lag(): number {
    return this.game ? Math.max(0, this.upTo - this.game.match.tick) : 0;
  }
}
