/** Recursos do aparelho: tela cheia, orientação, toque. Tudo opcional — falha em silêncio. */

export const isTouchDevice = (): boolean => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function canFullscreen(): boolean {
  return !!document.documentElement.requestFullscreen;
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches;
}

export async function enterFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    // iOS Safari e algumas webviews não deixam; o jogo funciona igual
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // nada a fazer
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await exitFullscreen();
  else await enterFullscreen();
}
