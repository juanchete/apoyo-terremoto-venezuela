import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/auth";
import { CampaignForm } from "@/components/CampaignForm";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

export default async function NuevaCampanaPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/nueva");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Publicar una campaña</h1>
        <p className="text-sm text-muted">
          Pega el enlace de tu GoFundMe y deja que autocompletemos los datos.
          Revisa y ajusta lo necesario antes de publicar.
        </p>
      </header>

      <WhatsAppSupport />

      <CampaignForm />
    </div>
  );
}
