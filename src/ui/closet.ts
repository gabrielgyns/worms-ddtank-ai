import { COSMETICS, SLOT_NAME, cosmetic, type Look, type Slot } from '../domain/cosmetics';
import { TEAM_COLORS } from '../domain/teamColors';
import { Unit, type Team } from '../domain/unit';
import { loadProfile } from '../progress/profile';
import { progress } from '../progress/progress';
import { drawGraveLook } from '../render/cosmetics';
import { drawGrave, drawUnit } from '../render/sprites';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

/** O que o jogador está vestindo agora. */
export function myLook(): Look {
  return { ...progress().state.equipped } as Look;
}

/** Desenha uma bolota de exemplo com um visual (prévia em loja e armário). */
export function drawPreview(canvas: HTMLCanvasElement, look: Look, colorIdx = loadProfile().color, time = 0): void {
  const c = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const col = TEAM_COLORS[colorIdx] ?? TEAM_COLORS[0];
  const team = { id: 0, name: '', color: col.color, light: col.light, dark: col.dark, look } as unknown as Team;
  const u = new Unit(0, team, '', 0, 0);
  u.onGround = true;
  u.aim = 0.3;
  // gato e hamster são mais altos (orelhas): enquadra um pouco mais longe
  const s = Math.min(w, h) / (look.species === 'species-gato' ? 54 : look.species === 'species-hamster' || look.species === 'species-cachorro' ? 50 : 44);
  c.save();
  c.translate(w * 0.42, h * 0.82);
  c.scale(s, s);
  drawUnit(c, u, { active: false, holding: null, hurt: 0, time, celebrate: !!look.dance });
  c.restore();
  if (look.grave) {
    c.save();
    c.translate(w * 0.8, h * 0.82);
    c.scale(s * 0.55, s * 0.55);
    if (!drawGraveLook(c, 0, 0, col.color, look.grave)) drawGrave(c, 0, 0, col.color);
    c.restore();
  }
}

/** Anima a prévia enquanto o canvas estiver na página e a tela aberta. */
export function animatePreview(canvas: HTMLCanvasElement, look: Look, screen: HTMLElement): void {
  const t0 = performance.now();
  const frame = (now: number) => {
    if (!canvas.isConnected || !screen.classList.contains('open')) return;
    drawPreview(canvas, look, undefined, (now - t0) / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Tela "Visual": vestir o que você tem. */
export class ClosetUi {
  constructor(private show: (id: string | null) => void) {
    $('#closet-btn').addEventListener('click', () => this.open());
  }

  open(): void {
    this.render();
    this.show('closet');
  }

  private render(): void {
    const p = progress();
    const owned = new Set(p.state.owned);
    const slots = (Object.keys(SLOT_NAME) as Slot[]).filter((s) => COSMETICS.some((c) => c.slot === s && owned.has(c.id)));
    const body = $('#closet-body');
    body.innerHTML = `
      <canvas id="closet-preview" class="preview"></canvas>
      ${
        slots.length
          ? slots
              .map((slot) => {
                const cur = p.equipped(slot);
                const items = COSMETICS.filter((c) => c.slot === slot && owned.has(c.id));
                return `<span class="lbl">${SLOT_NAME[slot]}</span><div class="seg">
                  <button data-slot="${slot}" data-item="" class="${cur ? '' : 'on'}">Padrão</button>
                  ${items.map((i) => `<button data-slot="${slot}" data-item="${i.id}" class="${cur === i.id ? 'on' : ''}">${i.name}</button>`).join('')}
                </div>`;
              })
              .join('')
          : '<p class="hint">Você ainda não tem itens. Ganhe em conquistas ou compre na loja com Bolotins!</p>'
      }`;
    animatePreview(body.querySelector('#closet-preview')!, myLook(), $('#closet'));
    body.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const item = b.dataset.item || null;
        if (item && !cosmetic(item)) return;
        p.equip(b.dataset.slot!, item);
        this.render();
      }),
    );
  }
}
