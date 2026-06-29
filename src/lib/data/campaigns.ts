import { createClient } from '@/lib/supabase/server';
import type {
  ICampaignWithStats,
  IDashboardStats,
  IReportWithContext,
  IVote,
  TNeedCategory,
} from '@/types';

export interface ICampaignFilters {
  region?: string;
  category?: TNeedCategory;
  verifiedOnly?: boolean;
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
  if (filters.verifiedOnly) query = query.eq('is_verified', true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as ICampaignWithStats[];
}

export async function getDashboardStats(): Promise<IDashboardStats> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('goal_amount, raised_amount')
    .eq('status', 'active');

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { goal_amount: number | null; raised_amount: number }[];
  const totalGoal = rows.reduce((sum, r) => sum + (r.goal_amount ?? 0), 0);
  const totalRaised = rows.reduce((sum, r) => sum + (r.raised_amount ?? 0), 0);
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
