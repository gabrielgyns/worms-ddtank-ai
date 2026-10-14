/** Paleta visual de um cenário. Só dados — quem desenha é a camada de render. */
export interface Theme {
  id: ThemeId;
  name: string;
  sky: [string, string, string];
  sun: string;
  far: string;
  mid: string;
  near: string;
  grass: [string, string, string];
  dirt: [string, string];
  speck: string;
  outline: string;
  water: [string, string];
  cloud: string;
}

export type ThemeId = 'prado' | 'deserto' | 'neve' | 'doce';

export const THEMES: Record<ThemeId, Theme> = {
  prado: {
    id: 'prado',
    name: 'Prado',
    sky: ['#5ec8ff', '#a6e4ff', '#fff3d1'],
    sun: '#fff6b0',
    far: '#9fc9e8',
    mid: '#7fbf8f',
    near: '#5aa86a',
    grass: ['#b6f05a', '#7fd13b', '#4e9a2a'],
    dirt: ['#a9713f', '#7a4b26'],
    speck: '#5c361b',
    outline: '#3a2414',
    water: ['#3fa9f5', '#1f6fc4'],
    cloud: '#ffffff',
  },
  deserto: {
    id: 'deserto',
    name: 'Deserto',
    sky: ['#ff9a5a', '#ffc98b', '#ffe9c4'],
    sun: '#fff1a8',
    far: '#e8a77a',
    mid: '#d68a5c',
    near: '#c27045',
    grass: ['#ffe08a', '#f2c25b', '#d39a3a'],
    dirt: ['#d9934f', '#a8622e'],
    speck: '#7d421c',
    outline: '#4a2610',
    water: ['#38c6c9', '#1d8a98'],
    cloud: '#fff4e6',
  },
  neve: {
    id: 'neve',
    name: 'Neve',
    sky: ['#4a6fb5', '#8fb3e6', '#e3f0ff'],
    sun: '#f4fbff',
    far: '#b7c9e8',
    mid: '#94acd6',
    near: '#7591c2',
    grass: ['#ffffff', '#e2f0ff', '#b9d3f0'],
    dirt: ['#7d8fb3', '#55648a'],
    speck: '#3c4767',
    outline: '#252c45',
    water: ['#5a8fd8', '#2d4f99'],
    cloud: '#ffffff',
  },
  doce: {
    id: 'doce',
    name: 'Terra Doce',
    sky: ['#ff8fd0', '#ffc2e6', '#fff0fa'],
    sun: '#fff8c4',
    far: '#e7b0e9',
    mid: '#cf8fe0',
    near: '#b673d6',
    grass: ['#ffd1f0', '#ff9ad5', '#e866b4'],
    dirt: ['#9b5d3a', '#6e3a22'],
    speck: '#f2f2f2',
    outline: '#3d1d17',
    water: ['#9b7bff', '#6247d6'],
    cloud: '#ffffff',
  },
};
