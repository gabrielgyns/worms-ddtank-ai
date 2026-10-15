import type { Unit } from '../domain/unit';
import type { WeaponId } from '../domain/weapons';
import { danceTransform, drawBody, drawEyewear, drawHat, drawSpeciesBack, drawSpeciesFace } from './cosmetics';
import { drawCat, drawCatMouth } from './cat';
import { drawHamster, drawHamsterMouth } from './hamster';
import { drawHeldWeapon, INK } from './sprites';

export interface UnitDrawOpts {
  active: boolean;
  holding: WeaponId | null;
  hurt: number;
  time: number;
  /** comemorando a vitória (fim de partida) */
  celebrate?: boolean;
  /** carregando a força do tiro agora */
  charging?: boolean;
}

/** O que a bolota está "sentindo" — escolhe olhos, boca, braços e pose. */
export type Mood = 'idle' | 'walk' | 'aim' | 'charge' | 'jump' | 'fall' | 'hurt' | 'worried' | 'celebrate';

/** Memória de animação por bolota (aterrissagem, para achatar e esticar). Só visual. */
const anim = new WeakMap<Unit, { wasGround: boolean; land: number; lastT: number }>();

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

const RX = 12;
const RY = 12.6;
/** centro do corpo em relação aos pés */
const BODY_Y = -14;
const DRAW_SCALE = 1.15;

/**
 * A bolota em estilo desenho animado: sombreado em tons (sombra em meia-lua,
 * luz de borda, brilho), olhos de anime, expressões por situação, mãos, pés
 * e achatar/esticar no pulo. Desenhada no espaço do mundo, pés em (u.x, u.y).
 */
