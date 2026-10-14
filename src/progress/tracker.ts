import type { GameEvent, Match } from '../domain/match';
import type { WeaponId } from '../domain/weapons';

/** O que um time fez numa partida. */
export interface TeamMatchStats {
  damage: number;
  /** dano em si mesmo e em aliados */
  selfDamage: number;
  kills: number;
  /** inimigos derrubados na água */
  drowns: number;
  shots: number;
  /** turnos em que acertou algum inimigo */
  hits: number;
  /** maior distância horizontal de um acerto */
  longestShot: number;
  /** maior número de inimigos atingidos num único turno */
  multiHit: number;
  /** maior número de inimigos eliminados num único turno */
  multiKill: number;
  weapons: Partial<Record<WeaponId, number>>;
  /** acertou um inimigo com vento contra de força >= 8 */
  againstWind: boolean;
  /** bolotas próprias perdidas */
  lost: number;
}

const empty = (): TeamMatchStats => ({
  damage: 0,
  selfDamage: 0,
  kills: 0,
  drowns: 0,
  shots: 0,
  hits: 0,
  longestShot: 0,
  multiHit: 0,
  multiKill: 0,
  weapons: {},
  againstWind: false,
  lost: 0,
});

/**
 * Observa os eventos da partida e soma o que cada time fez.
 * Base das estatísticas, das moedas e das conquistas.
 */
export class MatchTracker {
  readonly teams: TeamMatchStats[];
  private turnHit = new Set<number>();
  private turnKills = 0;
  private shooterX = 0;
  private shooterTeam = -1;
  /** eventos brutos (para conquistas que olham o "como") */
  readonly listeners: Array<(e: GameEvent) => void> = [];

  constructor(private m: Match) {
    this.teams = m.teams.map(empty);
    m.on((e) => this.onEvent(e));
  }

  private closeTurn(): void {
    if (this.shooterTeam >= 0) {
      const s = this.teams[this.shooterTeam];
      if (this.turnHit.size > 0) s.hits++;
      s.multiHit = Math.max(s.multiHit, this.turnHit.size);
      s.multiKill = Math.max(s.multiKill, this.turnKills);
    }
    this.turnHit.clear();
    this.turnKills = 0;
  }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'turnStart':
        this.closeTurn();
        this.shooterTeam = e.unit.team.id;
        this.shooterX = e.unit.x;
        break;
      case 'fire': {
        const s = this.teams[e.unit.team.id];
        s.shots++;
        s.weapons[e.weapon] = (s.weapons[e.weapon] ?? 0) + 1;
        this.shooterX = e.unit.x;
        break;
      }
      case 'damage': {
        if (!e.by) break;
        const s = this.teams[e.by.team.id];
        if (e.by.team === e.unit.team) s.selfDamage += e.amount;
        else {
          s.damage += e.amount;
          this.turnHit.add(e.unit.id);
          s.longestShot = Math.max(s.longestShot, Math.round(Math.abs(e.unit.x - this.shooterX)));
          const windAgainst = Math.sign(this.m.wind) === -Math.sign(e.unit.x - this.shooterX) && Math.abs(this.m.wind) >= 8;
          if (windAgainst && e.unit.x !== this.shooterX) s.againstWind = true;
        }
        break;
      }
      case 'death': {
        this.teams[e.unit.team.id].lost++;
        if (e.by && e.by.team !== e.unit.team) {
          const s = this.teams[e.by.team.id];
          s.kills++;
          if (e.unit.drowned) s.drowns++;
          this.turnKills++;
        }
        break;
      }
      case 'gameOver':
        this.closeTurn();
        break;
    }
    for (const fn of this.listeners) fn(e);
  }
}
