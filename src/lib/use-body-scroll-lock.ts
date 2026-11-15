'use client';
import {useEffect} from 'react';

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previousRoot = root.style.overflow;
    const previousBody = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = previousRoot;
      document.body.style.overflow = previousBody;
      document.body.style.paddingRight = previousPadding;
    };
  }, [active]);
}
