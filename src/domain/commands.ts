import type { WeaponId } from './weapons';

/** Passo fixo da simulação. */
export const DT = 1 / 60;

/**
 * Tudo o que um jogador pode fazer num tick. É a única porta de entrada do estado:
 * teclado, toque, CPU, replay e rede produzem `TickInput`s.
 * Só dados simples — pode virar JSON e atravessar a rede.
 */
export interface TickInput {
  weapon?: WeaponId;
  face?: 1 | -1;
  walk?: 1 | -1;
  /** variação do ângulo de mira neste tick, em radianos */
  aim?: number;
  /** ângulo de mira absoluto (mira por arrastar; seguro na rede) */
  aimTo?: number;
  jump?: 'front' | 'back';
  charge?: 'start' | 'release';
  /** limite de força ao carregar (usado pela CPU) */
  chargeLimit?: number;
  /** alvo de armas de clique (ataque aéreo, teletransporte) */
  target?: { x: number; y: number };
  /** time que abandonou a partida (desconectou por tempo demais) */
  forfeit?: number;
}

/** Um comando com o tick em que foi aplicado. */
export interface Command {
  tick: number;
  input: TickInput;
}

export const NO_INPUT: Readonly<TickInput> = Object.freeze({});

export function isEmptyInput(i: TickInput): boolean {
  for (const k in i) if (i[k as keyof TickInput] !== undefined) return false;
  return true;
}
