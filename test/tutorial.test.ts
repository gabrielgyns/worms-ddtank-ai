import { describe, expect, it } from 'vitest';
import { AiController } from '../src/domain/ai';
import type { TickInput } from '../src/domain/commands';
import { Match } from '../src/domain/match';
import { LESSONS, lessonSetup, TutorialRun } from '../src/domain/tutorial';
import { cpuTeam } from './helpers';

function play(id: string, script: (tick: number, run: TutorialRun) => TickInput): TutorialRun {
  const lesson = LESSONS.find((l) => l.id === id)!;
  const m = new Match(lessonSetup(lesson, { ...cpuTeam('Aluno'), control: 'human' }));
  m.start();
  const run = new TutorialRun(m, lesson);
  for (let t = 0; t < 60 * 120 && !run.finished && !run.failed; t++) {
    m.step(script(t, run));
    run.update();
  }
  return run;
}

describe('tutorial', () => {
  it('lição 1: andar, pular, mirar e acertar avança todos os passos', () => {
    const ai = new AiController('dificil');
    const run = play('t1', (t, r) => {
      if (r.step === 0) return { walk: 1 };
      if (r.step === 1) return t % 30 === 0 ? { jump: 'front' } : {};
      if (r.step === 2) return { aim: 0.03 };
      return ai.decide((r as unknown as { m: Match }).m);
    });
    expect(run.finished).toBe(true);
    expect(run.failed).toBe(false);
  });

  it('pular durante o passo de andar não pula o passo de pular', () => {
    const run = play('t1', (t, r) => (r.step === 0 ? (t === 1 ? { jump: 'front' } : t > 60 ? { walk: 1 } : {}) : {}));
    expect(run.step).toBe(1);
  });

  it('lições 2 e 3 são vencíveis com a física do jogo', () => {
    for (const id of ['t2', 't3']) {
      const ai = new AiController('dificil');
      const run = play(id, (_t, r) => {
        const m = (r as unknown as { m: Match }).m;
        if (r.step === 0 && id === 't3') return { weapon: 'grenade' };
        return ai.decide(m);
      });
      expect(run.finished, id).toBe(true);
    }
  });
});
