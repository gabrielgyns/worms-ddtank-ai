import type { Team, Unit } from '../domain/unit';
import { drawEyewear, drawHat } from './cosmetics';
import { CREAM, drawCritter, ellipse, inked, PINK, type CritterParts, type CritterPose } from './critter';
import { drawFace, wailMouth, type Mood, type UnitDrawOpts } from './hero';
import { INK } from './sprites';

const MUZZLE = CREAM;

/** Listras de gato malhado nas costas. */
function catStripes(c: CanvasRenderingContext2D, team: Team): void {
  c.strokeStyle = team.dark;
  c.lineCap = 'round';
  c.lineWidth = 1.8;
  c.beginPath();
  for (const [y, len] of [
    [-12.5, 4],
    [-9, 5],
    [-5.5, 4],
  ] as const) {
    c.moveTo(-10, y);
    c.quadraticCurveTo(-10 + len * 0.6, y - 0.6, -10 + len, y + 1.2);
  }
  c.stroke();
}

const CAT: CritterParts = {
  tail: (c, team, mood, t) => drawTail(c, team, mood, t),
  pattern: catStripes,
  head: (c, u, o, mood, t) => drawCatHead(c, u, o, mood, t),
  tag: 'bell',
  headY: -20.5,
  headScale: 0.8,
};

/**
 * Gatinho de verdade (cabeção, corpinho, quatro patas, rabo comprido).
 * O rabo e as orelhas também "falam": eriçam no susto, murcham com medo,
 * ficam em pé na comemoração.
 */
export function drawCat(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, p: CritterPose): void {
  drawCritter(c, u, o, p, CAT);
}

