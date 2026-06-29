"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteOwnCampaign } from "@/lib/actions/campaigns";

interface IAuthorControlsProps {
  campaignId: string;
}

export function AuthorControls({ campaignId }: IAuthorControlsProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    setError(null);
    startTransition(async () => {
      // deleteOwnCampaign redirige al home en caso de éxito.
      const result = await deleteOwnCampaign(campaignId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
        Tu campaña
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/campana/${campaignId}/editar`}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background"
        >
          Editar
        </Link>

        {confirming ? (
          <>
            <span className="text-sm text-muted">¿Seguro?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="rounded-md bg-distrust text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-distrust text-distrust px-3 py-1.5 text-sm font-medium hover:bg-distrust/10"
          >
            Borrar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-distrust">{error}</p>}
    </div>
  );
}
