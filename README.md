# Apoyo Terremoto Venezuela 🇻🇪

Plataforma que centraliza y verifica campañas de **GoFundMe** de las familias
afectadas por el terremoto en Venezuela, para canalizar ayuda directa
(peer-to-peer) con transparencia.

## Funcionalidades (alineadas al PRD)

- **Dashboard de impacto financiero:** meta global, total recaudado, brecha
  restante y barra de progreso del esfuerzo comunitario.
- **Feed inteligente:** ordenamiento algorítmico inverso (las campañas más lejos
  de su meta aparecen primero) y filtros por categoría de necesidad (Médico,
  Funerario, Recuperación/Vivienda, Infantil) y por región.
- **Ingesta simplificada:** pega el enlace de GoFundMe y la plataforma intenta
  autocompletar título, descripción, imagen y montos (best-effort scraping).
- **Confianza híbrida (IA + humano):**
  - _Filtro inicial con IA_ que evalúa relevancia al terremoto y posibles
    duplicados al publicar.
  - _Sello de verificación humana_ otorgado por el equipo de voluntarios.
  - _Reporte comunitario_ (flagging): cualquiera reporta campañas sospechosas y
    se genera una alerta prioritaria en el panel.
- **Votación de confianza** (Confío / Desconfío) por la comunidad.
- **Soporte por WhatsApp** para guiar a las familias en la creación de su campaña.

## Stack

Next.js (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Auth + Postgres + RLS) · OpenRouter (AI SDK v7).

## Puesta en marcha

1. **Crea un proyecto Supabase** en https://supabase.com.

2. **Aplica el esquema.** En el SQL Editor del dashboard, ejecuta en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_campaign_view.sql`
   - `supabase/migrations/0003_drop_comments.sql`
   - `supabase/migrations/0004_prd_alignment.sql`

3. **Configura las variables de entorno.** Copia `.env.local.example` a
   `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   OPENROUTER_API_KEY=...            # opcional (filtro de IA)
   NEXT_PUBLIC_WHATSAPP_SUPPORT=...  # opcional (botón de soporte)
   ```
   Sin `OPENROUTER_API_KEY`, las campañas quedan en estado "pendiente" para
   revisión humana (todo lo demás funciona igual). La clave se obtiene en
   https://openrouter.ai/keys (modelo por defecto: `openrouter/owl-alpha`).

4. **(Opcional) Google login.** En Supabase → _Authentication → Providers_
   activa Google y añade `http://localhost:3000/auth/callback` como redirect.

5. **Instala y corre:**
   ```bash
   npm install
   npm run dev
   ```

## Nombrar voluntarios (operadores)

El rol se asigna manualmente. Después de que la persona se registre, en el SQL
Editor de Supabase:

```sql
update public.profiles
set role = 'operator'
where id = (select id from auth.users where email = 'voluntario@ejemplo.com');
```

## Estructura

```
src/
  app/                 Rutas (home, /nueva, /campana/[id], /login, /operador)
  components/          UI (ImpactDashboard, CampaignCard, TrustVoteWidget,
                       CampaignForm, ReportButton, OperatorActionBar, ...)
  lib/
    actions/           Server Actions (campañas, votos, reportes, ingesta)
    ai/                Filtro inicial con IA (relevancia + duplicados)
    ingest/            Extracción best-effort de GoFundMe
    data/              Lectura de datos (campañas, stats, reportes, auth)
    supabase/          Clientes browser/server/middleware
  types/               Interfaces TypeScript
supabase/migrations/   Esquema SQL + RLS
```
