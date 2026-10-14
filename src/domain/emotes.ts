/** Frases rápidas (catálogo). Cosmético: não passa pela simulação. */
export const EMOTES = [
  { id: 'boa', text: 'Boa!' },
  { id: 'ops', text: 'Ops…' },
  { id: 'haha', text: 'Hahaha!' },
  { id: 'socorro', text: 'Socorro!' },
  { id: 'mira', text: 'Que mira!' },
  { id: 'vento', text: 'Maldito vento!' },
  { id: 'gg', text: 'GG!' },
  { id: 'revanche', text: 'Revanche?' },
] as const;

export type EmoteId = (typeof EMOTES)[number]['id'];

export const emoteText = (id: string): string | null => EMOTES.find((e) => e.id === id)?.text ?? null;
