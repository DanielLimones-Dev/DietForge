import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_DELETION_PHRASE,
  PRIVACY_NOTICE_EFFECTIVE_DATE,
  PRIVACY_NOTICE_VERSION,
  consentIsCurrent,
  consentSummary,
  deletionConfirmationError,
  formatConsentTimestamp,
  privacyExportFilename,
  signupPrivacyError,
} from '../src/lib/privacy';
import { createAccountDeleteHandler } from '../src/lib/server/account-privacy-handler';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('the notice metadata is a stable, dated version shared by every screen', () => {
  assert.equal(PRIVACY_NOTICE_VERSION, '1.0');
  assert.equal(PRIVACY_NOTICE_EFFECTIVE_DATE, '2026-11-16');
  assert.match(PRIVACY_CONTACT_EMAIL, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(PRIVACY_DELETION_PHRASE, 'ELIMINAR');
});

test('no account is created without accepting the privacy notice', () => {
  const base = { email: 'clienta@example.invalid', password: 'frase-larga-segura', confirmation: 'frase-larga-segura', accepted: true };
  assert.equal(signupPrivacyError(base), null);
  assert.match(signupPrivacyError({ ...base, accepted: false }) ?? '', /aceptar el aviso de privacidad/);
  // Las validaciones previas tampoco se saltan al aceptar.
  assert.match(signupPrivacyError({ ...base, email: 'sin-arroba' }) ?? '', /correo válido/);
  assert.match(signupPrivacyError({ ...base, password: 'corta' }) ?? '', /12 y 128/);
  assert.match(signupPrivacyError({ ...base, confirmation: 'otra-cosa-distinta' }) ?? '', /no coinciden/);
});

test('account deletion requires the typed email and the exact phrase', () => {
  const account = 'Coach@Example.com';
  assert.equal(deletionConfirmationError({ email: ' coach@example.com ', phrase: 'eliminar' }, account), null);
  assert.match(deletionConfirmationError({ email: 'otro@example.com', phrase: 'ELIMINAR' }, account) ?? '', /correo no coincide/);
  assert.match(deletionConfirmationError({ email: 'coach@example.com', phrase: 'BORRAR' }, account) ?? '', /ELIMINAR/);
  assert.match(deletionConfirmationError({ email: 'coach@example.com', phrase: '' }, '') ?? '', /correo de tu cuenta/);
});

test('export filename uses the civil date and consent dates render in UTC', () => {
  assert.equal(privacyExportFilename(new Date(2026, 10, 16)), 'dietforge-mis-datos-2026-11-16.json');
  assert.equal(formatConsentTimestamp('2026-11-16T18:05:00.000Z'), '16/11/2026 18:05 UTC');
  assert.equal(formatConsentTimestamp('no-es-fecha'), '');
  assert.equal(consentSummary(null), 'Sin consentimiento registrado');
  assert.equal(consentSummary({ version: '1.0', accepted_at: '2026-11-16T18:05:00.000Z' }), 'Versión 1.0 · 16/11/2026 18:05 UTC');
  assert.equal(consentIsCurrent({ version: '1.0' }), true);
  assert.equal(consentIsCurrent({ version: '0.9' }), false);
});

test('the registration flow validates consent before calling signUp and keeps the notice link', () => {
  const portal = read('src/components/PortalAuth.tsx');
  const guard = portal.indexOf('signupPrivacyError({email:mail,password,confirmation:confirm,accepted})');
  const signUp = portal.indexOf('supabase.auth.signUp(');
  assert.ok(guard > 0 && signUp > guard, 'consent is verified before creating the account');
  assert.match(portal, /PrivacyConsentField/);
  assert.match(portal, /privacy_notice_version/);
  assert.match(portal, /href="\/privacidad"/);

  const activation = read('src/app/auth/password/page.tsx');
  const activationGuard = activation.indexOf("if(!accepted)");
  const update = activation.indexOf('supabase.auth.updateUser({password})');
  assert.ok(activationGuard > 0 && update > activationGuard, 'the coach cannot activate without consent');
  assert.match(activation, /recordPrivacyConsent\('coach_activation'\)/);
});

test('the public notice and the in-app entry points exist', () => {
  const notice = read('src/app/privacidad/page.tsx');
  for (const term of ['LFPDPPP', 'derechos ARCO', 'Acceso', 'Rectificación', 'Cancelación', 'Oposición', '20 días hábiles', 'PRIVACY_CONTACT_EMAIL', 'mailto:${PRIVACY_CONTACT_EMAIL}']) {
    assert.ok(notice.includes(term), `the notice explains ${term}`);
  }
  assert.match(notice, /PRIVACY_NOTICE_VERSION/);
  assert.match(read('src/components/Layout.tsx'), /href="\/privacidad"/);
  assert.match(read('src/components/LoginScreen.tsx'), /href="\/privacidad"/);
  assert.match(read('src/components/AccountPrivacy.tsx'), /Exportar mis datos/);
  assert.match(read('src/components/AccountPrivacy.tsx'), /Eliminar mi cuenta/);
});

test('the migration stores consent with RLS and purges backups on deletion', () => {
  const sql = read('supabase/migrations/20261116010000_privacy_consent_and_deletion.sql');
  assert.match(sql, /dietforge_privacy_consents/);
  assert.match(sql, /dietforge_privacy_requests/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /USING\(user_id=auth\.uid\(\)\)/);
  assert.match(sql, /DELETE FROM public\.dietforge_backups WHERE owner_id=u/);
  assert.match(sql, /DELETE FROM public\.dietforge_workspaces WHERE owner_id=u/);
  assert.match(sql, /dietforge_privacy_delete_account/);
  assert.match(sql, /dietforge_privacy_export/);
  assert.match(sql, /dietforge_privacy_record_consent/);
  assert.match(sql, /REVOKE ALL ON FUNCTION .* FROM PUBLIC,anon/);
});

const deleteRequest = (token: string | null, body: unknown) => new Request('http://localhost/api/account/delete', {
  method: 'POST',
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const requestId = '33333333-3333-4333-8333-333333333333';

test('account deletion refuses anonymous callers before touching privileged credentials', async () => {
  let calls = 0;
  const handler = createAccountDeleteHandler({
    url: 'https://fixture.invalid', publicKey: 'public', serviceKey: 'secret',
    fetch: async () => { calls++; return Response.json({}); },
  });
  const response = await handler(deleteRequest(null, { requestId }));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('account deletion validates the request id before calling Supabase', async () => {
  let calls = 0;
  const handler = createAccountDeleteHandler({
    url: 'https://fixture.invalid', publicKey: 'public', serviceKey: 'secret',
    fetch: async () => { calls++; return Response.json({}); },
  });
  const response = await handler(deleteRequest('session', { requestId: 'no-es-uuid' }));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('account deletion purges storage and the auth identity with the caller session', async () => {
  const calls: string[] = [];
  const handler = createAccountDeleteHandler({
    url: 'https://fixture.invalid', publicKey: 'public', serviceKey: 'secret',
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname; calls.push(`${init?.method} ${path}`);
      if (path.endsWith('/auth/v1/user')) return Response.json({ id: 'user-id', email: 'clienta@example.invalid' });
      if (path.endsWith('dietforge_privacy_delete_account')) {
        assert.deepEqual(JSON.parse(init!.body as string), { p_request_id: requestId });
        assert.equal(new Headers(init!.headers).get('authorization'), 'Bearer session');
        return Response.json({ deleted: true, email: 'clienta@example.invalid' });
      }
      if (path.endsWith('/object/list/training-videos')) return Response.json([{ name: 'demo.mp4' }]);
      if (path.endsWith('/object/list/checkin-photos')) return Response.json([]);
      if (path.endsWith('/object/list/recipe-photos')) return Response.json([]);
      if (path.endsWith('/object/training-videos')) {
        assert.deepEqual(JSON.parse(init!.body as string), { prefixes: ['user-id/demo.mp4'] });
        return Response.json({});
      }
      if (path.endsWith('/admin/users/user-id')) return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    },
  });
  const response = await handler(deleteRequest('session', { requestId }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, email: 'clienta@example.invalid' });
  assert.deepEqual(calls, [
    'GET /auth/v1/user',
    'POST /rest/v1/rpc/dietforge_privacy_delete_account',
    'POST /storage/v1/object/list/training-videos',
    'DELETE /storage/v1/object/training-videos',
    'POST /storage/v1/object/list/checkin-photos',
    'POST /storage/v1/object/list/recipe-photos',
    'DELETE /auth/v1/admin/users/user-id',
  ]);
});
