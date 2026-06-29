import 'server-only';
import { isGoFundMe } from '@/lib/campaign';

// Cada cuánto se considera "viejo" un monto y vale la pena re-escrapear.
const STALE_MS = 30 * 60 * 1000; // 30 minutos

export interface ISyncableCampaign {
  id: string;
  donation_url: string | null;
  raised_amount: number;
  goal_amount: number | null;
  currency: string;
  last_synced_at: string | null;
}

export interface ISyncedAmounts {
  raised_amount: number;
  goal_amount: number | null;
  currency: string;
  last_synced_at: string;
}

function isStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const ts = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STALE_MS;
}

// Refresca los montos de una campaña de GoFundMe si el dato está viejo.
//
// El scrape + escritura ocurren en la Edge Function `sync-campaign` de
// Supabase, que usa la service-role key (inyectada por Supabase, nunca sale
// del servidor). Aquí solo se la invoca con la anon key. Así un visitante no
// puede falsear montos: la función scrapea ella misma, no recibe números.
//
// Best-effort: devuelve los valores nuevos para mostrarlos sin re-leer la base,
// o null si no hubo cambios (dato fresco, no es GoFundMe, o fallo de red).
export async function refreshAmountsIfStale(
  campaign: ISyncableCampaign,
): Promise<ISyncedAmounts | null> {
  if (!isGoFundMe(campaign.donation_url)) return null;
  if (!isStale(campaign.last_synced_at)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  try {
    const res = await fetch(`${url}/functions/v1/sync-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ id: campaign.id }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = (await res.json()) as
      | (ISyncedAmounts & { updated: true })
      | { updated: false };
    if (!data.updated) return null;

    return {
      raised_amount: data.raised_amount,
      goal_amount: data.goal_amount,
      currency: data.currency,
      last_synced_at: data.last_synced_at,
    };
  } catch {
    return null;
  }
}