export function drawUnit(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts): void {
  const t = o.time;
  const team = u.team;
  const air = !u.onGround;

  // achatar ao aterrissar
  let a = anim.get(u);
  if (!a) {
    a = { wasGround: u.onGround, land: 0, lastT: t };
    anim.set(u, a);
  }
  const dt = Math.max(0, Math.min(0.1, t - a.lastT));
  a.lastT = t;
  if (u.onGround && !a.wasGround) a.land = 1;
  a.wasGround = u.onGround;
  a.land = Math.max(0, a.land - dt * 5);

  const mood: Mood = o.celebrate
    ? 'celebrate'
    : o.hurt > 0.5
      ? 'hurt'
      : air && u.vy > 260
        ? 'fall'
        : air
          ? 'jump'
          : o.charging
            ? 'charge'
            : o.active && o.holding
              ? 'aim'
              : Math.abs(Math.sin(u.walkPhase)) > 0.05 && o.active
                ? 'walk'
                : u.hp < 35
                  ? 'worried'
                  : 'idle';

  // esticar no ar (pela velocidade), achatar na aterrissagem, respirar parada
  const breathe = !air ? Math.sin(t * 3 + u.seed) * 0.025 : 0;
  const stretch = air ? Math.max(-0.12, Math.min(0.16, -u.vy / 2600)) : 0;
  const squash = a.land * 0.22;
  const sy = 1 + breathe + stretch - squash;
  const sx = 1 - breathe * 0.6 - stretch * 0.6 + squash * 0.9;
  const walk = Math.sin(u.walkPhase);
  const hop = mood === 'walk' ? -Math.abs(walk) * 2.2 : 0;

  c.save();
  c.translate(u.x, u.y);
  if (o.celebrate) {
    const d = danceTransform(team.look.dance, t + u.seed * 0.01);
    c.translate(0, d.dy - 12);
    c.rotate(d.rot * u.facing);
    c.translate(0, 12);
  }
  // desenhada um pouco maior que a área de acerto: rosto legível na tela (a regra não muda)
  c.scale(u.facing * u.size * DRAW_SCALE, u.size * DRAW_SCALE);

  // sombra no chão
  if (!air) {
    c.fillStyle = 'rgba(0,0,0,0.22)';
    ellipse(c, 0, 0.5, 12 * sx, 3);
    c.fill();
  }

  // o gato é um personagem inteiro (corpo, patas, rabo), não uma bola com orelhas
  const species = team.look.species;
  if (species === 'species-gato' || species === 'species-hamster') {
    const pose = { mood, sx, sy, hop: mood === 'walk' ? -Math.abs(Math.sin(u.walkPhase)) * 1.6 : 0, walk: Math.sin(u.walkPhase), t, air };
    if (species === 'species-gato') drawCat(c, u, o, pose);
    else drawHamster(c, u, o, pose);
    c.restore();
    return;
  }

  const hasTwoHands = o.holding === 'bazooka' || o.holding === 'triple' || o.holding === 'cluster' || o.holding === 'homing';
  // braço de trás (atrás do corpo)
  const armSwing = mood === 'walk' ? walk * 3 : Math.sin(t * 2 + u.seed) * 0.6;
  if (!o.holding || mood === 'fall' || mood === 'celebrate') {
    const up = mood === 'fall' || mood === 'celebrate';
    drawHand(c, team.color, -10 - (up ? 2 : 0), BODY_Y + (up ? -12 + Math.sin(t * 12) * 2 : 4 - armSwing));
  }

  // pés com sapatinho
  const fy = air ? -2 : -2.5;
  const step = mood === 'walk' ? walk * 3 : 0;
  const tuck = mood === 'jump' ? -2 : mood === 'fall' ? 1 : 0;
  drawFoot(c, team.dark, -5 + step, fy + tuck + Math.max(0, -walk) * (mood === 'walk' ? 1.5 : 0));
  drawFoot(c, team.dark, 5 - step, fy + tuck + Math.max(0, walk) * (mood === 'walk' ? 1.5 : 0));

  // arma atrás do corpo, presa na altura da barriga: o rosto fica sempre livre.
  // A mão de trás segura o cano por trás do corpo; a da frente fica no cabo, abaixo do rosto.
  const armed = !!o.holding && mood !== 'fall';
  const weaponPose = (): void => {
    c.translate(2, -5 + hop);
    if (o.holding !== 'dynamite' && o.holding !== 'airstrike' && o.holding !== 'teleport') c.rotate(-u.aim);
    if (mood === 'charge') c.translate(-1.2 + Math.sin(t * 40) * 0.35, 0); // treme de força
  };
  if (armed) {
    c.save();
    weaponPose();
    drawHeldWeapon(c, o.holding!);
    if (hasTwoHands) drawHand(c, team.color, 14, 2.8);
    c.restore();
  }

  // corpo (achata a partir do chão)
  c.save();
  c.translate(0, BODY_Y + hop);
  c.translate(0, RY);
  c.scale(sx, sy);
  c.translate(0, -RY);
  drawSpeciesBack(c, team, team.look.species, t + u.seed * 0.1);
  drawShadedBody(c, u);
  if (team.look.hat) drawHat(c, team, team.look.hat);
  else if (!team.look.species) drawHeadband(c, team.color, team.dark, t + u.seed, air ? u.vx : 0);
  drawFace(c, u, mood, o, t);
  drawSpeciesFace(c, team, team.look.species);
  drawEyewear(c, team.look.eyes);
  if (team.boss) {
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-0.5, -4.5);
    c.lineTo(6, -2);
    c.moveTo(7.5, -2);
    c.lineTo(13, -4.5);
    c.stroke();
  }
  c.restore();

  // mãos segurando a arma (duas nas armas compridas)
  if (armed) {
    c.save();
    weaponPose();
    drawHand(c, team.color, 2, 3.5);
    c.restore();
  } else if (mood !== 'fall' && mood !== 'celebrate') {
    drawHand(c, team.color, 10, BODY_Y + 5 + armSwing);
  } else {
    drawHand(c, team.color, 12, BODY_Y - 13 + Math.cos(t * 12) * 2);
  }
  c.restore();
}

