/** localStorage com JSON e tolerância a falhas (aba privada, storage cheio). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`bolotas:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`bolotas:${key}`, JSON.stringify(value));
    } catch {
      // sem storage: o jogo continua, só não lembra
    }
  },
};
