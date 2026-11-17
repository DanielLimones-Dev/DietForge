import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

// End-to-end check of the client portal without touching production: Supabase
// requests are intercepted and served from memory. Run after `npm run build`.
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3161';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'client@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const food = (id, name, kcal) => ({ id, name, category: 'protein', protein: 20, carbs: 5, fat: 3, fiber: 1, antioxidants: 0, kcal, serving_size: 100, serving_unit: 'g', source: 'manual' });
const client = { id: 1, name: 'Cliente de prueba A', email: 'client@example.invalid', prep_type: 'recreational', check_in_interval_days: 7, created_at: date, updated_at: date };
const plan = { id: 1, client_id: 1, measurement_id: 0, date, name: 'Plan de prueba', total_kcal: 2300, total_protein: 150, total_carbs: 250, total_fat: 70, total_fiber: 30, total_antioxidants: 0 };
const menuEntry = (id, foodId, name) => ({ id, kind: 'food', ingredient: { id: `${id.slice(0, 24)}0031`, food: food(foodId, name, 100), quantity: 100, unit: 'g' } });
const assignedMenu = (items) => ({
  id: 1, client_id: 1, name: 'Menú asignado', assigned: true, created_at: date, updated_at: date,
  meals: [{ id: '00000000-0000-4000-8000-000000000011', name: 'Desayuno', items }],
});
let portalData = {
  client, trainingPrograms: [], measurements: [], weekPlans: [], activity: [],
  mealPlans: [plan], mealPlanItems: [{ id: 1, meal_plan_id: 1, meal_time: 'meal1', food_id: 1, quantity: 100, serving_unit: 'g' }],
  foods: [food(1, 'Alimento inicial', 127)],
};
let menuData = { menus: [assignedMenu([menuEntry('00000000-0000-4000-8000-000000000021', 1, 'Alimento inicial menú')])], days: [] };
let portalReads = 0;
let failNext = 0;
let menuReads = 0;
let browser;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3161'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.resume(); server.stderr.resume();

try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await pause(100); }
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIETFORGE_BROWSER_EXECUTABLE ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      let body;
      if (url.pathname.endsWith('/dietforge_portal_memberships')) body = [{ owner_id: owner, client_id: 1, name: client.name, email: client.email, enabled: true }];
      else if (url.pathname.endsWith('/dietforge_portal_read')) {
        portalReads++;
        // Regresión: un error 400 (no reintentable) bloqueaba el sondeo para siempre.
        if (failNext > 0) { failNext--; return request.respond({ status: 400, headers, body: JSON.stringify({ code: 'PGRST202', message: 'fixture' }) }); }
        body = structuredClone(portalData);
      }
      else if (url.pathname.endsWith('/dietforge_diet_notice_read')) body = { revision: null, pending: false };
      else if (url.pathname.endsWith('/dietforge_menus_read')) { menuReads++; body = structuredClone(menuData); }
      else if (url.pathname.endsWith('/dietforge_privacy_read_consent')) body = null;
      else if (url.pathname === '/auth/v1/user') body = user;
      else if (url.pathname === '/auth/v1/token') body = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
      else { errors.push('Unexpected mocked endpoint: ' + url.pathname); return request.abort(); }
      return request.respond({ status: 200, headers, body: JSON.stringify(body) });
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push('Unexpected external request: ' + url.origin); return request.abort();
  });
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  await page.goto(origin + '/portal', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.textContent.includes('Sincronización automática activa'), { timeout: 15000 });
  // The client portal opens on the diet plan; no tab click is required.
  await page.waitForFunction(() => document.body.textContent.includes('Alimento inicial'));

  // A coach save reaches dietforge_save; the next portal poll must show it without reloading.
  portalData = {
    ...portalData,
    mealPlanItems: [...portalData.mealPlanItems, { id: 2, meal_plan_id: 1, meal_time: 'meal1', food_id: 2, quantity: 150, serving_unit: 'g' }],
    foods: [...portalData.foods, food(2, 'Alimento agregado', 200)],
  };
  await page.waitForFunction(() => document.body.textContent.includes('Alimento agregado'), { timeout: 12000 });
  console.log(`PASS el plan del portal se actualizó solo tras ${portalReads} lecturas`);

  // Mis menús used to crash on mount because both day and selected were undefined.
  await page.evaluate(() => [...document.querySelectorAll('button')].find(node => node.textContent === 'Mis menús').click());
  await page.waitForFunction(() => document.body.textContent.includes('Alimento inicial menú'), { timeout: 8000 });
  menuData = { menus: [assignedMenu([menuEntry('00000000-0000-4000-8000-000000000021', 1, 'Alimento inicial menú'), menuEntry('00000000-0000-4000-8000-000000000022', 2, 'Alimento agregado menú')])], days: [] };
  await page.waitForFunction(() => document.body.textContent.includes('Alimento agregado menú'), { timeout: 12000 });
  console.log(`PASS la lista de alimentos del portal se actualizó sola tras ${menuReads} lecturas`);

  // Un fallo puntual del servidor no puede dejar el plan congelado hasta recargar.
  await page.evaluate(() => [...document.querySelectorAll('button')].find(node => node.textContent === 'Plan de alimentación').click());
  await page.waitForFunction(() => document.body.textContent.includes('Alimento agregado'), { timeout: 8000 });
  failNext = 1;
  portalData = {
    ...portalData,
    mealPlanItems: [...portalData.mealPlanItems, { id: 3, meal_plan_id: 1, meal_time: 'meal1', food_id: 3, quantity: 80, serving_unit: 'g' }],
    foods: [...portalData.foods, food(3, 'Alimento tras fallo', 90)],
  };
  await page.waitForFunction(() => document.body.textContent.includes('Alimento tras fallo'), { timeout: 20000 });
  console.log('PASS el plan se recuperó de un error no reintentable sin recargar');

  assert.deepEqual(errors, []);
  console.log('PASS portal cliente: plan y alimentos se actualizan automáticamente; cero escrituras reales');
} finally { await browser?.close(); server.kill('SIGTERM'); }
