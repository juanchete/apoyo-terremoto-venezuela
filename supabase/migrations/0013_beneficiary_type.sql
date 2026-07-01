-- =============================================================
-- Tipo de beneficiario: familia (default) u organización.
-- Nuevo eje independiente para filtrar el feed. El autor lo elige al publicar
-- (la IA lo sugiere); las campañas existentes quedan como 'family'.
-- La vista campaigns_with_stats lo toma automáticamente vía c.*.
-- =============================================================
alter table public.campaigns
  add column if not exists beneficiary_type text not null default 'family'
  check (beneficiary_type in ('family', 'organization'));
