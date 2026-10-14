import './style.css';
import { Sfx } from './core/audio';
import { Input } from './core/input';
import type { Difficulty } from './domain/ai';
import type { TeamSetup } from './domain/match';
import { THEMES, type ThemeId } from './domain/theme';
import { Game } from './game';
import { applyProfile, canFullscreen, deviceProfile, enterFullscreen, isTouchDevice, toggleFullscreen } from './platform/device';
import { Hud, setupTouch } from './ui/hud';
import { OnlineUi } from './ui/online';
import { Lobby } from './ui/lobby';
import { AccountUi } from './ui/account';
import { FriendsUi } from './ui/friends';
import { getBackend } from './services';
import { EMOTES, emoteText } from './domain/emotes';
import { ABANDON_AFTER, fromWire, NetSession, toWire } from './net/session';
import { decodeLetter, encodeLetter, letterFromUrl, letterLink, MailDriver, type Letter } from './net/mail';
import { TEAM_COLORS } from './domain/teamColors';
import { savedName } from './ui/lobby';
import type { Room } from './net/room';
import type { MatchSetup } from './domain/match';

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
    { difficulty: 'dificil' },
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
  if (id === 'menu') getBackend().presence.setStatus('online');
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
      { difficulty: settings.difficulty },
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
  launch(new Game(finished.setup, { difficulty: settings.difficulty, replay: [...finished.log] }, canvas, input, sfx), finished);
}

