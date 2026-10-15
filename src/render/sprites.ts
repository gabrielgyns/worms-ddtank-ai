import { a11y, TEAM_MARK } from './a11y';
import type { Projectile } from '../domain/physics';
import type { Unit } from '../domain/unit';
import type { Crate } from '../domain/crates';
import type { Barrel, Mine } from '../domain/props';
import type { WeaponId } from '../domain/weapons';
import type { Look } from '../domain/cosmetics';
import { danceTransform, drawBody, drawEyewear, drawGraveLook, drawHat, drawPineapple } from './cosmetics';

export const INK = '#2a1a12';
export const FONT = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Banana cartoon (bomba e pedaços). */
function drawBananaShape(c: CanvasRenderingContext2D, x: number, y: number, rot: number, scale = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(scale, scale);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = '#ffd93b';
  c.beginPath();
  c.moveTo(-9, -3);
  c.quadraticCurveTo(0, 10, 10, -4);
  c.quadraticCurveTo(0, 4, -9, -3);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#6b4a1e';
  c.beginPath();
  c.arc(10, -4, 1.8, 0, Math.PI * 2);
  c.arc(-9, -3, 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Ovelha fofa com patinhas que andam. */
function drawSheepShape(c: CanvasRenderingContext2D, x: number, y: number, dir: number, step: number): void {
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  // patas
  c.fillStyle = INK;
  for (const [lx, ph] of [[-6, 0], [-2, Math.PI], [3, Math.PI], [7, 0]] as const) {
    const lift = Math.max(0, Math.sin(step + ph)) * 3;
    c.fillRect(lx - 1.2, 4 - lift, 2.4, 6);
  }
  // lã
  c.fillStyle = '#fbfbf6';
  c.beginPath();
  for (const [cx, cy, r] of [[-6, -1, 5], [-1, -4, 6], [5, -2, 5], [0, 2, 6], [-5, 3, 4]] as const) {
    c.moveTo(cx + r, cy);
    c.arc(cx, cy, r, 0, Math.PI * 2);
  }
  c.fill();
  c.stroke();
  c.fill();
  // cara
  c.fillStyle = '#3a2c28';
  c.beginPath();
  c.ellipse(10, -2, 4.5, 4, 0.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(11.5, -3, 1.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Arma na mão, desenhada no espaço local (apontando para +x). */
export function drawHeldWeapon(c: CanvasRenderingContext2D, id: WeaponId): void {
  c.lineWidth = 2;
  c.strokeStyle = INK;
  switch (id) {
    case 'bazooka':
    case 'triple':
    case 'cluster': {
      const body = id === 'bazooka' ? '#6f8a3a' : id === 'triple' ? '#3a6f8a' : '#7a4a8a';
      roundRect(c, -8, -4.5, 28, 9, 3);
      c.fillStyle = body;
      c.fill();
      c.stroke();
      roundRect(c, 18, -6, 6, 12, 2);
      c.fillStyle = '#333';
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-6, -3.5, 22, 2.5);
      if (id === 'triple') {
        c.fillStyle = '#ffd54a';
        for (let i = 0; i < 3; i++) c.fillRect(0 + i * 5, -1, 3, 3);
      }
      break;
    }
    case 'grenade':
      drawGrenadeShape(c, 12, 0, 0);
      break;
    case 'dynamite':
      drawDynamiteShape(c, 10, 0, 0);
      break;
    case 'airstrike':
      roundRect(c, 4, -7, 10, 14, 2);
      c.fillStyle = '#4a4a4a';
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(12, -7);
      c.lineTo(14, -16);
      c.stroke();
      c.fillStyle = '#ff4040';
      c.beginPath();
      c.arc(14, -16, 2, 0, Math.PI * 2);
      c.fill();
      break;
    case 'rope':
      c.strokeStyle = '#9b6a3a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(8, 0, 5, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(13, 0);
      c.lineTo(19, -4);
      c.lineTo(17, -7);
      c.moveTo(19, -4);
      c.lineTo(21, -1);
      c.stroke();
      break;
    case 'parachute':
      c.fillStyle = '#ff5a3a';
      c.beginPath();
      c.moveTo(-2, -2);
      c.quadraticCurveTo(8, -16, 18, -2);
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-1, -2);
      c.lineTo(8, 6);
      c.lineTo(17, -2);
      c.stroke();
      break;
    case 'banana':
      drawBananaShape(c, 10, 0, -0.4, 1.1);
      break;
    case 'sheep':
      drawSheepShape(c, 12, 0, 1, 0);
      break;
    case 'teleport':
      roundRect(c, 2, -5, 14, 10, 3);
      c.fillStyle = '#7b5cff';
      c.fill();
      c.stroke();
      c.fillStyle = '#c8f7ff';
      c.beginPath();
      c.arc(16, 0, 3.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      break;
  }
}

export function drawGrenadeShape(c: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  ellipse(c, 0, 0, 6, 6.5);
  c.fillStyle = '#4f9a3a';
  c.fill();
  c.stroke();
  c.fillStyle = '#888';
  c.fillRect(-2.5, -9.5, 5, 4);
  c.strokeRect(-2.5, -9.5, 5, 4);
  c.beginPath();
  c.arc(4, -9, 2.6, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  ellipse(c, -2, -2, 2, 2.5);
  c.fill();
  c.restore();
}

export function drawDynamiteShape(c: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  roundRect(c, -4, -9, 8, 18, 2);
  c.fillStyle = '#e8402e';
  c.fill();
  c.stroke();
  c.fillStyle = '#fff1c2';
  c.fillRect(-4, -2, 8, 4);
  c.beginPath();
  c.moveTo(0, -9);
  c.quadraticCurveTo(4, -14, 2, -17);
  c.stroke();
  c.restore();
}

export function drawProjectile(c: CanvasRenderingContext2D, p: Projectile, time: number, look?: Look): void {
  const k = p.spec.kind;
  if (k === 'missile') {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(p.vy, p.vx));
    c.lineWidth = 2;
    c.strokeStyle = INK;
    // aletas
    c.fillStyle = '#c33';
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(-12, -6);
    c.lineTo(-4, -2);
    c.lineTo(-4, 2);
    c.lineTo(-12, 6);
    c.closePath();
    c.fill();
    c.stroke();
    roundRect(c, -9, -3.5, 16, 7, 3.5);
    c.fillStyle = '#e8e8e8';
    c.fill();
    c.stroke();
    c.fillStyle = '#e33';
    c.beginPath();
    c.moveTo(5, -3.5);
    c.quadraticCurveTo(12, 0, 5, 3.5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  } else if (k === 'grenade') {
    if (look?.grenade === 'skin-abacaxi') drawPineapple(c, p.x, p.y, p.rot);
    else drawGrenadeShape(c, p.x, p.y, p.rot);
  } else if (k === 'dynamite') {
    drawDynamiteShape(c, p.x, p.y, p.rot * 0.3);
    // faísca do pavio
    c.fillStyle = Math.sin(time * 40) > 0 ? '#ffe34a' : '#ff8a2a';
    c.beginPath();
    c.arc(p.x + 2, p.y - 17, 3 + Math.random() * 2, 0, Math.PI * 2);
    c.fill();
  } else if (k === 'banana') {
    drawBananaShape(c, p.x, p.y, p.rot, p.spec.fuse === undefined ? 0.8 : 1.2);
  } else if (k === 'sheep') {
    drawSheepShape(c, p.x, p.y - 2, p.dir ?? 1, p.rot * 2);
  } else if (k === 'cluster') {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.lineWidth = 2;
    c.strokeStyle = INK;
    ellipse(c, 0, 0, 7, 7);
    c.fillStyle = '#3b3550';
    c.fill();
    c.stroke();
    c.fillStyle = '#ffd54a';
    c.fillRect(-7, -1.5, 14, 3);
    c.restore();
  } else {
    c.lineWidth = 1.5;
    c.strokeStyle = INK;
    ellipse(c, p.x, p.y, 4, 4);
    c.fillStyle = '#ff5a3a';
    c.fill();
    c.stroke();
  }

  if (p.fuse !== undefined && k !== 'bomblet') {
    const n = Math.ceil(p.fuse);
    c.font = `16px ${FONT}`;
    c.textAlign = 'center';
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.strokeText(String(n), p.x, p.y - 22);
    c.fillStyle = '#fff';
    c.fillText(String(n), p.x, p.y - 22);
  }
}

export interface UnitDrawOpts {
  active: boolean;
  holding: WeaponId | null;
  hurt: number;
  time: number;
  /** comemorando a vitória (fim de partida) */
  celebrate?: boolean;
}

/** A bolota: corpinho redondo, capacete do time, olhos que seguem a mira. */
export function drawUnit(c: CanvasRenderingContext2D, u: Unit, o: UnitDrawOpts): void {
  const t = o.time;
  const team = u.team;
  c.save();
  c.translate(u.x, u.y);
  if (o.celebrate) {
    const d = danceTransform(team.look.dance, t + u.seed * 0.01);
    c.translate(0, d.dy - 12);
    c.rotate(d.rot * u.facing);
    c.translate(0, 12);
  }
  c.scale(u.facing * u.size, u.size);

  const moving = Math.sin(u.walkPhase);
  const breathe = u.onGround ? Math.sin(t * 3 + u.seed) * 0.03 : 0;
  const air = !u.onGround;

  // sombra
  if (!air) {
    c.fillStyle = 'rgba(0,0,0,0.18)';
    ellipse(c, 0, 0, 11, 3);
    c.fill();
  }

  // pés
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = team.dark;
  const fy = air ? -1 : -2;
  ellipse(c, -5 + moving * 2.5, fy, 5, 3.2);
  c.fill();
  c.stroke();
  ellipse(c, 5 - moving * 2.5, fy, 5, 3.2);
  c.fill();
  c.stroke();

  // corpo
  c.save();
  c.translate(0, -13);
  c.scale(1 - breathe, 1 + breathe);
  drawBody(c, team, team.look);

  // barriguinha
  c.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(c, 2, 5, 6, 4.5);
  c.fill();

  drawHat(c, team, team.look.hat);

  // olhos
  const lookX = Math.cos(u.aim) * 1.3;
  const lookY = -Math.sin(u.aim) * 1.5;
  const blink = (t + u.seed) % 3.7 < 0.12;
  const scared = o.hurt > 0;
  for (const [ex, rx, ry] of [
    [3.5, 3.6, 4.3],
    [9, 2.8, 3.8],
  ] as const) {
    if (blink) {
      c.strokeStyle = INK;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(ex - rx, 3);
      c.lineTo(ex + rx, 3);
      c.stroke();
      continue;
    }
    c.fillStyle = '#fff';
    ellipse(c, ex, 2.5, rx, ry);
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = INK;
    ellipse(c, ex + lookX, 2.8 + lookY, scared ? 0.9 : 1.6, scared ? 0.9 : 2.1);
    c.fill();
    if (!scared) {
      c.fillStyle = '#fff';
      ellipse(c, ex + lookX - 0.6, 1.8 + lookY, 0.6, 0.6);
      c.fill();
    }
  }
  // bochecha e boca
  c.fillStyle = 'rgba(255,90,120,0.45)';
  ellipse(c, 6.5, 8, 2.5, 1.5);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  if (scared) c.arc(7, 9.5, 1.8, 0, Math.PI * 2);
  else c.arc(7.5, 7.5, 2.2, 0.2, Math.PI - 0.6);
  c.stroke();
  drawEyewear(c, team.look.eyes);
  if (team.boss) {
    // sobrancelhas bravas do chefão
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -3);
    c.lineTo(6, -1);
    c.moveTo(7, -1);
    c.lineTo(12, -3);
    c.stroke();
  }
  c.restore();

  // arma
  if (o.holding) {
    c.save();
    c.translate(2, -11);
    if (o.holding !== 'dynamite' && o.holding !== 'airstrike' && o.holding !== 'teleport') c.rotate(-u.aim);
    drawHeldWeapon(c, o.holding);
    // mãozinha
    c.fillStyle = team.color;
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    ellipse(c, 6, 3, 3.2, 3);
    c.fill();
    c.stroke();
    c.restore();
  }
  c.restore();
}


export function drawLabel(c: CanvasRenderingContext2D, u: Unit, active: boolean, time: number, zoom: number): void {
  const s = 1 / Math.max(0.75, Math.min(1.3, zoom));
  // chapéus altos empurram o rótulo para cima
  const tall = { 'hat-cartola': 16, 'hat-festa': 16, 'hat-chef': 10, 'hat-crown': 8, 'hat-louros': 4 }[u.team.look.hat ?? ''] ?? 0;
  const y = u.y - 34 * u.size - tall * u.size - (u.chute ? 40 : 0);
  c.save();
  c.translate(u.x, y);
  c.scale(s, s);
  c.font = `13px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const hp = String(Math.max(0, Math.ceil(u.hp)));
  const name = a11y.colorblind ? `${TEAM_MARK[u.team.id % TEAM_MARK.length]} ${u.name}` : u.name;
  const nameW = c.measureText(name).width + 12;
  // nome
  c.lineWidth = 3.5;
  c.strokeStyle = INK;
  c.strokeText(name, 0, -18);
  c.fillStyle = '#fff';
  c.fillText(name, 0, -18);
  // pílula de vida
  const pw = Math.max(34, c.measureText(hp).width + 16);
  roundRect(c, -pw / 2, -8, pw, 16, 8);
  c.fillStyle = u.team.color;
  c.fill();
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#fff';
  c.lineWidth = 3;
  c.strokeText(hp, 0, 0.5);
  c.fillText(hp, 0, 0.5);
  if (active) {
    const b = Math.abs(Math.sin(time * 5)) * 6;
    c.fillStyle = u.team.light;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -40 - b);
    c.lineTo(8, -40 - b);
    c.lineTo(0, -29 - b);
    c.closePath();
    c.fill();
    c.stroke();
  }
  void nameW;
  c.restore();
}

export function drawCrosshair(c: CanvasRenderingContext2D, u: Unit, time: number): void {
  const dx = Math.cos(u.aim) * u.facing;
  const dy = -Math.sin(u.aim);
  const x = u.cx + dx * 72;
  const y = u.cy + dy * 72;
  const r = 7 + Math.sin(time * 6) * 1;
  c.save();
  // arco-guia de ângulo, estilo DDTank
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 3;
  c.setLineDash([4, 6]);
  c.save();
  c.translate(u.cx, u.cy);
  c.scale(u.facing, 1);
  c.beginPath();
  c.arc(0, 0, 72, -88 * (Math.PI / 180), 80 * (Math.PI / 180));
  c.stroke();
  c.restore();
  c.setLineDash([]);
  c.lineWidth = 3;
  c.strokeStyle = INK;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = u.team.look.aim === 'aim-gold' ? '#ffd23a' : '#ff3b3b';
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.moveTo(x - r - 4, y);
  c.lineTo(x - r + 3, y);
  c.moveTo(x + r - 3, y);
  c.lineTo(x + r + 4, y);
  c.moveTo(x, y - r - 4);
  c.lineTo(x, y - r + 3);
  c.moveTo(x, y + r - 3);
  c.lineTo(x, y + r + 4);
  c.stroke();
  c.restore();
}

/** Força +50%: brilho vermelho pulsando atrás da bolota. */
export function drawPowerAura(c: CanvasRenderingContext2D, u: Unit, time: number): void {
  const r = 26 * u.size + Math.sin(time * 8) * 3;
  const g = c.createRadialGradient(u.cx, u.cy, r * 0.3, u.cx, u.cy, r);
  g.addColorStop(0, 'rgba(255, 90, 40, 0.55)');
  g.addColorStop(1, 'rgba(255, 90, 40, 0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(u.cx, u.cy, r, 0, Math.PI * 2);
  c.fill();
}

/** Escudo: bolha azul translúcida. */
export function drawShield(c: CanvasRenderingContext2D, u: Unit, time: number): void {
  const r = 22 * u.size;
  c.save();
  c.globalAlpha = 0.85;
  c.fillStyle = 'rgba(120, 200, 255, 0.18)';
  c.strokeStyle = 'rgba(160, 225, 255, 0.9)';
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(u.cx, u.cy, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // reflexo girando
  c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  c.beginPath();
  c.arc(u.cx, u.cy, r - 4, time * 1.5, time * 1.5 + 0.9);
  c.stroke();
  c.restore();
}

/** Tamanho real da explosão da arma, em volta da mira. */
export function drawBlastPreview(c: CanvasRenderingContext2D, x: number, y: number, blast: number, time: number): void {
  c.save();
  c.fillStyle = 'rgba(255, 120, 60, 0.10)';
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = 2;
  c.setLineDash([6, 6]);
  c.lineDashOffset = -time * 20;
  c.beginPath();
  c.arc(x, y, blast, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

/** Começo da trajetória enquanto carrega: pontos que somem aos poucos. */
export function drawPreviewPath(c: CanvasRenderingContext2D, pts: ReadonlyArray<{ x: number; y: number }>): void {
  c.save();
  for (let i = 1; i < pts.length; i++) {
    const k = 1 - i / pts.length;
    c.fillStyle = `rgba(255, 255, 255, ${0.15 + 0.7 * k})`;
    c.beginPath();
    c.arc(pts[i].x, pts[i].y, 2 + 2.5 * k, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function drawGrave(c: CanvasRenderingContext2D, x: number, y: number, color: string, look?: Look): void {
  if (drawGraveLook(c, x, y, color, look?.grave)) return;
  c.save();
  c.translate(x, y);
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  c.beginPath();
  c.moveTo(-10, 0);
  c.lineTo(-10, -16);
  c.arc(0, -16, 10, Math.PI, 0);
  c.lineTo(10, 0);
  c.closePath();
  c.fillStyle = '#b9b4c4';
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(-7, -20, 3, 16);
  c.fillStyle = color;
  c.fillRect(-1.5, -21, 3, 13);
  c.fillRect(-5, -17, 10, 3);
  c.fillStyle = '#6fbf4a';
  c.fillRect(-12, -2, 24, 3);
  c.restore();
}

/** Ícone para a barra de armas (desenhado num canvas 40x40). */
export function drawWeaponIcon(c: CanvasRenderingContext2D, id: WeaponId): void {
  c.save();
  c.translate(20, 20);
  switch (id) {
    case 'bazooka':
    case 'triple':
    case 'cluster':
      c.rotate(-0.5);
      c.scale(1.05, 1.05);
      c.translate(-8, 0);
      drawHeldWeapon(c, id);
      break;
    case 'grenade':
      c.scale(1.6, 1.6);
      drawGrenadeShape(c, 0, 1.5, 0.3);
      break;
    case 'dynamite':
      c.scale(1.4, 1.4);
      drawDynamiteShape(c, 0, 2, 0.3);
      break;
    case 'airstrike': {
      c.scale(1.2, 1.2);
      c.rotate(Math.PI / 2.6);
      const fake = { x: 0, y: 0, vx: 1, vy: 0, spec: { kind: 'missile' }, age: 0, ownerId: 0, rot: 0 } as unknown as Projectile;
      drawProjectile(c, fake, 0);
      break;
    }
    case 'banana':
      c.scale(1.5, 1.5);
      drawBananaShape(c, 0, 1, -0.3);
      break;
    case 'sheep':
      c.scale(1.5, 1.5);
      drawSheepShape(c, -1, 0, 1, 0);
      break;
    case 'teleport':
    case 'rope':
    case 'parachute':
      c.scale(1.4, 1.4);
      c.translate(-9, id === 'parachute' ? 4 : 0);
      drawHeldWeapon(c, id);
      break;
  }
  c.restore();
}

/** Corda ninja: fio do gancho até a bolota. */
export function drawRope(c: CanvasRenderingContext2D, u: Unit): void {
  const r = u.rope;
  if (!r) return;
  c.save();
  c.strokeStyle = INK;
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(r.ax, r.ay);
  c.lineTo(u.cx, u.cy);
  c.stroke();
  c.strokeStyle = '#c48a4a';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#9aa3ad';
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(r.ax, r.ay, 3.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

/** Paraquedas aberto sobre a bolota. */
export function drawChute(c: CanvasRenderingContext2D, u: Unit, t: number): void {
  if (!u.chute) return;
  c.save();
  c.translate(u.x, u.y - 24);
  c.rotate(Math.sin(t * 2.5 + u.seed) * 0.08);
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-6, 4);
  c.lineTo(-18, -20);
  c.moveTo(6, 4);
  c.lineTo(18, -20);
  c.stroke();
  c.lineWidth = 2.5;
  c.fillStyle = u.team.light;
  c.beginPath();
  c.moveTo(-26, -20);
  c.quadraticCurveTo(0, -50, 26, -20);
  c.quadraticCurveTo(13, -25, 0, -20);
  c.quadraticCurveTo(-13, -25, -26, -20);
  c.fill();
  c.stroke();
  c.fillStyle = u.team.color;
  c.beginPath();
  c.moveTo(-9, -22);
  c.quadraticCurveTo(0, -44, 9, -22);
  c.quadraticCurveTo(0, -25, -9, -22);
  c.fill();
  c.restore();
}

/** Seta de força enquanto o jogador arrasta para mirar. */
export function drawDragPower(c: CanvasRenderingContext2D, u: Unit, power: number, zoom: number): void {
  const dx = Math.cos(u.aim) * u.facing;
  const dy = -Math.sin(u.aim);
  const len = (24 + power * 150) / Math.max(0.6, zoom);
  const x0 = u.cx + dx * 18;
  const y0 = u.cy + dy * 18;
  const x1 = u.cx + dx * (18 + len);
  const y1 = u.cy + dy * (18 + len);
  const hue = 110 - power * 110;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.strokeStyle = `hsl(${hue} 85% 55%)`;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  // ponta
  c.translate(x1, y1);
  c.rotate(Math.atan2(dy, dx));
  c.fillStyle = `hsl(${hue} 85% 55%)`;
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(10, 0);
  c.lineTo(-4, -8);
  c.lineTo(-4, 8);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
  c.save();
  c.font = `${Math.round(15 / Math.max(0.75, zoom))}px ${FONT}`;
  c.textAlign = 'center';
  c.lineWidth = 4;
  c.strokeStyle = INK;
  const label = `${Math.round(power * 100)}%`;
  c.strokeText(label, x1 + dx * 22, y1 + dy * 22 + 5);
  c.fillStyle = '#fff';
  c.fillText(label, x1 + dx * 22, y1 + dy * 22 + 5);
  c.restore();
}

/** Caixa de suprimentos (com paraquedas enquanto cai). */
export function drawCrate(c: CanvasRenderingContext2D, crate: Crate, time: number): void {
  c.save();
  c.translate(crate.x, crate.y);
  if (!crate.landed) {
    const sway = Math.sin(time * 3 + crate.id) * 0.12;
    c.rotate(sway);
    // paraquedas
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-9, -16);
    c.lineTo(-18, -40);
    c.moveTo(9, -16);
    c.lineTo(18, -40);
    c.stroke();
    c.lineWidth = 2.5;
    c.fillStyle = crate.kind === 'health' ? '#fff' : '#ffcf3a';
    c.beginPath();
    c.moveTo(-24, -40);
    c.quadraticCurveTo(0, -66, 24, -40);
    c.quadraticCurveTo(12, -45, 0, -40);
    c.quadraticCurveTo(-12, -45, -24, -40);
    c.fill();
    c.stroke();
    c.fillStyle = crate.kind === 'health' ? '#ff4a4a' : '#e8402e';
    c.beginPath();
    c.moveTo(-8, -43);
    c.quadraticCurveTo(0, -60, 8, -43);
    c.quadraticCurveTo(0, -46, -8, -43);
    c.fill();
  }
  // caixa
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  c.fillStyle = crate.kind === 'health' ? '#f4f1ea' : '#b5793e';
  c.beginPath();
  c.roundRect(-10, -18, 20, 18, 3);
  c.fill();
  c.stroke();
  if (crate.kind === 'health') {
    c.fillStyle = '#e8402e';
    c.fillRect(-2.5, -15, 5, 12);
    c.fillRect(-6, -11.5, 12, 5);
  } else {
    c.strokeStyle = '#7a4b26';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-9, -17);
    c.lineTo(9, -1);
    c.moveTo(9, -17);
    c.lineTo(-9, -1);
    c.stroke();
    c.fillStyle = '#ffcf3a';
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, -9, 4.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.font = `8px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('?', 0, -8.5);
  }
  c.restore();
}

export function drawBarrel(c: CanvasRenderingContext2D, b: Barrel, time: number): void {
  c.save();
  c.translate(b.x, b.y);
  if (b.fuse !== null) c.translate((Math.random() - 0.5) * 2, 0);
  c.lineWidth = 2.5;
  c.strokeStyle = INK;
  c.fillStyle = '#d8402e';
  c.beginPath();
  c.roundRect(-8, -22, 16, 22, 4);
  c.fill();
  c.stroke();
  c.fillStyle = '#9c2a1c';
  c.fillRect(-8, -16, 16, 2.5);
  c.fillRect(-8, -7, 16, 2.5);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(-5, -20, 2.5, 18);
  // símbolo de perigo
  c.fillStyle = '#ffe14a';
  c.beginPath();
  c.moveTo(0, -15);
  c.lineTo(5, -6);
  c.lineTo(-5, -6);
  c.closePath();
  c.fill();
  c.lineWidth = 1.2;
  c.stroke();
  if (b.fuse !== null && Math.sin(time * 40) > 0) {
    c.fillStyle = 'rgba(255,240,150,0.6)';
    c.beginPath();
    c.arc(0, -11, 13, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function drawMine(c: CanvasRenderingContext2D, m: Mine, time: number): void {
  c.save();
  c.translate(m.x, m.y);
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.fillStyle = '#3a3f47';
  c.beginPath();
  c.arc(0, 0, 7, Math.PI, 0);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillRect(-8, -1.5, 16, 3);
  c.strokeRect(-8, -1.5, 16, 3);
  const blink = m.fuse !== null ? Math.sin(time * 30) > 0 : Math.sin(time * 3 + m.id) > 0.6;
  c.fillStyle = blink ? '#ff3b3b' : '#6a1d1d';
  c.beginPath();
  c.arc(0, -6, 2.2, 0, Math.PI * 2);
  c.fill();
  if (m.fuse !== null) {
    c.strokeStyle = 'rgba(255,60,60,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, -4, 10 + Math.sin(time * 20) * 3, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
