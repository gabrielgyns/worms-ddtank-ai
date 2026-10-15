import type { Team, Unit } from '../domain/unit';
import type { CatPose } from './cat';
import { drawEyewear, drawHat } from './cosmetics';
import { drawFace, drawHand, wailMouth, type Mood, type UnitDrawOpts } from './hero';
import { drawHeldWeapon, INK } from './sprites';

const HEAD_Y = -19.5;
const HEAD_S = 0.82;
const CREAM = '#fff6ec';
const PINK = '#ffb3c4';
const PINK_DARK = '#f27f9b';

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

/** Quanto as bochechas estão estufadas: carregar o tiro é "encher a bochecha". */
function puffOf(mood: Mood, t: number): number {
  switch (mood) {
    case 'charge':
      return 1.45 + Math.sin(t * 30) * 0.04;
    case 'aim':
      return 1.15;
    case 'celebrate':
      return 1.2 + Math.sin(t * 8) * 0.08;
    case 'smug':
      return 1.25;
    case 'angry':
      // bochechas infladas de raiva
      return 1.35 + Math.sin(t * 18) * 0.03;
    case 'hurt':
    case 'sob':
      return 0.85;
    default:
      return 1 + Math.sin(t * 2) * 0.03;
  }
}

/**
 * Hamster de verdade: bolinha de pelo sentada nas patas de trás, cabeça
 * colada no corpo, bochechas que enchem (cheias quando carrega o tiro),
 * dentões, patinhas rosas e um rabicho. Pés em (0, 0), olhando para +x.
 */
export function drawHamster(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, p: CatPose): void {
  const team = u.team;
  const { mood, t } = p;
  const armed = !!o.holding && mood !== 'fall';
  const twoHands = o.holding === 'bazooka' || o.holding === 'triple' || o.holding === 'cluster' || o.holding === 'homing';
  const pawsUp = mood === 'fall' || mood === 'celebrate';
  const step = mood === 'walk' ? p.walk * 2.6 : 0;
  const tuck = mood === 'jump' ? -1.5 : 0;

  c.save();
  // o hamster é mais "mole": achata e estica um pouco mais que os outros
  c.translate(0, p.hop);
  c.scale(1 + (p.sx - 1) * 1.3, 1 + (p.sy - 1) * 1.3);

  // pé de lá
  foot(c, PINK_DARK, -4 + step, tuck);

  const weaponPose = (): void => {
    c.translate(3, -9);
    if (o.holding !== 'dynamite' && o.holding !== 'airstrike' && o.holding !== 'teleport') c.rotate(-u.aim);
    if (mood === 'charge') c.translate(-1.2 + Math.sin(t * 40) * 0.35, 0);
  };
  if (armed) {
    c.save();
    weaponPose();
    drawHeldWeapon(c, o.holding!);
    if (twoHands) drawHand(c, PINK_DARK, 14, 2.8);
    c.restore();
  }

  // rabicho
  ellipse(c, -11.2, -4, 2.6, 2);
  inked(c, PINK, 1.6);

  drawHamsterBody(c, team);

  // pé de cá, grandão e rosa
  foot(c, PINK, 3.5 - step, tuck);

  // cabeça
  c.save();
  const tilt =
    mood === 'celebrate' ? Math.sin(t * 9) * 0.16 : mood === 'worried' ? 0.12 : mood === 'aim' || mood === 'charge' ? -u.aim * 0.08 : Math.sin(t * 1.5 + u.seed) * 0.035;
  c.translate(1, HEAD_Y);
  c.rotate(tilt);
  c.scale(HEAD_S, HEAD_S);
  drawHamsterHead(c, u, o, mood, t);
  c.restore();

  // patinhas da frente
  if (armed) {
    c.save();
    weaponPose();
    drawHand(c, PINK, 2, 3.5);
    c.restore();
  } else if (pawsUp) {
    const wave = Math.sin(t * 12) * 2;
    drawHand(c, PINK, 10, -16 + wave);
    drawHand(c, PINK_DARK, -5, -17 - wave);
  } else {
    // juntinhas no peito, como quem segura uma semente
    const nib = mood === 'idle' && (t + u.seed) % 5 < 1.2 ? Math.sin(t * 25) * 0.6 : 0;
    drawHand(c, PINK_DARK, 6, -6.5 + nib);
    drawHand(c, PINK, 9, -6 - nib);
  }
  c.restore();
}

