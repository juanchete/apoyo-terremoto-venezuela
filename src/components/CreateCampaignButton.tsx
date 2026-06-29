"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ICreateCampaignButtonProps {
  isAuthenticated: boolean;
  className?: string;
  label?: string;
  next?: string;
}

const DEFAULT_CLASS =
  "inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium shadow-sm hover:brightness-95 active:scale-[0.98] transition";

export function CreateCampaignButton({
  isAuthenticated,
  className = DEFAULT_CLASS,
  label = "Publicar campaña",
  next = "/nueva",
}: ICreateCampaignButtonProps) {
  const [open, setOpen] = useState(false);

  if (isAuthenticated) {
    return (
      <Link href="/nueva" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && <AuthPromptModal next={next} onClose={() => setOpen(false)} />}
    </>
  );
}

interface IAuthPromptModalProps {
  next: string;
  onClose: () => void;
}

function AuthPromptModal({ next, onClose }: IAuthPromptModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function go(mode: "signin" | "signup"): void {
    const params = new URLSearchParams({ next, mode });
    // El header (y este modal) persisten entre rutas: hay que cerrarlo
    // explícitamente, si no queda flotando sobre /login.
    onClose();
    router.push(`/login?${params.toString()}`);
  }

  // Portal a <body>: evita que el backdrop-blur del header recorte el modal.
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 bg-foreground/40 backdrop-blur-[2px] animate-fade"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-7 sm:p-8 shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">
          Ayuda directa
        </p>
        <h2
          id="auth-prompt-title"
          className="font-display text-2xl sm:text-[1.7rem] leading-tight mt-2"
        >
          Publica tu campaña en un minuto
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Crea una cuenta para publicar una campaña de GoFundMe y darle
          visibilidad a tu familia. Es gratis y la comunidad la verifica.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => go("signup")}
            className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium shadow-sm hover:brightness-95 active:scale-[0.99] transition"
          >
            Crear cuenta
          </button>
          <button
            type="button"
            onClick={() => go("signin")}
            className="w-full rounded-full border border-border py-3 font-medium hover:bg-background transition-colors"
          >
            Ya tengo cuenta — Iniciar sesión
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="block mx-auto mt-4 text-xs text-muted hover:text-foreground transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>,
    document.body,
  );
}
