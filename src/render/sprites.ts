import type { Projectile } from '../domain/physics';
import type { Unit } from '../domain/unit';
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
  c.scale(u.facing, 1);

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
  const tall = { 'hat-cartola': 16, 'hat-festa': 16, 'hat-chef': 10, 'hat-crown': 8 }[u.team.look.hat ?? ''] ?? 0;
  const y = u.y - 34 - tall;
  c.save();
  c.translate(u.x, y);
  c.scale(s, s);
  c.font = `13px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const hp = String(Math.max(0, Math.ceil(u.hp)));
  const nameW = c.measureText(u.name).width + 12;
  // nome
  c.lineWidth = 3.5;
  c.strokeStyle = INK;
  c.strokeText(u.name, 0, -18);
  c.fillStyle = '#fff';
  c.fillText(u.name, 0, -18);
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
    case 'teleport':
      c.scale(1.4, 1.4);
      c.translate(-9, 0);
      drawHeldWeapon(c, id);
      break;
  }
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
