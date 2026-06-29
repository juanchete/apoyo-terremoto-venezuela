import 'server-only';
import { generateText } from 'ai';
import { z } from 'zod';
import { getAiModel, hasGatewayAuth, parseJsonObject } from '@/lib/ai/client';
import type { IExtractedCampaign } from '@/types';

const isGoFundMe = (url: string): boolean => /gofundme\.com/i.test(url);

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function matchMeta(html: string, property: string): string | null {
  // Soporta property="og:x" y name="x" en cualquier orden de atributos.
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

// ---------------------------------------------------------------------------
// 1) Vía principal: datos estructurados embebidos por GoFundMe (__NEXT_DATA__).
//    Los montos viven como objetos Money: {"amount": 5576300,"currencyCode":"USD"}.
//    `amount` está en unidades enteras de la moneda (no centavos).
// ---------------------------------------------------------------------------

interface IMoney {
  amount: number;
  currencyCode: string;
}

interface IFundraiserEntity {
  __typename?: string;
  title?: string;
  defaultSlug?: string;
  donationCount?: number;
  fundraiserImageUrl?: string;
  currentAmount?: IMoney;
  goalAmount?: IMoney;
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
function collectFundraisers(node: unknown, out: IFundraiserEntity[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectFundraisers(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.__typename === 'Fundraiser' && isMoney(obj.currentAmount)) {
    out.push(obj as IFundraiserEntity);
  }
  for (const value of Object.values(obj)) collectFundraisers(value, out);
}

function slugFromUrl(url: string): string | null {
  const m = url.match(/gofundme\.com\/f\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function fromStructuredData(html: string, url: string): IExtractedCampaign | null {
  const data = parseNextData(html);
  if (!data) return null;

  const funds: IFundraiserEntity[] = [];
  collectFundraisers(data, funds);
  if (funds.length === 0) return null;

  // Si hay varias, prioriza la que coincide con el slug de la URL.
  const slug = slugFromUrl(url);
  const fund = funds.find((f) => slug && f.defaultSlug === slug) ?? funds[0];

  const raised = isMoney(fund.currentAmount) ? fund.currentAmount.amount : null;
  const goal = isMoney(fund.goalAmount) ? fund.goalAmount.amount : null;
  if (raised === null && goal === null) return null;

  const currency =
    fund.currentAmount?.currencyCode ?? fund.goalAmount?.currencyCode ?? null;

  return {
    title: fund.title ? decodeEntities(fund.title) : null,
    description: null,
    image_url: fund.fundraiserImageUrl ?? null,
    goal_amount: goal,
    raised_amount: raised,
    currency: currency ? currency.toUpperCase() : null,
  };
}

// ---------------------------------------------------------------------------
// 2) Respaldo por regex: si cambia el wrapper de Next pero el JSON sigue ahí.
// ---------------------------------------------------------------------------

function matchMoneyByKey(html: string, key: string): IMoney | null {
  // "currentAmount":{"__typename":"Money","amount":5576300,"currencyCode":"USD"}
  const re = new RegExp(
    `"${key}"\\s*:\\s*\\{[^}]*?"amount"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)[^}]*?"currencyCode"\\s*:\\s*"([A-Z]{3})"`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  const amount = Number(m[1]);
  return Number.isFinite(amount) ? { amount, currencyCode: m[2] } : null;
}

function fromRegex(html: string): Partial<IExtractedCampaign> {
  const current = matchMoneyByKey(html, 'currentAmount');
  const goal = matchMoneyByKey(html, 'goalAmount');
  return {
    goal_amount: goal?.amount ?? null,
    raised_amount: current?.amount ?? null,
    currency: (current?.currencyCode ?? goal?.currencyCode ?? null)?.toUpperCase() ?? null,
  };
}

// ---------------------------------------------------------------------------
// 3) Último recurso: IA. Cuando GoFundMe cambia de estructura, le pasamos el
//    texto visible y que ella deduzca los montos. Sin API de pago: reutiliza
//    el mismo gateway (OpenRouter) que la moderación.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Orquestador: estructura → regex → IA, completando con metadatos og: para
// título/descripción/imagen.
// ---------------------------------------------------------------------------

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
  };

  if (!isGoFundMe(url)) return empty;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html',
      },
      // No cachear: los montos cambian.
      cache: 'no-store',
    });
    if (!res.ok) return empty;
    html = await res.text();
  } catch {
    return empty;
  }

  // Metadatos og: como base para texto e imagen.
  const ogTitle = matchMeta(html, 'og:title');
  const ogDescription = matchMeta(html, 'og:description');
  const ogImage = matchMeta(html, 'og:image');

  // 1) Datos estructurados (fuente de verdad para los montos).
  const structured = fromStructuredData(html, url);

  // 2) Regex como respaldo de montos.
  const regex = fromRegex(html);

  // 3) IA solo si todo lo anterior falló en los montos.
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
    description: ogDescription,
    image_url: structured?.image_url ?? ogImage,
    goal_amount,
    raised_amount,
    currency,
  };
}
