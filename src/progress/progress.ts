import { store } from '../services/store';

/** Tudo que o jogador acumula: moedas, conquistas, itens e o que está vestindo. */
export interface ProgressState {
  coins: number;
  /** conquista → quando desbloqueou (ms) */
  unlocked: Record<string, number>;
  owned: string[];
  /** encaixe → item vestido */
  equipped: Record<string, string>;
  /** baús de conquista já abertos */
  chestsOpened: number;
  /** para mesclar com o servidor: maior versão ganha */
  updatedAt: number;
}

/** Estado novo a cada chamada: nada de arrays compartilhados entre instâncias. */
const empty = (): ProgressState => ({ coins: 0, unlocked: {}, owned: [], equipped: {}, chestsOpened: 0, updatedAt: 0 });

/** Um baú a cada tantas conquistas. */
export const ACHIEVEMENTS_PER_CHEST = 3;

type Listener = (s: ProgressState) => void;

/**
 * Progresso do jogador. Vive no aparelho e, com conta, é espelhado no servidor.
 * Mesclar é generoso: soma de conquistas e itens, saldo do mais recente.
 */
export class Progress {
  private s: ProgressState;
  private fns: Listener[] = [];
  /** chamado a cada mudança (o backend usa para sincronizar) */
  onSave: ((s: ProgressState) => void) | null = null;

  constructor() {
    this.s = { ...empty(), ...store.get<Partial<ProgressState>>('progress', {}) };
  }

  get state(): Readonly<ProgressState> {
    return this.s;
  }

  on(fn: Listener): void {
    this.fns.push(fn);
  }

  private commit(): void {
    this.s.updatedAt = Date.now();
    store.set('progress', this.s);
    this.onSave?.(this.s);
    for (const fn of this.fns) fn(this.s);
  }

  /** Junta com o que veio do servidor. */
  merge(remote: ProgressState | null): void {
    if (!remote) {
      this.onSave?.(this.s);
      return;
    }
    const newer = remote.updatedAt > this.s.updatedAt ? remote : this.s;
    this.s = {
      coins: newer.coins,
      unlocked: { ...remote.unlocked, ...this.s.unlocked },
      owned: [...new Set([...remote.owned, ...this.s.owned])],
      equipped: { ...newer.equipped },
      chestsOpened: Math.max(remote.chestsOpened ?? 0, this.s.chestsOpened),
      updatedAt: Math.max(remote.updatedAt, this.s.updatedAt),
    };
    this.commit();
  }

  isUnlocked(id: string): boolean {
    return !!this.s.unlocked[id];
  }

  unlock(id: string): boolean {
    if (this.s.unlocked[id]) return false;
    this.s.unlocked[id] = Date.now();
    this.commit();
    return true;
  }

  addCoins(n: number): void {
    this.s.coins = Math.max(0, this.s.coins + Math.round(n));
    this.commit();
  }

  owns(item: string): boolean {
    return this.s.owned.includes(item);
  }

  give(item: string): boolean {
    if (this.owns(item)) return false;
    this.s.owned.push(item);
    this.commit();
    return true;
  }

  /** Compra: debita e entrega; falha se não tiver saldo. */
  buy(item: string, price: number): boolean {
    if (this.owns(item) || this.s.coins < price) return false;
    this.s.coins -= price;
    this.s.owned.push(item);
    this.commit();
    return true;
  }

  equip(slot: string, item: string | null): void {
    if (item === null) delete this.s.equipped[slot];
    else if (this.owns(item)) this.s.equipped[slot] = item;
    this.commit();
  }

  /** Baús esperando para abrir. */
  get chestsAvailable(): number {
    return Math.floor(Object.keys(this.s.unlocked).length / ACHIEVEMENTS_PER_CHEST) - this.s.chestsOpened;
  }

  /**
   * Abre um baú: sempre dá um item que você ainda não tem (da loja) e moedas.
   * Se já tiver tudo, vira moedas. `pick` escolhe entre os candidatos.
   */
  openChest(candidates: string[], pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): { item: string | null; coins: number } | null {
    if (this.chestsAvailable <= 0) return null;
    const pool = candidates.filter((c) => !this.owns(c));
    const item = pool.length ? pool[pick(pool.length)] : null;
    const coins = item ? 100 : 400;
    this.s.chestsOpened++;
    if (item) this.s.owned.push(item);
    this.s.coins += coins;
    this.commit();
    return { item, coins };
  }

  equipped(slot: string): string | null {
    return this.s.equipped[slot] ?? null;
  }
}

let instance: Progress | null = null;
export function progress(): Progress {
  instance ??= new Progress();
  return instance;
}
