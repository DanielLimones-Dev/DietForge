type HealthFetch = typeof fetch;

type HealthHandlerOptions = {
  cronSecret?: string;
  url?: string;
  publicKey?: string;
  fetchFn?: HealthFetch;
};

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** Protected Vercel Cron handler that checks the database through its public RPC. */
export const createSupabaseHealthHandler = ({
  cronSecret,
  url,
  publicKey,
  fetchFn = fetch,
}: HealthHandlerOptions) => async (request: Request) => {
  if (!cronSecret || !url || !publicKey) {
    return json({ ok: false, error: 'Health check no configurado.' }, 503);
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'No autorizado.' }, 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchFn(
      `${url.replace(/\/$/, '')}/rest/v1/rpc/dietforge_healthcheck`,
      {
        method: 'POST',
        headers: {
          apikey: publicKey,
          authorization: `Bearer ${publicKey}`,
          'content-type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    const body = await response.json().catch(() => null) as {
      ok?: boolean;
      service?: string;
      checked_at?: string;
    } | null;
    if (!response.ok || body?.ok !== true || body.service !== 'dietforge-database') {
      return json({ ok: false, error: 'Supabase no confirmó su estado.' }, 502);
    }
    return json({ ok: true, checkedAt: body.checked_at ?? null }, 200);
  } catch {
    return json({ ok: false, error: 'No fue posible comprobar Supabase.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
};

