'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ClipboardCheck, Filter } from 'lucide-react';
import { db } from '@/lib/db';
import type { Activity } from '@/lib/training-tracking';
import type { Adherence } from '@/types';
import { checkInImportTarget, importPortalCheckIn, readPortalCheckIn, type CheckInImportStore, type PortalCheckInRecord } from '@/lib/checkin-import';
import { adherenceFields, measurementFields, photoAngles, wellbeingFields } from '@/lib/portal-checkin';
import { CheckInPhoto } from './CheckInPhoto';

/** Adaptador por defecto: el check-in local del cliente dentro del snapshot del coach. */
export const dbCheckInStore: CheckInImportStore = {
  list: (clientId) => db.getCheckIns(clientId),
  photos: (checkInId) => db.getPhotosForCheckIn(checkInId),
  create: (data) => db.saveCheckIn(data),
  update: (id, data) => db.updateCheckIn(id, data),
  savePhoto: (data) => db.savePhoto(data),
  deletePhoto: (id) => db.deletePhoto(id),
};

function dateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function adherenceAverage(portal: PortalCheckInRecord): number | null {
  if (!portal.adherence) return null;
  const main = [portal.adherence.meals, portal.adherence.supplements, portal.adherence.training, portal.adherence.cardio];
  return Math.round(main.reduce((total, value) => total + value, 0) / main.length);
}

interface Props {
  clientId: number;
  clientName: string;
  activity: Activity[];
  canImport: boolean;
  targetId?: string;
  onViewed?: (id: string) => void | Promise<void>;
  /** Sustituible en pruebas para usar un almacén en memoria. */
  store?: CheckInImportStore;
}

interface Notice {
  id: string;
  text: string;
  error: boolean;
}

