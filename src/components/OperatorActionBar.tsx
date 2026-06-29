"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setVerified, setCampaignStatus } from "@/lib/actions/operator";
import { resolveReports } from "@/lib/actions/reports";
import { formatDate } from "@/lib/format";
import type { TAiStatus, TCampaignStatus } from "@/types";

interface IOperatorActionBarProps {
  campaignId: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
  status: TCampaignStatus;
  aiStatus: TAiStatus;
  aiNotes: string | null;
  openReports: number;
}

const AI_LABEL: Record<TAiStatus, { text: string; cls: string }> = {
  pending: { text: "IA: pendiente", cls: "text-muted" },
  relevant: { text: "IA: relevante ✓", cls: "text-trust" },
  flagged: { text: "IA: marcada ⚠", cls: "text-warning" },
  error: { text: "IA: sin analizar", cls: "text-muted" },
};

export function OperatorActionBar({
  campaignId,
  isVerified,
  verifiedAt,
  verifiedByName,
  status,
  aiStatus,
  aiNotes,
  openReports,
}: IOperatorActionBarProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verifiedDate = isVerified ? formatDate(verifiedAt) : null;

  function run(fn: () => Promise<{ error?: string }>): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const ai = AI_LABEL[aiStatus];

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-warning uppercase tracking-wide">
          Acciones de voluntario
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className={ai.cls}>{ai.text}</span>
          {openReports > 0 && (
            <span className="rounded-full bg-distrust/15 text-distrust px-2 py-0.5 font-medium">
              🚩 {openReports} reporte{openReports === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {aiNotes && (
        <p className="text-xs text-muted italic border-l-2 border-border pl-2">
          {aiNotes}
        </p>
      )}

      {isVerified && verifiedDate && (
        <p className="text-xs text-verified">
          ✓ Verificada el {verifiedDate}
          {verifiedByName ? ` por ${verifiedByName}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => setVerified(campaignId, !isVerified))}
          className="rounded-md border border-verified text-verified px-3 py-1.5 text-sm font-medium hover:bg-verified/10 disabled:opacity-50"
        >
          {isVerified ? "Quitar verificación" : "✓ Verificar (humana)"}
        </button>

        {status === "active" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setCampaignStatus(campaignId, "removed"))}
            className="rounded-md border border-distrust text-distrust px-3 py-1.5 text-sm font-medium hover:bg-distrust/10 disabled:opacity-50"
          >
            Bajar publicación
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setCampaignStatus(campaignId, "active"))}
            className="rounded-md border border-trust text-trust px-3 py-1.5 text-sm font-medium hover:bg-trust/10 disabled:opacity-50"
          >
            Restaurar publicación
          </button>
        )}

        {openReports > 0 && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => resolveReports(campaignId))}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-50"
          >
            Marcar reportes revisados
          </button>
        )}
      </div>
      {error && <p className="text-xs text-distrust">{error}</p>}
    </div>
  );
}
