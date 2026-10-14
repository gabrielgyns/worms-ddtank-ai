import { TEAM_COLORS } from '../domain/teamColors';
import { weaponById } from '../domain/weapons';
import { favoriteWeapon, loadProfile, loadStats, saveProfile, type Profile } from '../progress/profile';
import { getBackend } from '../services';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Tela "Perfil": nome, time, cor e estatísticas de carreira. */
export class ProfileUi {
  constructor(private show: (id: string | null) => void) {
    $('#profile-btn').addEventListener('click', () => this.open());
    // com conta: o perfil do servidor manda
    getBackend().auth.onChange((u) => {
      if (!u) return;
      void getBackend()
        .profile.load()
        .then((p) => {
          if (p) saveProfile({ ...loadProfile(), ...p });
          this.chip();
        });
    });
    this.chip();
  }

  private chip(): void {
    $('#profile-btn').textContent = `🙂 ${loadProfile().name}`;
  }

  open(): void {
    this.render();
    this.show('profile');
  }

  private render(): void {
    const p = loadProfile();
    const s = loadStats();
    const fav = favoriteWeapon(s);
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
    const body = $('#profile-body');
    body.innerHTML = `
      <label class="lbl" for="pf-name">Seu nome</label>
      <input id="pf-name" maxlength="14" value="${esc(p.name)}" />
      <label class="lbl" for="pf-team">Nome do time</label>
      <input id="pf-team" maxlength="18" value="${esc(p.teamName)}" />
      <span class="lbl">Cor do time</span>
      <div class="swatches">${TEAM_COLORS.map((c, i) => `<button class="swatch${p.color === i ? ' on' : ''}" data-color="${i}" style="--c:${c.color}" title="${c.name}"></button>`).join('')}</div>
      <span class="lbl">Carreira</span>
      <dl class="stats">
        <div><dt>Partidas</dt><dd>${s.games}</dd></div>
        <div><dt>Vitórias</dt><dd>${s.wins} <small>${pct(s.wins, s.games)}</small></dd></div>
        <div><dt>Dano causado</dt><dd>${s.damage}</dd></div>
        <div><dt>Eliminações</dt><dd>${s.kills}</dd></div>
        <div><dt>Precisão</dt><dd>${pct(s.hits, s.shots)}</dd></div>
        <div><dt>Maior tiro</dt><dd>${Math.round(s.longestShot / 10)} m</dd></div>
        <div><dt>Arma favorita</dt><dd>${fav ? weaponById(fav).name : '—'}</dd></div>
      </dl>`;
    const save = (patch: Partial<Profile>) => {
      const next = { ...loadProfile(), ...patch };
      saveProfile(next);
      void getBackend().profile.save(next);
      this.chip();
    };
    for (const id of ['#pf-name', '#pf-team']) {
      const el = body.querySelector<HTMLInputElement>(id)!;
      el.addEventListener('keydown', (e) => e.stopPropagation());
      el.addEventListener('change', () => {
        const v = el.value.trim();
        if (!v) return;
        save(id === '#pf-name' ? { name: v } : { teamName: v });
      });
    }
    body.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) =>
      b.addEventListener('click', () => {
        save({ color: Number(b.dataset.color) });
        this.render();
      }),
    );
  }
}
