import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

// Verificación local de la bandeja de check-ins: navegador real, RPC interceptadas
// y cero escrituras contra Supabase. Ejecutar después de `npm run build`.
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3159';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'coach@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const client = (id, name) => ({ id, name, email: 'client@example.invalid', prep_type: 'recreational', check_in_interval_days: 7, created_at: date, updated_at: date });
const checkinA = '11111111-1111-4111-8111-111111111111';
const checkinB = '22222222-2222-4222-8222-222222222222';

let snapshot = {
  database: {
    seed_version: 2,
    clients: [client(1, 'Cliente de prueba A')],
    measurements: [],
    competitions: [], checkins: [], photos: [], weekPlans: [],
    foods: [], mealPlans: [], mealPlanItems: [], trainingPrograms: [], exercises: [], nextId: {},
  }, templates: [], preferences: {},
};
let revision = 1;
let saves = 0;
const activity = [
  { id: checkinA, kind: 'checkin', data: { date: '2026-11-05', weight: 73.8, notes: 'Cansancio el viernes, dormí poco.', measurements: { waist: 84.2, chest: 101 }, photos: [] } },
  { id: checkinB, kind: 'checkin', data: { date: '2026-11-12', weight: 72.5, notes: 'Buena semana. Hambre por la noche el miércoles.', measurements: { waist: 83.5, chest: 100.8 }, adherence: { meals: 90, supplements: 100, training: 80, cardio: 70, energy: 4, sleep: 3, hunger: 2, libido: 4, digestion: 3 }, photos: [] } },
];
let browser;
const waitFor = async (predicate) => {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await pause(50); }
  throw new Error('Timed out waiting for the import to reach the cloud queue.');
};
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3159'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (data) => { serverOutput += data; });
server.stderr.on('data', (data) => { serverOutput += data; });