/** Corpo gorducho em gota, barriga creme e tufos de pelo nas costas. */
function drawHamsterBody(c: CanvasRenderingContext2D, team: Team): void {
  const body = (): void => {
    c.beginPath();
    c.moveTo(0, -17);
    c.bezierCurveTo(8, -17, 12, -9, 11.5, -4);
    c.bezierCurveTo(11, -0.8, 6, -0.5, 0, -0.5);
    c.bezierCurveTo(-7, -0.5, -12, -1, -12, -6);
    // tufinhos de pelo nas costas
    c.lineTo(-13.2, -7.5);
    c.lineTo(-11.6, -8.6);
    c.lineTo(-12.4, -10.4);
    c.lineTo(-10.6, -11.2);
    c.bezierCurveTo(-9, -15.5, -5, -17, 0, -17);
    c.closePath();
  };
  body();
  c.fillStyle = team.color;
  c.fill();
  c.save();
  body();
  c.clip();
  c.fillStyle = CREAM;
  ellipse(c, 4.5, -6, 6.5, 7.5, 0.1);
  c.fill();
  c.fillStyle = team.dark;
  c.globalAlpha = 0.4;
  ellipse(c, -3, 1.5, 12, 4.5);
  c.fill();
  c.globalAlpha = 1;
  c.restore();
  body();
  c.strokeStyle = INK;
  c.lineWidth = 2.3;
  c.lineJoin = 'round';
  c.stroke();
}

/** Cabeça redonda com bochechas que estufam, faixa clara na testa, orelhinhas e dentões. */
function drawHamsterHead(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts, mood: Mood, t: number): void {
  const team = u.team;
  const puff = puffOf(mood, t);
  // orelhinhas redondas: caem para trás com medo, tremem no susto
  const back = mood === 'hurt' || mood === 'worried' || mood === 'sob' || mood === 'angry' ? 0.7 : mood === 'fall' ? 0.3 + Math.sin(t * 30) * 0.1 : 0;
  const twitch = (t + u.seed) % 3.9 < 0.1 ? 0.3 : 0;
  ear(c, team, -6, -10.5, -back, true);
  ear(c, team, 5.5, -11.5, back * 0.6 + twitch, false);

  // bochecha de trás (aparece atrás da cabeça)
  ellipse(c, -10.5, 5, 5 * puff, 4.6 * puff);
  inked(c, CREAM, 2.2);

  const head = (): void => {
    ellipse(c, 0, 0, 12.6, 11.6);
  };
  head();
  c.fillStyle = team.color;
  c.fill();
  c.save();
  head();
  c.clip();
  // sombra (luz de cima-esquerda)
  c.fillStyle = team.dark;
  c.globalAlpha = 0.45;
  c.beginPath();
  c.rect(-20, -20, 40, 40);
  c.ellipse(-3, -4, 13.5, 12.6, 0, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.globalAlpha = 1;
  // máscara creme embaixo e faixa clara entre os olhos
  c.fillStyle = CREAM;
  ellipse(c, 7, 8.5, 10, 5.6);
  c.fill();
  c.beginPath();
  c.moveTo(5.4, -13);
  c.quadraticCurveTo(6.8, -4, 6.4, 3);
  c.quadraticCurveTo(7.2, -4, 8.6, -13);
  c.closePath();
  c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(c, -5.8, -6.5, 3, 1.8, -0.6);
  c.fill();
  head();
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  c.stroke();

  // topete
  c.fillStyle = team.color;
  c.strokeStyle = INK;
  c.lineWidth = 1.8;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-3, -11);
  c.quadraticCurveTo(-1.5, -16, 1, -14.5);
  c.quadraticCurveTo(1.8, -17.5, 4.5, -15);
  c.quadraticCurveTo(4, -12.5, 3, -11.4);
  c.fill();
  c.stroke();

  // bochecha da frente (embaixo do olho): o charme do hamster
  ellipse(c, 2.5, 6.8, 6 * puff, 5 * puff);
  inked(c, CREAM, 2.2);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  ellipse(c, 0.5, 4.6 + puff, 1.8 * puff, 1.1 * puff, -0.4);
  c.fill();
  // focinho
  ellipse(c, 12.2, 6, 4.4, 3.6);
  c.fillStyle = CREAM;
  c.fill();

  if (team.look.hat) drawHat(c, team, team.look.hat);
  drawFace(c, u, mood, o, t, 'hamster');

  // nariz que fareja
  const sniff = mood === 'idle' || mood === 'walk' ? Math.max(0, Math.sin(t * 22)) * 0.5 * (Math.sin(t * 1.7 + u.seed) > 0.3 ? 1 : 0) : 0;
  ellipse(c, 14.6, 3.8 - sniff, 1.7, 1.25);
  inked(c, PINK_DARK, 1.2);

  // bigodinhos
  c.strokeStyle = INK;
  c.lineWidth = 0.85;
  c.beginPath();
  c.moveTo(15.2, 5.2);
  c.lineTo(20, 3.8 - sniff);
  c.moveTo(15.2, 6);
  c.lineTo(20.2, 6.6 + sniff);
  c.stroke();

  drawEyewear(c, team.look.eyes);
}

