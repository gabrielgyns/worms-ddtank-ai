/**
 * Balanceamento por simulação: roda partidas CPU x CPU e mede as armas.
 * Uso: npm run balance  (escreve docs/balanceamento.md)
 *
 * A CPU usa a mesma física do jogo, então os números refletem o jogo de verdade.
 */
import { writeFileSync } from 'node:fs';
import { AiController } from '../src/domain/ai';
import { Match, type MatchSetup, type TeamSetup } from '../src/domain/match';
import { G, MapBuilder } from '../src/domain/missions';
import { THEMES } from '../src/domain/theme';
import { WEAPONS, type WeaponId } from '../src/domain/weapons';

const team = (name: string, extra: Partial<TeamSetup> = {}): TeamSetup => ({
  name,
  color: '#f80',
  light: '#fc8',
  dark: '#a40',
  control: 'cpu',
  names: ['A', 'B', 'C', 'D'],
  ...extra,
});

interface Run {
  winner: number | null;
  turns: number;
  shots: number[];
  damage: number[];
  hits: number[];
}

function play(setup: MatchSetup, maxMinutes = 25): Run {
  const m = new Match(setup);
  m.start();
  const ais = m.teams.map(() => new AiController('dificil'));
  const r: Run = { winner: null, turns: 0, shots: m.teams.map(() => 0), damage: m.teams.map(() => 0), hits: m.teams.map(() => 0) };
  let hitThisTurn = false;
  m.on((e) => {
    if (e.type === 'fire') r.shots[e.unit.team.id]++;
    if (e.type === 'damage' && e.by && e.by.team !== e.unit.team) {
      r.damage[e.by.team.id] += e.amount;
      if (!hitThisTurn) r.hits[e.by.team.id]++;
      hitThisTurn = true;
    }
    if (e.type === 'turnStart') {
      r.turns++;
      hitThisTurn = false;
    }
  });
  for (let t = 0; t < 60 * 60 * maxMinutes && m.phase !== 'over'; t++) {
    const tm = m.activeTeam;
    m.step(tm ? ais[tm.id].decide(m) : {});
  }
  r.winner = m.winner?.id ?? null;
  return r;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const lines: string[] = [];
const log = (s = '') => {
  lines.push(s);
  console.log(s);
};

// ── A) duelos com uma arma só ──
const GAMES = Number(process.env.GAMES ?? 10);
log('# Balanceamento');
log('');
log(`Gerado por \`npm run balance\` (${GAMES} partidas por linha, CPU difícil x CPU difícil, 2 bolotas por time).`);
log('');
log('## Armas básicas: duelo só com aquela arma');
log('');
log('| Arma | Dano por tiro | Acerto | Vezes até acabar |');
log('| --- | ---: | ---: | ---: |');
for (const id of ['bazooka', 'grenade', 'triple', 'cluster'] as WeaponId[]) {
  const runs: Run[] = [];
  for (let g = 0; g < GAMES; g++) {
    runs.push(
      play({
        teams: [team('A', { ammo: { [id]: 99 }, items: {} }), team('B', { ammo: { [id]: 99 }, items: {} })],
        unitsPerTeam: 2,
        theme: THEMES.prado,
        seed: 1000 + g,
        turnTime: 30,
        crates: false,
        objects: false,
        suddenDeath: 0,
      }),
    );
  }
  const shots = runs.reduce((n, r) => n + r.shots[0] + r.shots[1], 0);
  const dmg = runs.reduce((n, r) => n + r.damage[0] + r.damage[1], 0);
  const hits = runs.reduce((n, r) => n + r.hits[0] + r.hits[1], 0);
  log(`| ${WEAPONS.find((w) => w.id === id)!.name} | ${(dmg / shots).toFixed(1)} | ${pct(hits / shots)} | ${avg(runs.map((r) => r.turns)).toFixed(1)} |`);
}

// ── B) vantagem de quem começa ──
log('');
log('## Quem começa leva vantagem?');
log('');
const fair: Run[] = [];
for (let g = 0; g < GAMES * 2; g++) {
  fair.push(play({ teams: [team('A'), team('B')], unitsPerTeam: 3, theme: THEMES.prado, seed: 5000 + g, turnTime: 30 }));
}
const decided = fair.filter((r) => r.winner !== null);
log(`Partida normal (arsenal completo, itens, caixas): o time que começa venceu **${pct(decided.filter((r) => r.winner === 0).length / Math.max(1, decided.length))}** de ${decided.length} partidas decididas. Duração média: ${avg(fair.map((r) => r.turns)).toFixed(1)} vezes.`);

// ── C) armas especiais: dano máximo num alvo ──
log('');
log('## Armas especiais: dano num alvo (explosão bem no pé dele, média de 5 posições)');
log('');
log('| Arma | Dano | Observação |');
log('| --- | ---: | --- |');
function specialDamage(id: WeaponId): number {
  const w = WEAPONS.find((x) => x.id === id)!;
  const spec = w.projectile!;
  const out: number[] = [];
  for (let k = 0; k < 5; k++) {
    const m = new Match({
      teams: [team('A', { spawns: [{ x: 500 }] }), team('B', { spawns: [{ x: 1400, hp: 999 }] })],
      unitsPerTeam: 1,
      theme: THEMES.prado,
      seed: 7,
      turnTime: 30,
      crates: false,
      objects: false,
      wind: 0,
      map: new MapBuilder().ground(200, 2600, G).encode(),
    });
    m.start();
    while (m.phase !== 'turn') m.step({});
    const target = m.teams[1].units[0];
    const p = m.makeProjectile(target.cx + (k - 2) * 6, target.y - 4, 0, 0, spec, m.active!.id);
    p.fuse = 0.001;
    m.projectiles.push(p);
    for (let i = 0; i < 60 * 6 && m.projectiles.length; i++) m.step({});
    out.push(999 - Math.max(0, target.hp));
  }
  return avg(out);
}
const notes: Partial<Record<WeaponId, string>> = {
  dynamite: 'solta aos pés; precisa chegar perto',
  airstrike: 'um míssil do ataque (são 5 espalhados)',
  sheep: 'anda até o alvo; dá para desviar',
  banana: 'explosão + 5 bananas; quase sempre várias acertam',
  homing: 'precisa marcar o alvo',
};
for (const id of ['dynamite', 'airstrike', 'sheep', 'banana', 'homing'] as WeaponId[]) {
  log(`| ${WEAPONS.find((w) => w.id === id)!.name} | ${specialDamage(id).toFixed(0)} | ${notes[id] ?? ''} |`);
}

log('');
log('Referência: bolota tem 100 de vida. Uma arma especial (1 por partida) que mata de uma vez sem esforço desequilibra.');
writeFileSync(new URL('../docs/balanceamento.md', import.meta.url), lines.join('\n') + '\n');
