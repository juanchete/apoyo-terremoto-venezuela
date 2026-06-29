'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TVoteValue } from '@/types';
import type { IActionResult } from '@/lib/actions/campaigns';

// Vota o cambia el voto. Si vuelves a votar lo mismo, se retira (toggle).
export async function castVote(
  campaignId: string,
  value: TVoteValue,
): Promise<IActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión para votar.' };

  const { data: existing } = await supabase
    .from('votes')
    .select('id, value')
    .eq('campaign_id', campaignId)
    .eq('voter_id', user.id)
    .maybeSingle<{ id: string; value: TVoteValue }>();

  if (existing && existing.value === value) {
    const { error } = await supabase.from('votes').delete().eq('id', existing.id);
    if (error) return { error: error.message };
  } else if (existing) {
    const { error } = await supabase
      .from('votes')
      .update({ value })
      .eq('id', existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('votes')
      .insert({ campaign_id: campaignId, voter_id: user.id, value });
    if (error) return { error: error.message };
  }

  revalidatePath(`/campana/${campaignId}`);
  revalidatePath('/');
  return {};
}
