import type { Sfx } from './core/audio';
import type { Input } from './core/input';
import { AiController, type Difficulty } from './domain/ai';
import { BossAi } from './domain/boss';
import { DT, isEmptyInput, NO_INPUT, type Command, type TickInput } from './domain/commands';
import { Match, type MatchSetup } from './domain/match';
import { HighlightRecorder, type Highlight } from './domain/highlight';
import { GIRDER, WEAPONS, weaponKeyCodes, type WeaponId } from './domain/weapons';
import { ITEMS, type ItemId } from './domain/items';
import { Background, drawWater } from './render/background';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { a11y, TEAM_MARK } from './render/a11y';
import { drawHill, drawGirderGhost, drawHomingMark, drawPowerAura, drawShield, drawBlastPreview, drawPreviewPath, drawBarrel, drawChute, drawCrate, drawMine, drawRope, drawCrosshair, drawDragPower, drawLabel, drawProjectile, drawUnit } from './render/sprites';
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
  /** reproduz só este lance, em câmera lenta (precisa de `replay` com os comandos dele) */
  highlight?: Highlight;
}

/** Liga partida, controladores, câmera, render e som. */
export class Game {
  readonly match: Match;
  readonly cam: Camera;
  private terrainView: TerrainView;
  private bg: Background;
  readonly fx: Effects;
  private ai: AiController;
  private bossAi = new BossAi();
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
  /** guarda o melhor lance enquanto se joga (null em replays) */
  readonly highlights: HighlightRecorder | null;
  /** tocando um melhor lance: para sozinho no fim dele */
  readonly highlight: Highlight | null;
  /** chamado uma vez quando o melhor lance termina */
  onHighlightEnd: (() => void) | null = null;
  private highlightDone = false;
  /** pausa de impacto: segura a simulação uns milésimos num golpe forte (só tempo real, a regra não muda) */
  private hitstop = 0;
  /** acelera a partida na vez da CPU (preferência do jogador; nunca online) */
  cpuSpeed = 1;
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
    this.highlight = opts.highlight ?? null;
    if (this.highlight) {
      this.match.restore(this.highlight.snap);
      this.cam.x = this.match.active?.x ?? this.cam.x;
      this.cam.y = this.match.active?.y ?? this.cam.y;
    }
    this.highlights = this.replay ? null : new HighlightRecorder(this.match);
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
        case 'girder':
          s.pickup();
          break;
        case 'bat':
          s.explosion(10);
          this.hitstop = Math.max(this.hitstop, 0.12);
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
        case 'mineArmed':
          s.beep();
          break;
        case 'rope':
          s.rope(e.hit);
          break;
        case 'chute':
          s.whoosh();
          break;
        case 'item':
          s.pickup();
          break;
        case 'damage':
          s.ouch();
          // golpe forte = um instante de pausa, para o impacto "pesar"
          if (e.amount >= 20) this.hitstop = Math.max(this.hitstop, Math.min(0.13, 0.03 + e.amount / 500));
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
    const wpn = this.match.weapon;
    if (!this.humanTurn || this.paused || (wpn.mode !== 'target' && !wpn.projectile?.homing)) return;
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

