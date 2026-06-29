"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { castVote } from "@/lib/actions/votes";
import type { TVoteValue } from "@/types";

interface ITrustVoteWidgetProps {
  campaignId: string;
  trustCount: number;
  distrustCount: number;
  myVote: TVoteValue | null;
  isAuthenticated: boolean;
}

export function TrustVoteWidget({
  campaignId,
  trustCount,
  distrustCount,
  myVote,
  isAuthenticated,
}: ITrustVoteWidgetProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleVote(value: TVoteValue): void {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await castVote(campaignId, value);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section aria-label="Votación de confianza" className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleVote("trust")}
          disabled={isPending}
          aria-pressed={myVote === "trust"}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-colors disabled:opacity-50 ${
            myVote === "trust"
              ? "border-trust bg-trust/10 text-trust"
              : "border-border hover:border-trust hover:text-trust"
          }`}
        >
          ▲ Confío <span className="tabular-nums">({trustCount})</span>
        </button>
        <button
          type="button"
          onClick={() => handleVote("distrust")}
          disabled={isPending}
          aria-pressed={myVote === "distrust"}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-colors disabled:opacity-50 ${
            myVote === "distrust"
              ? "border-distrust bg-distrust/10 text-distrust"
              : "border-border hover:border-distrust hover:text-distrust"
          }`}
        >
          ▼ Desconfío <span className="tabular-nums">({distrustCount})</span>
        </button>
      </div>
      {!isAuthenticated && (
        <p className="text-xs text-muted">Inicia sesión para votar.</p>
      )}
      {error && <p className="text-xs text-distrust">{error}</p>}
    </section>
  );
}
