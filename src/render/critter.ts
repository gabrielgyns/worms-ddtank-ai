import type { Team, Unit } from '../domain/unit';
import { drawHand, type Mood, type UnitDrawOpts } from './hero';
import { drawHeldWeapon, INK } from './sprites';

/** Pose já calculada pelo drawUnit (humor, achatar/esticar, passo). */
export interface CritterPose {
  mood: Mood;
  sx: number;
  sy: number;
  hop: number;
  walk: number;
  t: number;
  air: boolean;
}

/** O que muda de um bicho para outro; o resto (corpo sentado, patas, coleira, arma) é igual. */
export interface CritterParts {
  /** rabo, desenhado atrás de tudo */
  tail(c: CanvasRenderingContext2D, team: Team, mood: Mood, t: number): void;
  /** pelagem do corpo (listras, manchas), já recortada no corpo */
  pattern(c: CanvasRenderingContext2D, team: Team): void;
  /** cabeça no espaço da bolota (mesmas coordenadas do rosto), já encolhida */
  head(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, mood: Mood, t: number): void;
  /** pingente da coleira */
  tag: 'bell' | 'disc';
  headY: number;
  headScale: number;
}

export const CREAM = '#fff6ec';
export const PINK = '#ff8fab';
const COLLAR = '#e8434b';
const GOLD = '#ffd23f';

export function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function inked(c: CanvasRenderingContext2D, fill: string, width = 2): void {
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.stroke();
}

/**
 * Bichinho sentado (cabeção de chibi, corpinho, quatro patas, rabo), no espaço local
 * com os pés em (0, 0) olhando para +x. Cada bicho entra com cabeça, rabo e pelagem.
 */
export function drawCritter(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, p: CritterPose, parts: CritterParts): void {
  const team = u.team;
  const { mood, t } = p;
  const armed = !!o.holding && mood !== 'fall';
  const twoHands = o.holding === 'bazooka' || o.holding === 'triple' || o.holding === 'cluster' || o.holding === 'homing';
  const pawsUp = mood === 'fall' || mood === 'celebrate';
  const walking = mood === 'walk';
  const step = walking ? p.walk * 3 : 0;
  const tuck = mood === 'jump' ? -1.5 : 0;
  // patas em pares diagonais: enquanto um par pisa, o outro sobe
  const liftA = walking ? Math.max(0, p.walk) * 2.2 : 0;
  const liftB = walking ? Math.max(0, -p.walk) * 2.2 : 0;
  // andando, as patas da frente aparecem mesmo segurando a arma (a pata da arma continua nela)
  const frontLegs = (!armed || walking) && !pawsUp;

  c.save();
  c.translate(0, p.hop);
  // gingado de bichinho andando: o corpo balança de um lado para o outro
  if (walking) c.rotate(p.walk * 0.05);
  // achata/estica a partir do chão
  c.scale(p.sx, p.sy);

  parts.tail(c, team, mood, t + u.seed * 0.1);

  // patas do lado de lá (mais escuras, atrás do corpo)
  c.save();
  leg(c, team.dark, 4.5 - step * 0.8, tuck - liftB, frontLegs);
  paw(c, team.dark, -7.5 + step, -1.4 + tuck - liftA, 3.8, 2.4);
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

  drawBody(c, team, parts);

  // coxa e pé de trás (lado de cá)
  ellipse(c, -5.2, -5.6, 5.4, 5);
  inked(c, team.color);
  c.strokeStyle = team.dark;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(-5.2, -5.6, 3, Math.PI * 0.9, Math.PI * 1.6);
  c.stroke();
  paw(c, team.color, -3.5 - step, -1.3 + tuck - liftB, 4.4, 2.5);

  // pata da frente no chão (quando não segura nada nem está com as mãos pro alto)
  if (frontLegs) leg(c, team.color, 4 + step * 0.8, tuck - liftA, true);

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
  c.translate(0.8, parts.headY);
  c.rotate(tilt);
  c.scale(parts.headScale, parts.headScale);
  parts.head(c, u, o, mood, t);
  c.restore();

  // pingente por cima do queixo
  const jingle = mood === 'walk' || mood === 'celebrate' ? Math.sin(t * 14) * 0.4 : 0;
  c.save();
  c.translate(4.6, -11.2);
  c.rotate(jingle);
  ellipse(c, 0, 1.6, 2.3, 2.3);
  inked(c, GOLD, 1.4);
  c.strokeStyle = INK;
  c.lineWidth = 0.9;
  c.beginPath();
  if (parts.tag === 'bell') {
    c.moveTo(-2.2, 1.4);
    c.lineTo(2.2, 1.4);
    c.moveTo(0, 2.3);
    c.lineTo(0, 3.6);
  } else {
    // plaquinha com um ossinho gravado
    c.moveTo(-1.1, 1.6);
    c.lineTo(1.1, 1.6);
  }
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

/** Corpinho em pera com barriga clara, a pelagem do bicho e sombreado. */
function drawBody(c: CanvasRenderingContext2D, team: Team, parts: CritterParts): void {
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
  c.fillStyle = CREAM;
  ellipse(c, 4.2, -6.5, 4.2, 6.2, 0.15);
  c.fill();
  parts.pattern(c, team);
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
export function drawPaw(c: CanvasRenderingContext2D, color: string, x: number, y: number, beans: boolean): void {
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