/** Faixa de anime na testa, com as pontas balançando (some se tiver chapéu ou bicho). */
function drawHeadband(c: CanvasRenderingContext2D, color: string, dark: string, t: number, vx: number): void {
  const flow = Math.sin(t * 7) * 1.6 - vx * 0.004;
  // pontas soltas atrás da cabeça
  c.lineJoin = 'round';
  for (const [len, off] of [
    [11, 0],
    [8, 2.6],
  ] as const) {
    c.fillStyle = dark;
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-10.5, -6.5 + off * 0.3);
    c.quadraticCurveTo(-10.5 - len * 0.5, -6 + off + flow, -10.5 - len, -3.5 + off + flow * 1.6);
    c.lineTo(-10.5 - len + 1.5, -1.2 + off + flow * 1.6);
    c.quadraticCurveTo(-10.5 - len * 0.5, -2.5 + off + flow, -10, -3.6 + off * 0.3);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // a faixa contornando a testa
  c.save();
  c.beginPath();
  c.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(-RX - 1, -7.2);
  c.quadraticCurveTo(0, -10.5, RX + 1, -8.6);
  c.lineTo(RX + 1, -5.4);
  c.quadraticCurveTo(0, -7.4, -RX - 1, -3.6);
  c.closePath();
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.stroke();
  // brilho no tecido
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-6, -7.6);
  c.quadraticCurveTo(0, -9.3, 6, -8.6);
  c.stroke();
  c.restore();
  // nó
  c.fillStyle = color;
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  ellipse(c, -10.8, -5.4, 2.4, 2.2);
  c.fill();
  c.stroke();
}

export function drawHand(c: CanvasRenderingContext2D, color: string, x: number, y: number): void {
  c.fillStyle = color;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  ellipse(c, x, y, 3.6, 3.3);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  ellipse(c, x - 1, y - 1.2, 1.3, 0.9);
  c.fill();
}

function drawFoot(c: CanvasRenderingContext2D, color: string, x: number, y: number): void {
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - 5, y + 2);
  c.quadraticCurveTo(x - 5, y - 3.5, x, y - 3.5);
  c.quadraticCurveTo(x + 6.5, y - 3, x + 6, y + 2);
  c.closePath();
  c.fill();
  c.stroke();
  // sola clara
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x - 3.5, y + 1);
  c.lineTo(x + 4.5, y + 1);
  c.stroke();
}

/** Corpo com sombreado de desenho animado por cima do preenchimento dos cosméticos. */
function drawShadedBody(c: CanvasRenderingContext2D, u: Unit): void {
  const team = u.team;
  drawBody(c, team, team.look);
  c.save();
  ellipse(c, 0, 0, RX, RY);
  c.clip();
  // sombra em meia-lua (luz vem de cima-esquerda)
  c.fillStyle = team.dark;
  c.globalAlpha = 0.55;
  c.beginPath();
  c.ellipse(0, 0, RX + 1, RY + 1, 0, 0, Math.PI * 2);
  c.ellipse(-3.2, -3.6, RX, RY, 0, 0, Math.PI * 2, true);
  c.fill('evenodd');
  // luz rebatida na borda de baixo (tom quente)
  c.globalAlpha = 0.35;
  c.strokeStyle = team.light;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 0, RX - 1.2, RY - 1.2, 0, Math.PI * 0.2, Math.PI * 0.75);
  c.stroke();
  // barriguinha
  c.globalAlpha = 0.28;
  c.fillStyle = '#ffffff';
  ellipse(c, 2.5, 6, 6.5, 4.8);
  c.fill();
  c.restore();
  // brilho de verniz (o "olho de anime" do corpo)
  c.fillStyle = 'rgba(255,255,255,0.75)';
  ellipse(c, -5.5, -6.5, 3.2, 2, -0.6);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  ellipse(c, -2.2, -9.2, 0.9, 0.9);
  c.fill();
  // contorno grosso
  c.strokeStyle = INK;
  c.lineWidth = 2.6;
  ellipse(c, 0, 0, RX, RY);
  c.stroke();
}

/** Olhos de anime, sobrancelhas, boca e blush conforme o humor. */
/** Que bicho é o dono do rosto: muda íris, pupila, blush e boca. */
export type FaceKind = 'bolota' | 'cat' | 'hamster';

