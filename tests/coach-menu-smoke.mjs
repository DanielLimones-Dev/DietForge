import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

// El menú del coach se verifica en el navegador real con Supabase interceptado.
// Ejecutar después de `npm run build`: node tests/coach-menu-smoke.mjs
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3162';
const remoteOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const storageKey = `sb-${new URL(remoteOrigin).hostname.split('.')[0]}-auth-token`;
const date = new Date().toISOString();
const owner = '00000000-0000-4000-8000-000000000009';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'coach@example.invalid', created_at: date, app_metadata: {}, user_metadata: {} };
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
const session = { access_token: jwt, refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const calls = [];
const browserPath = process.env.DIETFORGE_BROWSER_EXECUTABLE ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3162'], {
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
      if (url.pathname.endsWith('/dietforge_my_access')) return reply({ active: true, status: 'active', expiresAt: '2027-12-31T00:00:00.000Z', isAdmin: true, email: 'coach@example.invalid' });
      if (url.pathname.endsWith('/dietforge_load')) return reply(null);
      if (url.pathname.endsWith('/dietforge_save')) { calls.push('save'); return reply(1); }
      if (url.pathname.endsWith('/dietforge_privacy_read_consent')) return reply(null);
      if (url.pathname.endsWith('/dietforge_notifications_read')) return reply([]);
      calls.push('inesperado ' + url.pathname);
      return request.abort();
    }
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    calls.push('externo ' + url.origin);
    return request.abort();
  });
  await page.evaluateOnNewDocument(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: storageKey, session });
  await page.goto(origin + '/agenda', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('.df-sidebar .df-nav-group-toggle', { timeout: 30000 });

  const snapshot = await page.evaluate(() => {
    const sidebar = document.querySelector('.df-sidebar');
    const direct = [...sidebar.querySelectorAll('nav > a')].map(node => ({ text: node.textContent.trim(), href: node.getAttribute('href') }));
    const groups = [...sidebar.querySelectorAll('.df-nav-group')].map(group => {
      const toggle = group.querySelector('.df-nav-group-toggle');
      const submenu = group.querySelector('.df-nav-submenu');
      return {
        label: toggle.querySelector('span').textContent.trim(),
        expanded: toggle.getAttribute('aria-expanded'),
        hidden: submenu.hidden,
        links: [...submenu.querySelectorAll('a')].map(link => link.textContent.trim()),
      };
    });
    const footer = [...sidebar.querySelectorAll('.df-sidebar-foot a')].map(link => ({ text: link.textContent.trim(), href: link.getAttribute('href') }));
    return { direct, groups, footer, flatSections: sidebar.querySelectorAll('.df-nav-section').length };
  });

  assert.deepEqual(snapshot.direct, [{ text: 'Dashboard', href: '/' }, { text: 'Clientes', href: '/clients' }], 'Dashboard y Clientes siguen siendo accesos directos');
  assert.deepEqual(snapshot.groups.map(group => group.label), ['Seguimiento', 'Planificación', 'Sistema'], 'los tres grupos plegables existen');
  assert.equal(snapshot.flatSections, 0, 'no quedan las secciones planas del rediseño');
  assert.deepEqual(snapshot.footer.filter(link => link.href === '/cuenta'), [{ text: 'Mi cuenta', href: '/cuenta' }], '/cuenta sigue alcanzable sin ocupar un grupo');
  assert.ok(snapshot.footer.some(link => link.href === '/privacidad'), 'el aviso de privacidad sigue en el pie');
  assert.deepEqual(snapshot.groups[0].links, ['Agenda', 'Reportes'], 'Seguimiento contiene Agenda y Reportes');
  assert.deepEqual(snapshot.groups[1].links, ['Rutinas', 'Alimentos', 'Ejercicios'], 'Planificación contiene Rutinas, Alimentos y Ejercicios');
  assert.deepEqual(snapshot.groups[2].links, ['Calidad y respaldos', 'Administración'], 'Sistema contiene Calidad y respaldos y Administración');
  assert.equal(snapshot.groups[0].hidden, false, 'el grupo de la ruta actual se abre solo');
  assert.equal(snapshot.groups[1].hidden, true, 'Planificación empieza plegada');

  // Plegar y desplegar con el botón, como un usuario real.
  const toggle = index => page.evaluate(i => document.querySelectorAll('.df-nav-group-toggle')[i].click(), index);
  await toggle(1);
  await pause(250);
  const opened = await page.evaluate(() => ({
    expanded: document.querySelectorAll('.df-nav-group-toggle')[1].getAttribute('aria-expanded'),
    hidden: document.querySelectorAll('.df-nav-submenu')[1].hidden,
  }));
  assert.equal(opened.expanded, 'true', 'el botón marca aria-expanded');
  assert.equal(opened.hidden, false, 'la sublista se muestra al pulsar');
  await toggle(1);
  await pause(250);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.df-nav-submenu')[1].hidden), true, 'vuelve a plegarse');

  assert.deepEqual(errors, [], 'sin errores de página');
  assert.deepEqual(calls.filter(call => call !== 'save'), [], 'solo se habló con los endpoints esperados');
  await page.setViewport({ width: 1280, height: 900 });
  await page.screenshot({ path: 'capturas/coach-menu-plegable.png' });
  console.log('PASS menú del coach: Dashboard/Clientes directos y Seguimiento, Planificación y Sistema plegables');
} finally { await browser?.close(); server.kill('SIGTERM'); }
