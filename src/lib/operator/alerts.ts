import { toUsd, type TUsdRates } from '@/lib/fx';
import type { ICampaignWithStats, TNeedCategory } from '@/types';

// ---------- Umbrales (ajustables) ----------
// #1: una meta que supera N veces el promedio de su categoría es sospechosa.
export const AVG_MULTIPLIER = 3;
// #1: no comparar contra el promedio hasta tener suficientes campañas similares.
export const MIN_CATEGORY_SAMPLE = 4;
// #2: divergencia relativa contra el baseline de la IA que dispara la alerta.
export const DISCREPANCY_PCT = 0.2;
// #4: cuánto puede crecer la meta sobre la original antes de marcarla.
export const GOAL_JUMP_MULTIPLIER = 1.5;

export type TAlertType = 'over_average' | 'ai_discrepancy' | 'goal_jump';
export type TAlertSeverity = 'warning';

export interface IAlert {
  type: TAlertType;
  label: string;
  severity: TAlertSeverity;
}

// Sumas por categoría en USD, para comparar metas entre monedas distintas.
export interface ICategoryStat {
  sumUsd: number;
  count: number;
}
export type IAlertContext = Partial<Record<TNeedCategory, ICategoryStat>>;

// Construye el promedio de metas por categoría (en USD) a partir de la cola.
// Solo cuentan las campañas activas con meta > 0.
export function buildAlertContext(
  campaigns: ICampaignWithStats[],
  rates: TUsdRates,
): IAlertContext {
  const ctx: IAlertContext = {};
  for (const c of campaigns) {
    if (c.status !== 'active' || !c.goal_amount || c.goal_amount <= 0) continue;
    const stat = ctx[c.category] ?? { sumUsd: 0, count: 0 };
    stat.sumUsd += toUsd(c.goal_amount, c.currency, rates);
    stat.count += 1;
    ctx[c.category] = stat;
  }
  return ctx;
}

function pctChangeLabel(current: number, base: number): string {
  const pct = Math.round((current / base - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

// Alertas derivadas para una campaña. Vacío si ya la verificó un humano:
// la verificación silencia las alertas de monto (el operador ya la revisó).
export function computeAlerts(
  campaign: ICampaignWithStats,
  ctx: IAlertContext,
  rates: TUsdRates,
): IAlert[] {
  if (campaign.is_verified) return [];

  const alerts: IAlert[] = [];
  const goal = campaign.goal_amount;

  // #1 — Meta muy por encima del promedio de la categoría.
  if (goal && goal > 0) {
    const stat = ctx[campaign.category];
    if (stat) {
      const goalUsd = toUsd(goal, campaign.currency, rates);
      // Excluye la propia campaña para que un outlier no infle su referencia.
      const othersCount = stat.count - 1;
      const othersSum = stat.sumUsd - goalUsd;
      if (othersCount >= MIN_CATEGORY_SAMPLE) {
        const avg = othersSum / othersCount;
        if (avg > 0 && goalUsd > AVG_MULTIPLIER * avg) {
          alerts.push({
            type: 'over_average',
            severity: 'warning',
            label: `💰 Monto ${(goalUsd / avg).toFixed(1)}× promedio`,
          });
        }
      }
    }
  }

  // #2 — Discrepancia vs lo que scrapeó la IA. Solo antes del primer sync:
  // tras sincronizar, el valor mostrado es la verdad de GoFundMe.
  if (campaign.last_synced_at === null) {
    const candidates: { label: string; diff: number }[] = [];
    if (campaign.ai_goal_amount && campaign.ai_goal_amount > 0 && goal != null) {
      const diff = Math.abs(goal - campaign.ai_goal_amount) / campaign.ai_goal_amount;
      if (diff > DISCREPANCY_PCT)
        candidates.push({
          diff,
          label: `⚠️ Meta ${pctChangeLabel(goal, campaign.ai_goal_amount)} vs IA`,
        });
    }
    if (campaign.ai_raised_amount && campaign.ai_raised_amount > 0) {
      const diff =
        Math.abs(campaign.raised_amount - campaign.ai_raised_amount) /
        campaign.ai_raised_amount;
      if (diff > DISCREPANCY_PCT)
        candidates.push({
          diff,
          label: `⚠️ Recaudado ${pctChangeLabel(campaign.raised_amount, campaign.ai_raised_amount)} vs IA`,
        });
    }
    // Un solo badge: el campo con mayor divergencia.
    const worst = candidates.sort((a, b) => b.diff - a.diff)[0];
    if (worst)
      alerts.push({ type: 'ai_discrepancy', severity: 'warning', label: worst.label });
  }

  // #4 — La meta creció mucho respecto a la original.
  const orig = campaign.original_goal_amount;
  if (orig && orig > 0 && goal != null && goal > GOAL_JUMP_MULTIPLIER * orig) {
    alerts.push({
      type: 'goal_jump',
      severity: 'warning',
      label: `📈 Meta ${pctChangeLabel(goal, orig)}`,
    });
  }

  return alerts;
}
