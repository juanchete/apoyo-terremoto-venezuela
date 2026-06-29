'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOperator } from '@/lib/data/auth';
import type { IActionResult } from '@/lib/actions/campaigns';

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
    .update({ status })
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/operador');
  revalidatePath('/');
  revalidatePath(`/campana/${campaignId}`);
  return {};
}