try {
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Test server failed to start: ${serverOutput}`);
    try { if ((await fetch(origin)).ok) { started = true; break; } } catch { /* starting */ }
    await pause(100);
  }
  assert.equal(started, true, 'production server started');

  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIETFORGE_BROWSER_EXECUTABLE ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' });
  const page = await browser.newPage();
  globalThis.__page = page;
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|Minified React|server rendered/i.test(message.text())) errors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      let body;
      if (url.pathname.endsWith('/dietforge_load')) body = { revision, snapshot };
      else if (url.pathname.endsWith('/dietforge_save')) {
        const input = JSON.parse(request.postData());
        assert.equal(input.p_expected_revision, revision, 'optimistic revision');
        snapshot = input.p_snapshot;
        body = ++revision;
        saves++;
      } else if (url.pathname.endsWith('/dietforge_my_access')) body = { active: true, status: 'active', isAdmin: false, email: user.email, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      else if (url.pathname.endsWith('/dietforge_is_admin')) body = false;
      else if (url.pathname.endsWith('/dietforge_notifications_read')) body = { unread: 0, items: [] };
      else if (url.pathname.endsWith('/dietforge_portal_memberships')) body = [{ owner_id: owner, client_id: 1, name: 'Cliente de prueba A', email: 'client@example.invalid', enabled: true }];
      else if (url.pathname.endsWith('/dietforge_portal_read')) body = { client: snapshot.database.clients[0], trainingPrograms: [], mealPlans: [], mealPlanItems: [], foods: [], measurements: [], weekPlans: [], activity };
      else if (url.pathname === '/auth/v1/user') body = user;
      else if (url.pathname === '/auth/v1/logout') return request.respond({ status: 204, headers });
      else { errors.push(`Unexpected mocked endpoint: ${url.pathname}`); return request.abort(); }
      return request.respond({ status: 200, headers, body: JSON.stringify(body) });
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push(`Unexpected external request: ${url.origin}`);
    return request.abort();
  });

  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  await page.goto(`${origin}/clients/1/care?tab=progress`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.checkin-inbox');
  await page.waitForFunction(() => document.querySelector('.checkin-inbox')?.textContent?.includes('2 por importar'));

  const heading = await page.$eval('.checkin-inbox-head', (node) => node.textContent);
  assert.match(heading, /Check-ins de Cliente de prueba A/);
  const rows = await page.$$eval('.checkin-inbox-row', (nodes) => nodes.map((node) => ({
    date: node.querySelector('time')?.textContent,
    weight: node.querySelector('strong')?.textContent,
    notes: node.querySelector('.checkin-inbox-notes')?.textContent,
  })));
  assert.deepEqual(rows.map((row) => row.weight), ['72.5 kg', '73.8 kg'], 'newest check-in first');
  assert.match(rows[0].notes ?? '', /Buena semana/);
  assert.match(rows[0].date ?? '', /12 nov 2026/);
  await page.screenshot({ path: join(tmpdir(), 'dietforge-checkin-inbox-before.png'), fullPage: true });
  console.log('screenshot:', join(tmpdir(), 'dietforge-checkin-inbox-before.png'));

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.checkin-inbox-row button')].find((node) => node.textContent?.includes('Importar al check-in del cliente'));
    button.click();
  });
  await page.waitForFunction(() => document.querySelector('.checkin-inbox-confirm')?.textContent?.includes('Se copiarán peso'));
  assert.equal(snapshot.database.checkins.length, 0, 'nothing saved before confirming');

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.checkin-inbox-confirm button')].find((node) => node.textContent === 'Confirmar importación');
    button.click();
  });
  await page.waitForFunction(() => document.querySelector('.checkin-inbox [role=status]')?.textContent?.includes('importado al expediente del cliente'));
  await page.waitForFunction(() => document.querySelector('.checkin-inbox')?.textContent?.includes('1 por importar'));
  await waitFor(() => saves === 1 && snapshot.database.checkins.length === 1 && snapshot.database.checkins[0].portal_activity_id === checkinB);
  assert.equal(snapshot.database.checkins[0].weight, 72.5);
  assert.equal(saves, 1, 'import saved through the existing cloud queue');
  assert.match(await page.$eval('.checkin-inbox', (node) => node.textContent), /Ya está en el check-in del cliente/);

  // Import the older check-in and confirm the local record is not duplicated.
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.checkin-inbox-row button')].find((node) => node.textContent?.includes('Importar al check-in del cliente'));
    button.click();
  });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.checkin-inbox-confirm button')].find((node) => node.textContent === 'Confirmar importación');
    button.click();
  });
  await page.waitForFunction(() => document.querySelector('.checkin-inbox')?.textContent?.includes('0 por importar'));
  await waitFor(() => saves === 2 && snapshot.database.checkins.length === 2);

  // Retry against the same record must not create a third one.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.checkin-inbox');
  await page.waitForFunction(() => document.querySelector('.checkin-inbox')?.textContent?.includes('0 por importar'));
  const badges = await page.$$eval('.checkin-inbox-badge', (nodes) => nodes.length);
  assert.equal(badges, 2, 'imported state survives a reload');
  assert.equal(snapshot.database.checkins.length, 2);
  await page.screenshot({ path: join(tmpdir(), 'dietforge-checkin-inbox-after.png'), fullPage: true });
  console.log('screenshot:', join(tmpdir(), 'dietforge-checkin-inbox-after.png'));

  // The imported record is the client's own check-in inside the coaching file.
  await page.goto(`${origin}/clients/1`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const cards = [...document.querySelectorAll('main h3')].filter((node) => node.textContent?.includes('Check-ins'));
    return main?.textContent?.includes('72.5 kg') && cards.length > 0;
  });
  assert.equal(await page.$$eval('[data-checkin-inbox-id]', (nodes) => nodes.length), 0, 'the inbox belongs to Progreso');

  assert.deepEqual(errors, [], 'no runtime errors, hydration failures or live external requests');
  console.log(`PASS checkin inbox: 2 rows, confirmation, ${saves} local saves in memory, no duplicates, zero live writes.`);
} catch (error) {
  if (globalThis.__page) console.error('BODY:', (await globalThis.__page.$eval('body', (node) => node.innerText)).slice(0, 2500));
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
