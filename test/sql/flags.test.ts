import { describe, expect, it } from 'vitest';
import { as, freshDb, newUser } from './db';

describe('migração: feature flags', () => {
  it('só admin muda; todo mundo lê', async () => {
    const db = await freshDb();
    const dono = await newUser(db, 'Dono');
    const outro = await newUser(db, 'Outro');
    await db.query('insert into public.admins (user_id) values ($1)', [dono]);

    expect((await as<{ is_admin: boolean }>(db, dono, 'select public.is_admin()'))[0].is_admin).toBe(true);
    expect((await as<{ is_admin: boolean }>(db, outro, 'select public.is_admin()'))[0].is_admin).toBe(false);

    await as(db, dono, `select public.set_flag('weapon:banana', false)`);
    await expect(as(db, outro, `select public.set_flag('weapon:banana', true)`)).rejects.toThrow();
    // nem escrevendo direto na tabela
    await expect(as(db, outro, `insert into feature_flags (key, enabled) values ('mode:boss', false)`)).rejects.toThrow();
    await expect(as(db, outro, `update feature_flags set enabled = true`)).rejects.toThrow();

    const rows = await as<{ key: string; enabled: boolean }>(db, outro, 'select key, enabled from feature_flags');
    expect(rows).toEqual([{ key: 'weapon:banana', enabled: false }]);
    // e a lista de admins não vaza (RLS devolve vazio ou nem há permissão)
    const leaked = await as(db, outro, 'select * from admins').catch(() => []);
    expect(leaked).toHaveLength(0);
  });
});
