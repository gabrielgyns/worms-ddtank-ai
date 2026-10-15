/**
 * Ondulações na superfície da água: cada impacto solta uma onda que corre para os
 * dois lados e some. Só visual; a regra da água (afogar) continua sendo a linha
 * reta de `terrain.waterY`.
 */
export class WaterRipples {
  private list: Array<{ x: number; t: number; a: number }> = [];

  /** `power` em pixels de altura da onda no começo. */
  add(x: number, power: number): void {
    if (this.list.length >= 14) this.list.shift();
    this.list.push({ x, t: 0, a: power });
  }

  update(dt: number): void {
    for (const r of this.list) r.t += dt;
    this.list = this.list.filter((r) => r.t < 4);
  }

  get active(): boolean {
    return this.list.length > 0;
  }

  /** Quanto a superfície sobe (negativo) ou desce em `x` agora. */
  at = (x: number): number => {
    let y = 0;
    for (const r of this.list) {
      const d = Math.abs(x - r.x);
      const front = 150 * r.t;
      if (d > front + 30) continue;
      // a frente da onda entra suave; tudo some com o tempo e a distância
      const edge = Math.min(1, (front + 30 - d) / 60);
      y += r.a * edge * Math.exp(-r.t * 0.9) * Math.exp(-d / 320) * Math.sin(d * 0.085 - r.t * 12.8);
    }
    return y;
  };
}
