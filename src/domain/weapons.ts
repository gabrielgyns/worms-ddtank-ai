/** Como um projétil se comporta em voo. */
export interface ProjectileSpec {
  kind: 'missile' | 'grenade' | 'bomblet' | 'dynamite' | 'cluster';
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
  | 'boss-meteoro'
  | 'boss-rajada'
  | 'boss-pisao';

/** utility: corda e paraquedas — não gastam a vez */
export type AimMode = 'charge' | 'drop' | 'target' | 'utility';

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
];

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
