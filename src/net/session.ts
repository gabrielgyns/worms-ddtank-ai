import { isEmptyInput, NO_INPUT, type Command, type TickInput } from '../domain/commands';
import type { MatchSetup } from '../domain/match';
import { THEMES } from '../domain/theme';
import type { Game, TickDriver } from '../game';
import type { MsgOf, WireSetup } from './protocol';
import type { Room } from './room';

export function toWire(s: MatchSetup): WireSetup {
  return { teams: s.teams, unitsPerTeam: s.unitsPerTeam, themeId: s.theme.id, seed: s.seed, turnTime: s.turnTime, crates: s.crates, suddenDeath: s.suddenDeath, bossHp: s.bossHp, objects: s.objects };
}

export function fromWire(w: WireSetup): MatchSetup {
  return { teams: w.teams, unitsPerTeam: w.unitsPerTeam, theme: THEMES[w.themeId], seed: w.seed, turnTime: w.turnTime, crates: w.crates, suddenDeath: w.suddenDeath, bossHp: w.bossHp, objects: w.objects };
}

/** Atraso-alvo do convidado em ticks: absorve variação de rede sem travar. */
const GUEST_BUFFER = 4;
/** Sem contato por mais que isso durante a partida = abandono. */
export const ABANDON_AFTER = 60;

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
  guestTeam = 1;
  private forfeitSent = false;
  // host
  private remoteQueue: TickInput[] = [];
  private outCmds: Command[] = [];
  // convidado
  private upTo = 0;
  private buffer: Command[] = [];
  // verificação de consistência
  private lastTurn = 0;
  private hostSums = new Map<number, { tick: number; sum: number }>();
  private mySums = new Map<number, { tick: number; sum: number }>();
  private lastResyncAsk = -Infinity;
  /** quantas vezes precisou ressincronizar (para depuração e aviso na tela) */
  resyncs = 0;
  onResync: (() => void) | null = null;

  constructor(readonly room: Room) {
    const link = room.link;
    if (room.role === 'host') {
      link.on('input', (m) => this.remoteQueue.push(m.input));
      link.on('resyncReq', () => this.sendResync());
      // convidado voltou no meio da partida: manda o setup e o estado atual
      link.on('hello', () => {
        const g = this.game;
        if (!g || g.match.phase === 'over') return;
        link.send({ t: 'start', setup: toWire(g.setup), guestTeam: this.guestTeam, rejoin: true });
        this.remoteQueue = [];
        this.sendResync();
      });
    } else {
      link.on('frame', (m) => this.onFrame(m));
      link.on('sum', (m) => {
        this.hostSums.set(m.turn, { tick: m.tick, sum: m.sum });
        this.compare(m.turn);
      });
      link.on('resync', (m) => this.applyResync(m));
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
    this.lastTurn = 0;
    this.hostSums.clear();
    this.mySums.clear();
    this.forfeitSent = false;
  }

  /** O outro jogador sumiu tempo demais? */
  get abandoned(): boolean {
    return this.room.link.lostFor > ABANDON_AFTER;
  }

  /** Host: manda o estado completo para o convidado. */
  sendResync(): void {
    const g = this.game;
    if (!g || this.role !== 'host') return;
    this.room.link.send({ t: 'resync', snap: g.match.snapshot(), log: [] });
  }

  private applyResync(m: MsgOf<'resync'>): void {
    const g = this.game;
    if (!g) return;
    g.match.restore(m.snap);
    this.upTo = Math.max(this.upTo, m.snap.tick);
    this.lastTurn = g.match.turnNumber;
    this.resyncs++;
    this.onResync?.();
  }

  /** Convidado: compara a impressão digital do turno com a do host. */
  private compare(turn: number): void {
    const host = this.hostSums.get(turn);
    const mine = this.mySums.get(turn);
    if (!host || !mine) return;
    this.hostSums.delete(turn);
    this.mySums.delete(turn);
    if (host.tick === mine.tick && host.sum === mine.sum) return;
    const now = performance.now();
    if (now - this.lastResyncAsk < 2000) return;
    this.lastResyncAsk = now;
    this.room.link.send({ t: 'resyncReq' });
  }

  /** Depois de cada tick: se começou um turno novo, registra o checksum. */
  private turnCheck(g: Game): void {
    const m = g.match;
    if (m.turnNumber === this.lastTurn) return;
    this.lastTurn = m.turnNumber;
    const entry = { tick: m.tick, sum: m.checksum() };
    if (this.role === 'host') this.room.link.send({ t: 'sum', turn: m.turnNumber, ...entry });
    else {
      this.mySums.set(m.turnNumber, entry);
      this.compare(m.turnNumber);
    }
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
        if (this.abandoned && !this.forfeitSent && g.match.phase !== 'over') {
          this.forfeitSent = true;
          return { forfeit: this.guestTeam };
        }
        if (!team) return NO_INPUT;
        if (g.isLocal(team.id)) return g.humanInput();
        // CPU (chefão no co-op): quem decide é o host
        if (team.control === 'cpu') return g.cpuInput();
        // vez do convidado: aplica uma entrada recebida por tick
        return this.remoteQueue.shift() ?? NO_INPUT;
      },
      afterStep: (g, input, tick) => {
        if (!isEmptyInput(input)) this.outCmds.push({ tick, input });
        this.turnCheck(g);
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
      afterStep: (g) => this.turnCheck(g),
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
