# Mejoras de feed y creación (GoFundMe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer la descripción completa de GoFundMe al crear, añadir filtro y tag por antigüedad real de publicación, y exponer en el feed un link directo a GoFundMe más un menú "⋯" para reportar.

**Architecture:** Se extrae la lógica de parseo pura de `gofundme.ts` (que usa `server-only`) a un módulo nuevo `gofundme-parse.ts` testeable en Node. La fecha real de GoFundMe se guarda en una columna nueva y se expone vía la vista `campaigns_with_stats` como `published_at = coalesce(gofundme_created_at, created_at)`, usada por filtro y tag. Las acciones del feed viven en un overlay `absolute` hermano del `<Link>` para no anidar anchors.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19, Supabase (Postgres + RLS), Vitest (nuevo, para funciones puras), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-29-feed-mejoras-gofundme-design.md`

**Convención del repo:** interfaces con prefijo `I`, tipos con `T`, sin `any`, tipos de retorno explícitos. Commits estilo conventional commits.

---

### Task 1: Setup de Vitest para funciones puras

**Files:**
- Modify: `package.json`
- Create: `src/lib/format.test.ts` (smoke test temporal)

- [ ] **Step 1: Instalar Vitest**

Run: `npm install -D vitest@^3`
Expected: se añade `vitest` a `devDependencies` sin errores.

- [ ] **Step 2: Añadir script `test` en `package.json`**

En el bloque `"scripts"`, añade la línea `test` tras `lint`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Smoke test**

Crea `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatPct } from './format';

describe('vitest setup', () => {
  it('runs and formatPct works', () => {
    expect(formatPct(0.5)).toBe('50%');
  });
});
```

- [ ] **Step 4: Ejecutar**

Run: `npm test`
Expected: PASS (1 test). Esto confirma que Vitest transpila TS y resuelve imports relativos.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/format.test.ts
git commit -m "chore: set up vitest for pure-function unit tests"
```

---

### Task 2: Módulo de parseo puro `gofundme-parse.ts` (descripción completa + fecha)

Mueve las funciones de parseo puro fuera de `gofundme.ts` (que tiene `import 'server-only'` y no corre en Node) a un módulo testeable, y añade: `htmlToPlainText`, extracción de la **descripción completa** (`description({"excerpt":false})`) y de la **fecha real** (`publishedAt ?? createdAt`).

**Files:**
- Modify: `src/types/index.ts:106-113`
- Create: `src/lib/ingest/gofundme-parse.ts`
- Create: `src/lib/ingest/gofundme-parse.test.ts`

- [ ] **Step 0: Añadir `gofundme_created_at` a `IExtractedCampaign`**

En `src/types/index.ts`, en `IExtractedCampaign`, añade el campo (lo usa el parser):

```ts
export interface IExtractedCampaign {
  title: string | null;
  description: string | null;
  image_url: string | null;
  goal_amount: number | null;
  raised_amount: number | null;
  currency: string | null;
  // Fecha real de publicación en GoFundMe (ISO); null si no se pudo leer.
  gofundme_created_at: string | null;
}
```

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/ingest/gofundme-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { htmlToPlainText, extractStructured } from './gofundme-parse';

describe('htmlToPlainText', () => {
  it('convierte div/p/br en saltos de línea y limpia tags', () => {
    const html =
      '<div>Hola <b>mundo</b></div><div><br /></div><p>Segundo&nbsp;párrafo</p>';
    expect(htmlToPlainText(html)).toBe('Hola mundo\n\nSegundo párrafo');
  });

  it('colapsa 3+ saltos en máximo 2 y hace trim', () => {
    expect(htmlToPlainText('<div>a</div><br/><br/><br/><div>b</div>')).toBe(
      'a\n\nb',
    );
  });

  it('cadena vacía o sin contenido devuelve string vacío', () => {
    expect(htmlToPlainText('<div></div>')).toBe('');
  });
});