/** Cabeçona com bochechas de pelo, orelhas que mostram o humor, focinho e bigodes. */
function drawCatHead(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, mood: Mood, t: number): void {
  const team = u.team;
  // orelhas: em pé mirando, murchas com medo, tremendo no susto
  const flat = mood === 'hurt' || mood === 'worried' || mood === 'sob' ? 0.75 : mood === 'angry' ? 0.95 : mood === 'fall' ? 0.35 + Math.sin(t * 30) * 0.08 : 0;
  const perk = mood === 'aim' || mood === 'charge' || mood === 'smug' ? -0.12 : 0;
  const twitch = (t + u.seed) % 4.3 < 0.12 ? 0.25 : 0;
  drawEar(c, team, -6.5, -10.5, -flat - perk, -11, -21, true);
  drawEar(c, team, 6, -11, flat + perk + twitch, 10.5, -21.5, false);

  const head = (): void => {
    c.beginPath();
    c.moveTo(-13, 0);
    c.bezierCurveTo(-13, -10, -6, -12.5, 0, -12.5);
    c.bezierCurveTo(7, -12.5, 13.5, -9, 13.5, -1);
    // bochecha fofa com pontinhas de pelo
    c.quadraticCurveTo(14, 4, 16, 6.2);
    c.lineTo(12.6, 6.8);
    c.quadraticCurveTo(13.6, 8.6, 14.2, 9.8);
    c.quadraticCurveTo(7, 11.8, 1, 11.2);
    c.quadraticCurveTo(-6, 11.6, -11.6, 9.8);
    c.lineTo(-10.6, 8.2);
    c.quadraticCurveTo(-13.4, 7.6, -15.2, 6.4);
    c.quadraticCurveTo(-12.8, 4.6, -13, 0);
    c.closePath();
  };
  head();
  c.fillStyle = team.color;
  c.fill();
  c.save();
  head();
  c.clip();
  // sombra em meia-lua (luz de cima-esquerda)
  c.fillStyle = team.dark;
  c.globalAlpha = 0.5;
  c.beginPath();
  c.rect(-20, -20, 40, 40);
  c.ellipse(-3, -4, 14, 13.4, 0, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.globalAlpha = 1;
  // listras de malhado na testa (o "M" do gato)
  c.strokeStyle = team.dark;
  c.lineCap = 'round';
  c.lineWidth = 1.9;
  c.beginPath();
  c.moveTo(3.5, -12.5);
  c.lineTo(4.4, -8.6);
  c.moveTo(0.4, -12.5);
  c.lineTo(0.6, -9.2);
  c.moveTo(6.8, -12);
  c.lineTo(7.6, -9);
  c.moveTo(-12.5, -2);
  c.lineTo(-8.5, -1.2);
  c.moveTo(-12.6, 1.6);
  c.lineTo(-9.2, 2);
  c.stroke();
  // focinho claro
  c.fillStyle = MUZZLE;
  ellipse(c, 7.4, 7.6, 6.4, 4);
  c.fill();
  ellipse(c, 13, 4.5, 2.8, 3.4);
  c.fill();
  c.restore();
  // brilho
  c.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(c, -6, -7, 3, 1.8, -0.6);
  c.fill();
  head();
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  c.lineJoin = 'round';
  c.stroke();

  if (team.look.hat) drawHat(c, team, team.look.hat);
  drawFace(c, u, mood, o, t, 'cat');

  // narizinho de coração
  c.fillStyle = PINK;
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(7.2, 6.8);
  c.quadraticCurveTo(5.4, 4.6, 6.6, 4.4);
  c.quadraticCurveTo(7.2, 4.3, 7.6, 4.9);
  c.quadraticCurveTo(8, 4.3, 8.8, 4.5);
  c.quadraticCurveTo(9.6, 4.8, 7.2, 6.8);
  c.closePath();
  c.fill();
  c.stroke();

  // bigodes (balançam de leve)
  const w = Math.sin(t * 3 + u.seed) * 0.6;
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(12, 7.4);
  c.quadraticCurveTo(16, 5.8, 19.5, 5 + w);
  c.moveTo(12.2, 8.6);
  c.quadraticCurveTo(16, 8.4, 19.6, 9 + w);
  c.moveTo(2, 8);
  c.quadraticCurveTo(-1.5, 7, -4.5, 6.6 - w);
  c.moveTo(2, 9.2);
  c.quadraticCurveTo(-1.5, 9.4, -4.4, 10.2 - w);
  c.stroke();

  drawEyewear(c, team.look.eyes);
}

/** Orelha triangular com ponta arredondada, miolo rosa e tufinho; gira na base conforme o humor. */
function drawEar(c: CanvasRenderingContext2D, team: Team, bx: number, by: number, rot: number, tx: number, ty: number, back: boolean): void {
  c.save();
  c.translate(bx, by);
  c.rotate(rot);
  const ax = tx - bx;
  const ay = ty - by;
  c.beginPath();
  c.moveTo(-6, 3);
  c.quadraticCurveTo(ax * 0.7 - 1.5, ay * 0.7, ax, ay);
  c.quadraticCurveTo(ax * 0.7 + 3, ay * 0.6, 6, 2.5);
  c.closePath();
  inked(c, back ? team.dark : team.color, 2.2);
  c.fillStyle = PINK;
  c.beginPath();
  c.moveTo(-3, 2);
  c.quadraticCurveTo(ax * 0.62 - 0.5, ay * 0.62, ax * 0.82, ay * 0.82);
  c.quadraticCurveTo(ax * 0.62 + 2, ay * 0.55, 3.2, 1.6);
  c.closePath();
  c.fill();
  // tufinho de pelo saindo
  c.strokeStyle = MUZZLE;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, 1.5);
  c.lineTo(ax * 0.3 - 1, ay * 0.42);
  c.moveTo(1, 1.5);
  c.lineTo(ax * 0.3 + 1, ay * 0.36);
  c.stroke();
  c.restore();
}

/** Rabo comprido listrado: o humor do gato em uma linha. */
function drawTail(c: CanvasRenderingContext2D, team: Team, mood: Mood, t: number): void {
  let pts: [number, number, number, number, number, number];
  let width = 4.6;
  switch (mood) {
    case 'celebrate': {
      const s = Math.sin(t * 10) * 4;
      pts = [-12, -6, -11 + s, -22, -7 + s, -32];
      break;
    }
    case 'smug': {
      // rabo em pé, balançando devagar: todo orgulhoso
      const s = Math.sin(t * 3) * 3;
      pts = [-14, -6, -12 + s, -24, -9 + s, -31];
      break;
    }
    case 'hurt':
    case 'fall':
    case 'angry':
      // eriçado
      pts = [-17, -6, -19, -18, -15 + Math.sin(t * 30), -27];
      width = 8;
      break;
    case 'worried':
    case 'sob':
      pts = [-15, 0, -22, -1, -21, -8];
      break;
    case 'aim':
    case 'charge': {
      const s = Math.sin(t * 9) * 2;
      pts = [-18, -4, -14, -22, -20 + s, -26 + s * 0.5];
      break;
    }
    default: {
      const s = Math.sin(t * 2.4) * 3;
      pts = [-19, -4, -14, -22, -20 + s, -27];
    }
  }
  const path = (): void => {
    c.beginPath();
    c.moveTo(-7, -5);
    c.bezierCurveTo(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
  };
  c.lineCap = 'round';
  c.lineJoin = 'round';
  path();
  c.strokeStyle = INK;
  c.lineWidth = width + 3.2;
  c.stroke();
  c.strokeStyle = team.color;
  c.lineWidth = width;
  c.stroke();
  c.strokeStyle = team.dark;
  c.setLineDash([2.4, 3.4]);
  c.stroke();
  c.setLineDash([]);
  // pontinha clara
  c.fillStyle = MUZZLE;
  ellipse(c, pts[4], pts[5], width * 0.55, width * 0.55);
  c.fill();
  if (mood === 'hurt' || mood === 'fall' || mood === 'angry') {
    // pelos arrepiados
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + t * 3;
      c.moveTo(pts[4] + Math.cos(a) * 3, pts[5] + Math.sin(a) * 3);
      c.lineTo(pts[4] + Math.cos(a) * 6.5, pts[5] + Math.sin(a) * 6.5);
    }
    c.stroke();
  }
}

