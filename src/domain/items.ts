/** Itens de turno estilo DDTank: gastos sem passar a vez. */
export type ItemId = 'power' | 'double' | 'shield';

export interface ItemDef {
  id: ItemId;
  name: string;
  hint: string;
  icon: string;
  /** tecla (código do KeyboardEvent) */
  key: string;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'power', name: 'Força +50%', hint: 'Os tiros desta vez causam 50% mais dano.', icon: '💪', key: 'KeyZ' },
  { id: 'double', name: 'Tiro duplo', hint: 'Atire duas vezes nesta vez (gasta munição das duas).', icon: '✌️', key: 'KeyX' },
  { id: 'shield', name: 'Escudo', hint: 'Metade do dano até a sua próxima vez.', icon: '🛡️', key: 'KeyC' },
];

/** Quanto cada time recebe no começo da partida. */
export const ITEMS_START: Readonly<Record<ItemId, number>> = { power: 1, double: 1, shield: 1 };

export const POWER_MULT = 1.5;
export const SHIELD_MULT = 0.5;

export function isItemId(x: unknown): x is ItemId {
  return ITEMS.some((i) => i.id === x);
}
