'use client';

import { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, X, ArrowUpRight } from 'lucide-react';
import {
  LATEST_SYSTEM_UPDATE,
  SYSTEM_UPDATES,
  SYSTEM_UPDATE_EVENT,
  hasUnreadSystemUpdate,
  markSystemUpdateSeen,
} from '@/lib/app-updates';
import { SHELL_COPY, useAppLanguage } from '@/lib/language';

export const OPEN_SYSTEM_UPDATE_MODAL_EVENT = 'dietforge:open-system-update-modal';

export function useSystemUpdateStatus() {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const sync = () => setUnread(hasUnreadSystemUpdate());
    sync();
    window.addEventListener(SYSTEM_UPDATE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SYSTEM_UPDATE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    unread,
    latest: LATEST_SYSTEM_UPDATE,
    markAsRead: () => markSystemUpdateSeen(LATEST_SYSTEM_UPDATE.version),
  };
}

export function openSystemUpdateModal() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SYSTEM_UPDATE_MODAL_EVENT));
}

export function SystemUpdateNotice() {
  const { unread, latest, markAsRead } = useSystemUpdateStatus();
  const { lang } = useAppLanguage();
  const t = SHELL_COPY[lang];
  const [closing, setClosing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const open = () => setModalOpen(true);
    window.addEventListener(OPEN_SYSTEM_UPDATE_MODAL_EVENT, open);
    return () => window.removeEventListener(OPEN_SYSTEM_UPDATE_MODAL_EVENT, open);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  function dismiss() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      markAsRead();
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      markAsRead();
      setClosing(false);
    }, 240);
  }

  return (
    <>
      {unread && (
        <aside
          className={`df-update-banner ${closing ? 'is-closing' : ''}`.trim()}
          role="status"
          aria-live="polite"
          aria-label={t.updateAria}
        >
          <div className="df-update-banner-icon" aria-hidden="true">
            <Sparkles size={17} />
          </div>
          <div className="df-update-banner-copy">
            <div className="df-update-banner-meta">
              <span>{t.updateEyebrow}</span>
              <b>v{latest.version}</b>
              <time>{lang === 'en' ? latest.dateEn : latest.date}</time>
            </div>
            <strong>{lang === 'en' ? latest.titleEn : latest.title}</strong>
            <p>{lang === 'en' ? latest.summaryEn : latest.summary}</p>
          </div>
          <div className="df-update-banner-actions">
            <button
              type="button"
              className="df-update-btn-secondary"
              onClick={() => setModalOpen(true)}
            >
              {t.seeUpdates}
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              className="df-update-btn-primary"
              onClick={dismiss}
            >
              <CheckCircle2 size={14} />
              {t.understood}
            </button>
          </div>
        </aside>
      )}

      {modalOpen && (
        <div
          className="df-update-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="df-update-modal-title"
          onClick={() => setModalOpen(false)}
        >
          <div className="df-update-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span className="df-eyebrow">{t.updatesEyebrow}</span>
                <h2 id="df-update-modal-title">{t.updatesTitle}</h2>
              </div>
              <button
                type="button"
                aria-label={t.closeUpdates}
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="df-update-modal-body">
              {SYSTEM_UPDATES.map((item, idx) => (
                <article
                  key={item.version}
                  className={`df-update-release ${idx === 0 ? 'is-latest' : ''}`}
                >
                  <div className="df-update-release-head">
                    <span className="df-update-version">v{item.version}</span>
                    <time>{lang === 'en' ? item.dateEn : item.date}</time>
                    {idx === 0 && <small>{t.latestTag}</small>}
                  </div>
                  <h3>{lang === 'en' ? item.titleEn : item.title}</h3>
                  <p>{lang === 'en' ? item.summaryEn : item.summary}</p>
                  <ul>
                    {(lang === 'en' ? item.changesEn : item.changes).map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <footer>
              <button
                type="button"
                className="df-button"
                onClick={() => {
                  markAsRead();
                  setModalOpen(false);
                }}
              >
                <CheckCircle2 size={15} />
                {t.markRead}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
