-- =============================================================
-- Trazabilidad de verificación: expone el nombre de quien otorgó
-- el sello en la vista pública. La fecha (verified_at) y el id del
-- verificador (verified_by) ya existían en la tabla; aquí solo
-- resolvemos el display_name para mostrarlo en la UI.
-- =============================================================
drop view if exists public.campaigns_with_stats;

create view public.campaigns_with_stats
with (security_invoker = true)
as
select
  c.*,
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
