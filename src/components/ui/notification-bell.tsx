"use client";

import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

type NotificationBellProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
};

export function NotificationBell({ count = 0, className = "", ...props }: NotificationBellProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousCount = useRef(count);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const shouldAnimate = count > previousCount.current
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    previousCount.current = count;
    animationRef.current?.cancel();
    if (!button || !shouldAnimate) return;

    animationRef.current = button.animate([
      { transform: "rotate(0deg)" },
      { transform: "rotate(10deg)" },
      { transform: "rotate(-8deg)" },
      { transform: "rotate(5deg)" },
      { transform: "rotate(0deg)" },
    ], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => animationRef.current?.cancel();
  }, [count]);

  const visibleCount = count > 99 ? "99+" : String(count);

  return (
    <button ref={buttonRef} type="button" className={`rare-notification-bell ${className}`.trim()} {...props}>
      <span className="rare-notification-bell-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      </span>
      {count > 0 && <span key={visibleCount} className="rare-notification-bell-count" aria-hidden="true">{visibleCount}</span>}
    </button>
  );
}
