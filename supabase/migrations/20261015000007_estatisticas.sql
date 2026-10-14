-- Estatísticas de carreira (partidas online e por link) para comparar entre amigos.
create function public.friends_stats()
returns table (user_id uuid, name text, color smallint, games int, wins int, damage int, kills int, shots int, hits int, longest_shot int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.color,
    count(mp.match_id)::int,
    count(*) filter (where mp.result = 'win')::int,
    coalesce(sum(mp.damage), 0)::int,
    coalesce(sum(mp.kills), 0)::int,
    coalesce(sum(mp.shots), 0)::int,
    coalesce(sum(mp.hits), 0)::int,
    coalesce(max(mp.longest_shot), 0)::int
  from public.my_circle() c(id)
  join public.profiles p on p.id = c.id
  left join public.match_players mp on mp.user_id = p.id
  group by p.id, p.name, p.color
  order by count(*) filter (where mp.result = 'win') desc, p.name;
$$;
grant execute on function public.friends_stats() to authenticated;
