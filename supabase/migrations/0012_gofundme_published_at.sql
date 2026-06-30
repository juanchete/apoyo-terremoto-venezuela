-- =============================================================
-- 1. Fecha real de publicación en GoFundMe (distinta de created_at del sitio).
-- 2. La historia completa de GoFundMe puede superar 5000 chars → sube el tope.
-- 3. Recrea la vista para exponer published_at = coalesce(gofundme_created_at,
--    created_at) y para que c.* incluya la nueva columna.
-- =============================================================

-- ---------- 1. Columna de fecha real de GoFundMe ----------
alter table public.campaigns
  add column if not exists gofundme_created_at timestamptz;

-- ---------- 2. Descripción completa: 5000 → 20000 ----------
alter table public.campaigns
  drop constraint if exists campaigns_description_check;
alter table public.campaigns
  add constraint campaigns_description_check
  check (char_length(description) between 20 and 20000);

-- ---------- 3. Vista con stats (igual a 0011 + published_at) ----------
drop view if exists public.campaigns_with_stats;

create view public.campaigns_with_stats
with (security_invoker = true)
as
select
  c.*,
  coalesce(c.gofundme_created_at, c.created_at)               as published_at,
  p.display_name                                              as author_name,
  vp.display_name                                             as verified_by_name,
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
left join public.votes v on v.campaign_id = c.id
left join public.reports r on r.campaign_id = c.id
group by c.id, p.display_name, vp.display_name;