/** Boca de gato "ω" com presinha, variando com o humor. */
export function drawCatMouth(c: CanvasRenderingContext2D, mood: Mood): void {
  const mx = 7.2;
  const my = 8.2;
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  c.lineCap = 'round';
  const omega = (): void => {
    c.beginPath();
    c.moveTo(mx, 6.8);
    c.lineTo(mx, my - 0.6);
    c.arc(mx - 1.5, my - 0.6, 1.5, 0, Math.PI);
    c.moveTo(mx + 3, my - 0.6);
    c.arc(mx + 1.5, my - 0.6, 1.5, 0, Math.PI);
    c.stroke();
  };
  const fang = (x: number): void => {
    c.fillStyle = '#ffffff';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(x - 0.8, my + 0.6);
    c.lineTo(x, my + 2.4);
    c.lineTo(x + 0.8, my + 0.6);
    c.closePath();
    c.fill();
    c.stroke();
  };
  switch (mood) {
    case 'celebrate':
    case 'jump': {
      const big = mood === 'celebrate' ? 1.3 : 1;
      c.fillStyle = '#5a1620';
      c.beginPath();
      c.moveTo(mx - 3 * big, my - 0.4);
      c.quadraticCurveTo(mx, my + 5.5 * big, mx + 3 * big, my - 0.4);
      c.quadraticCurveTo(mx + 1.5, my + 0.6, mx, my - 0.6);
      c.quadraticCurveTo(mx - 1.5, my + 0.6, mx - 3 * big, my - 0.4);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ff7a8a';
      ellipse(c, mx, my + 2.6 * big, 1.5 * big, 1 * big);
      c.fill();
      fang(mx - 1.6);
      break;
    }
    case 'fall':
      c.fillStyle = '#5a1620';
      ellipse(c, mx, my + 1, 2, 2.6);
      c.fill();
      c.stroke();
      break;
    case 'hurt':
      // chiado: boca em zigue-zague com presas
      c.fillStyle = '#5a1620';
      c.beginPath();
      c.moveTo(mx - 3.4, my);
      c.lineTo(mx + 3.4, my);
      c.lineTo(mx + 2.4, my + 3);
      c.lineTo(mx - 2.4, my + 3);
      c.closePath();
      c.fill();
      c.stroke();
      fang(mx - 2);
      fang(mx + 2);
      break;
    case 'smug':
      omega();
      fang(mx + 1.6);
      break;
    case 'angry':
      // chiado de gato bravo: boca aberta com as duas presas
      c.fillStyle = '#5a1620';
      c.beginPath();
      c.moveTo(mx - 3, my);
      c.lineTo(mx + 3, my);
      c.lineTo(mx + 1.6, my + 2.6);
      c.lineTo(mx - 1.6, my + 2.6);
      c.closePath();
      c.fill();
      c.stroke();
      fang(mx - 1.7);
      fang(mx + 1.7);
      break;
    case 'sob':
      wailMouth(c, mx, my, 0);
      break;
    case 'worried':
      c.beginPath();
      c.moveTo(mx - 3, my + 1);
      c.quadraticCurveTo(mx - 1.5, my - 0.4, mx, my + 1);
      c.quadraticCurveTo(mx + 1.5, my + 2.4, mx + 3, my + 1);
      c.stroke();
      break;
    case 'charge':
      omega();
      fang(mx + 1.6);
      break;
    default:
      omega();
      if (mood === 'aim') fang(mx + 1.6);
  }
}
