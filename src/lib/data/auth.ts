import { createClient } from '@/lib/supabase/server';
import type { IProfile } from '@/types';

export async function getCurrentProfile(): Promise<IProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<IProfile>();

  return data;
}

export async function requireOperator(): Promise<IProfile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'operator') {
    throw new Error('No autorizado: se requiere rol de operador.');
  }
  return profile;
}
