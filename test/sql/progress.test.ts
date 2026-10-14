import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

describe('migração: progresso', () => {
  it('cada um lê e escreve só o próprio progresso', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await as(db, a, `insert into progress (user_id, coins, unlocked) values ($1, 120, '{"primeiro-bum": 1}')`, [a]);
    await expect(as(db, b, `insert into progress (user_id, coins) values ($1, 999)`, [a])).rejects.toThrow();
    expect(await as(db, b, 'select * from progress')).toHaveLength(0);
    await as(db, b, `update progress set coins = 0 where user_id = $1`, [a]);
    const [row] = await as<{ coins: number }>(db, a, 'select coins from progress where user_id = $1', [a]);
    expect(row.coins).toBe(120);
    await expect(as(db, a, `update progress set coins = -5 where user_id = $1`, [a])).rejects.toThrow();
  });

  it('conquistas de amigo só aparecem para amigos', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await as(db, b, `insert into progress (user_id, unlocked) values ($1, '{"strike": 5}')`, [b]);
    const [r1] = await as<{ friend_achievements: unknown }>(db, a, 'select friend_achievements($1)', [b]);
    expect(r1.friend_achievements).toBeNull();
    const code = (await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]))[0].friend_code;
    await as(db, a, 'select send_friend_request($1)', [code]);
    await as(db, b, `update friendships set status = 'accepted' where addressee = $1`, [b]);
    const [r2] = await as<{ friend_achievements: Record<string, number> }>(db, a, 'select friend_achievements($1)', [b]);
    expect(r2.friend_achievements).toEqual({ strike: 5 });
  });
});
