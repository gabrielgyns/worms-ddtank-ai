import { NO_INPUT, isEmptyInput, type Command } from '../domain/commands';
import type { MatchSnapshot } from '../domain/match';
import type { Game, TickDriver } from '../game';
import { pack, unpack } from '../core/pack';
import { PROTOCOL_VERSION, type WireSetup } from './protocol';

/**
 * Partida por correspondência: cada jogada vira um link.
 *
 * A "carta" leva o estado no começo da jogada de quem enviou e os comandos
 * dessa jogada. Quem recebe assiste ao lance, joga o seu e manda outra carta.
 * Sem servidor: o link vai pelo WhatsApp, e-mail, o que for.
 */
export interface Letter {
  v: number;
  setup: WireSetup;
  /** estado quando começou a jogada de quem enviou */
  snap: MatchSnapshot | null;
  /** comandos desde `snap` até o momento da entrega */
  cmds: Command[];
  /** tick em que a vez passou para quem recebe */
  endTick: number;
  /** checksum no `endTick`, para detectar diferença entre aparelhos */
  sum: number;
  /** time de quem recebe a carta */
  to: number;
}

export async function encodeLetter(l: Letter): Promise<string> {
  return pack(JSON.stringify(l));
}

export async function decodeLetter(code: string): Promise<Letter | null> {
  const text = await unpack(code);
  if (!text) return null;
  try {
    const l = JSON.parse(text) as Letter;
    return l.v === PROTOCOL_VERSION ? l : null;
  } catch {
    return null;
  }
}

export function letterLink(code: string): string {
  return `${location.href.split('#')[0]}#carta-${code}`;
}

export function letterFromUrl(): string | null {
  const m = /#carta-([A-Za-z0-9_-]+)/.exec(location.hash);
  return m ? m[1] : null;
}

/**
 * Dirige a partida: primeiro reproduz o lance recebido, depois deixa o
 * jogador local jogar até a vez passar para o outro — aí congela e entrega.
 */
export class MailDriver implements TickDriver {
  private mode: 'watch' | 'play' | 'sent' = 'watch';
  private idx = 0;
  private startSnap: MatchSnapshot | null = null;
  private mine: Command[] = [];
  /** o checksum bateu ao fim do lance recebido? null = não se aplica */
  matched: boolean | null = null;

  constructor(
    private incoming: Letter | null,
    private readonly myTeam: number,
    private readonly onHandoff: (l: Letter) => void,
    private readonly setup: WireSetup,
  ) {
    if (!incoming) this.mode = 'play';
  }

  get watching(): boolean {
    return this.mode === 'watch';
  }

  next(g: Game): Command['input'] | null {
    const m = g.match;
    if (this.mode === 'sent') return null;
    if (this.mode === 'watch') {
      const l = this.incoming!;
      if (m.tick >= l.endTick) {
        this.matched = m.checksum() === l.sum;
        this.mode = 'play';
        this.startSnap = m.snapshot();
        if (m.phase === 'over') {
          this.mode = 'sent';
          return null;
        }
        return this.next(g);
      }
      const c = l.cmds[this.idx];
      if (c && c.tick === m.tick) {
        this.idx++;
        return c.input;
      }
      return NO_INPUT;
    }
    // play
    const team = m.activeTeam;
    if (m.phase === 'over' || (team && team.id !== this.myTeam && m.phase === 'turn')) {
      this.deliver(g);
      return null;
    }
    return team && team.id === this.myTeam ? g.humanInput() : NO_INPUT;
  }

  afterStep(_g: Game, input: Command['input'], tick: number): void {
    if (this.mode === 'play' && !isEmptyInput(input)) this.mine.push({ tick, input });
  }

  private deliver(g: Game): void {
    this.mode = 'sent';
    this.onHandoff({
      v: PROTOCOL_VERSION,
      setup: this.setup,
      snap: this.startSnap,
      cmds: this.mine,
      endTick: g.match.tick,
      sum: g.match.checksum(),
      to: 1 - this.myTeam,
    });
  }
}
