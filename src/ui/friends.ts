import { TEAM_COLORS } from '../domain/teamColors';
import { getBackend } from '../services';
import type { Friend, FriendRequestResult } from '../services/types';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const RESULT_TEXT: Record<FriendRequestResult, string> = {
  sent: 'Pedido enviado! Quando aceitarem, aparece aqui.',
  accepted: 'Vocês agora são amigos! 🎉',
  already_sent: 'Você já mandou um pedido para essa pessoa.',
  already_friends: 'Vocês já são amigos.',
  not_found: 'Nenhum jogador com esse código.',
  self: 'Esse é o seu próprio código 😄',
  error: 'Não deu para mandar o pedido agora. Tente de novo.',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function friendLink(code: string): string {
  return `${location.href.split('#')[0]}#amigo-${code}`;
}

/** Tela "Amigos": seu código, convite por link, pedidos e lista. */
export class FriendsUi {
  private notice = '';
  private pendingCode: string | null = null;
  /** chamado ao clicar em "Convidar" num amigo online (F4-04) */
  extraActions: ((f: Friend) => string) | null = null;
  onAction: ((action: string, f: Friend) => void) | null = null;

  constructor(
    private show: (id: string | null) => void,
    private openAccount: () => void,
  ) {
    $('#friends-btn').addEventListener('click', () => void this.open());
    getBackend().auth.onChange(() => {
      if (this.pendingCode && getBackend().friends.available()) void this.addCode(this.pendingCode);
      if ($('#friends').classList.contains('open')) void this.render();
    });
  }

  /** Abriu o jogo por um link de amigo (#amigo-BOLOTA-XXXXX)? */
  fromUrl(): boolean {
    const m = /#amigo-(BOLOTA-[A-Za-z0-9]{5})/.exec(location.hash);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    this.pendingCode = m[1].toUpperCase();
    void this.open();
    if (getBackend().friends.available()) void this.addCode(this.pendingCode);
    return true;
  }

  async open(): Promise<void> {
    this.notice = '';
    this.show('friends');
    await this.render();
  }

  private async addCode(code: string): Promise<void> {
    this.pendingCode = null;
    const r = await getBackend().friends.request(code);
    this.notice = RESULT_TEXT[r];
    await this.render();
  }

  async render(): Promise<void> {
    const b = getBackend();
    const body = $('#friends-body');
    const notice = this.notice ? `<p class="notice">${esc(this.notice)}</p>` : '';
    if (b.kind === 'local') {
      body.innerHTML = `<p class="tag">Amigos precisam do servidor do jogo ligado.</p>
        <p class="hint">Enquanto isso, dá para jogar online com qualquer pessoa pelo código da sala ou pela partida por link.</p>`;
      return;
    }
    if (!b.friends.available()) {
      body.innerHTML = `<p class="tag">Entre na sua conta (pode ser como convidado) para adicionar amigos.</p>
        ${this.pendingCode ? `<p class="hint">Depois de entrar, o pedido para <b>${esc(this.pendingCode)}</b> sai sozinho.</p>` : ''}
        <button id="fr-login">Entrar</button>`;
      body.querySelector('#fr-login')?.addEventListener('click', this.openAccount);
      return;
    }
    body.innerHTML = '<p class="hint">Carregando…</p>';
    const [code, list] = await Promise.all([b.friends.myCode(), b.friends.list()]);
    const row = (f: Friend, actions: string) => `
      <li><span class="dot" style="--c:${TEAM_COLORS[f.color]?.color ?? '#999'}"></span><b>${esc(f.name)}</b>
      <span class="actions">${actions}</span></li>`;
    const incoming = list.filter((f) => f.status === 'incoming');
    const friends = list.filter((f) => f.status === 'accepted');
    const outgoing = list.filter((f) => f.status === 'outgoing');
    body.innerHTML = `
      <span class="lbl">Seu código</span>
      <div class="share-row">
        <input id="fr-code" readonly value="${esc(code ?? '…')}" />
        <button id="fr-copy">Copiar link</button>
      </div>
      <span class="lbl">Adicionar pelo código</span>
      <div class="join-row">
        <input id="fr-add" placeholder="BOLOTA-XXXXX" autocomplete="off" spellcheck="false" />
        <button id="fr-send">Pedir</button>
      </div>
      ${notice}
      ${incoming.length ? `<span class="lbl">Pedidos para você</span><ul class="people">${incoming.map((f) => row(f, `<button data-act="accept" data-id="${f.id}">Aceitar</button><button data-act="remove" data-id="${f.id}">Recusar</button>`)).join('')}</ul>` : ''}
      <span class="lbl">Amigos (${friends.length})</span>
      ${friends.length ? `<ul class="people">${friends.map((f) => row(f, `${this.extraActions?.(f) ?? ''}<button data-act="remove" data-id="${f.id}" title="Remover">✕</button>`)).join('')}</ul>` : '<p class="hint">Mande seu link para alguém e comece a lista!</p>'}
      ${outgoing.length ? `<span class="lbl">Esperando resposta</span><ul class="people">${outgoing.map((f) => row(f, `<button data-act="remove" data-id="${f.id}">Cancelar</button>`)).join('')}</ul>` : ''}`;

    const add = body.querySelector<HTMLInputElement>('#fr-add')!;
    add.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') void this.addCode(add.value);
    });
    body.querySelector('#fr-send')?.addEventListener('click', () => void this.addCode(add.value));
    body.querySelector('#fr-copy')?.addEventListener('click', async () => {
      if (!code) return;
      const link = friendLink(code);
      try {
        if (typeof navigator.share === 'function') await navigator.share({ title: 'Bolotas em Guerra', text: 'Me adiciona no Bolotas em Guerra!', url: link });
        else await navigator.clipboard.writeText(link);
        this.notice = 'Link copiado. Mande para quem quiser adicionar!';
      } catch {
        (body.querySelector('#fr-code') as HTMLInputElement).select();
      }
      void this.render();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const f = list.find((x) => x.id === btn.dataset.id)!;
        const act = btn.dataset.act!;
        if (act === 'accept') await b.friends.accept(f.id);
        else if (act === 'remove') await b.friends.remove(f.id);
        else this.onAction?.(act, f);
        void this.render();
      }),
    );
  }
}
