-- Bolotas em Guerra — contas, perfis, amigos e partidas.
-- Toda tabela tem RLS: o cliente só enxerga o que é seu (ou dos seus amigos).

-- ───────────────────────── perfis ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Jogador' check (char_length(name) between 1 and 14),
  team_name text not null default 'Bolotas' check (char_length(team_name) between 1 and 18),
  color smallint not null default 0 check (color between 0 and 5),
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

-- código de amigo tipo BOLOTA-K7Q2M (sem I, O, 0, 1 para não confundir)
create function public.new_friend_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'BOLOTA-';
    for i in 1..5 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end $$;

-- todo usuário novo (inclusive convidado) ganha um perfil
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, friend_code)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'name', 14), ''), 'Jogador'),
    public.new_friend_code()
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- perfil é público para quem está logado (nome, cor, código de amigo)
create policy "perfis visíveis para logados" on public.profiles
for select to authenticated using (true);

create policy "cada um edita o seu perfil" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- o código de amigo não pode ser trocado pelo cliente
revoke update on public.profiles from authenticated;
grant update (name, team_name, color) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

-- ───────────────────────── amigos ─────────────────────────
create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- um par só tem uma amizade, não importa quem pediu
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

create policy "vejo minhas amizades" on public.friendships
for select to authenticated using (auth.uid() in (requester, addressee));

create policy "só aceito pedido feito para mim" on public.friendships
for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');

create policy "qualquer um dos dois desfaz" on public.friendships
for delete to authenticated using (auth.uid() in (requester, addressee));

grant select, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;

-- pedir amizade pelo código (BOLOTA-XXXXX); se o outro já tinha pedido, vira amizade
create function public.send_friend_request(code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'precisa estar logado'; end if;
  select id into them from public.profiles where friend_code = upper(trim(code));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  select * into existing from public.friendships
  where least(requester, addressee) = least(me, them) and greatest(requester, addressee) = greatest(me, them);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.addressee = me then
      update public.friendships set status = 'accepted' where requester = them and addressee = me;
      return 'accepted';
    end if;
    return 'already_sent';
  end if;
  insert into public.friendships (requester, addressee) values (me, them);
  return 'sent';
end $$;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ───────────────────────── partidas ─────────────────────────
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  -- chave combinada pelos dois aparelhos (ex.: seed + sala), evita duplicar
  key text not null unique,
  mode text not null check (mode in ('online', 'mail')),
  theme text,
  created_at timestamptz not null default now()
);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team smallint not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  damage int not null default 0 check (damage >= 0),
  kills int not null default 0 check (kills >= 0),
  shots int not null default 0 check (shots >= 0),
  hits int not null default 0 check (hits >= 0),
  longest_shot int not null default 0 check (longest_shot >= 0),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.matches enable row level security;
alter table public.match_players enable row level security;

-- vejo minhas partidas e as dos meus amigos (para ranking e cara a cara)
create policy "partidas minhas e de amigos" on public.match_players
for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

create policy "partida visível a quem participou ou é amigo" on public.matches
for select to authenticated using (
  exists (
    select 1 from public.match_players mp
    where mp.match_id = id and (mp.user_id = auth.uid() or public.are_friends(mp.user_id, auth.uid()))
  )
);

grant select on public.matches, public.match_players to authenticated;

-- cada jogador relata o próprio resultado; escrita só por aqui
create function public.report_match(
  p_key text, p_mode text, p_theme text, p_team smallint, p_result text,
  p_damage int, p_kills int, p_shots int, p_hits int, p_longest int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then raise exception 'precisa estar logado'; end if;
  insert into public.matches (key, mode, theme) values (p_key, p_mode, p_theme)
  on conflict (key) do update set key = excluded.key
  returning id into mid;
  insert into public.match_players (match_id, user_id, team, result, damage, kills, shots, hits, longest_shot)
  values (mid, me, p_team, p_result, greatest(p_damage, 0), greatest(p_kills, 0), greatest(p_shots, 0), greatest(p_hits, 0), greatest(p_longest, 0))
  on conflict (match_id, user_id) do nothing;
  return mid;
end $$;

grant execute on function public.report_match(text, text, text, smallint, text, int, int, int, int, int) to authenticated;
