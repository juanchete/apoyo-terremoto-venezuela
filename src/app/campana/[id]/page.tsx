import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getCampaignById,
  getMyVote,
  hasReported,
} from "@/lib/data/campaigns";
import { getCurrentProfile } from "@/lib/data/auth";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { GoFundMeBadge } from "@/components/GoFundMeBadge";
import { TrustVoteWidget } from "@/components/TrustVoteWidget";
import { OperatorActionBar } from "@/components/OperatorActionBar";
import { AuthorControls } from "@/components/AuthorControls";
import { ReportButton } from "@/components/ReportButton";
import { categoryEmoji, categoryLabel, tagEmoji, tagLabel } from "@/lib/constants";
import { isGoFundMe, collectionPct } from "@/lib/campaign";
import { refreshAmountsIfStale } from "@/lib/ingest/sync";
import {
  formatDate,
  formatMoney,
  formatPct,
  formatRelativeTime,
  formatCampaignAge,
} from "@/lib/format";

interface ICampaignPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignPage({ params }: ICampaignPageProps) {
  const { id } = await params;

  const [campaign, profile] = await Promise.all([
    getCampaignById(id),
    getCurrentProfile(),
  ]);

  if (!campaign) notFound();

  const [myVote, reported] = await Promise.all([
    getMyVote(id),
    hasReported(id),
  ]);

  const isOperator =
    profile?.role === "operator" || profile?.role === "super_admin";
  const isAuthor = profile?.id === campaign.author_id;
  const fromGoFundMe = isGoFundMe(campaign.donation_url);
  const publishedAge = formatCampaignAge(campaign.published_at);

  // Refresca los montos desde GoFundMe si el dato está viejo (>30 min).
  // Best-effort: si no hay nada que actualizar, se usan los valores guardados.
  const synced = await refreshAmountsIfStale(campaign);
  const raisedAmount = synced?.raised_amount ?? campaign.raised_amount;
  const goalAmount = synced?.goal_amount ?? campaign.goal_amount;
  const currency = synced?.currency ?? campaign.currency;
  const lastSyncedAt = synced?.last_synced_at ?? campaign.last_synced_at;
  const pct = synced
    ? collectionPct(raisedAmount, goalAmount)
    : campaign.collection_pct;
  const syncedLabel = fromGoFundMe ? formatRelativeTime(lastSyncedAt) : null;

  // Trazabilidad del sello: cuándo y quién verificó la campaña.
  const verifiedDate = campaign.is_verified
    ? formatDate(campaign.verified_at)
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Volver a campañas
      </Link>

      {campaign.status === "removed" && (
        <div className="rounded-lg border border-distrust/40 bg-distrust/5 p-3 text-sm text-distrust">
          Esta publicación fue bajada por el equipo de voluntarios y no es
          visible públicamente.
        </div>
      )}

      <article className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm rounded-full bg-card border border-border px-2 py-0.5">
              {categoryEmoji(campaign.category)} {categoryLabel(campaign.category)}
            </span>
            <span className="text-sm text-muted">📍 {campaign.region}</span>
            {fromGoFundMe && <GoFundMeBadge size="md" />}
            {campaign.is_verified && <VerifiedBadge size="md" />}
          </div>
          {campaign.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {campaign.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-0.5 text-xs"
                >
                  <span aria-hidden>{tagEmoji(tag)}</span> {tagLabel(tag)}
                </li>
              ))}
            </ul>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold">{campaign.title}</h1>
          <p className="text-sm text-muted">
            Publicada por {campaign.author_name}
            {publishedAge ? ` · 🕐 ${publishedAge}` : ""}
          </p>
          {campaign.is_verified && verifiedDate && (
            <p className="text-xs text-verified">
              Verificada el {verifiedDate}
              {campaign.verified_by_name
                ? ` por ${campaign.verified_by_name}`
                : ""}
            </p>
          )}
        </div>

        {campaign.image_url && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-border">
            <Image
              src={campaign.image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {goalAmount ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-background overflow-hidden border border-border">
              <div
                className="h-full bg-trust transition-[width] duration-500"
                style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-baseline tabular-nums">
              <span className="text-lg font-bold text-trust">
                {formatMoney(raisedAmount, currency)}
              </span>
              <span className="text-sm text-muted">
                {pct !== null ? `${formatPct(pct)} de ` : ""}
                {formatMoney(goalAmount, currency)}
              </span>
            </div>
            {syncedLabel && (
              <p className="text-xs text-muted">
                Montos de GoFundMe · actualizado {syncedLabel}
              </p>
            )}
          </div>
        ) : null}

        <p className="whitespace-pre-wrap leading-relaxed">
          {campaign.description}
        </p>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Cómo donar</h2>
          {campaign.donation_url && (
            <a
              href={campaign.donation_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-block rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium hover:opacity-90"
            >
              Donar en GoFundMe ↗
            </a>
          )}
          {campaign.payment_details && (
            <div className="text-sm">
              <p className="text-muted mb-1">Datos de pago alternativos:</p>
              <p className="whitespace-pre-wrap break-words font-mono bg-background rounded-md p-3 border border-border">
                {campaign.payment_details}
              </p>
            </div>
          )}
          <p className="text-xs text-muted">
            ⚠️ Esta plataforma no procesa pagos. Verifica la campaña antes de
            enviar dinero.
          </p>
        </div>

        {fromGoFundMe ? (
          <p className="text-sm text-muted">
            La confianza y los pagos se gestionan en GoFundMe, que tiene su
            propia verificación. Aun así, puedes reportarla si algo no cuadra.
          </p>
        ) : (
          <TrustVoteWidget
            campaignId={campaign.id}
            trustCount={campaign.trust_count}
            distrustCount={campaign.distrust_count}
            myVote={myVote?.value ?? null}
            isAuthenticated={Boolean(profile)}
          />
        )}

        <ReportButton
          campaignId={campaign.id}
          isAuthenticated={Boolean(profile)}
          alreadyReported={reported}
        />

        {isAuthor && <AuthorControls campaignId={campaign.id} />}

        {isOperator && (
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
        )}
      </article>
    </div>
  );
}
