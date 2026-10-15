import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

// cada teste sobe um Postgres inteiro com todas as migrações (~2–5 s);
// com a máquina ocupada pelos outros testes isso passava do limite padrão de 5 s
vi.setConfig({ testTimeout: 30_000 });

const root = join(import.meta.dirname, '..', '..');

/** Postgres em memória com o stub de auth e todas as migrações aplicadas. */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'test/sql/auth_stub.sql'), 'utf8'));
  const dir = join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  return db;
}

let n = 0;
export async function newUser(db: PGlite, name = 'Jogador'): Promise<string> {
  n++;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await db.query('reset role');
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, JSON.stringify({ name })]);
  return id;
}

/** Executa como um usuário logado (RLS valendo). */
export async function as<T>(db: PGlite, user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  await db.query('set role authenticated');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.query('reset role');
  }
}
