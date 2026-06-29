-- =============================================================
-- 0008 — Rol super_admin
-- Jerarquía: user < operator < super_admin.
-- super_admin hereda las capacidades de operator y además administra el equipo
-- (crear operadores, cambiar roles). La gestión de equipo se hace desde server
-- actions con service_role; estas funciones solo gobiernan la herencia de
-- permisos de moderación en RLS.
-- =============================================================

alter type public.user_role add value if not exists 'super_admin';

-- ¿El usuario actual puede moderar? Ahora incluye a super_admin.
-- Se compara como texto para no referenciar el nuevo valor del enum dentro de
-- la misma transacción en que se agrega (evita el error "unsafe use of new
-- value of enum type").
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role::text in ('operator', 'super_admin')
  );
$$;

-- ¿El usuario actual es super_admin?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role::text = 'super_admin'
  );
$$;
