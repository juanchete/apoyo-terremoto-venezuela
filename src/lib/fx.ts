import 'server-only';

// Tasas de respaldo USD -> moneda (1 USD = N de la moneda). Solo se usan si
// la API gratuita no responde; son aproximadas y conviene revisarlas de vez
// en cuando. Las familias publican desde varios países, así que cubrimos las
// monedas más probables.
const FALLBACK_USD_RATES: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.37,
  CHF: 0.9,
  MXN: 18.5,
  COP: 4100,
  PEN: 3.75,
  CLP: 950,
  ARS: 1000,
  BRL: 5.4,
  VES: 40,
};

// USD -> moneda (mismo sentido que devuelve la API).
export type TUsdRates = Record<string, number>;

interface IErApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

// Tasas de cambio con caché de un día (Next revalida la respuesta del fetch).
// open.er-api.com es gratuito y sin API key.
export async function getUsdRates(): Promise<TUsdRates> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { ...FALLBACK_USD_RATES };

    const json = (await res.json()) as IErApiResponse;
    if (
      json.result === 'success' &&
      json.rates &&
      typeof json.rates.EUR === 'number'
    ) {
      // Mezcla: la API manda, el respaldo cubre lo que falte.
      return { ...FALLBACK_USD_RATES, ...json.rates, USD: 1 };
    }
    return { ...FALLBACK_USD_RATES };
  } catch {
    return { ...FALLBACK_USD_RATES };
  }
}

// Convierte un monto a USD usando tasas USD->moneda.
// Moneda desconocida o sin tasa: se asume que ya está en USD (no infla el total).
export function toUsd(
  amount: number,
  currency: string | null | undefined,
  rates: TUsdRates,
): number {
  if (!amount) return 0;
  const code = (currency ?? 'USD').toUpperCase();
  if (code === 'USD') return amount;
  const rate = rates[code];
  if (!rate || rate <= 0) return amount;
  return amount / rate;
}
