import { LESSONS, type TutorialRun } from '../domain/tutorial';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/** Cartão no topo da tela com o passo atual do tutorial. */
export class TutorialCard {
  private el = $('#tutorial');

  show(run: TutorialRun, lessonIndex: number): void {
    this.el.hidden = false;
    $('#tut-title').textContent = `Lição ${lessonIndex + 1} de ${LESSONS.length} · ${run.lesson.name}`;
    const s = run.current;
    $('#tut-text').textContent = s ? s.text : 'Muito bem! 🎉';
    $('#tut-keys').textContent = s ? s.keys : '';
    $('#tut-keys').hidden = !s;
    const dots = $('#tut-dots');
    dots.innerHTML = '';
    run.lesson.steps.forEach((_, i) => {
      const d = document.createElement('i');
      if (i < run.step) d.className = 'done';
      else if (i === run.step) d.className = 'now';
      dots.append(d);
    });
  }

  /** Pulo rápido do cartão quando um passo é concluído. */
  pop(): void {
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  hide(): void {
    this.el.hidden = true;
  }
}
