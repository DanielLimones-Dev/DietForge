import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

// Verifica en navegador real que la capa moderna del portal del cliente hace algo,
// no solo que compila: View Transitions, container queries, ::details-content,
// :user-invalid, text-wrap y respeto a prefers-reduced-motion.
// Supabase va interceptado: no se lee ni se escribe nada real.
// Ejecutar después de `npm run build`: node tests/portal-modern-ui-smoke.mjs
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3164';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000002';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'client@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const weeks = count => Array.from({ length: count }, (_, index) => ({ week: index + 1, sets: 3, reps_min: 8, reps_max: 12, rir_start: 2, rir_end: 1 }));
const day = number => ({ id: `d${number}`, day_number: number, name: number === 1 ? 'Push' : 'Pull', notes: '', exercises: [{ id: `e${number}`, name: number === 1 ? 'Press banca' : 'Remo con barra', muscle_group: 'Pectoral', prescriptions: weeks(4) }] });
const program = { id: 1, client_id: 1, name: 'Mesociclo asignado', objective: 'hypertrophy', start_date: '2026-11-01', duration_weeks: 4, mesocycle_number: 1, rotation_number: 1, priorities: [], split: 'Push · Pull', notes: '', status: 'active', created_at: date, updated_at: date, days: [day(1), day(2)], week_days: { '1': [day(1), day(2)], '2': [day(1)], '3': [day(2)], '4': [day(1)] }, review: { session_fatigue: [0, 0, 0, 0] } };
const portal = {
  client: { id: 1, name: 'Cliente de prueba', email: 'client@example.invalid', created_at: date, updated_at: date },
  trainingPrograms: [program],
  measurements: [{ id: 1, client_id: 1, date: '2026-11-10', weight: 78.4, body_fat: 18.2, created_at: date }],
  weekPlans: [],
  activity: [],
  mealPlans: [{ id: 1, client_id: 1, measurement_id: 0, date: '2026-11-16', name: 'Plan de prueba', total_kcal: 2300, total_protein: 150, total_carbs: 250, total_fat: 70, total_fiber: 30, total_antioxidants: 0 }],
  mealPlanItems: [{ id: 1, meal_plan_id: 1, meal_time: 'meal1', food_id: 1, quantity: 100, serving_unit: 'g' }],
  foods: [{ id: 1, name: 'Avena', category: 'carb', protein: 13, carbs: 60, fat: 7, fiber: 10, antioxidants: 0, kcal: 380, serving_size: 100, serving_unit: 'g', source: 'manual' }],
};
const browserPath = process.env.DIETFORGE_BROWSER_EXECUTABLE ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3164'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.resume(); server.stderr.resume();
let browser;

const openTab = (page, label) => page.evaluate(name => [...document.querySelectorAll('.portal-tabs button')].find(button => button.textContent.includes(name)).click(), label);

