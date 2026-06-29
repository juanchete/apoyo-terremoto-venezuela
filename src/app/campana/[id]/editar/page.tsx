import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCampaignById } from "@/lib/data/campaigns";
import { getCurrentProfile } from "@/lib/data/auth";
import { CampaignForm } from "@/components/CampaignForm";

interface IEditarCampanaProps {
  params: Promise<{ id: string }>;
}

export default async function EditarCampanaPage({ params }: IEditarCampanaProps) {
  const { id } = await params;

  const [campaign, profile] = await Promise.all([
    getCampaignById(id),
    getCurrentProfile(),
  ]);

  if (!campaign) notFound();
  if (!profile) redirect(`/login?next=/campana/${id}/editar`);
  // Solo el autor edita desde esta pantalla (los operadores moderan en su panel).
  if (campaign.author_id !== profile.id) redirect(`/campana/${id}`);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/campana/${id}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← Volver a la campaña
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Editar campaña</h1>
        <p className="text-sm text-muted">
          Actualiza la información de tu campaña.
        </p>
      </header>

      {campaign.is_verified ? (
        <div className="rounded-lg border border-verified/40 bg-verified/5 p-4 text-sm">
          Esta campaña ya está <strong>verificada</strong>. Para evitar cambios
          después de la revisión, no se puede editar mientras tenga el sello. Si
          necesitas modificarla, contacta a un operador para que retire la
          verificación.
        </div>
      ) : (
        <CampaignForm campaign={campaign} />
      )}
    </div>
  );
}
