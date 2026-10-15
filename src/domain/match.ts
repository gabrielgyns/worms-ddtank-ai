import { ITEMS, ITEMS_START, POWER_MULT, SHIELD_MULT, type ItemId } from './items';
import { clamp, DEG, Hasher, Rng } from '../core/math';
import {
  blastDamage,
  bodyCollides,
  stepProjectile,
  stepUnit,
  unstick,
  walk,
  castRope,
  ROPE_MIN,
  ROPE_RANGE,
  type Projectile,
  type SimWorld,
} from './physics';
import { DT, type TickInput } from './commands';
import { decodeMask, encodeMask } from './codec';
import { CRATE_CHANCE, CRATE_HEALTH, CRATE_WEAPONS, stepCrate, touches, type Crate } from './crates';
import { BARREL_BLAST, MINE_BLAST, MINE_FUSE, nearMine, stepFalling, type Barrel, type Mine } from './props';
import type { Look } from './cosmetics';
import { Terrain } from './terrain';
import type { Theme } from './theme';
import { Unit, type Control, type Team } from './unit';
import { BAT, GIRDER, isBossWeapon, specByKey, specKey, WEAPONS, weaponById, type ProjectileSpec, type WeaponDef, type WeaponId } from './weapons';

export type Phase = 'turn' | 'retreat' | 'settle' | 'over';

export type GameEvent =
  | { type: 'explosion'; x: number; y: number; r: number; by: Unit | null }
  | { type: 'damage'; unit: Unit; amount: number; by: Unit | null }
  | { type: 'fire'; weapon: WeaponId; unit: Unit }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'splash'; x: number; y: number; big: boolean }
  | { type: 'death'; unit: Unit; by: Unit | null }
  | { type: 'turnStart'; unit: Unit }
  | { type: 'teleport'; fromX: number; fromY: number; unit: Unit }
  | { type: 'jump'; unit: Unit }
  | { type: 'select'; weapon: WeaponId }
  | { type: 'crateDrop'; crate: Crate }
  | { type: 'suddenDeath' }
  | { type: 'mineArmed'; mine: Mine }
  | { type: 'rope'; unit: Unit; hit: boolean }
  | { type: 'chute'; unit: Unit }
  | { type: 'waterRise'; y: number }
  | { type: 'cratePick'; crate: Crate; unit: Unit }
  | { type: 'item'; item: ItemId; unit: Unit }
  | { type: 'bat'; x: number; y: number; unit: Unit }
  | { type: 'girder'; x: number; y: number; unit: Unit }
  | { type: 'gameOver'; winner: Team | null };

export interface TeamSetup {
  name: string;
  color: string;
  light: string;
  dark: string;
  control: Control;
  names: string[];
  look?: Look;
  /** lado (aliança); padrão = um lado por time */
  side?: number;
  /** time do chefão: uma bolota gigante */
  boss?: boolean;
  /** posições fixas (missões): uma bolota por entrada, com vida opcional */
  spawns?: Array<{ x: number; hp?: number }>;
  /** munição fixa (missões): só estas armas, nestas quantidades */
  ammo?: Partial<Record<WeaponId, number>>;
  /** itens de turno no começo (padrão: um de cada; chefão e alvos: nenhum) */
  items?: Partial<Record<ItemId, number>>;
}

export interface MatchSetup {
  teams: TeamSetup[];
  unitsPerTeam: number;
  theme: Theme;
  seed: number;
  turnTime: number;
  /** caixas caindo do céu (padrão: sim) */
  crates?: boolean;
  /** turno em que começa a morte súbita (0 = nunca; padrão 20) */
  suddenDeath?: number;
  /** vida do chefão (modo co-op) */
  bossHp?: number;
  /** barris, minas e vigas de metal (padrão: sim) */
  objects?: boolean;
  /** mapa desenhado no editor (máscara codificada); sem isso, o terreno é gerado */
  map?: string;
  /** vento fixo em todos os turnos (missões) */
  wind?: number;
  /** barris e minas em posições fixas (missões) */
  props?: { barrels: number[]; mines: number[] };
}

export const BOSS_SIZE = 2.2;
export const WORLD_W = 2800;
export const WORLD_H = 1400;
export const WATER_Y = 1330;