describe('extractStructured', () => {
  const slug = 'demo';
  const url = `https://www.gofundme.com/f/${slug}`;

  function pageWith(fundraiser: Record<string, unknown>): string {
    const data = { props: { pageProps: { apollo: { fundraiser } } } };
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      data,
    )}</script>`;
  }

  it('extrae descripción completa, fecha y montos de la entidad Fundraiser', () => {
    const html = pageWith({
      __typename: 'Fundraiser',
      title: 'Ayuda a la familia',
      defaultSlug: slug,
      fundraiserImageUrl: 'https://img/x.jpg',
      currentAmount: { amount: 1500, currencyCode: 'USD' },
      goalAmount: { amount: 5000, currencyCode: 'USD' },
      publishedAt: '2026-06-27T04:09:33.000-05:00',
      createdAt: '2026-06-20T00:00:00.000-05:00',
      'description({"excerpt":false})': '<div>Historia <b>completa</b> aquí.</div>',
      'description({"excerpt":true})': 'Resumen corto',
    });

    const result = extractStructured(html, url);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Ayuda a la familia');
    expect(result!.description).toBe('Historia completa aquí.');
    expect(result!.gofundme_created_at).toBe('2026-06-27T04:09:33.000-05:00');
    expect(result!.raised_amount).toBe(1500);
    expect(result!.goal_amount).toBe(5000);
    expect(result!.currency).toBe('USD');
  });

  it('usa createdAt si no hay publishedAt; excerpt:true si no hay excerpt:false', () => {
    const html = pageWith({
      __typename: 'Fundraiser',
      defaultSlug: slug,
      currentAmount: { amount: 10, currencyCode: 'EUR' },
      createdAt: '2026-05-01T00:00:00.000Z',
      'description({"excerpt":true})': 'Solo resumen',
    });

    const result = extractStructured(html, url);
    expect(result!.gofundme_created_at).toBe('2026-05-01T00:00:00.000Z');
    expect(result!.description).toBe('Solo resumen');
  });

  it('devuelve null si no hay __NEXT_DATA__ o no hay Fundraiser con monto', () => {
    expect(extractStructured('<html></html>', url)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- gofundme-parse`
Expected: FAIL — `Failed to resolve import './gofundme-parse'` (el módulo aún no existe).

- [ ] **Step 3: Crear `src/lib/ingest/gofundme-parse.ts`**

Crea el archivo con todo el parseo puro (sin `server-only`, sin red):

```ts
import type { IExtractedCampaign } from '@/types';

// ---------------------------------------------------------------------------
// Parseo PURO de páginas de GoFundMe. Sin red ni `server-only`: testeable en
// Node. La orquestación con red y el respaldo por IA viven en gofundme.ts.
// ---------------------------------------------------------------------------

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function matchMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      'i',
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

// Convierte el HTML de la historia de GoFundMe a texto plano preservando los
// saltos de párrafo (a diferencia de htmlToText, que aplana todo a una línea
// para la IA). Bloques (</div>, </p>) y <br> se vuelven saltos de línea.
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:div|p|li|h[1-6])\s*>/gi, '\n');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  return decodeEntities(stripped)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

interface IMoney {
  amount: number;
  currencyCode: string;
}

function isMoney(value: unknown): value is IMoney {
  if (!value || typeof value !== 'object') return false;
  const money = value as Record<string, unknown>;
  return (
    typeof money.amount === 'number' &&
    Number.isFinite(money.amount) &&
    money.amount >= 0
  );
}

function parseNextData(html: string): unknown {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Recorre el JSON normalizado de Apollo y junta las campañas (la principal
// trae `currentAmount`; las relacionadas del sidebar no).
function collectFundraisers(
  node: unknown,
  out: Record<string, unknown>[],
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectFundraisers(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.__typename === 'Fundraiser' && isMoney(obj.currentAmount)) {
    out.push(obj);
  }
  for (const value of Object.values(obj)) collectFundraisers(value, out);
}

function slugFromUrl(url: string): string | null {
  const m = url.match(/gofundme\.com\/f\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

// Fecha real de GoFundMe: publishedAt (cuándo se hizo pública) o createdAt.
function readGoFundMeDate(fund: Record<string, unknown>): string | null {
  return readString(fund, 'publishedAt') ?? readString(fund, 'createdAt');
}

// Historia completa: clave excerpt:false; si no, excerpt:true.
function readDescription(fund: Record<string, unknown>): string | null {
  const full =
    readString(fund, 'description({"excerpt":false})') ??
    readString(fund, 'description({"excerpt":true})');
  if (!full) return null;
  const text = htmlToPlainText(full);
  return text ? text.slice(0, 20000) : null;
}

// Datos estructurados (fuente de verdad para montos, descripción y fecha).
export function extractStructured(
  html: string,
  url: string,
): IExtractedCampaign | null {
  const data = parseNextData(html);
  if (!data) return null;

  const funds: Record<string, unknown>[] = [];
  collectFundraisers(data, funds);
  if (funds.length === 0) return null;

  const slug = slugFromUrl(url);
  const fund =
    funds.find((f) => slug && f.defaultSlug === slug) ?? funds[0];

  const current = isMoney(fund.currentAmount) ? fund.currentAmount : null;
  const goal = isMoney(fund.goalAmount) ? fund.goalAmount : null;
  if (current === null && goal === null) return null;

  const currency = current?.currencyCode ?? goal?.currencyCode ?? null;
  const title = readString(fund, 'title');

  return {
    title: title ? decodeEntities(title) : null,
    description: readDescription(fund),
    image_url: readString(fund, 'fundraiserImageUrl'),
    goal_amount: goal?.amount ?? null,
    raised_amount: current?.amount ?? null,
    currency: currency ? currency.toUpperCase() : null,
    gofundme_created_at: readGoFundMeDate(fund),
  };
}

// Respaldo por regex: si cambia el wrapper de Next pero el JSON sigue ahí.
function matchMoneyByKey(html: string, key: string): IMoney | null {
  const re = new RegExp(
    `"${key}"\\s*:\\s*\\{[^}]*?"amount"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)[^}]*?"currencyCode"\\s*:\\s*"([A-Z]{3})"`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  const amount = Number(m[1]);
  return Number.isFinite(amount) ? { amount, currencyCode: m[2] } : null;
}

export function extractMoneyByRegex(html: string): Partial<IExtractedCampaign> {
  const current = matchMoneyByKey(html, 'currentAmount');
  const goal = matchMoneyByKey(html, 'goalAmount');
  return {
    goal_amount: goal?.amount ?? null,
    raised_amount: current?.amount ?? null,
    currency:
      (current?.currencyCode ?? goal?.currencyCode ?? null)?.toUpperCase() ??
      null,
  };
}
```

