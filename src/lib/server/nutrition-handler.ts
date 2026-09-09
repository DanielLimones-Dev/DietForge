import { z } from "zod";

const searchSchema = z.object({
  provider: z.enum(["usda", "fatsecret"]),
  q: z.string().trim().min(2).max(120),
});

interface Credentials {
  usdaApiKey?: string;
  fatSecretClientId?: string;
  fatSecretClientSecret?: string;
  fatSecretWorker?: string;
}

interface Dependencies {
  credentials: Credentials;
  verifyAccess: (token: string) => Promise<boolean>;
  fetch: typeof fetch;
}

// The Next route owns credentials. This factory is independently testable
// without reaching live services or importing the browser's Supabase client.
export function createNutritionHandler(deps: Dependencies) {
  let token: { access: string; expires: number } | null = null;
  const respond = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  const upstream = async (url: string | URL, init?: RequestInit) => {
    const response = await deps.fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("upstream_error");
    const data = await response.json();
    if (!data || typeof data !== "object" || data.error) throw new Error("upstream_error");
    return data;
  };

  async function fatSecretToken() {
    if (token && token.expires > Date.now()) return token.access;
    const data = await upstream("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: deps.credentials.fatSecretClientId!,
        client_secret: deps.credentials.fatSecretClientSecret!,
      }),
    });
    if (typeof data.access_token !== "string" || !Number.isFinite(Number(data.expires_in))) throw new Error("upstream_error");
    token = { access: data.access_token, expires: Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000 };
    return token.access;
  }

  return async (request: Request, provider: string) => {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return respond({ error: "Inicia sesión para buscar alimentos." }, 401);
    try {
      if (!await deps.verifyAccess(bearer)) return respond({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, 401);
    } catch {
      return respond({ error: "No se pudo verificar tu sesión. Intenta de nuevo." }, 503);
    }
    const parsed = searchSchema.safeParse({ provider, q: new URL(request.url).searchParams.get("q") });
    if (!parsed.success) return respond({ error: "Indica un proveedor válido y una búsqueda de 2 a 120 caracteres." }, 400);

    const { q } = parsed.data;
    try {
      if (provider === "usda") {
        const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
        url.search = new URLSearchParams({ api_key: deps.credentials.usdaApiKey || "DEMO_KEY", query: q, pageSize: "10" }).toString();
        return respond(await upstream(url));
      }
      if (deps.credentials.fatSecretWorker) {
        const url = new URL(deps.credentials.fatSecretWorker);
        url.searchParams.set("q", q);
        return respond(await upstream(url));
      }
      if (!deps.credentials.fatSecretClientId || !deps.credentials.fatSecretClientSecret) {
        return respond({ error: "La búsqueda de FatSecret todavía no está configurada." }, 503);
      }
      const access = await fatSecretToken();
      const data = await upstream("https://platform.fatsecret.com/rest/server.api", {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ method: "foods.search", search_expression: q, format: "json", max_results: "20" }),
      });
      return respond(data);
    } catch {
      // Do not relay upstream bodies, URLs or exception messages: they may
      // contain credentials. The local food database remains available.
      token = null;
      return respond({ error: "El servicio de alimentos no está disponible. Intenta más tarde." }, 502);
    }
  };
}
