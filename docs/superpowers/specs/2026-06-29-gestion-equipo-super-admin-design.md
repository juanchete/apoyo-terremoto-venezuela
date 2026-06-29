# Gestión de equipo (super-admin) — Diseño

Fecha: 2026-06-29
Estado: Aprobado

## Problema

El rol `operator` (admin/moderador) solo se puede asignar editando la base de
datos a mano. No hay forma desde la app de:

1. Dar de alta a un operador (crearle la cuenta con una contraseña que el admin
   elige) sin que la persona se registre sola.
2. Subir o bajar de rol a un usuario existente.

Además, hace falta un nivel por encima de `operator` que sea el único capaz de
administrar el equipo, para que un operador común no pueda crear más admins.

## Modelo de roles

Jerarquía: `user` < `operator` < `super_admin`.

- **user**: usuario normal (publica campañas, vota, reporta).
- **operator**: modera campañas (verificar, bajar/restaurar, resolver reportes).
  Es lo que ya existe hoy.
- **super_admin**: todo lo de `operator` + crear operadores + cambiar roles,
  incluido nombrar y quitar **otros** super_admins.

Se agrega el valor `'super_admin'` al enum `public.user_role`.

`super_admin` hereda las capacidades de `operator`: la función `is_operator()` y
el guard `requireOperator()` pasan a aceptar `operator` **o** `super_admin`. Si
no, un super_admin perdería el panel de moderación `/operador`.

### Bootstrap

`juanchetelopez@gmail.com` se promueve de `operator` a `super_admin` (es quien
va a administrar el equipo). Sin esto nadie podría usar el módulo.

## Seguridad y acceso a datos

Dos operaciones requieren privilegios que RLS bloquea a propósito (crear cuentas
de auth, cambiar el rol de un perfil). Ambas se ejecutan **solo en el servidor**
con la `service_role` key, nunca en el navegador.

- `src/lib/supabase/admin.ts` — cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY`
  (sin persistencia de sesión). Bypassa RLS; **solo** se usa dentro de acciones
  ya protegidas por `requireSuperAdmin()`.
- `src/lib/data/auth.ts` — se agrega `requireSuperAdmin()`; `requireOperator()`
  pasa a aceptar `super_admin`.
- `src/lib/actions/team.ts` — server actions, **todas** empiezan validando
  `requireSuperAdmin()`:
  - `createOperator({ email, displayName, password })`:
    `auth.admin.createUser({ email_confirm: true, user_metadata })` y luego
    fija el rol `operator` en el perfil.
  - `setRole(userId, role)`: cambia el rol (`user` | `operator` | `super_admin`).
- `src/lib/data/team.ts` — `getTeamMembers()` (guarded): combina `profiles` con
  los emails de `auth.users` (vía admin client) para listar el equipo.

### Variable de entorno requerida

`SUPABASE_SERVICE_ROLE_KEY` debe existir en `.env.local` y en Vercel. Es secreta;
no se commitea. Se agrega solo el nombre a `.env.local.example`.

## Salvaguardas (anti-bloqueo)

- Un super_admin **no puede cambiar su propio rol** (evita auto-bloqueo). Esto
  garantiza que siempre quede al menos un super_admin: el actor solo puede
  modificar a otros, nunca degradarse a sí mismo.
- `createOperator`: email válido y único (lo valida Supabase), contraseña
  mínima 8 caracteres. La contraseña no se guarda en ningún lado: solo se pasa a
  Supabase. Se muestra una vez al admin para que se la entregue a la persona.

## UI — ruta `/operador/equipo` (solo super_admin)

- `src/app/operador/equipo/page.tsx` — server component; `requireSuperAdmin()`,
  redirige si no aplica. Carga `getTeamMembers()`.
- Enlace "Equipo" en el panel `/operador`, visible solo a super_admin.
- **Sección A — Crear operador** (`CreateOperatorForm.tsx`, client): email +
  nombre + contraseña, con generador y toggle de mostrar contraseña. Al crear,
  muestra las credenciales para entregarlas.
- **Sección B — Gestión de roles** (`TeamRoleManager.tsx`, client): lista de
  todos los perfiles (nombre, email, rol) con control para cambiar de rol, con
  confirmación. La fila propia se marca y queda protegida.

## Cambios en archivos existentes

- `src/types/index.ts` — `TUserRole` agrega `'super_admin'`.
- `src/lib/data/auth.ts` — `requireOperator()` acepta super_admin;
  `requireSuperAdmin()` nuevo.
- `src/components/SiteHeader.tsx` — el link de operador se muestra a operator y
  super_admin.
- `src/app/operador/page.tsx` — el guard acepta super_admin; muestra el link a
  Equipo si es super_admin.
- `src/lib/constants.ts` — etiquetas de rol (`roleLabel`).
- `supabase/migrations/0008_super_admin.sql` — enum + funciones.

## Fuera de alcance (YAGNI)

- Registro de auditoría (quién cambió qué y cuándo).
- Invitación por email / reseteo de contraseña automático: el admin entrega las
  credenciales manualmente.