  requestItem(id: ItemId): void {
    if (this.humanTurn && !this.paused) this.pending.item = id;
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
    const h = this.highlight;
    if (h) {
      if (this.match.tick >= h.endTick) {
        // fim do lance: congela a simulação, mas efeitos e câmera seguem vivos
        if (!this.highlightDone) {
          this.highlightDone = true;
          this.onHighlightEnd?.();
        }
        this.fx.update(realDt);
        this.updateCamera(realDt);
        this.render();
        return;
      }
      // mira passa rápido; o voo e a explosão, devagar
      this.speed = this.match.projectiles.length > 0 || this.match.phase === 'settle' ? 0.4 : 3;
    }
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      this.fx.update(realDt * 0.25);
      this.render();
      return;
    }
    if (!this.replay && !this.driver) this.speed = this.match.activeTeam?.control === 'cpu' ? this.cpuSpeed : 1;
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
    else if (m.activeTeam) input = this.cpuInput();
    return input;
  }

  /** Decisão da CPU para o time da vez (chefão tem IA própria). */
  cpuInput(): TickInput {
    const team = this.match.activeTeam;
    if (!team || team.control !== 'cpu') return NO_INPUT;
    return team.boss ? this.bossAi.decide(this.match) : this.ai.decide(this.match);
  }

  private step(input: TickInput): void {
    const dt = DT;
    this.time += dt;
    const m = this.match;
    const wasCharging = m.charging;
    if (!isEmptyInput(input)) this.log.push({ tick: m.tick, input });
    m.step(input);
    this.highlights?.afterStep();
    if (m.charging) {
      if (!wasCharging) this.sfx.chargeStart();
      this.sfx.chargeLevel(m.power);
    } else if (wasCharging) this.sfx.chargeStop();

    // trilha: tensa nos últimos 5 s da vez, calma no resto, silêncio no fim
    if (!this.replay) this.sfx.music.setMood(m.phase === 'over' ? 'off' : m.phase === 'turn' && m.turnTimer <= 5 ? 'tense' : 'calm');

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
      const w = WEAPONS.find((w) => weaponKeyCodes(w.key).includes(code));
      if (w) out.weapon = w.id;
      const it = ITEMS.find((x) => x.key === code);
      if (it) out.item = it.id;
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
    const pressed = i.wasPressed('fire');
    const released = i.wasReleased('fire');
    if (pressed) {
      if (m.weapon.mode !== 'target') this.cam.manual = 0;
      out.charge = 'start';
      // toque rápido (apertou e soltou no mesmo frame): solta no próximo tick
      if (released) this.pending.charge = 'release';
    } else if (released) out.charge = 'release';
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
      ty = m.active.y - 60 * m.active.size;
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
    this.bg.draw(c, this.cam, w, h, t, dpr);

    c.save();
    const z = this.cam.zoom;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - this.cam.x * z), dpr * (h / 2 - this.cam.y * z));
    const shake = this.cam.shake * a11y.shake;
    if (shake > 0) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

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
    if (m.hill) {
      const on = m.sidesOnHill();
      const owner = on.length === 1 ? m.teams.find((tm) => tm.side === on[0]) : null;
      drawHill(c, m.hill.x, m.hill.y, m.hill.r, owner?.color ?? '#ffffff', t);
    }
    this.fx.drawGraves(c);
    for (const crate of m.crates) drawCrate(c, crate, t);
    for (const b of m.barrels) drawBarrel(c, b, t);
    for (const mn of m.mines) drawMine(c, mn, t);

    const holding = m.phase === 'turn' && !!m.active ? m.weapon.id : null;
    for (const u of m.units) {
      if (!u.alive) continue;
      drawRope(c, u);
      drawChute(c, u, t);
      const active = u === m.active && m.phase !== 'over';
      const celebrate = m.phase === 'over' && m.winner === u.team;
      if (active && m.boost.power) drawPowerAura(c, u, t);
      drawUnit(c, u, { active, holding: active ? holding : null, hurt: this.fx.hurt.get(u.id) ?? 0, time: t, celebrate });
      if (u.shield) drawShield(c, u, t);
    }
    if (m.active && m.phase === 'turn' && m.weapon.mode === 'charge') {
      const u = m.active;
      const spec = m.weapon.projectile;
      // prévia só para quem está jogando neste aparelho
      if (this.humanTurn && spec) {
        drawBlastPreview(c, u.cx + Math.cos(u.aim) * u.facing * 72, u.cy - Math.sin(u.aim) * 72, spec.blast, t);
        drawPreviewPath(c, m.previewShot(0.4));
      }
      drawCrosshair(c, u, t);
    }
    if (this.dragAim && m.active) drawDragPower(c, m.active, this.dragAim.power, z);
    for (const p of m.projectiles) drawProjectile(c, p, t, m.units.find((u) => u.id === p.ownerId)?.team.look);
    this.fx.draw(c);
    for (const u of m.units) {
      if (u.alive) drawLabel(c, u, u === m.active && m.phase === 'turn', t, z);
    }

    this.fx.drawBubbles(c, z);

    // mira de alvo (ataque aéreo / teletransporte)
    // marca do teleguiado (só quem joga neste aparelho vê)
    if (m.homingTarget && this.humanTurn && m.weapon.projectile?.homing) drawHomingMark(c, m.homingTarget.x, m.homingTarget.y, t);
    if (this.hoverWorld && this.humanTurn && m.phase === 'turn' && m.weapon.id === 'girder') {
      const { x, y } = this.hoverWorld;
      drawGirderGhost(c, x, y, m.girderAngle(), GIRDER.len, GIRDER.thick, m.girderFits(x, y));
    } else if (this.hoverWorld && this.humanTurn && m.phase === 'turn' && m.weapon.mode === 'target') {
      const { x, y } = this.hoverWorld;
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.arc(x, y, m.weapon.projectile?.blast ?? 18, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = m.weapon.id === 'teleport' ? '#b49bff' : '#ff4a4a';
      c.beginPath();
      c.arc(x, y, 4, 0, Math.PI * 2);
      c.fill();
    }

    drawWater(c, m.theme, wy, x0, right, bottom, t, true);
    c.restore();
    this.drawOffscreen(c, w, h);
    c.restore();
    if (this.highlight) this.drawCaption(c);
  }

  /** Setinhas na borda para as bolotas fora da câmera (em pixels CSS). */
  private drawOffscreen(c: CanvasRenderingContext2D, w: number, h: number): void {
    const z = this.cam.zoom;
    // longe dos painéis do HUD em cima e embaixo
    const top = 96;
    const bottom = h - 96;
    const side = 26;
    if (bottom - top < 80) return;
    const cx = w / 2;
    const cy = (top + bottom) / 2;
    const placed: Array<{ x: number; y: number }> = [];
    // a colina entra como mais um alvo, em dourado
    const hillAt = this.match.hill;
    const targets = this.match.units.filter((u) => u.alive).map((u) => ({ cx: u.cx, cy: u.cy, color: u.team.color, mark: a11y.colorblind ? `${TEAM_MARK[u.team.id % TEAM_MARK.length]} ` : '', strong: u === this.match.active }));
    if (hillAt) targets.push({ cx: hillAt.x, cy: hillAt.y, color: '#ffd24a', mark: '⛰️ ', strong: true });
    for (const u of targets) {
      const sx = (u.cx - this.cam.x) * z + cx;
      const sy = (u.cy - this.cam.y) * z + h / 2;
      if (sx >= side && sx <= w - side && sy >= top && sy <= bottom) continue;
      // empurra o ponto até a borda da área visível, na direção da bolota
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min(Math.abs((cx - side) / (dx || 1e-6)), Math.abs((cy - top) / (dy || 1e-6)));
      let ax = cx + dx * k;
      let ay = cy + dy * k;
      // várias na mesma direção: escorrega ao longo da borda para não empilhar
      const vertical = Math.abs(ax - cx) >= cx - side - 1;
      for (let tries = 0; tries < 8 && placed.some((q) => Math.hypot(q.x - ax, q.y - ay) < 30); tries++) {
        if (vertical) ay = Math.min(bottom, Math.max(top, ay + 30));
        else ax = Math.min(w - side, Math.max(side, ax + 44));
      }
      placed.push({ x: ax, y: ay });
      const ang = Math.atan2(dy, dx);
      const meters = Math.round(Math.hypot(sx - ax, sy - ay) / z / 10);
      c.save();
      c.translate(ax, ay);
      c.globalAlpha = u.strong ? 1 : 0.85;
      c.save();
      c.rotate(ang);
      c.beginPath();
      c.moveTo(14, 0);
      c.lineTo(-8, -10);
      c.lineTo(-4, 0);
      c.lineTo(-8, 10);
      c.closePath();
      c.fillStyle = u.color;
      c.strokeStyle = '#2a1a12';
      c.lineWidth = 3;
      c.lineJoin = 'round';
      c.stroke();
      c.fill();
      c.restore();
      const mark = u.mark;
      if (meters > 0 || mark) {
        c.font = "13px 'Lilita One', sans-serif";
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 4;
        c.strokeStyle = '#2a1a12';
        c.fillStyle = '#fff';
        const lx = -Math.cos(ang) * 24;
        const ly = -Math.sin(ang) * 20;
        const label = `${mark}${meters > 0 ? `${meters} m` : ''}`;
        c.strokeText(label, lx, ly);
        c.fillText(label, lx, ly);
      }
      c.restore();
    }
  }

  /** Legenda gravada junto no vídeo do melhor lance. */
  private drawCaption(c: CanvasRenderingContext2D): void {
    const h = this.highlight!;
    const w = this.canvas.width;
    const s = Math.max(0.6, Math.min(1.6, w / 1000));
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.textBaseline = 'top';
    c.lineJoin = 'round';
    c.font = `${Math.round(26 * s)}px 'Lilita One', sans-serif`;
    const title = `🎬 ${h.shooter}: ${h.damage} de dano${h.kills ? ` · ${h.kills} KO` : ''}`;
    c.lineWidth = 6 * s;
    c.strokeStyle = '#2a1a12';
    c.fillStyle = '#ffd34a';
    c.strokeText(title, 18 * s, 16 * s);
    c.fillText(title, 18 * s, 16 * s);
    c.font = `${Math.round(18 * s)}px 'Lilita One', sans-serif`;
    c.textAlign = 'right';
    c.fillStyle = '#fff';
    c.lineWidth = 5 * s;
    const brand = 'Bolotas em Guerra';
    c.strokeText(brand, w - 18 * s, 18 * s);
    c.fillText(brand, w - 18 * s, 18 * s);
    c.restore();
  }
}
