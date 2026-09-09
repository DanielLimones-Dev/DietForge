"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/db";
import { PREP_TYPES } from "@/types";

export function ClientForm() {
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();
  const isEdit = !!id;

  const [form, setForm] = useState(() => {
    if (id) {
      const client = db.getClient(Number(id));
      if (client) return { name: client.name, email: client.email || "", phone: client.phone || "", notes: client.notes || "", prep_type: client.prep_type || "", check_in_interval_days: client.check_in_interval_days || 7 };
    }
    return { name: "", email: "", phone: "", notes: "", prep_type: "", check_in_interval_days: 7 };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEdit) {
      db.updateClient(Number(id), form);
      router.push(`/clients/${id}`);
    } else {
      const c = db.saveClient(form);
      router.push(`/clients/${c.id}?openCalc=1`);
    }
  };

  return (
    <div className="client-form-page">
      <div className="client-form-hero">
        <span>Expediente clínico</span>
      <h2>
        {isEdit ? "Editar Cliente" : "Nuevo Cliente"}
      </h2>
        <p>{isEdit ? "Actualiza los datos y el ritmo de seguimiento." : "Registra los datos base para comenzar su planificación."}</p>
      </div>
      <form onSubmit={handleSubmit} className="client-form-card">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Nombre *</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Correo de contacto (opcional)</label>
          <input
            type="email"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">No crea una cuenta. Después puedes habilitar su acceso al portal desde el expediente del cliente.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Teléfono</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Tipo de preparación</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setForm({ ...form, prep_type: "" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${!form.prep_type ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
              Sin tipo
            </button>
            {PREP_TYPES.map((pt) => (
              <button key={pt.value} type="button" onClick={() => setForm({ ...form, prep_type: form.prep_type === pt.value ? "" : pt.value })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.prep_type === pt.value ? `${pt.color} text-white border-transparent shadow-sm` : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                {pt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Periodo de chequeo</label>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30].map((days) => (
              <button key={days} type="button" onClick={() => setForm({ ...form, check_in_interval_days: days })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.check_in_interval_days === days ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                {days === 7 ? "Semanal" : days === 14 ? "Cada 2 semanas" : "Mensual"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Notas</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 active:scale-[0.97] transition-all shadow-sm"
          >
            {isEdit ? "Guardar Cambios" : "Crear Cliente"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.97] transition-all"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
