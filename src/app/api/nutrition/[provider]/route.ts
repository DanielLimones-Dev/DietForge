import "server-only";
import { createNutritionHandler } from "@/lib/server/nutrition-handler";

export const runtime = "nodejs";

const handle = createNutritionHandler({
  credentials: {
    usdaApiKey: process.env.USDA_API_KEY,
    fatSecretClientId: process.env.FATSECRET_CONSUMER_KEY,
    fatSecretClientSecret: process.env.FATSECRET_CONSUMER_SECRET,
    fatSecretWorker: process.env.FATSECRET_WORKER,
  },
  fetch: (...args) => fetch(...args),
  verifyAccess: async token => {
    // Verify with Auth directly; this server route needs no browser client,
    // persistent session or Realtime/WebSocket transport.
    const response = await fetch(new URL("/rest/v1/rpc/dietforge_has_access", process.env.NEXT_PUBLIC_SUPABASE_URL!), {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new Error("auth_unavailable");
    return await response.json() === true;
  },
});

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handle(request, provider);
}
