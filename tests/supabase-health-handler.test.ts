import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseHealthHandler } from '../src/lib/server/supabase-health-handler.ts';

const request = (secret?: string) => new Request('https://diet-forge.vercel.app/api/cron/supabase-health', {
  headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
});

test('Vercel health cron rejects requests without its secret', async () => {
  let called = false;
  const handler = createSupabaseHealthHandler({
    cronSecret: 'secret-value', url: 'https://example.supabase.co', publicKey: 'public-key',
    fetchFn: async () => { called = true; return Response.json({ ok: true }); },
  });
  const response = await handler(request());
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('Vercel health cron calls the public RPC with the anon key', async () => {
  let target = '';
  let authorization = '';
  const handler = createSupabaseHealthHandler({
    cronSecret: 'secret-value', url: 'https://example.supabase.co/', publicKey: 'public-key',
    fetchFn: async (input, init) => {
      target = String(input);
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return Response.json({ ok: true, service: 'dietforge-database', checked_at: '2026-09-09T09:17:00Z' });
    },
  });
  const response = await handler(request('secret-value'));
  assert.equal(response.status, 200);
  assert.equal(target, 'https://example.supabase.co/rest/v1/rpc/dietforge_healthcheck');
  assert.equal(authorization, 'Bearer public-key');
  assert.deepEqual(await response.json(), { ok: true, checkedAt: '2026-09-09T09:17:00Z' });
});

test('Vercel health cron reports an invalid Supabase response', async () => {
  const handler = createSupabaseHealthHandler({
    cronSecret: 'secret-value', url: 'https://example.supabase.co', publicKey: 'public-key',
    fetchFn: async () => Response.json({ ok: false }, { status: 500 }),
  });
  const response = await handler(request('secret-value'));
  assert.equal(response.status, 502);
});

