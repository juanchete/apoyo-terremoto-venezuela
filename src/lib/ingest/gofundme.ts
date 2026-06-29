import 'server-only';
import type { IExtractedCampaign } from '@/types';

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

function matchNumber(html: string, keys: string[]): number | null {
  for (const key of keys) {
    const m = html.match(new RegExp(`"${key}"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?`, 'i'));
    if (m) {
      const value = Number(m[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

const isGoFundMe = (url: string): boolean => /gofundme\.com/i.test(url);

// Best-effort: GoFundMe a veces bloquea el scraping o carga montos por JS.
// Lo que no se logre extraer queda en null para llenarse a mano.
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

    const html = await res.text();

    return {
      title: matchMeta(html, 'og:title'),
      description: matchMeta(html, 'og:description'),
      image_url: matchMeta(html, 'og:image'),
      goal_amount: matchNumber(html, ['goal_amount', 'goalAmount', 'goal']),
      raised_amount: matchNumber(html, [
        'current_amount',
        'currentAmount',
        'raised_amount',
        'amountRaised',
      ]),
      currency: matchMeta(html, 'og:price:currency') ?? null,
    };
  } catch {
    return empty;
  }
}
