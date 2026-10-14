import type { Sfx } from './core/audio';
import type { Input } from './core/input';
import { AiController, type Difficulty } from './domain/ai';
import { DT, isEmptyInput, NO_INPUT, type Command, type TickInput } from './domain/commands';
import { Match, type MatchSetup } from './domain/match';
import { WEAPONS, type WeaponId } from './domain/weapons';
import { Background, drawWater } from './render/background';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { drawCrate, drawCrosshair, drawDragPower, drawLabel, drawProjectile, drawUnit } from './render/sprites';
import { FrameMeter, HIGH, LOW, type Quality } from './render/quality';
import { TerrainView } from './render/terrainView';
import { deviceProfile, vibrate } from './platform/device';

/**
 * De onde vêm as entradas de cada tick quando não é o jogo local padrão
 * (rede). `next` devolver null significa "ainda não pode avançar".
 */
export interface TickDriver {
  beforeFrame?(g: Game): void;
  next(g: Game): TickInput | null;
  afterStep?(g: Game, input: TickInput, tick: number): void;
  afterFrame?(g: Game): void;
  /** ticks extras para alcançar o host quando ficou para trás */
  catchUp?(g: Game): number;
}

export interface GameOptions {
  difficulty: Difficulty;
  replay?: readonly Command[];
  /** times controlados neste aparelho (padrão: todos os humanos) */
  localTeams?: number[];
  driver?: TickDriver;
}

/** Liga partida, controladores, câmera, render e som. */
export class Game {
  readonly match: Match;
  readonly cam: Camera;
  private terrainView: TerrainView;
  private bg: Background;
  readonly fx: Effects;
  private ai: AiController;
  private acc = 0;
  private time = 0;
  paused = false;
  private lastTick = -1;
  private hoverWorld: { x: number; y: number } | null = null;
  /** comandos de clique (HUD, mapa) esperando o próximo tick */
  private pending: TickInput = {};
  /** todos os comandos aplicados, para replay */
  readonly log: Command[] = [];
  /** se definido, a partida é um replay: as entradas vêm daqui */
  private replay: readonly Command[] | null = null;
  private replayIdx = 0;
  /** velocidade da simulação (replay pode ir em 2x, 4x) */
  speed = 1;
  private quality: Quality = HIGH;
  /** nível da água desenhado (sobe suave até o da regra) */
  private waterDrawY = 0;
  private meter = new FrameMeter();
  private localTeams: Set<number> | null;
  private driver: TickDriver | null;

  constructor(
    readonly setup: MatchSetup,
    opts: GameOptions,
    private canvas: HTMLCanvasElement,
    private input: Input,
    private sfx: Sfx,
  ) {
    this.replay = opts.replay ?? null;
    this.localTeams = opts.localTeams ? new Set(opts.localTeams) : null;
    this.driver = opts.driver ?? null;
    const difficulty = opts.difficulty;
    this.match = new Match(setup);
    const t = this.match.terrain;
    this.cam = new Camera(t.width, t.height);
    this.cam.x = t.width / 2;
    this.cam.y = t.height * 0.55;
    this.terrainView = new TerrainView(t, setup.theme);
    this.bg = new Background(setup.theme, t.height);
    this.fx = new Effects(this.match, this.cam);
    this.ai = new AiController(difficulty);
    const p = deviceProfile();
    this.setQuality(p.touch && p.small ? LOW : HIGH);
    this.wireSound();
    this.match.start();
  }

