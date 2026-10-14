import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

describe('migração: desafio diário', () => {
  it('guarda a melhor pontuação, conta tentativas e recusa outros dias', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'Ana');
    const b = await newUser(db, 'Beto');
    const [{ submit_daily: s1 }] = await as<{ submit_daily: number }>(db, a, 'select submit_daily(current_date, 300, false)');
    expect(s1).toBe(300);
    const [{ submit_daily: s2 }] = await as<{ submit_daily: number }>(db, a, 'select submit_daily(current_date, 200, true)');
    expect(s2).toBe(300);
    await as(db, a, 'select submit_daily(current_date, 450, true)');
    await expect(as(db, a, `select submit_daily(current_date - 5, 999, true)`)).rejects.toThrow();
    const [mine] = await as<{ score: number; won: boolean; attempts: number }>(db, a, 'select score, won, attempts from daily_scores');
    expect(mine).toMatchObject({ score: 450, won: true, attempts: 3 });
    // Beto não é amigo: não vê
    await as(db, b, 'select submit_daily(current_date, 100, false)');
    expect(await as(db, b, 'select * from daily_board(current_date)')).toHaveLength(1);
    const code = (await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]))[0].friend_code;
    await as(db, a, 'select send_friend_request($1)', [code]);
    await as(db, b, `update friendships set status = 'accepted' where addressee = $1`, [b]);
    const board = await as<{ name: string; score: number }>(db, b, 'select name, score from daily_board(current_date)');
    expect(board).toEqual([
      { name: 'Ana', score: 450 },
      { name: 'Beto', score: 100 },
    ]);
  });
});
