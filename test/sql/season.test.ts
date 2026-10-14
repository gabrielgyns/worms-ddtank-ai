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

describe('migração: temporadas', () => {
  it('campeão do mês passado resgata uma vez; os outros não', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'Ana');
    const b = await newUser(db, 'Beto');
    await friends(db, a, b);
    for (let i = 0; i < 3; i++) await play(db, a, b, `s${i}`);
    await play(db, b, a, 's3');
    // joga as partidas para o mês passado
    await db.query(`update match_players set created_at = date_trunc('month', now()) - interval '3 days'`);
    const [{ m }] = (await db.query<{ m: string }>(`select to_char(date_trunc('month', now()) - interval '3 days', 'YYYY-MM') as m`)).rows;
    const board = await as<{ name: string; wins: number }>(db, a, 'select name, wins from season_board($1)', [m]);
    expect(board.map((r) => [r.name, r.wins])).toEqual([
      ['Ana', 3],
      ['Beto', 1],
    ]);
    const claim = async (u: string, month: string) => (await as<{ claim_season_reward: boolean }>(db, u, 'select claim_season_reward($1)', [month]))[0].claim_season_reward;
    expect(await claim(b, m)).toBe(false);
    expect(await claim(a, m)).toBe(true);
    expect(await claim(a, m)).toBe(false);
    // mês em andamento não pode ser resgatado
    const [{ now }] = (await db.query<{ now: string }>(`select to_char(now(), 'YYYY-MM') as now`)).rows;
    expect(await claim(a, now)).toBe(false);
  });

  it('sozinho não é campeão', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    for (let i = 0; i < 3; i++) await play(db, a, b, `x${i}`);
    await db.query(`update match_players set created_at = date_trunc('month', now()) - interval '3 days'`);
    const [{ m }] = (await db.query<{ m: string }>(`select to_char(date_trunc('month', now()) - interval '3 days', 'YYYY-MM') as m`)).rows;
    // sem amigos: o grupo só tem ele mesmo
    const [r] = await as<{ claim_season_reward: boolean }>(db, a, 'select claim_season_reward($1)', [m]);
    expect(r.claim_season_reward).toBe(false);
  });
});
