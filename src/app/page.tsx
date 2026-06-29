import { getCampaigns, getDashboardStats } from "@/lib/data/campaigns";
import { getCurrentProfile } from "@/lib/data/auth";
import { CampaignCard } from "@/components/CampaignCard";
import { ImpactDashboard } from "@/components/ImpactDashboard";
import { CreateCampaignButton } from "@/components/CreateCampaignButton";
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

  const [campaigns, stats, profile] = await Promise.all([
    getCampaigns({ region, category, verifiedOnly }),
    getDashboardStats(),
    getCurrentProfile(),
  ]);

  return (
    <div className="space-y-10">
      <section className="max-w-3xl animate-rise">
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">
          Terremoto · Venezuela
        </p>
        <h1 className="font-display text-4xl sm:text-6xl leading-[1.02] mt-3">
          Ayuda directa a las familias del terremoto
        </h1>
        <p className="text-muted text-lg mt-4 leading-relaxed">
          Campañas de GoFundMe centralizadas y verificadas. Apoya directo a las
          familias —sin intermediarios—, priorizando a las que están más lejos
          de su meta.{" "}
          <strong className="text-foreground font-semibold">
            Verifica siempre antes de donar.
          </strong>
        </p>
      </section>

      <div className="animate-rise" style={{ animationDelay: "60ms" }}>
        <ImpactDashboard stats={stats} />
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="categoria" className="block text-xs text-muted font-medium">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={category ?? ""}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/50 transition-colors"
          >
            <option value="">Todas</option>
            {NEED_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="region" className="block text-xs text-muted font-medium">
            Región
          </label>
          <select
            id="region"
            name="region"
            defaultValue={region ?? ""}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/50 transition-colors"
          >
            <option value="">Todas</option>
            {VENEZUELA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
          <input
            type="checkbox"
            name="verificadas"
            value="1"
            defaultChecked={verifiedOnly}
            className="size-4 accent-primary"
          />
          Solo verificadas
        </label>
        <button
          type="submit"
          className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
      </form>

      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-16 px-6 text-center space-y-4">
          <p className="font-display text-xl">Aún no hay campañas aquí</p>
          <p className="text-muted text-sm max-w-md mx-auto">
            Sé el primero en publicar una campaña de ayuda y darle visibilidad a
            una familia afectada.
          </p>
          <CreateCampaignButton
            isAuthenticated={Boolean(profile)}
            label="Publicar la primera campaña"
          />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign, i) => (
            <div
              key={campaign.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
            >
              <CampaignCard campaign={campaign} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
