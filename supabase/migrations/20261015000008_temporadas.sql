-- Temporadas mensais: quem mais venceu no mês dentro do grupo de amigos
-- ganha um cosmético exclusivo. O servidor confere; o resgate é único.

create table public.season_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  claimed_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.season_rewards enable row level security;
create policy "resgates: meus" on public.season_rewards for select to authenticated using (user_id = auth.uid());
grant select on public.season_rewards to authenticated;

create function public.season_board(p_month text)
returns table (user_id uuid, name text, color smallint, games int, wins int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.color,
    count(mp.match_id)::int,
    count(*) filter (where mp.result = 'win')::int
  from public.my_circle() c(id)
  join public.profiles p on p.id = c.id
  left join public.match_players mp
    on mp.user_id = p.id and to_char(mp.created_at at time zone 'UTC', 'YYYY-MM') = p_month
  group by p.id, p.name, p.color
  order by count(*) filter (where mp.result = 'win') desc, count(mp.match_id) desc, p.name;
$$;

-- true = você foi o campeão (empate conta) de uma temporada já encerrada e ainda não tinha resgatado
create function public.claim_season_reward(p_month text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_wins int;
  my_games int;
  best int;
  rivals int;
begin
  if me is null then raise exception 'precisa estar logado'; end if;
  if p_month >= to_char(now() at time zone 'UTC', 'YYYY-MM') then return false; end if;
  if exists (select 1 from public.season_rewards where user_id = me and month = p_month) then return false; end if;
  select b.wins, b.games into my_wins, my_games from public.season_board(p_month) b where b.user_id = me;
  select max(b.wins), count(*) filter (where b.games > 0) into best, rivals from public.season_board(p_month) b;
  if coalesce(my_games, 0) < 3 or rivals < 2 or my_wins < best then return false; end if;
  insert into public.season_rewards (user_id, month) values (me, p_month);
  return true;
end $$;

grant execute on function public.season_board(text) to authenticated;
grant execute on function public.claim_season_reward(text) to authenticated;
