import type { Team, Unit } from '../domain/unit';
import { drawEyewear, drawHat } from './cosmetics';
import { drawFace, drawHand, type Mood, type UnitDrawOpts } from './hero';
import { drawHeldWeapon, INK } from './sprites';

/** Pose já calculada pelo drawUnit (humor, achatar/esticar, passo). */
export interface CatPose {
  mood: Mood;
  sx: number;
  sy: number;
  hop: number;
  walk: number;
  t: number;
  air: boolean;
}

/** Cabeça grande de chibi: desenhada nas mesmas coordenadas da bolota, encolhida. */
const HEAD_Y = -20.5;
const HEAD_S = 0.8;
const MUZZLE = '#fff6ec';
const PINK = '#ff8fab';
const COLLAR = '#e8434b';
const BELL = '#ffd23f';

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function inked(c: CanvasRenderingContext2D, fill: string, width = 2): void {
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.stroke();
}

/**
 * Gatinho de verdade (cabeção, corpinho, quatro patas, rabo comprido),
 * no espaço local com os pés em (0, 0) olhando para +x.
 * O rabo e as orelhas também "falam": eriçam no susto, murcham com medo,
 * ficam em pé na comemoração.
 */
export function drawCat(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, p: CatPose): void {
  const team = u.team;
  const { mood, t } = p;
  const armed = !!o.holding && mood !== 'fall';
  const twoHands = o.holding === 'bazooka' || o.holding === 'triple' || o.holding === 'cluster' || o.holding === 'homing';
  const pawsUp = mood === 'fall' || mood === 'celebrate';
  const step = mood === 'walk' ? p.walk * 3 : 0;
  const tuck = mood === 'jump' ? -1.5 : 0;

  c.save();
  c.translate(0, p.hop);
  // achata/estica a partir do chão
  c.scale(p.sx, p.sy);

  drawTail(c, team, mood, t + u.seed * 0.1);

  // patas do lado de lá (mais escuras, atrás do corpo)
  c.save();
  leg(c, team.dark, 4.5 - step * 0.8, tuck, !armed && !pawsUp);
  paw(c, team.dark, -7.5 + step, -1.4 + tuck, 3.8, 2.4);
  c.restore();

  const weaponPose = (): void => {
    c.translate(3, -8.5);
    if (o.holding !== 'dynamite' && o.holding !== 'airstrike' && o.holding !== 'teleport') c.rotate(-u.aim);
    if (mood === 'charge') c.translate(-1.2 + Math.sin(t * 40) * 0.35, 0);
  };
  if (armed) {
    c.save();
    weaponPose();
    drawHeldWeapon(c, o.holding!);
    if (twoHands) drawPaw(c, team.dark, 14, 2.8, false);
    c.restore();
  }

  drawCatBody(c, team);

  // coxa e pé de trás (lado de cá)
  ellipse(c, -5.2, -5.6, 5.4, 5);
  inked(c, team.color);
  c.strokeStyle = team.dark;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(-5.2, -5.6, 3, Math.PI * 0.9, Math.PI * 1.6);
  c.stroke();
  paw(c, team.color, -3.5 - step, -1.3 + tuck, 4.4, 2.5);

  // pata da frente no chão (quando não segura nada nem está com as mãos pro alto)
  if (!armed && !pawsUp) leg(c, team.color, 4 + step * 0.8, tuck, true);

  // coleira com sininho
  c.strokeStyle = INK;
  c.lineWidth = 4.6;
  c.beginPath();
  c.ellipse(0.5, -13.2, 7.2, 2.6, 0.08, Math.PI * 0.05, Math.PI * 0.95);
  c.stroke();
  c.strokeStyle = COLLAR;
  c.lineWidth = 2.4;
  c.stroke();

  // cabeça
  c.save();
  const tilt =
    mood === 'celebrate' ? Math.sin(t * 9) * 0.18 : mood === 'worried' ? 0.12 : mood === 'aim' || mood === 'charge' ? -u.aim * 0.1 : Math.sin(t * 1.3 + u.seed) * 0.03;
  c.translate(0.8, HEAD_Y);
  c.rotate(tilt);
  c.scale(HEAD_S, HEAD_S);
  drawCatHead(c, u, o, mood, t);
  c.restore();

  // sininho por cima do queixo
  const jingle = mood === 'walk' || mood === 'celebrate' ? Math.sin(t * 14) * 0.4 : 0;
  c.save();
  c.translate(4.6, -11.2);
  c.rotate(jingle);
  ellipse(c, 0, 1.6, 2.3, 2.3);
  inked(c, BELL, 1.4);
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(-2.2, 1.4);
  c.lineTo(2.2, 1.4);
  c.moveTo(0, 2.3);
  c.lineTo(0, 3.6);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  ellipse(c, -0.8, 0.6, 0.7, 0.5);
  c.fill();
  c.restore();

  // patinhas da frente: segurando a arma, pro alto ou nada
  if (armed) {
    c.save();
    weaponPose();
    drawPaw(c, team.color, 2, 3.5, false);
    c.restore();
  } else if (pawsUp) {
    const wave = Math.sin(t * 12) * 2;
    drawPaw(c, team.color, 10, -17 + wave, true);
    drawPaw(c, team.dark, -5, -18 - wave, true);
  }
  c.restore();
}

