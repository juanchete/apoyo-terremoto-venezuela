-- =============================================================
-- Vista pública de campañas con conteos de votos y autor.
-- security_invoker = true → respeta las políticas RLS de quien consulta.
-- =============================================================
create or replace view public.campaigns_with_stats
with (security_invoker = true)
as
select
  c.*,
  p.display_name                                            as author_name,
  coalesce(sum((v.value = 'trust')::int), 0)::int           as trust_count,
  coalesce(sum((v.value = 'distrust')::int), 0)::int        as distrust_count,
  coalesce(count(v.id), 0)::int                             as total_votes
from public.campaigns c
join public.profiles p on p.id = c.author_id
left join public.votes v on v.campaign_id = c.id
group by c.id, p.display_name;
