# Diseño: filtros de feed y división de trabajo entre voluntarios

Fecha: 2026-07-01 · Rama: `feature/feed-gofundme-mejoras`

Tres mejoras pedidas por Federico, independientes entre sí:

- **A** — Filtro por brecha (lo que falta) en el feed.
- **B** — División de trabajo entre voluntarios (claim "tomar/soltar") en el panel de operador.
- **C** — Tipo de beneficiario (familia / organización) como nuevo eje + filtro.

Orden de entrega: **(1) A + C** juntas (filtros del feed), **(2) B** aparte.

---

## A — Filtro por brecha (lo que falta), en USD

**Datos:** ninguno nuevo. Brecha = `max(goal_usd − raised_usd, 0)`, reusando `getUsdRates`/`toUsd`.

**Implementación:** filtro **en memoria** dentro de `getCampaigns`, tras traer las activas
(la conversión a USD vive en código, no en la DB; el feed no pagina, así que es seguro).

**UI:** nuevo `<select>` en el formulario de filtros del feed:
- Cualquier brecha (default)
- Falta menos de $1.000 → `lt1k`
- Falta $1.000 – $5.000 → `1k5k`
- Falta $5.000 – $20.000 → `5k20k`
- Falta más de $20.000 → `gt20k`

**Semántica:** campañas **sin meta** no tienen brecha definida → se excluyen cuando el filtro está activo.
Param URL: `?brecha=lt1k|1k5k|5k20k|gt20k`.

---

## B — Tomar / soltar (claim), aviso suave + auto-liberación

**Datos** (migración sobre `campaigns`):
- `claimed_by uuid references profiles(id)`
- `claimed_at timestamptz`
- Recrear vista `campaigns_with_stats` para exponer `claimed_by` + `claimed_by_name`.

**Vigencia:** claim activo solo si `claimed_at` está dentro de los últimos **30 min** (`CLAIM_TTL_MIN`).
Se evalúa al leer (sin cron). Tomar una con claim vencido lo sobrescribe.

**Acciones** (`src/lib/actions/operator.ts`): `claimCampaign(id)`, `releaseCampaign(id)`.
Verificar / bajar / resolver reporte **liberan** el claim (set null).

**UI panel operador:** botón **"Tomar"** por tarjeta. Si está tomada y vigente por otro:
badge *"En revisión por {nombre} · hace N min"* + "Soltar" solo para quien la tomó.
**Aviso suave**: no bloquea a los demás.

**RLS:** operadores/super_admin pueden actualizar las columnas de claim.

---

## C — Tipo de beneficiario (familia / organización)

**Datos:** `beneficiary_type text not null default 'family'
check (beneficiary_type in ('family','organization'))` en `campaigns`.
Existentes → `'family'`; autor u operador corrige editando. La vista lo toma vía `c.*`.

**IA sugiere:** extender `IExtractedCampaign` + paso de IA en `ingest/gofundme.ts` para devolver
`beneficiary_type` sugerido desde título/descripción. Sin IA → sugiere `'family'`.

**Autor elige:** radio *Familia / Organización* en `CampaignForm` (crear y editar),
pre-seleccionado con la sugerencia.

**Feed filtro:** `<select>` (Todas / Familia / Organización) → `getCampaigns` con
`eq('beneficiary_type', …)`. Param URL: `?tipo=familia|organizacion`. Badge opcional en la tarjeta.
