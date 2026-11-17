// Verificación real de La Oficina (Brave headless).
// Cubre: agentes en su escritorio, oficina del Patrón vacía, permisos que no
// se repiten, visita solo por llamada del Patrón y revisión de los 3 al mando.
// Uso: node oficina-verifica.mjs [salida.png]
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'oficina-shot-20261116-sin-monos.png';
const URL = 'http://localhost:8000/oficina-local.html';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: 'new',
  args: [
    '--window-size=1600,1000',
    '--hide-scrollbars',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check'
  ],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 }
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/404|Failed to load resource/.test(t)) errors.push('CONSOLE: ' + t);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = {};

async function load() {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#stageWrap canvas', { timeout: 30000 });
  await sleep(2600);
}

// La oficina lanza sola una junta real si hay una sesión con ese título.
// La verificación espera a que termine para mirar los escritorios.
async function waitNoMeeting(maxMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const st = await page.evaluate(() => window.__officePatron().meeting.active);
    if (!st) return true;
    await sleep(600);
  }
  return false;
}
const zoneOf = (a) => a.x > -21 && a.x < -7 && a.z > 9.6 && a.z < 14;
const snap = () => page.evaluate(() => window.__officeSnapshot());
const cards = () => page.evaluate(() => [...document.querySelectorAll('.perm-card')].map((c) => ({
  title: (c.querySelector('.t') || {}).textContent || '',
  body: (c.querySelector('.perm-body') || {}).textContent || '',
  review: (c.querySelector('.delivery-review') || {}).textContent || ''
})));

await load();
await page.evaluate(() => localStorage.clear());
await load();
const cardsAtLoad = await cards();
await sleep(3500);
await waitNoMeeting();
await sleep(5200);

// --- 1. Estado base -------------------------------------------------------
const base = await snap();
const trio = ['Claude', 'DeepSeek', 'Gemini'].map((n) => base.find((a) => a.name === n));
summary.base = {
  intrusosOficinaPatron: base.filter((a) => !a.boss && !a.visitPhase && zoneOf(a)).map((a) => a.name),
  trio: trio.map((a) => ({ name: a.name, state: a.state, task: a.task, x: a.x, z: a.z, deskX: a.deskX, deskZ: a.deskZ })),
  tarjetasAlCargar: cardsAtLoad.length,
  tarjetasAlCargarDetalle: cardsAtLoad,
  chatLive: await page.evaluate(() => (document.getElementById('chatLiveStatus') || {}).textContent || '')
};
await page.screenshot({ path: out });

// --- 2. Permiso Allow se guarda y no reaparece ----------------------------
const first = await page.evaluate(() => window.__officeSimularEntrega('Gemini', 'Verificar typecheck y lint'));
await sleep(500);
const cardBefore = await cards();
const isGeminiCard = (list) => list.some((c) => /Gemini te necesita/.test(c.title) && c.body.includes('Verificar typecheck y lint'));
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.perm-card')].find((c) => /Gemini te necesita/.test(c.textContent) && c.textContent.includes('Verificar typecheck y lint'));
  if (card) card.querySelector('.btn.approve').click();
});
await sleep(700);
const cardAfter = await cards();
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#stageWrap canvas', { timeout: 30000 });
await sleep(2800);
const cardReloaded = await cards();
summary.permiso = {
  forzado: first && first.task,
  tarjetaAparece: isGeminiCard(cardBefore),
  tarjetaTrasAllow: isGeminiCard(cardAfter),
  tarjetaTrasRecargar: isGeminiCard(cardReloaded),
  decisiones: await page.evaluate(() => JSON.parse(localStorage.getItem('la-oficina-permisos-v1') || 'null'))
};

// --- 3. Revisión de los 3 al mando + EN DESACUERDO ------------------------
const pair = await page.evaluate(() => {
  const tasks = ['Auditar endpoints sin auth', 'Revisar RLS de clientes', 'Refactor del SaveQueue', 'Revisar seguridad del portal', 'Preparar deploy de producción', 'Migrar esquema de rutinas'];
  const names = ['build', 'auto-mejora', 'codegraph', 'db', 'debate', 'debug', 'deploy', 'explore', 'review', 'security', 'test', 'verificar'];
  for (const n of names) {
    for (const t of tasks) {
      const r = window.__officeReviewFor(n, t);
      if (r && r.status === 'observada') return { name: n, task: t, review: r };
    }
  }
  return null;
});
if (!pair) throw new Error('No se encontró un caso EN DESACUERDO reproducible');
const forced = await page.evaluate((p) => window.__officeSimularEntrega(p.name, p.task), pair);
await sleep(600);
const reviewUI = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.delivery')].find((x) => /EN DESACUERDO/.test(x.textContent));
  const chat = document.getElementById('chatBody');
  return {
    deliveriesConRevision: document.querySelectorAll('.delivery-review').length,
    desacuerdoEnCola: !!d,
    desacuerdoTexto: d ? d.querySelector('.delivery-review').textContent : '',
    avisoEnChat: chat ? /EN DESACUERDO/.test(chat.textContent) : false,
    lineasRevision: d ? [...d.querySelectorAll('.dr-line')].map((x) => x.textContent) : []
  };
});
summary.revision = { caso: pair.name + ' · ' + pair.task, status: pair.review.status, ui: reviewUI, forzadoId: forced && forced.id };
await page.screenshot({ path: out.replace(/\.png$/, '-desacuerdo.png') });

