export type TUserRole = 'user' | 'operator' | 'super_admin';
export type TCampaignStatus = 'active' | 'removed';
export type TVoteValue = 'trust' | 'distrust';
export type TNeedCategory =
  | 'medical'
  | 'funeral'
  | 'recovery'
  | 'children'
  | 'other';
export type TAiStatus = 'pending' | 'relevant' | 'flagged' | 'error';
export type TReportStatus = 'open' | 'reviewed';

export interface IProfile {
  id: string;
  display_name: string;
  role: TUserRole;
  created_at: string;
}

// Miembro del equipo visto desde el panel de gestión: perfil + email de auth.
export interface ITeamMember {
  id: string;
  display_name: string;
  email: string | null;
  role: TUserRole;
  created_at: string;
}

export interface ICampaign {
  id: string;
  author_id: string;
  title: string;
  description: string;
  donation_url: string | null;
  payment_details: string | null;
  region: string;
  category: TNeedCategory;
  image_url: string | null;
  goal_amount: number | null;
  raised_amount: number;
  currency: string;
  // Baseline scrapeado por la IA al crear (null si la carga fue manual).
  ai_goal_amount: number | null;
  ai_raised_amount: number | null;
  // Meta al momento de crear; baseline para detectar saltos de meta.
  original_goal_amount: number | null;
  status: TCampaignStatus;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  ai_status: TAiStatus;
  ai_notes: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface ICampaignWithStats extends ICampaign {
  author_name: string;
  // Nombre del voluntario que otorgó el sello (null si no está verificada).
  verified_by_name: string | null;
  trust_count: number;
  distrust_count: number;
  total_votes: number;
  open_reports: number;
  collection_pct: number | null;
}

export interface IVote {
  id: string;
  campaign_id: string;
  voter_id: string;
  value: TVoteValue;
  created_at: string;
}

export interface IReport {
  id: string;
  campaign_id: string;
  reporter_id: string;
  reason: string;
  status: TReportStatus;
  created_at: string;
}

export interface IReportWithContext extends IReport {
  reporter_name: string;
  campaign_title: string;
}

export interface IDashboardStats {
  totalGoal: number;
  totalRaised: number;
  gap: number;
  progressPct: number;
  campaignCount: number;
}

export interface IExtractedCampaign {
  title: string | null;
  description: string | null;
  image_url: string | null;
  goal_amount: number | null;
  raised_amount: number | null;
  currency: string | null;
}
