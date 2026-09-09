import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3157';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'coach@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const client = (id, name) => ({ id, name, email: 'client@example.invalid', prep_type: 'recreational', check_in_interval_days: 7, created_at: date, updated_at: date });
let snapshot = {
  database: {
    seed_version: 2,
    clients: [client(1, 'Cliente de prueba A'), client(2, 'Cliente de prueba B')],
    measurements: [{ id: 1, client_id: 1, date, weight: 75, height: 175, age: 30, sex: 'male', activity_level: 'moderate', goal: 'maintain', tmb: 1700, tdee: 2300, protein: 150, carbs: 250, fat: 70, fiber: 30, antioxidants: 0 }],
    competitions: [], checkins: [], photos: [], weekPlans: [],
    foods: [{ id: 1, name: 'Alimento de prueba', category: 'protein', protein: 20, carbs: 5, fat: 3, fiber: 1, antioxidants: 0, kcal: 127, serving_size: 100, serving_unit: 'g', source: 'manual' }],
    mealPlans: [{ id: 1, client_id: 1, measurement_id: 1, date, name: 'Plan de prueba', total_kcal: 2300, total_protein: 150, total_carbs: 250, total_fat: 70, total_fiber: 30, total_antioxidants: 0 }],
    mealPlanItems: [{ id: 1, meal_plan_id: 1, meal_time: 'breakfast', food_id: 1, quantity: 100, serving_unit: 'g' }], nextId: {},
  }, templates: [], preferences: {},
};
let revision = 1;
let saves = 0;
let loads = 0;
let browser;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3157'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });

try {
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Test server failed to start: ${serverOutput}`);
    try { if ((await fetch(origin)).ok) { started = true; break; } } catch { /* starting */ }
    await pause(100);
  }
  assert.equal(started, true, 'production server started');
  assert.equal((await fetch(`${origin}/api/nutrition/usda?q=pollo`)).status, 401);
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|Minified React|server rendered/i.test(message.text())) errors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      let body;
      if (url.pathname.endsWith('/dietforge_load')) { loads++; body = { revision, snapshot }; }
      else if (url.pathname.endsWith('/dietforge_save')) {
        const input = JSON.parse(request.postData());
        assert.equal(input.p_expected_revision, revision, 'optimistic revision');
        snapshot = input.p_snapshot; body = ++revision; saves++;
      } else if (url.pathname.endsWith('/dietforge_my_access')) body = { active: true, status: 'active', isAdmin: false, email: user.email, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      else if (url.pathname.includes('check-subscription')) body = { active: true, status: 'active', expiresAt: new Date(Date.now() + 86400000).toISOString() };
      else if (url.pathname === '/auth/v1/user') body = user;
      else if (url.pathname === '/auth/v1/logout') return request.respond({ status: 204, headers });
      else { errors.push(`Unexpected mocked endpoint: ${url.pathname}`); return request.abort(); }
      return request.respond({ status: 200, headers, body: JSON.stringify(body) });
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push(`Unexpected external request: ${url.origin}`);
    return request.abort();
  });
  await page.goto(`${origin}/clients/1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[aria-label="Correo"]');
  assert.equal(loads, 0, 'signed-out screens do not load private records');
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('main h2');
  assert.match(await page.$eval('main h2', node => node.textContent), /Cliente de prueba A/);

  const routes = [
    ['/', 'Panel de control nutricional'], ['/coach', 'Panel Coach'], ['/clients', 'Clientes'], ['/clients/new', 'Nuevo Cliente'],
    ['/clients/1', 'Cliente de prueba A'], ['/clients/1/edit', 'Editar Cliente'], ['/clients/1/plan/week', 'Plan Semanal'],
    ['/plans/1', 'Plan de prueba'], ['/foods', 'Alimentos'], ['/exercises', 'Base de ejercicios'], ['/calculator', 'Calculadora'], ['/reports', 'Reportes'],
  ];
  for (const [route, title] of routes) {
    await page.goto(origin + route, { waitUntil: 'networkidle0' });
    await page.waitForFunction(title => document.querySelector('main')?.textContent?.toLowerCase().includes(title.toLowerCase()), {}, title);
    console.log(`OK direct route ${route}`);
  }
  const loaded = loads;
  await page.goto(origin + '/exercises', { waitUntil: 'networkidle0' });
  await page.click('button.df-button');
  await page.type('[data-exercise-name]', 'Remo persistente de prueba');
  await page.select('[data-exercise-form] select', 'Espalda');
  await page.click('[data-exercise-form] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('main')?.textContent?.includes('Remo persistente de prueba'));
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Guardado en Supabase'));
  assert.equal(snapshot.database.exercises.length, 1, 'custom exercise persists through the cloud repository');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.match(await page.$eval('main', node => node.textContent), /Remo persistente de prueba/);
  await page.click('nav a[href="/clients"]');
  await page.waitForFunction(() => location.pathname === '/clients' && !!document.querySelector('main button'));
  assert.equal(loads, loaded, 'client-side navigation retains the initialized workspace');
  await page.click('a[href="/clients/new"]');
  await page.waitForSelector('main form input');
  await page.type('main form input', 'Cliente creado en prueba');
  await page.click('main form button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/clients/3' && location.search === '?openCalc=1');
  await page.waitForFunction(() => document.querySelector('main')?.textContent?.includes('Cliente creado en prueba'));
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Guardado en Supabase'));
  assert.equal(snapshot.database.clients.length, 3);
  assert.ok(saves >= 1, 'creation saved through the existing cloud repository');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.match(await page.$eval('main h2', node => node.textContent), /Cliente creado en prueba/);

  await page.click('nav button:last-of-type');
  await page.waitForSelector('input[aria-label="Correo"]');
  assert.equal(await page.$('main'), null, 'logout unmounts private screens');
  assert.deepEqual(errors, [], 'no runtime errors, hydration failures or live external requests');
  console.log(`PASS: ${routes.length} routes, private access, exercise/client save+reload and logout; ${saves} saves in memory, zero live writes.`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
