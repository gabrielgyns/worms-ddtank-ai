import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

type Db = Awaited<ReturnType<typeof freshDb>>;
async function friends(db: Db, a: string, b: string) {
  const code = (await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]))[0].friend_code;
  await as(db, a, 'select send_friend_request($1)', [code]);
  await as(db, b, `update friendships set status = 'accepted' where addressee = $1 and requester = $2`, [b, a]);
}
const play = async (db: Db, w: string, l: string, key: string) => {
  await as(db, w, `select report_match($1, 'online', 'neve', 0::smallint, 'win', 10, 0, 1, 1, 10)`, [key]);
  await as(db, l, `select report_match($1, 'online', 'neve', 1::smallint, 'loss', 10, 0, 1, 1, 10)`, [key]);
};

describe('migração: ranking', () => {
  it('ranking mostra só eu e meus amigos, ordenado por rating', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'Ana');
    const b = await newUser(db, 'Beto');
    const c = await newUser(db, 'Caio');
    const stranger = await newUser(db, 'Zé');
    await friends(db, a, b);
    await friends(db, a, c);
    await play(db, b, a, 'g1');
    await play(db, b, c, 'g2');
    await play(db, stranger, b, 'g3'); // não são amigos: não aparece para A
    const rows = await as<{ name: string; rating: number; wins: number }>(db, a, `select name, rating, wins from friends_leaderboard('all')`);
    // Caio perdeu para um Beto já mais forte: perde menos pontos que Ana
    expect(rows.map((r) => r.name)).toEqual(['Beto', 'Caio', 'Ana']);
    expect(rows.find((r) => r.name === 'Zé')).toBeUndefined();
    const week = await as<{ name: string; wins: number; games: number }>(db, a, `select name, wins, games from friends_leaderboard('week')`);
    expect(week[0]).toMatchObject({ name: 'Beto', wins: 2, games: 3 });
  });

  it('cara a cara do meu ponto de vista', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await friends(db, a, b);
    await play(db, a, b, 'h1');
    await play(db, a, b, 'h2');
    await play(db, b, a, 'h3');
    const [h] = await as<{ wins: number; losses: number; draws: number }>(db, a, 'select wins, losses, draws from head_to_head($1)', [b]);
    expect(h).toMatchObject({ wins: 2, losses: 1, draws: 0 });
    const c = await newUser(db);
    const [none] = await as<{ wins: number }>(db, c, 'select wins from head_to_head($1)', [a]);
    expect(none.wins).toBe(0);
  });
});

describe('migração: estatísticas', () => {
  it('soma a carreira de cada um do grupo', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'Ana');
    const b = await newUser(db, 'Beto');
    await friends(db, a, b);
    await play(db, a, b, 's1');
    await play(db, a, b, 's2');
    const rows = await as<{ name: string; games: number; wins: number; damage: number; shots: number; hits: number }>(
      db,
      b,
      'select name, games, wins, damage, shots, hits from friends_stats()',
    );
    expect(rows).toEqual([
      { name: 'Ana', games: 2, wins: 2, damage: 20, shots: 2, hits: 2 },
      { name: 'Beto', games: 2, wins: 0, damage: 20, shots: 2, hits: 2 },
    ]);
  });
});
