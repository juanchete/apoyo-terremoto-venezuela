import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/auth";
import { getOperatorQueue, getOpenReports } from "@/lib/data/campaigns";
import { OperatorActionBar } from "@/components/OperatorActionBar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AlertBadges } from "@/components/AlertBadges";
import { BackfillDatesButton } from "@/components/BackfillDatesButton";
import { categoryEmoji, categoryLabel, tagLabel } from "@/lib/constants";
import { getUsdRates } from "@/lib/fx";
import {
  buildAlertContext,
  computeAlerts,
  type IAlert,
} from "@/lib/operator/alerts";
import type { ICampaignWithStats } from "@/types";

export default async function OperadorPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/operador");
  if (profile.role !== "operator" && profile.role !== "super_admin")
    redirect("/");
  const isSuperAdmin = profile.role === "super_admin";

  const [campaigns, openReports, rates] = await Promise.all([
    getOperatorQueue(),
    getOpenReports(),
    getUsdRates(),
  ]);

  const active = campaigns.filter((c) => c.status === "active");

  // Alertas de monto derivadas (#1 promedio, #2 discrepancia IA, #4 salto de
  // meta). Se calculan sobre las activas usando el promedio por categoría.
  const alertCtx = buildAlertContext(active, rates);
  const alertsByCampaign = new Map<string, IAlert[]>(
    active.map((c) => [c.id, computeAlerts(c, alertCtx, rates)]),
  );
  const alertsOf = (c: ICampaignWithStats): IAlert[] =>
    alertsByCampaign.get(c.id) ?? [];

  const priority = active.filter(
    (c) =>
      c.open_reports > 0 ||
      c.ai_status === "flagged" ||
      alertsOf(c).length > 0,
  );
  const pending = active.filter(
    (c) =>
      !c.is_verified &&
      c.open_reports === 0 &&
      c.ai_status !== "flagged" &&
      alertsOf(c).length === 0,
  );
  const verified = active.filter((c) => c.is_verified && c.open_reports === 0);
  const removed = campaigns.filter((c) => c.status === "removed");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Panel de voluntarios</h1>
          <div className="flex items-center gap-2 shrink-0">
            <BackfillDatesButton />
            {isSuperAdmin && (
              <Link
                href="/operador/equipo"
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-card"
              >
                Equipo
              </Link>
            )}
          </div>
        </div>
        <p className="text-sm text-muted">
          Revisa, verifica y modera las campañas. Las marcadas por la IA o
          reportadas por la comunidad aparecen primero.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Stat label="Prioridad" value={priority.length} tone="warning" />
        <Stat label="Por revisar" value={pending.length} />
        <Stat label="Verificadas" value={verified.length} />
        <Stat label="Bajadas" value={removed.length} />
      </div>

      {openReports.length > 0 && (
        <section className="rounded-xl border border-distrust/40 bg-distrust/5 p-4 space-y-2">
          <h2 className="font-semibold text-distrust">
            🚩 Reportes abiertos ({openReports.length})
          </h2>
          <ul className="space-y-1.5 text-sm">
            {openReports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/campana/${r.campaign_id}`}
                  className="font-medium hover:underline"
                >
                  {r.campaign_title}
                </Link>{" "}
                <span className="text-muted">
                  — “{r.reason}” ({r.reporter_name})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QueueSection
        title="⚠️ Prioridad (alertas / reportes / IA)"
        campaigns={priority}
        alertsByCampaign={alertsByCampaign}
      />
      <QueueSection
        title="Por revisar"
        campaigns={pending}
        alertsByCampaign={alertsByCampaign}
      />
      <QueueSection
        title="Verificadas"
        campaigns={verified}
        alertsByCampaign={alertsByCampaign}
      />
      <QueueSection
        title="Publicaciones bajadas"
        campaigns={removed}
        alertsByCampaign={alertsByCampaign}
      />
    </div>
  );
}

interface IStatProps {
  label: string;
  value: number;
  tone?: "warning";
}

function Stat({ label, value, tone }: IStatProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p
        className={`text-2xl font-bold tabular-nums ${
          tone === "warning" && value > 0 ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

interface IQueueSectionProps {
  title: string;
  campaigns: ICampaignWithStats[];
  alertsByCampaign: Map<string, IAlert[]>;
}

function QueueSection({ title, campaigns, alertsByCampaign }: IQueueSectionProps) {
  if (campaigns.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">{title}</h2>
      <ul className="space-y-3">
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/campana/${campaign.id}`}
                  className="font-medium hover:text-primary line-clamp-1"
                >
                  {campaign.title}
                </Link>
                <p className="text-xs text-muted">
                  {categoryEmoji(campaign.category)}{" "}
                  {categoryLabel(campaign.category)} · 📍 {campaign.region} · por{" "}
                  {campaign.author_name} · ▲{campaign.trust_count} ▼
                  {campaign.distrust_count}
                </p>
                {campaign.tags.length > 0 && (
                  <p className="text-xs text-muted mt-0.5">
                    🏷️ {campaign.tags.map(tagLabel).join(" · ")}
                  </p>
                )}
              </div>
              {campaign.is_verified && <VerifiedBadge />}
            </div>
            <AlertBadges alerts={alertsByCampaign.get(campaign.id) ?? []} />
            <p className="text-sm text-muted line-clamp-2">
              {campaign.description}
            </p>
            <OperatorActionBar
              campaignId={campaign.id}
              isVerified={campaign.is_verified}
              verifiedAt={campaign.verified_at}
              verifiedByName={campaign.verified_by_name}
              status={campaign.status}
              aiStatus={campaign.ai_status}
              aiNotes={campaign.ai_notes}
              openReports={campaign.open_reports}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