> Nota: el test arma el `__NEXT_DATA__` con la entidad `Fundraiser` directamente bajo `apollo.fundraiser`; `collectFundraisers` la encuentra recorriendo el árbol, así que la ruta exacta no importa.

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- gofundme-parse`
Expected: PASS (todos los `describe`).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/ingest/gofundme-parse.ts src/lib/ingest/gofundme-parse.test.ts
git commit -m "feat: pure gofundme parser with full description and real publish date"
```

---

### Task 3: Cablear el parser puro en `gofundme.ts`

**Files:**
- Modify: `src/lib/ingest/gofundme.ts`

- [ ] **Step 1: Reescribir `gofundme.ts` para usar el parser puro**

Reemplaza el contenido de `src/lib/ingest/gofundme.ts` por (mantiene red + IA; importa el parseo):

```ts
import 'server-only';
import { generateText } from 'ai';
import { z } from 'zod';
import { getAiModel, hasGatewayAuth, parseJsonObject } from '@/lib/ai/client';
import { isGoFundMe, isGoFundMeShortLink } from '@/lib/campaign';
import {
  decodeEntities,
  extractMoneyByRegex,
  extractStructured,
  matchMeta,
} from '@/lib/ingest/gofundme-parse';
import type { IExtractedCampaign } from '@/types';

const BROWSER_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html',
};

// Sigue la redirección de un enlace corto (gofund.me/…) hasta la URL canónica.
export async function resolveGoFundMeUrl(url: string): Promise<string> {
  if (!isGoFundMeShortLink(url)) return url;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: BROWSER_HEADERS,
      cache: 'no-store',
    });
    const finalUrl = res.url || url;
    const slug = finalUrl.match(/\/f\/([^/?#]+)/i);
    return slug
      ? `https://www.gofundme.com/f/${slug[1].toLowerCase()}`
      : finalUrl;
  } catch {
    return url;
  }
}

// IA como último recurso para los montos. Reutiliza el gateway de moderación.
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

const aiAmountsSchema = z.object({
  raised_amount: z.number().nonnegative().nullable(),
  goal_amount: z.number().nonnegative().nullable(),
  currency: z.string().min(3).max(3).nullable(),
});

async function fromAi(html: string): Promise<Partial<IExtractedCampaign> | null> {
  if (!hasGatewayAuth()) return null;

  const text = htmlToText(html).slice(0, 6000);

  try {
    const { text: out } = await generateText({
      model: getAiModel(),
      prompt: `Esta es una página de GoFundMe (texto visible, recortado). Extrae el monto RECAUDADO, la META y la moneda de la campaña principal.

Texto:
"""
${text}
"""

Reglas:
- Devuelve los montos como números enteros sin separadores ni símbolos (ej: 5576300, no "$5,576,300" ni "5.6M").
- Si un dato no aparece con claridad, usa null.
- "currency" es el código ISO de 3 letras (ej: "USD"); si no es claro, null.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{ "raised_amount": number|null, "goal_amount": number|null, "currency": "string"|null }`,
    });

    const parsed = aiAmountsSchema.safeParse(parseJsonObject(out));
    if (!parsed.success) return null;
    return {
      raised_amount: parsed.data.raised_amount,
      goal_amount: parsed.data.goal_amount,
      currency: parsed.data.currency ? parsed.data.currency.toUpperCase() : null,
    };
  } catch {
    return null;
  }
}

