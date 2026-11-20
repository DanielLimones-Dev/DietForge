"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Leaf, Send } from "lucide-react";
import { saveIntakeLead } from "@/lib/intake";
import { useWhiteLabel } from "@/lib/white-label";

export default function CaptacionPage() {
  const { brand } = useWhiteLabel();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("Perder grasa");
  const [experience, setExperience] = useState("Intermedio (6 meses - 2 años)");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [injuries, setInjuries] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Por favor escribe tu nombre y correo.");
      return;
    }
    setError("");
    saveIntakeLead({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      goal,
      experience,
      daysPerWeek,
      injuries: injuries.trim(),
      notes: notes.trim(),
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-dvh bg-[var(--clinical-canvas,#f7f8fc)] text-[var(--clinical-text,#121a2d)] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span
              className="w-10 h-10 rounded-xl grid place-content-center text-white overflow-hidden"
              style={{ backgroundColor: brand.accentColor }}
            >
              {brand.logoDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={brand.logoDataUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Leaf size={20} aria-hidden="true" />
              )}
            </span>
            <div>
              <strong className="text-lg font-bold block leading-tight">{brand.brandName}</strong>
              <span className="text-xs text-gray-500">Cuestionario de valoración inicial</span>
            </div>
          </div>
          <Link href="/" className="text-xs text-gray-500 hover:underline">
            Acceso coach
          </Link>
        </header>

        {submitted ? (
          <section className="care-card text-center py-10 px-6">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600 mb-3" aria-hidden="true" />
            <h1 className="text-2xl font-bold">¡Solicitud enviada!</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-md mx-auto">
              Gracias, <strong>{name}</strong>. Tu coach recibió tus respuestas y se pondrá en contacto contigo para iniciar tu plan.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setName("");
                setEmail("");
                setPhone("");
                setInjuries("");
                setNotes("");
              }}
              className="df-button-secondary mt-6"
            >
              Enviar otro cuestionario
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="care-card space-y-4">
            <div>
              <p className="df-eyebrow">NUEVO INGRESO</p>
              <h1 className="text-2xl font-bold mt-1">Cuéntame sobre tu objetivo</h1>
              <p className="text-sm text-gray-500 mt-1">
                Completa este breve cuestionario para diseñar tu plan de nutrición y entrenamiento.
              </p>
            </div>

            {error && <p role="alert" className="care-notice">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label htmlFor="intake-name" className="block text-xs font-semibold text-gray-600">
                Nombre completo *
                <input
                  id="intake-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="df-input mt-1"
                />
              </label>

              <label htmlFor="intake-email" className="block text-xs font-semibold text-gray-600">
                Correo electrónico *
                <input
                  id="intake-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="df-input mt-1"
                />
              </label>

              <label htmlFor="intake-phone" className="block text-xs font-semibold text-gray-600">
                WhatsApp / Teléfono
                <input
                  id="intake-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. +52 871 000 0000"
                  className="df-input mt-1"
                />
              </label>

              <label htmlFor="intake-goal" className="block text-xs font-semibold text-gray-600">
                Objetivo principal
                <select
                  id="intake-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="df-input mt-1"
                >
                  <option value="Perder grasa">Perder grasa</option>
                  <option value="Ganar músculo">Ganar masa muscular</option>
                  <option value="Recomposición">Recomposición corporal</option>
                  <option value="Competencia">Preparación / Competencia</option>
                  <option value="Salud y energía">Salud y rendimiento</option>
                </select>
              </label>

              <label htmlFor="intake-exp" className="block text-xs font-semibold text-gray-600">
                Experiencia entrenando
                <select
                  id="intake-exp"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="df-input mt-1"
                >
                  <option value="Principiante (< 6 meses)">Principiante (&lt; 6 meses)</option>
                  <option value="Intermedio (6 meses - 2 años)">Intermedio (6 meses - 2 años)</option>
                  <option value="Avanzado (+2 años)">Avanzado (+2 años)</option>
                </select>
              </label>

              <label htmlFor="intake-days" className="block text-xs font-semibold text-gray-600">
                Días disponibles por semana
                <input
                  id="intake-days"
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 3)))}
                  className="df-input mt-1"
                />
              </label>
            </div>

            <label htmlFor="intake-injuries" className="block text-xs font-semibold text-gray-600">
              Lesiones, alergias o restricciones alimentarias
              <input
                id="intake-injuries"
                type="text"
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="Ej. Molestia en hombro derecho, intolerancia a la lactosa"
                className="df-input mt-1"
              />
            </label>

            <label htmlFor="intake-notes" className="block text-xs font-semibold text-gray-600">
              ¿Qué te gustaría lograr en los próximos 90 días?
              <textarea
                id="intake-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Horarios, equipo disponible, hábitos actuales…"
                className="df-input mt-1"
              />
            </label>

            <button type="submit" className="df-button w-full justify-center">
              <Send size={15} aria-hidden="true" />
              Enviar cuestionario
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
