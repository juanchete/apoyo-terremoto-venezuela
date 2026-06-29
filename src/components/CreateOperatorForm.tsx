"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOperator } from "@/lib/actions/team";

const fieldClass =
  "w-full rounded-lg border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function generatePassword(): string {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export function CreateOperatorForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await createOperator(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(
        `${result.success}. Entrégale el correo y la contraseña a la persona; podrá entrar de inmediato.`,
      );
      formRef.current?.reset();
      setPassword("");
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="op-email" className="block text-sm font-medium">
          Correo
        </label>
        <input
          id="op-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="op-name" className="block text-sm font-medium">
          Nombre
        </label>
        <input
          id="op-name"
          name="display_name"
          type="text"
          required
          autoComplete="off"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="op-password" className="block text-sm font-medium">
          Contraseña
        </label>
        <div className="flex gap-2">
          <input
            id="op-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-card"
          >
            {showPassword ? "Ocultar" : "Ver"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPassword(generatePassword());
              setShowPassword(true);
            }}
            className="shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-card"
          >
            Generar
          </button>
        </div>
        <p className="text-xs text-muted">Mínimo 8 caracteres.</p>
      </div>

      {error && (
        <p className="text-sm text-distrust" role="alert">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-trust">{success}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creando…" : "Crear operador"}
      </button>
    </form>
  );
}
