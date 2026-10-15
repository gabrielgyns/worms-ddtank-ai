/**
 * Grava o canvas (e o som) em vídeo para mandar no WhatsApp.
 * mp4 quando o navegador sabe gravar (Safari, Chrome novo); senão webm.
 */
export class ClipRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private type = '';

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  start(canvas: HTMLCanvasElement, audio: MediaStream | null): boolean {
    if (!ClipRecorder.supported()) return false;
    const stream = canvas.captureStream(60);
    for (const t of audio?.getAudioTracks() ?? []) stream.addTrack(t);
    // H.264 primeiro: é o que o WhatsApp aceita em todo lugar
    const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    this.type = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    try {
      this.rec = new MediaRecorder(stream, this.type ? { mimeType: this.type, videoBitsPerSecond: 4_000_000 } : undefined);
    } catch {
      return false;
    }
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    return true;
  }

  get recording(): boolean {
    return this.rec?.state === 'recording';
  }

  stop(): Promise<Blob | null> {
    const rec = this.rec;
    this.rec = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        for (const t of rec.stream.getTracks()) if (t.kind === 'video') t.stop();
        resolve(this.chunks.length ? new Blob(this.chunks, { type: (this.type || rec.mimeType).split(';')[0] }) : null);
      };
      rec.stop();
    });
  }
}

/** Compartilha pelo menu do sistema (celular); no PC, baixa o arquivo. */
export async function shareClip(blob: Blob, name = 'bolotas-melhor-lance'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([blob], `${name}.${ext}`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Bolotas em Guerra', text: 'Olha esse lance! 💥' });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
