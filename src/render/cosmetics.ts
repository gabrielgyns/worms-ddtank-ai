import type { Look } from '../domain/cosmetics';
import type { Team } from '../domain/unit';

const INK = '#2a1a12';

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/**
 * Preenche o corpo (elipse centrada em 0,0, raio 11.5×12.5) conforme o visual.
 * Chamado já no espaço local do corpo.
 */
export function drawBody(c: CanvasRenderingContext2D, team: Team, look: Look): void {
  const gold = look.body === 'skin-ouro';
  const g = c.createRadialGradient(-4, -6, 2, 0, 0, 15);
  g.addColorStop(0, gold ? '#fff6b8' : team.light);
  g.addColorStop(1, gold ? '#e0a313' : team.color);
  c.fillStyle = g;
  ellipse(c, 0, 0, 11.5, 12.5);
  c.fill();
  if (look.body === 'body-listras' || look.body === 'body-bolinhas') {
    c.save();
    ellipse(c, 0, 0, 11.5, 12.5);
    c.clip();
    c.fillStyle = team.dark;
    c.globalAlpha = 0.45;
    if (look.body === 'body-listras') for (let y = -12; y < 14; y += 6) c.fillRect(-13, y, 26, 2.6);
    else
      for (const [x, y] of [
        [-6, -2],
        [5, -5],
        [-3, 7],
        [7, 5],
        [-9, 6],
        [0, 1],
      ]) {
        ellipse(c, x, y, 1.8, 1.8);
        c.fill();
      }
    c.restore();
  }
  if (gold) {
    c.fillStyle = 'rgba(255,255,255,0.6)';
    star(c, -6, -2, 2.2);
  }
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  ellipse(c, 0, 0, 11.5, 12.5);
  c.stroke();
}

