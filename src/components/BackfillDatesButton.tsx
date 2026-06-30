"use client";

import { useState, useTransition } from "react";
import { backfillGoFundMeDates } from "@/lib/actions/operator";

export function BackfillDatesButton() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(): void {
    setMsg(null);
    startTransition(async () => {
      const result = await backfillGoFundMeDates();
      setMsg(
        result.error
          ? result.error
          : `Listo: ${result.updated ?? 0} campañas actualizadas.`,
      );
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-card disabled:opacity-50"
      >
        {isPending ? "Rellenando…" : "Rellenar fechas GoFundMe"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
