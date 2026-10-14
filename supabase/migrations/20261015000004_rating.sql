-- Rating entre jogadores (Elo, K=32). Só conta partida online com os DOIS relatos
-- concordando (um venceu e o outro perdeu, ou empate para os dois).

create table public.ratings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rating int not null default 1000,
  games int not null default 0,
  wins int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ratings enable row level security;
create policy "rating: meu e de amigos" on public.ratings
for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
grant select on public.ratings to authenticated;

alter table public.matches add column rated boolean not null default false;
alter table public.matches add column disputed boolean not null default false;
alter table public.match_players add column rating_delta int;

-- aplica o Elo quando os dois lados relataram
create function public.rate_match(mid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  a public.match_players;
  b public.match_players;
  ra int;
  rb int;
  ea float8;
  sa float8;
  da int;
begin
  select * into m from public.matches where id = mid for update;
  if m.rated or m.disputed or m.mode <> 'online' then return; end if;
  select * into a from public.match_players where match_id = mid order by user_id limit 1;
  select * into b from public.match_players where match_id = mid order by user_id offset 1 limit 1;
  if b.user_id is null then return; end if;
  if not ((a.result = 'win' and b.result = 'loss') or (a.result = 'loss' and b.result = 'win') or (a.result = 'draw' and b.result = 'draw')) then
    update public.matches set disputed = true where id = mid;
    return;
  end if;
  insert into public.ratings (user_id) values (a.user_id), (b.user_id) on conflict do nothing;
  select rating into ra from public.ratings where user_id = a.user_id for update;
  select rating into rb from public.ratings where user_id = b.user_id for update;
  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case a.result when 'win' then 1.0 when 'loss' then 0.0 else 0.5 end;
  da := round(32 * (sa - ea));
  update public.ratings set rating = rating + da, games = games + 1, wins = wins + (a.result = 'win')::int, updated_at = now() where user_id = a.user_id;
  update public.ratings set rating = rating - da, games = games + 1, wins = wins + (b.result = 'win')::int, updated_at = now() where user_id = b.user_id;
  update public.match_players set rating_delta = da where match_id = mid and user_id = a.user_id;
  update public.match_players set rating_delta = -da where match_id = mid and user_id = b.user_id;
  update public.matches set rated = true where id = mid;
end $$;

revoke execute on function public.rate_match(uuid) from public;

-- report_match passa a tentar o Elo depois de gravar o relato
create or replace function public.report_match(
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
  perform public.rate_match(mid);
  return mid;
end $$;
