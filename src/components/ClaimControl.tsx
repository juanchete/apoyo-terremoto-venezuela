"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimCampaign, releaseCampaign } from "@/lib/actions/operator";

interface IClaimControlProps {
  campaignId: string;
  // Estado del claim ya resuelto en el servidor (vigencia evaluada allí).
  claimActive: boolean;
  claimedByName: string | null;
  isMine: boolean;
  minutesAgo: number;
}

export function ClaimControl({
  campaignId,
  claimActive,
  claimedByName,
  isMine,
  minutesAgo,
}: IClaimControlProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string }>): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const agoLabel =
    minutesAgo <= 0 ? "hace un momento" : `hace ${minutesAgo} min`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {claimActive && !isMine && (
        <span className="rounded-full bg-warning/15 text-warning px-2 py-0.5 font-medium">
          👀 En revisión por {claimedByName ?? "otro voluntario"} · {agoLabel}
        </span>
      )}
      {claimActive && isMine && (
        <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 font-medium">
          ✋ La estás revisando tú · {agoLabel}
        </span>
      )}

      {claimActive && isMine ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => releaseCampaign(campaignId))}
          className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-background disabled:opacity-50"
        >
          Soltar
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => claimCampaign(campaignId))}
          className="rounded-md border border-primary text-primary px-2.5 py-1 font-medium hover:bg-primary/10 disabled:opacity-50"
        >
          {claimActive ? "Tomar de todas formas" : "Tomar"}
        </button>
      )}
      {error && <span className="text-distrust">{error}</span>}
    </div>
  );
}
