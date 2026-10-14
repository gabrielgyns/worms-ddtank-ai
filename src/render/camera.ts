import { clamp } from '../core/math';

export class Camera {
  x = 1400;
  y = 700;
  zoom = 1;
  userZoom = 1;
  shake = 0;
  /** segundos restantes em que o jogador controla a câmera manualmente */
  manual = 0;

  constructor(
    private worldW: number,
    private worldH: number,
  ) {}

  fit(w: number, h: number): void {
    this.zoom = clamp(Math.sqrt(w * h) / 700, 0.6, 2) * this.userZoom;
  }

  follow(tx: number, ty: number, dt: number, speed = 4): void {
    if (this.manual > 0) {
      this.manual -= dt;
      return;
    }
    const k = 1 - Math.exp(-dt * speed);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  pan(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.manual = 2.5;
  }

  clampTo(w: number, h: number): void {
    const hw = w / 2 / this.zoom;
    const hh = h / 2 / this.zoom;
    if (hw * 2 >= this.worldW) this.x = this.worldW / 2;
    else this.x = clamp(this.x, hw, this.worldW - hw);
    this.y = clamp(this.y, -260 + hh, this.worldH - hh);
    if (hh * 2 >= this.worldH + 260) this.y = (this.worldH - 260) / 2;
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  toWorld(px: number, py: number, w: number, h: number): { x: number; y: number } {
    return { x: (px - w / 2) / this.zoom + this.x, y: (py - h / 2) / this.zoom + this.y };
  }
}
