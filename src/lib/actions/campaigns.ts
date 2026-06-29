'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { analyzeCampaign } from '@/lib/ai/moderation';
import type { TNeedCategory } from '@/types';

export interface IActionResult {
  error?: string;
}

const VALID_CATEGORIES: readonly TNeedCategory[] = [
  'medical',
  'funeral',
  'recovery',
  'children',
  'other',
];

interface IParsedCampaign {
  title: string;
  description: string;
  region: string;
  category: TNeedCategory;
  donation_url: string | null;
  payment_details: string | null;
  image_url: string | null;
  goal_amount: number | null;
  raised_amount: number;
  currency: string;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseCampaignForm(
  formData: FormData,
): { error: string } | { data: IParsedCampaign } {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const category = String(formData.get('category') ?? '') as TNeedCategory;
  const donation_url = normalizeUrl(String(formData.get('donation_url') ?? ''));
  const payment_details =
    String(formData.get('payment_details') ?? '').trim() || null;
  const image_url = normalizeUrl(String(formData.get('image_url') ?? ''));
  const goal_amount = parseAmount(String(formData.get('goal_amount') ?? ''));
  const raised_amount =
    parseAmount(String(formData.get('raised_amount') ?? '')) ?? 0;
  const currency = (String(formData.get('currency') ?? 'USD').trim() || 'USD')
    .toUpperCase()
    .slice(0, 3);

  if (title.length < 5) return { error: 'El título debe tener al menos 5 caracteres.' };
  if (description.length < 20)
    return { error: 'La descripción debe tener al menos 20 caracteres.' };
  if (!region) return { error: 'Selecciona la región afectada.' };
  if (!VALID_CATEGORIES.includes(category))
    return { error: 'Selecciona una categoría de necesidad.' };
  if (!donation_url && !payment_details)
    return { error: 'Agrega un enlace de donación o datos de pago.' };

  return {
    data: {
      title,
      description,
      region,
      category,
      donation_url,
      payment_details,
      image_url,
      goal_amount,
      raised_amount,
      currency,
    },
  };
}

export async function createCampaign(formData: FormData): Promise<IActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión para publicar una campaña.' };

  const parsed = parseCampaignForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  // Filtro inicial con IA (relevancia + duplicados). Best-effort.
  const { data: existing } = await supabase
    .from('campaigns')
    .select('title')
    .eq('status', 'active')
    .limit(50);

  const ai = await analyzeCampaign({
    title: parsed.data.title,
    description: parsed.data.description,
    donationUrl: parsed.data.donation_url,
    existingTitles: (existing ?? []).map((c) => c.title as string),
  });

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      author_id: user.id,
      ...parsed.data,
      ai_status: ai.status,
      ai_notes: ai.notes,
    })
    .select('id')
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath('/');
  redirect(`/campana/${data.id}`);
}

export async function updateCampaign(
  campaignId: string,
  formData: FormData,
): Promise<IActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión para editar.' };

  const parsed = parseCampaignForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  // RLS garantiza que solo el autor (o un operador) pueda actualizar.
  const { error } = await supabase
    .from('campaigns')
    .update(parsed.data)
    .eq('id', campaignId);

  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath(`/campana/${campaignId}`);
  redirect(`/campana/${campaignId}`);
}

export async function deleteOwnCampaign(campaignId: string): Promise<IActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) return { error: error.message };
  revalidatePath('/');
  redirect('/');
}
