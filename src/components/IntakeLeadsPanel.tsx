"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Copy, ExternalLink, Trash2, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { deleteIntakeLead, loadIntakeLeads, markLeadConverted, type IntakeLead } from "@/lib/intake";

interface Props {
  onClientCreated: () => void;
}

export function IntakeLeadsPanel({ onClientCreated }: Props) {
  const [leads, setLeads] = useState<IntakeLead[]>(() => loadIntakeLeads());
  const [copied, setCopied] = useState(false);

  const pendingCount = leads.filter((l) => !l.convertedClientId).length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/captacion`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const convertLead = (lead: IntakeLead) => {
    const notesParts = [
      `Objetivo: ${lead.goal}`,
      `Experiencia: ${lead.experience}`,
      `Disponibilidad: ${lead.daysPerWeek} días/sem`,
      lead.injuries ? `Restricciones: ${lead.injuries}` : "",
      lead.notes ? `Notas: ${lead.notes}` : "",
    ].filter(Boolean);

    const created = db.saveClient({
      name: lead.name,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      notes: notesParts.join(" · "),
      tags: ["recreativo"],
    });
    setLeads(markLeadConverted(lead.id, created.id));
    onClientCreated();
  };

  return (
    <section className="care-card" aria-labelledby="intake-leads-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="df-eyebrow">CAPTACIÓN DE CLIENTES</p>
          <h3 id="intake-leads-title" className="text-base font-bold mt-0.5 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-brand-600" aria-hidden="true" />
            Cuestionarios recibidos ({pendingCount} pendiente{pendingCount === 1 ? "" : "s"})
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void copyLink()} className="df-button-secondary text-xs">
            <Copy size={13} aria-hidden="true" />
            {copied ? "Enlace copiado" : "Copiar enlace /captacion"}
          </button>
          <Link href="/captacion" target="_blank" rel="noopener noreferrer" className="df-button-secondary text-xs">
            <ExternalLink size={13} aria-hidden="true" />
            Abrir cuestionario
          </Link>
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="text-xs text-gray-500 mt-3">
          Comparte el enlace de tu cuestionario para recibir prospectos y convertirlos en clientes con un clic.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {leads.map((lead) => (
            <article
              key={lead.id}
              className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold dark:text-white">
                  {lead.name}{" "}
                  <span className="text-xs font-normal text-gray-500">· {lead.goal} · {lead.daysPerWeek} d/sem</span>
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}{lead.injuries ? ` · ${lead.injuries}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {lead.convertedClientId ? (
                  <Link href={`/clients/${lead.convertedClientId}`} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                    Ver expediente
                  </Link>
                ) : (
                  <button type="button" onClick={() => convertLead(lead)} className="df-button text-xs py-1.5 px-3">
                    <UserPlus size={13} aria-hidden="true" />
                    Convertir en cliente
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Eliminar cuestionario de ${lead.name}`}
                  onClick={() => setLeads(deleteIntakeLead(lead.id))}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
