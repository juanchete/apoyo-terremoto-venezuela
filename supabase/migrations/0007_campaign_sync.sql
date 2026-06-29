-- =============================================================
-- Refresco de montos de GoFundMe "casi en vivo" (on-demand).
-- Marca cuándo se sincronizaron por última vez los montos de una
-- campaña, para re-escrapear solo cuando el dato está viejo.
-- =============================================================

alter table public.campaigns
  add column if not exists last_synced_at timestamptz;

-- Útil para ordenar por "más desactualizadas" si en el futuro se agrega
-- un refresco por lotes.
create index if not exists campaigns_last_synced_idx
  on public.campaigns (last_synced_at nulls first);
