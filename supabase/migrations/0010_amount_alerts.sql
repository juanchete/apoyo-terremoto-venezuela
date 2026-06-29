-- =============================================================
-- Alertas del operador basadas en montos.
--   #1 monto sobre el promedio de la categoría  (se calcula en la app)
--   #2 discrepancia entre lo mostrado y lo que scrapeó la IA
--   #4 salto de la meta respecto a la meta original
-- Aquí se agrega solo la PERSISTENCIA que esas alertas necesitan:
-- baseline de la IA, meta original e historial de la meta. El cálculo de
-- las alertas vive en src/lib/operator/alerts.ts.
-- =============================================================

-- ---------- Columnas nuevas en campaigns ----------
alter table public.campaigns
  -- Lo que la IA/scraper leyó al crear (null si la carga fue manual).
  add column if not exists ai_goal_amount    numeric(14,2),
  add column if not exists ai_raised_amount  numeric(14,2),
  -- Meta al momento de crear. Baseline estable para detectar saltos (#4).
  add column if not exists original_goal_amount numeric(14,2);

-- ---------- Historial de cambios de la meta ----------
-- El "registro de la meta cuando la subieron" pedido en el criterio #4.
create table if not exists public.campaign_goal_history (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  old_amount  numeric(14,2),
  new_amount  numeric(14,2),
  changed_by  uuid references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists campaign_goal_history_campaign_idx
  on public.campaign_goal_history (campaign_id, changed_at);

alter table public.campaign_goal_history enable row level security;

-- Solo el equipo (operadores / super_admin) ve el historial.
drop policy if exists campaign_goal_history_read on public.campaign_goal_history;
create policy campaign_goal_history_read
  on public.campaign_goal_history
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('operator', 'super_admin')
    )
  );

-- ---------- Trigger: fijar la meta original al crear ----------
create or replace function public.set_original_goal_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.original_goal_amount is null then
    new.original_goal_amount := new.goal_amount;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_original_goal on public.campaigns;
create trigger trg_set_original_goal
  before insert on public.campaigns
  for each row
  execute function public.set_original_goal_amount();

-- ---------- Trigger: registrar cambios de la meta ----------
create or replace function public.log_goal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.goal_amount is not null then
      insert into public.campaign_goal_history
        (campaign_id, old_amount, new_amount, changed_by)
      values (new.id, null, new.goal_amount, auth.uid());
    end if;
  elsif new.goal_amount is distinct from old.goal_amount then
    insert into public.campaign_goal_history
      (campaign_id, old_amount, new_amount, changed_by)
    values (new.id, old.goal_amount, new.goal_amount, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_goal_change on public.campaigns;
create trigger trg_log_goal_change
  after insert or update on public.campaigns
  for each row
  execute function public.log_goal_change();

-- ---------- Trigger: des-verificar al manipular montos ----------
-- Si una campaña verificada cambia su meta o lo recaudado por edición humana,
-- pierde el sello y vuelve a aparecer en alertas. El sync legítimo de GoFundMe
-- mueve last_synced_at en el mismo UPDATE, y por eso queda exento.
create or replace function public.unverify_on_amount_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_verified
     and (new.goal_amount   is distinct from old.goal_amount
       or new.raised_amount is distinct from old.raised_amount)
     and new.last_synced_at is not distinct from old.last_synced_at
  then
    new.is_verified := false;
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unverify_on_amount_change on public.campaigns;
create trigger trg_unverify_on_amount_change
  before update on public.campaigns
  for each row
  execute function public.unverify_on_amount_change();

-- Las funciones de trigger no deben ser invocables como RPC. La ejecución por
-- trigger no chequea EXECUTE, así que revocar no rompe nada.
revoke execute on function public.set_original_goal_amount()   from public, anon, authenticated;
revoke execute on function public.log_goal_change()            from public, anon, authenticated;
revoke execute on function public.unverify_on_amount_change()  from public, anon, authenticated;