/** Chapéu (ou o capacete padrão), no espaço local do corpo. */
export function drawHat(c: CanvasRenderingContext2D, team: Team, hat: string | undefined): void {
  c.lineWidth = 2;
  c.strokeStyle = INK;
  switch (hat) {
    case 'hat-pirata':
      c.fillStyle = '#2b2b2b';
      c.beginPath();
      c.moveTo(-15, -6);
      c.quadraticCurveTo(0, -22, 15, -6);
      c.quadraticCurveTo(0, -11, -15, -6);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      ellipse(c, 0, -12, 2.2, 2);
      c.fill();
      c.fillRect(-2.5, -9.6, 5, 1.2);
      return;
    case 'hat-chef':
      c.fillStyle = '#fff';
      c.fillRect(-8, -12, 16, 6);
      c.strokeRect(-8, -12, 16, 6);
      for (const [x, y, r] of [
        [-6, -15, 5],
        [0, -18, 6],
        [6, -15, 5],
      ]) {
        ellipse(c, x, y, r, r);
        c.fill();
        c.stroke();
      }
      c.fillRect(-7, -13, 14, 3);
      return;
    case 'hat-festa':
      c.fillStyle = team.light;
      c.beginPath();
      c.moveTo(-7, -9);
      c.lineTo(2, -28);
      c.lineTo(9, -9);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = team.dark;
      c.lineWidth = 2;
      for (const k of [0.35, 0.65]) {
        c.beginPath();
        c.moveTo(-7 + 9 * k, -9 - 19 * k);
        c.lineTo(9 - 7 * k, -9 - 19 * k);
        c.stroke();
      }
      c.fillStyle = '#ffe066';
      c.strokeStyle = INK;
      ellipse(c, 2, -29, 3, 3);
      c.fill();
      c.stroke();
      return;
    case 'hat-cartola':
      c.fillStyle = '#222';
      c.fillRect(-14, -11, 28, 3.5);
      c.strokeRect(-14, -11, 28, 3.5);
      c.fillRect(-8, -27, 16, 16);
      c.strokeRect(-8, -27, 16, 16);
      c.fillStyle = team.color;
      c.fillRect(-8, -15, 16, 3);
      return;
    case 'hat-boia':
      c.lineWidth = 6;
      c.strokeStyle = INK;
      ellipse(c, 0, -10, 12, 4.5);
      c.stroke();
      c.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        c.strokeStyle = i % 2 ? '#fff' : '#ff4a3a';
        c.beginPath();
        c.ellipse(0, -10, 12, 4.5, 0, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4);
        c.stroke();
      }
      return;
    case 'hat-crown':
      c.fillStyle = '#ffd23a';
      c.beginPath();
      c.moveTo(-10, -8);
      c.lineTo(-11, -20);
      c.lineTo(-5, -14);
      c.lineTo(0, -22);
      c.lineTo(5, -14);
      c.lineTo(11, -20);
      c.lineTo(10, -8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ff4a6a';
      ellipse(c, 0, -11, 1.8, 1.8);
      c.fill();
      return;
    default:
      // capacete padrão do time
      c.fillStyle = team.dark;
      c.beginPath();
      c.arc(0, -1, 12.6, Math.PI * 1.06, Math.PI * 1.94);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.roundRect(-13, -3.5, 27, 4, 2);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.beginPath();
      c.ellipse(-4, -8, 4, 2, -0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffe066';
      star(c, 1, -7.5, 3);
  }
}

/** Acessório de olhos, por cima dos olhos. */
export function drawEyewear(c: CanvasRenderingContext2D, eyes: string | undefined): void {
  if (eyes === 'eyes-oculos') {
    c.fillStyle = '#1b1b1b';
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(-1, 0, 8.5, 5.5, 2);
    c.roundRect(7, 0.5, 6, 5, 2);
    c.fill();
    c.fillRect(-4, 1.5, 4, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0.5, 1, 3, 1);
  } else if (eyes === 'eyes-monoculo') {
    c.strokeStyle = '#d9a514';
    c.lineWidth = 1.6;
    ellipse(c, 9, 2.5, 3.8, 4.4);
    c.stroke();
    c.beginPath();
    c.moveTo(9, 7);
    c.quadraticCurveTo(10, 12, 6, 14);
    c.stroke();
  }
}

/** Lápide conforme o visual; posição já é o pé. */
export function drawGraveLook(c: CanvasRenderingContext2D, x: number, y: number, color: string, grave: string | undefined): boolean {
  if (!grave) return false;
  c.save();
  c.translate(x, y);
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  if (grave === 'grave-cogumelo') {
    c.fillStyle = '#f3e6cf';
    c.fillRect(-4, -12, 8, 12);
    c.strokeRect(-4, -12, 8, 12);
    c.fillStyle = '#e8402e';
    c.beginPath();
    c.arc(0, -12, 12, Math.PI, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#fff';
    for (const [dx, dy] of [
      [-6, -16],
      [3, -19],
      [6, -14],
    ]) {
      ellipse(c, dx, dy, 2, 2);
      c.fill();
    }
  } else if (grave === 'grave-trofeu') {
    c.fillStyle = '#ffd23a';
    c.beginPath();
    c.moveTo(-9, -24);
    c.lineTo(9, -24);
    c.quadraticCurveTo(8, -10, 0, -9);
    c.quadraticCurveTo(-8, -10, -9, -24);
    c.fill();
    c.stroke();
    c.fillRect(-2, -9, 4, 5);
    c.fillRect(-7, -4, 14, 4);
    c.strokeRect(-7, -4, 14, 4);
    c.fillStyle = color;
    star(c, 0, -17, 3.5);
  } else if (grave === 'grave-ops') {
    c.fillStyle = '#b9b4c4';
    c.beginPath();
    c.moveTo(-11, 0);
    c.lineTo(-11, -16);
    c.arc(0, -16, 11, Math.PI, 0);
    c.lineTo(11, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.font = '9px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.fillText('OPS', 0, -10);
  } else {
    c.restore();
    return false;
  }
  c.restore();
  return true;
}

/** Granada de abacaxi. */
export function drawPineapple(c: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = '#f2c12e';
  ellipse(c, 0, 1, 5.5, 7);
  c.fill();
  c.stroke();
  c.strokeStyle = 'rgba(120,70,0,0.6)';
  c.lineWidth = 1;
  for (let k = -6; k <= 6; k += 4) {
    c.beginPath();
    c.moveTo(-5, k);
    c.lineTo(5, k + 4);
    c.moveTo(5, k);
    c.lineTo(-5, k + 4);
    c.stroke();
  }
  c.fillStyle = '#4fbf4a';
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-4, -5);
  c.lineTo(-2, -12);
  c.lineTo(0, -6);
  c.lineTo(2, -13);
  c.lineTo(4, -5);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

/** Deslocamento/rotação da dancinha de vitória. */
export function danceTransform(dance: string | undefined, t: number): { dy: number; rot: number } {
  if (dance === 'dance-giro') return { dy: -Math.abs(Math.sin(t * 4)) * 6, rot: (t * 6) % (Math.PI * 2) };
  if (dance === 'dance-cambalhota') {
    const k = (t * 1.2) % 1;
    return { dy: -Math.sin(k * Math.PI) * 26, rot: k * Math.PI * 2 };
  }
  return { dy: -Math.abs(Math.sin(t * 6)) * 10, rot: 0 };
}

/** Cor das partículas de rastro conforme o visual. */
export function trailParticle(trail: string | undefined, t: number): { color: string; kind: 'dot' | 'star'; size: number } | null {
  switch (trail) {
    case 'trail-estrelas':
      return { color: Math.sin(t * 20) > 0 ? '#ffe066' : '#fff6b8', kind: 'star', size: 5 };
    case 'trail-arcoiris':
      return { color: `hsl(${(t * 400) % 360} 90% 65%)`, kind: 'dot', size: 4 };
    case 'trail-leaves':
      return { color: Math.sin(t * 13) > 0 ? '#7fd13b' : '#4e9a2a', kind: 'dot', size: 3.5 };
    default:
      return null;
  }
}
