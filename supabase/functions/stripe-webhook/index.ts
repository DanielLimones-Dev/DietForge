import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

async function verifyStripeSignature(body: string, signature: string): Promise<any> {
  const { default: Stripe } = await import("npm:stripe@14.21.0");
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  return stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
}

async function getCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const { default: Stripe } = await import("npm:stripe@14.21.0");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) return customer.email || null;
    return null;
  } catch {
    return null;
  }
}

async function upsertSubscription(subscription: any, email: string) {
  const item = subscription.items?.data?.[0]?.price;
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  await supabase.rpc("upsert_subscription", {
    p_email: email,
    p_status: subscription.status,
    p_stripe_customer_id: subscription.customer,
    p_stripe_subscription_id: subscription.id,
    p_price_id: item?.id || null,
    p_product_id: item?.product || null,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400, headers: CORS_HEADERS });
  }

  const body = await req.text();

  let event: any;
  try {
    event = await verifyStripeSignature(body, signature);
  } catch {
    return new Response("Invalid signature", { status: 400, headers: CORS_HEADERS });
  }

  const { error: dedupError } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (dedupError?.code === "23505") {
    return new Response("Event already processed", { status: 200, headers: CORS_HEADERS });
  }

  const subscription = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const email = subscription.metadata?.email || subscription.customer_details?.email;
      if (email && subscription.subscription) {
        try {
          const { default: Stripe } = await import("npm:stripe@14.21.0");
          const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
          const sub = await stripe.subscriptions.retrieve(subscription.subscription);
          await upsertSubscription(sub, email);
        } catch { /* fall through to subscription event */ }
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.resumed":
    case "customer.subscription.paused": {
      const email = subscription.metadata?.email || await getCustomerEmail(subscription.customer);
      if (!email) {
        console.error("No email for subscription", subscription.id);
        return new Response("No email found", { status: 200, headers: CORS_HEADERS });
      }
      await upsertSubscription(subscription, email);
      break;
    }

    case "customer.subscription.deleted": {
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "invoice.payment_failed": {
      if (subscription.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subscription.subscription);
      }
      break;
    }
  }

  return new Response("OK", { status: 200, headers: CORS_HEADERS });
});
