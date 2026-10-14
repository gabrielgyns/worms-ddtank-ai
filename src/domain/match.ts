import { clamp, DEG, Hasher, Rng } from '../core/math';
import {
  blastDamage,
  bodyCollides,
  stepProjectile,
  stepUnit,
  unstick,
  walk,
  type Projectile,
  type SimWorld,
} from './physics';
import { DT, type TickInput } from './commands';
import { decodeMask, encodeMask } from './codec';
import { Terrain } from './terrain';
import type { Theme } from './theme';
import { Unit, type Control, type Team } from './unit';
import { specByKey, specKey, WEAPONS, weaponById, type ProjectileSpec, type WeaponDef, type WeaponId } from './weapons';

export type Phase = 'turn' | 'retreat' | 'settle' | 'over';

export type GameEvent =
  | { type: 'explosion'; x: number; y: number; r: number }
  | { type: 'damage'; unit: Unit; amount: number; by: Unit | null }
  | { type: 'fire'; weapon: WeaponId; unit: Unit }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'splash'; x: number; y: number; big: boolean }
  | { type: 'death'; unit: Unit; by: Unit | null }
  | { type: 'turnStart'; unit: Unit }
  | { type: 'teleport'; fromX: number; fromY: number; unit: Unit }
  | { type: 'jump'; unit: Unit }
  | { type: 'select'; weapon: WeaponId }
  | { type: 'gameOver'; winner: Team | null };

export interface TeamSetup {
  name: string;
  color: string;
  light: string;
  dark: string;
  control: Control;
  names: string[];
}

export interface MatchSetup {
  teams: TeamSetup[];
  unitsPerTeam: number;
  theme: Theme;
  seed: number;
  turnTime: number;
}

/** Estado completo da partida em JSON. Restaura numa Match criada com o mesmo setup. */
export interface MatchSnapshot {
  v: 1;
  tick: number;
  phase: Phase;
  wind: number;
  turnTimer: number;
  retreatTimer: number;
  active: number;
  charging: boolean;
  power: number;
  chargeLimit: number;
  teamCursor: number;
  settleClock: number;
  hasFired: boolean;
  turnNumber: number;
  winner: number;
  time: number;
  rng: number;
  teams: Array<{ cursor: number; weapon: WeaponId; ammo: Array<[WeaponId, number]> }>;
  units: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    facing: 1 | -1;
    aim: number;
    onGround: boolean;
    alive: boolean;
    drowned: boolean;
    walkAccum: number;
    walkPhase: number;
    lastPower: number;
    fallSpeed: number;
  }>;
  projectiles: Array<{ x: number; y: number; vx: number; vy: number; spec: string; fuse: number | null; age: number; ownerId: number; rot: number }>;
  terrain: string;
}

const RETREAT_TIME = 3;
const CHARGE_TIME = 1.7;
const AIM_MIN = -80 * DEG;
const AIM_MAX = 88 * DEG;

/**
 * A partida: estado do mundo + regras de turno.
 * Controladores (humano ou IA) chamam os comandos; a render só lê.
 */
export class Match implements SimWorld {
  readonly terrain: Terrain;
  readonly teams: Team[] = [];
  readonly units: Unit[] = [];
  readonly projectiles: Projectile[] = [];
  readonly theme: Theme;
  readonly rng: Rng;
  readonly turnTime: number;

  wind = 0;
  phase: Phase = 'settle';
  turnTimer = 0;
  retreatTimer = 0;
  active: Unit | null = null;
  charging = false;
  power = 0;
  private chargeLimit = 1;
  private teamCursor = -1;
  private settleClock = 0;
  private hasFired = false;
  turnNumber = 0;
  /** ticks simulados desde o início */
  tick = 0;
  winner: Team | null = null;
  time = 0;

  private listeners: Array<(e: GameEvent) => void> = [];

  constructor(setup: MatchSetup) {
    this.theme = setup.theme;
    this.rng = new Rng(setup.seed);
    this.turnTime = setup.turnTime;
    this.terrain = new Terrain(2800, 1400, 1330);
    this.terrain.generate(this.rng);

    setup.teams.forEach((ts, i) => {
      this.teams.push({
        id: i,
        name: ts.name,
        color: ts.color,
        light: ts.light,
        dark: ts.dark,
        control: ts.control,
        units: [],
        cursor: 0,
        ammo: new Map(WEAPONS.map((w) => [w.id, w.ammo])),
        weapon: 'bazooka',
      });
    });
    this.spawnUnits(setup);
  }

