import type { TeamSetup } from '../domain/match';
import { TEAM_COLORS } from '../domain/teamColors';
import { THEMES, type ThemeId } from '../domain/theme';
import type { LobbyPlayer, LobbyState } from '../net/protocol';
import type { NetSession } from '../net/session';
import { loadProfile } from '../progress/profile';
import { myLook } from './closet';

const UNIT_NAMES = [
  ['Bolota', 'Pipoca', 'Farofa', 'Paçoca'],
  ['Jujuba', 'Torresmo', 'Biscoito', 'Quindim'],
];

export function savedName(): string {
  try {
    return localStorage.getItem('bolotas-name') || 'Jogador';
  } catch {
    return 'Jogador';
  }
}

function saveName(n: string): void {
  try {
    localStorage.setItem('bolotas-name', n);
  } catch {
    // sem storage
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Sala antes da partida. O host guarda o estado oficial e o repassa;
 * o convidado só manda o que é dele (nome, cor, pronto).
 */
export class Lobby {
  state: LobbyState;

  constructor(
    private session: NetSession,
    private root: HTMLElement,
    private onStart: () => void,
  ) {
    const fav = loadProfile().color;
    const me: LobbyPlayer = { name: savedName(), color: fav, ready: session.role === 'host', connected: true, look: myLook() };
    this.state = { host: me, guest: null, units: 3, themeId: 'random' };
    const link = session.room.link;
    session.room.myName = me.name;
    if (session.role === 'host') {
      link.on('me', (m) => {
        const color = m.color === this.state.host.color ? this.freeColor(this.state.host.color) : m.color;
        this.state.guest = { name: m.name.slice(0, 14) || 'Convidado', color, ready: m.ready, connected: true, look: m.look ?? {} };
        this.broadcast();
      });
      link.onAlive((alive) => {
        if (this.state.guest) this.state.guest.connected = alive;
        this.broadcast();
      });
    } else {
      link.on('lobby', (m) => {
        this.state = m.state;
        this.render();
      });
      this.state = { host: { name: '…', color: 0, ready: true, connected: true }, guest: me, units: 3, themeId: 'random' };
      this.sendMe();
    }
    this.render();
  }

  private get me(): LobbyPlayer {
    return this.session.role === 'host' ? this.state.host : this.state.guest!;
  }

  private get other(): LobbyPlayer | null {
    return this.session.role === 'host' ? this.state.guest : this.state.host;
  }

  private freeColor(taken: number): number {
    return taken === 1 ? 0 : 1;
  }

  private sendMe(): void {
    const me = this.me;
    this.session.room.link.send({ t: 'me', name: me.name, color: me.color, ready: me.ready, look: me.look });
  }

  private broadcast(): void {
    this.session.room.link.send({ t: 'lobby', state: this.state });
    this.render();
  }

  private changed(): void {
    if (this.session.role === 'host') this.broadcast();
    else {
      this.sendMe();
      this.render();
    }
  }

  /** Times da partida a partir da sala: host é o time 0, convidado o 1. */
  teams(): TeamSetup[] {
    const players = [this.state.host, this.state.guest ?? { name: 'Convidado', color: 1, ready: true, connected: true }];
    return players.map((p, i) => {
      const c = TEAM_COLORS[p.color];
      return { name: p.name, color: c.color, light: c.light, dark: c.dark, control: 'human' as const, names: UNIT_NAMES[i], look: p.look ?? {} };
    });
  }

  themeId(): ThemeId {
    const ids = Object.keys(THEMES) as ThemeId[];
    return this.state.themeId === 'random' ? ids[Math.floor(Math.random() * ids.length)] : this.state.themeId;
  }

  private canStart(): boolean {
    const g = this.state.guest;
    return !!g && g.connected && g.ready;
  }

  render(): void {
    const host = this.session.role === 'host';
    const me = this.me;
    const other = this.other;
    const swatches = TEAM_COLORS.map((c, i) => {
      const taken = other?.color === i;
      return `<button class="swatch${me.color === i ? ' on' : ''}" data-color="${i}" style="--c:${c.color}" title="${c.name}" ${taken ? 'disabled' : ''}></button>`;
    }).join('');
    const otherLine = other
      ? `<span class="dot" style="--c:${TEAM_COLORS[other.color].color}"></span><b>${esc(other.name)}</b>
         <em>${!other.connected ? 'desconectado' : host ? (other.ready ? 'pronto ✔' : 'escolhendo…') : 'host'}</em>`
      : '<em>esperando alguém entrar…</em>';
    const themes = (['random', ...Object.keys(THEMES)] as Array<ThemeId | 'random'>)
      .map((t) => `<button data-theme="${t}" class="${this.state.themeId === t ? 'on' : ''}" ${host ? '' : 'disabled'}>${t === 'random' ? 'Surpresa' : THEMES[t].name}</button>`)
      .join('');
    const units = [2, 3, 4].map((n) => `<button data-units="${n}" class="${this.state.units === n ? 'on' : ''}" ${host ? '' : 'disabled'}>${n}</button>`).join('');
    this.root.innerHTML = `
      <div class="lobby-grid">
        <label class="lbl" for="lobby-name">Seu nome</label>
        <input id="lobby-name" maxlength="14" value="${esc(me.name)}" autocomplete="off" />
        <span class="lbl">Sua cor</span>
        <div class="swatches">${swatches}</div>
        <span class="lbl">Oponente</span>
        <div class="other">${otherLine}</div>
        <span class="lbl">Cenário</span>
        <div class="seg">${themes}</div>
        <span class="lbl">Bolotas por time</span>
        <div class="seg">${units}</div>
      </div>
      ${
        host
          ? `<button id="lobby-start" class="big" ${this.canStart() ? '' : 'disabled'}>Começar partida!</button>`
          : `<button id="lobby-ready" class="big ${me.ready ? 'alt' : ''}">${me.ready ? 'Pronto! (esperando o host)' : 'Estou pronto!'}</button>`
      }`;

    const name = this.root.querySelector<HTMLInputElement>('#lobby-name')!;
    name.addEventListener('keydown', (e) => e.stopPropagation());
    name.addEventListener('change', () => {
      me.name = name.value.trim().slice(0, 14) || 'Jogador';
      this.session.room.myName = me.name;
      saveName(me.name);
      this.changed();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) =>
      b.addEventListener('click', () => {
        me.color = Number(b.dataset.color);
        this.changed();
      }),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.themeId = b.dataset.theme as ThemeId | 'random';
        this.broadcast();
      }),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-units]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.units = Number(b.dataset.units);
        this.broadcast();
      }),
    );
    this.root.querySelector('#lobby-start')?.addEventListener('click', () => this.onStart());
    this.root.querySelector('#lobby-ready')?.addEventListener('click', () => {
      me.ready = !me.ready;
      this.changed();
    });
  }
}
