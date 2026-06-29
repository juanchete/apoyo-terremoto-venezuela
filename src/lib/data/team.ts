import { requireSuperAdmin } from '@/lib/data/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ITeamMember, IProfile } from '@/types';

// Lista todos los miembros (perfil + email de auth). Solo para super_admin.
// Combina public.profiles con auth.users para traer el email, que no vive en
// la tabla de perfiles.
export async function getTeamMembers(): Promise<ITeamMember[]> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, display_name, role, created_at')
    .order('created_at', { ascending: true })
    .returns<IProfile[]>();

  if (error || !profiles) return [];

  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailById = new Map<string, string | null>(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  return profiles.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    created_at: p.created_at,
    email: emailById.get(p.id) ?? null,
  }));
}
