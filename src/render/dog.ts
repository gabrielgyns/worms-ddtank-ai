import type { Team, Unit } from '../domain/unit';
import { drawEyewear, drawHat } from './cosmetics';
import { CREAM, drawCritter, ellipse, inked, PINK, type CritterParts, type CritterPose } from './critter';
import { drawFace, wailMouth, type Mood, type UnitDrawOpts } from './hero';
import { INK } from './sprites';

/** Duas manchas nas costas (o cachorro é malhado). */
function dogSpots(c: CanvasRenderingContext2D, team: Team): void {
  c.fillStyle = team.dark;
  ellipse(c, -6.5, -11, 3.6, 3, 0.4);
  c.fill();
  ellipse(c, -3, -4.5, 2.4, 2, -0.3);
  c.fill();
}

/** Rabo curto que abana: rápido de alegria, entre as pernas com medo, duro de raiva. */
function dogTail(c: CanvasRenderingContext2D, team: Team, mood: Mood, t: number): void {
  let base = -0.2;
  let speed = 7;
  let amp = 0.25;
  switch (mood) {
    case 'smug':
    case 'celebrate':
    case 'jump':
      speed = 28;
      amp = 0.5;
      break;
    case 'aim':
    case 'charge':
      speed = 4;
      amp = 0.1;
      break;
    case 'worried':
    case 'sob':
    case 'hurt':
      // entre as pernas
      base = 2.1;
      speed = 3;
      amp = 0.05;
      break;
    case 'angry':
      base = -0.45;
      speed = 40;
      amp = 0.03;
      break;
    case 'fall':
      base = -0.8;
      speed = 20;
      amp = 0.3;
      break;
    default:
      break;
  }
  c.save();
  c.translate(-8.5, -6);
  c.rotate(base + Math.sin(t * speed) * amp);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-7, -3, -5, -11);
  c.strokeStyle = INK;
  c.lineWidth = 8;
  c.stroke();
  c.strokeStyle = team.color;
  c.lineWidth = 4.8;
  c.stroke();
  c.fillStyle = CREAM;
  ellipse(c, -5, -11, 2.4, 2.4);
  c.fill();
  c.restore();
}

/** Orelha caída em gota; `rot` gira a partir da raiz (no pulo, voa para cima). */
function floppyEar(c: CanvasRenderingContext2D, color: string, x: number, y: number, len: number, rot: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.moveTo(-3.2, 0);
  c.bezierCurveTo(-6.5, len * 0.35, -5.5, len, 0, len);
  c.bezierCurveTo(5.5, len, 6, len * 0.35, 3.2, 0);
  c.closePath();
  inked(c, color, 2.2);
  // dobra da orelha
  c.strokeStyle = 'rgba(255,255,255,0.25)';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-1, len * 0.25);
  c.quadraticCurveTo(-2.5, len * 0.6, -0.5, len * 0.85);
  c.stroke();
  c.restore();
}

function earAngle(mood: Mood, t: number): number {
  switch (mood) {
    case 'jump':
      return -1.3 + Math.sin(t * 16) * 0.15;
    case 'fall':
      return -2 + Math.sin(t * 24) * 0.25;
    case 'worried':
    case 'sob':
      return 0.25;
    case 'angry':
      return 0.55;
    case 'smug':
    case 'celebrate':
      return Math.sin(t * 10) * 0.18;
    case 'hurt':
      return 0.4;
    default:
      return Math.sin(t * 2.2) * 0.06;
  }
}

