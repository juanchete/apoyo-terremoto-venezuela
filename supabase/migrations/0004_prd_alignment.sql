-- =============================================================
-- Alineación con el PRD: categorías de necesidad, montos
-- financieros, capa de IA y reportes comunitarios (flagging).
-- =============================================================

-- ---------- Nuevos tipos ----------
create type public.need_category as enum (
  'medical',   -- Gastos Médicos
  'funeral',   -- Gastos Funerarios
  'recovery',  -- Recuperación Económica / Pérdida de Vivienda
  'children'   -- Enfoque Infantil (familias con niños)
);

-- Resultado del filtro inicial con IA.
create type public.ai_status as enum (
  'pending',   -- aún no analizada
  'relevant',  -- coherente con el terremoto, sin anomalías
  'flagged',   -- posible anomalía o duplicado: requiere revisión
  'error'      -- el análisis no pudo completarse
);

create type public.report_status as enum ('open', 'reviewed');

-- ---------- Campos nuevos en campaigns ----------
alter table public.campaigns
  add column category       public.need_category not null default 'recovery',
  add column goal_amount    numeric(14, 2),
  add column raised_amount  numeric(14, 2) not null default 0,
  add column currency       text not null default 'USD',
  add column ai_status      public.ai_status not null default 'pending',
  add column ai_notes       text;

alter table public.campaigns
  add constraint goal_amount_positive check (goal_amount is null or goal_amount >= 0),
  add constraint raised_amount_positive check (raised_amount >= 0);

create index campaigns_category_idx on public.campaigns (category);

-- ---------- Reportes comunitarios (crowdsourced flagging) ----------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 1000),
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  -- Un reporte por persona por campaña.
  unique (campaign_id, reporter_id)
);

create index reports_campaign_idx on public.reports (campaign_id);
create index reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

-- Solo el autor del reporte y los operadores pueden verlos.
create policy "Reportes visibles para operadores y autor"
  on public.reports for select
  using (auth.uid() = reporter_id or public.is_operator());

create policy "Usuarios autenticados reportan"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Operadores resuelven reportes"
  on public.reports for update
  using (public.is_operator())
  with check (public.is_operator());

-- ---------- Vista con estadísticas (recreada con campos nuevos) ----------
drop view if exists public.campaigns_with_stats;

create view public.campaigns_with_stats
with (security_invoker = true)
as
select
  c.*,
  p.display_name                                              as author_name,
  coalesce(sum((v.value = 'trust')::int), 0)::int             as trust_count,
  coalesce(sum((v.value = 'distrust')::int), 0)::int          as distrust_count,
  coalesce(count(distinct v.id), 0)::int                      as total_votes,
  coalesce(count(distinct r.id) filter (where r.status = 'open'), 0)::int
                                                              as open_reports,
  case
    when c.goal_amount is null or c.goal_amount = 0 then null
    else least(c.raised_amount / c.goal_amount, 1)
  end                                                         as collection_pct
from public.campaigns c
join public.profiles p on p.id = c.author_id
left join public.votes v on v.campaign_id = c.id
left join public.reports r on r.campaign_id = c.id
group by c.id, p.display_name;
