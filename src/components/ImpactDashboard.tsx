import { formatMoney, formatPct } from "@/lib/format";
import type { IDashboardStats } from "@/types";

interface IImpactDashboardProps {
  stats: IDashboardStats;
}

export function ImpactDashboard({ stats }: IImpactDashboardProps) {
  return (
    <section
      aria-label="Impacto financiero"
      className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-lg">Impacto del alivio comunitario</h2>
        <span className="text-xs text-muted">
          {stats.campaignCount} campañas activas
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Metric
          label="Recaudado"
          value={formatMoney(stats.totalRaised)}
          tone="trust"
        />
        <Metric label="Meta global" value={formatMoney(stats.totalGoal)} />
        <Metric
          label="Falta por recaudar"
          value={formatMoney(stats.gap)}
          tone="warning"
        />
      </div>

      <div className="space-y-1.5">
        <div className="h-3 w-full rounded-full bg-background overflow-hidden border border-border">
          <div
            className="h-full bg-trust transition-[width] duration-500"
            style={{ width: `${Math.round(stats.progressPct * 100)}%` }}
            role="progressbar"
            aria-valuenow={Math.round(stats.progressPct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="text-xs text-muted">
          {formatPct(stats.progressPct)} del esfuerzo total cubierto
        </p>
      </div>
    </section>
  );
}

interface IMetricProps {
  label: string;
  value: string;
  tone?: "trust" | "warning";
}

function Metric({ label, value, tone }: IMetricProps) {
  const color =
    tone === "trust"
      ? "text-trust"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
