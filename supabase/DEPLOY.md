# Deploy Supabase para DietForge

## 1. SQL Schema
1. Ve a https://supabase.com/dashboard/project/wbcucdmnyegeqmwqhifl/sql/new
2. Pega el contenido de `schema.sql`
3. Ejecuta

## 1.1 Persistencia cloud de DietForge

La migración `migrations/20260906010000_dietforge_cloud.sql` crea el espacio cloud por propietario, sus registros, RLS y las funciones RPC usadas por el frontend. Aplicarla después del esquema base:

```bash
supabase link --project-ref wbcucdmnyegeqmwqhifl
supabase db query --linked --file supabase/migrations/20260906010000_dietforge_cloud.sql
```

La aplicación usa Supabase Auth por enlace de acceso al correo. Las lecturas y escrituras cloud requieren una sesión autenticada; no se debe sustituir `NEXT_PUBLIC_SUPABASE_ANON_KEY` por una clave service role. Configurar `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS definitivo y permitir la ruta `/auth/callback?next=password` de ese dominio en Authentication → URL Configuration → Redirect URLs; el alta de un coach usa ese destino para su invitación.


### SMTP de autenticación

Desde el 2026-09-08, Authentication → Emails → SMTP Settings usa SMTP personalizado de Gmail con remitente `DietForge <tilabrona99@gmail.com>`, host `smtp.gmail.com`, puerto TLS 465 e intervalo mínimo de 60 segundos por usuario. La contraseña de aplicación solo vive cifrada en Supabase y no debe copiarse al repositorio, archivos `.env`, documentación ni memoria. Gmail es adecuado para la beta interna de bajo volumen; antes de escalar, cambiar a un proveedor transaccional y un dominio propio para mejorar entregabilidad.

La migración cloud ya está aplicada al proyecto enlazado. No volver a ejecutarla ni reimportar el snapshot por migrar el frontend a Next.js.

Las ampliaciones del snapshot se aplican por orden de archivo. Las que cambian colecciones son:

1. `migrations/20260906020000_admin_access.sql`
2. `migrations/20260907030000_training_programs.sql`
3. `migrations/20260908010000_client_portal.sql`
4. `migrations/20260908090000_exercise_catalog.sql`

La última incorpora `exercises` a la restricción y a las RPC `dietforge_load`/`dietforge_save`. En esta instalación todas las migraciones hasta `20260908090000` constan como aplicadas en el historial remoto. Verificar con `supabase migration list --linked` antes de ejecutar una migración manualmente.

## 2. Stripe Webhook Edge Function
```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login (necesitas token de https://supabase.com/dashboard/account/tokens)
supabase login

# Link al proyecto
supabase link --project-ref wbcucdmnyegeqmwqhifl

# Definir secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_URL=https://wbcucdmnyegeqmwqhifl.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sr_...

# Deploy Edge Functions
supabase functions deploy stripe-webhook
supabase functions deploy check-subscription
```

## 3. Stripe Webhook Config
1. Ve a Stripe Dashboard → Developers → Webhooks
2. "Add endpoint": `https://wbcucdmnyegeqmwqhifl.supabase.co/functions/v1/stripe-webhook`
3. Eventos a escuchar:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.resumed`
   - `customer.subscription.paused`
   - `invoice.payment_failed`
4. Obtén el `Signing secret` (whsec_...) y ponlo en `STRIPE_WEBHOOK_SECRET`

## 4. Stripe Payment Link
1. Stripe Dashboard → Productos → Crear producto "DietForge Pro" ($500 MXN/mes)
2. Crear Payment Link para ese precio
3. Copiar las URL a `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY` y `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ANNUAL` en `.env.local`.

## 5. Frontend
Next.js lee `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`. Build: `npm run build`; producción: `npm run start`.

En Authentication → URL Configuration, permitir `http://localhost:3000/**` y `http://127.0.0.1:3000/**`. Al publicar, añadir el dominio HTTPS definitivo. La migración de framework no cambia la configuración remota de Auth.

## Portal y calidad — 2026-09-08
Aplicar en orden las cinco migraciones `20260908*`. Las RPC públicas conservan verificación comercial y las internas no deben exponerse. Registrar URLs `/auth/callback?next=portal` y `/auth/callback?next=password&portal=1` en los redirects permitidos de Auth para cada dominio de despliegue. Validar con `tests/sql/client-portal.sql` (datos ficticios y ROLLBACK). Ver `docs/CLIENT_CARE.md`.

## Healthcheck y pausa por inactividad

`20260908050000_healthcheck.sql` está aplicada y registrada. `npm run health:supabase` comprueba la base real con la clave anon. El workflow programado requiere `SUPABASE_HEALTH_URL` y `SUPABASE_HEALTH_ANON_KEY` como secretos de GitHub. Esta señal no es una garantía contractual contra la pausa del plan Free; usar una organización Pro antes de una beta externa.
