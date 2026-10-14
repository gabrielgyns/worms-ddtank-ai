-- Progresso do jogador (moedas, conquistas, itens, visual).
-- Espelho do que o jogo guarda no aparelho; cada um só lê e escreve o seu.

create table public.progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  coins int not null default 0 check (coins >= 0 and coins <= 10000000),
  unlocked jsonb not null default '{}'::jsonb,
  owned jsonb not null default '[]'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

alter table public.progress enable row level security;

create policy "meu progresso: ler" on public.progress
for select to authenticated using (user_id = auth.uid());

create policy "meu progresso: criar" on public.progress
for insert to authenticated with check (user_id = auth.uid());

create policy "meu progresso: atualizar" on public.progress
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.progress to authenticated;

-- conquistas de amigos são públicas entre amigos (para comparar)
create function public.friend_achievements(friend uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.are_friends(friend, auth.uid()) then (select unlocked from public.progress where user_id = friend) end;
$$;
grant execute on function public.friend_achievements(uuid) to authenticated;
