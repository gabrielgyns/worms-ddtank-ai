import type { Sfx } from './core/audio';
import type { Input } from './core/input';
import { AiController, type Difficulty } from './domain/ai';
import { DT, isEmptyInput, NO_INPUT, type Command, type TickInput } from './domain/commands';
import { Match, type MatchSetup } from './domain/match';
import { WEAPONS, type WeaponId } from './domain/weapons';
import { Background, drawWater } from './render/background';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { drawCrosshair, drawLabel, drawProjectile, drawUnit } from './render/sprites';
import { TerrainView } from './render/terrainView';

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

  constructor(
    readonly setup: MatchSetup,
    difficulty: Difficulty,
    private canvas: HTMLCanvasElement,
    private input: Input,
    private sfx: Sfx,
    replay?: readonly Command[],
  ) {
    this.replay = replay ?? null;
    this.match = new Match(setup);
    const t = this.match.terrain;
    this.cam = new Camera(t.width, t.height);
    this.cam.x = t.width / 2;
    this.cam.y = t.height * 0.55;
    this.terrainView = new TerrainView(t, setup.theme);
    this.bg = new Background(setup.theme, t.height);
    this.fx = new Effects(this.match, this.cam);
    this.ai = new AiController(difficulty);
    this.wireSound();
    this.match.start();
  }

  private wireSound(): void {
    this.match.on((e) => {
      const s = this.sfx;
      switch (e.type) {
        case 'explosion':
          s.explosion(e.r);
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
        case 'damage':
          s.ouch();
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

  get humanTurn(): boolean {
    return !this.replay && this.match.activeTeam?.control === 'human';
  }

  /** Clique no mundo (coordenadas de tela). */
  clickAt(px: number, py: number): void {
    if (!this.humanTurn || this.paused || this.match.weapon.mode !== 'target') return;
    const w = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
    this.pending.target = { x: Math.round(w.x), y: Math.round(w.y) };
  }

  /** Pedido de troca de arma vindo da interface. */
  requestWeapon(id: WeaponId): void {
    if (this.humanTurn && !this.paused) this.pending.weapon = id;
  }

  hover(px: number, py: number): void {
    this.hoverWorld = this.cam.toWorld(px, py, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  frame(realDt: number): void {
    if (this.paused) {
      this.input.endFrame();
      this.input.takeKeys();
      this.render();
      return;
    }
    this.acc += Math.min(0.1, realDt) * this.speed;
    while (this.acc >= DT) {
      this.acc -= DT;
      this.step(DT);
      this.input.endFrame();
    }
    this.render();
  }

  private step(dt: number): void {
    this.time += dt;
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
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

    drawWater(c, m.theme, terr.waterY, x0, right, bottom, t, false);
    c.drawImage(this.terrainView.canvas, 0, 0);
    this.fx.drawGraves(c);

    const holding = m.phase === 'turn' && !!m.active ? m.weapon.id : null;
    for (const u of m.units) {
      if (!u.alive) continue;
      const active = u === m.active && m.phase !== 'over';
      drawUnit(c, u, { active, holding: active ? holding : null, hurt: this.fx.hurt.get(u.id) ?? 0, time: t });
    }
    if (m.active && m.phase === 'turn' && m.weapon.mode === 'charge') drawCrosshair(c, m.active, t);
    for (const p of m.projectiles) drawProjectile(c, p, t);
    this.fx.draw(c);
    for (const u of m.units) {
      if (u.alive) drawLabel(c, u, u === m.active && m.phase === 'turn', t, z);
    }

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

    drawWater(c, m.theme, terr.waterY, x0, right, bottom, t, true);
    c.restore();
    c.restore();
  }
}
