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

/** Perfil do aparelho: decide HUD e controles. O PC continua exatamente como antes. */
export interface DeviceProfile {
  touch: boolean;
  /** tela pequena (celular), em qualquer orientação */
  small: boolean;
}

export function deviceProfile(): DeviceProfile {
  const touch = isTouchDevice();
  const small = Math.min(window.innerWidth, window.innerHeight) < 540;
  return { touch, small };
}

export function applyProfile(p: DeviceProfile): void {
  document.body.classList.toggle('is-touch', p.touch);
  document.body.classList.toggle('is-small', p.small);
}

let vibrationOn = true;
export function setVibration(on: boolean): void {
  vibrationOn = on;
}

/** Vibra se o aparelho permitir (Android; iOS ignora). */
export function vibrate(pattern: number | number[]): void {
  if (!vibrationOn || !isTouchDevice()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // sem suporte
  }
}
