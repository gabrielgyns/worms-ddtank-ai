import type { Sfx } from './audio';
import { VOICE_PACKS, type VoiceCue } from './voicepacks';

/** Áudio decodificado por pacote; vale para todas as partidas da sessão. */
const buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();

/** Toca as falas gravadas dos pacotes de voz (sorteando entre as versões de cada momento). */
export class VoicePlayer {
  private last = new Map<string, number>();

  constructor(private sfx: Sfx) {}

  /** Começa a baixar o pacote (uma vez só). Sem pacote ou com erro, quem chama cai no balbucio. */
  preload(id: string | undefined): void {
    if (!id || buffers.has(id)) return;
    const def = VOICE_PACKS[id];
    if (!def) return;
    buffers.set(id, 'loading');
    fetch(def.url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      // decodifica fora do contexto principal: funciona antes do primeiro clique (que destrava o som)
      .then((ab) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab))
      .then((buf) => buffers.set(id, buf))
      .catch(() => buffers.set(id, 'failed'));
  }

  ready(id: string | undefined): boolean {
    return !!id && buffers.get(id) instanceof AudioBuffer;
  }

  /**
   * Toca uma fala do momento com a velocidade dada (acima de 1 = mais aguda, efeito esquilo).
   * Devolve a legenda e quanto dura, ou null se não tocou.
   */
  play(id: string, cue: VoiceCue, rate: number): { text: string; dur: number } | null {
    const buf = buffers.get(id);
    const def = VOICE_PACKS[id];
    if (!(buf instanceof AudioBuffer) || !def) return null;
    const options = def.clips.map((c, i) => [c, i] as const).filter(([c]) => c[0] === cue);
    if (!options.length) return null;
    // não repete a mesma versão duas vezes seguidas
    const key = `${id}:${cue}`;
    const fresh = options.length > 1 ? options.filter(([, i]) => i !== this.last.get(key)) : options;
    const [clip, idx] = fresh[Math.floor(Math.random() * fresh.length)];
    if (!this.sfx.playClip(buf, clip[2], clip[3], rate)) return null;
    this.last.set(key, idx);
    return { text: clip[1], dur: clip[3] / rate };
  }
}
