'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { analyzeCampaign } from '@/lib/ai/moderation';
import { findActiveCampaignByLink, type ICampaignRef } from '@/lib/data/campaigns';
import { resolveGoFundMeUrl } from '@/lib/ingest/gofundme';
import { NEED_CATEGORIES, isCampaignTag } from '@/lib/constants';
import type { TCampaignTag, TNeedCategory } from '@/types';

export interface IActionResult {
  error?: string;
  // Si el enlace ya existe, la campaña publicada (para enlazarla en el aviso).
  existing?: ICampaignRef;
}

// Lista blanca derivada de la única fuente de verdad de categorías.
const VALID_CATEGORIES: readonly TNeedCategory[] = NEED_CATEGORIES.map(
  (c) => c.value,
);

interface IParsedCampaign {
  title: string;
  description: string;
  region: string;
  category: TNeedCategory;
  tags: TCampaignTag[];
  donation_url: string | null;
  payment_details: string | null;
  image_url: string | null;
  goal_amount: number | null;
  raised_amount: number;
  currency: string;
  gofundme_created_at: string | null;
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

// Valida que el valor sea una fecha ISO razonable; si no, null.
function parseIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

function parseCampaignForm(
  formData: FormData,
): { error: string } | { data: IParsedCampaign } {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const category = String(formData.get('category') ?? '') as TNeedCategory;
  // Tags: solo se aceptan los de la lista curada; se descartan duplicados.
  const tags = Array.from(
    new Set(
      formData
        .getAll('tags')
        .map((t) => String(t))
        .filter(isCampaignTag),
    ),
  );
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
  const gofundme_created_at = parseIsoDate(
    String(formData.get('gofundme_created_at') ?? ''),
  );

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
      tags,
      donation_url,
      payment_details,
      image_url,
      goal_amount,
      raised_amount,
      currency,
      gofundme_created_at,
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

  // Resuelve enlaces cortos (gofund.me/…) a la URL canónica antes de guardar.
  if (parsed.data.donation_url) {
    parsed.data.donation_url = await resolveGoFundMeUrl(parsed.data.donation_url);
  }

  // Sin duplicados: una campaña de GoFundMe no se puede publicar dos veces.
  if (parsed.data.donation_url) {
    const existing = await findActiveCampaignByLink(parsed.data.donation_url);
    if (existing) {
      return {
        error: `Esta campaña de GoFundMe ya está publicada: «${existing.title}».`,
        existing,
      };
    }
  }

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

  // Baseline de lo que scrapeó la IA al autocompletar (campos ocultos del
  // formulario). Sirve para detectar después si un humano alteró los montos.
  const ai_goal_amount = parseAmount(String(formData.get('ai_goal_amount') ?? ''));
  const ai_raised_amount = parseAmount(
    String(formData.get('ai_raised_amount') ?? ''),
  );

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      author_id: user.id,
      ...parsed.data,
      ai_goal_amount,
      ai_raised_amount,
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

  // Resuelve enlaces cortos (gofund.me/…) a la URL canónica antes de guardar.
  if (parsed.data.donation_url) {
    parsed.data.donation_url = await resolveGoFundMeUrl(parsed.data.donation_url);
  }

  // Evita que al editar se reapunte a un enlace ya publicado por otra campaña.
  if (parsed.data.donation_url) {
    const existing = await findActiveCampaignByLink(
      parsed.data.donation_url,
      campaignId,
    );
    if (existing) {
      return {
        error: `Esa campaña de GoFundMe ya está publicada: «${existing.title}».`,
        existing,
      };
    }
  }

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
