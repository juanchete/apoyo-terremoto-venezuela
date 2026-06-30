# Diseño: mejoras de feed y creación (GoFundMe)

**Fecha:** 2026-06-29
**Origen:** feedback de Federico Pérez (stakeholder).

Cuatro mejoras independientes pero cohesivas sobre el flujo de creación y el feed:

1. Traer la descripción **completa** de GoFundMe al crear (hoy se corta).
2. Filtro por **antigüedad** de publicación (descartar campañas recién creadas).
3. **Tag** "hace cuánto se publicó" en el feed y el detalle.
4. En el feed: **link directo** a GoFundMe + menú **"⋯"** para reportar.

## Hallazgos de la exploración

Probando una campaña real del proyecto (`__NEXT_DATA__` de GoFundMe), la entidad
`Fundraiser` expone:

- `description({"excerpt":false})` — historia completa en HTML (~14.851 caracteres
  en el ejemplo). Hoy el scraper solo usa `og:description`, que es el resumen
  truncado: **esa es la causa del corte**.
- `createdAt` y `publishedAt` — fecha real de GoFundMe (distinta de nuestro
  `created_at`, que es cuándo se agregó al agregador).

Restricciones del código actual relevantes al diseño:

- `campaigns.description` tiene `check (char_length between 20 and 5000)`. La
  historia completa supera 5000 → hay que subir el límite, no basta con capar.
- La vista `campaigns_with_stats` se define con `select c.* ...`; en Postgres el
  `*` se "congela" al crear la vista, así que **agregar una columna a `campaigns`
  obliga a recrear la vista** (igual que hizo la migración `0011`).
- `reportCampaign` usa `upsert` con `onConflict campaign_id,reporter_id` → reportar
  es idempotente; el menú del feed no necesita pre-chequear "ya reportaste"
  (evita N consultas por card).
- `refreshAmountsIfStale` delega el re-scrape a la Edge Function `sync-campaign`
  (service-role), **cuyo código no está en el repo**. Por eso el backfill de la
  fecha no se cuelga de ese flujo; se usa el scraper de Next (`extractFromGoFundMe`),
  que corre en servidor.

**Decisión del stakeholder:** para el tag y el filtro se usa la **fecha real de
GoFundMe con fallback** al `created_at` del sitio (campañas manuales o scrape
fallido).

---

## F1 — Descripción completa de GoFundMe

**Objetivo:** al autocompletar/crear, traer la historia completa, no el resumen.

- `src/lib/ingest/gofundme.ts`:
  - Nueva `htmlToPlainText(html: string): string` — convierte `</div>`, `</p>`,
    `<br>` a salto de línea, quita el resto de tags, decodifica entidades,
    colapsa 3+ saltos a 2, hace trim. (Distinta de la existente `htmlToText`, que
    colapsa todo a una sola línea para la IA.)
  - En `fromStructuredData`: leer la descripción de la entidad `Fundraiser` por
    clave literal:
    `fund['description({"excerpt":false})'] ?? fund['description({"excerpt":true})']`,
    pasarla por `htmlToPlainText` y capar a 20.000 caracteres.
  - Orquestador `extractFromGoFundMe`: `description = structuredDescription ?? ogDescription`.
- **Migración** (ver F2, misma migración `0012`): subir el `check` de
  `description` a `between 20 and 20000`.
- `src/components/CampaignForm.tsx`: `textarea` de descripción `maxLength` 5000 → 20000.
- `parseCampaignForm` (`actions/campaigns.ts`): no impone máximo (solo mínimo 20);
  el `check` de la DB es la barrera. Sin cambios salvo confirmar que no truncamos.

**Casos borde:** historia vacía → fallback a `og:description`. HTML con `<a>`,
`<b>`, listas → se aplanan a texto con saltos de línea; el render ya usa
`whitespace-pre-wrap`.

## F2 — Filtro por antigüedad  ·  F3 — Tag "hace cuánto se publicó"

**Fecha usada:** `published_at = coalesce(gofundme_created_at, created_at)`.

### Datos / migración `0012_gofundme_published_at.sql`
- `alter table public.campaigns add column gofundme_created_at timestamptz;`
- Subir el `check` de `description` a `between 20 and 20000` (F1).
- `drop view if exists public.campaigns_with_stats;` y recrearla idéntica a la de
  `0011` añadiendo una columna calculada:
  `coalesce(c.gofundme_created_at, c.created_at) as published_at`.
  (`c.*` re-expandido ya incluye `gofundme_created_at`.)

### Captura de la fecha
- `IExtractedCampaign` (`types/index.ts`) gana `gofundme_created_at: string | null`.
- `gofundme.ts` `fromStructuredData`/`extractFromGoFundMe`: leer
  `fund.publishedAt ?? fund.createdAt` (ISO string) y devolverlo.
- `CampaignForm.tsx`: hidden field `gofundme_created_at` (patrón de
  `ai_goal_amount`); se setea en `handleExtract` desde `result.data`.
