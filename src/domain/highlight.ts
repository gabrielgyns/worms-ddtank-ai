import type { Command } from './commands';
import type { Match, MatchSnapshot } from './match';

/** O lance mais bonito da partida: estado no começo da vez + comandos dela. */
export interface Highlight {
  snap: MatchSnapshot;
  startTick: number;
  endTick: number;
  /** checksum no fim do lance (para conferir que o replay bateu) */
  endSum: number;
  damage: number;
  kills: number;
  shooter: string;
  team: number;
}

/** Pontos de um lance: dano, com bônus por eliminação. */
export function highlightScore(damage: number, kills: number): number {
  return damage + kills * 40;
}

/**
 * Guarda o melhor lance enquanto a partida roda.
 *
 * A cada vez nova tira uma foto do estado (barata: ~6 ms por vez); quando a
 * vez acaba, se ela causou mais estrago que a melhor até agora, a foto fica.
 * Como a partida é determinística, foto + comandos da vez = o lance inteiro.
 *
 * A foto precisa ser tirada ENTRE ticks, nunca no meio de um: por isso o
 * evento só marca e `afterStep` (chamado por quem roda a partida) fotografa.
 */
export class HighlightRecorder {
  best: Highlight | null = null;
  private current: { snap: MatchSnapshot; startTick: number; damage: number; kills: number; shooter: string; team: number } | null = null;
  private boundary = false;

  constructor(private readonly m: Match) {
    m.on((e) => {
      if (e.type === 'turnStart' || e.type === 'gameOver') this.boundary = true;
      const c = this.current;
      if (!c) return;
      // dano em si mesmo ou no próprio time não é lance para mostrar
      if (e.type === 'damage' && e.unit.team.id !== c.team) c.damage += e.amount;
      if (e.type === 'death' && e.unit.team.id !== c.team) c.kills++;
    });
    // partida já começada: a primeira vez abre agora
    if (m.active) {
      this.boundary = true;
      this.afterStep();
    }
  }

  /** Chame depois de cada `match.step`. */
  afterStep(): void {
    if (!this.boundary) return;
    this.boundary = false;
    const m = this.m;
    this.close();
    if (m.phase === 'over' || !m.active) {
      this.current = null;
      return;
    }
    this.current = { snap: m.snapshot(), startTick: m.tick, damage: 0, kills: 0, shooter: m.active.name, team: m.active.team.id };
  }

  private close(): void {
    const c = this.current;
    if (!c || c.damage <= 0) return;
    const score = highlightScore(c.damage, c.kills);
    if (this.best && score <= highlightScore(this.best.damage, this.best.kills)) return;
    this.best = { ...c, endTick: this.m.tick, endSum: this.m.checksum() };
  }
}

/** Comandos do log que pertencem ao lance. */
export function highlightCommands(h: Highlight, log: readonly Command[]): Command[] {
  return log.filter((c) => c.tick >= h.startTick && c.tick < h.endTick);
}
