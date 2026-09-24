import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const origin = 'http://127.0.0.1:3158';
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
let browser;
let portalReads=0;let fault=false;let deny=false;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3158'], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.resume();
server.stderr.resume();

try {
  for(let i=0;i<100;i++) { try { if((await fetch(origin)).ok)break; }catch{} await pause(100); }
  browser=await puppeteer.launch({headless:true,executablePath:process.env.DIETFORGE_BROWSER_EXECUTABLE??'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',async request=>{
    const url=new URL(request.url());
    const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
    if(url.origin===remoteOrigin){
      if(request.method()==='OPTIONS')return request.respond({status:204,headers});
      let body;
      if(url.pathname.endsWith('/dietforge_load'))body={revision,snapshot};
      else if(url.pathname.endsWith('/dietforge_my_access'))body={active:true,status:'active',isAdmin:false,email:user.email,expiresAt:new Date(Date.now()+86400000).toISOString()};
      else if(url.pathname.endsWith('/dietforge_is_admin'))body=false;
      else if(url.pathname.endsWith('/dietforge_notifications_read'))body={unread:0,items:[]};
      else if(url.pathname.endsWith('/dietforge_portal_memberships'))body=[{owner_id:owner,client_id:1,name:'Cliente de prueba A',email:'client@example.invalid',enabled:true}];
      else if(url.pathname.endsWith('/dietforge_portal_read')){
        portalReads++;
        if(fault||deny)return request.respond({status:deny?403:503,headers,body:JSON.stringify({code:deny?'42501':'PGRST001',message:'Fixture failure'})});
        const id=JSON.parse(request.postData()).c;
        body={client:snapshot.database.clients.find(c=>c.id===id),trainingPrograms:[],mealPlans:[],mealPlanItems:[],foods:[],measurements:[],weekPlans:[],activity:[]};
      }else if(url.pathname==='/auth/v1/user')body=user;
      else {errors.push('Unexpected mocked endpoint: '+url.pathname);return request.abort();}
      return request.respond({status:200,headers,body:JSON.stringify(body)});
    }
    if(url.origin===origin||['data:','blob:'].includes(url.protocol))return request.continue();
    errors.push('Unexpected external request: '+url.origin);return request.abort();
  });
  await page.evaluateOnNewDocument(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:storageKey,session});
  await page.goto(origin+'/clients/1/care',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('.care-heading')?.textContent.includes('Sincronización automática activa'));
  assert.equal(portalReads,1,'one initial portal read, no competing initial fetch');
  const email='.care-access-form input[type="email"]';
  await page.$eval(email,node=>{node.value='';node.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.type(email,'borrador@example.invalid');
  const draft=await page.$eval(email,node=>node.value);
  fault=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('.care-heading')?.textContent.includes('Reintentaremos automáticamente'));
  assert.equal(await page.$eval(email,node=>node.value),draft,'failed refresh retains email draft');
  assert.ok(await page.$('.care-tabs'),'transient errors preserve the mounted content');
  fault=false;
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Reintentar sincronización').click());
  await page.waitForFunction(()=>document.querySelector('.care-heading')?.textContent.includes('Sincronización automática activa'));
  assert.equal(await page.$eval(email,node=>node.value),draft,'successful refresh does not replace edited email');
  deny=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('.care-heading')?.textContent.includes('No tienes acceso'));
  assert.equal(await page.$('.care-tab-panel'),null,'revocation removes private data panels');
  const stoppedAt=portalReads;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await pause(150);
  assert.equal(portalReads,stoppedAt,'no retry loop after denial');
  deny=false;
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Reintentar sincronización').click());
  await page.waitForSelector('.care-tab-panel');
  await page.goto(origin+'/agenda',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('Sincronización automática activa'));
  fault=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('Reintentaremos automáticamente'));
  assert.ok(await page.$('.agenda-calendar-head'),'calendar remains present during transient failure');
  await page.select('select[aria-label="Cliente de la agenda"]','2');
  fault=false;
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.textContent==='Reintentar sincronización')?.click());
  await page.waitForFunction(()=>document.querySelector('.agenda-calendar-head')?.textContent.includes('Cliente de prueba B'));
  assert.deepEqual(errors,[]);
  console.log('PASS Brave: one initial read, transient failure/recovery, edited email retained, revocation pause, Agenda errors and client switch; zero live writes.');
}finally{await browser?.close();server.kill('SIGTERM');}
