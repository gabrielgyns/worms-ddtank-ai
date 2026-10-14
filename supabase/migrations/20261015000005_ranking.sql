-- Ranking entre amigos e histórico cara a cara.

-- eu + amigos aceitos
create function public.my_circle() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid()
  union
  select case when f.requester = auth.uid() then f.addressee else f.requester end
  from public.friendships f
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee);
$$;

-- period: 'all' (rating) ou 'week' (vitórias nos últimos 7 dias, online e por link)
create function public.friends_leaderboard(period text default 'all')
returns table (user_id uuid, name text, color smallint, rating int, games int, wins int)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.color,
    coalesce(r.rating, 1000),
    case when period = 'week' then coalesce(w.games, 0) else coalesce(r.games, 0) end,
    case when period = 'week' then coalesce(w.wins, 0) else coalesce(r.wins, 0) end
  from public.my_circle() c(id)
  join public.profiles p on p.id = c.id
  left join public.ratings r on r.user_id = p.id
  left join lateral (
    select count(*)::int as games, count(*) filter (where mp.result = 'win')::int as wins
    from public.match_players mp
    where mp.user_id = p.id and mp.created_at > now() - interval '7 days'
  ) w on true
  order by
    case when period = 'week' then coalesce(w.wins, 0) else coalesce(r.rating, 1000) end desc,
    p.name;
$$;

-- placar entre mim e um amigo
create function public.head_to_head(friend uuid)
returns table (wins int, losses int, draws int, last_played timestamptz)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where me.result = 'win')::int,
    count(*) filter (where me.result = 'loss')::int,
    count(*) filter (where me.result = 'draw')::int,
    max(me.created_at)
  from public.match_players me
  join public.match_players them on them.match_id = me.match_id and them.user_id = friend
  where me.user_id = auth.uid() and public.are_friends(friend, auth.uid());
$$;

grant execute on function public.friends_leaderboard(text) to authenticated;
grant execute on function public.head_to_head(uuid) to authenticated;
revoke execute on function public.my_circle() from public;