// Orquestador: estructura → regex → IA, completando con metadatos og:.
export async function extractFromGoFundMe(
  url: string,
): Promise<IExtractedCampaign> {
  const empty: IExtractedCampaign = {
    title: null,
    description: null,
    image_url: null,
    goal_amount: null,
    raised_amount: null,
    currency: null,
    gofundme_created_at: null,
  };

  if (!isGoFundMe(url)) return empty;

  let html: string;
  let finalUrl = url;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) return empty;
    finalUrl = res.url || url;
    html = await res.text();
  } catch {
    return empty;
  }

  const ogTitle = matchMeta(html, 'og:title');
  const ogDescription = matchMeta(html, 'og:description');
  const ogImage = matchMeta(html, 'og:image');

  const structured = extractStructured(html, finalUrl);
  const regex = extractMoneyByRegex(html);

  const haveAmounts =
    structured?.raised_amount != null ||
    structured?.goal_amount != null ||
    regex.raised_amount != null ||
    regex.goal_amount != null;
  const ai = haveAmounts ? null : await fromAi(html);

  const raised_amount =
    structured?.raised_amount ?? regex.raised_amount ?? ai?.raised_amount ?? null;
  const goal_amount =
    structured?.goal_amount ?? regex.goal_amount ?? ai?.goal_amount ?? null;
  const currency =
    structured?.currency ?? regex.currency ?? ai?.currency ?? null;

  return {
    title: structured?.title ?? ogTitle,
    // La historia completa (structured) gana al resumen truncado de og:.
    description: structured?.description ?? ogDescription,
    image_url: structured?.image_url ?? ogImage,
    goal_amount,
    raised_amount,
    currency,
    gofundme_created_at: structured?.gofundme_created_at ?? null,
  };
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (Si `tsc` no está como script, `npx tsc --noEmit` usa el `typescript` del proyecto.)

- [ ] **Step 3: Re-correr tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ingest/gofundme.ts
git commit -m "feat: wire pure parser into gofundme ingest, capture publish date"
```

---

### Task 4: `formatCampaignAge` para el tag de antigüedad

**Files:**
- Modify: `src/lib/format.ts`
- Create: `src/lib/format.test.ts` (reemplaza el smoke test de la Task 1)

- [ ] **Step 1: Escribir el test que falla**

Reemplaza `src/lib/format.test.ts` por:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatPct, formatCampaignAge } from './format';

describe('formatPct', () => {
  it('formatea fracción a porcentaje', () => {
    expect(formatPct(0.5)).toBe('50%');
  });
});

describe('formatCampaignAge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number): string =>
    new Date(Date.now() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('null o fecha inválida → null', () => {
    expect(formatCampaignAge(null)).toBeNull();
    expect(formatCampaignAge('no-date')).toBeNull();
  });

  it('momentos / minutos / horas', () => {
    expect(formatCampaignAge(ago(10_000))).toBe('hace un momento');
    expect(formatCampaignAge(ago(5 * MIN))).toBe('hace 5 min');
    expect(formatCampaignAge(ago(3 * HOUR))).toBe('hace 3 h');
  });

  it('días / semanas / meses / años', () => {
    expect(formatCampaignAge(ago(2 * DAY))).toBe('hace 2 días');
    expect(formatCampaignAge(ago(14 * DAY))).toBe('hace 2 semanas');
    expect(formatCampaignAge(ago(60 * DAY))).toBe('hace 2 meses');
    expect(formatCampaignAge(ago(400 * DAY))).toBe('hace 1 año');
  });

  it('singulares', () => {
    expect(formatCampaignAge(ago(1 * DAY))).toBe('hace 1 día');
    expect(formatCampaignAge(ago(7 * DAY))).toBe('hace 1 semana');
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test -- format`
Expected: FAIL — `formatCampaignAge is not a function` / no exportada.

- [ ] **Step 3: Implementar `formatCampaignAge`**

Añade al final de `src/lib/format.ts`:

```ts
// "hace 2 semanas", "hace 3 meses" — antigüedad de publicación de una campaña.
// Extiende a semanas/meses/años (formatRelativeTime se queda en días, para
// "qué tan fresco es un dato"). Entrada: timestamp ISO (o null).
export function formatCampaignAge(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return 'hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (d < 30) return w === 1 ? 'hace 1 semana' : `hace ${w} semanas`;
  const mo = Math.floor(d / 30);
  if (d < 365) return mo === 1 ? 'hace 1 mes' : `hace ${mo} meses`;
  const y = Math.floor(d / 365);
  return y === 1 ? 'hace 1 año' : `hace ${y} años`;
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: formatCampaignAge for publish-age tag (weeks/months/years)"
```