function launch(g: Game, original: Game = g): void {
  getBackend().presence.setStatus(g.isReplay ? 'online' : 'playing');
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
      // partida por link que acabou na minha jogada: primeiro mandar o link
      if (g === mailGame && mailPending) {
        show('mail');
        return;
      }
      $('#over-title').textContent = e.winner ? `${e.winner.name} venceu!` : 'Empate!';
      $('#over-title').style.color = e.winner?.color ?? '#fff';
      const human = e.winner?.control === 'human';
      const onlineGame = g.online && session !== null;
      $('#again').textContent = onlineGame && session!.role === 'guest' ? 'Esperando revanche…' : 'Revanche!';
      ($('#again') as HTMLButtonElement).disabled = onlineGame && session!.role === 'guest';
      const localWin = e.winner ? g.isLocal(e.winner.id) : false;
      $('#over-sub').textContent = g.isReplay
        ? 'Fim do replay.'
        : onlineGame
          ? localWin
            ? 'Você venceu! 🎉'
            : 'Não foi dessa vez… revanche?'
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

// ─── online ───
let session: NetSession | null = null;
let lobby: Lobby | null = null;

function onRoom(room: Room): void {
  session = new NetSession(room);
  lobby = new Lobby(session, $('#lobby-body'), hostStart);
  room.link.on('emote', (m) => {
    const text = emoteText(m.id);
    if (text && session?.game) session.game.fx.say(m.team, text);
  });
  room.link.on('start', (m) => {
    // reconexão: a partida já está aberta, só falta o estado (vem no resync)
    if (m.rejoin && session?.game && session.game.setup.seed === m.setup.seed && game === session.game) return;
    startOnline(fromWire(m.setup));
  });
}

function hostStart(): void {
  if (!session || session.role !== 'host' || !lobby) return;
  const setup: MatchSetup = {
    teams: lobby.teams(),
    unitsPerTeam: lobby.state.units,
    theme: THEMES[lobby.themeId()],
    seed: (Math.random() * 2 ** 31) | 0,
    turnTime: 30,
  };
  session.room.link.send({ t: 'start', setup: toWire(setup), guestTeam: 1 });
  startOnline(setup);
}

function startOnline(setup: MatchSetup): void {
  if (!session) return;
  sfx.unlock();
  session.reset();
  if (session.role === 'host') session.guestTeam = 1;
  const g = new Game(
    setup,
    { difficulty: 'normal', localTeams: [session.role === 'host' ? 0 : 1], driver: session.driver() },
    canvas,
    input,
    sfx,
  );
  session.game = g;
  session.onResync = () => hud.show('Sincronizado de novo ✔', '#5aa86a', 1.2);
  launch(g);
}

/** Mostra "esperando oponente" e encerra por abandono depois de ABANDON_AFTER. */
function netWatch(): void {
  const warn = $('#net-warn');
  if (!game?.online || !session || game !== session.game || game.match.phase === 'over') {
    warn.hidden = true;
    return;
  }
  const lost = session.room.link.lostFor;
  warn.hidden = lost < 1.5;
  if (!warn.hidden) {
    const left = Math.max(0, Math.ceil(ABANDON_AFTER - lost));
    warn.textContent = `Conexão perdida… esperando o outro jogador (${left}s)`;
  }
  // o convidado não recebe mais o relógio do host: encerra localmente
  if (session.role === 'guest' && session.abandoned) game.match.forfeit(0);
}

// ─── partida por link (correspondência) ───
let mailOpponent = 'Convidado';
/** partida atual é por link? e há um link esperando para ser enviado? */
let mailGame: Game | null = null;
let mailPending = false;

function newMailSetup(myName: string, opponent: string): MatchSetup {
  const ids = Object.keys(THEMES) as ThemeId[];
  const [a, b] = [TEAM_COLORS[0], TEAM_COLORS[1]];
  return {
    teams: [
      { name: myName, color: a.color, light: a.light, dark: a.dark, control: 'human', names: NAMES_A },
      { name: opponent, color: b.color, light: b.light, dark: b.dark, control: 'human', names: NAMES_B },
    ],
    unitsPerTeam: 3,
    theme: THEMES[ids[Math.floor(Math.random() * ids.length)]],
    seed: (Math.random() * 2 ** 31) | 0,
    turnTime: 45,
  };
}

function startMail(letter: Letter | null, opponent = mailOpponent): void {
  sfx.unlock();
  const setup = letter ? fromWire(letter.setup) : newMailSetup(savedName(), opponent);
  const myTeam = letter ? letter.to : 0;
  const wire = toWire(setup);
  const driver = new MailDriver(letter, myTeam, (l) => void handoff(l, setup), wire);
  const g = new Game(setup, { difficulty: 'normal', localTeams: [myTeam], driver }, canvas, input, sfx);
  if (letter?.snap) g.match.restore(letter.snap);
  mailOpponent = setup.teams[1 - myTeam].name;
  mailGame = g;
  mailPending = false;
  launch(g);
  if (letter) hud.show(`Jogada de ${setup.teams[1 - myTeam].name}`, setup.teams[1 - myTeam].color, 2);
}

async function handoff(l: Letter, setup: MatchSetup): Promise<void> {
  const link = letterLink(await encodeLetter(l));
  const ended = game?.match.phase === 'over';
  try {
    localStorage.setItem('bolotas-last-letter', link);
  } catch {
    // sem storage
  }
  const other = setup.teams[l.to].name;
  $('#mail h2').textContent = ended ? 'Fim de jogo!' : 'Sua vez foi!';
  $('#mail-text').textContent = ended
    ? `Mande este link para ${other} ver como acabou.`
    : `Mande este link para ${other}. Quando ${other} jogar, vai te mandar um link de volta.`;
  ($('#mail-link') as HTMLInputElement).value = link;
  $('#mail-share').hidden = !('share' in navigator);
  mailPending = true;
  if (!ended) show('mail');
}

async function openLetterFromUrl(): Promise<boolean> {
  const code = letterFromUrl();
  if (!code) return false;
  history.replaceState(null, '', location.pathname + location.search);
  const letter = await decodeLetter(code);
  if (!letter) {
    show('menu');
    hud.show('Link inválido ou de outra versão do jogo', '#c33', 3);
    return true;
  }
  startMail(letter);
  return true;
}

function leaveOnline(): void {
  online.leave(false);
  session = null;
  lobby = null;
}

function setPaused(p: boolean): void {
  if (!game || game.match.phase === 'over') return;
  if (game.online) {
    // partida em rede não para: só mostra/esconde o menu
    show(p ? 'pause' : null);
    return;
  }
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
$('#again').addEventListener('click', () => {
  if (session) hostStart();
  else if (game && game === mailGame) startMail(null);
  else startGame();
});
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
    if (session) leaveOnline();
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
// ─── frases rápidas ───
let lastEmote = 0;
function myTeamId(): number | null {
  if (!game || game.isReplay) return null;
  if (game.online) return session?.role === 'host' ? 0 : 1;
  const team = game.match.activeTeam;
  return team && game.isLocal(team.id) ? team.id : game.match.teams.find((t) => game!.isLocal(t.id))?.id ?? null;
}
function sendEmote(id: string): void {
  const team = myTeamId();
  const text = emoteText(id);
  if (team === null || !text || !game || performance.now() - lastEmote < 1200) return;
  lastEmote = performance.now();
  game.fx.say(team, text);
  if (game.online) session?.room.link.send({ t: 'emote', id, team });
  $('#emotes').hidden = true;
}
for (const e of EMOTES) {
  const b = document.createElement('button');
  b.textContent = e.text;
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    sendEmote(e.id);
  });
  $('#emotes').append(b);
}
$('#emote-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#emotes').hidden = !$('#emotes').hidden;
});

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
  if (e.code === 'KeyT' && game) $('#emotes').hidden = !$('#emotes').hidden;
  if (e.code === 'KeyM') $('#mute').textContent = sfx.toggleMute() ? '🔇' : '🔊';
  if ((e.code === 'Enter' || e.code === 'Space') && !game && $('#menu').classList.contains('open')) startGame();
  if (e.code === 'Escape' && !game && !$('#menu').classList.contains('open')) online.leave();
  if (e.code === 'Tab') e.preventDefault();
});

// ─── mouse / toque no mundo: clique mira, arrastar move a câmera ───
let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
let aimPointer: number | null = null;
/** dedos na tela, para pinça e arrastar com dois dedos */
const touches = new Map<number, { x: number; y: number }>();
let pinch: { dist: number; mx: number; my: number } | null = null;

