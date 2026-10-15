import { FLAGS, isOn, type Flags, type FlagGroup } from '../domain/flags';
import { getBackend } from '../services';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/**
 * Painel de admin: liga e desliga partes do jogo para todo mundo.
 * Só aparece para quem o servidor diz que é admin (ou com #admin, sem servidor).
 * A proteção de verdade está no banco: set_flag recusa quem não é admin.
 */
export class AdminUi {
  private busy = false;
  private error = '';

  constructor(
    private show: (id: string | null) => void,
    private flags: () => Flags,
    private onChange: (f: Flags) => void,
  ) {
    $('#admin-btn').addEventListener('click', () => this.open());
    window.addEventListener('hashchange', () => void this.refresh());
  }

  /** Mostra o botão só para admin. */
  async refresh(): Promise<void> {
    $('#admin-btn').hidden = !(await getBackend().flags.isAdmin());
  }

  async open(): Promise<void> {
    this.show('admin');
    this.render();
    // pega o estado mais novo do servidor antes de mexer
    this.onChange(await getBackend().flags.load());
    this.render();
  }

  private render(): void {
    const f = this.flags();
    const body = $('#admin-body');
    const local = getBackend().kind === 'local';
    const groups: FlagGroup[] = ['Modos', 'Telas', 'Armas', 'Itens'];
    body.innerHTML = `
      <p class="hint">${
        local
          ? 'Sem servidor: os flags valem só neste aparelho.'
          : 'Vale para todo mundo na próxima vez que abrirem o jogo. Partidas em andamento não mudam.'
      }</p>
      ${this.error ? `<p class="error"></p>` : ''}
      ${groups
        .map(
          (g) => `<h3>${g}</h3><div class="flags">${FLAGS.filter((d) => d.group === g)
            .map(
              (d) =>
                `<label class="flag ${isOn(f, d.key) ? 'on' : ''}"><input type="checkbox" data-flag="${d.key}" ${isOn(f, d.key) ? 'checked' : ''} ${this.busy ? 'disabled' : ''}/><span></span></label>`,
            )
            .join('')}</div>`,
        )
        .join('')}`;
    if (this.error) body.querySelector('.error')!.textContent = this.error;
    // rótulos por textContent (nada de HTML vindo de dado)
    body.querySelectorAll<HTMLInputElement>('[data-flag]').forEach((input) => {
      const def = FLAGS.find((d) => d.key === input.dataset.flag)!;
      input.nextElementSibling!.textContent = def.label;
      input.addEventListener('change', () => void this.toggle(def.key, input.checked));
    });
  }

  private async toggle(key: string, on: boolean): Promise<void> {
    this.busy = true;
    this.error = '';
    this.render();
    const r = await getBackend().flags.set(key, on);
    this.busy = false;
    if (!r.ok) this.error = `Não deu para salvar: ${r.error}`;
    else this.onChange({ ...this.flags(), [key]: on });
    this.render();
  }
}