---

### Task 5: Migración 0012 — columna de fecha, límite de descripción y vista

**Files:**
- Create: `supabase/migrations/0012_gofundme_published_at.sql`

- [ ] **Step 1: Escribir la migración**

Crea `supabase/migrations/0012_gofundme_published_at.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Aplica el contenido del archivo vía el MCP de Supabase (`apply_migration`, name `0012_gofundme_published_at`, project_id `kthfsjbaqfvmciibydxh`), o con `supabase db push` si el CLI está linkeado.

- [ ] **Step 3: Verificar columna y vista**

Ejecuta vía MCP `execute_sql` (project `kthfsjbaqfvmciibydxh`):

```sql
select column_name from information_schema.columns
where table_name = 'campaigns_with_stats'
  and column_name in ('gofundme_created_at', 'published_at')
order by column_name;
```

Expected: dos filas — `gofundme_created_at` y `published_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_gofundme_published_at.sql
git commit -m "feat(db): add gofundme_created_at, raise description limit, expose published_at"
```

---

### Task 6: Tipos `ICampaign` / `ICampaignWithStats`

**Files:**
- Modify: `src/types/index.ts:36-74`

- [ ] **Step 1: Añadir los campos**

En `ICampaign`, tras `last_synced_at` y antes de `created_at`:

```ts
  last_synced_at: string | null;
  // Fecha real de publicación en GoFundMe (null si manual o aún sin scrapear).
  gofundme_created_at: string | null;
  created_at: string;
```

En `ICampaignWithStats`, añade `published_at` (coalesce resuelto por la vista):

```ts
export interface ICampaignWithStats extends ICampaign {
  author_name: string;
  verified_by_name: string | null;
  // coalesce(gofundme_created_at, created_at): fecha para tag/filtro de antigüedad.
  published_at: string;
  trust_count: number;
  distrust_count: number;
  total_votes: number;
  open_reports: number;
  collection_pct: number | null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): gofundme_created_at on ICampaign, published_at on stats"
```

---

### Task 7: Persistir la fecha al crear/editar campaña

**Files:**
- Modify: `src/components/CampaignForm.tsx`
- Modify: `src/lib/actions/campaigns.ts`

- [ ] **Step 1: Form — añadir el campo al estado y hidden input**

En `src/components/CampaignForm.tsx`, en `IFormState` añade el campo (junto a `ai_raised_amount`):

```ts
  ai_goal_amount: string;
  ai_raised_amount: string;
  // Fecha real de GoFundMe leída al autocompletar (oculta; no editable).
  gofundme_created_at: string;
```

En `initialState`, añade:

```ts
    ai_raised_amount:
      campaign?.ai_raised_amount != null ? String(campaign.ai_raised_amount) : "",
    gofundme_created_at: campaign?.gofundme_created_at ?? "",
```

En `handleExtract`, dentro del `setForm((prev) => ({ ...prev, ... }))`, añade:

```ts
        ai_raised_amount:
          d.raised_amount != null ? String(d.raised_amount) : prev.ai_raised_amount,
        gofundme_created_at: d.gofundme_created_at ?? prev.gofundme_created_at,
```

Junto a los hidden inputs `ai_goal_amount` / `ai_raised_amount` (en el bloque `rounded-xl border border-accent/30`), añade:

```tsx
        <input type="hidden" name="ai_raised_amount" value={form.ai_raised_amount} />
        <input
          type="hidden"
          name="gofundme_created_at"
          value={form.gofundme_created_at}
        />
```

Sube el `maxLength` del textarea de descripción de `5000` a `20000`:

```tsx
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={20000}
          rows={6}
```

- [ ] **Step 2: Acción — parsear y guardar la fecha**

En `src/lib/actions/campaigns.ts`, añade un helper de fecha tras `parseAmount`:

```ts
// Valida que el valor sea una fecha ISO razonable; si no, null.
function parseIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}
```

Añade `gofundme_created_at` a `IParsedCampaign`:

```ts
  goal_amount: number | null;
  raised_amount: number;
  currency: string;
  gofundme_created_at: string | null;
```

En `parseCampaignForm`, antes del `return { data: {...} }`, lee el campo:

```ts
  const gofundme_created_at = parseIsoDate(
    String(formData.get('gofundme_created_at') ?? ''),
  );
