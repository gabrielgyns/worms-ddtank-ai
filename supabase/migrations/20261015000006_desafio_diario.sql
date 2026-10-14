-- Desafio diário: melhor pontuação de cada um por dia, placar entre amigos.

create table public.daily_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  score int not null check (score >= 0 and score <= 100000),
  won boolean not null default false,
  attempts int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_scores enable row level security;
create policy "diário: meu e de amigos" on public.daily_scores
for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
grant select on public.daily_scores to authenticated;

-- só vale para hoje (com folga de fuso); guarda a melhor
create function public.submit_daily(p_day date, p_score int, p_won boolean) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  best int;
begin
  if me is null then raise exception 'precisa estar logado'; end if;
  if abs(p_day - current_date) > 1 then raise exception 'desafio de outro dia'; end if;
  insert into public.daily_scores (user_id, day, score, won) values (me, p_day, greatest(p_score, 0), p_won)
  on conflict (user_id, day) do update set
    attempts = daily_scores.attempts + 1,
    won = case when excluded.score > daily_scores.score then excluded.won else daily_scores.won end,
    score = greatest(daily_scores.score, excluded.score),
    updated_at = now()
  returning score into best;
  return best;
end $$;

create function public.daily_board(p_day date)
returns table (user_id uuid, name text, color smallint, score int, won boolean, attempts int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.color, d.score, d.won, d.attempts
  from public.my_circle() c(id)
  join public.profiles p on p.id = c.id
  join public.daily_scores d on d.user_id = p.id and d.day = p_day
  order by d.score desc, d.updated_at;
$$;

grant execute on function public.submit_daily(date, int, boolean) to authenticated;
grant execute on function public.daily_board(date) to authenticated;
