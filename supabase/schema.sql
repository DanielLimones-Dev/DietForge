-- DietForge Subscription Schema
-- Pega esto en Supabase SQL Editor (https://supabase.com/dashboard/project/wbcucdmnyegeqmwqhifl/sql/new)

-- 1. Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'paused')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  price_id TEXT,
  product_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla para deduplicación de eventos Stripe (idempotency)
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events (type);

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. RLS: permitir SELECT anónimo (solo email y estado, datos mínimos)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'anon_select_subscriptions') THEN
    CREATE POLICY anon_select_subscriptions ON subscriptions
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stripe_events' AND policyname = 'anon_select_stripe_events') THEN
    CREATE POLICY anon_select_stripe_events ON stripe_events
      FOR SELECT USING (true);
  END IF;
END;
$$;

-- 6. Función para verificar suscripción (usada por Edge Function)
CREATE OR REPLACE FUNCTION check_subscription(p_email TEXT)
RETURNS TABLE (
  active BOOLEAN,
  status TEXT,
  current_period_end TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status = 'active' AS active,
    s.status,
    s.current_period_end
  FROM subscriptions s
  WHERE s.email = p_email
  LIMIT 1;
END;
$$;

-- 7. Función para upsert de suscripción desde Stripe webhook
CREATE OR REPLACE FUNCTION upsert_subscription(
  p_email TEXT,
  p_status TEXT,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_price_id TEXT,
  p_product_id TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ
) RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result subscriptions;
BEGIN
  INSERT INTO subscriptions (email, status, stripe_customer_id, stripe_subscription_id, price_id, product_id, current_period_start, current_period_end)
  VALUES (p_email, p_status, p_stripe_customer_id, p_stripe_subscription_id, p_price_id, p_product_id, p_current_period_start, p_current_period_end)
  ON CONFLICT (stripe_subscription_id)
  DO UPDATE SET
    status = p_status,
    price_id = p_price_id,
    product_id = p_product_id,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    canceled_at = CASE WHEN p_status = 'canceled' THEN NOW() ELSE NULL END
  RETURNING * INTO result;
  RETURN result;
END;
$$;
