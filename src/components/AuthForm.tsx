"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface IAuthFormProps {
  next: string;
}

type TMode = "signin" | "signup";

const fieldClass =
  "w-full rounded-lg border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

export function AuthForm({ next }: IAuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<TMode>("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailAuth(formData: FormData): void {
    setError(null);
    setMessage(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) return setError(error.message);
        setMessage(
          "Cuenta creada. Si la confirmación por correo está activa, revisa tu email; si no, ya puedes iniciar sesión.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return setError(error.message);
        router.push(next);
        router.refresh();
      }
    });
  }

  function handleGoogle(): void {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) setError(error.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 py-2 font-medium ${
            mode === "signin" ? "bg-primary text-primary-foreground" : "bg-card"
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-2 font-medium ${
            mode === "signup" ? "bg-primary text-primary-foreground" : "bg-card"
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <form action={handleEmailAuth} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={fieldClass}
          />
        </div>

        {error && (
          <p className="text-sm text-distrust" role="alert">
            {error}
          </p>
        )}
        {message && <p className="text-sm text-trust">{message}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isPending}
        className="w-full rounded-lg border border-border bg-card py-3 font-medium hover:bg-background disabled:opacity-50"
      >
        Continuar con Google
      </button>
    </div>
  );
}
