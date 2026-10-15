/** Falas das bolotas. Só enfeite: escolhidas com Math.random, fora da regra. */
export const QUIPS = {
  /** tomou pouco dano */
  ouch: ['Ai!', 'Ui!', 'Essa doeu!', 'Opa!', 'Ei!', 'Aiaiai…', 'Meu chapéu!'],
  /** tomou muito dano */
  big: ['AAAAI!', 'Minha nossa!', 'Socorro!', 'Vi estrelas…', 'Mamãe!', 'Isso vai deixar marca!'],
  /** acertado pelo próprio time */
  friendly: ['Fogo amigo?!', 'Ei, eu sou do seu time!', 'Mira direito!', 'Traidor!'],
  /** quem eliminou alguém */
  taunt: ['Toma!', 'Próximo!', 'Foi mal… só que não.', 'Hehehe!', 'Strike!', 'Na mosca!'],
  /** acertou a si mesmo */
  self: ['Ops…', 'Ninguém viu isso.', 'Foi de propósito!', 'Calculei errado…'],
} as const;

export type QuipKind = keyof typeof QUIPS;

export function quip(kind: QuipKind): string {
  const list = QUIPS[kind];
  return list[Math.floor(Math.random() * list.length)];
}
