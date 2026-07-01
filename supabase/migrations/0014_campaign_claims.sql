-- =============================================================
-- Reparto de trabajo entre voluntarios: "tomar / soltar" una campaña.
-- claimed_by / claimed_at marcan quién la está revisando para que dos
-- voluntarios no trabajen la misma. La vigencia del claim (30 min) se evalúa
-- en la aplicación; aquí solo se persiste el estado.
--
-- No hace falta política RLS nueva: "Operadores moderan campañas" (0001) ya
-- permite a operadores/super_admin actualizar cualquier columna de campaigns.
-- =============================================================

alter table public.campaigns
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null;
alter table public.campaigns
  add column if not exists claimed_at timestamptz;

-- ---------- Recrear la vista para exponer claimed_by_name ----------
-- (claimed_by/claimed_at ya viajan por c.*; solo falta el nombre del voluntario)
drop view if exists public.campaigns_with_stats;

create view public.campaigns_with_stats
with (security_invoker = true)
as
select
  c.*,
  coalesce(c.gofundme_created_at, c.created_at)               as published_at,
  p.display_name                                              as author_name,
  vp.display_name                                             as verified_by_name,
  cp.display_name                                             as claimed_by_name,
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
left join public.profiles vp on vp.id = c.verified_by
left join public.profiles cp on cp.id = c.claimed_by
left join public.votes v on v.campaign_id = c.id
left join public.reports r on r.campaign_id = c.id
group by c.id, p.display_name, vp.display_name, cp.display_name;
