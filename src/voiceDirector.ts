import type { VoiceCue } from './core/voicepacks';
import type { VoicePlayer } from './core/voiceplayer';
import type { GameEvent, Match } from './domain/match';
import type { Team, Unit } from './domain/unit';
import type { WeaponId } from './domain/weapons';
import type { Effects } from './render/effects';

/** Armas com fala própria quando disparadas. */
const WEAPON_CUE: Partial<Record<WeaponId, VoiceCue>> = {
  sheep: 'sheep',
  airstrike: 'airstrike',
  banana: 'banana',
  teleport: 'teleport',
};

/** Ferramentas que não são tiro: não rendem "Na mosca!" nem "Errei!". */
const NO_SHOT = new Set<WeaponId>(['teleport', 'rope', 'parachute', 'girder']);

/** Velocidade da fala por bicho: mais rápido = mais agudo (o "esquilo" do Worms). */
function rateOf(u: Unit): number {
  const t = u.team;
  const base = t.boss ? 0.8 : t.look.species === 'species-hamster' ? 1.62 : t.look.species === 'species-gato' ? 1.45 : t.look.species === 'species-cachorro' ? 1.22 : 1.32;
  // cada time e cada bolota soa um pouco diferente
  return base * (1 + ((t.id % 4) - 1.5) * 0.035 + ((u.seed % 7) - 3) * 0.006);
}

interface Pending {
  at: number;
  unit: Unit;
  cue: VoiceCue;
  priority: boolean;
}

/**
 * Diretor de voz: ouve os eventos da partida e decide quem fala o quê com a voz
 * gravada do time (pacote de voz). Só enfeite: usa Math.random e o relógio real,
 * nunca mexe na regra. Times sem pacote continuam no balbucio das falas sorteadas.
 */
export class VoiceDirector {
  private time = 0;
  private busyUntil = 0;
  private queue: Pending[] = [];
  private screamed = new Set<number>();
  private hurried = -1;
  /** o tiro em andamento: acertou alguém? para o "Na mosca!" ou o "Errei!" */
  private shot: { unit: Unit; at: number; enemy: boolean; self: boolean; kill: boolean } | null = null;

  constructor(
    private m: Match,
    private player: VoicePlayer,
    private fx: Effects,
    private enabled: () => boolean,
  ) {
    for (const t of m.teams) player.preload(t.look.voice);
    fx.voiced = (u) => this.voiced(u.team);
    m.on((e) => this.onEvent(e));
  }

  /** Este time fala com voz gravada agora? (pacote equipado, baixado e vozes ligadas) */
  voiced(team: Team): boolean {
    return this.enabled() && this.player.ready(team.look.voice);
  }

  private say(u: Unit, cue: VoiceCue, opts: { chance?: number; priority?: boolean } = {}): boolean {
    if (!this.voiced(u.team)) return false;
    if (Math.random() > (opts.chance ?? 1)) return false;
    if (!opts.priority && this.time < this.busyUntil) return false;
    const r = this.player.play(u.team.look.voice!, cue, rateOf(u));
    if (!r) return false;
    this.busyUntil = this.time + r.dur + 0.1;
    if (u.alive) this.fx.bubble(u, r.text, Math.max(1.4, r.dur + 0.7));
    return true;
  }

  private later(delay: number, unit: Unit, cue: VoiceCue, priority = false): void {
    this.queue.push({ at: this.time + delay, unit, cue, priority });
  }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'turnStart':
        this.shot = null;
        this.say(e.unit, Math.random() < 0.15 ? 'whistle' : 'turn', { chance: 0.55 });
        break;
      case 'fire': {
        const special = WEAPON_CUE[e.weapon];
        if (special) this.say(e.unit, special, { priority: true, chance: 0.9 });
        else this.say(e.unit, 'fire', { chance: 0.45 });
        // fim do tiro sem explosão (caiu na água, saiu do mapa): avalia depois de um tempo
        if (!NO_SHOT.has(e.weapon)) this.shot = { unit: e.unit, at: this.time + 7, enemy: false, self: false, kill: false };
        break;
      }
      case 'explosion':
        if (this.shot && e.by === this.shot.unit) this.shot.at = Math.min(this.shot.at, this.time + 0.9);
        break;
      case 'damage': {
        const { unit, by } = e;
        if (this.shot && by === this.shot.unit) {
          if (unit === by) this.shot.self = true;
          else if (unit.team !== by.team) this.shot.enemy = true;
        }
        if (unit.hp <= 0) break; // quem morre fala na morte
        if (by === unit) this.say(unit, 'self', { priority: true });
        else if (by && by.team === unit.team) this.say(unit, 'friendly', { priority: true });
        else if (e.amount >= 35) this.say(unit, 'big', { priority: true });
        else if (unit.hp < 30) this.say(unit, Math.random() < 0.3 ? 'relief' : 'low');
        else this.say(unit, Math.random() < 0.2 ? 'grumpy' : 'ouch');
        break;
      }
      case 'death': {
        const drowned = e.unit.y >= this.m.terrain.waterY - 2;
        this.say(e.unit, drowned ? 'drown' : 'death', { priority: true });
        if (e.by && e.by.alive && e.by.team !== e.unit.team) {
          if (this.shot && this.shot.unit === e.by) this.shot.kill = true;
          this.later(1, e.by, Math.random() < 0.3 ? 'laugh' : 'kill', true);
        }
        break;
      }
      case 'cratePick':
        this.say(e.unit, 'crate', { chance: 0.7 });
        break;
      case 'gameOver':
        for (const t of this.m.teams) {
          const who = this.m.units.find((u) => u.team === t && u.alive) ?? this.m.units.find((u) => u.team === t);
          if (!who) continue;
          if (e.winner === t) this.later(0.6, who, 'win', true);
          else this.later(2, who, 'lose', true);
        }
        break;
      default:
        break;
    }
  }

  /** `dt` em tempo real (a voz não acelera com a CPU turbo). */
  update(dt: number): void {
    this.time += dt;
    const m = this.m;

    for (const p of this.queue.filter((q) => q.at <= this.time)) this.say(p.unit, p.cue, { priority: p.priority });
    this.queue = this.queue.filter((q) => q.at > this.time);

    const s = this.shot;
    if (s && this.time >= s.at) {
      this.shot = null;
      if (s.unit.alive && !s.kill) {
        if (s.enemy) this.say(s.unit, 'hit', { chance: 0.6 });
        else if (!s.self) this.say(s.unit, 'miss', { chance: 0.75 });
      }
    }

    // grito de queda: uma vez por queda livre
    for (const u of m.units) {
      if (!u.alive || u.onGround) {
        this.screamed.delete(u.id);
        continue;
      }
      if (u.vy > 520 && !this.screamed.has(u.id)) {
        this.screamed.add(u.id);
        this.say(u, 'fall', { priority: true, chance: 0.8 });
      }
    }

    // pressa no fim do turno
    if (m.phase === 'turn' && m.active && m.turnTimer <= 5 && m.turnTimer > 4 && this.hurried !== m.turnNumber) {
      this.hurried = m.turnNumber;
      this.say(m.active, 'hurry', { chance: 0.7 });
    }
  }
}
