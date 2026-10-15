import { BOSS_TEAM, type TeamSetup } from '../domain/match';
import { TEAM_COLORS } from '../domain/teamColors';
import { THEMES, type ThemeId } from '../domain/theme';
import type { LobbyPlayer, LobbyState } from '../net/protocol';
import type { NetSession } from '../net/session';
import { loadProfile } from '../progress/profile';
import { loadMaps } from '../progress/maps';
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
  /** mapa desenhado escolhido (só no host) */
  mapId: string | null = null;

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

  /** Times que o convidado controla nesta configuração. */
  guestTeams(): number[] {
    return this.state.mode === 'duo' ? [1, 3] : [1];
  }

  /** Times da partida a partir da sala: host é o time 0, convidado o 1 (no 2x2, também 2 e 3). */
  teams(): TeamSetup[] {
    const players = [this.state.host, this.state.guest ?? { name: 'Convidado', color: 1, ready: true, connected: true }];
    if (this.state.mode === 'duo') {
      // dupla em cada aparelho, vez alternada entre os lados: A1, B1, A2, B2
      return [0, 1, 0, 1].map((pi, i) => {
        const p = players[pi];
        const c = TEAM_COLORS[p.color];
        return {
          name: `${p.name} ${i < 2 ? '①' : '②'}`,
          color: c.color,
          light: c.light,
          dark: c.dark,
          control: 'human' as const,
          names: UNIT_NAMES[pi].map((n) => (i < 2 ? n : `${n} Jr.`)),
          look: p.look ?? {},
          side: pi,
        };
      });
    }
    const coop = this.state.mode === 'boss';
    const teams: TeamSetup[] = players.map((p, i) => {
      const c = TEAM_COLORS[p.color];
      return { name: p.name, color: c.color, light: c.light, dark: c.dark, control: 'human' as const, names: UNIT_NAMES[i], look: p.look ?? {}, side: coop ? 0 : i };
    });
    if (coop) teams.push(BOSS_TEAM);
    return teams;
  }

  /** Máscara do mapa escolhido, se houver. */
  map(): string | undefined {
    return loadMaps().find((m) => m.id === this.mapId)?.data;
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
    const modeName = { duel: 'Duelo', boss: 'Juntos vs Chefão 👑', duo: '2x2 (dupla em cada PC) 👫' };
    const modes = (['duel', 'duo', 'boss'] as const)
      .map((md) => `<button data-mode="${md}" class="${(this.state.mode ?? 'duel') === md ? 'on' : ''}" ${host ? '' : 'disabled'}>${modeName[md]}</button>`)
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
        <span class="lbl">Modo</span>
        <div class="seg">${modes}</div>
        <span class="lbl">Objetivo</span>
        <div class="seg">
          <button data-hill="0" class="${this.state.hill ? '' : 'on'}" ${host ? '' : 'disabled'}>Eliminar todos</button>
          <button data-hill="1" class="${this.state.hill ? 'on' : ''}" ${host ? '' : 'disabled'}>Rei da colina ⛰️</button>
        </div>
        <span class="lbl">Mapa</span>
        ${
          host
            ? `<select id="lobby-map"><option value="">Aleatório</option>${loadMaps()
                .map((m) => `<option value="${m.id}" ${this.mapId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`)
                .join('')}</select>`
            : `<div class="other"><em>${esc(this.state.mapName ?? 'Aleatório')}</em></div>`
        }
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
    this.root.querySelector<HTMLSelectElement>('#lobby-map')?.addEventListener('change', (e) => {
      this.mapId = (e.target as HTMLSelectElement).value || null;
      const m = loadMaps().find((x) => x.id === this.mapId);
      this.state.mapName = m?.name;
      if (m) this.state.themeId = m.theme;
      this.broadcast();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.mode = b.dataset.mode as 'duel' | 'boss' | 'duo';
        this.broadcast();
      }),
    );
    this.root.querySelectorAll<HTMLButtonElement>('[data-hill]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.hill = b.dataset.hill === '1';
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
