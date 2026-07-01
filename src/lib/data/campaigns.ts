import { createClient } from '@/lib/supabase/server';
import { gofundmeKey } from '@/lib/campaign';
import { getUsdRates, toUsd } from '@/lib/fx';
import type {
  ICampaignWithStats,
  IDashboardStats,
  IReportWithContext,
  IVote,
  TBeneficiaryType,
  TCampaignTag,
  TNeedCategory,
} from '@/types';

export interface ICampaignRef {
  id: string;
  title: string;
}

// ¿Ya existe una campaña activa con este mismo enlace de GoFundMe?
// Filtra en la base por el slug y confirma en memoria con la clave canónica
// (tolera www, parámetros y barra final). `excludeId` evita falsos positivos
// al editar la propia campaña.
export async function findActiveCampaignByLink(
  donationUrl: string,
  excludeId?: string,
): Promise<ICampaignRef | null> {
  const key = gofundmeKey(donationUrl);
  if (!key) return null;

  const supabase = await createClient();
  let query = supabase
    .from('campaigns')
    .select('id, title, donation_url')
    .eq('status', 'active')
    .ilike('donation_url', `%${key}%`);
  if (excludeId) query = query.neq('id', excludeId);

  const { data } = await query;
  const match = (data ?? []).find(
    (c) => gofundmeKey((c as { donation_url: string | null }).donation_url) === key,
  ) as { id: string; title: string } | undefined;

  return match ? { id: match.id, title: match.title } : null;
}

export interface ICampaignFilters {
  region?: string;
  category?: TNeedCategory;
  // Coincide con cualquiera de las etiquetas indicadas (eje transversal).
  tags?: TCampaignTag[];
  verifiedOnly?: boolean;
  // Solo campañas alojadas en GoFundMe (eje independiente).
  gofundmeOnly?: boolean;
  // Solo campañas publicadas hace MÁS de N horas (descarta recién creadas).
  minAgeHours?: number;
  // Solo campañas de este tipo de beneficiario (familia u organización).
  beneficiaryType?: TBeneficiaryType;
  // Rango de "lo que falta" (brecha) en USD. Se filtra en memoria tras la
  // consulta porque la conversión a USD vive en código, no en la DB. min
  // inclusive, max exclusivo (null = sin tope). Excluye campañas sin meta.
  gap?: { min: number; max: number | null };
}

export async function getCampaigns(
  filters: ICampaignFilters = {},
): Promise<ICampaignWithStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from('campaigns_with_stats')
    .select('*')
    .eq('status', 'active')
    // Ordenamiento algorítmico inverso (PRD): las campañas más lejos de su
    // meta (menor % recolectado) aparecen primero; las sin meta, al final.
    .order('collection_pct', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filters.region) query = query.eq('region', filters.region);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.tags && filters.tags.length > 0)
    query = query.overlaps('tags', filters.tags);
  if (filters.verifiedOnly) query = query.eq('is_verified', true);
  if (filters.beneficiaryType)
    query = query.eq('beneficiary_type', filters.beneficiaryType);
  // Mismo criterio que isGoFundMe(): dominio gofundme.com o enlace gofund.me.
  if (filters.gofundmeOnly)
    query = query.or(
      'donation_url.ilike.%gofundme.com%,donation_url.ilike.%gofund.me%',
    );

  if (filters.minAgeHours && filters.minAgeHours > 0) {
    const cutoff = new Date(
      Date.now() - filters.minAgeHours * 3600 * 1000,
    ).toISOString();
    query = query.lte('published_at', cutoff);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ICampaignWithStats[];

  // Filtro por brecha (lo que falta) en USD. Se hace en memoria porque la
  // conversión multi-moneda vive en código; el feed no pagina, así que es
  // seguro. Las campañas sin meta no tienen brecha definida → quedan fuera.
  if (filters.gap) {
    const { min, max } = filters.gap;
    const rates = await getUsdRates();
    return rows.filter((c) => {
      if (c.goal_amount == null) return false;
      const gapUsd = Math.max(
        toUsd(c.goal_amount, c.currency, rates) -
          toUsd(c.raised_amount, c.currency, rates),
        0,
      );
      return gapUsd >= min && (max == null || gapUsd < max);
    });
  }

  return rows;
}

export async function getDashboardStats(): Promise<IDashboardStats> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('goal_amount, raised_amount, currency')
    .eq('status', 'active');

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    goal_amount: number | null;
    raised_amount: number;
    currency: string | null;
  }[];

  // Las campañas vienen en distintas monedas (USD, EUR, MXN…). Convertimos
  // todo a USD para que los totales globales sean comparables.
  const rates = await getUsdRates();
  const totalGoal = rows.reduce(
    (sum, r) => sum + toUsd(r.goal_amount ?? 0, r.currency, rates),
    0,
  );
  const totalRaised = rows.reduce(
    (sum, r) => sum + toUsd(r.raised_amount, r.currency, rates),
    0,
  );
  const gap = Math.max(totalGoal - totalRaised, 0);
  const progressPct = totalGoal > 0 ? Math.min(totalRaised / totalGoal, 1) : 0;

  return {
    totalGoal,
    totalRaised,
    gap,
    progressPct,
    campaignCount: rows.length,
  };
}

export async function getCampaignById(
  id: string,
): Promise<ICampaignWithStats | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('campaigns_with_stats')
    .select('*')
    .eq('id', id)
    .maybeSingle<ICampaignWithStats>();

  return data;
}

export async function getMyVote(campaignId: string): Promise<IVote | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('votes')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('voter_id', user.id)
    .maybeSingle<IVote>();

  return data;
}

export async function hasReported(campaignId: string): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('reporter_id', user.id)
    .maybeSingle();

  return Boolean(data);
}

// Cola del operador: todas las campañas, más recientes primero.
export async function getOperatorQueue(): Promise<ICampaignWithStats[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns_with_stats')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as ICampaignWithStats[];
}

// Reportes abiertos para el panel de voluntarios (alerta prioritaria).
export async function getOpenReports(): Promise<IReportWithContext[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reports')
    .select('*, profiles(display_name), campaigns(title)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row): IReportWithContext => {
    const { profiles, campaigns, ...report } = row as typeof row & {
      profiles: { display_name: string } | null;
      campaigns: { title: string } | null;
    };
    return {
      ...(report as Omit<IReportWithContext, 'reporter_name' | 'campaign_title'>),
      reporter_name: profiles?.display_name ?? 'Anónimo',
      campaign_title: campaigns?.title ?? '(campaña eliminada)',
    };
  });
}
