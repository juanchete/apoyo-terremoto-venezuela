import Link from "next/link";
import { getCampaigns, getDashboardStats } from "@/lib/data/campaigns";
import { CampaignCard } from "@/components/CampaignCard";
import { ImpactDashboard } from "@/components/ImpactDashboard";
import { VENEZUELA_REGIONS, NEED_CATEGORIES } from "@/lib/constants";
import type { TNeedCategory } from "@/types";

interface IHomeProps {
  searchParams: Promise<{
    region?: string;
    categoria?: string;
    verificadas?: string;
  }>;
}

export default async function Home({ searchParams }: IHomeProps) {
  const params = await searchParams;
  const region = params.region;
  const category = NEED_CATEGORIES.some((c) => c.value === params.categoria)
    ? (params.categoria as TNeedCategory)
    : undefined;
  const verifiedOnly = params.verificadas === "1";

  const [campaigns, stats] = await Promise.all([
    getCampaigns({ region, category, verifiedOnly }),
    getDashboardStats(),
  ]);

  return (
    <div className="space-y-8">
      <section className="text-center space-y-3 py-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Ayuda directa a las familias del terremoto
        </h1>
        <p className="text-muted max-w-2xl mx-auto">
          Campañas de GoFundMe centralizadas y verificadas. Apoya directo a las
          familias —sin intermediarios—, priorizando a las que están más lejos
          de su meta. <strong>Verifica siempre antes de donar.</strong>
        </p>
      </section>

      <ImpactDashboard stats={stats} />

      <form className="flex flex-wrap items-end gap-3 justify-center">
        <div className="space-y-1">
          <label htmlFor="categoria" className="block text-xs text-muted">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={category ?? ""}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {NEED_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="region" className="block text-xs text-muted">
            Región
          </label>
          <select
            id="region"
            name="region"
            defaultValue={region ?? ""}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {VENEZUELA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            name="verificadas"
            value="1"
            defaultChecked={verifiedOnly}
            className="size-4"
          />
          Solo verificadas
        </label>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-card"
        >
          Filtrar
        </button>
      </form>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted">
            No hay campañas con estos filtros todavía.
          </p>
          <Link
            href="/nueva"
            className="inline-block rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium"
          >
            Publicar la primera campaña
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
