-- =============================================================
-- Reorganización de la clasificación de campañas:
--   1. Categorías reducidas a 3 grandes grupos (necesidad principal):
--        medical → Gastos médicos
--        funeral → Gastos funerarios
--        economic_loss → Pérdidas económicas
--      (recovery, children y other se absorben en economic_loss).
--   2. Nuevo eje transversal `tags text[]` para subclasificar
--      (niños, madre, abuelo, mascota, prótesis, diabetes, …).
--      Las antiguas campañas con enfoque infantil reciben el tag 'ninos'.
--   3. La verificación humana (is_verified) y el origen GoFundMe
--      (gofundme_slug) siguen siendo ejes independientes ya existentes.
-- =============================================================

-- ---------- La vista depende de campaigns.category: se recrea al final ----------
drop view if exists public.campaigns_with_stats;

-- ---------- 2. Tags (eje transversal) ----------
alter table public.campaigns
  add column if not exists tags text[] not null default '{}';

-- Las campañas con enfoque infantil pasan a llevar el tag 'ninos' antes de
-- perder el valor de categoría 'children'.
update public.campaigns
  set tags = array_append(tags, 'ninos')
  where category::text = 'children'
    and not (tags @> array['ninos']);

-- Índice GIN para filtrar por tags (overlaps / contains).
create index if not exists campaigns_tags_idx on public.campaigns using gin (tags);

-- ---------- 1. Categorías: enum de 5 → 3 valores ----------
-- Postgres no permite DROP VALUE en un enum, así que se crea un tipo nuevo,
-- se migra la columna mapeando los valores antiguos, y se intercambian.
alter table public.campaigns alter column category drop default;

create type public.need_category_new as enum (
  'medical',        -- Gastos médicos
  'funeral',        -- Gastos funerarios
  'economic_loss'   -- Pérdidas económicas (vivienda, recuperación, otros)
);

alter table public.campaigns
  alter column category type public.need_category_new
  using (
    case category::text
      when 'medical' then 'medical'
      when 'funeral' then 'funeral'
      else 'economic_loss'  -- recovery, children, other
    end::public.need_category_new
  );

drop type public.need_category;
alter type public.need_category_new rename to need_category;

alter table public.campaigns
  alter column category set default 'economic_loss';

-- ---------- Vista con estadísticas (recreada, igual que 0009 + tags via c.*) ----------
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