export function drawFace(c: CanvasRenderingContext2D, u: Unit, mood: Mood, o: UnitDrawOpts, t: number, kind: FaceKind = 'bolota'): void {
  const cat = kind === 'cat';
  const blink = mood !== 'hurt' && mood !== 'celebrate' && (t + u.seed) % 3.7 < 0.11;
  const lookX = Math.cos(u.aim) * 1.1;
  const lookY = -Math.sin(u.aim) * 1.3;
  const eyes: Array<[number, number, number]> = [
    [3.6, 4.2, 5.2],
    [9.8, 3.1, 4.6],
  ];
  c.lineCap = 'round';
  c.lineJoin = 'round';

  for (const [ex, rx, ry] of eyes) {
    const ey = 0.8;
    if (blink || mood === 'celebrate') {
      // fechado: arco (feliz "^" na comemoração)
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      if (mood === 'celebrate') c.arc(ex, ey + 2, rx * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      else c.arc(ex, ey - 1, rx * 0.85, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
      continue;
    }
    if (mood === 'hurt') {
      // "> <" de dor
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      const s = ex < 6 ? 1 : -1;
      c.beginPath();
      c.moveTo(ex - rx * 0.8 * s, ey - 3);
      c.lineTo(ex + rx * 0.6 * s, ey);
      c.lineTo(ex - rx * 0.8 * s, ey + 3);
      c.stroke();
      continue;
    }
    // esclera
    c.fillStyle = '#ffffff';
    ellipse(c, ex, ey, rx, ry);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.stroke();
    // íris com degradê (cor do time escura) e pupila
    const wide = mood === 'fall';
    const ir = wide ? rx * 0.42 : rx * 0.68;
    const ix = ex + lookX + 0.4;
    const iy = ey + lookY + 0.4;
    c.save();
    ellipse(c, ex, ey, rx, ry);
    c.clip();
    const g = c.createLinearGradient(0, iy - ir * 1.3, 0, iy + ir * 1.3);
    g.addColorStop(0, cat ? '#2f6b1c' : '#1a1210');
    g.addColorStop(1, cat ? '#d9f26a' : kind === 'hamster' ? '#7a4a2a' : u.team.boss ? '#8a1c1c' : u.team.dark);
    c.fillStyle = g;
    ellipse(c, ix, iy, ir, ir * 1.25);
    c.fill();
    c.fillStyle = '#0d0907';
    // gato: pupila em fenda quando foca, redonda e enorme quando assusta
    if (cat && !wide) ellipse(c, ix, iy + 0.2, ir * (mood === 'aim' || mood === 'charge' ? 0.18 : 0.32), ir * 1.05);
    else ellipse(c, ix, iy + 0.2, ir * (cat ? 0.85 : 0.5), ir * (cat ? 0.95 : 0.62));
    c.fill();
    // pálpebra de cima: foco (mirando/carregando) corta o olho
    if (mood === 'aim' || mood === 'charge') {
      c.fillStyle = u.team.color;
      c.fillRect(ex - rx - 1, ey - ry - 1, rx * 2 + 2, ry * (mood === 'charge' ? 0.8 : 0.55));
    }
    c.restore();
    // brilhos (dois, estilo anime)
    c.fillStyle = '#ffffff';
    ellipse(c, ix - ir * 0.35, iy - ir * 0.55, ir * 0.38, ir * 0.42);
    c.fill();
    ellipse(c, ix + ir * 0.35, iy + ir * 0.45, ir * 0.16, ir * 0.16);
    c.fill();
    // linha grossa da pálpebra (cílios)
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    const lidY = mood === 'aim' ? ey - ry * 0.45 : mood === 'charge' ? ey - ry * 0.2 : ey;
    if (mood === 'aim' || mood === 'charge') {
      c.moveTo(ex - rx, lidY + 0.6);
      c.lineTo(ex + rx, lidY - 0.6);
    } else c.ellipse(ex, ey, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
  }

  // sobrancelhas
  c.strokeStyle = INK;
  c.lineWidth = 1.9;
  c.beginPath();
  if (mood === 'aim' || mood === 'charge') {
    c.moveTo(0.2, -6.2);
    c.lineTo(6.5, -4.4);
    c.moveTo(7.8, -4.4);
    c.lineTo(12.6, -6);
  } else if (mood === 'worried' || mood === 'fall' || mood === 'hurt') {
    c.moveTo(0.4, -4.6);
    c.lineTo(6, -6.6);
    c.moveTo(8, -6.4);
    c.lineTo(12.4, -4.8);
  } else {
    c.moveTo(0.8, -5.8);
    c.quadraticCurveTo(3.6, -7.2, 6.2, -6);
    c.moveTo(8, -5.6);
    c.quadraticCurveTo(10.2, -6.8, 12.4, -5.4);
  }
  c.stroke();

  // blush tracejado de anime
  const bo = cat ? -2.6 : kind === 'hamster' ? -0.8 : 0;
  c.strokeStyle = 'rgba(255,90,120,0.75)';
  c.lineWidth = 1;
  c.beginPath();
  for (const bx of [1.5, 3.3, 5.1]) {
    c.moveTo(bx + bo, 7.2);
    c.lineTo(bx + bo - 1.2, 9);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,90,120,0.28)';
  ellipse(c, 3.2 + bo, 8, 3.2, 1.6);
  c.fill();
  if (cat) {
    drawCatMouth(c, mood);
    drawSweat(c, mood, t);
    return;
  }
  if (kind === 'hamster') {
    drawHamsterMouth(c, mood);
    drawSweat(c, mood, t);
    return;
  }

  // boca
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  const mx = 8.2;
  const my = 8.4;
  c.beginPath();
  switch (mood) {
    case 'celebrate':
    case 'jump': {
      const big = mood === 'celebrate' ? 1.4 : 0.9;
      c.fillStyle = '#5a1620';
      c.moveTo(mx - 3 * big, my - 1);
      c.quadraticCurveTo(mx, my + 5 * big, mx + 3 * big, my - 1);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ff7a8a';
      ellipse(c, mx, my + 2 * big, 1.4 * big, 0.9 * big);
      c.fill();
      break;
    }
    case 'fall':
      c.fillStyle = '#5a1620';
      ellipse(c, mx, my + 0.8, 2.2, 2.8);
      c.fill();
      c.stroke();
      break;
    case 'hurt':
      c.fillStyle = '#ffffff';
      c.rect(mx - 3.2, my - 0.6, 6.4, 3.2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(mx - 3.2, my + 1);
      c.lineTo(mx + 3.2, my + 1);
      for (const k of [-1.6, 0, 1.6]) {
        c.moveTo(mx + k, my - 0.6);
        c.lineTo(mx + k, my + 2.6);
      }
      c.stroke();
      break;
    case 'charge':
      c.moveTo(mx - 3, my + 0.6);
      c.lineTo(mx + 3, my - 0.4);
      c.stroke();
      break;
    case 'worried':
      c.moveTo(mx - 3, my + 1);
      c.quadraticCurveTo(mx - 1.5, my - 0.5, mx, my + 1);
      c.quadraticCurveTo(mx + 1.5, my + 2.5, mx + 3, my + 1);
      c.stroke();
      break;
    case 'aim':
      c.arc(mx, my - 1, 2.2, Math.PI * 0.25, Math.PI * 0.75);
      c.stroke();
      break;
    default:
      c.arc(mx, my - 1.2, 2.8, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
  }

  drawSweat(c, mood, t);
  void o;
}

/** Gota de suor: medo e vida baixa. */
export function drawSweat(c: CanvasRenderingContext2D, mood: Mood, t: number): void {
  if (mood !== 'worried' && mood !== 'fall') return;
  const dy = (t * 6) % 6;
  c.fillStyle = '#9fe0ff';
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-6, -8 + dy);
  c.quadraticCurveTo(-3.6, -3.5 + dy, -6, -2.6 + dy);
  c.quadraticCurveTo(-8.4, -3.5 + dy, -6, -8 + dy);
  c.fill();
  c.stroke();
}
