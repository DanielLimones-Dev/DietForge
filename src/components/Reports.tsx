import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Users, UserPlus, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

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

  const now = Date.now();
  const monthAgo = new Date(now - 30 * 86400000);
  const weekAgo = new Date(now - 7 * 86400000);

  const newThisMonth = clients.filter((c) => new Date(c.created_at) > monthAgo).length;
  const overdue = clients.filter((c) => c.next_check_in_date && new Date(c.next_check_in_date).getTime() < now).length;
  const checkedThisWeek = clients.filter((c) => {
    const ci = db.getLatestCheckIn(c.id);
    return ci && new Date(ci.date) > weekAgo;
  }).length;
  const withMeas = clients.filter((c) => db.getLatestMeasurement(c.id)).length;

  const clientsByMonth: Record<string, number> = {};
  for (const c of clients) {
    const month = c.created_at.slice(0, 7);
    clientsByMonth[month] = (clientsByMonth[month] || 0) + 1;
  }
  const growthData = Object.entries(clientsByMonth).sort().map(([month, count]) => ({ month, count }));

  const checkinCompliance = clients.filter((c) => {
    const ci = db.getLatestCheckIn(c.id);
    return ci && db.getLatestMeasurement(c.id);
  }).length;
  const compliancePct = clients.length ? Math.round((checkinCompliance / clients.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          Panel del Coach
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Visión general del progreso de tus clientes
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative group active:scale-[0.98] transition-transform duration-150">
          <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{clients.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Total Clientes</p>
          </div>
        </div>
        <div className="relative group active:scale-[0.98] transition-transform duration-150">
          <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{newThisMonth}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Nuevos este mes</p>
          </div>
        </div>
        <div className="relative group active:scale-[0.98] transition-transform duration-150">
          <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{checkedThisWeek}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Check-ins esta semana</p>
          </div>
        </div>
        <div className="relative group active:scale-[0.98] transition-transform duration-150">
          <div className="relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{overdue}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Check-ins vencidos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Crecimiento de Clientes</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Altas por mes</p>
            </div>
            {growthData.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                +{Math.round((clients.length - (clients.length - newThisMonth)) / Math.max(1, clients.length - newThisMonth) * 100)}%
              </div>
            )}
          </div>
          {growthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={growthData} barCategoryGap="20%">
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', className: 'dark:fill-gray-800' }} />
                <Bar dataKey="count" fill="url(#growthGradient)" radius={[6, 6, 0, 0]} maxBarSize={48} name="Nuevos clientes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-600">
              <p className="text-sm">Sin clientes aún</p>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-500" />
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Estado de Clientes</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Resumen de actividad</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Con medición</p>
                  <p className="text-xs text-gray-400">Clientes con datos registrados</p>
                </div>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{withMeas}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Check-in y medición</p>
                  <p className="text-xs text-gray-400">Clientes con ambos registros</p>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{checkinCompliance}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Vencidos</p>
                  <p className="text-xs text-gray-400">Check-ins atrasados</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{overdue}</span>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Tasa de cumplimiento</p>
                <span className="text-lg font-bold text-brand-600">{compliancePct}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500" style={{ width: `${compliancePct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Estado de Clientes</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Resumen por cliente</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 dark:text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-center">Último peso</th>
                <th className="px-4 py-3 text-center">Último check-in</th>
                <th className="px-4 py-3 text-center">Próximo</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const m = db.getLatestMeasurement(c.id);
                const ci = db.getLatestCheckIn(c.id);
                const overdue = c.next_check_in_date && new Date(c.next_check_in_date).getTime() < now;
                return (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td className="px-4 py-3 font-medium dark:text-white">{c.name}</td>
                    <td className="px-4 py-3 text-center dark:text-gray-300">{m ? `${m.weight} kg` : "—"}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">{ci ? new Date(ci.date).toLocaleDateString("es-MX") : "—"}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">{c.next_check_in_date ? new Date(c.next_check_in_date).toLocaleDateString("es-MX") : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {!m ? (
                        <span className="text-xs text-gray-400">Sin datos</span>
                      ) : overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" /> Vencido
                        </span>
                      ) : ci && new Date(ci.date) > weekAgo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Al día
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
