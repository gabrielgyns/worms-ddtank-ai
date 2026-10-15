-- Contas criadas antes das migrações (ou se o gatilho falhou) ficaram sem perfil,
-- e sem perfil nada salva: progresso, rating e partidas apontam para profiles.
-- Pode rodar quantas vezes quiser: só cria o que falta.

create function public.backfill_profiles() returns int
language plpgsql security definer set search_path = public as $$
declare
  created int;
begin
  insert into public.profiles (id, name, friend_code)
  select u.id,
         coalesce(nullif(left(u.raw_user_meta_data ->> 'name', 14), ''), 'Jogador'),
         public.new_friend_code()
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict (id) do nothing;
  get diagnostics created = row_count;
  return created;
end $$;

-- só o dono do banco chama (pelo SQL Editor); o jogo não precisa
revoke execute on function public.backfill_profiles() from public, anon, authenticated;

select public.backfill_profiles();
