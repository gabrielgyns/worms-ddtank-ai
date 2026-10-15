import type { Match, MatchSetup, TeamSetup } from './match';
import { G, MapBuilder, missionSetup, type Mission } from './missions';
import type { WeaponId } from './weapons';

/** O que o aluno já fez nesta lição (lido dos eventos e do estado, nunca escrito no jogo). */
export interface TutorialProgress {
  walked: number;
  jumped: boolean;
  aimMoved: number;
  hits: number;
  selected: WeaponId | null;
}

export interface TutorialStep {
  text: string;
  /** teclas, mostradas como dica */
  keys: string;
  done(p: TutorialProgress): boolean;
}

/** Cada lição é uma partidinha com alvos parados, como uma missão. */
export interface Lesson extends Omit<Mission, 'stars' | 'goal'> {
  steps: TutorialStep[];
}

const hit: TutorialStep['done'] = (p) => p.hits > 0;

export const LESSONS: readonly Lesson[] = [
  {
    id: 't1',
    name: 'Andar, pular e atirar',
    theme: 'prado',
    wind: 0,
    ammo: { bazooka: 99 },
    player: [900],
    targets: [{ x: 1450, hp: 200 }],
    map: () => new MapBuilder().ground(300, 2500, G).encode(),
    steps: [
      { text: 'Ande para os lados.', keys: '← →  ou  A D', done: (p) => p.walked >= 80 },
      { text: 'Agora pule!', keys: 'Enter = pulo · Backspace = mortal pra trás', done: (p) => p.jumped },
      { text: 'Mire para cima e para baixo.', keys: '↑ ↓  ou  W S  (Shift = ajuste fino)', done: (p) => p.aimMoved >= 0.5 },
      { text: 'Segure para carregar a força e solte para atirar. Acerte o alvo!', keys: 'Espaço (segurar e soltar)', done: hit },
    ],
  },
  {
    id: 't2',
    name: 'O vento',
    theme: 'deserto',
    wind: -9,
    ammo: { bazooka: 99 },
    player: [800],
    targets: [{ x: 1550, hp: 200 }],
    map: () => new MapBuilder().ground(300, 2500, G).hill(1180, G, 140, 90).encode(),
    steps: [
      {
        text: 'Viu a seta do vento lá em cima? Ela empurra a bazuca. Mire mais alto ou com mais força e acerte!',
        keys: 'Espaço · ↑ ↓',
        done: hit,
      },
    ],
  },
  {
    id: 't3',
    name: 'Trocar de arma',
    theme: 'neve',
    wind: 0,
    ammo: { bazooka: 99, grenade: 99 },
    player: [850],
    targets: [{ x: 1400, hp: 200 }],
    map: () => new MapBuilder().ground(300, 2500, G).rect(1120, G - 170, 1180, G).encode(),
    steps: [
      { text: 'Pegue a granada.', keys: '2  ou  Q / E  (ou clique na barra de armas)', done: (p) => p.selected === 'grenade' },
      { text: 'A granada quica e explode em 3 s. Jogue por cima do muro!', keys: 'Espaço', done: hit },
    ],
  },
];

export function lessonSetup(l: Lesson, player: TeamSetup): MatchSetup {
  // sem pressa no tutorial: o relógio do turno quase não aperta
  return { ...missionSetup({ ...l, goal: '', stars: [9, 9] }, player), turnTime: 99 };
}

/**
 * Acompanha uma lição: ouve os eventos, mede o que mudou desde o começo do
 * passo e diz quando avançar. Só lê a partida.
 */
export class TutorialRun {
  step = 0;
  private p: TutorialProgress = fresh();
  private lastX: number | null = null;
  private lastAim: number | null = null;

  constructor(
    private readonly m: Match,
    readonly lesson: Lesson,
  ) {
    m.on((e) => {
      if (e.type === 'jump') this.p.jumped = true;
      if (e.type === 'select') this.p.selected = e.weapon;
      if (e.type === 'damage' && e.unit.team.control === 'dummy' && e.amount > 0) this.p.hits++;
    });
  }

  get current(): TutorialStep | null {
    return this.lesson.steps[this.step] ?? null;
  }

  /** A lição acabou: todos os passos feitos (ou os alvos todos caíram). */
  get finished(): boolean {
    return this.step >= this.lesson.steps.length || (this.m.phase === 'over' && this.m.winner?.side === 0);
  }

  /** O aluno caiu na água: a lição recomeça. */
  get failed(): boolean {
    return this.m.phase === 'over' && this.m.winner?.side !== 0;
  }

  /** Chame a cada frame. Devolve true quando um passo foi concluído agora. */
  update(): boolean {
    const u = this.m.active;
    if (u && u.team.control !== 'dummy') {
      if (this.lastX !== null) this.p.walked += Math.abs(u.x - this.lastX);
      if (this.lastAim !== null) this.p.aimMoved += Math.abs(u.aim - this.lastAim);
      this.lastX = u.x;
      this.lastAim = u.aim;
    }
    const s = this.current;
    if (!s || !s.done(this.p)) return false;
    this.step++;
    // cada passo começa do zero (pular no passo 1 não conta para o 2)
    const keepSelected = this.p.selected;
    this.p = fresh();
    this.p.selected = keepSelected;
    return true;
  }
}

function fresh(): TutorialProgress {
  return { walked: 0, jumped: false, aimMoved: 0, hits: 0, selected: null };
}
