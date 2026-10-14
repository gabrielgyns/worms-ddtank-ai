import { getBackend } from '../services';
import type { User } from '../services/types';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/** Tela "Conta": entrar por link mágico, Google ou como convidado. */
export class AccountUi {
  private notice = '';

  constructor(private show: (id: string | null) => void) {
    $('#account-btn').addEventListener('click', () => this.open());
    getBackend().auth.onChange((u) => {
      this.renderChip(u);
      if ($('#account').classList.contains('open')) this.render();
    });
  }

  open(): void {
    this.notice = '';
    this.render();
    this.show('account');
  }

  private renderChip(u: User | null): void {
    const chip = $('#account-btn');
    chip.textContent = !u ? '👤 Entrar' : u.guest ? '👤 Convidado' : `👤 ${u.email?.split('@')[0] ?? 'Conta'}`;
  }

  private render(): void {
    const b = getBackend();
    const u = b.auth.current();
    const body = $('#account-body');
    const notice = this.notice ? `<p class="notice">${this.notice}</p>` : '';
    if (b.kind === 'local') {
      body.innerHTML = `
        <p class="tag">Seu progresso (moedas, conquistas, itens) fica salvo <b>neste aparelho</b>.</p>
        <p class="hint">Contas online, amigos e ranking compartilhado aparecem quando o servidor do jogo for ligado.</p>
        ${notice}`;
      return;
    }
    if (!u) {
      body.innerHTML = `
        <label class="lbl" for="acc-email">Entrar com e-mail (sem senha)</label>
        <div class="join-row">
          <input id="acc-email" type="email" placeholder="voce@email.com" autocomplete="email" />
          <button id="acc-magic">Receber link</button>
        </div>
        <button id="acc-google">Entrar com Google</button>
        <button id="acc-guest">Jogar como convidado</button>
        ${notice}`;
    } else if (u.guest) {
      body.innerHTML = `
        <p class="tag">Você está como <b>convidado</b>. Salve a conta com um e-mail para não perder o progresso.</p>
        <div class="join-row">
          <input id="acc-email" type="email" placeholder="voce@email.com" autocomplete="email" />
          <button id="acc-upgrade">Salvar conta</button>
        </div>
        <button id="acc-out">Sair</button>
        ${notice}`;
    } else {
      body.innerHTML = `
        <p class="tag">Conectado como <b>${u.email ?? 'jogador'}</b>.</p>
        <button id="acc-out">Sair</button>
        ${notice}`;
    }
    const email = body.querySelector<HTMLInputElement>('#acc-email');
    email?.addEventListener('keydown', (e) => e.stopPropagation());
    const run = async (p: Promise<{ ok: boolean; error?: string }>, success: string) => {
      const r = await p;
      this.notice = r.ok ? success : (r.error ?? 'Algo deu errado.');
      this.render();
    };
    body.querySelector('#acc-magic')?.addEventListener('click', () =>
      void run(b.auth.signInEmail(email!.value.trim()), 'Pronto! Abra o link que mandamos no seu e-mail.'),
    );
    body.querySelector('#acc-google')?.addEventListener('click', () => void run(b.auth.signInGoogle(), 'Abrindo o Google…'));
    body.querySelector('#acc-guest')?.addEventListener('click', () => void run(b.auth.signInGuest(), 'Bem-vindo!'));
    body.querySelector('#acc-upgrade')?.addEventListener('click', () =>
      void run(b.auth.upgradeEmail(email!.value.trim()), 'Confirme pelo link que mandamos no seu e-mail.'),
    );
    body.querySelector('#acc-out')?.addEventListener('click', () => void b.auth.signOut());
  }
}
