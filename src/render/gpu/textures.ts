import { Texture } from 'pixi.js';

/**
 * Texturas feitas por código, uma vez, num canvas 2D e entregues à GPU.
 * É o "estúdio" do visual novo: tudo sai daqui até existir arte desenhada.
 */
function bake(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  return Texture.from(cv);
}

/** Ruído determinístico barato (para manchas e bordas irregulares). */
export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface VfxTextures {
  glow: Texture;
  smoke: Texture[];
  flame: Texture;
  spark: Texture;
  ring: Texture;
  chunk: Texture[];
  leaf: Texture;
  speed: Texture;
}

export function makeVfxTextures(): VfxTextures {
  const glow = bake(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  // fumaça: bolota fofa feita de vários círculos suaves com borda irregular
  const smoke = [0, 1, 2].map((k) =>
    bake(128, 128, (c) => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + k;
        const r = 18 + hash(i, k) * 16;
        const x = 64 + Math.cos(a) * (14 + hash(k, i) * 12);
        const y = 64 + Math.sin(a) * (12 + hash(i + 3, k) * 10);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 40);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }),
  );
  // labareda: gota de fogo, quente no pé e transparente na ponta
  const flame = bake(64, 128, (c) => {
    const g = c.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(32, 4);
    c.bezierCurveTo(52, 50, 62, 80, 52, 108);
    c.quadraticCurveTo(32, 128, 12, 108);
    c.bezierCurveTo(2, 80, 12, 50, 32, 4);
    c.fill();
  });
  const spark = bake(64, 8, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(32, 4, 32, 3, 0, 0, Math.PI * 2);
    c.fill();
  });
  const ring = bake(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 96, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });
  // pedaços de terra: polígonos irregulares com contorno escuro
  const chunk = [0, 1, 2, 3].map((k) =>
    bake(32, 32, (c) => {
      c.beginPath();
      const n = 5 + (k % 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 9 + hash(i, k + 9) * 6;
        c.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = '#ffffff';
      c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = 'rgba(40,25,15,0.9)';
      c.stroke();
    }),
  );
  const leaf = bake(24, 16, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(12, 8, 10, 5, 0.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(3, 9);
    c.lineTo(21, 7);
    c.stroke();
  });
  // linhas de velocidade estilo mangá (traço afinando)
  const speed = bake(256, 8, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, 4);
    c.lineTo(256, 1.5);
    c.lineTo(256, 6.5);
    c.closePath();
    c.fill();
  });
  return { glow, smoke, flame, spark, ring, chunk, leaf, speed };
}
