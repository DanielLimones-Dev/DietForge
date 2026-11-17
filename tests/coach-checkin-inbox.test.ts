import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import type { CheckIn, PhotoRef } from '../src/types';
import type { Activity } from '../src/lib/training-tracking';

const checkinA = '11111111-1111-4111-8111-111111111111';
const checkinB = '22222222-2222-4222-8222-222222222222';

const activity: Activity[] = [
  { id: checkinB, kind: 'checkin', data: { date: '2026-11-12', weight: 72.5, measurements: { waist: 83.5 }, notes: 'Buena semana.', photos: [] } },
  { id: checkinA, kind: 'checkin', data: { date: '2026-11-05', weight: 73.8, notes: 'Cansancio el viernes.', photos: [] } },
];

function memoryStore() {
  const checkins: CheckIn[] = [];
  let photos: PhotoRef[] = [];
  let nextCheckIn = 10;
  let nextPhoto = 100;
  return {
    get count() { return checkins.length; },
    get savedPhotos() { return photos.length; },
    list: (clientId: number) => checkins.filter((item) => item.client_id === clientId),
    photos: (checkInId: number) => photos.filter((item) => item.checkin_id === checkInId),
    create: (data: Omit<CheckIn, 'id'>) => { const row = { ...data, id: nextCheckIn++ }; checkins.push(row); return row; },
    update: (id: number, data: Partial<CheckIn>) => {
      const index = checkins.findIndex((item) => item.id === id);
      if (index < 0) return undefined;
      checkins[index] = { ...checkins[index], ...data };
      return checkins[index];
    },
    savePhoto: (data: Omit<PhotoRef, 'id'>) => { const row = { ...data, id: nextPhoto++ }; photos.push(row); return row; },
    deletePhoto: (id: number) => { photos = photos.filter((item) => item.id !== id); },
  };
}

async function renderInbox(options: { canImport: boolean; store: ReturnType<typeof memoryStore> }) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/clients/1/care', pretendToBeVisual: true });
  const keys = ['window', 'self', 'document', 'navigator', 'WebSocket', 'BroadcastChannel'] as const;
  const originals = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { CoachCheckInInbox } = await import('../src/components/CoachCheckInInbox');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  await act(async () => {
    root.render(createElement(CoachCheckInInbox, {
      clientId: 1,
      clientName: 'Cliente Prueba',
      activity,
      canImport: options.canImport,
      store: options.store,
    }));
  });
  const click = async (text: string) => {
    const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.includes(text));
    assert.ok(button, `button ${text}`);
    await act(async () => button.click());
  };
  const cleanup = async () => {
    await act(async () => root.unmount());
    for (const key of keys) {
      const original = originals.get(key);
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  };
  return { click, cleanup };
}

test('la lista del coach muestra fecha, peso, notas y el estado de importación sin ruido', async () => {
  const store = memoryStore();
  const { cleanup } = await renderInbox({ canImport: true, store });
  try {
    const text = document.body.textContent ?? '';
    assert.match(text, /Check-ins de Cliente Prueba/);
    assert.match(text, /2 recibidos · 2 por importar/);
    assert.match(text, /12 nov 2026/);
    assert.match(text, /72\.5 kg/);
    assert.match(text, /Buena semana\./);
    assert.match(text, /Cansancio el viernes\./);
    assert.equal(document.querySelector('[data-checkin-inbox-id]')?.getAttribute('data-checkin-inbox-id'), checkinB, 'newest first');
    assert.equal(document.querySelectorAll('button').length >= 2, true, 'every received check-in has an import action');
  } finally {
    await cleanup();
  }
});

test('importar pide confirmación, copia al check-in del cliente y no duplica', async () => {
  const store = memoryStore();
  const { click, cleanup } = await renderInbox({ canImport: true, store });
  try {
    assert.equal(store.count, 0);
    await click('Importar al check-in del cliente');
    assert.match(document.body.textContent ?? '', /Se copiarán peso, notas, medidas, adherencia y fotos/);
    assert.equal(store.count, 0, 'nothing is written before confirmation');

    await click('Confirmar importación');
    assert.equal(store.count, 1);
    assert.equal(store.list(1)[0].portal_activity_id, checkinB);
    assert.equal(store.list(1)[0].weight, 72.5);
    const status = document.querySelector('[role=status]');
    assert.match(status?.textContent ?? '', /importado al expediente del cliente/);
    assert.match(document.body.textContent ?? '', /Ya está en el check-in del cliente/);
    assert.equal(Array.from(document.querySelectorAll('button')).filter((node) => node.textContent?.includes('Importar al check-in del cliente')).length, 1, 'imported row no longer offers the action');

    await click('Importar al check-in del cliente');
    await click('Confirmar importación');
    assert.equal(store.count, 2, 'only the second, not-yet-imported check-in creates a record');
  } finally {
    await cleanup();
  }
});

test('sin permiso de coach la lista se muestra pero no permite importar', async () => {
  const store = memoryStore();
  const { cleanup } = await renderInbox({ canImport: false, store });
  try {
    assert.equal(Array.from(document.querySelectorAll('button')).some((node) => node.textContent?.includes('Importar al check-in del cliente')), false);
    assert.match(document.body.textContent ?? '', /Solo el coach asignado puede importarlo\./);
    assert.equal(store.count, 0);
  } finally {
    await cleanup();
  }
});