function ear(c: CanvasRenderingContext2D, team: Team, x: number, y: number, rot: number, far: boolean): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  ellipse(c, 0, -2.6, 4.2, 4);
  inked(c, far ? team.dark : team.color, 2);
  c.fillStyle = PINK;
  ellipse(c, 0.2, -2.4, 2.4, 2.3);
  c.fill();
  c.restore();
}

function foot(c: CanvasRenderingContext2D, color: string, x: number, tuck: number): void {
  const y = -1.4 + tuck;
  ellipse(c, x + 1, y, 4.6, 2.3);
  inked(c, color, 1.9);
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  for (const dx of [2.4, 3.8, 5]) {
    c.moveTo(x + dx, y - 0.8);
    c.lineTo(x + dx + 0.3, y + 1.2);
  }
  c.stroke();
}

/** Boca de hamster: "y" com dois dentões; abre, chia ou treme com o humor. */
export function drawHamsterMouth(c: CanvasRenderingContext2D, mood: Mood): void {
  const mx = 12.8;
  const my = 7.4;
  c.strokeStyle = INK;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const teeth = (y: number, h: number): void => {
    c.fillStyle = '#ffffff';
    c.lineWidth = 1;
    c.beginPath();
    c.rect(mx - 1.9, y, 1.9, h);
    c.rect(mx, y, 1.9, h);
    c.fill();
    c.stroke();
  };
  switch (mood) {
    case 'celebrate':
    case 'jump':
    case 'fall': {
      const big = mood === 'celebrate' ? 1.25 : 1;
      c.fillStyle = '#5a1620';
      c.lineWidth = 1.4;
      ellipse(c, mx - 0.2, my + 2.2 * big, 2.6 * big, (mood === 'fall' ? 3 : 2.4) * big);
      c.fill();
      c.stroke();
      if (mood !== 'fall') {
        c.fillStyle = '#ff7a8a';
        ellipse(c, mx - 0.2, my + 3.4 * big, 1.5 * big, 0.9 * big);
        c.fill();
      }
      teeth(my - 0.2, 2);
      break;
    }
    case 'hurt':
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(mx - 3.4, my + 0.4);
      c.lineTo(mx + 2.6, my + 0.4);
      c.stroke();
      teeth(my + 0.4, 2.2);
      break;
    case 'smug':
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(mx - 2.8, my - 0.2);
      c.quadraticCurveTo(mx, my + 1.4, mx + 2.8, my - 1.4);
      c.stroke();
      teeth(my + 0.3, 2);
      break;
    case 'angry':
      // dentões cerrados com a boca torta
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(mx - 3.4, my + 1.2);
      c.quadraticCurveTo(mx, my - 0.8, mx + 3, my + 1.2);
      c.stroke();
      teeth(my - 0.2, 1.6);
      break;
    case 'sob':
      wailMouth(c, mx - 0.4, my, 0);
      teeth(my - 0.6, 1.6);
      break;
    case 'worried':
      teeth(my, 2.2);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(mx - 3.6, my + 1.6);
      c.quadraticCurveTo(mx - 2.6, my + 0.6, mx - 1.9, my + 1);
      c.stroke();
      break;
    default: {
      // "y" de focinho + dentões
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(mx + 1.6, 5);
      c.lineTo(mx, my);
      c.moveTo(mx - 2.6, my - 0.3);
      c.quadraticCurveTo(mx - 1.3, my + 0.8, mx, my);
      c.quadraticCurveTo(mx + 1.3, my + 0.8, mx + 2.4, my - 0.3);
      c.stroke();
      teeth(my, mood === 'charge' ? 1.6 : 2.4);
    }
  }
}
