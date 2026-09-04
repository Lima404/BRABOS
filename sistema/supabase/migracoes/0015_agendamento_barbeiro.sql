-- ============================================================
-- BARBOS — migração 0015: agendamento ligado ao barbeiro
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0006 e 0014. Pode rodar mais de uma vez.
--
-- Cada horário passa a pertencer a um barbeiro. Dois barbeiros
-- podem atender no mesmo instante; o mesmo barbeiro não.
-- ============================================================

alter table public.agendamentos
  add column if not exists barbeiro_id uuid
    references public.barbeiros(id) on delete restrict;

comment on column public.agendamentos.barbeiro_id is
  'Quem atende. Agenda própria por barbeiro.';

-- Horários antigos: caem no primeiro barbeiro ativo da loja (se houver).
update public.agendamentos a
set barbeiro_id = (
  select b.id
  from public.barbeiros b
  where b.barbearia_id = a.barbearia_id
    and b.ativo
  order by b.nome
  limit 1
)
where a.barbeiro_id is null;

create index if not exists agendamentos_barbeiro_data_idx
  on public.agendamentos (barbeiro_id, data, horario)
  where barbeiro_id is not null;

-- A trava deixa de ser "uma cadeira na loja" e passa a ser
-- "uma cadeira por barbeiro". Quem ainda não tem barbeiro (loja
-- sem equipe) fica fora da exclusão — a app exige barbeiro ao marcar.
do $$
begin
  alter table public.agendamentos
    drop constraint if exists agendamento_sem_sobreposicao;

  alter table public.agendamentos
    add constraint agendamento_sem_sobreposicao
    exclude using gist (
      barbearia_id with =,
      barbeiro_id with =,
      periodo with &&
    ) where (estado <> 'cancelado' and barbeiro_id is not null);

  raise notice 'BARBOS: trava de sobreposição por barbeiro.';
exception
  when others then
    raise warning
      'BARBOS: não consegui recriar a trava (%). Corrija conflitos e rode de novo.',
      SQLERRM;
end $$;
