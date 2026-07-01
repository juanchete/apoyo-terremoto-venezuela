'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOperator } from '@/lib/data/auth';
import type { IActionResult } from '@/lib/actions/campaigns';
import { extractFromGoFundMe } from '@/lib/ingest/gofundme';
import { isGoFundMe } from '@/lib/campaign';

// Otorga o retira el sello de verificado. RLS exige rol operador.
export async function setVerified(
  campaignId: string,
  verified: boolean,
): Promise<IActionResult> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaigns')
    .update({
      is_verified: verified,
      verified_by: verified ? operator.id : null,
      verified_at: verified ? new Date().toISOString() : null,
      // Verificar cierra la revisión: libera el claim para el resto del equipo.
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/operador');
  revalidatePath('/');
  revalidatePath(`/campana/${campaignId}`);
  return {};
}

// Baja o restaura una publicación.
export async function setCampaignStatus(
  campaignId: string,
  status: 'active' | 'removed',
): Promise<IActionResult> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaigns')
    // Bajar/restaurar cierra la revisión: libera el claim.
    .update({ status, claimed_by: null, claimed_at: null })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/operador');
  revalidatePath('/');
  revalidatePath(`/campana/${campaignId}`);
  return {};
}

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

// Reparto de trabajo: un voluntario "toma" una campaña para revisarla. Aviso
// suave —no bloquea al resto—; la vigencia (CLAIM_TTL_MIN) se evalúa al leer.
// Tomar una con claim vencido simplemente lo sobrescribe.
export async function claimCampaign(campaignId: string): Promise<IActionResult> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaigns')
    .update({ claimed_by: operator.id, claimed_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/operador');
  return {};
}

// Suelta la campaña para que otro voluntario pueda tomarla.
export async function releaseCampaign(
  campaignId: string,
): Promise<IActionResult> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaigns')
    .update({ claimed_by: null, claimed_at: null })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/operador');
  return {};
}
