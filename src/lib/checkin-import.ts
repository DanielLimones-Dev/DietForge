import type { Activity } from './training-tracking';
import type { Adherence, BodyMeasurements, CheckIn, PhotoRef, PhotoAngle } from '@/types';
import { measurementFields, photoAngles, portalCheckInPhotoPath } from './portal-checkin';
import { validTrainingDate } from './training';

const adherenceKeys = ['meals', 'supplements', 'training', 'cardio', 'energy', 'sleep', 'hunger', 'libido', 'digestion'] as const;

export interface PortalCheckInRecord {
  /** UUID de `dietforge_client_activity`; es la clave de idempotencia de la importación. */
  id: string;
  date: string;
  weight: number;
  bodyFat?: number;
  measurements: BodyMeasurements;
  adherence?: Adherence;
  notes: string;
  photos: { angle: PhotoAngle; path: string }[];
}

export interface ImportedCheckInFields {
  client_id: number;
  date: string;
  weight: number;
  body_fat?: number;
  measurements?: BodyMeasurements;
  adherence?: Adherence;
  notes?: string;
  portal_activity_id: string;
}

export interface CheckInImportStore {
  list(clientId: number): CheckIn[];
  photos(checkInId: number): PhotoRef[];
  create(data: Omit<CheckIn, 'id'>): CheckIn;
  update(id: number, data: Partial<CheckIn>): CheckIn | undefined;
  savePhoto(data: Omit<PhotoRef, 'id'>): PhotoRef;
  deletePhoto(id: number): void;
}

export interface ImportResult {
  status: 'new' | 'update' | 'imported';
  checkInId: number;
}

export interface CheckInImportTarget {
  status: 'new' | 'update' | 'imported';
  checkInId: number | null;
}

function numberInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/**
 * Normaliza un check-in del portal. Devuelve null cuando falta fecha o peso válidos,
 * porque sin ellos el registro no puede entrar al seguimiento del coach.
 */
export function readPortalCheckIn(activity: Activity): PortalCheckInRecord | null {
  if (activity.kind !== 'checkin') return null;
  const data = activity.data ?? {};
  const date = typeof data.date === 'string' ? data.date.slice(0, 10) : '';
  if (!validTrainingDate(date)) return null;
  const weight = numberInRange(data.weight, 20, 500);
  if (weight === null) return null;

  const rawMeasurements = data.measurements && typeof data.measurements === 'object' ? data.measurements as Record<string, unknown> : {};
  const measurements: BodyMeasurements = {};
  for (const key of Object.keys(measurementFields) as (keyof BodyMeasurements)[]) {
    const value = numberInRange(rawMeasurements[key], 0.1, 300);
    if (value !== null) measurements[key] = value;
  }

  const rawAdherence = data.adherence && typeof data.adherence === 'object' ? data.adherence as Record<string, unknown> : {};
  const adherence: Partial<Adherence> = {};
  for (const key of adherenceKeys) {
    const wellbeing = key === 'energy' || key === 'sleep' || key === 'hunger' || key === 'libido' || key === 'digestion';
    const value = numberInRange(rawAdherence[key], wellbeing ? 1 : 0, wellbeing ? 5 : 100);
    if (value !== null) adherence[key] = wellbeing ? Math.round(value) : value;
  }

  const photos: PortalCheckInRecord['photos'] = [];
  for (const photo of Array.isArray(data.photos) ? data.photos : []) {
    if (!photo || typeof photo !== 'object') continue;
    const entry = photo as { angle?: unknown; path?: unknown };
    if (typeof entry.angle !== 'string' || !Object.prototype.hasOwnProperty.call(photoAngles, entry.angle)) continue;
    if (typeof entry.path !== 'string' || !portalCheckInPhotoPath.test(entry.path)) continue;
    const angle = entry.angle as PhotoAngle;
    if (photos.some((item) => item.angle === angle)) continue;
    photos.push({ angle, path: entry.path });
  }

  const bodyFat = numberInRange(data.body_fat, 0, 70) ?? undefined;
  return {
    id: activity.id,
    date,
    weight,
    ...(bodyFat !== undefined ? { bodyFat } : {}),
    measurements,
    // Solo se importa la adherencia completa: un registro parcial no debe inventar respuestas.
    ...(Object.keys(adherence).length === adherenceKeys.length ? { adherence: adherence as Adherence } : {}),
    notes: typeof data.notes === 'string' ? data.notes.slice(0, 5000) : '',
    photos,
  };
}

/**
 * Decide si el check-in del portal se crea, actualiza un check-in de la misma fecha
 * o ya estaba importado. El UUID evita duplicados en cualquier reintento.
 */
export function checkInImportTarget(checkins: CheckIn[], portal: PortalCheckInRecord): CheckInImportTarget {
  const imported = checkins.find((checkin) => checkin.portal_activity_id === portal.id);
  if (imported) return { status: 'imported', checkInId: imported.id };
  const sameDate = checkins.find((checkin) => checkin.date.slice(0, 10) === portal.date);
  if (sameDate) return { status: 'update', checkInId: sameDate.id };
  return { status: 'new', checkInId: null };
}

/**
 * Copia peso, notas, medidas y adherencia sin perder lo que el coach ya había escrito.
 * La grasa corporal y el feedback del coach no vienen del portal, así que se conservan.
 */
export function portalCheckInFields(portal: PortalCheckInRecord, clientId: number, existing?: CheckIn): ImportedCheckInFields {
  const measurements: BodyMeasurements = { ...(existing?.measurements ?? {}), ...portal.measurements };
  return {
    client_id: clientId,
    date: portal.date,
    weight: portal.weight,
    ...(portal.bodyFat !== undefined || existing?.body_fat !== undefined ? { body_fat: portal.bodyFat ?? existing?.body_fat } : {}),
    ...(Object.keys(measurements).length ? { measurements } : {}),
    ...(portal.adherence ?? existing?.adherence ? { adherence: portal.adherence ?? existing?.adherence } : {}),
    ...(portal.notes || existing?.notes ? { notes: portal.notes || existing?.notes } : {}),
    portal_activity_id: portal.id,
  };
}

/** Fotos del portal listas para `db.photos`; `data` guarda la ruta privada, no una URL caduca. */
export function portalCheckInPhotos(portal: PortalCheckInRecord): { angle: PhotoAngle; data: string }[] {
  return portal.photos.map((photo) => ({ angle: photo.angle, data: photo.path }));
}

/**
 * Copia el check-in recibido al check-in del cliente. Es idempotente: el UUID del
 * portal queda guardado y un segundo intento no crea otro registro.
 */
export function importPortalCheckIn(portal: PortalCheckInRecord, clientId: number, store: CheckInImportStore): ImportResult {
  const current = store.list(clientId);
  const target = checkInImportTarget(current, portal);
  if (target.status === 'imported') {
    return { status: 'imported', checkInId: target.checkInId! };
  }
  const existing = target.checkInId === null ? undefined : current.find((checkin) => checkin.id === target.checkInId);
  const fields = portalCheckInFields(portal, clientId, existing);
  const checkIn = existing ? store.update(existing.id, fields) ?? existing : store.create(fields);

  const localPhotos = store.photos(checkIn.id);
  for (const photo of portalCheckInPhotos(portal)) {
    if (localPhotos.some((item) => item.angle === photo.angle && item.data === photo.data)) continue;
    for (const previous of localPhotos.filter((item) => item.angle === photo.angle)) store.deletePhoto(previous.id);
    store.savePhoto({ checkin_id: checkIn.id, angle: photo.angle, data: photo.data, date: portal.date });
  }
  return { status: target.status, checkInId: checkIn.id };
}
