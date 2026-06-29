'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOperator } from '@/lib/data/auth';
import type { IActionResult } from '@/lib/actions/campaigns';

// Reporte comunitario (crowdsourced flagging). Genera alerta en el panel.
export async function reportCampaign(
  campaignId: string,
  reason: string,
): Promise<IActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión para reportar.' };

  const trimmed = reason.trim();
  if (!trimmed) return { error: 'Explica brevemente por qué reportas la campaña.' };
  if (trimmed.length > 1000) return { error: 'El reporte es demasiado largo.' };

  // upsert: un reporte por persona por campaña (reabre si ya existía).
  const { error } = await supabase.from('reports').upsert(
    { campaign_id: campaignId, reporter_id: user.id, reason: trimmed, status: 'open' },
    { onConflict: 'campaign_id,reporter_id' },
  );

  if (error) return { error: error.message };

  revalidatePath('/operador');
  revalidatePath(`/campana/${campaignId}`);
  return {};
}

// Operador: marca todos los reportes de una campaña como revisados.
export async function resolveReports(campaignId: string): Promise<IActionResult> {
  const operator = await requireOperator().catch(() => null);
  if (!operator) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('reports')
    .update({ status: 'reviewed' })
    .eq('campaign_id', campaignId)
    .eq('status', 'open');

  if (error) return { error: error.message };

  revalidatePath('/operador');
  return {};
}
