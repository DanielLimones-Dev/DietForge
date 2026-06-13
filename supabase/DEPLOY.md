# Deploy Supabase para DietForge

## 1. SQL Schema
1. Ve a https://supabase.com/dashboard/project/wbcucdmnyegeqmwqhifl/sql/new
2. Pega el contenido de `schema.sql`
3. Ejecuta

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
3. Copiar URL a `VITE_STRIPE_PAYMENT_LINK` en `.env`

## 5. Frontend
El `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_URL` ya están en `.env`.
Build: `npm run build`
