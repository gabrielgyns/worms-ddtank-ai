/** Como um projétil se comporta em voo. */
export interface ProjectileSpec {
  kind: 'missile' | 'grenade' | 'bomblet' | 'dynamite' | 'cluster' | 'banana' | 'sheep' | 'homing';
  /** raio da explosão (px) */
  blast: number;
  /** dano no centro da explosão */
  damage: number;
  /** quanto o vento empurra (0 = nada) */
  windFactor: number;
  /** segundos até explodir; undefined = explode ao tocar */
  fuse?: number;
  /** coeficiente de quique quando tem pavio */
  bounce: number;
  /** raio de colisão do projétil */
  size: number;
  /** ao explodir, solta estes fragmentos */
  fragments?: { count: number; spec: ProjectileSpec };
  /** anda pelo chão (ovelha) em vez de voar: velocidade em px/s */
  walker?: number;
  /** teleguiado: depois de um instante de voo vira para o alvo marcado (rad/s) */
  homing?: number;
}

export type WeaponId =
  | 'bazooka'
  | 'grenade'
  | 'triple'
  | 'cluster'
  | 'dynamite'
  | 'airstrike'
  | 'teleport'
  | 'rope'
  | 'parachute'
  | 'sheep'
  | 'banana'
  | 'homing'
  | 'bat'
  | 'girder'
  | 'boss-meteoro'
  | 'boss-rajada'
  | 'boss-pisao';

/** utility: corda e paraquedas — não gastam a vez; melee: golpe na hora (taco) */
export type AimMode = 'charge' | 'drop' | 'target' | 'utility' | 'melee';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  hint: string;
  key: string;
  ammo: number;
  mode: AimMode;
  /** velocidade máxima de lançamento com força 100% */
  maxSpeed: number;
  projectile?: ProjectileSpec;
  /** ângulos extras (graus) para disparos múltiplos */
  spread?: number[];
}

/** pedaço da bomba banana: explode ao tocar */
const bananaPiece: ProjectileSpec = { kind: 'banana', blast: 42, damage: 30, windFactor: 0.3, bounce: 0, size: 5 };

const bomblet: ProjectileSpec = {
  kind: 'bomblet',
  blast: 26,
  damage: 20,
  windFactor: 0.4,
  bounce: 0,
  size: 3,
};

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'bazooka',
    name: 'Bazuca',
    hint: 'Explode ao tocar. Sofre com o vento.',
    key: '1',
    ammo: Infinity,
    mode: 'charge',
    maxSpeed: 920,
    projectile: { kind: 'missile', blast: 44, damage: 48, windFactor: 1, bounce: 0, size: 4 },
  },
  {
    id: 'grenade',
    name: 'Granada',
    hint: 'Quica e explode em 3s. Ignora o vento.',
    key: '2',
    ammo: Infinity,
    mode: 'charge',
    maxSpeed: 760,
    projectile: { kind: 'grenade', blast: 48, damage: 52, windFactor: 0, fuse: 3, bounce: 0.45, size: 4 },
  },
  {
    id: 'triple',
    name: 'Tiro Triplo',
    hint: 'Três disparos em leque, estilo DDTank.',
    key: '3',
    ammo: 3,
    mode: 'charge',
    maxSpeed: 920,
    spread: [-5, 0, 5],
    projectile: { kind: 'missile', blast: 30, damage: 25, windFactor: 1, bounce: 0, size: 3 },
  },
  {
    id: 'cluster',
    name: 'Fragmentação',
    hint: 'Explode e espalha 5 bombinhas.',
    key: '4',
    ammo: 2,
    mode: 'charge',
    maxSpeed: 880,
    projectile: {
      kind: 'cluster',
      blast: 34,
      damage: 26,
      windFactor: 0.8,
      bounce: 0,
      size: 5,
      fragments: { count: 5, spec: bomblet },
    },
  },
  {
    id: 'dynamite',
    name: 'Dinamite',
    hint: 'Solta aos pés. Corra! Explosão enorme.',
    key: '5',
    ammo: 1,
    mode: 'drop',
    maxSpeed: 0,
    projectile: { kind: 'dynamite', blast: 75, damage: 75, windFactor: 0, fuse: 4, bounce: 0.15, size: 5 },
  },
  {
    id: 'airstrike',
    name: 'Ataque Aéreo',
    hint: 'Clique no mapa: chuva de mísseis.',
    key: '6',
    ammo: 1,
    mode: 'target',
    maxSpeed: 0,
    projectile: { kind: 'missile', blast: 34, damage: 28, windFactor: 0.6, bounce: 0, size: 4 },
  },
  {
    id: 'teleport',
    name: 'Teletransporte',
    hint: 'Clique num lugar livre para aparecer lá.',
    key: '7',
    ammo: 2,
    mode: 'target',
    maxSpeed: 0,
  },
  {
    id: 'rope',
    name: 'Corda Ninja',
    hint: 'Mire e dispare: ←→ balança, ↑↓ encurta/estica, dispare de novo para soltar. Não gasta a vez.',
    key: '8',
    ammo: 5,
    mode: 'utility',
    maxSpeed: 0,
  },
  {
    id: 'parachute',
    name: 'Paraquedas',
    hint: 'Use no ar: desce devagar, sem dano de queda, levado pelo vento.',
    key: '9',
    ammo: 2,
    mode: 'utility',
    maxSpeed: 0,
  },
  {
    id: 'sheep',
    name: 'Ovelha',
    hint: 'Sai andando e pulando. Explode ao encostar em alguém, em 5 s, ou quando você aperta Espaço de novo.',
    key: '0',
    ammo: 1,
    mode: 'drop',
    maxSpeed: 0,
    projectile: { kind: 'sheep', blast: 62, damage: 55, windFactor: 0, fuse: 5, bounce: 0, size: 8, walker: 110 },
  },
  {
    id: 'banana',
    name: 'Bomba Banana',
    hint: 'Pavio de 3 s, quica e se divide em 5 bananas explosivas. Devastadora.',
    key: '-',
    ammo: 1,
    mode: 'charge',
    maxSpeed: 760,
    projectile: { kind: 'banana', blast: 48, damage: 38, windFactor: 0.4, fuse: 3, bounce: 0.45, size: 6, fragments: { count: 5, spec: bananaPiece } },
  },
  {
    id: 'homing',
    name: 'Míssil Teleguiado',
    hint: 'Clique no mapa para marcar o alvo e atire: depois de um instante ele vira para a marca.',
    key: 'R',
    ammo: 1,
    mode: 'charge',
    maxSpeed: 700,
    projectile: { kind: 'homing', blast: 44, damage: 42, windFactor: 0.5, bounce: 0, size: 4, homing: 4.2 },
  },
  {
    id: 'bat',
    name: 'Taco de Beisebol',
    hint: 'Encoste no inimigo, mire e bata: ele voa longe na direção da mira.',
    key: 'B',
    ammo: 2,
    mode: 'melee',
    maxSpeed: 0,
  },
  {
    id: 'girder',
    name: 'Viga',
    hint: '↑↓ gira, clique perto de você para construir uma ponte ou muro de metal. Encerra a vez.',
    key: 'G',
    ammo: 2,
    mode: 'target',
    maxSpeed: 0,
  },
];

