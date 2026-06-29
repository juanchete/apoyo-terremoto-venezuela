# Alertas del operador basadas en montos — Diseño

**Fecha:** 2026-06-29
**Estado:** aprobado, en implementación

## Problema

Hoy las alertas del panel de operador (`/operador`) se derivan de solo dos
señales — `ai_status === "flagged"` y `open_reports > 0` — y todo cae en un
único bucket "Prioridad". Como la plataforma es de un solo evento (terremoto en
Venezuela), todas las campañas se parecen y las alertas no distinguen el motivo.

El feed público (`getCampaigns`) ordena por `collection_pct` **ascendente**: las
campañas más lejos de su meta salen primero. Eso convierte a los montos en un
vector de manipulación del ranking: inflar la meta baja el `%`, y subestimar lo
recaudado también. Las nuevas alertas atacan exactamente eso.

## Criterios de alerta

| # | Alerta | Criterio | Estado previo |
|---|--------|----------|---------------|
| 1 | Monto sobre el promedio | `goal_usd` supera `AVG_MULTIPLIER ×` el promedio (en USD) de las **otras** campañas activas de la misma categoría, con mínimo `MIN_CATEGORY_SAMPLE` campañas comparables | nuevo |
| 2 | Discrepancia vs IA | Existe baseline scrapeado por IA y `|valor_actual − valor_ia| / valor_ia > DISCREPANCY_PCT`, **solo mientras `last_synced_at IS NULL`** | nuevo |
| 3 | No relacionado al terremoto | `ai_status === "flagged"` (badge IA existente en `OperatorActionBar`) | ya existía |
| 4 | Salto de meta | `goal_actual > GOAL_JUMP_MULTIPLIER × original_goal_amount` | nuevo |

Umbrales (constantes en `src/lib/operator/alerts.ts`, ajustables):
`AVG_MULTIPLIER = 3`, `MIN_CATEGORY_SAMPLE = 4`, `DISCREPANCY_PCT = 0.2`,
`GOAL_JUMP_MULTIPLIER = 1.5`.

**Silenciado por verificación:** si `is_verified`, `computeAlerts` devuelve `[]`.
Un humano ya revisó. El criterio #3 (badge IA) también deja de priorizar al
verificar, como hoy.

## Por qué la discrepancia (#2) se apaga tras el sync

El baseline IA se captura al **crear** (lo que el scraper leyó en ese momento).
Un humano que infla los montos en el formulario produce divergencia → alerta.
Pero el Edge Function `sync-campaign` (fuera de este repo) sobrescribe
`raised_amount`/`goal_amount` con el valor real de GoFundMe y setea
`last_synced_at`. Tras el sync, el valor mostrado **es** la verdad del scraper,
así que comparar contra el baseline viejo daría falsos positivos. Por eso la
alerta #2 solo aplica con `last_synced_at IS NULL` (ventana entre creación y
primer sync, justo donde una cifra humana puede persistir). Las campañas sin
GoFundMe no tienen baseline IA → nunca disparan #2.

## Cambios de datos (migración `0010_amount_alerts.sql`)

1. **Columnas en `campaigns`:**
   - `ai_goal_amount numeric(14,2)`, `ai_raised_amount numeric(14,2)` — baseline
     que scrapeó la IA al crear (null si fue carga manual).
   - `original_goal_amount numeric(14,2)` — meta al momento de crear; baseline
     estable para #4. La pobla un trigger `BEFORE INSERT`.
2. **Tabla `campaign_goal_history`** (`id`, `campaign_id`, `old_amount`,
   `new_amount`, `changed_by`, `changed_at`) — el "registro de la meta" pedido.
   La escribe un trigger `AFTER INSERT OR UPDATE` cuando cambia `goal_amount`.
   RLS: lectura solo para operadores/super_admin.
3. **Trigger des-verificación** `BEFORE UPDATE`: si la campaña estaba
   `is_verified` y cambió `goal_amount`/`raised_amount` **sin** que cambie
   `last_synced_at` (es decir, edición humana, no sync), resetea
   `is_verified=false`, `verified_by=null`, `verified_at=null`. Cierra el hueco
   "me verifico y luego inflo": las alertas reaparecen solas. El sync legítimo
   (que sí mueve `last_synced_at`) no des-verifica.
4. La vista `campaigns_with_stats` usa `c.*`, así que las columnas nuevas
   fluyen sin recrearla.

## Flujo de datos

- **Crear:** `extractCampaign` devuelve los montos scrapeados → `CampaignForm`
  los fija en estado (`ai_goal_amount`/`ai_raised_amount`) y los manda como
  inputs ocultos → `createCampaign` los persiste. El trigger fija
  `original_goal_amount = goal_amount`.
- **Editar:** `updateCampaign` no toca el baseline IA. Si cambia montos y estaba
  verificada → trigger des-verifica → alertas recomputan.
- **Operador:** `getOperatorQueue` trae la cola (incluye columnas nuevas);
  la página obtiene `getUsdRates()`, construye el contexto de promedios por
  categoría en USD y llama a `computeAlerts(campaign, ctx)` por campaña.

## Unidades nuevas

- `src/lib/operator/alerts.ts` — **función pura, sin I/O, testeable en
  aislamiento.** Exporta:
  - tipos `TAlertType`, `IAlert { type; label; severity }`
  - constantes de umbral
  - `buildAlertContext(campaigns, rates)` → promedios/sumas por categoría en USD
  - `computeAlerts(campaign, ctx)` → `IAlert[]` (`[]` si `is_verified`)
- `src/components/AlertBadges.tsx` — render de los chips de motivo.
- `src/app/operador/page.tsx` — integra contexto + badges; bucket "Prioridad"
  pasa a `open_reports>0 || ai_status==='flagged' || alerts.length>0`.

## Presentación

Chips de motivo por campaña en cada tarjeta de la cola, p. ej.
`💰 Monto 3.2× promedio`, `⚠️ Recaudado +35% vs IA`, `📈 Meta +120%`. El badge
IA (#3) sigue en `OperatorActionBar` para no duplicar.

## Fuera de alcance

- Modificar el Edge Function `sync-campaign` (no está en el repo). La alerta #2
  ya contempla su efecto vía el gate `last_synced_at IS NULL`.
- Tabla de alertas persistente con estado open/resuelto (se eligió derivado).
- Framework de tests: el repo no tiene runner; la lógica queda como función
  pura lista para testear cuando se agregue.
