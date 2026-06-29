import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/auth";
import { AuthForm } from "@/components/AuthForm";

interface ILoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: ILoginPageProps) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  const profile = await getCurrentProfile();
  if (profile) redirect(safeNext);

  return (
    <div className="max-w-sm mx-auto space-y-6 py-6">
      <header className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Entra a la plataforma</h1>
        <p className="text-sm text-muted">
          Necesitas una cuenta para publicar campañas y votar.
        </p>
      </header>
      <AuthForm next={safeNext} />
    </div>
  );
}