/** Corpinho em pera com barriga clara, listras de gato malhado e sombreado. */
function drawCatBody(c: CanvasRenderingContext2D, team: Team): void {
  const body = (): void => {
    c.beginPath();
    c.moveTo(-1, -16);
    c.bezierCurveTo(6.5, -16, 9.5, -8, 8.5, -3.5);
    c.bezierCurveTo(7.5, -0.5, 3, -0.6, -1, -0.8);
    c.bezierCurveTo(-7, -1, -10, -3, -9.5, -8);
    c.bezierCurveTo(-9, -13.5, -5.5, -16, -1, -16);
    c.closePath();
  };
  body();
  c.fillStyle = team.color;
  c.fill();
  c.save();
  body();
  c.clip();
  // barriga
  c.fillStyle = MUZZLE;
  ellipse(c, 4.2, -6.5, 4.2, 6.2, 0.15);
  c.fill();
  // listras nas costas
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
  // sombra de baixo
  c.fillStyle = team.dark;
  c.globalAlpha = 0.4;
  ellipse(c, -2, 1.5, 11, 4.5);
  c.fill();
  c.globalAlpha = 1;
  c.restore();
  body();
  c.strokeStyle = INK;
  c.lineWidth = 2.3;
  c.stroke();
}

/** Cabeçona com bochechas de pelo, orelhas que mostram o humor, focinho e bigodes. */
function drawCatHead(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, mood: Mood, t: number): void {
  const team = u.team;
  // orelhas: em pé mirando, murchas com medo, tremendo no susto
  const flat = mood === 'hurt' || mood === 'worried' ? 0.75 : mood === 'fall' ? 0.35 + Math.sin(t * 30) * 0.08 : 0;
  const perk = mood === 'aim' || mood === 'charge' ? -0.12 : 0;
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
    case 'hurt':
    case 'fall':
      // eriçado
      pts = [-17, -6, -19, -18, -15 + Math.sin(t * 30), -27];
      width = 8;
      break;
    case 'worried':
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
  if (mood === 'hurt' || mood === 'fall') {
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

/** Perninha da frente: coluna do corpo até o chão com a patinha no fim. */
function leg(c: CanvasRenderingContext2D, color: string, x: number, tuck: number, withPaw: boolean): void {
  if (!withPaw) return;
  c.beginPath();
  c.moveTo(x - 2.4, -8);
  c.lineTo(x - 2.2, -2 + tuck);
  c.lineTo(x + 2.4, -2 + tuck);
  c.lineTo(x + 2.4, -8);
  c.closePath();
  inked(c, color, 2);
  paw(c, color, x + 0.8, -1.4 + tuck, 3.6, 2.4);
}

/** Patinha no chão, com os dedinhos marcados. */
function paw(c: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number): void {
  ellipse(c, x, y, rx, ry);
  inked(c, color, 1.9);
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(x + rx * 0.35, y - ry * 0.2);
  c.lineTo(x + rx * 0.35, y + ry * 0.7);
  c.moveTo(x + rx * 0.75, y - ry * 0.1);
  c.lineTo(x + rx * 0.75, y + ry * 0.6);
  c.stroke();
}

/** Patinha "mão" (segura a arma ou acena), com almofadinhas rosas quando aparece a palma. */
function drawPaw(c: CanvasRenderingContext2D, color: string, x: number, y: number, beans: boolean): void {
  drawHand(c, color, x, y);
  if (!beans) return;
  c.fillStyle = PINK;
  ellipse(c, x, y + 0.8, 1.5, 1.2);
  c.fill();
  for (const [dx, dy] of [
    [-1.8, -1.2],
    [0, -1.9],
    [1.8, -1.2],
  ] as const) {
    ellipse(c, x + dx, y + dy, 0.75, 0.75);
    c.fill();
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
