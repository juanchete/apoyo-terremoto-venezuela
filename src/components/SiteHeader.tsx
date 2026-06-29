import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/auth";
import { signOut } from "@/lib/actions/auth";

export async function SiteHeader() {
  const profile = await getCurrentProfile();
  const isOperator = profile?.role === "operator";

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="text-xl">🇻🇪</span>
          <span className="leading-tight">
            Apoyo Terremoto
            <span className="block text-xs font-normal text-muted">
              Venezuela
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          {isOperator && (
            <Link
              href="/operador"
              className="px-3 py-1.5 rounded-md text-warning font-medium hover:bg-warning/10"
            >
              Panel voluntarios
            </Link>
          )}
          <Link
            href="/nueva"
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            Publicar campaña
          </Link>
          {profile ? (
            <form action={signOut} className="flex items-center gap-2">
              <span className="hidden sm:inline text-muted">
                {profile.display_name}
              </span>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md border border-border hover:bg-background"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md border border-border hover:bg-background"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
