import Link from "next/link";
import Image from "next/image";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { categoryEmoji, categoryLabel } from "@/lib/constants";
import { formatMoney, formatPct } from "@/lib/format";
import type { ICampaignWithStats } from "@/types";

interface ICampaignCardProps {
  campaign: ICampaignWithStats;
}

export function CampaignCard({ campaign }: ICampaignCardProps) {
  const pct = campaign.collection_pct;

  return (
    <article className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <Link href={`/campana/${campaign.id}`} className="block">
        {campaign.image_url ? (
          <div className="relative aspect-[16/9] bg-background">
            <Image
              src={campaign.image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-gradient-to-br from-primary/15 to-trust/15 flex items-center justify-center text-4xl">
            {categoryEmoji(campaign.category)}
          </div>
        )}
      </Link>

      <div className="p-4 space-y-2 flex flex-col flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs rounded-full bg-background border border-border px-2 py-0.5">
            {categoryEmoji(campaign.category)} {categoryLabel(campaign.category)}
          </span>
          {campaign.is_verified && <VerifiedBadge />}
        </div>

        <Link href={`/campana/${campaign.id}`}>
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary">
            {campaign.title}
          </h3>
        </Link>

        {campaign.goal_amount ? (
          <div className="space-y-1 pt-1">
            <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border">
              <div
                className="h-full bg-trust"
                style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted tabular-nums">
              <span className="text-trust font-medium">
                {formatMoney(campaign.raised_amount, campaign.currency)}
              </span>
              <span>
                {pct !== null ? formatPct(pct) : ""} de{" "}
                {formatMoney(campaign.goal_amount, campaign.currency)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted line-clamp-2">
            {campaign.description}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1 mt-auto text-xs text-muted">
          <span>📍 {campaign.region}</span>
          <span className="inline-flex items-center gap-1 text-trust">
            ▲ {campaign.trust_count}
          </span>
          <span className="inline-flex items-center gap-1 text-distrust">
            ▼ {campaign.distrust_count}
          </span>
        </div>
      </div>
    </article>
  );
}