function pinchState(): { dist: number; mx: number; my: number } {
  const [a, b] = [...touches.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

function setZoom(z: number): void {
  if (game) game.cam.userZoom = Math.max(0.6, Math.min(1.8, z));
}
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  canvas.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && aimPointer === null) {
    drag = null;
    pinch = pinchState();
    return;
  }
  if (touches.size > 1) return;
  if (game?.beginAim(e.clientX, e.clientY)) {
    aimPointer = e.pointerId;
    return;
  }
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
});
canvas.addEventListener('pointermove', (e) => {
  game?.hover(e.clientX, e.clientY);
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2 && game) {
    const now = pinchState();
    if (pinch.dist > 0) setZoom(game.cam.userZoom * (now.dist / pinch.dist));
    game.cam.fit(canvas.clientWidth, canvas.clientHeight);
    game.cam.pan(now.mx - pinch.mx, now.my - pinch.my);
    pinch = now;
    return;
  }
  if (aimPointer === e.pointerId) {
    game?.moveAim(e.clientX, e.clientY);
    return;
  }
  if (!drag || drag.id !== e.pointerId || !game) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  game.cam.pan(dx, dy);
  drag.x = e.clientX;
  drag.y = e.clientY;
});
function releasePointer(id: number): void {
  touches.delete(id);
  if (touches.size < 2) pinch = null;
}
canvas.addEventListener('pointercancel', (e) => {
  releasePointer(e.pointerId);
  aimPointer = null;
  drag = null;
});
canvas.addEventListener('pointerup', (e) => {
  const wasPinch = pinch !== null || touches.size > 1;
  releasePointer(e.pointerId);
  if (wasPinch) {
    drag = null;
    return;
  }
  if (aimPointer === e.pointerId) {
    aimPointer = null;
    game?.endAim();
    return;
  }
  if (drag && !drag.moved && game) game.clickAt(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!game) return;
    e.preventDefault();
    setZoom(game.cam.userZoom * (e.deltaY > 0 ? 0.9 : 1.1));
  },
  { passive: false },
);

setupTouch(input, () => game?.cycleWeapon(1));
applyProfile(deviceProfile());
window.addEventListener('resize', () => applyProfile(deviceProfile()));
// aba em segundo plano: pausa a partida local para não perder a vez sem ver
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && !game.online && !game.isReplay && game.match.phase !== 'over') setPaused(true);
});

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  if (game) {
    game.frame(dt);
    hud.update(dt);
    netWatch();
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
const online = new OnlineUi({ show, onRoom });
const account = new AccountUi(show);
const friends = new FriendsUi(show, () => account.open());

// ─── presença e convites ───
const backend = getBackend();
friends.onAction = (act, f) => {
  if (act !== 'invite') return;
  const code = online.room?.role === 'host' ? online.room.code : online.create();
  void backend.presence.invite(f.id, code).then((r) => {
    if (!r.ok) hud.show(r.error, '#c33', 2.5);
  });
};
backend.presence.onInvite((inv) => {
  const t = $('#toast');
  t.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = `${inv.fromName} te chamou para jogar!`;
  const yes = document.createElement('button');
  yes.textContent = 'Entrar';
  const no = document.createElement('button');
  no.textContent = 'Agora não';
  no.className = 'no';
  t.append(text, yes, no);
  t.hidden = false;
  const close = () => (t.hidden = true);
  yes.addEventListener('click', () => {
    close();
    if (game && !game.isReplay) return;
    online.join(inv.room);
  });
  no.addEventListener('click', close);
  setTimeout(close, 20000);
});
document.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => b.addEventListener('click', () => show('menu')));
show('menu');
startDemo();
void openLetterFromUrl().then((opened) => opened || friends.fromUrl() || online.autoJoin());
$('#mail-create').addEventListener('click', () => {
  const name = ($('#mail-opponent') as HTMLInputElement).value.trim().slice(0, 14);
  startMail(null, name || 'Convidado');
});
$('#mail-opponent').addEventListener('keydown', (e) => e.stopPropagation());
$('#mail-copy').addEventListener('click', async () => {
  const el = $('#mail-link') as HTMLInputElement;
  try {
    await navigator.clipboard.writeText(el.value);
    $('#mail-copy').textContent = 'Copiado!';
    setTimeout(() => ($('#mail-copy').textContent = 'Copiar'), 1500);
  } catch {
    el.select();
  }
});
$('#mail-share').addEventListener('click', () => {
  const url = ($('#mail-link') as HTMLInputElement).value;
  void navigator.share?.({ title: 'Bolotas em Guerra', text: 'Sua vez! 💣', url }).catch(() => undefined);
});
$('#mail-menu').addEventListener('click', () => {
  game = null;
  document.body.classList.remove('playing');
  show('menu');
  startDemo();
});
requestAnimationFrame(loop);

// gancho para testes automatizados e depuração no console
declare global {
  interface Window {
    __bolotas?: { game: Game | null; session: NetSession | null };
  }
}
Object.defineProperty(window, '__bolotas', { get: () => ({ game, session }) });