/** Cabeça redonda, focinho para fora com narigão, mancha e orelhas caídas. */
function drawDogHead(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, mood: Mood, t: number): void {
  const team = u.team;
  const swing = earAngle(mood, t);
  // orelha de lá, aparecendo atrás da cabeça
  floppyEar(c, team.dark, 6.5, -10, 15, -0.35 - swing * 0.8);

  const head = (): void => ellipse(c, 0, 0, 12.8, 11.8);
  head();
  c.fillStyle = team.color;
  c.fill();
  c.save();
  head();
  c.clip();
  c.fillStyle = team.dark;
  c.globalAlpha = 0.5;
  c.beginPath();
  c.rect(-20, -20, 40, 40);
  c.ellipse(-3, -4, 13.8, 12.8, 0, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.globalAlpha = 1;
  // mancha no alto da cabeça
  c.fillStyle = team.dark;
  ellipse(c, -6, -7, 6, 5, 0.3);
  c.fill();
  // bochecha clara
  c.fillStyle = CREAM;
  ellipse(c, 5, 8.5, 9, 5);
  c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(c, -6.5, -7, 2.6, 1.6, -0.6);
  c.fill();
  head();
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  c.stroke();

  // focinho saindo da cara
  ellipse(c, 12, 6.2, 6, 4.5, -0.1);
  inked(c, CREAM, 2.2);

  if (team.look.hat) drawHat(c, team, team.look.hat);
  drawFace(c, u, mood, o, t, 'dog');

  // narigão brilhante
  ellipse(c, 16.4, 3.6, 2.8, 2.1, -0.2);
  inked(c, '#2a1a12', 1.2);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  ellipse(c, 15.6, 2.9, 1, 0.6, -0.3);
  c.fill();

  // orelha de cá, caída por cima da lateral da cabeça
  floppyEar(c, team.dark, -3.5, -10, 17, 0.38 + swing);
  drawEyewear(c, team.look.eyes);
}

const DOG: CritterParts = {
  tail: dogTail,
  pattern: dogSpots,
  head: drawDogHead,
  tag: 'disc',
  headY: -20,
  headScale: 0.8,
};

/** Cachorro: orelha que voa no pulo, rabo que abana, língua de fora. */
export function drawDog(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, p: CritterPose): void {
  drawCritter(c, u, o, p, DOG);
}

/** Boca de cachorro embaixo do focinho; língua de fora quando está tranquilo ou feliz. */
export function drawDogMouth(c: CanvasRenderingContext2D, mood: Mood, t: number): void {
  const mx = 12;
  const my = 9.4;
  c.strokeStyle = INK;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const tongue = (open: boolean): void => {
    // ofegando: a língua sobe e desce
    const pant = Math.abs(Math.sin(t * 9)) * 1.3;
    c.fillStyle = PINK;
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(mx - 1.8, my + (open ? 1 : 0));
    c.lineTo(mx - 1.8, my + 3 + pant);
    c.quadraticCurveTo(mx, my + 5.4 + pant, mx + 1.8, my + 3 + pant);
    c.lineTo(mx + 1.8, my + (open ? 1 : 0));
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(mx, my + 1.2);
    c.lineTo(mx, my + 3 + pant);
    c.stroke();
  };
  const smile = (): void => {
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(mx + 3.6, 5.7);
    c.lineTo(mx + 3.6, my - 1);
    c.moveTo(mx - 1.4, my - 0.6);
    c.quadraticCurveTo(mx + 1.2, my + 1.2, mx + 3.6, my - 1);
    c.quadraticCurveTo(mx + 5.6, my + 0.4, mx + 6.6, my - 1.4);
    c.stroke();
  };
  switch (mood) {
    case 'celebrate':
    case 'jump':
      c.fillStyle = '#5a1620';
      c.lineWidth = 1.4;
      ellipse(c, mx + 1.6, my + 0.6, 3.4, 2.6);
      c.fill();
      c.stroke();
      tongue(true);
      break;
    case 'aim':
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(mx - 0.6, my - 0.2);
      c.quadraticCurveTo(mx + 2, my + 0.6, mx + 5, my - 0.6);
      c.stroke();
      break;
    case 'charge':
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(mx - 0.6, my);
      c.lineTo(mx + 5, my - 0.4);
      c.stroke();
      break;
    case 'angry': {
      // rosnando: lábio puxado e a fileira de dentes
      c.fillStyle = '#5a1620';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(mx - 1.6, my - 0.6);
      c.quadraticCurveTo(mx + 2.4, my - 2.2, mx + 6.4, my - 0.8);
      c.lineTo(mx + 5.6, my + 2);
      c.quadraticCurveTo(mx + 2.4, my + 3, mx - 0.8, my + 2);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ffffff';
      c.lineWidth = 0.8;
      c.beginPath();
      for (let k = 0; k < 4; k++) {
        const x = mx - 0.6 + k * 1.7;
        c.moveTo(x, my - 0.6);
        c.lineTo(x + 0.85, my + 0.9);
        c.lineTo(x + 1.7, my - 0.6);
      }
      c.fill();
      c.stroke();
      break;
    }
    case 'hurt':
    case 'fall':
      c.fillStyle = '#5a1620';
      c.lineWidth = 1.3;
      ellipse(c, mx + 1.8, my + 0.8, 1.9, mood === 'fall' ? 2.6 : 1.7);
      c.fill();
      c.stroke();
      break;
    case 'worried':
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(mx - 1, my + 0.6);
      c.quadraticCurveTo(mx + 0.6, my - 0.6, mx + 2, my + 0.6);
      c.quadraticCurveTo(mx + 3.4, my + 1.8, mx + 5, my + 0.6);
      c.stroke();
      break;
    case 'sob':
      wailMouth(c, mx + 1.8, my - 0.4, t);
      break;
    default:
      // tranquilo ou convencido: sorriso e língua para fora
      smile();
      tongue(false);
  }
}