  private wireSound(): void {
    this.match.on((e) => {
      const s = this.sfx;
      switch (e.type) {
        case 'explosion':
          s.explosion(e.r);
          if (!s.muted && !this.replay) vibrate(Math.min(120, 20 + e.r));
          break;
        case 'fire':
          s.chargeStop();
          if (e.weapon === 'grenade' || e.weapon === 'dynamite') s.throwIt();
          else if (e.weapon !== 'teleport') s.shoot();
          break;
        case 'bounce':
          s.bounce();
          break;
        case 'splash':
          s.splash();
          break;
        case 'death':
          s.death();
          break;
        case 'turnStart':
          s.turn();
          this.cam.manual = 0;
          break;
        case 'teleport':
          s.teleport();
          break;
        case 'jump':
          s.jump();
          break;
        case 'select':
          s.select();
          break;
        case 'cratePick':
          s.pickup();
          break;
        case 'crateDrop':
          s.whoosh();
          break;
        case 'damage':
          s.ouch();
          if (!s.muted && e.unit.team.control === 'human' && !this.replay) vibrate([30, 40, 30]);
          break;
        case 'gameOver':
          s.chargeStop();
          if (e.winner) s.victory();
          break;
      }
    });
  }

  get isReplay(): boolean {
    return this.replay !== null;
  }

  /** partida em rede (o tempo não para: não dá para pausar) */
  get online(): boolean {
    return this.driver !== null;
  }

  /** Este time é jogado por alguém neste aparelho? */
  isLocal(teamId: number): boolean {
    const team = this.match.teams[teamId];
    if (!team || team.control !== 'human') return false;
    return this.localTeams ? this.localTeams.has(teamId) : true;
  }

  get humanTurn(): boolean {
    const team = this.match.activeTeam;
    return !this.replay && !!team && this.isLocal(team.id);
  }

  /** Clique no mundo (coordenadas de tela). */
  clickAt(px: number, py: number): void {
    if (!this.humanTurn || this.paused || this.match.weapon.mode !== 'target') return;
    const w = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
    this.pending.target = { x: Math.round(w.x), y: Math.round(w.y) };
  }

  /** Mira por arrastar (estilingue): direção = ângulo, distância = força. */
  private dragAim: { power: number } | null = null;
  private static readonly DRAG_FULL = 170; // px de tela para força 100%

  /** Começa a mirar se o toque/clique foi perto da bolota da vez. */
  beginAim(px: number, py: number): boolean {
    const m = this.match;
    const u = m.active;
    if (!this.humanTurn || this.paused || !u || m.phase !== 'turn' || m.weapon.mode !== 'charge' || m.charging) return false;
    const w = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
    const reach = Math.max(34, 48 / this.cam.zoom);
    if (Math.hypot(w.x - u.cx, w.y - u.cy) > reach) return false;
    this.dragAim = { power: 0 };
    this.cam.manual = 0;
    return true;
  }

  moveAim(px: number, py: number): void {
    const u = this.match.active;
    if (!this.dragAim || !u) return;
    const w = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
    const dx = w.x - u.cx;
    const dy = w.y - u.cy;
    const dist = Math.hypot(dx, dy) * this.cam.zoom;
    this.dragAim.power = Math.min(1, dist / Game.DRAG_FULL);
    if (dist < 12) return;
    const face: 1 | -1 = Math.abs(dx) < 2 ? u.facing : dx > 0 ? 1 : -1;
    this.pending.face = face;
    this.pending.aimTo = Math.atan2(-dy, Math.abs(dx));
  }

  /** Soltou: atira com a força do arrasto (a barra enche até ela, estilo DDTank). */
  endAim(): void {
    const d = this.dragAim;
    this.dragAim = null;
    if (!d || d.power < 0.08) return;
    this.pending.charge = 'start';
    this.pending.chargeLimit = d.power;
  }

  get aimingByDrag(): boolean {
    return this.dragAim !== null;
  }

  /** Pedido de troca de arma vindo da interface. */
  requestWeapon(id: WeaponId): void {
    if (this.humanTurn && !this.paused) this.pending.weapon = id;
  }

  hover(px: number, py: number): void {
    this.hoverWorld = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.fx.quality = q;
  }

