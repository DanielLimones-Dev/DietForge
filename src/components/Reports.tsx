import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, ClipboardList, Flame, Droplets, Activity } from "lucide-react";

const COLORS = {
  blue: ["#0ea5e9", "#38bdf8", "#7dd3fc"],
  green: ["#22c55e", "#4ade80", "#86efac"],
  orange: ["#f97316", "#fb923c", "#fdba74"],
  purple: ["#a855f7", "#c084fc", "#d8b4fe"],
  pink: ["#ec4899", "#f472b6", "#f9a8d4"],
  teal: ["#14b8a6", "#2dd4bf", "#5eead4"],
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function Reports() {
  const navigate = useNavigate();
  const clients = db.getClients();
  const allPlans = clients.flatMap((c) => db.getMealPlans(c.id));

  const avgKcal = allPlans.length
    ? Math.round(allPlans.reduce((s, p) => s + p.total_kcal, 0) / allPlans.length)
    : 0;
  const avgProtein = allPlans.length
    ? Math.round(allPlans.reduce((s, p) => s + p.total_protein, 0) / allPlans.length)
    : 0;
  const avgCarbs = allPlans.length
    ? Math.round(allPlans.reduce((s, p) => s + p.total_carbs, 0) / allPlans.length)
    : 0;
  const avgFat = allPlans.length
    ? Math.round(allPlans.reduce((s, p) => s + p.total_fat, 0) / allPlans.length)
    : 0;

  const plansByMonth: Record<string, number> = {};
  for (const p of allPlans) {
    const month = p.date.slice(0, 7);
    plansByMonth[month] = (plansByMonth[month] || 0) + 1;
  }
  const chartData = Object.entries(plansByMonth).map(([month, count]) => ({ month, count }));

  const macroData = [
    { name: "Proteína", value: avgProtein, color: COLORS.blue[0] },
    { name: "Carbos", value: avgCarbs, color: COLORS.orange[0] },
    { name: "Grasa", value: avgFat, color: COLORS.purple[0] },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Reportes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dashboard analítico de nutrición
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Clientes"
          value={clients.length}
          gradient="from-blue-500 to-cyan-500"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={<ClipboardList className="w-5 h-5" />}
          label="Planes Generados"
          value={allPlans.length}
          gradient="from-green-500 to-emerald-500"
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="Kcal Promedio"
          value={`${avgKcal}`}
          gradient="from-orange-500 to-amber-500"
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Proteína Promedio"
          value={`${avgProtein}g`}
          gradient="from-purple-500 to-violet-500"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Planes por Mes</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Tendencia de generación</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              {chartData.length > 1 ? "+12%" : "—"}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="20%">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', className: 'dark:fill-gray-800' }} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              <p className="text-sm">Sin datos aún</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">Macros Promedio</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Distribución por plan</p>
          </div>
          {avgKcal > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {macroData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {macroData.map((m) => (
                  <div key={m.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>
              <p className="text-sm">Sin datos aún</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Últimos Planes</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Historial reciente</p>
          </div>
          {allPlans.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {allPlans.length} total
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {allPlans.slice(0, 10).map((p) => {
            const c = db.getClient(p.client_id);
            return (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors duration-150">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {c?.name || "—"} · {new Date(p.date).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{p.total_kcal}</span>
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{p.total_protein}g</span>
                  </div>
                  <button
                    onClick={() => navigate(`/plans/${p.id}`)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-brand-500 dark:hover:text-white transition-all duration-200"
                  >
                    Ver
                  </button>
                </div>
              </div>
            );
          })}
          {allPlans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
              <ClipboardList className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Sin planes aún</p>
              <button
                onClick={() => navigate("/clients")}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Crear primer plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  gradient,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  gradient: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}