try {
  for (let i = 0; i < 200; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await pause(100); }
  browser = await puppeteer.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
    const reply = body => request.respond({ status: 200, headers, body: JSON.stringify(body) });
    if (url.origin === remoteOrigin) {
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      if (url.pathname === '/auth/v1/user') return reply(user);
      if (url.pathname === '/auth/v1/token') return reply(session);
      if (url.pathname.endsWith('/dietforge_portal_memberships')) return reply([{ owner_id: owner, client_id: 1, name: portal.client.name, email: portal.client.email, enabled: true }]);
      if (url.pathname.endsWith('/dietforge_portal_read')) return reply(structuredClone(portal));
      if (url.pathname.endsWith('/dietforge_diet_notice_read')) return reply({ revision: null, pending: false });
      if (url.pathname.endsWith('/dietforge_privacy_read_consent')) return reply(null);
      errors.push('endpoint inesperado ' + url.pathname);
      return request.abort();
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    errors.push('externo ' + url.origin);
    return request.abort();
  });
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin + '/portal', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('.portal-tabs', { timeout: 30000 });

  // 0) La pestaña inicial está marcada y cada panel conoce su pestaña.
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.portal-tabs button')].map(button => ({ id: button.id, current: button.getAttribute('aria-current'), selected: button.classList.contains('selected'), label: button.textContent.trim() })));
  assert.equal(tabs.length, 4, 'el portal mantiene cuatro destinos');
  assert.deepEqual(tabs.map(tab => tab.id), ['portal-tab-diet', 'portal-tab-training', 'portal-tab-progress', 'portal-tab-agenda'], 'cada pestaña tiene un id estable');
  assert.equal(tabs.filter(tab => tab.current === 'page').length, 1, 'solo una pestaña es actual');
  assert.equal(tabs.find(tab => tab.current === 'page').selected, true, 'el estado visual y el accesible coinciden');

  // 1) View Transitions: cambiar de pestaña lanza una transición y enfoca el panel nuevo.
  await page.evaluate(() => {
    window.__transitions = 0;
    const original = document.startViewTransition?.bind(document);
    if (original) document.startViewTransition = callback => { window.__transitions++; return original(callback); };
  });
  await openTab(page, 'Progreso');
  await pause(700);
  const progressState = await page.evaluate(() => ({ transitions: window.__transitions, visible: [...document.querySelectorAll('.portal-panel')].filter(panel => !panel.hidden).map(panel => panel.id) }));
  assert.ok(progressState.transitions > 0, 'la navegación entre destinos usa View Transitions');
  assert.deepEqual(progressState.visible, ['portal-panel-progress'], 'solo el panel elegido queda visible');
  await openTab(page, 'Dieta');
  await pause(700);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.portal-panel')].filter(panel => !panel.hidden).map(panel => panel.id)), ['portal-panel-diet'], 'solo el panel de dieta queda visible');

  // 2) ::details-content: el plan se abre y se cierra, y su contenido es animable.
  const plan = await page.evaluate(() => {
    const details = document.querySelector('.portal-plan');
    const style = getComputedStyle(details, '::details-content');
    const startedOpen = details.open;
    details.querySelector('summary').click();
    const afterClose = details.open;
    details.querySelector('summary').click();
    return { startedOpen, afterClose, afterOpen: details.open, transition: style.transitionProperty, interpolate: style.getPropertyValue('interpolate-size'), overflow: style.overflow };
  });
  assert.equal(plan.startedOpen, true, 'el plan vigente abre desplegado');
  assert.equal(plan.afterClose, false, 'el resumen pliega el plan');
  assert.equal(plan.afterOpen, true, 'el resumen lo vuelve a desplegar');
  assert.match(plan.transition, /block-size/, 'la altura del contenido se anima');
  assert.equal(plan.interpolate, 'allow-keywords', 'interpolate-size permite animar hasta la altura intrínseca');
  assert.equal(plan.overflow, 'clip', 'el contenido no desborda durante la animación');

  // 3) Container queries: la tarjeta decide su reflujo por su propio ancho.
  const wide = await page.evaluate(() => ({
    container: getComputedStyle(document.querySelector('.portal-hero')).containerType,
    columns: getComputedStyle(document.querySelector('.portal-facts')).gridTemplateColumns.split(' ').length,
  }));
  assert.equal(wide.container, 'inline-size', 'la portada declara contenedor de ancho');
  assert.equal(wide.columns, 3, 'en escritorio los datos van en tres columnas');
  await page.setViewport({ width: 360, height: 780 });
  await pause(500);
  const narrow = await page.evaluate(() => getComputedStyle(document.querySelector('.portal-facts')).gridTemplateColumns.split(' ').length);
  assert.equal(narrow, 1, 'a 360 px la misma tarjeta se apila sin media query de página');
  await page.setViewport({ width: 1440, height: 1000 });
  await pause(300);

  // 4) :user-invalid: el error aparece tras interactuar y gana al estilo clínico con !important.
  await openTab(page, 'Progreso');
  await pause(600);
  const selector = '.portal-checkin-required input[type=number]';
  const pristine = await page.evaluate(sel => getComputedStyle(document.querySelector(sel)).borderColor, selector);
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type('5');
  // Chromium consolida :user-invalid al salir del campo, igual que lo ve el cliente.
  await page.evaluate(() => document.querySelector('.portal-notes textarea')?.focus());
  await pause(250);
  const invalid = await page.evaluate(sel => {
    const input = document.querySelector(sel);
    const style = getComputedStyle(input);
    return { matches: input.matches(':user-invalid'), value: input.value, border: style.borderColor, shadow: style.boxShadow };
  }, selector);
  assert.equal(invalid.value, '5', 'el valor inválido se conserva para que el usuario lo corrija');
  assert.equal(invalid.matches, true, 'el navegador marca el campo como :user-invalid tras escribir');
  assert.notEqual(invalid.border, pristine, 'el borde cambia con el estado inválido');
  assert.notEqual(invalid.shadow, 'none', 'el estado inválido se refuerza con halo, no solo con color');
  await page.evaluate(sel => { const input = document.querySelector(sel); input.value = ''; input.blur(); }, selector);

  // 5) Tipografía moderna.
  const typography = await page.evaluate(() => {
    const heading = document.querySelector('.portal-section-head h2');
    const paragraph = document.querySelector('.portal-section-head p');
    return { heading: heading && getComputedStyle(heading).textWrap, paragraph: paragraph && getComputedStyle(paragraph).textWrap };
  });
  assert.equal(typography.heading, 'balance', 'los títulos reparten líneas sin huérfanas');
  assert.equal(typography.paragraph, 'pretty', 'los párrafos evitan palabras sueltas');

  // 6) Movimiento reducido: sin View Transitions ni desplazamientos.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => { window.__transitions = 0; });
  await openTab(page, 'Agenda');
  await pause(600);
  const reduced = await page.evaluate(() => ({
    transitions: window.__transitions,
    motion: getComputedStyle(document.querySelector('.portal-panel')).transitionProperty,
  }));
  assert.equal(reduced.transitions, 0, 'con prefers-reduced-motion no se lanza ninguna transición');
  assert.deepEqual(errors, [], 'sin errores de página ni endpoints inesperados');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.setViewport({ width: 1440, height: 1000 });
  await openTab(page, 'Dieta');
  await pause(600);
  await page.screenshot({ path: 'capturas/portal-moderno-verificado.png', fullPage: true });
  console.log('PASS portal moderno: View Transitions, container queries, ::details-content, :user-invalid, text-wrap y movimiento reducido');
} finally { await browser?.close(); server.kill('SIGTERM'); }
