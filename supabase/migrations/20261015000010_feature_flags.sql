-- Feature flags: ligar/desligar partes do jogo para todo mundo, sem publicar código.
-- Todo mundo lê; só quem está em `admins` muda, e só pela função set_flag.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- ninguém lê nem escreve pelo cliente: o dono se cadastra pelo SQL Editor
-- insert into public.admins (user_id) values ('<seu user id>');

create table public.feature_flags (
  key text primary key check (char_length(key) between 1 and 64),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.feature_flags enable row level security;

create policy "flags visíveis para todos" on public.feature_flags
for select to anon, authenticated using (true);
grant select on public.feature_flags to anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

create function public.set_flag(flag text, on_ boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'só admin muda feature flag';
  end if;
  insert into public.feature_flags (key, enabled, updated_at, updated_by)
  values (flag, on_, now(), auth.uid())
  on conflict (key) do update set enabled = excluded.enabled, updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke execute on function public.set_flag(text, boolean) from public, anon;
grant execute on function public.set_flag(text, boolean) to authenticated;
