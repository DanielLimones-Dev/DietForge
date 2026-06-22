import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, ChevronRight, Trash2, Users, Mail, Phone, Layers, Tags, Clock, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import type { Client, Goal } from "@/types";
import { TAGS_LIST } from "@/types";
import { ConfirmDialog } from "./ui";
import { BatchAssign } from "./BatchAssign";

const GOAL_BADGES: Record<Goal, { label: string; classes: string }> = {
  lose_fat: { label: "Déficit", classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  maintain: { label: "Mantenimiento", classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  build_muscle: { label: "Volumen", classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  gain_weight: { label: "Aumento", classes: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

function isOverdue(client: Client): boolean {
  if (!client.next_check_in_date) return true;
  return new Date(client.next_check_in_date).getTime() < Date.now();
}

function OverdueBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
      <AlertTriangle className="w-2.5 h-2.5" />
      Pendiente
    </span>
  );
}

export function ClientList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(() => db.getClients());
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"todos" | "pendientes">("todos");

  const overdueIds = useMemo(() => {
    const set = new Set<number>();
    for (const c of clients) {
      if (isOverdue(c)) set.add(c.id);
    }
    return set;
  }, [clients]);

  const filtered = clients.filter((c) => {
    if (tab === "pendientes" && !overdueIds.has(c.id)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedTag && !(c.tags || []).includes(selectedTag)) return false;
    return true;
  });

  const tagsInUse = useMemo(() =>
    TAGS_LIST.filter((t) => clients.some((c) => (c.tags || []).includes(t))),
  [clients]);

  const handleDelete = (id: number) => {
    db.deleteClient(id);
    setClients(db.getClients());
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Clientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBatch(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
            <Layers className="w-4 h-4" />
            Asignación Masiva
          </button>
          <Link
            to="/clients/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setTab("todos"); setSelectedTag(null); }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all uppercase tracking-wider ${
            tab === "todos" ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
          }`}>
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Todos ({clients.length})
        </button>
        <button onClick={() => setTab("pendientes")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all uppercase tracking-wider ${
            tab === "pendientes" ? "bg-red-600 text-white border-red-600 shadow-sm" : "bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600"
          }`}>
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Pendientes ({overdueIds.size})
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tab === "todos" && tagsInUse.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setSelectedTag(null)}
            className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
              !selectedTag ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
            }`}>
            <Users className="w-3 h-3 inline mr-1" />
            Todos
          </button>
          {tagsInUse.map((t) => {
            const count = clients.filter((c) => (c.tags || []).includes(t)).length;
            return (
              <button key={t} onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
                  selectedTag === t ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}>
                <Tags className="w-3 h-3 inline mr-1" />
                {t} <span className="opacity-60 ml-0.5">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => {
          const overdue = overdueIds.has(c.id);
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/clients/${c.id}`)}
              className={`group bg-white dark:bg-gray-900 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                overdue
                  ? "border-red-200 dark:border-red-900/60 hover:border-red-300 dark:hover:border-red-700 bg-gradient-to-r from-red-50/50 to-white dark:from-red-950/20 dark:to-gray-900"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
              }`}
            >
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm ${
                    overdue
                      ? "bg-gradient-to-br from-red-500 to-red-600"
                      : "bg-gradient-to-br from-brand-500 to-brand-600"
                  }`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {c.name}
                      <GoalBadge clientId={c.id} />
                      {overdue && <OverdueBadge />}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.email && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      )}
                      {!c.email && !c.phone && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {(c.tags || []).map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{t}</span>
                      ))}
                      {c.next_check_in_date && (
                        <span className={`text-[9px] font-medium ${overdue ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                          {overdue ? `Vencido ${daysAgo(c.next_check_in_date)}` : `Próximo: ${formatDate(c.next_check_in_date)}`}
                        </span>
                      )}
                      {!c.next_check_in_date && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">Sin check-ins</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                    className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
          {tab === "pendientes" ? (
            <>
              <Clock className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">No hay clientes pendientes</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1"> Todos al día</p>
            </>
          ) : (
            <>
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">
                {clients.length === 0 ? "No hay clientes aún" : "Sin resultados"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {clients.length === 0 ? "Crea tu primer cliente para empezar" : "Intenta con otro término de búsqueda"}
              </p>
              {clients.length === 0 && (
                <Link
                  to="/clients/new"
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                >
                  Crear primer cliente
                </Link>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar cliente"
        message="¿Eliminar este cliente y todos sus datos? Esta acción no se puede deshacer."
        onConfirm={() => deleteId !== null && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
      {showBatch && <BatchAssign onClose={() => setShowBatch(false)} />}
    </div>
  );
}

function GoalBadge({ clientId }: { clientId: number }) {
  const meas = db.getLatestMeasurement(clientId);
  if (!meas) return null;
  const badge = GOAL_BADGES[meas.goal];
  return (
    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${badge.classes}`}>
      {badge.label}
    </span>
  );
}

function daysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
