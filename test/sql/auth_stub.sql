-- Simula o mínimo do Supabase para testar as migrações no PGlite.
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}',
  is_anonymous boolean not null default false
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role authenticated nologin;
create role anon nologin;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