  frame(realDt: number): void {
    if (this.quality !== LOW && this.meter.sample(realDt)) this.setQuality(LOW);
    if (this.paused) {
      this.input.endFrame();
      this.input.takeKeys();
      this.render();
      return;
    }
    this.acc += Math.min(0.1, realDt) * this.speed;
    const d = this.driver;
    d?.beforeFrame?.(this);
    const extra = d?.catchUp?.(this) ?? 0;
    let steps = 0;
    while (this.acc >= DT || steps < extra) {
      const input = d ? d.next(this) : this.localInput();
      if (input === null) {
        // rede: esperando o host — não acumula atraso
        this.acc = Math.min(this.acc, DT);
        break;
      }
      if (this.acc >= DT) this.acc -= DT;
      const tick = this.match.tick;
      this.step(input);
      d?.afterStep?.(this, input, tick);
      steps++;
      if (!d) this.input.endFrame();
    }
    d?.afterFrame?.(this);
    // fora da vez deste aparelho: descarta teclas e cliques para não dispararem na próxima vez
    if (!this.humanTurn) this.drainInput();
    this.render();
  }

  private drainInput(): void {
    this.pending = {};
    this.dragAim = null;
    this.input.takeKeys();
    this.input.endFrame();
  }

  /** Entrada do humano deste aparelho (consome teclas e cliques pendentes). */
  humanInput(): TickInput {
    const i = this.humanControl();
    this.input.endFrame();
    return i;
  }

  private localInput(): TickInput {
    const m = this.match;
    let input: TickInput = NO_INPUT;
    if (this.replay) {
      const next = this.replay[this.replayIdx];
      if (next && next.tick === m.tick) {
        input = next.input;
        this.replayIdx++;
      }
    } else if (this.humanTurn) input = this.humanControl();
    else if (m.activeTeam) input = this.ai.decide(m);
    return input;
  }

  private step(input: TickInput): void {
    const dt = DT;
    this.time += dt;
    const m = this.match;
    const wasCharging = m.charging;
    if (!isEmptyInput(input)) this.log.push({ tick: m.tick, input });
    m.step(input);
    if (m.charging) {
      if (!wasCharging) this.sfx.chargeStart();
      this.sfx.chargeLevel(m.power);
    } else if (wasCharging) this.sfx.chargeStop();

    if (m.phase === 'turn' && m.turnTimer <= 5) {
      const s = Math.ceil(m.turnTimer);
      if (s !== this.lastTick && s > 0) {
        this.lastTick = s;
        this.sfx.tick();
      }
    }

    this.fx.update(dt);
    this.bg.update(dt, m.wind);
    this.updateCamera(dt);
  }

  /** Lê teclado/toque e cliques pendentes e monta a entrada deste tick. */
  private humanControl(): TickInput {
    const m = this.match;
    const i = this.input;
    const out: TickInput = this.pending;
    this.pending = {};
    for (const code of i.takeKeys()) {
      const w = WEAPONS.find((w) => `Digit${w.key}` === code || `Numpad${w.key}` === code);
      if (w) out.weapon = w.id;
      if (code === 'Tab' || code === 'KeyE' || code === 'KeyQ') {
        const next = this.nextWeapon(code === 'KeyQ' ? -1 : 1);
        if (next) out.weapon = next;
      }
    }
    if (i.isDown('left')) out.walk = -1;
    else if (i.isDown('right')) out.walk = 1;
    if (i.wasPressed('left') || i.wasPressed('right')) this.cam.manual = 0;
    const aimSpeed = i.isDown('fine') ? 0.25 : 1.1;
    if (i.isDown('up')) out.aim = aimSpeed * DT;
    else if (i.isDown('down')) out.aim = -aimSpeed * DT;
    if (i.wasPressed('jump')) out.jump = 'front';
    if (i.wasPressed('backflip')) out.jump = 'back';
    if (i.wasPressed('fire')) {
      if (m.weapon.mode !== 'target') this.cam.manual = 0;
      out.charge = 'start';
    }
    if (i.wasReleased('fire')) out.charge = 'release';
    return out;
  }

  private nextWeapon(dir: 1 | -1): WeaponId | null {
    const m = this.match;
    let idx = WEAPONS.indexOf(m.weapon);
    for (let k = 0; k < WEAPONS.length; k++) {
      idx = (idx + dir + WEAPONS.length) % WEAPONS.length;
      if (m.ammoOf(WEAPONS[idx].id) > 0) return WEAPONS[idx].id;
    }
    return null;
  }

