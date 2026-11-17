"use client";

import Link from "next/link";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Contexto visible: el registro del portal y la activación del coach redactan igual. */
  label?: string;
}

export function PrivacyConsentField({ checked, onChange, disabled, id = "privacy-consent", label = "Acepto el aviso de privacidad" }: Props) {
  return (
    <div className="privacy-consent">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        required
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>
        {label} y el tratamiento de mis datos personales para las finalidades descritas.
      </label>
      <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="privacy-consent-link">
        Leer el aviso de privacidad
      </Link>
      <small id={`${id}-help`}>
        Guardamos la fecha, la hora y la versión del aviso aceptado como evidencia de tu consentimiento. Sin aceptarlo
        no se crea la cuenta.
      </small>
    </div>
  );
}