/** Vida do chefão conforme quantas bolotas enfrentam ele e a dificuldade. */
export function bossHpFor(playerUnits: number, difficulty: 'facil' | 'normal' | 'dificil' = 'normal'): number {
  const mult = { facil: 0.7, normal: 1, dificil: 1.4 }[difficulty];
  return Math.round((85 * playerUnits * mult) / 10) * 10;
}

/** Time do chefão pronto para o setup. */
export const BOSS_TEAM: TeamSetup = {
  name: 'Rei Bolotão',
  color: '#7a3cc4',
  light: '#c9a6ff',
  dark: '#3d1d6e',
  control: 'cpu',
  names: ['Rei Bolotão'],
  look: { hat: 'hat-crown', eyes: undefined },
  side: 1,
  boss: true,
};

/** Quanto a água sobe por turno na morte súbita. */
export const WATER_RISE = 28;

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
  teams: Array<{ cursor: number; weapon: WeaponId; ammo: Array<[WeaponId, number]>; items?: Array<[ItemId, number]> }>;
  /** itens ligados nesta vez */
  boost?: { power: boolean; double: boolean };
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
    rope?: { ax: number; ay: number; len: number } | null;
    chute?: boolean;
    shield?: boolean;
  }>;
  projectiles: Array<{ x: number; y: number; vx: number; vy: number; spec: string; fuse: number | null; age: number; ownerId: number; rot: number; dir?: 1 | -1; tx?: number; ty?: number }>;
  homingTarget?: { x: number; y: number } | null;
  terrain: string;
  crates: Crate[];
  nextCrateId: number;
  waterY: number;
  barrels: Barrel[];
  mines: Mine[];
  nextPropId: number;
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
  readonly crates: Crate[] = [];
  readonly barrels: Barrel[] = [];
  readonly mines: Mine[] = [];
  private nextPropId = 1;
  private nextCrateId = 1;
  /** caixas ligadas nesta partida */
  readonly cratesOn: boolean;
  readonly suddenDeathAt: number;
  private customMap = false;
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
  /** marca do míssil teleguiado nesta vez */
  homingTarget: { x: number; y: number } | null = null;
  /** itens ativos na vez atual (somem quando a vez acaba) */
  readonly boost = { power: false, double: false };
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
    this.cratesOn = setup.crates ?? true;
    this.suddenDeathAt = setup.suddenDeath ?? 20;
    this.terrain = new Terrain(WORLD_W, WORLD_H, WATER_Y);
    if (setup.map) decodeMask(setup.map, this.terrain.solid);
    else this.terrain.generate(this.rng);
    this.customMap = !!setup.map;

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
        ammo: new Map(WEAPONS.map((w) => [w.id, ts.ammo ? (ts.ammo[w.id] ?? 0) : w.ammo])),
        weapon: 'bazooka',
        look: ts.look ?? {},
        side: ts.side ?? i,
        boss: !!ts.boss,
        items: new Map(ITEMS.map((it) => [it.id, ts.items ? (ts.items[it.id] ?? 0) : ts.boss || ts.control === 'dummy' ? 0 : ITEMS_START[it.id]])),
      });
    });
    this.windFixed = setup.wind ?? null;
    this.spawnUnits(setup);
    if (setup.props) this.placeProps(setup.props);
    else if (setup.objects ?? true) this.spawnProps();
  }

  private readonly windFixed: number | null;

  private placeProps(p: { barrels: number[]; mines: number[] }): void {
    const t = this.terrain;
    for (const x of p.barrels) this.barrels.push({ id: this.nextPropId++, x, y: t.surfaceY(x), vy: 0, landed: false, fuse: null });
    for (const x of p.mines) this.mines.push({ id: this.nextPropId++, x, y: t.surfaceY(x), vy: 0, landed: false, fuse: null });
  }

  /** Vigas de metal, barris e minas espalhados longe das bolotas. */
  private spawnProps(): void {
    const t = this.terrain;
    // mapa desenhado: o autor já pôs o metal que quis
    if (!this.customMap) t.addGirders(this.rng, this.rng.int(1, 3));
    const taken: number[] = this.units.map((u) => u.x);
    const place = (): { x: number; y: number } | null => {
      for (let tries = 0; tries < 30; tries++) {
        const x = Math.round(this.rng.range(240, t.width - 240));
        const y = t.surfaceY(x);
        if (y > t.waterY - 30) continue;
        if (taken.some((o) => Math.abs(o - x) < 70)) continue;
        taken.push(x);
        return { x, y };
      }
      return null;
    };
    const barrels = this.rng.int(3, 5);
    for (let i = 0; i < barrels; i++) {
      const p = place();
      if (p) this.barrels.push({ id: this.nextPropId++, x: p.x, y: p.y, vy: 0, landed: false, fuse: null });
    }
    const mines = this.rng.int(3, 5);
    for (let i = 0; i < mines; i++) {
      const p = place();
      if (p) this.mines.push({ id: this.nextPropId++, x: p.x, y: p.y, vy: 0, landed: false, fuse: null });
    }
  }

  on(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private spawnUnits(setup: MatchSetup): void {
    const players = this.teams.filter((t) => !t.boss && !setup.teams[t.id].spawns);
    const total = setup.unitsPerTeam * players.length;
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
      for (const team of players) {
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
    // posições fixas (missões)
    for (const team of this.teams) {
      const spawns = setup.teams[team.id].spawns;
      if (!spawns) continue;
      spawns.forEach((sp, n) => {
        const names = setup.teams[team.id].names;
        const u = new Unit(id++, team, names[n % names.length], sp.x, t.surfaceY(sp.x));
        if (sp.hp) u.hp = sp.hp;
        u.facing = sp.x < t.width / 2 ? 1 : -1;
        unstick(t, u);
        team.units.push(u);
        this.units.push(u);
      });
    }
    // chefão: gigante, no centro do mapa, num pedaço de chão firme
    for (const team of this.teams.filter((t) => t.boss)) {
      let x = t.width / 2;
      for (let tries = 0; tries < 40 && t.surfaceY(x) > t.waterY - 80; tries++) x = this.rng.range(t.width * 0.3, t.width * 0.7);
      const u = new Unit(id++, team, setup.teams[team.id].names[0] ?? 'Rei Bolotão', x, t.surfaceY(x));
      u.size = BOSS_SIZE;
      u.hp = setup.bossHp ?? 500;
      u.facing = -1;
      unstick(t, u);
      team.units.push(u);
      this.units.push(u);
    }
  }

  private hasAttackAmmo(t: Team): boolean {
    return WEAPONS.some((w) => w.mode !== 'utility' && w.id !== 'teleport' && (t.ammo.get(w.id) ?? 0) > 0);
  }

  /** Lados que ainda têm alguém vivo. */
  aliveSides(): number[] {
    return [...new Set(this.aliveTeams().map((t) => t.side))];
  }

  get weapon(): WeaponDef {
    return weaponById(this.activeTeam?.weapon ?? 'bazooka');
  }

  get activeTeam(): Team | null {
    return this.active?.team ?? null;
  }

  ammoOf(id: WeaponId): number {
    const team = this.activeTeam;
    if (!team) return 0;
    if (isBossWeapon(id)) return team.boss ? Infinity : 0;
    return team.ammo.get(id) ?? 0;
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
    h.int(this.tick).str(this.phase).int(this.wind).int(this.turnNumber).int(this.rng.state).num(this.terrain.waterY);
    h.num(this.turnTimer).num(this.retreatTimer).num(this.power).int(this.charging ? 1 : 0);
    h.int(this.active?.id ?? -1).int(this.boost.power ? 1 : 0).int(this.boost.double ? 1 : 0);
    if (this.homingTarget) h.num(this.homingTarget.x).num(this.homingTarget.y);
    for (const t of this.teams) {
      h.int(t.cursor).str(t.weapon);
      for (const [id, n] of t.ammo) h.str(id).num(n);
      for (const [id, n] of t.items) h.str(id).num(n);
    }
    for (const u of this.units) {
      h.num(u.x).num(u.y).num(u.vx).num(u.vy).num(u.hp).num(u.aim).int(u.facing);
      h.int(u.alive ? 1 : 0).int(u.onGround ? 1 : 0).int(u.chute ? 1 : 0).int(u.shield ? 1 : 0);
      if (u.rope) h.num(u.rope.ax).num(u.rope.ay).num(u.rope.len);
    }
    for (const p of this.projectiles) h.num(p.x).num(p.y).num(p.vx).num(p.vy).num(p.fuse ?? -1).str(p.spec.kind).int(p.dir ?? 0).num(p.tx ?? -1).num(p.ty ?? -1);
    for (const c of this.crates) h.int(c.id).num(c.x).num(c.y).num(c.vy).str(c.kind).int(c.landed ? 1 : 0);
    for (const b of this.barrels) h.int(b.id).num(b.x).num(b.y).num(b.vy).num(b.fuse ?? -1);
    for (const mn of this.mines) h.int(mn.id).num(mn.x).num(mn.y).num(mn.vy).num(mn.fuse ?? -1);
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
      teams: this.teams.map((t) => ({ cursor: t.cursor, weapon: t.weapon, ammo: [...t.ammo].map(([id, n]) => [id, inf(n)]), items: [...t.items] })),
      boost: { ...this.boost },
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
        rope: u.rope ? { ...u.rope } : null,
        chute: u.chute,
        shield: u.shield,
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
        dir: p.dir,
        tx: p.tx,
        ty: p.ty,
      })),
      homingTarget: this.homingTarget ? { ...this.homingTarget } : null,
      terrain: encodeMask(this.terrain.solid),
      crates: this.crates.map((c) => ({ ...c })),
      nextCrateId: this.nextCrateId,
      waterY: this.terrain.waterY,
      barrels: this.barrels.map((b) => ({ ...b })),
      mines: this.mines.map((mn) => ({ ...mn })),
      nextPropId: this.nextPropId,
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
    this.homingTarget = s.homingTarget ? { ...s.homingTarget } : null;
    this.boost.power = s.boost?.power ?? false;
    this.boost.double = s.boost?.double ?? false;
    s.teams.forEach((st, i) => {
      const t = this.teams[i];
      t.cursor = st.cursor;
      t.weapon = st.weapon;
      if (st.items) t.items = new Map(st.items);
      t.ammo = new Map(st.ammo.map(([id, n]) => [id, n < 0 ? Infinity : n]));
    });
    s.units.forEach((su, i) => Object.assign(this.units[i], su));
    this.projectiles.length = 0;
    for (const p of s.projectiles) {
      this.projectiles.push({ ...p, spec: specByKey(p.spec), fuse: p.fuse ?? undefined });
    }
    this.crates.length = 0;
    for (const c of s.crates ?? []) this.crates.push({ ...c });
    this.nextCrateId = s.nextCrateId ?? 1;
    if (s.waterY !== undefined) this.terrain.waterY = s.waterY;
    this.barrels.length = 0;
    for (const b of s.barrels ?? []) this.barrels.push({ ...b });
    this.mines.length = 0;
    for (const mn of s.mines ?? []) this.mines.push({ ...mn });
    this.nextPropId = s.nextPropId ?? 1;
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
    if (i.item !== undefined) this.useItem(i.item);
    if (i.charge === 'start') {
      if (this.phase === 'retreat') this.detonateWalkers();
      else this.startCharge(i.chargeLimit ?? 1);
    }
    if (i.charge === 'release') this.releaseCharge();
    if (i.target !== undefined) this.fireAt(i.target.x, i.target.y);
    if (i.forfeit !== undefined) this.forfeit(i.forfeit);
  }

  /** Ângulo da viga: segue a mira da bolota da vez. */
  girderAngle(): number {
    const u = this.active;
    if (!u) return 0;
    return Math.atan2(-Math.sin(u.aim), Math.cos(u.aim) * u.facing);
  }

  /** A viga cabe aqui? Perto da bolota, dentro do mapa e sem cobrir ninguém. */
  girderFits(x: number, y: number): boolean {
    const u = this.active;
    if (!u || Math.hypot(x - u.cx, y - u.cy) > GIRDER.range) return false;
    if (x < 30 || x > this.terrain.width - 30 || y < 10 || y > this.terrain.waterY - 10) return false;
    const w = this.terrain.width;
    for (const i of this.terrain.beamCells(x, y, this.girderAngle(), GIRDER.len, GIRDER.thick + 6)) {
      const cx = i % w;
      const cy = (i - cx) / w;
      for (const o of this.units) if (o.alive && Math.hypot(cx - o.cx, cy - o.cy) < o.radius + 2) return false;
    }
    return true;
  }

  /** Taco: quem estiver logo à frente leva dano e voa na direção da mira. */
  private swingBat(): void {
    const u = this.active!;
    const hx = u.cx + u.facing * BAT.reach * u.size;
    const hy = u.cy;
    const dx = Math.cos(u.aim) * u.facing;
    const dy = -Math.sin(u.aim);
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: 'bat', unit: u });
    for (const o of this.units) {
      if (!o.alive || o === u) continue;
      if (Math.hypot(o.cx - hx, o.cy - hy) > BAT.reach + o.radius) continue;
      const d = this.boost.power ? Math.round(BAT.damage * POWER_MULT) : BAT.damage;
      this.damage(o, o.shield ? Math.max(1, Math.round(d * SHIELD_MULT)) : d, u);
      const force = BAT.launch / (o.size * o.size);
      o.vx = dx * force;
      o.vy = dy * force - 60;
      o.onGround = false;
      o.fallSpeed = 0;
      this.emit({ type: 'bat', x: o.cx, y: o.cy, unit: o });
    }
    this.beginRetreat(RETREAT_TIME);
  }

  /** Espaço de novo depois de soltar a ovelha: ela explode na hora. */
  private detonateWalkers(): void {
    const me = this.active;
    if (!me) return;
    for (const p of this.projectiles) if (p.spec.walker && p.ownerId === me.id) p.fuse = 0;
  }

  /** Gasta um item de turno. Vale antes de atirar; não passa a vez. */
  useItem(id: ItemId): boolean {
    const u = this.active;
    if (!u || this.phase !== 'turn' || this.hasFired || this.charging) return false;
    const team = u.team;
    if ((team.items.get(id) ?? 0) <= 0) return false;
    if (id === 'shield') {
      if (u.shield) return false;
      u.shield = true;
    } else {
      if (this.boost[id]) return false;
      this.boost[id] = true;
    }
    team.items.set(id, team.items.get(id)! - 1);
    this.emit({ type: 'item', item: id, unit: u });
    return true;
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
    const u = this.active!;
    if (u.rope) {
      // na corda: balança
      u.vx += dir * 340 * dt;
      u.facing = dir;
      return;
    }
    walk(this.terrain, u, dir, dt);
  }

  face(dir: 1 | -1): void {
    if (this.canAct() && !this.charging) this.active!.facing = dir;
  }

  jump(back = false): void {
    if (!this.canAct() || this.charging) return;
    const u = this.active!;
    if (u.rope) {
      // pular da corda: solta mantendo o embalo
      u.rope = null;
      u.vy -= 120;
      return;
    }
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
    if (!this.active) return;
    const rope = this.active.rope;
    if (rope && this.canAct()) {
      // na corda: ↑ encurta, ↓ estica
      rope.len = clamp(rope.len - delta * 160, ROPE_MIN, ROPE_RANGE);
      return;
    }
    if (this.phase !== 'turn') return;
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
    if (this.active?.rope && this.canAct()) {
      // disparar de novo solta a corda
      this.active.rope = null;
      return;
    }
    if (this.phase !== 'turn' || !this.active || this.hasFired) return;
    if (this.ammoOf(this.weapon.id) <= 0) return;
    if (this.weapon.mode === 'utility') {
      this.useUtility();
      return;
    }
    if (this.weapon.mode === 'drop') {
      this.fireDrop();
      return;
    }
    if (this.weapon.mode === 'melee') {
      this.swingBat();
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
    // teleguiado: o clique só marca o alvo; o tiro sai carregando a força
    if (this.phase === 'turn' && this.active && this.weapon.projectile?.homing && !this.charging) {
      this.homingTarget = { x, y };
      return true;
    }
    if (this.phase !== 'turn' || !this.active || this.hasFired || this.weapon.mode !== 'target') return false;
    if (this.ammoOf(this.weapon.id) <= 0) return false;
    const u = this.active;
    if (this.weapon.id === 'girder') {
      if (!this.girderFits(x, y)) return false;
      this.terrain.addBeam(x, y, this.girderAngle(), GIRDER.len, GIRDER.thick);
      this.consumeAmmo();
      this.emit({ type: 'girder', x, y, unit: u });
      this.beginRetreat(1.2);
      return true;
    }
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
    // ataque aéreo: cinco mísseis vindos do céu (chefão: três meteoros quase na vertical)
    const spec = this.weapon.projectile!;
    const dir = x >= u.x ? 1 : -1;
    if (this.weapon.id === 'boss-meteoro') {
      for (let i = 0; i < 3; i++) {
        this.projectiles.push({ x: x + (i - 1) * 45, y: -60 - i * 50, vx: 0, vy: 260, spec, age: 1, ownerId: u.id, rot: 0 });
      }
      this.consumeAmmo();
      this.emit({ type: 'fire', weapon: this.weapon.id, unit: u });
      this.beginRetreat(RETREAT_TIME);
      return true;
    }
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

  /** Corda ninja e paraquedas: não gastam a vez. */
  private useUtility(): void {
    const u = this.active!;
    const team = u.team;
    const id = this.weapon.id;
    if (id === 'rope') {
      const dx = Math.cos(u.aim) * u.facing;
      const dy = -Math.sin(u.aim);
      const hit = castRope(this.terrain, u.cx, u.cy, dx, dy);
      this.emit({ type: 'rope', unit: u, hit: !!hit });
      if (!hit) return;
      // a corda já nasce um pouco curta: tira a bolota do chão
      u.rope = { ax: hit.x, ay: hit.y, len: Math.max(ROPE_MIN, Math.hypot(hit.x - u.cx, hit.y - u.cy) - 10) };
      u.onGround = false;
      u.y -= 3;
      team.ammo.set(id, team.ammo.get(id)! - 1);
    } else if (id === 'parachute') {
      if (u.onGround || u.chute) return;
      u.chute = true;
      team.ammo.set(id, team.ammo.get(id)! - 1);
      this.emit({ type: 'chute', unit: u });
    }
  }

  private fireCharged(power: number): void {
    const u = this.active!;
    const w = this.weapon;
    for (const extra of w.spread ?? [0]) {
      const p = this.launch(u, extra, power);
      if (w.projectile?.homing && this.homingTarget) {
        p.tx = this.homingTarget.x;
        p.ty = this.homingTarget.y;
      }
      this.projectiles.push(p);
    }
    u.lastPower = power;
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: w.id, unit: u });
    this.beginRetreat(RETREAT_TIME);
  }

  private fireDrop(): void {
    const u = this.active!;
    const spec = this.weapon.projectile!;
    if (this.weapon.id === 'boss-pisao') {
      this.consumeAmmo();
      this.emit({ type: 'fire', weapon: this.weapon.id, unit: u });
      this.explode(u.x, u.y - 6, spec.blast, spec.damage, u.id, u);
      this.beginRetreat(RETREAT_TIME);
      return;
    }
    if (spec.walker) {
      // ovelha: sai pulando na direção em que a bolota olha
      const sheep = this.makeProjectile(u.x + u.facing * 18, u.y - 12, 0, -160, spec, u.id);
      sheep.dir = u.facing;
      this.projectiles.push(sheep);
    } else this.projectiles.push(this.makeProjectile(u.x + u.facing * 8, u.y - 10, u.facing * 30, -80, spec, u.id));
    this.consumeAmmo();
    this.emit({ type: 'fire', weapon: this.weapon.id, unit: u });
    this.beginRetreat(RETREAT_TIME + 1);
  }

  /** O projétil que sairia agora do cano (o tiro de verdade e a prévia usam o mesmo). */
  private launch(u: Unit, extraDeg: number, power: number): Projectile {
    const w = this.weapon;
    const speed = w.maxSpeed * Math.max(0.06, power);
    const a = u.aim + extraDeg * DEG;
    const dx = Math.cos(a) * u.facing;
    const dy = -Math.sin(a);
    return this.makeProjectile(u.cx + dx * 16 * u.size, u.cy + dy * 16 * u.size, dx * speed, dy * speed, w.projectile!, u.id);
  }

  /**
   * Começo da trajetória do tiro que está sendo carregado, para a prévia na
   * mira. Curta de propósito: mostra força e vento sem entregar onde cai.
   * Só consulta; a partida não muda.
   */
  previewShot(seconds: number): Array<{ x: number; y: number }> {
    const u = this.active;
    if (!u || !this.charging || this.weapon.mode !== 'charge' || !this.weapon.projectile) return [];
    const p = this.launch(u, 0, this.power);
    const pts = [{ x: p.x, y: p.y }];
    for (let i = 0; i < seconds * 60; i++) {
      const r = stepProjectile(p, DT, this);
      if (r !== 'fly' && r !== 'bounce') break;
      if (i % 3 === 2) pts.push({ x: p.x, y: p.y });
    }
    return pts;
  }

  makeProjectile(x: number, y: number, vx: number, vy: number, spec: ProjectileSpec, ownerId: number): Projectile {
    return { x, y, vx, vy, spec, fuse: spec.fuse, age: 0, ownerId, rot: 0 };
  }

  private consumeAmmo(): void {
    const team = this.activeTeam!;
    if (!isBossWeapon(this.weapon.id)) team.ammo.set(this.weapon.id, team.ammo.get(this.weapon.id)! - 1);
    this.hasFired = true;
  }

  private beginRetreat(time: number): void {
    // tiro duplo: o primeiro tiro não encerra a vez
    if (this.boost.double && this.weapon.mode === 'charge' && this.phase === 'turn') {
      this.boost.double = false;
      this.hasFired = false;
      return;
    }
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
    if (this.aliveSides().length <= 1) {
      this.phase = 'over';
      this.active = null;
      this.winner = alive[0] ?? null;
      this.emit({ type: 'gameOver', winner: this.winner });
      return;
    }
    // missão: sem munição de ataque e com alvos de pé = não deu
    const players = this.teams.filter((t) => t.control !== 'dummy');
    if (players.length < this.teams.length && players.every((t) => !this.hasAttackAmmo(t))) {
      this.phase = 'over';
      this.active = null;
      this.winner = this.teams.find((t) => t.control === 'dummy' && t.units.some((u) => u.alive)) ?? null;
      this.emit({ type: 'gameOver', winner: this.winner });
      return;
    }
    let team: Team;
    do {
      this.teamCursor = (this.teamCursor + 1) % this.teams.length;
      team = this.teams[this.teamCursor];
    } while (!team.units.some((u) => u.alive) || team.control === 'dummy');

    let unit: Unit;
    do {
      unit = team.units[team.cursor % team.units.length];
      team.cursor++;
    } while (!unit.alive);

    this.turnNumber++;
    // morte súbita: a água sobe um pouco a cada turno
    if (this.suddenDeathAt > 0 && this.turnNumber >= this.suddenDeathAt) {
      if (this.turnNumber === this.suddenDeathAt) this.emit({ type: 'suddenDeath' });
      else {
        this.terrain.waterY -= WATER_RISE;
        this.emit({ type: 'waterRise', y: this.terrain.waterY });
      }
    }
    this.active = unit;
    this.wind = Math.round(this.rng.range(-10, 10));
    if (this.windFixed !== null) this.wind = this.windFixed;
    if (this.cratesOn && this.turnNumber > 1 && this.rng.next() < CRATE_CHANCE) this.dropCrate();
    this.turnTimer = this.turnTime;
    this.phase = 'turn';
    this.charging = false;
    this.power = 0;
    this.hasFired = false;
    this.boost.power = false;
    this.boost.double = false;
    this.homingTarget = null;
    // o escudo vale até a próxima vez do próprio time
    for (const tu of team.units) tu.shield = false;
    if (this.ammoOf(team.weapon) <= 0) team.weapon = WEAPONS.find((w) => this.ammoOf(w.id) > 0)?.id ?? 'bazooka';
    this.emit({ type: 'turnStart', unit });
  }

  private dropCrate(): void {
    const t = this.terrain;
    let x = this.rng.range(250, t.width - 250);
    // tenta cair em terra firme
    for (let i = 0; i < 10 && t.surfaceY(x) > t.waterY - 30; i++) x = this.rng.range(250, t.width - 250);
    const health = this.rng.next() < 0.45;
    const crate: Crate = {
      id: this.nextCrateId++,
      x: Math.round(x),
      y: -40,
      vy: 0,
      kind: health ? 'health' : 'weapon',
      weapon: health ? null : CRATE_WEAPONS[Math.floor(this.rng.next() * CRATE_WEAPONS.length)],
      landed: false,
    };
    this.crates.push(crate);
    this.emit({ type: 'crateDrop', crate });
  }

  private pickCrate(c: Crate, u: Unit): void {
    this.crates.splice(this.crates.indexOf(c), 1);
    if (c.kind === 'health') u.hp += CRATE_HEALTH;
    else if (c.weapon) u.team.ammo.set(c.weapon, (u.team.ammo.get(c.weapon) ?? 0) + 1);
    this.emit({ type: 'cratePick', crate: c, unit: u });
  }

  private endTurn(): void {
    if (this.charging) {
      this.charging = false;
    }
    if (this.active) this.active.rope = null;
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
    const busy =
      this.projectiles.length > 0 ||
      this.units.some((u) => u.alive && !u.onGround) ||
      this.crates.some((c) => !c.landed) ||
      this.barrels.some((b) => !b.landed || b.fuse !== null) ||
      this.mines.some((mn) => !mn.landed || mn.fuse !== null);
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
      const fall = stepUnit(t, u, dt, this.wind);
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

    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (!stepFalling(t, b, dt, 7)) {
        this.barrels.splice(i, 1);
        continue;
      }
      if (b.fuse !== null && (b.fuse -= dt) <= 0) {
        this.barrels.splice(i, 1);
        this.explode(b.x, b.y - 10, BARREL_BLAST.r, BARREL_BLAST.dmg, -1);
      }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mn = this.mines[i];
      if (!stepFalling(t, mn, dt, 6)) {
        this.mines.splice(i, 1);
        continue;
      }
      if (mn.fuse === null) {
        if (this.units.some((u) => u.alive && nearMine(mn, u))) {
          mn.fuse = MINE_FUSE;
          this.emit({ type: 'mineArmed', mine: mn });
        }
      } else if ((mn.fuse -= dt) <= 0) {
        this.mines.splice(i, 1);
        this.explode(mn.x, mn.y - 4, MINE_BLAST.r, MINE_BLAST.dmg, -1);
      }
    }

    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (!stepCrate(t, c, dt)) {
        this.crates.splice(i, 1);
        this.emit({ type: 'splash', x: c.x, y: t.waterY, big: false });
        continue;
      }
      const u = this.units.find((u) => u.alive && touches(c, u));
      if (u) this.pickCrate(c, u);
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

  explode(x: number, y: number, r: number, dmg: number, ownerId: number, spare: Unit | null = null): void {
    const attacker = this.units.find((u) => u.id === ownerId) ?? null;
    this.terrain.carve(x, y, r);
    this.emit({ type: 'explosion', x, y, r, by: attacker });
    for (const u of this.units) {
      if (!u.alive || u === spare) continue;
      let d = blastDamage(r, dmg, x, y, u);
      if (d <= 0) continue;
      if (this.boost.power && attacker && attacker === this.active) d = Math.round(d * POWER_MULT);
      if (u.shield) d = Math.max(1, Math.round(d * SHIELD_MULT));
      this.damage(u, d, attacker);
      const dx = u.cx - x;
      const dy = u.cy - y - 6;
      const len = Math.hypot(dx, dy) || 1;
      const force = (120 + d * 6.5) / (u.size * u.size);
      u.vx = (dx / len) * force;
      u.vy = (dy / len) * force - 80;
      u.onGround = false;
      u.fallSpeed = 0;
    }
    // explosão perto de barril ou mina: reação em cadeia
    for (const b of this.barrels) if (b.fuse === null && Math.hypot(b.x - x, b.y - 10 - y) < r + 14) b.fuse = 0.15;
    for (const mn of this.mines) if (Math.hypot(mn.x - x, mn.y - 4 - y) < r + 10) mn.fuse = Math.min(mn.fuse ?? 0.3, 0.3);
    // caixas no raio da explosão viram pó
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (Math.hypot(c.x - x, c.y - 8 - y) < r + 10) this.crates.splice(i, 1);
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
