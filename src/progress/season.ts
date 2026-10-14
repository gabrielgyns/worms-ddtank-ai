/** Temporada = mês do calendário (UTC, igual ao servidor). */
export function seasonOf(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousSeason(d = new Date()): string {
  return seasonOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15)));
}

/** Dias até a temporada acabar. */
export function daysLeft(d = new Date()): number {
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - d.getTime()) / 86400000));
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function seasonName(s: string): string {
  const [y, m] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export const SEASON_REWARD = 'hat-louros';
