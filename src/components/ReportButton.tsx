"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reportCampaign } from "@/lib/actions/reports";

interface IReportButtonProps {
  campaignId: string;
  isAuthenticated: boolean;
  alreadyReported: boolean;
}

export function ReportButton({
  campaignId,
  isAuthenticated,
  alreadyReported,
}: IReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="text-xs text-muted">
        🚩 Ya reportaste esta campaña. El equipo de voluntarios la revisará.
      </p>
    );
  }

  function handleSubmit(): void {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reportCampaign(campaignId, reason);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => (isAuthenticated ? setOpen(true) : router.push("/login"))}
        className="text-xs text-muted hover:text-distrust"
      >
        🚩 Reportar campaña sospechosa
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-distrust/40 bg-distrust/5 p-3 space-y-2">
      <label htmlFor="report-reason" className="block text-xs font-medium">
        ¿Por qué reportas esta campaña?
      </label>
      <textarea
        id="report-reason"
        rows={2}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ej: parece duplicada / el enlace no corresponde / posible estafa"
        className="w-full rounded-md border border-border bg-card p-2 text-sm"
      />
      {error && <p className="text-xs text-distrust">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="rounded-md bg-distrust text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Enviar reporte
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
