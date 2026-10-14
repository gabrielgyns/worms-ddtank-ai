-- Baús de conquista abertos (recompensa garantida a cada 3 conquistas).
alter table public.progress add column chests_opened int not null default 0 check (chests_opened >= 0);
