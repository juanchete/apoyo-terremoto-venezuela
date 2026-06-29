-- =============================================================
-- Evita publicar la misma campaña de GoFundMe dos veces.
-- Clave canónica = el slug de /f/<slug> del enlace de donación.
-- La unicidad aplicaTu  solo entre campañas ACTIVAS (una bajada por
-- moderación no impide corregir y republicar legítimamente).
-- =============================================================

-- Columna derivada con el slug del enlace de GoFundMe (en minúsculas).
alter table public.campaigns
  add column if not exists gofundme_slug text
  generated always as (
    lower(substring(donation_url from '/f/([^/?#]+)'))
  ) stored;

-- Índice único parcial: un mismo slug no puede repetirse entre activas.
create unique index if not exists campaigns_gofundme_slug_active_uniq
  on public.campaigns (gofundme_slug)
  where gofundme_slug is not null and status = 'active';
