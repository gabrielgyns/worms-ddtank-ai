import type { Input, Action } from '../core/input';
import type { Game } from '../game';
import { WEAPONS } from '../domain/weapons';
import { drawWeaponIcon } from '../render/sprites';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/** HUD em DOM: nítido em qualquer tela e fácil de clicar. */
export class Hud {
  private timer = $('#timer');
  private timerNum = $('#timer b');
  private turnName = $('#turn-name');
  private turnTeam = $('#turn-team');
  private windFill = $('#wind-fill');
  private windText = $('#wind-text');
  private powerFill = $('#power-fill');
  private powerMark = $('#power-mark');
  private angle = $('#angle');
  private weaponName = $('#weapon-name');
  private weaponHint = $('#weapon-hint');
  private teams = $('#teams');
  private bar = $('#weapons');
  private banner = $('#banner');
  private buttons = new Map<string, { el: HTMLButtonElement; ammo: HTMLElement }>();
  private teamBars: Array<{ fill: HTMLElement; num: HTMLElement; max: number }> = [];
  private last = new Map<string, string>();
  private bannerTimer = 0;
  private game: Game | null = null;

  constructor() {
    for (const w of WEAPONS) {
      const el = document.createElement('button');
      el.className = 'weapon';
      el.title = `${w.name} [${w.key}] — ${w.hint}`;
      const cv = document.createElement('canvas');
      cv.width = 80;
      cv.height = 80;
      const ctx = cv.getContext('2d')!;
      ctx.scale(2, 2);
      drawWeaponIcon(ctx, w.id);
      const key = document.createElement('i');
      key.textContent = w.key;
      const ammo = document.createElement('em');
      el.append(cv, key, ammo);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game?.requestWeapon(w.id);
        el.blur();
      });
      this.bar.append(el);
      this.buttons.set(w.id, { el, ammo });
    }
  }

  bind(game: Game): void {
    this.game = game;
    this.teams.innerHTML = '';
    this.teamBars = [];
    this.last.clear();
    for (const t of game.match.teams) {
      const row = document.createElement('div');
      row.className = 'team';
      row.innerHTML = `<span>${t.name}</span><div class="bar"><div class="fill"></div></div><b></b>`;
      const fill = row.querySelector('.fill') as HTMLElement;
      fill.style.background = `linear-gradient(180deg, ${t.light}, ${t.color})`;
      this.teams.append(row);
      this.teamBars.push({ fill, num: row.querySelector('b') as HTMLElement, max: game.match.teamHp(t) });
    }
    game.match.on((e) => {
      if (e.type === 'turnStart') {
        const human = e.unit.team.control === 'human';
        this.show(human ? `Sua vez, ${e.unit.name}!` : `Vez de ${e.unit.name}`, e.unit.team.color);
      } else if (e.type === 'gameOver') {
        this.show(e.winner ? `${e.winner.name} venceu!` : 'Empate!', e.winner?.color ?? '#999', 99);
      }
    });
  }

  show(text: string, color: string, time = 1.8): void {
    this.banner.textContent = text;
    this.banner.style.setProperty('--c', color);
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.bannerTimer = time;
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.last.get(key) === value) return;
    this.last.set(key, value);
    apply(value);
  }

  update(dt: number): void {
    const g = this.game;
    if (!g) return;
    const m = g.match;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
    const u = m.active;
    const team = u?.team;

    const secs = m.phase === 'turn' ? Math.max(0, Math.ceil(m.turnTimer)) : m.phase === 'retreat' ? Math.max(0, Math.ceil(m.retreatTimer)) : 0;
    this.set('timer', `${secs}|${m.phase}|${team?.color}`, () => {
      this.timerNum.textContent = m.phase === 'turn' || m.phase === 'retreat' ? String(secs) : '…';
      this.timer.style.setProperty('--c', team?.color ?? '#888');
      this.timer.classList.toggle('hurry', m.phase === 'turn' && secs <= 5);
      this.timer.classList.toggle('retreat', m.phase === 'retreat');
    });
    this.set('turn', `${u?.name}|${team?.name}`, () => {
      this.turnName.textContent = u?.name ?? '';
      this.turnTeam.textContent = team ? `${team.name}${team.control === 'cpu' ? ' · CPU' : ''}` : '';
      this.turnTeam.style.color = team?.color ?? '#fff';
    });

    this.set('wind', String(m.wind), (v) => {
      const w = Number(v);
      const pct = (Math.abs(w) / 10) * 50;
      this.windFill.style.left = w >= 0 ? '50%' : `${50 - pct}%`;
      this.windFill.style.width = `${pct}%`;
      this.windFill.classList.toggle('neg', w < 0);
      this.windText.textContent = w === 0 ? 'sem vento' : `${w < 0 ? '◀ ' : ''}${Math.abs(w)}${w > 0 ? ' ▶' : ''}`;
    });

    const power = m.charging ? m.power : 0;
    this.set('power', power.toFixed(3), () => {
      this.powerFill.style.width = `${power * 100}%`;
    });
    this.set('mark', String(u?.lastPower ?? -1), (v) => {
      const lp = Number(v);
      this.powerMark.style.display = lp >= 0 ? 'block' : 'none';
      this.powerMark.style.left = `${lp * 100}%`;
    });
    const deg = u ? Math.round((u.aim * 180) / Math.PI) : 0;
    this.set('angle', String(deg), () => {
      this.angle.textContent = `${deg}°`;
    });
    this.set('weapon', m.weapon.id, () => {
      this.weaponName.textContent = m.weapon.name;
      this.weaponHint.textContent = m.weapon.hint;
    });

    const canPick = g.humanTurn && m.phase === 'turn';
    for (const w of WEAPONS) {
      const b = this.buttons.get(w.id)!;
      const ammo = team?.ammo.get(w.id) ?? 0;
      this.set(`w-${w.id}`, `${ammo}|${m.weapon.id === w.id}|${canPick}`, () => {
        b.ammo.textContent = ammo === Infinity ? '∞' : String(ammo);
        b.el.classList.toggle('active', m.weapon.id === w.id);
        b.el.disabled = !canPick || ammo <= 0;
      });
    }

    m.teams.forEach((t, i) => {
      const tb = this.teamBars[i];
      const hp = m.teamHp(t);
      this.set(`team-${i}`, String(hp), () => {
        tb.fill.style.width = `${(hp / tb.max) * 100}%`;
        tb.num.textContent = String(hp);
      });
    });
  }
}

/** Botões na tela para celular. */
export function setupTouch(input: Input, onCycle: () => void): void {
  const root = $('#touch');
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!isTouch) return;
  root.classList.add('on');
  root.querySelectorAll<HTMLElement>('[data-a]').forEach((el) => {
    const a = el.dataset.a as Action | 'cycle';
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      if (a === 'cycle') onCycle();
      else input.press(a);
    });
    const up = () => {
      el.classList.remove('down');
      if (a !== 'cycle') input.release(a);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}
