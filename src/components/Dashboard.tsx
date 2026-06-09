import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Apple, FileText, TrendingUp, ArrowRight, Sparkles, BarChart3 } from "lucide-react";
import { db } from "@/lib/db";

const gradients: Record<string, string> = {
  Clientes: "from-blue-500 to-cyan-500",
  Alimentos: "from-green-500 to-emerald-500",
  Planes: "from-purple-500 to-violet-500",
  Calculadora: "from-orange-500 to-amber-500",
};

const iconBg: Record<string, string> = {
  Clientes: "bg-blue-100 dark:bg-blue-900/30",
  Alimentos: "bg-green-100 dark:bg-green-900/30",
  Planes: "bg-purple-100 dark:bg-purple-900/30",
  Calculadora: "bg-orange-100 dark:bg-orange-900/30",
};

const iconColor: Record<string, string> = {
  Clientes: "text-blue-600 dark:text-blue-400",
  Alimentos: "text-green-600 dark:text-green-400",
  Planes: "text-purple-600 dark:text-purple-400",
  Calculadora: "text-orange-600 dark:text-orange-400",
};

export function Dashboard() {
  const [stats] = useState(() => db.getStats());

  const cards = [
    { label: "Clientes", value: stats.clients, icon: Users, to: "/clients" },
    { label: "Alimentos", value: stats.foods, icon: Apple, to: "/foods" },
    { label: "Planes", value: stats.mealPlans, icon: FileText, to: "/reports" },
    { label: "Calculadora", value: "→", icon: TrendingUp, to: "/calculator" },
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
            className="relative group block"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradients[c.label]} rounded-2xl opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${iconBg[c.label]}`}>
                  <c.icon className={`w-5 h-5 ${iconColor[c.label]}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{c.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{c.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Flujo de trabajo</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Pasos para crear un plan</p>
            </div>
          </div>
          <div className="space-y-0">
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
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500 dark:hover:text-white transition-all duration-200"
                  >
                    {s.linkText}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Resumen Rápido</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Vista general del sistema</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Clientes", value: stats.clients, sub: "Registrados", gradient: "from-blue-500 to-cyan-500" },
              { label: "Alimentos", value: stats.foods, sub: "En base de datos", gradient: "from-green-500 to-emerald-500" },
              { label: "Planes", value: stats.mealPlans, sub: "Generados", gradient: "from-purple-500 to-violet-500" },
            ].map((item) => (
              <div key={item.label} className="relative p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${item.gradient} rounded-t-xl`} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{item.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            ))}
            <div className="relative p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-xl" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {stats.clients > 0 ? Math.round(stats.mealPlans / stats.clients) : 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Planes/Cliente</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Promedio</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
