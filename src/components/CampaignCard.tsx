import Link from "next/link";
import Image from "next/image";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { GoFundMeBadge } from "@/components/GoFundMeBadge";
import { CampaignCardMenu } from "@/components/CampaignCardMenu";
import { categoryEmoji, categoryLabel, tagEmoji, tagLabel } from "@/lib/constants";
import { isGoFundMe } from "@/lib/campaign";
import { formatMoney, formatPct, formatCampaignAge } from "@/lib/format";
import type { ICampaignWithStats } from "@/types";

interface ICampaignCardProps {
  campaign: ICampaignWithStats;
  isAuthenticated: boolean;
}

export function CampaignCard({ campaign, isAuthenticated }: ICampaignCardProps) {
  const pct = campaign.collection_pct;
  const fromGoFundMe = isGoFundMe(campaign.donation_url);
  const age = formatCampaignAge(campaign.published_at);

  return (
    <article className="group relative h-full rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)] hover:border-primary/30">
      <Link href={`/campana/${campaign.id}`} className="flex flex-col h-full">
        <div className="relative aspect-[16/10] overflow-hidden">
          {campaign.image_url ? (
            <Image
              src={campaign.image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/12 to-accent/12 text-5xl">
              {categoryEmoji(campaign.category)}
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-background/90 backdrop-blur-sm border border-border px-2.5 py-1 font-medium">
              {categoryEmoji(campaign.category)} {categoryLabel(campaign.category)}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-start gap-2">
            <h3 className="font-display text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {campaign.title}
            </h3>
            {campaign.is_verified && (
              <span className="mt-0.5 shrink-0">
                <VerifiedBadge />
              </span>
            )}
          </div>

          {campaign.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {campaign.tags.slice(0, 4).map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2 py-0.5 text-[11px] text-muted"
                >
                  <span aria-hidden>{tagEmoji(tag)}</span> {tagLabel(tag)}
                </li>
              ))}
            </ul>
          )}

          {campaign.goal_amount ? (
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                <div
                  className="h-full rounded-full bg-trust"
                  style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm tabular-nums">
                <span className="text-trust font-semibold">
                  {formatMoney(campaign.raised_amount, campaign.currency)}
                </span>
                <span className="text-muted">
                  {pct !== null ? formatPct(pct) : ""} de{" "}
                  {formatMoney(campaign.goal_amount, campaign.currency)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted line-clamp-2">
              {campaign.description}
            </p>
          )}

          <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-muted">
            <span>📍 {campaign.region}</span>
            {age && <span aria-label="Antigüedad">🕐 {age}</span>}
            {fromGoFundMe ? (
              <span className="ml-auto">
                <GoFundMeBadge />
              </span>
            ) : (
              <>
                <span className="ml-auto inline-flex items-center gap-1 text-trust font-medium">
                  ▲ {campaign.trust_count}
                </span>
                <span className="inline-flex items-center gap-1 text-distrust font-medium">
                  ▼ {campaign.distrust_count}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {fromGoFundMe && campaign.donation_url && (
          <a
            href={campaign.donation_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50"
          >
            GoFundMe ↗
          </a>
        )}
        <CampaignCardMenu
          campaignId={campaign.id}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </article>
  );
}
