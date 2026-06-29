"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";

interface IMobileMenuProps {
  isOperator: boolean;
  isAuthenticated: boolean;
  displayName: string | null;
}

export function MobileMenu({
  isOperator,
  isAuthenticated,
  displayName,
}: IMobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent): void {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
        aria-expanded={open}
        className="grid place-items-center size-10 rounded-full border border-border hover:bg-card transition-colors"
      >
        <span aria-hidden className="relative block w-4 h-3">
          <span
            className={`absolute left-0 top-0 h-0.5 w-full rounded-full bg-foreground transition-transform ${open ? "translate-y-[5px] rotate-45" : ""}`}
          />
          <span
            className={`absolute left-0 top-[5px] h-0.5 w-full rounded-full bg-foreground transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`absolute left-0 bottom-0 h-0.5 w-full rounded-full bg-foreground transition-transform ${open ? "-translate-y-[5px] -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card shadow-xl p-2 animate-rise origin-top-right"
        >
          {isAuthenticated && displayName && (
            <p className="px-3 pt-1.5 pb-2 text-xs text-muted truncate">
              {displayName}
            </p>
          )}

          {isOperator && (
            <Link
              href="/operador"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-warning font-medium hover:bg-warning/10 transition-colors"
            >
              Voluntarios
            </Link>
          )}

          {isAuthenticated ? (
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-background transition-colors"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-xl hover:bg-background transition-colors"
            >
              Entrar
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
