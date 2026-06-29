import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/auth";
import { signOut } from "@/lib/actions/auth";
import { CreateCampaignButton } from "@/components/CreateCampaignButton";
import { MobileMenu } from "@/components/MobileMenu";

const COMPACT_CTA =
  "inline-flex items-center justify-center px-3.5 py-2 rounded-full bg-primary text-primary-foreground font-medium text-sm whitespace-nowrap shadow-sm hover:brightness-95 active:scale-[0.98] transition";

export async function SiteHeader() {
  const profile = await getCurrentProfile();
  const isOperator =
    profile?.role === "operator" || profile?.role === "super_admin";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden
            className="grid place-items-center size-9 shrink-0 rounded-full bg-primary/12 text-base"
          >
            🇻🇪
          </span>
          <span className="leading-none min-w-0">
            <span className="font-display text-lg text-foreground tracking-tight whitespace-nowrap">
              Apoyo Terremoto
            </span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-muted mt-0.5">
              Venezuela
            </span>
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden sm:flex items-center gap-2 text-sm">
          {isOperator && (
            <Link
              href="/operador"
              className="inline-flex px-3 py-2 rounded-full text-warning font-medium hover:bg-warning/10 transition-colors"
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

        {/* Mobile */}
        <div className="flex sm:hidden items-center gap-2 shrink-0">
          <CreateCampaignButton
            isAuthenticated={Boolean(profile)}
            label="Publicar"
            className={COMPACT_CTA}
          />
          <MobileMenu
            isOperator={isOperator}
            isAuthenticated={Boolean(profile)}
            displayName={profile?.display_name ?? null}
          />
        </div>
      </div>
    </header>
  );
}