  cycleWeapon(dir: 1 | -1): void {
    const next = this.nextWeapon(dir);
    if (next) this.requestWeapon(next);
  }

  private updateCamera(dt: number): void {
    const m = this.match;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.cam.fit(w, h);
    let tx = this.cam.x;
    let ty = this.cam.y;
    let speed = 3.5;
    const p = m.projectiles[0];
    if (p) {
      // segue o projétil mais "importante" (o primeiro disparado)
      tx = p.x;
      ty = p.y;
      speed = 5;
    } else if (m.active) {
      tx = m.active.x;
      ty = m.active.y - 60;
    } else if (m.phase === 'over' && m.winner) {
      const u = m.winner.units.find((u) => u.alive);
      if (u) {
        tx = u.x;
        ty = u.y - 60;
      }
    }
    this.cam.follow(tx, ty, dt, speed);
    this.cam.clampTo(w, h);
    this.cam.update(dt);
  }

  private render(): void {
    const c = this.canvas.getContext('2d')!;
    const dpr = Math.min(this.quality.maxDpr, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    c.save();
    c.scale(dpr, dpr);
    c.imageSmoothingEnabled = true;
    const m = this.match;
    const t = this.time;
    this.bg.draw(c, this.cam, w, h, t);

    c.save();
    const z = this.cam.zoom;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - this.cam.x * z), dpr * (h / 2 - this.cam.y * z));
    if (this.cam.shake > 0) c.translate((Math.random() - 0.5) * this.cam.shake, (Math.random() - 0.5) * this.cam.shake);

    const left = this.cam.x - w / 2 / z - 20;
    const right = this.cam.x + w / 2 / z + 20;
    const bottom = this.cam.y + h / 2 / z + 20;
    const x0 = Math.floor(left / 16) * 16;
    const terr = m.terrain;

    if (!this.waterDrawY || this.waterDrawY < terr.waterY) this.waterDrawY = terr.waterY;
    this.waterDrawY += (terr.waterY - this.waterDrawY) * 0.03;
    const wy = this.waterDrawY;
    drawWater(c, m.theme, wy, x0, right, bottom, t, false);
    c.drawImage(this.terrainView.canvas, 0, 0);
    this.fx.drawGraves(c);
    for (const crate of m.crates) drawCrate(c, crate, t);

    const holding = m.phase === 'turn' && !!m.active ? m.weapon.id : null;
    for (const u of m.units) {
      if (!u.alive) continue;
      const active = u === m.active && m.phase !== 'over';
      const celebrate = m.phase === 'over' && m.winner === u.team;
      drawUnit(c, u, { active, holding: active ? holding : null, hurt: this.fx.hurt.get(u.id) ?? 0, time: t, celebrate });
    }
    if (m.active && m.phase === 'turn' && m.weapon.mode === 'charge') drawCrosshair(c, m.active, t);
    if (this.dragAim && m.active) drawDragPower(c, m.active, this.dragAim.power, z);
    for (const p of m.projectiles) drawProjectile(c, p, t, m.units.find((u) => u.id === p.ownerId)?.team.look);
    this.fx.draw(c);
    for (const u of m.units) {
      if (u.alive) drawLabel(c, u, u === m.active && m.phase === 'turn', t, z);
    }

    this.fx.drawBubbles(c, z);

    // mira de alvo (ataque aéreo / teletransporte)
    if (this.hoverWorld && this.humanTurn && m.phase === 'turn' && m.weapon.mode === 'target') {
      const { x, y } = this.hoverWorld;
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.arc(x, y, 18, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = m.weapon.id === 'teleport' ? '#b49bff' : '#ff4a4a';
      c.beginPath();
      c.arc(x, y, 4, 0, Math.PI * 2);
      c.fill();
    }

    drawWater(c, m.theme, wy, x0, right, bottom, t, true);
    c.restore();
    c.restore();
  }
}
