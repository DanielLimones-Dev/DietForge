import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Apple, FileText, TrendingUp, ArrowRight, Sparkles, BarChart3, LayoutDashboard, HardDrive } from "lucide-react";
import { db, checkStorageQuota, QUOTA_WARNING_KEY } from "@/lib/db";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { STRIPE_PAYMENT_LINK_MONTHLY, daysUntilExpiry, clearStoredEmail } from "@/lib/subscription";
import { openExternal } from "@/lib/openExternal";

const gradients: Record<string, string> = {
  Clientes: "from-blue-500 to-cyan-500",
  Alimentos: "from-green-500 to-emerald-500",
  Planes: "from-purple-500 to-violet-500",
  Calculadora: "from-orange-500 to-amber-500",
  Coach: "from-red-500 to-pink-500",
};

const iconBg: Record<string, string> = {
  Clientes: "bg-blue-100 dark:bg-blue-900/30",
  Alimentos: "bg-green-100 dark:bg-green-900/30",
  Planes: "bg-purple-100 dark:bg-purple-900/30",
  Calculadora: "bg-orange-100 dark:bg-orange-900/30",
  Coach: "bg-red-100 dark:bg-red-900/30",
};

const iconColor: Record<string, string> = {
  Clientes: "text-blue-600 dark:text-blue-400",
  Alimentos: "text-green-600 dark:text-green-400",
  Planes: "text-purple-600 dark:text-purple-400",
  Calculadora: "text-orange-600 dark:text-orange-400",
  Coach: "text-red-600 dark:text-red-400",
};

export function Dashboard() {
  const [stats] = useState(() => db.getStats());
  const { email, status, trialActive, trialDaysLeft } = useSubscription();
  const daysLeft = daysUntilExpiry(status.expiresAt);
  const isExpiring = status.active && daysLeft !== null && daysLeft <= 7;
  const [quota, setQuota] = useState(() => checkStorageQuota());

  useEffect(() => {
    const interval = setInterval(() => setQuota(checkStorageQuota()), 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { label: "Clientes", value: stats.clients, icon: Users, to: "/clients" },
    { label: "Alimentos", value: stats.foods, icon: Apple, to: "/foods" },
    { label: "Planes", value: stats.mealPlans, icon: FileText, to: "/reports" },
    { label: "Calculadora", value: "→", icon: TrendingUp, to: "/calculator" },
    { label: "Coach", value: stats.activeClients, icon: LayoutDashboard, to: "/coach" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Panel principal de control
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="relative group block active:scale-[0.98] transition-transform duration-150"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradients[c.label]} rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${iconBg[c.label]}`}>
                  <c.icon className={`w-5 h-5 ${iconColor[c.label]}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {!quota.ok && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-sm text-amber-700 dark:text-amber-400">
            Almacenamiento casi lleno ({quota.percent.toFixed(0)}%). Reduce el tamaño de las fotos o elimina datos antiguos para evitar pérdida de información.
          </div>
        </div>
      )}

      {email && (
      <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {status.active ? (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${isExpiring ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isExpiring ? <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></> : <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
              </svg>
              {isExpiring ? `Vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}` : `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restantes`}
            </span>
          ) : trialActive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Prueba — {trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""}
            </span>
          ) : (
            <button onClick={() => openExternal(STRIPE_PAYMENT_LINK_MONTHLY + "?prefilled_email=" + encodeURIComponent(email))}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              Suscribirse — $500/mes
            </button>
          )}
          <span className="text-xs text-gray-400">{email} · <button onClick={() => { clearStoredEmail(); window.location.reload(); }} className="hover:text-red-500">salir</button></span>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600" />
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Flujo de trabajo</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Pasos para crear un plan</p>
            </div>
          </div>
          <div>
            {[
              { step: 1, color: "from-blue-500 to-cyan-500", text: "Gestiona tu base de alimentos", desc: "Importa de APIs o agrega manualmente", link: "/foods", linkText: "Ir a alimentos" },
              { step: 2, color: "from-green-500 to-emerald-500", text: "Crea un cliente", desc: "Ingresa sus datos y medidas", link: "/clients", linkText: "Ir a clientes" },
              { step: 3, color: "from-purple-500 to-violet-500", text: "Calcula sus macros", desc: "TMB, TDEE, distribución por comidas", link: "/calculator", linkText: "Ir a calculadora" },
              { step: 4, color: "from-orange-500 to-amber-500", text: "Genera el plan de comidas", desc: "Con alimentos reales y porciones exactas" },
              { step: 5, color: "from-brand-500 to-brand-600", text: "Exporta a PDF", desc: "Entrégalo a tu asesorado" },
            ].map((s, i) => (
              <div key={s.step} className={`flex items-start gap-4 py-4 ${i < 4 ? "border-b border-gray-50 dark:border-gray-800" : ""}`}>
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm`}>
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.text}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.desc}</p>
                </div>
                {s.link && (
                  <Link
                    to={s.link}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500 dark:hover:text-white transition-all active:scale-[0.97]"
                  >
                    {s.linkText}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Acceso rápido</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Secciones principales</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              { to: "/clients", label: "Gestionar clientes", icon: Users },
              { to: "/calculator", label: "Calculadora de macros", icon: TrendingUp },
              { to: "/coach", label: "Panel del coach", icon: LayoutDashboard },
              { to: "/reports", label: "Reportes", icon: BarChart3 },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <l.icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{l.label}</span>
                <ArrowRight className="w-4 h-4 ml-auto text-gray-300 dark:text-gray-600 group-hover:text-brand-500 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