```

y añádelo al objeto `data`:

```ts
      goal_amount,
      raised_amount,
      currency,
      gofundme_created_at,
```

`gofundme_created_at` viaja dentro de `parsed.data`, así que el `insert` con `...parsed.data` (createCampaign) y el `update(parsed.data)` (updateCampaign) ya lo guardan. No se requieren más cambios en esas funciones.

- [ ] **Step 3: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

1. `npm run dev`, ir a `/nueva` (con sesión).
2. Pegar un enlace real de GoFundMe y "Autocompletar".
3. Confirmar que la **descripción llega completa** (no truncada) y publicar.
4. Vía MCP `execute_sql`: `select gofundme_created_at, char_length(description) from campaigns order by created_at desc limit 1;` → `gofundme_created_at` no nulo y longitud > resumen.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignForm.tsx src/lib/actions/campaigns.ts
git commit -m "feat: persist gofundme publish date and full description on create/edit"
```

---

### Task 8: Filtro por antigüedad en el feed

**Files:**
- Modify: `src/lib/data/campaigns.ts:45-84`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Data layer — filtro `minAgeHours`**

En `src/lib/data/campaigns.ts`, en `ICampaignFilters` añade:

```ts
  // Solo campañas alojadas en GoFundMe (eje independiente).
  gofundmeOnly?: boolean;
  // Solo campañas publicadas hace MÁS de N horas (descarta recién creadas).
  minAgeHours?: number;
}
```

En `getCampaigns`, tras el bloque `if (filters.gofundmeOnly) ...`, añade:

```ts
  if (filters.minAgeHours && filters.minAgeHours > 0) {
    const cutoff = new Date(
      Date.now() - filters.minAgeHours * 3600 * 1000,
    ).toISOString();
    query = query.lte('published_at', cutoff);
  }
```

- [ ] **Step 2: Page — parsear el parámetro y el select**

En `src/app/page.tsx`, añade `antiguedad` a `searchParams`:

```ts
    verificadas?: string;
    gofundme?: string;
    antiguedad?: string;
  }>;
```

Tras `const gofundmeOnly = params.gofundme === "1";` añade el mapeo:

```ts
  const AGE_HOURS: Record<string, number> = { "1h": 1, "1d": 24, "1w": 168 };
  const ageKey = params.antiguedad ?? "";
  const minAgeHours = AGE_HOURS[ageKey];
```

Pasa el filtro a `getCampaigns`:

```ts
    getCampaigns({ region, category, tags, verifiedOnly, gofundmeOnly, minAgeHours }),
```

Incluye el filtro en `hasFilter`:

```ts
  const hasFilter = Boolean(
    region || category || tags.length > 0 || verifiedOnly || gofundmeOnly || minAgeHours,
  );
```

Añade el `<select>` en el `<form>` de filtros, tras el bloque de Región y antes del primer checkbox `label`:

```tsx
        <div className="space-y-1.5">
          <label htmlFor="antiguedad" className="block text-xs text-muted font-medium">
            Publicadas
          </label>
          <select
            id="antiguedad"
            name="antiguedad"
            defaultValue={ageKey}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/50 transition-colors"
          >
            <option value="">En cualquier momento</option>
            <option value="1h">Hace más de 1 hora</option>
            <option value="1d">Hace más de 1 día</option>
            <option value="1w">Hace más de 1 semana</option>
          </select>
        </div>
```

- [ ] **Step 3: Verificar tipos, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

1. `npm run dev`, ir a `/`.
2. Elegir "Hace más de 1 hora" → Filtrar. Las campañas con `published_at` dentro de la última hora desaparecen; el contador "Mostrando X de Y" baja.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/campaigns.ts src/app/page.tsx
git commit -m "feat: filter feed by minimum publish age"
```

---

### Task 9: Tag de antigüedad en card y detalle

**Files:**
- Modify: `src/components/CampaignCard.tsx`
- Modify: `src/app/campana/[id]/page.tsx`

- [ ] **Step 1: Card — mostrar la antigüedad**

En `src/components/CampaignCard.tsx`, importa el formateador:

```ts
import { formatMoney, formatPct, formatCampaignAge } from "@/lib/format";
```

Dentro de `CampaignCard`, tras `const fromGoFundMe = ...`:

```ts
  const age = formatCampaignAge(campaign.published_at);
