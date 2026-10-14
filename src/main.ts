import './style.css';
import { Sfx } from './core/audio';
import { Input } from './core/input';
import type { Difficulty } from './domain/ai';
import type { TeamSetup } from './domain/match';
import { THEMES, type ThemeId } from './domain/theme';
import { Game } from './game';
import { canFullscreen, enterFullscreen, isTouchDevice, toggleFullscreen } from './platform/device';
import { Hud, setupTouch } from './ui/hud';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const canvas = $<HTMLCanvasElement>('#game');
const input = new Input();
const sfx = new Sfx();
const hud = new Hud();
let game: Game | null = null;
/** partida CPU x CPU rodando atrás do menu, sem som */
let demo: Game | null = null;

function startDemo(): void {
  const ids = Object.keys(THEMES) as ThemeId[];
  const cpuTeams = teams().map((t) => ({ ...t, control: 'cpu' as const }));
  demo = new Game(
    { teams: cpuTeams, unitsPerTeam: 3, theme: THEMES[ids[Math.floor(Math.random() * ids.length)]], seed: (Math.random() * 2 ** 31) | 0, turnTime: 30 },
    'dificil',
    canvas,
    input,
    new Sfx(),
  );
  demo.match.on((e) => {
    if (e.type === 'gameOver') setTimeout(() => !game && startDemo(), 3000);
  });
}

const settings = {
  mode: 'cpu' as 'cpu' | 'pvp',
  difficulty: 'normal' as Difficulty,
  units: 3,
  theme: 'random' as ThemeId | 'random',
};

const NAMES_A = ['Bolota', 'Pipoca', 'Farofa', 'Paçoca'];
const NAMES_B = ['Jujuba', 'Torresmo', 'Biscoito', 'Quindim'];

function teams(): TeamSetup[] {
  return [
    { name: 'Laranjinhas', color: '#ff8a3d', light: '#ffc89a', dark: '#c4531a', control: 'human', names: NAMES_A },
    {
      name: settings.mode === 'cpu' ? 'Robolas' : 'Azulões',
      color: '#3d9bff',
      light: '#a6d4ff',
      dark: '#1d5fb8',
      control: settings.mode === 'cpu' ? 'cpu' : 'human',
      names: settings.mode === 'cpu' ? ['Robozão', 'Chip', 'Parafuso', 'Bit'] : NAMES_B,
    },
  ];
}

function show(id: string | null): void {
  for (const el of document.querySelectorAll<HTMLElement>('.screen')) el.classList.toggle('open', el.id === id);
}

function startGame(): void {
  sfx.unlock();
  const ids = Object.keys(THEMES) as ThemeId[];
  const themeId = settings.theme === 'random' ? ids[Math.floor(Math.random() * ids.length)] : settings.theme;
  launch(
    new Game(
      {
        teams: teams(),
        unitsPerTeam: settings.units,
        theme: THEMES[themeId],
        seed: (Math.random() * 2 ** 31) | 0,
        turnTime: 30,
      },
      settings.difficulty,
      canvas,
      input,
      sfx,
    ),
  );
}

/** Partida que acabou de terminar (para o replay). */
let finished: Game | null = null;

function startReplay(): void {
  if (!finished) return;
  launch(new Game(finished.setup, settings.difficulty, canvas, input, sfx, [...finished.log]), finished);
}

function launch(g: Game, original: Game = g): void {
  // no celular, jogar já entra em tela cheia deitada (precisa do clique do usuário, que temos aqui)
  if (isTouchDevice()) void enterFullscreen();
  game = g;
  demo = null;
  hud.bind(g);
  document.body.classList.toggle('replay', g.isReplay);
  g.match.on((e) => {
    if (e.type !== 'gameOver') return;
    setTimeout(() => {
      if (game !== g) return;
      finished = original;
      $('#over-title').textContent = e.winner ? `${e.winner.name} venceu!` : 'Empate!';
      $('#over-title').style.color = e.winner?.color ?? '#fff';
      const human = e.winner?.control === 'human';
      $('#over-sub').textContent = g.isReplay
        ? 'Fim do replay.'
        : settings.mode === 'cpu'
          ? human
            ? 'Você amassou os robôs! 🎉'
            : 'Os robôs levaram essa… revanche?'
          : 'Boa partida!';
      show('over');
    }, g.isReplay ? 1200 : 2200);
  });
  document.body.classList.add('playing');
  show(null);
}

function setPaused(p: boolean): void {
  if (!game || game.match.phase === 'over') return;
  game.paused = p;
  show(p ? 'pause' : null);
}

// ─── menu: grupos de opções ───
document.querySelectorAll<HTMLElement>('[data-opt]').forEach((group) => {
  const key = group.dataset.opt as keyof typeof settings;
  group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    if (String(settings[key]) === b.dataset.v) b.classList.add('on');
    b.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      const v = b.dataset.v!;
      (settings as Record<string, unknown>)[key] = key === 'units' ? Number(v) : v;
      $('#diff-row').style.display = settings.mode === 'cpu' ? '' : 'none';
      sfx.unlock();
      sfx.select();
    });
  });
});

$('#play').addEventListener('click', startGame);
$('#again').addEventListener('click', startGame);
$('#watch').addEventListener('click', startReplay);
$('#replay-speed').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!game?.isReplay) return;
  game.speed = game.speed >= 4 ? 1 : game.speed * 2;
  $('#replay-speed').textContent = `${game.speed}×`;
});
$('#replay-exit').addEventListener('click', (e) => {
  e.stopPropagation();
  game = null;
  show('over');
  document.body.classList.remove('playing', 'replay');
});
$('#resume').addEventListener('click', () => setPaused(false));
for (const sel of ['#quit', '#to-menu']) {
  $(sel).addEventListener('click', () => {
    game = null;
    document.body.classList.remove('playing');
    show('menu');
    startDemo();
  });
}
if (!canFullscreen()) $('#fullscreen').hidden = true;
$('#fullscreen').addEventListener('click', (e) => {
  e.stopPropagation();
  void toggleFullscreen();
});
$('#rotate-ok').addEventListener('click', () => document.body.classList.add('portrait-ok'));
$('#mute').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#mute').textContent = sfx.toggleMute() ? '🔇' : '🔊';
});
$('#pause-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  setPaused(true);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!game?.paused);
  if (e.code === 'KeyF' && game) void toggleFullscreen();
  if (e.code === 'KeyM') $('#mute').textContent = sfx.toggleMute() ? '🔇' : '🔊';
  if ((e.code === 'Enter' || e.code === 'Space') && !game && $('#menu').classList.contains('open')) startGame();
  if (e.code === 'Tab') e.preventDefault();
});

// ─── mouse / toque no mundo: clique mira, arrastar move a câmera ───
let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  game?.hover(e.clientX, e.clientY);
  if (!drag || drag.id !== e.pointerId || !game) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  game.cam.pan(dx, dy);
  drag.x = e.clientX;
  drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && game) game.clickAt(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!game) return;
    e.preventDefault();
    game.cam.userZoom = Math.max(0.6, Math.min(1.6, game.cam.userZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
  },
  { passive: false },
);

setupTouch(input, () => game?.cycleWeapon(1));

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  if (game) {
    game.frame(dt);
    hud.update(dt);
  } else {
    demo?.frame(dt);
    input.endFrame();
    input.takeKeys();
  }
  requestAnimationFrame(loop);
}

void document.fonts?.ready.then(() => undefined);

// PWA: só registra quando servido por http(s) — abrir o arquivo direto (file://) continua funcionando
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
show('menu');
startDemo();
requestAnimationFrame(loop);
