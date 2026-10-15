/**
 * Pacotes de voz gravados (estilo Worms): cada pacote é um único mp3 com todas as
 * falas em sequência ("sprite" de áudio) e aqui fica onde cada fala começa.
 * Gerado a partir da gravação; roteiro em docs/vozes.md.
 */

/** Momento do jogo em que uma fala toca. */
export type VoiceCue =
  | 'turn'
  | 'fire'
  | 'hit'
  | 'kill'
  | 'miss'
  | 'self'
  | 'friendly'
  | 'ouch'
  | 'big'
  | 'low'
  | 'fall'
  | 'drown'
  | 'death'
  | 'win'
  | 'lose'
  | 'hurry'
  | 'crate'
  | 'sheep'
  | 'airstrike'
  | 'banana'
  | 'teleport'
  | 'laugh'
  | 'relief'
  | 'grumpy'
  | 'whistle';

/** [momento, legenda do balão, início (s), duração (s)] */
export type VoiceClip = readonly [VoiceCue, string, number, number];

export interface VoicePackDef {
  /** mesmo id do cosmético (slot 'voice') */
  id: string;
  url: string;
  clips: readonly VoiceClip[];
}

export const VOICE_PACKS: Record<string, VoicePackDef> = {
  'voice-original': {
    id: 'voice-original',
    url: './voices/original.mp3',
    clips: [
      ['turn', 'Minha vez!', 0.35, 0.8968],
      ['turn', 'Deixa comigo!', 1.5967, 0.9526],
      ['turn', 'Hora do show!', 2.8993, 1.354],
      ['fire', 'Toma!', 4.6033, 0.8305],
      ['fire', 'Lá vai!', 5.7838, 1.06],
      ['fire', 'Fogo!', 7.1938, 1.4253],
      ['fire', 'Segura essa!', 8.9691, 0.9888],
      ['hit', 'Na mosca!', 10.3079, 0.9604],
      ['hit', 'Bem feito!', 11.6183, 1.134],
      ['hit', 'Hehehe!', 13.1022, 1.32],
      ['kill', 'Próximo!', 14.7722, 1.2267],
      ['kill', 'Tchau, tchau!', 16.349, 1.2017],
      ['kill', 'Foi mal… só que não.', 17.9007, 1.2388],
      ['miss', 'Errei!', 19.4894, 0.94],
      ['miss', 'Ah, não!', 20.7794, 1.3011],
      ['miss', 'Era pra ser assim mesmo…', 22.4305, 1.1995],
      ['self', 'Ops…', 23.98, 0.5245],
      ['self', 'Ninguém viu isso.', 24.8546, 0.8],
      ['friendly', 'Fogo amigo?!', 26.0046, 0.92],
      ['friendly', 'Ei, eu sou do seu time!', 27.2746, 1.64],
      ['ouch', 'Ai!', 29.2646, 0.5636],
      ['ouch', 'Ui!', 30.1782, 0.5709],
      ['big', 'AAAAI!', 31.099, 1.6946],
      ['ouch', 'Essa doeu!', 33.1436, 1.22],
      ['low', 'Socorro!', 34.7136, 1.097],
      ['low', 'Tô mal…', 36.1605, 0.8717],
      ['fall', 'Aaaaaaa!', 37.3822, 2.7142],
      ['drown', 'Glub glub!', 40.4463, 1.0694],
      ['death', 'Tchau!', 41.8657, 0.7446],
      ['death', 'Fui…', 42.9603, 0.5507],
      ['win', 'Vitória!', 43.861, 1.372],
      ['win', 'Somos os melhores!', 45.5829, 0.8807],
      ['lose', 'Perdemos…', 46.8136, 0.8],
      ['hurry', 'Rápido, rápido!', 47.9636, 1.02],
      ['crate', 'Oba, presente!', 49.3336, 1.8526],
      ['sheep', 'Bééé!', 51.5362, 1.8564],
      ['airstrike', 'Ataque aéreo!', 53.7426, 1.5493],
      ['banana', 'Banana!', 55.6419, 1.459],
      ['teleport', 'Teletransporte!', 57.4508, 1.603],
      ['laugh', 'Muahaha!', 59.4038, 1.5988],
      ['relief', 'Ufa!', 61.3526, 0.7239],
      ['grumpy', 'Hmpf!', 62.4266, 0.4305],
      ['whistle', '♪ fiu-fiu ♪', 63.207, 1.1832],
    ],
  },
};
