"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

type DeleteIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  stopPropagation?: boolean;
};

export function DeleteIconButton({ label, className = "", stopPropagation = false, onClick, ...props }: DeleteIconButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) event.stopPropagation();
    onClick?.(event);
  };

  return (
    <button type="button" aria-label={label} title={label} className={`rare-delete-icon ${className}`.trim()} onClick={handleClick} {...props}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g className="rare-delete-icon-lid">
          <path d="M8 6V4h8v2" />
          <path d="M4.5 7h15" />
        </g>
        <path d="M6.5 7 7.4 20h9.2l.9-13" />
        <path d="M10 10.5v6M14 10.5v6" />
      </svg>
    </button>
  );
}
