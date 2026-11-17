'use client';

import { useEffect, useRef, useState } from 'react';
import { checkinPhotoUrl } from '@/lib/checkin-media';
import { portalCheckInPhotoPath } from '@/lib/portal-checkin';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Imported photos keep the private storage path instead of a short-lived signed URL.
 * Data URLs captured by the coach keep rendering directly.
 */
export function CheckInPhoto({ src, alt, className }: Props) {
  const privatePath = portalCheckInPhotoPath.test(src);
  const [url, setUrl] = useState(privatePath ? '' : src);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);

  useEffect(() => {
    if (!privatePath) return;
    let active = true;
    checkinPhotoUrl(src)
      .then((value) => { if (active) setUrl(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [privatePath, src]);

  if (failed) return <span className="checkin-photo-fallback">Foto no disponible</span>;
  if (!url) return <span className="checkin-photo-fallback" aria-busy="true">Cargando foto…</span>;

  return (
    // Private signed URLs and user data URLs must bypass Next.js image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (retried.current) { setFailed(true); return; }
        retried.current = true;
        void checkinPhotoUrl(src).then(setUrl).catch(() => setFailed(true));
      }}
    />
  );
}
