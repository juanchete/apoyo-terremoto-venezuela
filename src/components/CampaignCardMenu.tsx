"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { reportCampaign } from "@/lib/actions/reports";

interface ICampaignCardMenuProps {
  campaignId: string;
  isAuthenticated: boolean;
}

export function CampaignCardMenu({
  campaignId,
  isAuthenticated,
}: ICampaignCardMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setOpen(false);
        setReporting(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openReport(): void {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setReporting(true);
  }

  function submitReport(): void {
    setError(null);
    startTransition(async () => {
      const result = await reportCampaign(campaignId, reason);
      if (result.error) setError(result.error);
      else {
        setDone(true);
        setReporting(false);
      }
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full bg-background/90 backdrop-blur-sm border border-border text-muted hover:text-foreground"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-60 rounded-xl border border-border bg-card shadow-lg p-2 z-20 text-left">
          {done ? (
            <p className="text-xs text-muted p-2">
              🚩 Reporte enviado. El equipo lo revisará.
            </p>
          ) : reporting ? (
            <div className="space-y-2">
              <label
                htmlFor={`report-${campaignId}`}
                className="block text-xs font-medium"
              >
                ¿Por qué la reportas?
              </label>
              <textarea
                id={`report-${campaignId}`}
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: parece duplicada / posible estafa"
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
              />
              {error && <p className="text-xs text-distrust">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending || !reason.trim()}
                  onClick={submitReport}
                  className="rounded-md bg-distrust text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-background"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openReport}
              className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-background text-distrust"
            >
              🚩 Reportar campaña
            </button>
          )}
        </div>
      )}
    </div>
  );
}
