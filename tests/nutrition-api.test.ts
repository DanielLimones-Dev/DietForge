import assert from "node:assert/strict";
import { test } from "node:test";
import { createNutritionHandler } from "../src/lib/server/nutrition-handler";

const request = (q = "pollo", token: string | null = "test-session") => new Request(`http://localhost/api/nutrition/usda?q=${encodeURIComponent(q)}`, {
  headers: token ? { authorization: `Bearer ${token}` } : {},
});
test("requires a valid account before calling any nutrition provider", async () => {
  let called = false;
  const handle = createNutritionHandler({ credentials: {}, verifyAccess: async () => false, fetch: async () => { called = true; return Response.json({}); } });
  assert.equal((await handle(request("pollo", null), "usda")).status, 401);
  assert.equal((await handle(request(), "usda")).status, 401);
  assert.equal(called, false);
});
test("validates query length and limits provider selection", async () => {
  const handle = createNutritionHandler({ credentials: {}, verifyAccess: async () => true, fetch: async () => { throw new Error("must not call upstream"); } });
  for (const q of ["", " ", "p", "x".repeat(121)]) assert.equal((await handle(request(q), "usda")).status, 400);
  assert.equal((await handle(request(), "https://attacker.invalid")).status, 400);
});
test("USDA credentials stay in the server request and results are not cached", async () => {
  let upstreamUrl = "";
  const handle = createNutritionHandler({ credentials: { usdaApiKey: "server-secret" }, verifyAccess: async () => true,
    fetch: async (url, init) => { upstreamUrl = String(url); assert.equal(init?.cache, "no-store"); return Response.json({ foods: [{ fdcId: 123 }] }); },
  });
  const response = await handle(request("pollo & arroz"), "usda");
  assert.equal(response.status, 200);
  assert.equal(new URL(upstreamUrl).searchParams.get("query"), "pollo & arroz");
  assert.equal(new URL(upstreamUrl).searchParams.get("api_key"), "server-secret");
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  assert.doesNotMatch(await response.text(), /server-secret/);
});
test("FatSecret caches OAuth tokens and uses the summary response expected by the app", async () => {
  let exchanges = 0;
  const handle = createNutritionHandler({ credentials: { fatSecretClientId: "client", fatSecretClientSecret: "private" }, verifyAccess: async () => true,
    fetch: async (url, init) => {
      if (String(url).includes("oauth.fatsecret.com")) { exchanges++; return Response.json({ access_token: "provider-token", expires_in: 3600 }); }
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer provider-token");
      assert.equal(new URLSearchParams(String(init?.body)).get("method"), "foods.search");
      return Response.json({ foods: { food: [] } });
    },
  });
  assert.equal((await handle(request(), "fatsecret")).status, 200);
  assert.equal((await handle(request(), "fatsecret")).status, 200);
  assert.equal(exchanges, 1);
});
test("retains the optional existing FatSecret worker", async () => {
  let target = "";
  const handle = createNutritionHandler({ credentials: { fatSecretWorker: "https://example.workers.dev/search?region=MX" }, verifyAccess: async () => true,
    fetch: async url => { target = String(url); return Response.json({ foods: { food: [] } }); },
  });
  assert.equal((await handle(request(), "fatsecret")).status, 200);
  assert.equal(new URL(target).searchParams.get("region"), "MX");
  assert.equal(new URL(target).searchParams.get("q"), "pollo");
});
test("never returns upstream errors that may contain credentials", async () => {
  const handle = createNutritionHandler({ credentials: { usdaApiKey: "private" }, verifyAccess: async () => true,
    fetch: async () => { throw new Error("request failed: ?api_key=private"); },
  });
  const result = await handle(request(), "usda");
  assert.equal(result.status, 502);
  assert.doesNotMatch(await result.text(), /api_key|private/);
});
test("reports missing provider setup and temporary authentication outages", async () => {
  const handle = createNutritionHandler({ credentials: {}, verifyAccess: async () => true, fetch: async () => Response.json({}) });
  assert.equal((await handle(request(), "fatsecret")).status, 503);
  const unavailable = createNutritionHandler({ credentials: {}, verifyAccess: async () => { throw new Error("offline"); }, fetch });
  assert.equal((await unavailable(request(), "usda")).status, 503);
});
