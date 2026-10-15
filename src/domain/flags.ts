import { ITEMS } from './items';
import { WEAPONS, type WeaponId } from './weapons';

/** Liga/desliga por chave. Chave ausente = ligada (o jogo nasce com tudo ligado). */
export type Flags = Record<string, boolean>;

export type FlagGroup = 'Armas' | 'Itens' | 'Modos' | 'Telas';

export interface FlagDef {
  key: string;
  label: string;
  group: FlagGroup;
}

/** Catálogo do que dá para ligar e desligar pelo painel de admin. */
export const FLAGS: readonly FlagDef[] = [
  ...WEAPONS.map((w) => ({ key: `weapon:${w.id}`, label: w.name, group: 'Armas' as const })),
  ...ITEMS.map((i) => ({ key: `item:${i.id}`, label: i.name, group: 'Itens' as const })),
  { key: 'mode:cpu', label: 'Contra CPU', group: 'Modos' },
  { key: 'mode:pvp', label: '2 jogadores no mesmo PC', group: 'Modos' },
  { key: 'mode:duo', label: '2x2', group: 'Modos' },
  { key: 'mode:boss', label: 'Chefão', group: 'Modos' },
  { key: 'mode:hill', label: 'Rei da colina', group: 'Modos' },
  { key: 'mode:online', label: 'Online (salas)', group: 'Modos' },
  { key: 'mode:mail', label: 'Partida por link', group: 'Modos' },
  { key: 'screen:missions', label: 'Missões', group: 'Telas' },
  { key: 'screen:daily', label: 'Desafio do dia', group: 'Telas' },
  { key: 'screen:editor', label: 'Editor de mapas', group: 'Telas' },
  { key: 'screen:shop', label: 'Loja', group: 'Telas' },
  { key: 'screen:tutorial', label: 'Tutorial', group: 'Telas' },
];

export const isOn = (flags: Flags, key: string): boolean => flags[key] !== false;

/** Armas desligadas (vão no setup da partida, para os dois lados do online jogarem igual). */
export function disabledWeapons(flags: Flags): WeaponId[] {
  return WEAPONS.filter((w) => !isOn(flags, `weapon:${w.id}`)).map((w) => w.id);
}
