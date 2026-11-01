-- =====================================================================
-- COPA 2026 | FUTEBOL ARENA 26 3D | MIGRAÇÃO 7x7
-- Execute no Supabase SQL Editor DEPOIS das migrações anteriores da Copa.
-- É aditiva: preserva perfis, RLS, times, jogadores e escalações antigas.
-- =====================================================================

alter table public.game_copa_user_squads
  add column if not exists starting_lineup jsonb not null default '[]'::jsonb,
  add column if not exists bench_lineup jsonb not null default '[]'::jsonb,
  add column if not exists lineup_version integer not null default 2;

-- A primeira versão do jogo limitava a formação a 3+1.
-- Mantemos o valor antigo permitido para não invalidar dados já gravados,
-- mas o novo padrão passa a ser 2-3-1.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.game_copa_user_squads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%formation%'
  loop
    execute format('alter table public.game_copa_user_squads drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.game_copa_user_squads
  alter column formation set default '2-3-1';

alter table public.game_copa_user_squads
  add constraint game_copa_user_squads_formation_allowed_check
  check (formation in ('2-3-1', '3+1'));

alter table public.game_copa_user_squads
  drop constraint if exists game_copa_user_squads_lineup_arrays_check;

alter table public.game_copa_user_squads
  add constraint game_copa_user_squads_lineup_arrays_check
  check (
    jsonb_typeof(starting_lineup) = 'array'
    and jsonb_typeof(bench_lineup) = 'array'
    and jsonb_array_length(starting_lineup) <= 7
    and jsonb_array_length(bench_lineup) <= 5
  );

create index if not exists idx_game_copa_user_squads_updated_at
  on public.game_copa_user_squads (updated_at desc);

comment on column public.game_copa_user_squads.formation is
  'Formação do Futebol Arena 26 3D; o formato 7x7 usa 2-3-1.';
comment on column public.game_copa_user_squads.starting_lineup is
  'Snapshot JSON dos sete titulares do Futebol Arena 26 3D.';
comment on column public.game_copa_user_squads.bench_lineup is
  'Snapshot JSON de até cinco reservas do Futebol Arena 26 3D.';
comment on column public.game_copa_user_squads.lineup_version is
  'Versão do formato de escalação: 2 corresponde ao modelo 7x7.';

select 'Migração do Futebol Arena 26 3D concluída: 7 titulares + até 5 reservas.' as resultado;