```

En la fila meta del footer, muestra la edad junto a la región:

```tsx
          <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-muted">
            <span>📍 {campaign.region}</span>
            {age && <span aria-label="Antigüedad">🕐 {age}</span>}
            {fromGoFundMe ? (
```

- [ ] **Step 2: Detalle — mostrar la antigüedad**

En `src/app/campana/[id]/page.tsx`, importa `formatCampaignAge` (junto a los otros de `@/lib/format`):

```ts
import {
  formatDate,
  formatMoney,
  formatPct,
  formatRelativeTime,
  formatCampaignAge,
} from "@/lib/format";
```

Calcula la edad tras `const fromGoFundMe = ...`:

```ts
  const publishedAge = formatCampaignAge(campaign.published_at);
```

Muéstrala bajo el autor (tras el `<p>` "Publicada por …"):

```tsx
          <p className="text-sm text-muted">
            Publicada por {campaign.author_name}
            {publishedAge ? ` · 🕐 ${publishedAge}` : ""}
          </p>
```

- [ ] **Step 3: Verificar tipos, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

`npm run dev` → el feed y el detalle muestran "🕐 hace N …" según `published_at` (fecha real de GoFundMe cuando exista, si no `created_at`).

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignCard.tsx src/app/campana/[id]/page.tsx
git commit -m "feat: show publish-age tag on card and detail"
```

---

### Task 10: Link directo a GoFundMe + menú "⋯" para reportar en el feed

**Files:**
- Create: `src/components/CampaignCardMenu.tsx`
- Modify: `src/components/CampaignCard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Crear el menú (client component)**

Crea `src/components/CampaignCardMenu.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { reportCampaign } from "@/lib/actions/reports";

interface ICampaignCardMenuProps {
  campaignId: string;
  isAuthenticated: boolean;
}

export function CampaignCardMenu({
  campaignId,
  isAuthenticated,
}: ICampaignCardMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
        setReporting(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openReport(): void {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setReporting(true);
  }

  function submitReport(): void {
    setError(null);
    startTransition(async () => {
      const result = await reportCampaign(campaignId, reason);
      if (result.error) setError(result.error);
      else {
        setDone(true);
        setReporting(false);
      }
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full bg-background/90 backdrop-blur-sm border border-border text-muted hover:text-foreground"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-60 rounded-xl border border-border bg-card shadow-lg p-2 z-20 text-left">
          {done ? (
            <p className="text-xs text-muted p-2">
              🚩 Reporte enviado. El equipo lo revisará.
            </p>
          ) : reporting ? (
            <div className="space-y-2">
              <label
                htmlFor={`report-${campaignId}`}
                className="block text-xs font-medium"
              >
                ¿Por qué la reportas?
              </label>
              <textarea
                id={`report-${campaignId}`}
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: parece duplicada / posible estafa"
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
              />
              {error && <p className="text-xs text-distrust">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending || !reason.trim()}
                  onClick={submitReport}
                  className="rounded-md bg-distrust text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openReport}
              className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-background text-distrust"
            >
              🚩 Reportar campaña
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reestructurar `CampaignCard` — overlay de acciones + badge inline**

En `src/components/CampaignCard.tsx`, importa el menú:

```ts
import { CampaignCardMenu } from "@/components/CampaignCardMenu";
```

Añade `isAuthenticated` a las props:

```ts
interface ICampaignCardProps {
  campaign: ICampaignWithStats;
  isAuthenticated: boolean;
}

export function CampaignCard({ campaign, isAuthenticated }: ICampaignCardProps) {
```

**Quita** el `VerifiedBadge` de la esquina de la imagen (elimina este bloque):

```tsx
          {campaign.is_verified && (
            <div className="absolute top-3 right-3">
              <VerifiedBadge />
            </div>
          )}
```

Añade, como **hermano del `<Link>`** (justo antes de `</article>`), el overlay de acciones — fuera del anchor para no anidar interactivos:

```tsx
      </Link>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {fromGoFundMe && campaign.donation_url && (
          <a
            href={campaign.donation_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50"
          >
            GoFundMe ↗
          </a>
        )}
        <CampaignCardMenu
          campaignId={campaign.id}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </article>
```

Muestra el `VerifiedBadge` inline junto al título (en el body), reemplazando el `<h3>` actual por:

```tsx
          <div className="flex items-start gap-2">
            <h3 className="font-display text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {campaign.title}
            </h3>
            {campaign.is_verified && (
              <span className="mt-0.5 shrink-0">
                <VerifiedBadge />
              </span>
            )}
          </div>
```

(El import de `VerifiedBadge` ya existe; mantenlo.)

- [ ] **Step 3: Pasar `isAuthenticated` desde el feed**

En `src/app/page.tsx`, donde se renderiza `<CampaignCard campaign={campaign} />`:

```tsx
              <CampaignCard campaign={campaign} isAuthenticated={Boolean(profile)} />
```

- [ ] **Step 4: Verificar tipos, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sin errores; build OK.

- [ ] **Step 5: Verificación manual**

1. `npm run dev`, ir a `/`.
2. En una card de GoFundMe: el pill **`GoFundMe ↗`** abre la campaña en pestaña nueva (no navega al detalle).
3. Botón **`⋯`** abre el menú; "Reportar" → sin sesión redirige a `/login`; con sesión muestra el textarea y envía (aparece "Reporte enviado").
4. Click fuera / `Esc` cierra el menú. El sello verificado se ve junto al título.
5. En `/operador`, el reporte aparece en "Reportes abiertos".

- [ ] **Step 6: Commit**

```bash
git add src/components/CampaignCardMenu.tsx src/components/CampaignCard.tsx src/app/page.tsx
git commit -m "feat: direct GoFundMe link and report overflow menu in feed cards"
```

---

### Task 11: Backfill de fechas para campañas existentes (operador)

**Files:**
- Modify: `src/lib/actions/operator.ts`
- Create: `src/components/BackfillDatesButton.tsx`
- Modify: `src/app/operador/page.tsx`

- [ ] **Step 1: Acción de backfill (operador-only)**

En `src/lib/actions/operator.ts`, añade imports y la acción:

```ts
import { extractFromGoFundMe } from '@/lib/ingest/gofundme';
import { isGoFundMe } from '@/lib/campaign';
```

```ts
// Backfill puntual: rellena gofundme_created_at en campañas de GoFundMe que aún
// no lo tienen, re-scrapeando con el lector de Next (no toca la Edge Function).
export async function backfillGoFundMeDates(): Promise<
  IActionResult & { updated?: number }
> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, donation_url')
    .is('gofundme_created_at', null)
    .eq('status', 'active');
  if (error) return { error: error.message };

  const targets = (data ?? []).filter(
    (c) => isGoFundMe((c as { donation_url: string | null }).donation_url),
  ) as { id: string; donation_url: string }[];

  let updated = 0;
  for (const c of targets) {
    const extracted = await extractFromGoFundMe(c.donation_url);
    if (!extracted.gofundme_created_at) continue;
    const { error: upErr } = await supabase
      .from('campaigns')
      .update({ gofundme_created_at: extracted.gofundme_created_at })
      .eq('id', c.id);
    if (!upErr) updated += 1;
  }

  revalidatePath('/');
  revalidatePath('/operador');
  return { updated };
}
```

- [ ] **Step 2: Botón cliente**

Crea `src/components/BackfillDatesButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { backfillGoFundMeDates } from "@/lib/actions/operator";

export function BackfillDatesButton() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(): void {
    setMsg(null);
    startTransition(async () => {
      const result = await backfillGoFundMeDates();
      setMsg(
        result.error
          ? result.error
          : `Listo: ${result.updated ?? 0} campañas actualizadas.`,
      );
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-card disabled:opacity-50"
      >
        {isPending ? "Rellenando…" : "Rellenar fechas GoFundMe"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Montar el botón en el panel**

En `src/app/operador/page.tsx`, importa:

```ts
import { BackfillDatesButton } from "@/components/BackfillDatesButton";
```

En el `<header>`, dentro del `div.flex.items-center.justify-between`, junto al link "Equipo":

```tsx
          <div className="flex items-center gap-2 shrink-0">
            <BackfillDatesButton />
            {isSuperAdmin && (
              <Link
                href="/operador/equipo"
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-card"
              >
                Equipo
              </Link>
            )}
          </div>
```

(Reemplaza el `{isSuperAdmin && (<Link .../>)}` anterior por el `div` de arriba.)

- [ ] **Step 4: Verificar tipos, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

1. `npm run dev`, entrar a `/operador` como operador.
2. Click "Rellenar fechas GoFundMe" → muestra "Listo: N campañas actualizadas."
3. Vía MCP `execute_sql`: `select count(*) from campaigns where gofundme_created_at is not null;` → > 0.
4. El feed muestra ahora la antigüedad real de esas campañas.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/operator.ts src/components/BackfillDatesButton.tsx src/app/operador/page.tsx
git commit -m "feat: operator backfill for existing gofundme publish dates"
```

---

## Cierre

- [ ] **Suite completa de pruebas**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests PASS, sin errores de tipos/lint, build OK.

- [ ] **Verificación end-to-end** (manual): crear campaña con descripción completa + fecha; filtro de antigüedad; tag en feed/detalle; link directo y menú de reporte; backfill de operador.

- [ ] **PR**: usar la skill `superpowers:finishing-a-development-branch` para decidir merge/PR de `feature/feed-gofundme-mejoras`.
