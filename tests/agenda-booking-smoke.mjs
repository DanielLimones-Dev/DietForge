import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3159';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const iso = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'coach@example.invalid', created_at: iso, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const today = new Date();
const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const client = { id: 1, name: 'Cliente de prueba A', email: 'client@example.invalid', prep_type: 'recreational', check_in_interval_days: 7, created_at: iso, updated_at: iso };
const snapshot = { database: { seed_version: 2, clients: [client], measurements: [], competitions: [], checkins: [], photos: [], weekPlans: [], foods: [], mealPlans: [], mealPlanItems: [], nextId: {} }, templates: [], preferences: {} };
let activity = [];
const saves = [];
let browser;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3159'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', data => { output += data; });
server.stderr.on('data', data => { output += data; });

function portalData() {
  return { client: { id: 1, name: client.name }, trainingPrograms: [], mealPlans: [], mealPlanItems: [], foods: [], measurements: [], weekPlans: [], activity };
}

try {
  let started = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`test server failed: ${output}`);
    try { if ((await fetch(origin)).ok) { started = true; break; } } catch { /* starting */ }
    await pause(100);
  }
  assert.equal(started, true, 'production server started');
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      let payload;
      if (url.pathname.endsWith('/dietforge_load')) payload = { revision: 1, snapshot };
      else if (url.pathname.endsWith('/dietforge_my_access')) payload = { active: true, status: 'active', isAdmin: false, email: user.email, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      else if (url.pathname.endsWith('/dietforge_is_admin')) payload = false;
      else if (url.pathname.endsWith('/dietforge_notifications_read')) payload = { unread: 0, items: [] };
      else if (url.pathname.endsWith('/dietforge_diet_notice_read')) payload = { revision: null, pending: false };
      else if (url.pathname.endsWith('/dietforge_privacy_read_consent')) payload = { consent: null };
      else if (url.pathname.endsWith('/dietforge_portal_memberships')) payload = [{ owner_id: owner, client_id: 1, name: client.name, email: client.email, enabled: true }];
      else if (url.pathname.endsWith('/dietforge_portal_read')) payload = portalData();
      else if (url.pathname.endsWith('/dietforge_activity_save')) {
        saves.push({ id: body.i, kind: body.k, data: body.d });
        activity = [...activity.filter(item => item.id !== body.i), { id: body.i, kind: body.k, data: body.d, updated_at: new Date().toISOString() }];
        payload = null;
      } else if (url.pathname === '/auth/v1/user') payload = user;
      else { errors.push('unexpected endpoint ' + url.pathname); return request.abort(); }
      return request.respond({ status: 200, headers, body: JSON.stringify(payload) });
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push('unexpected external request ' + url.origin);
    return request.abort();
  });
  await page.evaluateOnNewDocument(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });

  // Client books from the portal in three fields and one button.
  await page.goto(origin + '/portal', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.care-tabs'));
  await page.evaluate(() => [...document.querySelectorAll('.care-tabs button')].find(button => button.textContent === 'Agenda').click());
  await page.waitForSelector('.agenda-booking-form');
  await page.$eval('.agenda-booking-form input[type="time"]', node => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(node, '10:15');
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.type('.agenda-booking-form input[placeholder]', 'Revisión de medidas');
  await page.evaluate(() => [...document.querySelectorAll('.agenda-booking-form button')].find(button => button.textContent === 'Solicitar cita').click());
  await page.waitForFunction(() => document.querySelector('.agenda-feedback')?.textContent.includes('Cita solicitada'));
  assert.equal(saves.length, 1, 'one booking write');
  assert.equal(saves[0].kind, 'appointment');
  assert.deepEqual(saves[0].data, { date: todayValue, time: '10:15', note: 'Revisión de medidas', status: 'requested' });
  assert.ok(!('completed' in saves[0].data), 'appointments do not fake a completion flag');
  await page.waitForFunction(() => document.querySelector('.agenda-event.appointment')?.textContent.includes('10:15'));
  const booked = await page.$eval('.agenda-event.appointment', node => node.textContent);
  assert.match(booked, /Revisión de medidas/);
  assert.match(booked, /Solicitada/);
  if (process.env.AGENDA_SHOTS) await page.screenshot({ path: `${process.env.AGENDA_SHOTS}-portal.png`, fullPage: true });

  // The client can cancel the appointment they just requested.
  await page.evaluate(() => [...document.querySelectorAll('.agenda-event.appointment button')].find(button => button.textContent === 'Cancelar').click());
  await page.waitForFunction(() => document.querySelector('.agenda-event.appointment')?.textContent.includes('Cancelada'));
  assert.equal(saves.length, 2, 'cancel reuses the same activity');
  assert.equal(saves[1].id, saves[0].id);
  assert.equal(saves[1].data.status, 'cancelled');
  assert.equal(saves[1].data.date, todayValue);

  // A second request then becomes visible to the coach in /agenda.
  saves.length = 0;
  await page.evaluate(() => [...document.querySelectorAll('.agenda-booking-form button')].find(button => button.textContent === 'Solicitar cita').click());
  await page.waitForFunction(() => document.querySelector('.agenda-feedback')?.textContent.includes('Cita solicitada'));
  await page.goto(origin + '/agenda', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.agenda-event.appointment')?.textContent.includes('10:15'), { timeout: 20000 });
  const coachRow = await page.$eval('.agenda-event.appointment', node => node.textContent);
  assert.match(coachRow, /Cita · Cliente de prueba A/);
  assert.match(coachRow, /Solicitada/);
  assert.match(coachRow, /Confirmar/);
  if (process.env.AGENDA_SHOTS) await page.screenshot({ path: `${process.env.AGENDA_SHOTS}-coach.png`, fullPage: true });
  await page.evaluate(() => [...document.querySelectorAll('.agenda-event.appointment button')].find(button => button.textContent === 'Confirmar').click());
  await page.waitForFunction(() => document.querySelector('.agenda-event.appointment')?.textContent.includes('Confirmada'));
  const confirm = saves.find(save => save.data.status === 'confirmed');
  assert.ok(confirm, 'coach confirmation reaches the RPC');
  assert.equal(confirm.id, saves[0].id, 'confirmation updates the same appointment');
  assert.deepEqual(errors, []);
  console.log('PASS agenda booking: portal request → visible in coach agenda → coach confirms; no live writes.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
