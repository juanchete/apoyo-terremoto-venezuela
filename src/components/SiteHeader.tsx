import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/auth";
import { signOut } from "@/lib/actions/auth";
import { CreateCampaignButton } from "@/components/CreateCampaignButton";

export async function SiteHeader() {
  const profile = await getCurrentProfile();
  const isOperator = profile?.role === "operator";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid place-items-center size-9 rounded-full bg-primary/12 text-base"
          >
            🇻🇪
          </span>
          <span className="leading-none">
            <span className="font-display text-lg text-foreground tracking-tight">
              Apoyo Terremoto
            </span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-muted mt-0.5">
              Venezuela
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2 text-sm">
          {isOperator && (
            <Link
              href="/operador"
              className="hidden sm:inline-flex px-3 py-2 rounded-full text-warning font-medium hover:bg-warning/10 transition-colors"
            >
              Voluntarios
            </Link>
          )}
          <CreateCampaignButton isAuthenticated={Boolean(profile)} />
          {profile ? (
            <form action={signOut} className="flex items-center gap-2 pl-1">
              <span className="hidden md:inline text-muted">
                {profile.display_name}
              </span>
              <button
                type="submit"
                className="px-3 py-2 rounded-full border border-border hover:bg-card transition-colors"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 rounded-full hover:bg-card transition-colors"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