  on(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private spawnUnits(setup: MatchSetup): void {
    const total = setup.unitsPerTeam * this.teams.length;
    const t = this.terrain;
    const slots: number[] = [];
    const margin = 300;
    const span = (t.width - margin * 2) / total;
    for (let i = 0; i < total; i++) slots.push(margin + span * (i + 0.5));
    // embaralha posições para os times ficarem misturados
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    let id = 0;
    let s = 0;
    for (let n = 0; n < setup.unitsPerTeam; n++) {
      for (const team of this.teams) {
        let x = slots[s++] + this.rng.range(-span * 0.3, span * 0.3);
        let y = t.surfaceY(x);
        for (let tries = 0; tries < 30 && y > t.waterY - 40; tries++) {
          x = this.rng.range(margin, t.width - margin);
          y = t.surfaceY(x);
        }
        const name = setup.teams[team.id].names[n % setup.teams[team.id].names.length];
        const u = new Unit(id++, team, name, x, y);
        u.facing = x < t.width / 2 ? 1 : -1;
        unstick(t, u);
        team.units.push(u);
        this.units.push(u);
      }
    }
  }

  get weapon(): WeaponDef {
    return weaponById(this.activeTeam?.weapon ?? 'bazooka');
  }

  get activeTeam(): Team | null {
    return this.active?.team ?? null;
  }

  ammoOf(id: WeaponId): number {
    return this.activeTeam?.ammo.get(id) ?? 0;
  }

  aliveTeams(): Team[] {
    return this.teams.filter((t) => t.units.some((u) => u.alive));
  }

  teamHp(team: Team): number {
    return team.units.reduce((s, u) => s + (u.alive ? Math.max(0, u.hp) : 0), 0);
  }

  /**
   * Impressão digital do estado da regra. Dois computadores com o mesmo
   * checksum estão vendo exatamente a mesma partida.
   */
  checksum(): number {
    const h = new Hasher();
    h.int(this.tick).str(this.phase).int(this.wind).int(this.turnNumber).int(this.rng.state);
    h.num(this.turnTimer).num(this.retreatTimer).num(this.power).int(this.charging ? 1 : 0);
    h.int(this.active?.id ?? -1);
    for (const t of this.teams) {
      h.int(t.cursor).str(t.weapon);
      for (const [id, n] of t.ammo) h.str(id).num(n);
    }
    for (const u of this.units) {
      h.num(u.x).num(u.y).num(u.vx).num(u.vy).num(u.hp).num(u.aim).int(u.facing);
      h.int(u.alive ? 1 : 0).int(u.onGround ? 1 : 0);
    }
    for (const p of this.projectiles) h.num(p.x).num(p.y).num(p.vx).num(p.vy).num(p.fuse ?? -1).str(p.spec.kind);
    h.bytes(this.terrain.solid);
    return h.value;
  }

  snapshot(): MatchSnapshot {
    // Infinity não existe em JSON: munição infinita vira -1
    const inf = (n: number) => (n === Infinity ? -1 : n);
    return {
      v: 1,
      tick: this.tick,
      phase: this.phase,
      wind: this.wind,
      turnTimer: this.turnTimer,
      retreatTimer: this.retreatTimer,
      active: this.active?.id ?? -1,
      charging: this.charging,
      power: this.power,
      chargeLimit: this.chargeLimit,
      teamCursor: this.teamCursor,
      settleClock: this.settleClock,
      hasFired: this.hasFired,
      turnNumber: this.turnNumber,
      winner: this.winner?.id ?? -1,
      time: this.time,
      rng: this.rng.state,
      teams: this.teams.map((t) => ({ cursor: t.cursor, weapon: t.weapon, ammo: [...t.ammo].map(([id, n]) => [id, inf(n)]) })),
      units: this.units.map((u) => ({
        x: u.x,
        y: u.y,
        vx: u.vx,
        vy: u.vy,
        hp: u.hp,
        facing: u.facing,
        aim: u.aim,
        onGround: u.onGround,
        alive: u.alive,
        drowned: u.drowned,
        walkAccum: u.walkAccum,
        walkPhase: u.walkPhase,
        lastPower: u.lastPower,
        fallSpeed: u.fallSpeed,
      })),
      projectiles: this.projectiles.map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        spec: specKey(p.spec),
        fuse: p.fuse ?? null,
        age: p.age,
        ownerId: p.ownerId,
        rot: p.rot,
      })),
      terrain: encodeMask(this.terrain.solid),
    };
  }

  restore(s: MatchSnapshot): void {
    this.tick = s.tick;
    this.phase = s.phase;
    this.wind = s.wind;
    this.turnTimer = s.turnTimer;
    this.retreatTimer = s.retreatTimer;
    this.active = this.units.find((u) => u.id === s.active) ?? null;
    this.charging = s.charging;
    this.power = s.power;
    this.chargeLimit = s.chargeLimit;
    this.teamCursor = s.teamCursor;
    this.settleClock = s.settleClock;
    this.hasFired = s.hasFired;
    this.turnNumber = s.turnNumber;
    this.winner = this.teams.find((t) => t.id === s.winner) ?? null;
    this.time = s.time;
    this.rng.state = s.rng;
    s.teams.forEach((st, i) => {
      const t = this.teams[i];
      t.cursor = st.cursor;
      t.weapon = st.weapon;
      t.ammo = new Map(st.ammo.map(([id, n]) => [id, n < 0 ? Infinity : n]));
    });
    s.units.forEach((su, i) => Object.assign(this.units[i], su));
    this.projectiles.length = 0;
    for (const p of s.projectiles) {
      this.projectiles.push({ ...p, spec: specByKey(p.spec), fuse: p.fuse ?? undefined });
    }
    const mask = new Uint8Array(this.terrain.solid.length);
    decodeMask(s.terrain, mask);
    this.terrain.replace(mask);
  }

  // ───────────────────────── comandos ─────────────────────────

  /**
   * Avança um tick aplicando a entrada do jogador da vez.
   * É assim que a partida deve ser dirigida (humano, CPU, replay e rede).
   */
  step(input: TickInput): void {
    this.apply(input);
    this.update(DT);
    this.tick++;
  }

  private apply(i: TickInput): void {
    if (i.weapon !== undefined) this.selectWeapon(i.weapon);
    if (i.face !== undefined) this.face(i.face);
    if (i.walk !== undefined) this.walk(i.walk, DT);
    if (i.aim !== undefined) this.aimBy(i.aim);
    if (i.aimTo !== undefined && this.active) this.aimBy(i.aimTo - this.active.aim);
    if (i.jump !== undefined) this.jump(i.jump === 'back');
    if (i.charge === 'start') this.startCharge(i.chargeLimit ?? 1);
    if (i.charge === 'release') this.releaseCharge();
    if (i.target !== undefined) this.fireAt(i.target.x, i.target.y);
    if (i.forfeit !== undefined) this.forfeit(i.forfeit);
  }

  /** O time desistiu (ou caiu de vez): todas as bolotas dele saem do jogo. */
  forfeit(teamId: number): void {
    if (this.phase === 'over') return;
    const team = this.teams[teamId];
    if (!team) return;
    for (const u of team.units) {
      u.alive = false;
      u.hp = 0;
    }
    this.projectiles.length = 0;
    this.charging = false;
    this.nextTurn();
  }

  private canAct(): boolean {
    return this.active !== null && (this.phase === 'turn' || this.phase === 'retreat');
  }

  walk(dir: 1 | -1, dt: number): void {
    if (!this.canAct() || this.charging) return;
    walk(this.terrain, this.active!, dir, dt);
  }

  face(dir: 1 | -1): void {
    if (this.canAct() && !this.charging) this.active!.facing = dir;
  }

  jump(back = false): void {
    if (!this.canAct() || this.charging) return;
    const u = this.active!;
    if (!u.onGround) return;
    u.onGround = false;
    u.y -= 1;
    if (back) {
      u.vx = -u.facing * 70;
      u.vy = -400;
    } else {
      u.vx = u.facing * 175;
      u.vy = -250;
    }
    this.emit({ type: 'jump', unit: u });
  }

  aimBy(delta: number): void {
    if (this.phase !== 'turn' || !this.active) return;
    this.active.aim = clamp(this.active.aim + delta, AIM_MIN, AIM_MAX);
  }

  selectWeapon(id: WeaponId): boolean {
    if (this.phase !== 'turn' || this.charging || this.hasFired) return false;
    if (this.ammoOf(id) <= 0) return false;
    if (this.activeTeam!.weapon !== id) {
      this.activeTeam!.weapon = id;
      this.emit({ type: 'select', weapon: id });
    }
    return true;
  }

  /** Começa a carregar a força (modo DDTank). `limit` é usado pela IA. */
  startCharge(limit = 1): void {
    if (this.phase !== 'turn' || !this.active || this.hasFired) return;
    if (this.weapon.mode === 'drop') {
      this.fireDrop();
      return;
    }
    if (this.weapon.mode !== 'charge' || this.charging) return;
    this.charging = true;
    this.power = 0;
    this.chargeLimit = clamp(limit, 0.05, 1);
  }

  releaseCharge(): void {
    if (!this.charging || !this.active) return;
    this.charging = false;
    this.fireCharged(this.power);
  }

  /** Para armas de alvo (ataque aéreo, teletransporte). */
  fireAt(x: number, y: number): boolean {
    if (this.phase !== 'turn' || !this.active || this.hasFired || this.weapon.mode !== 'target') return false;
    const u = this.active;
    if (this.weapon.id === 'teleport') {
      const t = this.terrain;
      if (x < 20 || x > t.width - 20 || y > t.waterY - 30 || y < 0) return false;
      if (bodyCollides(t, x, y)) return false;
      const fromX = u.x;
      const fromY = u.y;
      u.x = x;
      u.y = y;
      u.vx = 0;
      u.vy = 0;
      u.onGround = false;
      this.consumeAmmo();
      this.emit({ type: 'teleport', fromX, fromY, unit: u });
      this.beginRetreat(1.2);
      return true;
    }
    // ataque aéreo: cinco mísseis vindos do céu
    const spec = this.weapon.projectile!;
    const dir = x >= u.x ? 1 : -1;
    for (let i = 0; i < 5; i++) {
      this.projectiles.push({
        x: x + (i - 2) * 34 - dir * 90,
        y: -80 - i * 18,
        vx: dir * 70,
        vy: 140,
        spec,
        age: 1,
        ownerId: u.id,
        rot: 0,
      });
    }
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: this.weapon.id, unit: u });
    this.beginRetreat(RETREAT_TIME);
    return true;
  }

  private fireCharged(power: number): void {
    const u = this.active!;
    const w = this.weapon;
    const spec = w.projectile!;
    const speed = w.maxSpeed * Math.max(0.06, power);
    for (const extra of w.spread ?? [0]) {
      const a = u.aim + extra * DEG;
      const dx = Math.cos(a) * u.facing;
      const dy = -Math.sin(a);
      this.projectiles.push(this.makeProjectile(u.cx + dx * 16, u.cy + dy * 16, dx * speed, dy * speed, spec, u.id));
    }
    u.lastPower = power;
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: w.id, unit: u });
    this.beginRetreat(RETREAT_TIME);
  }

  private fireDrop(): void {
    const u = this.active!;
    const spec = this.weapon.projectile!;
    this.projectiles.push(this.makeProjectile(u.x + u.facing * 8, u.y - 10, u.facing * 30, -80, spec, u.id));
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: this.weapon.id, unit: u });
    this.beginRetreat(RETREAT_TIME + 1);
  }

  makeProjectile(x: number, y: number, vx: number, vy: number, spec: ProjectileSpec, ownerId: number): Projectile {
    return { x, y, vx, vy, spec, fuse: spec.fuse, age: 0, ownerId, rot: 0 };
  }

  private consumeAmmo(): void {
    const team = this.activeTeam!;
    const left = team.ammo.get(this.weapon.id)!;
    team.ammo.set(this.weapon.id, left - 1);
    this.hasFired = true;
  }

  private beginRetreat(time: number): void {
    this.phase = 'retreat';
    this.retreatTimer = time;
  }

  // ───────────────────────── fluxo ─────────────────────────

  start(): void {
    this.settleClock = 0;
    this.phase = 'settle';
  }

  private nextTurn(): void {
    const alive = this.aliveTeams();
    if (alive.length <= 1) {
      this.phase = 'over';
      this.active = null;
      this.winner = alive[0] ?? null;
      this.emit({ type: 'gameOver', winner: this.winner });
      return;
    }
    let team: Team;
    do {
      this.teamCursor = (this.teamCursor + 1) % this.teams.length;
      team = this.teams[this.teamCursor];
    } while (!team.units.some((u) => u.alive));

    let unit: Unit;
    do {
      unit = team.units[team.cursor % team.units.length];
      team.cursor++;
    } while (!unit.alive);

    this.turnNumber++;
    this.active = unit;
    this.wind = Math.round(this.rng.range(-10, 10));
    this.turnTimer = this.turnTime;
    this.phase = 'turn';
    this.charging = false;
    this.power = 0;
    this.hasFired = false;
    if (this.ammoOf(team.weapon) <= 0) team.weapon = 'bazooka';
    this.emit({ type: 'turnStart', unit });
  }

  private endTurn(): void {
    if (this.charging) {
      this.charging = false;
    }
    this.phase = 'settle';
    this.settleClock = 0;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'over') {
      this.stepWorld(dt);
      return;
    }

    if (this.charging) {
      this.power = Math.min(this.chargeLimit, this.power + dt / CHARGE_TIME);
      if (this.power >= this.chargeLimit) this.releaseCharge();
    }

    this.stepWorld(dt);

    if (this.phase === 'turn') {
      this.turnTimer -= dt;
      if (this.turnTimer <= 0 || !this.active?.alive) this.endTurn();
    } else if (this.phase === 'retreat') {
      this.retreatTimer -= dt;
      if ((this.retreatTimer <= 0 && this.projectiles.length === 0) || !this.active?.alive) {
        this.endTurn();
      }
    } else if (this.phase === 'settle') {
      this.updateSettle(dt);
    }
  }

  private updateSettle(dt: number): void {
    const busy = this.projectiles.length > 0 || this.units.some((u) => u.alive && !u.onGround);
    if (busy) {
      this.settleClock = 0;
      return;
    }
    this.settleClock += dt;
    if (this.settleClock < 0.6) return;
    // mortes uma de cada vez, com explosão de despedida
    const dying = this.units.find((u) => u.alive && u.hp <= 0);
    if (dying) {
      dying.alive = false;
      this.emit({ type: 'death', unit: dying, by: dying.lastHitBy });
      this.explode(dying.cx, dying.cy, 26, 12, -1);
      this.settleClock = 0.1;
      return;
    }
    this.nextTurn();
  }

  private stepWorld(dt: number): void {
    const t = this.terrain;
    for (const u of this.units) {
      if (!u.alive) continue;
      const fall = stepUnit(t, u, dt);
      if (fall > 0) this.damage(u, fall, null);
      if (u.y > t.waterY + 6 || u.x < -200 || u.x > t.width + 200) {
        u.alive = false;
        u.drowned = true;
        u.hp = 0;
        this.emit({ type: 'splash', x: u.x, y: t.waterY, big: true });
        this.emit({ type: 'death', unit: u, by: u.lastHitBy });
        if (u === this.active && (this.phase === 'turn' || this.phase === 'retreat')) this.endTurn();
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const res = stepProjectile(p, dt, this);
      if (res === 'bounce') this.emit({ type: 'bounce', x: p.x, y: p.y });
      else if (res === 'water') {
        this.emit({ type: 'splash', x: p.x, y: t.waterY, big: false });
        this.projectiles.splice(i, 1);
      } else if (res === 'lost') this.projectiles.splice(i, 1);
      else if (res === 'explode') {
        this.projectiles.splice(i, 1);
        this.explode(p.x, p.y, p.spec.blast, p.spec.damage, p.ownerId);
        const frag = p.spec.fragments;
        if (frag) {
          for (let k = 0; k < frag.count; k++) {
            const a = -Math.PI / 2 + (k - (frag.count - 1) / 2) * 0.38 + this.rng.range(-0.1, 0.1);
            const sp = this.rng.range(230, 330);
            const fp = this.makeProjectile(p.x, p.y - 4, Math.cos(a) * sp, Math.sin(a) * sp, frag.spec, p.ownerId);
            fp.age = 1;
            this.projectiles.push(fp);
          }
        }
      }
    }
  }

  explode(x: number, y: number, r: number, dmg: number, ownerId: number): void {
    const attacker = this.units.find((u) => u.id === ownerId) ?? null;
    this.terrain.carve(x, y, r);
    this.emit({ type: 'explosion', x, y, r });
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = blastDamage(r, dmg, x, y, u);
      if (d <= 0) continue;
      this.damage(u, d, attacker);
      const dx = u.cx - x;
      const dy = u.cy - y - 6;
      const len = Math.hypot(dx, dy) || 1;
      const force = 120 + d * 6.5;
      u.vx = (dx / len) * force;
      u.vy = (dy / len) * force - 80;
      u.onGround = false;
      u.fallSpeed = 0;
    }
    // granadas próximas também voam
    for (const p of this.projectiles) {
      if (p.spec.fuse === undefined) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const len = Math.hypot(dx, dy);
      if (len < r * 1.6 && len > 0) {
        p.vx += (dx / len) * 260;
        p.vy += (dy / len) * 260 - 60;
      }
    }
  }

  private damage(u: Unit, amount: number, by: Unit | null): void {
    u.hp -= amount;
    if (by) u.lastHitBy = by;
    this.emit({ type: 'damage', unit: u, amount, by });
    // apanhou durante a própria vez? acabou a vez (regra clássica de Worms)
    if (u === this.active && this.phase === 'turn') this.endTurn();
  }
}
