import { useState, type FormEvent } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { STRIPE_PAYMENT_LINK, daysUntilExpiry, getTrialStart } from "@/lib/subscription";
import { openExternal } from "@/lib/openExternal";

export function SubscriptionPage({ offline }: { offline?: boolean }) {
  const { email, status, loading, trialActive, trialDaysLeft, trialEndDate, setEmail, refresh, logout, startTrial } = useSubscription();
  const [inputEmail, setInputEmail] = useState(email);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    setSubmitting(true);
    setEmail(inputEmail.trim().toLowerCase());
    await refresh();
    setSubmitting(false);
  };

  const daysLeft = daysUntilExpiry(status.expiresAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">DietForge</h1>
          <p className="text-gray-400 mt-1">Plataforma de nutrición deportiva</p>
        </div>

        <div className="bg-gradient-to-b from-gray-800/80 to-gray-800/50 rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          {!email ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="uppercase tracking-wider text-xs text-gray-400 font-semibold">
                  Tu correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-600/50 text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold shadow-lg hover:shadow-xl active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {submitting ? "Verificando..." : "Ingresar"}
              </button>
            </form>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 mt-4">Verificando suscripción...</p>
            </div>
          ) : status.active ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Suscripción activa</h2>
              {status.expiresAt && (
                <p className="text-gray-400 text-sm">
                  Vence en {daysLeft} día{daysLeft !== 1 ? "s" : ""}
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold shadow-lg hover:shadow-xl active:scale-[0.97] transition-all"
              >
                Ir a la aplicación
              </button>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              {offline && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                  Sin conexión a internet. Conéctate para verificar tu suscripción.
                </div>
              )}
              <h2 className="text-xl font-bold text-white">Suscripción requerida</h2>
              <p className="text-gray-400 text-sm">
                {status.expiresAt
                  ? `Tu suscripción venció hace ${Math.abs(daysLeft)} días. `
                  : trialActive
                    ? `Te quedan ${trialDaysLeft} día${trialDaysLeft !== 1 ? "s" : ""} de prueba. `
                    : "No tienes una suscripción activa. "}
                {!trialActive && "Adquiere DietForge Pro o prueba gratis."}
              </p>
              {!getTrialStart() ? (
                <button onClick={() => { startTrial(); }}
                  className="block w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl active:scale-[0.97] transition-all text-center">
                  Prueba 15 días gratis
                </button>
              ) : trialActive && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                  {trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""} restantes de prueba
                </div>
              )}
              {STRIPE_PAYMENT_LINK && (
                <button onClick={() => openExternal(STRIPE_PAYMENT_LINK + "?prefilled_email=" + encodeURIComponent(email))}
                  className="block w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold shadow-lg hover:shadow-xl active:scale-[0.97] transition-all text-center"
                >
                  Suscribirme — $500 MXN/mes
                </button>
              )}
              <button
                onClick={refresh}
                className="w-full py-2.5 rounded-xl bg-gray-700/50 text-gray-300 font-medium hover:bg-gray-700 active:scale-[0.97] transition-all"
              >
                Verificar de nuevo
              </button>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                Usar otro correo
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Al usar DietForge aceptas nuestros términos y condiciones.
          Datos almacenados localmente con período de gracia de 7 días.
        </p>
      </div>
    </div>
  );
}
