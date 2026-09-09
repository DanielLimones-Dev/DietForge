const url = process.env.SUPABASE_HEALTH_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_HEALTH_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_HEALTH_URL y SUPABASE_HEALTH_ANON_KEY.');
  process.exit(2);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/dietforge_healthcheck`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: '{}',
    cache: 'no-store',
    signal: controller.signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true || body?.service !== 'dietforge-database') {
    throw new Error(`Supabase respondió ${response.status} sin una comprobación válida.`);
  }
  console.log(`DietForge Supabase activo: ${body.checked_at}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la comprobación de Supabase.');
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