// --- 4. Llamada del Patrón: viene, celebra y regresa ----------------------
await waitNoMeeting();
const idlePatron = Date.now();
while (Date.now() - idlePatron < 30000) {
  const st = await page.evaluate(() => window.__officePatron());
  if (!st.meeting.active && st.visitOwner === null) break;
  await sleep(700);
}
const visitName = await page.evaluate(() => {
  const a = window.__officeSnapshot().find((x) => !x.boss && x.name !== 'Mini lemons');
  return a ? a.name : '';
});
await page.evaluate((name) => {
  const row = [...document.querySelectorAll('.agent-row')].find((r) => r.textContent.includes(name));
  if (row) row.click();
}, visitName);
await sleep(400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#inspCard button')].find((x) => /Llamar/.test(x.textContent));
  if (b) b.click();
});
const samples = [];
let meetingDuring = false;
for (let i = 0; i < 90; i += 1) {
  await sleep(400);
  const state = await page.evaluate(() => ({ crew: window.__officeSnapshot(), patron: window.__officePatron() }));
  const a = state.crew.find((x) => x.name === visitName);
  if (state.patron.meeting.active) meetingDuring = true;
  samples.push({ t: +(i * 0.4).toFixed(1), x: a.x, z: a.z, visit: a.visitPhase, seated: a.seated });
  if (samples.some((s) => s.visit === 'celebrate') && a.visitPhase === '' && !a.walking) break;
}
await sleep(800);
const end = (await snap()).find((x) => x.name === visitName);
summary.visita = {
  agente: visitName,
  fases: [...new Set(samples.map((s) => s.visit))],
  muestrasEnOficinaPatron: samples.filter((s) => s.z > 9.6 && s.z < 14 && s.x > -21 && s.x < -7).length,
  fin: end,
  meetingDuranteVisita: meetingDuring
};

// --- 5. Demo 15 s: nadie se queda en la oficina del Patrón ----------------
await page.click('#demoBtn');
const watch = [];
for (let i = 0; i < 15; i += 1) {
  await sleep(1000);
  watch.push((await snap()).filter((a) => !a.boss && !a.visitPhase && zoneOf(a)).map((a) => a.name));
}
await page.click('#demoBtn');
await page.screenshot({ path: out.replace(/\.png$/, '-demo.png') });
summary.demo = { intrusosVistos: [...new Set(watch.flat())] };

const finalSnap = await snap();
summary.final = {
  intrusos: finalSnap.filter((a) => !a.boss && !a.visitPhase && zoneOf(a)).map((a) => a.name),
  trio: finalSnap.filter((a) => ['Claude', 'DeepSeek', 'Gemini'].includes(a.name)).map((a) => ({ name: a.name, state: a.state, task: a.task })),
  phoning: finalSnap.filter((a) => a.phoning).map((a) => a.name)
};
summary.errores = errors;

const ok =
  summary.base.intrusosOficinaPatron.length === 0 &&
  summary.base.tarjetasAlCargar === 0 &&
  summary.base.trio.every((a) => a.state === 'working' && a.task) &&
  summary.permiso.tarjetaAparece === true &&
  summary.permiso.tarjetaTrasAllow === false &&
  summary.permiso.tarjetaTrasRecargar === false &&
  summary.revision.ui.desacuerdoEnCola === true &&
  summary.revision.ui.avisoEnChat === true &&
  summary.revision.ui.lineasRevision.length >= 3 &&
  summary.visita.muestrasEnOficinaPatron > 0 &&
  summary.visita.fases.includes('celebrate') &&
  summary.demo.intrusosVistos.length === 0 &&
  summary.final.intrusos.length === 0 &&
  errors.length === 0;

console.log(JSON.stringify(summary, null, 2));
console.log(ok ? 'VERIFICACION OK' : 'VERIFICACION FALLIDA');
await browser.close();
process.exit(ok ? 0 : 1);