export function CoachCheckInInbox({ clientId, clientName, activity, canImport, targetId, onViewed, store = dbCheckInStore }: Props) {
  const [, refresh] = useState(0);
  const [onlyPending, setOnlyPending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const viewed = useRef<string | null>(null);

  const checkins = store.list(clientId);
  const records = useMemo(() => activity
    .filter((item) => item.kind === 'checkin')
    .map(readPortalCheckIn)
    .filter((item): item is PortalCheckInRecord => item !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [activity]);
  const targets = new Map(records.map((record) => [record.id, checkInImportTarget(checkins, record)]));
  const importedCount = records.filter((record) => targets.get(record.id)?.status === 'imported').length;
  const pendingCount = records.length - importedCount;
  // A deep-linked check-in must stay visible even if the pending filter is active.
  const visible = onlyPending && !targetId ? records.filter((record) => targets.get(record.id)?.status !== 'imported') : records;

  useEffect(() => {
    if (!targetId) { viewed.current = null; return; }
    if (viewed.current === targetId || !records.some((record) => record.id === targetId)) return;
    const node = rows.current.get(targetId);
    if (!node) return;
    viewed.current = targetId;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    void Promise.resolve(onViewed?.(targetId)).catch(() => { if (viewed.current === targetId) viewed.current = null; });
  }, [targetId, records, onViewed]);

  function runImport(record: PortalCheckInRecord) {
    if (!canImport) return;
    setNotice(null);
    try {
      const result = importPortalCheckIn(record, clientId, store);
      setConfirming(null);
      refresh((value) => value + 1);
      if (result.status === 'imported') {
        setNotice({ id: record.id, text: `Este check-in ya estaba importado (${dateLabel(record.date)}). No se duplicó.`, error: false });
        return;
      }
      setNotice({
        id: record.id,
        text: result.status === 'update'
          ? `Check-in del ${dateLabel(record.date)} actualizado con los datos del cliente.`
          : `Check-in del ${dateLabel(record.date)} importado al expediente del cliente.`,
        error: false,
      });
    } catch (error) {
      setNotice({ id: record.id, text: error instanceof Error ? error.message : 'No se pudo importar el check-in.', error: true });
    }
  }

  return (
    <section className="care-card checkin-inbox" aria-labelledby="checkin-inbox-title">
      <header className="checkin-inbox-head">
        <div>
          <span className="training-kicker">CHECK-INS RECIBIDOS</span>
          <h2 id="checkin-inbox-title">Check-ins de {clientName}</h2>
          <p>
            {records.length === 0
              ? 'Aún no hay envíos del cliente.'
              : `${records.length} ${records.length === 1 ? 'recibido' : 'recibidos'} · ${pendingCount} por importar`}
          </p>
        </div>
        {importedCount > 0 && records.length > importedCount && (
          <div className="checkin-inbox-filters" role="group" aria-label="Filtrar check-ins">
            <Filter size={14} aria-hidden="true" />
            <button type="button" aria-pressed={!onlyPending} onClick={() => setOnlyPending(false)}>Todos</button>
            <button type="button" aria-pressed={onlyPending} onClick={() => setOnlyPending(true)}>Por importar ({pendingCount})</button>
          </div>
        )}
      </header>

      {notice && (
        <p role={notice.error ? 'alert' : 'status'} className={`checkin-inbox-notice${notice.error ? ' is-error' : ''}`}>
          {notice.text}
        </p>
      )}

      {targetId && !records.some((record) => record.id === targetId) && (
        <p role="status" className="checkin-inbox-notice">No se encontró el check-in solicitado en los datos disponibles.</p>
      )}

      {records.length === 0 && (
        <p className="checkin-inbox-empty">Cuando tu cliente envíe su check-in desde el portal aparecerá aquí, listo para importar.</p>
      )}

      {records.length > 0 && visible.length === 0 && (
        <p className="checkin-inbox-empty">Todos los check-ins recibidos ya están importados.</p>
      )}

      <ul className="checkin-inbox-list">
        {visible.map((record) => {
          const target = targets.get(record.id)!;
          const older = records[records.indexOf(record) + 1];
          const delta = older ? Math.round((record.weight - older.weight) * 10) / 10 : null;
          const adherence = adherenceAverage(record);
          const measurements = Object.entries(measurementFields).filter(([key]) => record.measurements[key as keyof typeof record.measurements] !== undefined);
          const wellbeing = record.adherence
            ? (Object.entries({ ...adherenceFields, ...wellbeingFields }) as [keyof Adherence, string][]).filter(([key]) => record.adherence?.[key] !== undefined)
            : [];
          const openDetails = measurements.length > 0 || wellbeing.length > 0;
          const updateExisting = target.status === 'update';

          return (
            <li
              key={record.id}
              ref={(node) => { if (node) rows.current.set(record.id, node); else rows.current.delete(record.id); }}
              className={`checkin-inbox-row${targetId === record.id ? ' is-target' : ''}`}
              data-checkin-inbox-id={record.id}
            >
              <div className="checkin-inbox-main">
                <time dateTime={record.date}>{dateLabel(record.date)}</time>
                <strong>{record.weight} kg</strong>
                {delta !== null && delta !== 0 && (
                  <span className="checkin-inbox-delta">{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} kg</span>
                )}
                {target.status === 'imported' && <span className="checkin-inbox-badge"><Check size={12} aria-hidden="true" /> Importado</span>}
              </div>

              <p className="checkin-inbox-meta">
                {record.bodyFat !== undefined && <span>{record.bodyFat}% grasa</span>}
                {adherence !== null && <span>Adherencia {adherence}%</span>}
                {record.photos.length > 0 && <span><Camera size={12} aria-hidden="true" /> {record.photos.length} {record.photos.length === 1 ? 'foto' : 'fotos'}</span>}
                {record.measurements && Object.keys(record.measurements).length > 0 && <span>{Object.keys(record.measurements).length} medidas</span>}
              </p>

              {record.notes && <p className="checkin-inbox-notes">{record.notes}</p>}

              {record.photos.length > 0 && (
                <div className="checkin-inbox-photos">
                  {record.photos.map((photo) => (
                    <CheckInPhoto key={`${record.id}-${photo.angle}`} src={photo.path} alt={photoAngles[photo.angle]} className="checkin-inbox-photo" />
                  ))}
                </div>
              )}

              {openDetails && (
                <details className="checkin-inbox-more">
                  <summary>Ver medidas y adherencia</summary>
                  <dl>
                    {measurements.map(([key, label]) => (
                      <div key={key}><dt>{label}</dt><dd>{record.measurements[key as keyof typeof record.measurements]} cm</dd></div>
                    ))}
                    {wellbeing.map(([key, label]) => (
                      <div key={key}><dt>{label}</dt><dd>{record.adherence![key]}{key in wellbeingFields ? ' / 5' : '%'}</dd></div>
                    ))}
                  </dl>
                </details>
              )}

              <footer className="checkin-inbox-actions">
                {target.status === 'imported' ? (
                  <span className="checkin-inbox-imported"><ClipboardCheck size={15} aria-hidden="true" /> Ya está en el check-in del cliente</span>
                ) : !canImport ? (
                  <span className="checkin-inbox-imported">Solo el coach asignado puede importarlo.</span>
                ) : confirming === record.id ? (
                  <div className="checkin-inbox-confirm" role="group" aria-label="Confirmar importación">
                    <p>Se copiarán peso, notas, medidas, adherencia y fotos al check-in {updateExisting ? 'existente' : 'nuevo'} del {dateLabel(record.date)}. ¿Continuar?</p>
                    <div>
                      <button type="button" className="is-primary" onClick={() => runImport(record)}>Confirmar importación</button>
                      <button type="button" onClick={() => setConfirming(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setNotice(null); setConfirming(record.id); }}>
                    <ClipboardCheck size={15} aria-hidden="true" />
                    Importar al check-in del cliente
                  </button>
                )}
              </footer>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
