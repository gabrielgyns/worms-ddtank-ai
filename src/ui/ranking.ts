import { TEAM_COLORS } from '../domain/teamColors';
import { rivals } from '../progress/history';
import { getBackend } from '../services';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Tab = 'all' | 'week' | 'h2h';

/** Tela "Ranking": geral (rating), semana (vitórias) e cara a cara. */
export class RankingUi {
  private tab: Tab = 'all';
  /** abas extras (desafio diário, temporada) registram aqui */
  readonly extraTabs: Array<{ id: string; label: string; render: (el: HTMLElement) => Promise<void> }> = [];
  private extra: string | null = null;

  constructor(private show: (id: string | null) => void) {
    $('#ranking-btn').addEventListener('click', () => void this.open());
  }

  async open(): Promise<void> {
    this.show('ranking');
    await this.render();
  }

  private async render(): Promise<void> {
    const b = getBackend();
    const online = b.ranking.available();
    const tabs: Array<[string, string]> = [
      ['all', 'Geral'],
      ['week', 'Semana'],
      ['h2h', 'Cara a cara'],
      ...this.extraTabs.map((t): [string, string] => [t.id, t.label]),
    ];
    const current = this.extra ?? this.tab;
    const body = $('#ranking-body');
    body.innerHTML = `<div class="seg tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${current === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="ranking-content"><p class="hint">Carregando…</p></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab!;
        if (id === 'all' || id === 'week' || id === 'h2h') {
          this.tab = id;
          this.extra = null;
        } else this.extra = id;
        void this.render();
      }),
    );
    const el = body.querySelector<HTMLElement>('#ranking-content')!;
    const extra = this.extraTabs.find((t) => t.id === this.extra);
    if (extra) {
      await extra.render(el);
      return;
    }

    if (this.tab === 'h2h') {
      const local = rivals();
      const fromServer = online ? await this.serverH2H() : '';
      el.innerHTML =
        fromServer ||
        (local.length
          ? `<ul class="people">${local
              .map((r) => `<li><b>${esc(r.opponent)}</b><span class="score">${r.wins} × ${r.losses}${r.draws ? ` (${r.draws} empates)` : ''}</span></li>`)
              .join('')}</ul><p class="hint">Partidas online e por link jogadas neste aparelho.</p>`
          : '<p class="hint">Jogue online ou por link para ver o placar contra cada pessoa.</p>');
      return;
    }

    if (!online) {
      el.innerHTML = `<p class="tag">O ranking entre amigos precisa do servidor do jogo ligado e da sua conta.</p>
        <p class="hint">Sem servidor, veja o seu placar em "Cara a cara".</p>`;
      return;
    }
    const rows = await b.ranking.leaderboard(this.tab);
    const me = b.auth.current()?.id;
    el.innerHTML = rows.length
      ? `<ol class="board">${rows
          .map(
            (r, i) => `<li class="${r.id === me ? 'me' : ''}">
              <span class="pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
              <span class="dot" style="--c:${TEAM_COLORS[r.color]?.color ?? '#999'}"></span>
              <b>${esc(r.name)}</b>
              <span class="score">${this.tab === 'all' ? `${r.rating}` : `${r.wins} vit.`}</span>
              <small>${r.games} jogos</small></li>`,
          )
          .join('')}</ol>
        <p class="hint">${this.tab === 'all' ? 'Rating Elo de partidas online (conta quando os dois relatam o mesmo resultado).' : 'Vitórias nos últimos 7 dias, online e por link.'}</p>`
      : '<p class="hint">Adicione amigos para montar o ranking!</p>';
  }

  private async serverH2H(): Promise<string> {
    const b = getBackend();
    const friends = (await b.friends.list()).filter((f) => f.status === 'accepted');
    if (!friends.length) return '';
    const scores = await Promise.all(friends.map(async (f) => ({ f, h: await b.ranking.headToHead(f.id) })));
    return `<ul class="people">${scores
      .map(({ f, h }) => `<li><span class="dot" style="--c:${TEAM_COLORS[f.color]?.color ?? '#999'}"></span><b>${esc(f.name)}</b>
        <span class="score">${h ? `${h.wins} × ${h.losses}` : '0 × 0'}</span></li>`)
      .join('')}</ul><p class="hint">Suas vitórias × derrotas contra cada amigo.</p>`;
  }
}
