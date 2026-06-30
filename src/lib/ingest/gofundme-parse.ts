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
