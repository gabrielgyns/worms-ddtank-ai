import { loadPrefs, savePrefs, type Prefs } from '../progress/prefs';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

type Choice<K extends keyof Prefs> = { key: K; label: string; options: Array<[Prefs[K], string]> };

const CHOICES: Array<Choice<'gfx'> | Choice<'turnTime'> | Choice<'cpuSpeed'> | Choice<'shake'> | Choice<'colorblind'>> = [
  { key: 'gfx', label: 'Gráficos (recarrega o jogo)', options: [['gpu', 'Novo ✨'], ['classic', 'Clássico']] },
  { key: 'turnTime', label: 'Tempo de turno', options: [[20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '60 s']] },
  { key: 'cpuSpeed', label: 'Velocidade da CPU', options: [[1, 'Normal'], [1.6, 'Rápida'], [2.5, 'Turbo']] },
  { key: 'shake', label: 'Tremida de tela', options: [[true, 'Ligada'], [false, 'Desligada']] },
  { key: 'colorblind', label: 'Símbolos nos times (daltonismo)', options: [[false, 'Não'], [true, 'Sim ● ▲']] },
];

/** Tela de ajustes: volume, turno, CPU, tremida e acessibilidade. */
export class PrefsUi {
  private back = 'menu';

  constructor(
    private show: (id: string | null) => void,
    private apply: (p: Prefs) => void,
  ) {
    $('#prefs-btn').addEventListener('click', () => this.open('menu'));
    $('#pause-prefs').addEventListener('click', () => this.open('pause'));
    $('#prefs-back').addEventListener('click', () => this.show(this.back));
    apply(loadPrefs());
  }

  open(from: string): void {
    this.back = from;
    this.render();
    this.show('prefs');
  }

  private set(p: Prefs): void {
    savePrefs(p);
    this.apply(p);
  }

  private render(): void {
    const p = loadPrefs();
    const body = $('#prefs-body');
    body.innerHTML = '';
    for (const key of ['music', 'sfx'] as const) {
      const row = document.createElement('div');
      row.className = 'opt';
      row.innerHTML = `<label></label><input type="range" min="0" max="100" step="5" class="vol" />`;
      row.querySelector('label')!.textContent = key === 'music' ? '🎵 Música' : '🔊 Efeitos';
      const input = row.querySelector('input')!;
      input.value = String(Math.round(p[key] * 100));
      input.addEventListener('input', () => this.set({ ...loadPrefs(), [key]: Number(input.value) / 100 }));
      body.append(row);
    }
    for (const c of CHOICES) {
      const row = document.createElement('div');
      row.className = 'opt';
      const label = document.createElement('label');
      label.textContent = c.label;
      const seg = document.createElement('div');
      seg.className = 'seg';
      for (const [v, text] of c.options) {
        const b = document.createElement('button');
        b.textContent = text;
        b.classList.toggle('on', p[c.key] === v);
        b.addEventListener('click', () => {
          const changedGfx = c.key === 'gfx' && p.gfx !== v;
          this.set({ ...loadPrefs(), [c.key]: v });
          // trocar o pintor exige um canvas novo: recarrega
          if (changedGfx) location.reload();
          else this.render();
        });
        seg.append(b);
      }
      row.append(label, seg);
      body.append(row);
    }
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'O tempo de turno vale para as partidas que você cria. A CPU acelerada não vale online.';
    body.append(note);
  }
}
