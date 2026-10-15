import { encodeMask } from './codec';
import { WORLD_H, WORLD_W, type MatchSetup, type TeamSetup } from './match';
import { DIRT, METAL } from './terrain';
import { THEMES, type ThemeId } from './theme';
import type { WeaponId } from './weapons';

/** Construtor de mapas por código (para as missões). */
class MapBuilder {
  readonly mask = new Uint8Array(WORLD_W * WORLD_H);

  /** Chão plano de x0 a x1 a partir da altura y até o fundo. */
  ground(x0: number, x1: number, y: number): this {
    return this.rect(x0, y, x1, WORLD_H, DIRT);
  }

  rect(x0: number, y0: number, x1: number, y1: number, v: number = DIRT): this {
    for (let y = Math.max(0, y0); y < Math.min(WORLD_H, y1); y++) this.mask.fill(v, y * WORLD_W + Math.max(0, x0), y * WORLD_W + Math.min(WORLD_W, x1));
    return this;
  }

  /** Morro arredondado (meia elipse) apoiado em `base`. */
  hill(cx: number, base: number, rx: number, height: number): this {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const k = 1 - ((x - cx) / rx) ** 2;
      if (k <= 0) continue;
      this.rect(x, Math.round(base - height * Math.sqrt(k)), x + 1, base + 1);
    }
    return this;
  }

  hole(cx: number, cy: number, r: number): this {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.mask[y * WORLD_W + x] = 0;
    return this;
  }

  encode(): string {
    return encodeMask(this.mask);
  }
}

export interface Mission {
  id: string;
  name: string;
  goal: string;
  theme: ThemeId;
  wind: number;
  ammo: Partial<Record<WeaponId, number>>;
  /** tiros para 3 e 2 estrelas (completar já dá 1) */
  stars: [number, number];
  player: number[];
  targets: Array<{ x: number; hp?: number }>;
  props?: { barrels: number[]; mines: number[] };
  map(): string;
}

const G = 900; // altura padrão do chão

export const MISSIONS: readonly Mission[] = [
  {
    id: 'm1',
    name: 'Primeiro Tiro',
    goal: 'Acerte o alvo. Sem vento, só mirar e soltar.',
    theme: 'prado',
    wind: 0,
    ammo: { bazooka: 3 },
    stars: [1, 2],
    player: [700],
    targets: [{ x: 1350, hp: 40 }],
    map: () => new MapBuilder().ground(300, 2500, G).encode(),
  },
  {
    id: 'm2',
    name: 'Contra o Vento',
    goal: 'Vento forte contra. Compense a mira!',
    theme: 'deserto',
    wind: -8,
    ammo: { bazooka: 3 },
    stars: [1, 2],
    player: [600],
    targets: [{ x: 1500, hp: 40 }],
    map: () => new MapBuilder().ground(300, 2500, G).hill(1050, G, 160, 120).encode(),
  },
  {
    id: 'm3',
    name: 'Atrás do Muro',
    goal: 'Só granadas. Faça ela quicar por cima do muro.',
    theme: 'neve',
    wind: 3,
    ammo: { grenade: 3 },
    stars: [1, 2],
    player: [900],
    targets: [{ x: 1400, hp: 45 }],
    map: () => new MapBuilder().ground(300, 2500, G).rect(1180, G - 260, 1240, G).encode(),
  },
  {
    id: 'm4',
    name: 'Reação em Cadeia',
    goal: 'Três alvos e um barril. Um tiro certeiro resolve.',
    theme: 'prado',
    wind: 2,
    ammo: { bazooka: 2 },
    stars: [1, 2],
    player: [600],
    targets: [{ x: 1570, hp: 20 }, { x: 1640, hp: 20 }, { x: 1710, hp: 20 }],
    props: { barrels: [1600, 1680], mines: [] },
    map: () => new MapBuilder().ground(300, 2500, G).encode(),
  },
  {
    id: 'm5',
    name: 'Banho Gelado',
    goal: 'Os alvos estão na beirada. Empurre-os para a água.',
    theme: 'neve',
    wind: 4,
    ammo: { bazooka: 2, grenade: 1 },
    stars: [2, 3],
    player: [700],
    targets: [{ x: 1980, hp: 200 }, { x: 2040, hp: 200 }],
    map: () => new MapBuilder().ground(400, 1250, G).ground(1700, 2070, G - 40).encode(),
  },
  {
    id: 'm6',
    name: 'Teto de Aço',
    goal: 'O alvo está sob um teto de metal. Ache o ângulo.',
    theme: 'deserto',
    wind: -2,
    ammo: { bazooka: 2, grenade: 2 },
    stars: [1, 3],
    player: [800],
    targets: [{ x: 1700, hp: 50 }],
    map: () =>
      new MapBuilder()
        .ground(300, 2500, G)
        .rect(1560, G - 110, 1900, G - 96, METAL)
        .rect(1880, G - 110, 1900, G, METAL)
        .encode(),
  },
  {
    id: 'm7',
    name: 'Chuva no Vale',
    goal: 'Alvos espalhados no vale. Hora do ataque aéreo.',
    theme: 'doce',
    wind: 1,
    ammo: { airstrike: 1, bazooka: 2 },
    stars: [1, 2],
    player: [500],
    targets: [{ x: 1480, hp: 25 }, { x: 1525, hp: 25 }, { x: 1570, hp: 25 }, { x: 1615, hp: 25 }],
    map: () => new MapBuilder().ground(300, 2500, G).rect(1250, G - 240, 1330, G).rect(1770, G - 240, 1850, G).encode(),
  },
  {
    id: 'm8',
    name: 'Escalada',
    goal: 'O alvo está no alto do penhasco. Suba de corda e deixe um presente.',
    theme: 'prado',
    wind: 0,
    ammo: { rope: 3, dynamite: 1 },
    stars: [1, 1],
    player: [1050],
    targets: [{ x: 1580, hp: 60 }],
    map: () =>
      new MapBuilder()
        .ground(300, 2500, G)
        .rect(1300, G - 300, 1700, G)
        .rect(1060, G - 480, 1250, G - 460, METAL)
        .encode(),
  },
];

const TARGETS: TeamSetup = {
  name: 'Alvos',
  color: '#9aa3ad',
  light: '#d6dbe1',
  dark: '#5c636e',
  control: 'dummy',
  names: ['Alvo', 'Alvinho', 'Alvão', 'Alvorada'],
  look: { eyes: 'eyes-oculos' },
};

export function missionSetup(m: Mission, player: TeamSetup): MatchSetup {
  return {
    teams: [
      { ...player, spawns: m.player.map((x) => ({ x })), ammo: m.ammo, side: 0 },
      { ...TARGETS, spawns: m.targets, side: 1 },
    ],
    unitsPerTeam: 1,
    theme: THEMES[m.theme],
    seed: 1234,
    turnTime: 45,
    crates: false,
    objects: false,
    suddenDeath: 0,
    wind: m.wind,
    map: m.map(),
    props: m.props ?? { barrels: [], mines: [] },
  };
}

/** Estrelas pelo número de tiros usados (0 = não completou). */
export function missionStars(m: Mission, won: boolean, shots: number): number {
  if (!won) return 0;
  return shots <= m.stars[0] ? 3 : shots <= m.stars[1] ? 2 : 1;
}