- `parseCampaignForm` + `createCampaign`/`updateCampaign`: parsear el campo
  (validar que sea fecha ISO; si no, `null`) e insertarlo.
- `ICampaign` gana `gofundme_created_at: string | null`;
  `ICampaignWithStats` gana `published_at: string`.

### Backfill de campañas existentes
- Nueva acción operador-only `backfillGoFundMeDates()` en `actions/operator.ts`:
  itera campañas activas de GoFundMe con `gofundme_created_at is null`, las
  re-scrapea con `extractFromGoFundMe` (scraper de Next, sin tocar la Edge
  Function) y hace `update` de la fecha. Botón discreto en `/operador`.
- Hasta que se ejecute, esas campañas muestran el fallback `created_at`.

### Tag (F3)
- `format.ts`: nueva `formatCampaignAge(iso: string | null): string | null` que
  extiende `formatRelativeTime` a semanas/meses/años:
  "hace un momento / hace N min / hace N h / hace N días / hace N semanas /
  hace N meses / hace N años".
- `CampaignCard.tsx`: en la fila meta del footer, junto a la región
  (`📍 región · 🕐 hace 2 semanas`), usando `campaign.published_at`.
- `app/campana/[id]/page.tsx`: mostrar también la antigüedad de publicación.

### Filtro (F2)
- `app/page.tsx`: `<select name="antiguedad">` en el form de filtros con opciones
  *Cualquier momento* (`""`) / *Hace más de 1 hora* (`1h`) / *…1 día* (`1d`) /
  *…1 semana* (`1w`). Parsear a `minAgeHours` (1 / 24 / 168).
- `ICampaignFilters` (`data/campaigns.ts`) gana `minAgeHours?: number`.
- `getCampaigns`: si `minAgeHours`, `cutoff = new Date(Date.now() - minAgeHours*3600e3).toISOString()`
  y `query.lte('published_at', cutoff)`.
- `hasFilter`/`countLabel` en `page.tsx` consideran el nuevo filtro.

## F4 — Link directo a GoFundMe + menú "⋯" para reportar (feed)

**Problema:** la card entera es un `<Link>`; no se pueden anidar `<a>`/botones.
**Fix:** overlay `absolute` hermano del `<Link>`, no anidado.

- `CampaignCard.tsx`:
  - `<article class="relative">` con el `<Link>` cubriendo la card (como hoy).
  - Overlay arriba-derecha `absolute z-10`: pill visible **`GoFundMe ↗`**
    (`<a target="_blank" rel="noopener noreferrer nofollow">`, solo si
    `fromGoFundMe`) + botón **`⋯`** (`CampaignCardMenu`).
  - **Reubicar `VerifiedBadge`**: de la esquina arriba-derecha de la imagen a
    inline junto al título (libera la esquina; consistente con el detalle).
- **Nuevo** `src/components/CampaignCardMenu.tsx` (client):
  - Botón `⋯` que abre un popover con **"Reportar"**.
  - "Reportar" abre un mini-modal con `textarea` de motivo (reutiliza la lógica de
    `ReportButton`) y llama `reportCampaign`. Sin auth → `router.push('/login')`.
  - Props: `campaignId`, `donationUrl`, `fromGoFundMe`, `isAuthenticated`.
  - Cierra con click-fuera / `Esc`.
- `app/page.tsx`: pasar `isAuthenticated={Boolean(profile)}` a cada `CampaignCard`.

## Archivos

Modificados: `src/lib/ingest/gofundme.ts`, `src/lib/actions/ingest.ts`,
`src/lib/actions/campaigns.ts`, `src/components/CampaignForm.tsx`,
`src/lib/data/campaigns.ts`, `src/lib/format.ts`, `src/types/index.ts`,
`src/components/CampaignCard.tsx`, `src/app/page.tsx`,
`src/app/campana/[id]/page.tsx`, `src/lib/actions/operator.ts`,
`src/app/operador/page.tsx`.

Nuevos: `src/components/CampaignCardMenu.tsx`,
`supabase/migrations/0012_gofundme_published_at.sql`.

## Pruebas

- Unit del parser sobre el `__NEXT_DATA__` real: `htmlToPlainText` (saltos de
  línea, entidades), extracción de `description({"excerpt":false})` y de
  `publishedAt ?? createdAt`.
- Unit de `formatCampaignAge` (min / h / días / semanas / meses / años / null).
- Verificación manual:
  - Crear campaña pegando un GoFundMe → autocompleta descripción completa y fecha.
  - Filtro de antigüedad oculta campañas recientes según el corte.
  - Tag "hace N …" coherente con la fecha real de GoFundMe.
  - Menú `⋯` → reportar (con y sin sesión); link `GoFundMe ↗` abre en pestaña nueva.
  - Backfill de operador rellena fechas faltantes.

## Fuera de alcance

- Modificar la Edge Function `sync-campaign` (su código no está en el repo); el
  backfill usa el scraper de Next.
- Reportar campañas no-GoFundMe se mantiene igual que hoy (el menú aplica a todas;
  el link directo solo a las de GoFundMe).
