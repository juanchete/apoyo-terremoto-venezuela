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
    // La sugerencia de tipo de beneficiario la calcula la acción de ingesta
    // (extractCampaign), no el scraper: así el backfill/sync no pagan esa IA.
    beneficiary_type: null,
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
    beneficiary_type: null,
  };
}
