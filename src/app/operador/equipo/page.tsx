import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/auth";
import { getTeamMembers } from "@/lib/data/team";
import { CreateOperatorForm } from "@/components/CreateOperatorForm";
import { TeamRoleManager } from "@/components/TeamRoleManager";

export default async function EquipoPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/operador/equipo");
  if (profile.role !== "super_admin") redirect("/operador");

  const members = await getTeamMembers();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <Link href="/operador" className="text-sm text-muted hover:underline">
            ← Panel
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-sm text-muted">
          Da de alta operadores y administra los roles. Solo el super
          administrador ve esta sección.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Crear operador</h2>
          <p className="text-sm text-muted">
            Le creas la cuenta con una contraseña que tú eliges. La persona podrá
            entrar de inmediato con esas credenciales.
          </p>
        </div>
        <CreateOperatorForm />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-lg">Gestión de roles</h2>
          <p className="text-sm text-muted">
            Sube o baja de rol a cualquier persona. No puedes cambiar tu propio
            rol.
          </p>
        </div>
        <TeamRoleManager members={members} currentUserId={profile.id} />
      </section>
    </div>
  );
}
