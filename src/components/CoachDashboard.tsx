import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { calculateWeightTrend } from "@/lib/trends";
import { Users, TrendingUp, AlertTriangle, Calendar, FileText, Tags, X, Check, Search, Plus } from "lucide-react";
import type { Client } from "@/types";
import { TAGS_LIST } from "@/types";

export function CoachDashboard() {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [clients, setClients] = useState<Client[]>(() => db.getClients());
  const [panelKey, setPanelKey] = useState(0);
  const stats = db.getStats();

  const clientsWithStatus = clients.map((c) => {
    const latest = db.getLatestMeasurement(c.id);
    const checkins = db.getCheckIns(c.id);
    const trend = calculateWeightTrend(checkins.length > 0 ? checkins : latest ? [latest] : []);
    const lastCheckin = checkins[0];
    const daysSinceCheckin = lastCheckin ? Math.round((now - new Date(lastCheckin.date).getTime()) / 86400000) : null;
    return { client: c, trend, lastCheckin, daysSinceCheckin, hasAlert: daysSinceCheckin !== null && daysSinceCheckin > 7 };
  });

  const activeClients = clientsWithStatus.filter((c) => c.daysSinceCheckin === null || c.daysSinceCheckin <= 14);
  const atRiskClients = clientsWithStatus.filter((c) => c.hasAlert);

  // --- Tag management ---
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [activeTag, setActiveTag] = useState<string | false>(false);
  const [tagSearch, setTagSearch] = useState("");

  const toggleClientTag = (client: Client, tag: string) => {
    if (!TAGS_LIST.includes(tag as typeof TAGS_LIST[number])) return;
    const tags = client.tags ? [...client.tags] : [];
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    db.updateClient(client.id, { tags });
    setClients(db.getClients());
    setPanelKey(n => n + 1);
  };

  const allClients = clients.map((c) => ({
    ...c,
    tags: c.tags || [],
  }));

  const tagPanelClients = tagSearch
    ? allClients.filter((c) => c.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : allClients;

  const tagFilteredList = activeTag
    ? allClients.filter((c) => c.tags?.includes(activeTag as string))
    : allClients;

  const tagClientsFiltered = tagSearch
    ? tagFilteredList.filter((c) => c.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : tagFilteredList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Panel de Coach
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.activeClients} clientes activos · {activeClients.length} con check-in reciente
          </p>
        </div>
        <button onClick={() => { setShowTagPanel(!showTagPanel); setActiveTag(false); setTagSearch(""); if (!showTagPanel) setPanelKey(n => n + 1); }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.97] shadow-sm ${
            showTagPanel
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}>
          <Tags className="w-4 h-4" />
          Etiquetas
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Clientes", value: stats.clients, icon: Users, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600" },
          { label: "Activos", value: stats.activeClients, icon: TrendingUp, color: "bg-green-100 dark:bg-green-900/30 text-green-600" },
          { label: "En Riesgo", value: atRiskClients.length, icon: AlertTriangle, color: "bg-red-100 dark:bg-red-900/30 text-red-600" },
          { label: "Planes", value: stats.mealPlans, icon: FileText, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600" },
          { label: "Check-ins", value: stats.checkins, icon: Calendar, color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600" },
        ].map((s) => (
          <div key={s.label} className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shadow-sm`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {atRiskClients.length > 0 && (
        <div className="bg-gradient-to-b from-red-50 to-white dark:from-red-900/15 dark:to-gray-900/50 rounded-xl border border-red-200 dark:border-red-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Clientes que requieren atención</h3>
              <p className="text-[10px] text-red-500/70 dark:text-red-400/70">{atRiskClients.length} sin check-in reciente</p>
            </div>
          </div>
          <div className="space-y-2">
            {atRiskClients.map(({ client, daysSinceCheckin }) => (
              <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-sm transition-shadow">
                <span className="text-sm font-medium dark:text-white">{client.name}</span>
                <span className="text-xs text-red-600 dark:text-red-400 font-semibold">{daysSinceCheckin} días sin check-in</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTagPanel && (
        <div key={panelKey} className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm dark:text-white flex items-center gap-2">
              <Tags className="w-4 h-4 text-brand-600" /> Gestionar Etiquetas
            </h3>
            <button onClick={() => setShowTagPanel(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-[0.95]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {TAGS_LIST.map((t) => {
              const count = allClients.filter((c) => c.tags?.includes(t)).length;
              const isActive = activeTag === t;
              return (
                <button key={t + activeTag} type="button" onClick={() => setActiveTag(prev => prev === t ? false : t)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    isActive
                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400"
                  }`}>
                  {t} {count > 0 && <span className="opacity-60">({count})</span>}
                </button>
              );
            })}
            {activeTag && (
              <button key="limpiar" type="button" onClick={() => { setActiveTag(false); setTagSearch(""); }}
                className="text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-1">
                Limpiar
              </button>
            )}
          </div>

          {activeTag && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Click en cliente para asignar/quitar «{activeTag}»
            </p>
          )}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" placeholder="Buscar cliente..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {tagPanelClients.map((c) => {
              const hasTag = activeTag ? c.tags?.includes(activeTag) : false;
              return (
                <div key={c.id} onClick={() => activeTag && toggleClientTag(c, activeTag)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                    activeTag
                      ? hasTag
                        ? "bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-300 dark:border-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/30"
                        : "bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700"
                      : "bg-gray-50 dark:bg-gray-800 border border-transparent"
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeTag && hasTag ? "bg-brand-600 text-white ring-2 ring-brand-600/30" : "bg-gradient-to-br from-brand-500 to-brand-600 text-white"
                    }`}>
                      {activeTag && hasTag ? <Check className="w-4 h-4" /> : c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${activeTag && hasTag ? "text-brand-700 dark:text-brand-300" : "dark:text-white"}`}>
                        {c.name}
                      </p>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {(c.tags || []).map((t) => (
                          <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            activeTag === t
                              ? "bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                          }`}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {activeTag && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      hasTag
                        ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                    }`}>
                      {hasTag ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {hasTag ? "Quitar" : "Asignar"}
                    </span>
                  )}
                </div>
              );
            })}
            {tagPanelClients.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                {tagSearch ? "Sin resultados" : "No hay clientes registrados"}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm dark:text-white">Todos los Clientes</h3>
            <span className="text-xs text-gray-400 font-medium bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">{clients.length} total</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setActiveTag(false)}
              className={`whitespace-nowrap px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
                !activeTag ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}>
              Todos
            </button>
            {TAGS_LIST.filter((t) => clientsWithStatus.some((c) => (c.client.tags || []).includes(t))).map((t) => (
              <button key={t} onClick={() => setActiveTag(activeTag === t ? false : t)}
                className={`whitespace-nowrap px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
                  activeTag === t ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {clientsWithStatus.filter((c) => !activeTag || (c.client.tags || []).includes(activeTag)).map(({ client, trend, daysSinceCheckin, hasAlert }) => (
            <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  hasAlert ? "bg-red-100 text-red-600" : "bg-gradient-to-br from-brand-500 to-brand-600 text-white"
                }`}>
                  {client.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white">{client.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {daysSinceCheckin !== null ? `${daysSinceCheckin}d sin check-in` : "Sin check-ins"}
                    {trend.weeklyChange !== null && ` · ${(trend.weeklyChange > 0 ? "+" : "")}${trend.weeklyChange?.toFixed(1)} kg/sem`}
                  </p>
                  {(client.tags || []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(client.tags || []).map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {trend.weeklyChange !== null && (
                  <span className={`text-xs font-semibold ${(trend.weeklyChange ?? 0) < 0 ? "text-green-600" : (trend.weeklyChange ?? 0) > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {trend.currentWeight} kg
                  </span>
                )}
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <p className="p-6 text-sm text-gray-400 text-center">No hay clientes registrados</p>
          )}
        </div>
      </div>
    </div>
  );
}
