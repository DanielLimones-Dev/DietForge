import test from 'node:test';
import assert from 'node:assert/strict';
import type { CheckIn, PhotoRef } from '../src/types';
import type { Activity } from '../src/lib/training-tracking';
import type { CheckInImportStore } from '../src/lib/checkin-import';
import { checkInImportTarget, importPortalCheckIn, portalCheckInFields, portalCheckInPhotos, readPortalCheckIn } from '../src/lib/checkin-import';

const owner = '00000000-0000-4000-8000-000000000001';
const photoA = `${owner}/1/00000000-0000-4000-8000-0000000000aa.jpg`;
const photoB = `${owner}/1/00000000-0000-4000-8000-0000000000bb.png`;

function activity(data: Record<string, unknown>, id = '11111111-1111-4111-8111-111111111111'): Activity {
  return { id, kind: 'checkin', data };
}

const complete = {
  date: '2026-11-12',
  weight: 72.5,
  measurements: { waist: 83.5, neck: 38, hips: 95.2 },
  adherence: { meals: 90, supplements: 100, training: 80, cardio: 70, energy: 4, sleep: 3, hunger: 2, libido: 4, digestion: 3 },
  notes: 'Buena semana, algo de hambre por la noche.',
  photos: [{ angle: 'front_relaxed', path: photoA }, { angle: 'back_relaxed', path: photoB }],
};

function memoryStore() {
  const checkins: CheckIn[] = [];
  let photos: PhotoRef[] = [];
  let nextCheckIn = 10;
  let nextPhoto = 100;
  return {
    get rows() { return checkins; },
    get photos() { return photos; },
    list: (clientId: number) => checkins.filter((item) => item.client_id === clientId),
    photosFor: (checkInId: number) => photos.filter((item) => item.checkin_id === checkInId),
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

test('readPortalCheckIn normaliza el envío y descarta fechas o pesos inválidos', () => {
  const portal = readPortalCheckIn(activity(complete));
  assert.ok(portal);
  assert.equal(portal.date, '2026-11-12');
  assert.equal(portal.weight, 72.5);
  assert.deepEqual(portal.measurements, { waist: 83.5, neck: 38, hips: 95.2 });
  assert.equal(portal.notes, complete.notes);
  assert.deepEqual(portal.adherence, complete.adherence);
  assert.deepEqual(portal.photos.map((photo) => photo.angle), ['front_relaxed', 'back_relaxed']);

  assert.equal(readPortalCheckIn(activity({ ...complete, date: '2026-02-30' })), null);
  assert.equal(readPortalCheckIn(activity({ ...complete, weight: 0 })), null);
  assert.equal(readPortalCheckIn(activity({ ...complete, weight: '72' })), null);
  assert.equal(readPortalCheckIn({ id: 'x', kind: 'meal', data: complete }), null);
});

test('readPortalCheckIn ignora medidas y adherencia inválidas sin inventar respuestas', () => {
  const portal = readPortalCheckIn(activity({ ...complete, date: '2026-11-12', adherence: { meals: 120, energy: 9 }, measurements: { waist: 0, chest: 'grande', hips: 92 } }));
  assert.ok(portal);
  assert.deepEqual(portal.measurements, { hips: 92 });
  assert.equal(portal.adherence, undefined, 'partial adherence is not imported');
});

test('readPortalCheckIn descarta fotos con ruta o ángulo no permitidos y duplicados', () => {
  const portal = readPortalCheckIn(activity({
    ...complete,
    photos: [
      { angle: 'front_relaxed', path: photoA },
      { angle: 'front_relaxed', path: photoB },
      { angle: 'invented', path: photoB },
      { angle: 'side_chest', path: 'https://example.invalid/foto.jpg' },
      { angle: 'most_muscular', path: photoB },
    ],
  }));
  assert.ok(portal);
  assert.deepEqual(portal.photos, [{ angle: 'front_relaxed', path: photoA }, { angle: 'most_muscular', path: photoB }]);
  assert.deepEqual(portalCheckInPhotos(portal), [{ angle: 'front_relaxed', data: photoA }, { angle: 'most_muscular', data: photoB }]);
});

test('checkInImportTarget no duplica y prefiere el check-in de la misma fecha', () => {
  const portal = readPortalCheckIn(activity(complete))!;
  assert.deepEqual(checkInImportTarget([], portal), { status: 'new', checkInId: null });
  const manual: CheckIn = { id: 4, client_id: 1, date: '2026-11-12', weight: 73 };
  assert.deepEqual(checkInImportTarget([manual], portal), { status: 'update', checkInId: 4 });
  const imported: CheckIn = { ...manual, portal_activity_id: portal.id };
  assert.deepEqual(checkInImportTarget([imported], portal), { status: 'imported', checkInId: 4 });
});

test('portalCheckInFields conserva grasa, feedback y notas del coach', () => {
  const portal = readPortalCheckIn(activity(complete))!;
  const existing: CheckIn = {
    id: 4, client_id: 1, date: '2026-11-12', weight: 73, body_fat: 18,
    measurements: { chest: 100, waist: 85 }, notes: 'Nota del coach', coach_feedback: 'Sigue así',
  };
  const fields = portalCheckInFields(portal, 1, existing);
  assert.equal(fields.date, '2026-11-12');
  assert.equal(fields.weight, 72.5);
  assert.equal(fields.body_fat, 18);
  assert.equal(fields.notes, complete.notes);
  assert.equal('coach_feedback' in fields, false, 'feedback is never part of the import payload');
  assert.deepEqual(fields.measurements, { chest: 100, waist: 83.5, neck: 38, hips: 95.2 });
  assert.equal(fields.portal_activity_id, portal.id);

  const withoutPortalNotes = readPortalCheckIn(activity({ ...complete, notes: '' }))!;
  assert.equal(portalCheckInFields(withoutPortalNotes, 1, existing).notes, 'Nota del coach');
});

test('importPortalCheckIn copia datos y fotos una sola vez', () => {
  const store = memoryStore();
  const adapter: CheckInImportStore = {
    list: store.list,
    photos: store.photosFor,
    create: store.create,
    update: store.update,
    savePhoto: store.savePhoto,
    deletePhoto: store.deletePhoto,
  };
  const portal = readPortalCheckIn(activity(complete))!;

  const first = importPortalCheckIn(portal, 1, adapter);
  assert.equal(first.status, 'new');
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].portal_activity_id, portal.id);
  assert.equal(store.rows[0].client_id, 1);
  assert.equal(store.photos.length, 2);

  const second = importPortalCheckIn(portal, 1, adapter);
  assert.equal(second.status, 'imported');
  assert.equal(second.checkInId, first.checkInId);
  assert.equal(store.rows.length, 1, 'retrying never duplicates the local check-in');
  assert.equal(store.photos.length, 2, 'retrying never duplicates photos');
});
