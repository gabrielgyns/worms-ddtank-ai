/** Cores de time disponíveis (catálogo). */
export interface TeamColor {
  name: string;
  color: string;
  light: string;
  dark: string;
}

export const TEAM_COLORS: readonly TeamColor[] = [
  { name: 'Laranja', color: '#ff8a3d', light: '#ffc89a', dark: '#c4531a' },
  { name: 'Azul', color: '#3d9bff', light: '#a6d4ff', dark: '#1d5fb8' },
  { name: 'Verde', color: '#4fbf4a', light: '#a8e8a0', dark: '#2a7a26' },
  { name: 'Roxo', color: '#9b6bff', light: '#d2bdff', dark: '#5a35b8' },
  { name: 'Rosa', color: '#ff6fae', light: '#ffc0dc', dark: '#b8336f' },
  { name: 'Amarelo', color: '#f2c12e', light: '#fbe59a', dark: '#a37a0a' },
];
