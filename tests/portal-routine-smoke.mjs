import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

// La rutina asignada debe verse en el portal del cliente. Supabase va interceptado:
// no se lee ni se escribe nada real. Ejecutar después de `npm run build`.
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3163';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'client@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const weeks = count => Array.from({ length: count }, (_, index) => ({ week: index + 1, sets: 3, reps_min: 8, reps_max: 12, rir_start: 2, rir_end: 1 }));
const day = number => ({ id: `d${number}`, day_number: number, name: number === 1 ? 'Push' : 'Pull', notes: '', exercises: [{ id: `e${number}`, name: number === 1 ? 'Press banca' : 'Remo con barra', muscle_group: 'Pectoral', prescriptions: weeks(4) }] });
const base = { id: 1, client_id: 1, name: 'Mesociclo asignado', objective: 'hypertrophy', start_date: '2026-11-01', duration_weeks: 4, mesocycle_number: 1, rotation_number: 1, priorities: [], split: 'Push · Pull', notes: '', status: 'active', created_at: date, updated_at: date };
const client = { id: 1, name: 'Cliente de prueba', email: 'client@example.invalid', created_at: date, updated_at: date };
let programs = [{ ...base, days: [day(1), day(2)], week_days: { '1': [day(1), day(2)], '2': [day(2)], '3': [day(1)], '4': [day(1)] }, review: { session_fatigue: [0, 0, 0, 0] } }];
const browserPath = process.env.DIETFORGE_BROWSER_EXECUTABLE ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3163'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.resume(); server.stderr.resume();
let browser;

try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await pause(100); }
  browser = await puppeteer.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    const reply = body => request.respond({ status: 200, headers, body: JSON.stringify(body) });
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      if (url.pathname === '/auth/v1/user') return reply(user);
      if (url.pathname === '/auth/v1/token') return reply(session);
      if (url.pathname.endsWith('/dietforge_portal_memberships')) return reply([{ owner_id: owner, client_id: 1, name: client.name, email: client.email, enabled: true }]);
      if (url.pathname.endsWith('/dietforge_diet_notice_read')) return reply({ revision: null, pending: false });
      if (url.pathname.endsWith('/dietforge_privacy_read_consent')) return reply(null);
      if (url.pathname.endsWith('/dietforge_portal_read')) return reply({ client, trainingPrograms: structuredClone(programs), measurements: [], weekPlans: [], activity: [], mealPlans: [], mealPlanItems: [], foods: [] });
      errors.push('endpoint inesperado ' + url.pathname);
      return request.abort();
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push('externo ' + url.origin);
    return request.abort();
  });
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  const openRoutine = async () => {
    await page.goto(origin + '/portal', { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForSelector('.portal-tabs', { timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll('.portal-tabs button')].find(button => button.textContent.includes('Rutina')).click());
    await page.waitForSelector('.portal-mesocycle', { timeout: 15000 });
  };

  // 1) Rutina activa: nombre, día y ejercicio visibles.
  await openRoutine();
  const visible = await page.evaluate(() => {
    const root = document.querySelector('.portal-mesocycle');
    const selectedWeek = root.querySelector('.portal-week-tabs [aria-current="page"]')?.textContent ?? '';
    return { text: root.innerText, selectedWeek, days: root.querySelectorAll('.portal-training-day').length, exercises: root.querySelectorAll('.portal-training-exercise').length };
  });
  assert.match(visible.text, /Mesociclo asignado/, 'el nombre de la rutina asignada aparece');
  assert.match(visible.text, /Push/, 'los días programados aparecen');
  assert.match(visible.text, /Press banca/, 'los ejercicios aparecen');
  assert.equal(visible.days, 2, 'se pintan los dos días de la semana 1');
  assert.equal(visible.exercises, 2, 'se pintan los ejercicios');
  assert.match(visible.selectedWeek, /Semana 1/, 'abre en la semana 1 cuando tiene contenido');
  assert.doesNotMatch(visible.text, /no ha publicado|aún no tiene días/i, 'no muestra un vacío cuando sí hay rutina');

  // 2) Rutina que empieza en la semana 2: no debe mostrar una semana vacía.
  programs = [{ ...base, days: [], week_days: { '2': [day(2)], '3': [day(1)] }, review: { session_fatigue: [0, 0, 0, 0] } }];
  await openRoutine();
  const fallback = await page.evaluate(() => {
    const root = document.querySelector('.portal-mesocycle');
    return { selectedWeek: root.querySelector('.portal-week-tabs [aria-current="page"]')?.textContent ?? '', text: root.innerText, days: root.querySelectorAll('.portal-training-day').length };
  });
  assert.match(fallback.selectedWeek, /Semana 2/, 'abre en la primera semana con contenido');
  assert.equal(fallback.days, 1, 'pinta el día de esa semana');
  assert.doesNotMatch(fallback.text, /no tiene días programados/i, 'no se queda en la semana vacía');

  assert.deepEqual(errors, [], 'sin errores de página ni endpoints inesperados');
  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'capturas/portal-rutina-verificada.png', fullPage: true });
  console.log('PASS rutina del portal: activa visible con días y ejercicios; abre en la primera semana con contenido');
} finally { await browser?.close(); server.kill('SIGTERM'); }
