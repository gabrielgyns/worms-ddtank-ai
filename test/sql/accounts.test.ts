import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

describe('migração: contas e amigos', () => {
  it('cria perfil com código de amigo para cada usuário novo', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'Gabriel');
    const [p] = await as<{ name: string; friend_code: string }>(db, a, 'select name, friend_code from profiles where id = $1', [a]);
    expect(p.name).toBe('Gabriel');
    expect(p.friend_code).toMatch(/^BOLOTA-[A-HJ-NP-Z2-9]{5}$/);
  });

  it('não deixa mudar o código de amigo nem o perfil dos outros', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    await expect(as(db, a, `update profiles set friend_code = 'BOLOTA-AAAAA' where id = $1`, [a])).rejects.toThrow();
    await as(db, a, `update profiles set name = 'Hacker' where id = $1`, [b]);
    const [pb] = await as<{ name: string }>(db, b, 'select name from profiles where id = $1', [b]);
    expect(pb.name).toBe('Jogador');
    await as(db, a, `update profiles set name = 'Novo' where id = $1`, [a]);
    const [pa] = await as<{ name: string }>(db, a, 'select name from profiles where id = $1', [a]);
    expect(pa.name).toBe('Novo');
  });

  it('pedido de amizade pelo código, aceite e visibilidade', async () => {
    const db = await freshDb();
    const a = await newUser(db, 'A');
    const b = await newUser(db, 'B');
    const c = await newUser(db, 'C');
    const [{ friend_code: codeB }] = await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]);
    const [r1] = await as<{ send_friend_request: string }>(db, a, 'select send_friend_request($1)', [codeB.toLowerCase()]);
    expect(r1.send_friend_request).toBe('sent');
    const [r2] = await as<{ send_friend_request: string }>(db, a, 'select send_friend_request($1)', [codeB]);
    expect(r2.send_friend_request).toBe('already_sent');
    // C não vê a amizade de A e B
    expect(await as(db, c, 'select * from friendships')).toHaveLength(0);
    // A não pode aceitar o próprio pedido
    await as(db, a, `update friendships set status = 'accepted' where requester = $1`, [a]);
    expect((await as<{ status: string }>(db, a, 'select status from friendships'))[0].status).toBe('pending');
    // B aceita
    await as(db, b, `update friendships set status = 'accepted' where requester = $1 and addressee = $2`, [a, b]);
    const [f] = await as<{ are_friends: boolean }>(db, a, 'select are_friends($1, $2)', [a, b]);
    expect(f.are_friends).toBe(true);
    const [{ friend_code: codeA }] = await as<{ friend_code: string }>(db, a, 'select friend_code from profiles where id = $1', [a]);
    const [r3] = await as<{ send_friend_request: string }>(db, b, 'select send_friend_request($1)', [codeA]);
    expect(r3.send_friend_request).toBe('already_friends');
    const [r4] = await as<{ send_friend_request: string }>(db, a, 'select send_friend_request($1)', ['BOLOTA-ZZZZZ']);
    expect(r4.send_friend_request).toBe('not_found');
  });

  it('pedido cruzado vira amizade automaticamente', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    const code = async (u: string) => (await as<{ friend_code: string }>(db, u, 'select friend_code from profiles where id = $1', [u]))[0].friend_code;
    await as(db, a, 'select send_friend_request($1)', [await code(b)]);
    const [r] = await as<{ send_friend_request: string }>(db, b, 'select send_friend_request($1)', [await code(a)]);
    expect(r.send_friend_request).toBe('accepted');
  });

  it('partidas: cada um relata o seu; amigos veem, estranhos não', async () => {
    const db = await freshDb();
    const a = await newUser(db);
    const b = await newUser(db);
    const c = await newUser(db);
    const report = (u: string, team: number, result: string) =>
      as(db, u, 'select report_match($1, $2, $3, $4::smallint, $5, 100, 1, 5, 3, 900)', ['seed1-ABCD', 'online', 'neve', team, result]);
    await report(a, 0, 'win');
    await report(b, 1, 'loss');
    await report(b, 1, 'win'); // segundo relato é ignorado
    expect(await as(db, a, 'select * from match_players')).toHaveLength(1);
    expect(await as(db, c, 'select * from match_players')).toHaveLength(0);
    // vira amigo de B: passa a ver as partidas dele
    const code = (await as<{ friend_code: string }>(db, b, 'select friend_code from profiles where id = $1', [b]))[0].friend_code;
    await as(db, a, 'select send_friend_request($1)', [code]);
    await as(db, b, `update friendships set status = 'accepted' where addressee = $1`, [b]);
    const rows = await as<{ result: string }>(db, a, 'select result from match_players order by result');
    expect(rows.map((r) => r.result)).toEqual(['loss', 'win']);
    expect(await as(db, a, 'select * from matches')).toHaveLength(1);
  });
});

describe('migração: perfis que faltaram', () => {
  it('cria perfil para conta feita antes das migrações', async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(import.meta.dirname, '..', '..');
    const db = new PGlite();
    await db.exec(readFileSync(join(root, 'test/sql/auth_stub.sql'), 'utf8'));
    const early = '00000000-0000-4000-8000-0000000000ee';
    await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"name":"Pioneiro"}')`, [early]);
    const dir = join(root, 'supabase/migrations');
    for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
    const [p] = await as<{ name: string }>(db, early, 'select name from profiles where id = $1', [early]);
    expect(p.name).toBe('Pioneiro');
    // e agora consegue salvar progresso
    await as(db, early, `insert into progress (user_id, coins) values ($1, 484)`, [early]);
    // rodar de novo não duplica nada
    expect((await db.query<{ n: number }>('select public.backfill_profiles() as n')).rows[0].n).toBe(0);
  });
});
