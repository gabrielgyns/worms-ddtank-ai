/** Qualidade gráfica. Começa pelo aparelho e cai sozinha se o FPS cair. */
export interface Quality {
  level: 'alta' | 'baixa';
  maxDpr: number;
  /** multiplicador da quantidade de partículas por explosão */
  particles: number;
  maxParticles: number;
}

export const HIGH: Quality = { level: 'alta', maxDpr: 2, particles: 1, maxParticles: 1500 };
export const LOW: Quality = { level: 'baixa', maxDpr: 1.25, particles: 0.45, maxParticles: 300 };

/** Mede o tempo de frame; avisa quando o aparelho não está dando conta. */
export class FrameMeter {
  private avg = 16;
  private slowFor = 0;

  /** Retorna true quando ficou lento por tempo suficiente para baixar a qualidade. */
  sample(dt: number): boolean {
    if (dt > 0.25) return false; // aba voltou do segundo plano, não conta
    this.avg += (dt * 1000 - this.avg) * 0.05;
    this.slowFor = this.avg > 26 ? this.slowFor + dt : 0;
    return this.slowFor > 2.5;
  }
}
