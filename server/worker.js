// Cloudflare Worker — Proxy para FatSecret API
// 1. Copia este archivo a https://dash.cloudflare.com/?to=workers
// 2. Crea un nuevo Worker, pega el código
// 3. Añade las variables de entorno en la UI:
//    FS_CLIENT_ID y FS_CLIENT_SECRET
// 4. La URL del worker será: https://fatsecret-proxy.tunombre.workers.dev

const FS_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FS_API = "https://platform.fatsecret.com/rest/server.api";

let tokenCache = { access: "", expires: 0 };

async function getToken(env) {
  if (tokenCache.access && Date.now() < tokenCache.expires) return tokenCache.access;
  const res = await fetch(FS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.FS_CLIENT_ID,
      client_secret: env.FS_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  tokenCache = { access: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    if (!query) return new Response("Missing ?q=", { status: 400 });

    try {
      const token = await getToken(env);
      const body = new URLSearchParams({
        method: "foods.search.v5",
        search_expression: query,
        format: "json",
        max_results: "20",
      });

      const res = await fetch(FS_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
