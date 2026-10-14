import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

async function friends(db: Awaited<ReturnType<typeof freshDb>>, a: string, b: string) {
  const code = (await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]))[0].friend_code;
  await as(db, a, 'select send_friend_request($1)', [code]);
  await as(db, b, `update friendships set status = 'accepted' where addressee = $1`, [b]);
}

const report = (db: Awaited<ReturnType<typeof freshDb>>, u: string, key: string, team: number, result: string, mode = 'online') =>
  as(db, u, 'select report_match($1, $2, $3, $4::smallint, $5, 50, 0, 3, 1, 400)', [key, mode, 'prado', team, result]);

const rating = async (db: Awaited<ReturnType<typeof freshDb>>, viewer: string, u: string) =>
  (await as<{ rating: number; games: number; wins: number }>(db, viewer, 'select rating, games, wins from ratings where user_id = $1', [u]))[0];

describe('migração: rating Elo', () => {
  it('só aplica depois dos dois relatos e com resultados que batem', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await friends(db, a, b);
    await report(db, a, 'k1', 0, 'win');
    expect(await rating(db, a, a)).toBeUndefined();
    await report(db, b, 'k1', 1, 'loss');
    expect(await rating(db, a, a)).toEqual({ rating: 1016, games: 1, wins: 1 });
    expect(await rating(db, a, b)).toEqual({ rating: 984, games: 1, wins: 0 });
  });

  it('favorito ganha menos, zebra ganha mais', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await friends(db, a, b);
    for (let i = 0; i < 3; i++) {
      await report(db, a, `w${i}`, 0, 'win');
      await report(db, b, `w${i}`, 1, 'loss');
    }
    const before = (await rating(db, a, b)).rating;
    await report(db, a, 'zebra', 0, 'loss');
    await report(db, b, 'zebra', 1, 'win');
    expect((await rating(db, a, b)).rating - before).toBeGreaterThan(16);
  });

  it('relatos contraditórios não mexem no rating', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await report(db, a, 'x', 0, 'win');
    await report(db, b, 'x', 1, 'win');
    expect(await rating(db, a, a)).toBeUndefined();
  });

  it('partida por link não vale rating; estranho não vê o rating', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    const c = await newUser(db);
    await report(db, a, 'm', 0, 'win', 'mail');
    await report(db, b, 'm', 1, 'loss', 'mail');
    expect(await rating(db, a, a)).toBeUndefined();
    await report(db, a, 'o', 0, 'win');
    await report(db, b, 'o', 1, 'loss');
    expect(await rating(db, c, a)).toBeUndefined();
    expect(await rating(db, a, a)).toBeDefined();
  });

  it('cliente não consegue chamar rate_match direto', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    await expect(as(db, a, `select rate_match('00000000-0000-4000-8000-000000000000')`)).rejects.toThrow();
  });
});
