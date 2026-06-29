import { formatMoney, formatPct } from "@/lib/format";
import type { IDashboardStats } from "@/types";

interface IImpactDashboardProps {
  stats: IDashboardStats;
}

export function ImpactDashboard({ stats }: IImpactDashboardProps) {
  const pct = Math.round(stats.progressPct * 100);

  return (
    <section
      aria-label="Impacto financiero"
      className="rounded-3xl border border-border bg-card/70 p-6 sm:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
        {/* Bloque principal: recaudado + progreso */}
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">
            Impacto del alivio comunitario
          </p>
          <div className="mt-3 flex items-end gap-3 flex-wrap">
            <span className="font-display text-5xl sm:text-6xl leading-none text-trust">
              {formatMoney(stats.totalRaised)}
            </span>
            <span className="text-muted text-sm mb-1.5">recaudados</span>
          </div>

          <div className="mt-5">
            <div className="h-2.5 w-full rounded-full bg-background overflow-hidden border border-border">
              <div
                className="h-full rounded-full bg-trust transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              <span className="text-foreground font-semibold">{formatPct(stats.progressPct)}</span>{" "}
              del esfuerzo total · {stats.campaignCount} campañas activas
            </p>
          </div>
        </div>

        {/* Bloque secundario: meta y brecha */}
        <dl className="grid grid-cols-2 lg:grid-cols-1 gap-5 content-center lg:border-l lg:border-border lg:pl-12">
          <div>
            <dt className="text-xs text-muted">Meta global</dt>
            <dd className="font-display text-2xl mt-0.5">
              {formatMoney(stats.totalGoal)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Falta por recaudar</dt>
            <dd className="font-display text-2xl mt-0.5 text-accent">
              {formatMoney(stats.gap)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
