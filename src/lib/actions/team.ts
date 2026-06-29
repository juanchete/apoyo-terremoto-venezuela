'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/data/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TUserRole } from '@/types';

export interface ITeamActionResult {
  error?: string;
  success?: string;
}

const VALID_ROLES: readonly TUserRole[] = ['user', 'operator', 'super_admin'];

// Crea una cuenta de operador en nombre de la persona, con una contraseña que
// el super_admin elige. La cuenta queda confirmada (puede entrar de una). La
// contraseña no se almacena: solo se pasa a Supabase.
export async function createOperator(
  formData: FormData,
): Promise<ITeamActionResult> {
  const admin = await requireSuperAdmin().catch(() => null);
  if (!admin) return { error: 'No autorizado.' };

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const displayName = String(formData.get('display_name') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !email.includes('@')) {
    return { error: 'Correo inválido.' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: displayName ? { full_name: displayName } : undefined,
  });

  if (error || !data.user) {
    return { error: error?.message ?? 'No se pudo crear la cuenta.' };
  }

  // El trigger handle_new_user ya creó el perfil con rol 'user'; lo subimos a
  // operador.
  const { error: roleError } = await supabase
    .from('profiles')
    .update({ role: 'operator' })
    .eq('id', data.user.id);

  if (roleError) {
    return {
      error: `Cuenta creada pero no se pudo asignar el rol: ${roleError.message}`,
    };
  }

  revalidatePath('/operador/equipo');
  return { success: `Operador creado: ${email}` };
}

// Sube o baja de rol a un usuario. Solo super_admin. No permite cambiar el
// propio rol (evita auto-bloqueo y garantiza que siempre quede un super_admin).
export async function setRole(
  userId: string,
  role: TUserRole,
): Promise<ITeamActionResult> {
  const admin = await requireSuperAdmin().catch(() => null);
  if (!admin) return { error: 'No autorizado.' };

  if (!VALID_ROLES.includes(role)) {
    return { error: 'Rol inválido.' };
  }
  if (userId === admin.id) {
    return { error: 'No puedes cambiar tu propio rol.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return { error: error.message };

  revalidatePath('/operador/equipo');
  revalidatePath('/operador');
  revalidatePath('/');
  return { success: 'Rol actualizado.' };
}
