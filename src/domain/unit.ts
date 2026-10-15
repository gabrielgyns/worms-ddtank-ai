import type { Look } from './cosmetics';
import type { WeaponId } from './weapons';

export type Control = 'human' | 'cpu';

export interface Team {
  id: number;
  name: string;
  color: string;
  light: string;
  dark: string;
  control: Control;
  units: Unit[];
  /** índice da próxima bolota a jogar */
  cursor: number;
  ammo: Map<WeaponId, number>;
  /** arma escolhida por último por este time */
  weapon: WeaponId;
  /** cosméticos (só visual) */
  look: Look;
  /** times do mesmo lado são aliados (co-op contra o chefão) */
  side: number;
  /** é o time do chefão */
  boss: boolean;
}

/** Uma "bolota": o soldadinho redondo controlado por um time. */
export class Unit {
  vx = 0;
  vy = 0;
  hp = 100;
  facing: 1 | -1 = 1;
  /** ângulo de mira em radianos, 0 = horizontal, positivo = para cima */
  aim = 0.6;
  onGround = false;
  alive = true;
  drowned = false;
  /** acumulador para andar pixel a pixel */
  walkAccum = 0;
  walkPhase = 0;
  /** última força usada — marcador na barra de força, estilo DDTank */
  lastPower = -1;
  /** maior velocidade de queda desde que saiu do chão */
  fallSpeed = 0;
  /** pendurada na corda ninja: ponto de apoio e comprimento */
  rope: { ax: number; ay: number; len: number } | null = null;
  /** paraquedas aberto */
  chute = false;
  /** tamanho (1 = bolota normal; o chefão é bem maior) */
  size = 1;
  /** quem acertou esta bolota por último (para creditar a eliminação) */
  lastHitBy: Unit | null = null;
  /** só cosmético (piscar, respirar); derivado do id para não depender de Math.random */
  get seed(): number {
    return (this.id * 137.5) % 1000;
  }

  constructor(
    readonly id: number,
    readonly team: Team,
    readonly name: string,
    public x: number,
    public y: number,
  ) {}

  get cx(): number {
    return this.x;
  }
  /** centro do corpo (x, y é o pé) */
  get cy(): number {
    return this.y - 12 * this.size;
  }

  get radius(): number {
    return UNIT_RADIUS * this.size;
  }
}

export const UNIT_RADIUS = 11;
