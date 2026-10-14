/** Catálogo de cosméticos. Só visual: nada aqui muda a regra do jogo. */

export type Slot = 'hat' | 'eyes' | 'body' | 'grave' | 'trail' | 'boom' | 'aim' | 'grenade' | 'dance' | 'title';

export interface Cosmetic {
  id: string;
  slot: Slot;
  name: string;
  /** preço na loja; null = só por conquista */
  price: number | null;
}

export const SLOT_NAME: Record<Slot, string> = {
  hat: 'Chapéu',
  eyes: 'Olhos',
  body: 'Corpo',
  grave: 'Lápide',
  trail: 'Rastro do míssil',
  boom: 'Explosão',
  aim: 'Mira',
  grenade: 'Granada',
  dance: 'Dancinha de vitória',
  title: 'Título',
};

export const COSMETICS: readonly Cosmetic[] = [
  // chapéus
  { id: 'hat-pirata', slot: 'hat', name: 'Chapéu de pirata', price: 150 },
  { id: 'hat-chef', slot: 'hat', name: 'Chapéu de chef', price: 150 },
  { id: 'hat-festa', slot: 'hat', name: 'Chapéu de festa', price: 120 },
  { id: 'hat-cartola', slot: 'hat', name: 'Cartola', price: 250 },
  { id: 'hat-boia', slot: 'hat', name: 'Boia na cabeça', price: null },
  { id: 'hat-crown', slot: 'hat', name: 'Coroa', price: null },
  { id: 'hat-louros', slot: 'hat', name: 'Coroa de louros (campeão)', price: null },
  // olhos
  { id: 'eyes-oculos', slot: 'eyes', name: 'Óculos escuros', price: 100 },
  { id: 'eyes-monoculo', slot: 'eyes', name: 'Monóculo', price: 180 },
  // corpo
  { id: 'body-listras', slot: 'body', name: 'Listras', price: 200 },
  { id: 'body-bolinhas', slot: 'body', name: 'Bolinhas', price: 200 },
  { id: 'skin-ouro', slot: 'body', name: 'Bolota dourada', price: null },
  // lápide
  { id: 'grave-cogumelo', slot: 'grave', name: 'Cogumelo', price: 120 },
  { id: 'grave-trofeu', slot: 'grave', name: 'Troféu', price: 200 },
  { id: 'grave-ops', slot: 'grave', name: 'Lápide "Ops"', price: null },
  // rastro
  { id: 'trail-estrelas', slot: 'trail', name: 'Estrelinhas', price: 200 },
  { id: 'trail-arcoiris', slot: 'trail', name: 'Arco-íris', price: 300 },
  { id: 'trail-leaves', slot: 'trail', name: 'Folhas ao vento', price: null },
  // explosão
  { id: 'boom-coracao', slot: 'boom', name: 'Corações', price: 250 },
  { id: 'boom-confetti', slot: 'boom', name: 'Confete', price: null },
  // outros
  { id: 'aim-gold', slot: 'aim', name: 'Mira dourada', price: null },
  { id: 'skin-abacaxi', slot: 'grenade', name: 'Granada de abacaxi', price: null },
  { id: 'dance-giro', slot: 'dance', name: 'Giro', price: 150 },
  { id: 'dance-cambalhota', slot: 'dance', name: 'Cambalhota', price: 200 },
  { id: 'title-lenda', slot: 'title', name: 'Título "Lenda"', price: null },
];

export const cosmetic = (id: string): Cosmetic | undefined => COSMETICS.find((c) => c.id === id);

/** O visual de um time: encaixe → item. Vazio = padrão. */
export type Look = Partial<Record<Slot, string>>;