/** Viga: tamanho e até onde dá para construir a partir da bolota. */
export const GIRDER = { len: 110, thick: 12, range: 320 };

/** Taco: alcance à frente da bolota, dano e força da tacada. */
export const BAT = { reach: 30, damage: 22, launch: 640 };

/** Código do KeyboardEvent da tecla de atalho de uma arma. */
export function weaponKeyCodes(key: string): string[] {
  if (key === '-') return ['Minus', 'NumpadSubtract'];
  if (/^[A-Z]$/.test(key)) return [`Key${key}`];
  return key ? [`Digit${key}`, `Numpad${key}`] : [];
}

/** Ataques exclusivos do chefão (não aparecem na barra de armas). */
export const BOSS_WEAPONS: readonly WeaponDef[] = [
  {
    id: 'boss-meteoro',
    name: 'Chuva de Meteoros',
    hint: '',
    key: '',
    ammo: Infinity,
    mode: 'target',
    maxSpeed: 0,
    projectile: { kind: 'missile', blast: 52, damage: 40, windFactor: 0.3, bounce: 0, size: 7 },
  },
  {
    id: 'boss-rajada',
    name: 'Rajada Real',
    hint: '',
    key: '',
    ammo: Infinity,
    mode: 'charge',
    maxSpeed: 900,
    spread: [-10, -5, 0, 5, 10],
    projectile: { kind: 'bomblet', blast: 32, damage: 26, windFactor: 0.6, bounce: 0, size: 4 },
  },
  {
    id: 'boss-pisao',
    name: 'Pisão Sísmico',
    hint: '',
    key: '',
    ammo: Infinity,
    mode: 'drop',
    maxSpeed: 0,
    projectile: { kind: 'bomblet', blast: 110, damage: 45, windFactor: 0, bounce: 0, size: 1 },
  },
];

export const ALL_WEAPONS: readonly WeaponDef[] = [...WEAPONS, ...BOSS_WEAPONS];

export const weaponById = (id: WeaponId): WeaponDef => ALL_WEAPONS.find((w) => w.id === id)!;
export const isBossWeapon = (id: WeaponId): boolean => id.startsWith('boss-');

/** Chave estável de cada ProjectileSpec, para salvar projéteis em voo. */
const SPEC_KEYS = new Map<ProjectileSpec, string>();
const SPECS_BY_KEY = new Map<string, ProjectileSpec>();
for (const w of ALL_WEAPONS) {
  if (!w.projectile) continue;
  SPEC_KEYS.set(w.projectile, w.id);
  SPECS_BY_KEY.set(w.id, w.projectile);
  const frag = w.projectile.fragments?.spec;
  if (frag) {
    SPEC_KEYS.set(frag, `${w.id}.frag`);
    SPECS_BY_KEY.set(`${w.id}.frag`, frag);
  }
}
export const specKey = (s: ProjectileSpec): string => SPEC_KEYS.get(s)!;
export const specByKey = (k: string): ProjectileSpec => SPECS_BY_KEY.get(k)!;
