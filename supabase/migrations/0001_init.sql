-- =============================================================
-- Apoyo Terremoto Venezuela — Esquema inicial
-- Plataforma de campañas de donación con votos de confianza,
-- comentarios y moderación por operadores.
-- =============================================================

-- ---------- Tipos ----------
create type public.user_role as enum ('user', 'operator');
create type public.campaign_status as enum ('active', 'removed');
create type public.comment_status as enum ('visible', 'removed');
create type public.vote_value as enum ('trust', 'distrust');

-- ---------- profiles ----------
-- Extiende auth.users con nombre visible y rol.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Anónimo',
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- ---------- campaigns ----------
create table public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 5 and 140),
  description     text not null check (char_length(description) between 20 and 5000),
  donation_url    text,
  payment_details text,
  region          text not null,
  image_url       text,
  status          public.campaign_status not null default 'active',
  is_verified     boolean not null default false,
  verified_by     uuid references public.profiles (id) on delete set null,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  -- Debe haber al menos una forma de donar.
  constraint donation_method_present
    check (donation_url is not null or payment_details is not null)
);

create index campaigns_status_idx  on public.campaigns (status);
create index campaigns_region_idx  on public.campaigns (region);
create index campaigns_created_idx on public.campaigns (created_at desc);

-- ---------- votes ----------
create table public.votes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  voter_id    uuid not null references public.profiles (id) on delete cascade,
  value       public.vote_value not null,
  created_at  timestamptz not null default now(),
  -- Un voto por persona por campaña (cambiable).
  unique (campaign_id, voter_id)
);

create index votes_campaign_idx on public.votes (campaign_id);

-- ---------- comments ----------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  status      public.comment_status not null default 'visible',
  created_at  timestamptz not null default now()
);

create index comments_campaign_idx on public.comments (campaign_id, created_at);

-- =============================================================
-- Helpers
-- =============================================================

-- ¿El usuario actual es operador? (security definer para evitar
-- recursión de RLS al leer profiles dentro de otras políticas)
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'operator'
  );
$$;

-- Crea un profile automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles  enable row level security;
alter table public.campaigns enable row level security;
alter table public.votes     enable row level security;
alter table public.comments  enable row level security;

-- ---------- profiles ----------
create policy "Perfiles visibles para todos"
  on public.profiles for select
  using (true);

create policy "Cada quien edita su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = 'user');

-- ---------- campaigns ----------
-- Lectura pública: campañas activas; el autor y los operadores ven todo.
create policy "Campañas activas son públicas"
  on public.campaigns for select
  using (
    status = 'active'
    or auth.uid() = author_id
    or public.is_operator()
  );

create policy "Usuarios autenticados crean campañas"
  on public.campaigns for insert
  to authenticated
  with check (auth.uid() = author_id);

-- El autor edita su campaña pero NO puede auto-verificarse ni cambiar estado.
create policy "El autor edita su campaña"
  on public.campaigns for update
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and is_verified = false
    and status = 'active'
  );

-- Operadores: verificar / bajar publicaciones (control total de update).
create policy "Operadores moderan campañas"
  on public.campaigns for update
  using (public.is_operator())
  with check (public.is_operator());

create policy "El autor o un operador borran la campaña"
  on public.campaigns for delete
  using (auth.uid() = author_id or public.is_operator());

-- ---------- votes ----------
create policy "Votos visibles para todos"
  on public.votes for select
  using (true);

create policy "Usuarios autenticados votan"
  on public.votes for insert
  to authenticated
  with check (auth.uid() = voter_id);

create policy "Cada quien cambia su voto"
  on public.votes for update
  using (auth.uid() = voter_id)
  with check (auth.uid() = voter_id);

create policy "Cada quien retira su voto"
  on public.votes for delete
  using (auth.uid() = voter_id);

-- ---------- comments ----------
create policy "Comentarios visibles son públicos"
  on public.comments for select
  using (
    status = 'visible'
    or auth.uid() = author_id
    or public.is_operator()
  );

create policy "Usuarios autenticados comentan"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "El autor edita su comentario"
  on public.comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id and status = 'visible');

create policy "Operadores moderan comentarios"
  on public.comments for update
  using (public.is_operator())
  with check (public.is_operator());

create policy "El autor o un operador borran el comentario"
  on public.comments for delete
  using (auth.uid() = author_id or public.is_operator());
