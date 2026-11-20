"use client";

import { revealFocusedCascade } from "@/lib/page-cascade";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ChevronRight,
  Trash2,
  Users,
  Mail,
  Phone,
  Layers,
  Tags,
  Clock,
  AlertTriangle,
  Pencil,
  X,
  Dumbbell,
  Heart,
  Stethoscope,
  Flame,
  Trophy,
  Star,
  Laptop,
  Apple,
  Activity,
  Shield,
  Sparkles,
  FolderPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Client, ClientGroup, Goal } from "@/types";
import { TAGS_LIST } from "@/types";
import { ConfirmDialog } from "./ui";
import { BatchAssign } from "./BatchAssign";
import { IntakeLeadsPanel } from "./IntakeLeadsPanel";
import {
  GROUP_COLORS,
  GROUP_ICONS,
  deleteClientGroup,
  getGroupColor,
  loadClientGroups,
  saveClientGroup,
  updateClientGroup,
} from "@/lib/client-groups";

const ICON_COMPONENTS: Record<string, typeof Users> = {
  users: Users,
  stethoscope: Stethoscope,
  heart: Heart,
  dumbbell: Dumbbell,
  laptop: Laptop,
  flame: Flame,
  trophy: Trophy,
  apple: Apple,
  activity: Activity,
  star: Star,
  shield: Shield,
  sparkles: Sparkles,
};

function GroupIcon({ name, className = "w-3.5 h-3.5" }: { name: string; className?: string }) {
  const Icon = ICON_COMPONENTS[name] ?? Users;
  return <Icon className={className} aria-hidden="true" />;
}

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
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(() => db.getClients());
  const [groups, setGroups] = useState<ClientGroup[]>(() => loadClientGroups());
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [tab, setTab] = useState<"todos" | "pendientes">("todos");

  // Group editor modal state
  const [editingGroup, setEditingGroup] = useState<ClientGroup | "new" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState<string>("stethoscope");
  const [groupColor, setGroupColor] = useState<string>("emerald");

  // Per-client quick group assignment popover
  const [assignClientId, setAssignClientId] = useState<number | null>(null);

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
    if (selectedGroupId && !(c.group_ids || []).includes(selectedGroupId)) return false;
    return true;
  });

  const tagsInUse = useMemo(
    () => TAGS_LIST.filter((t) => clients.some((c) => (c.tags || []).includes(t))),
    [clients]
  );

  const handleDelete = (id: number) => {
    db.deleteClient(id);
    setClients(db.getClients());
    setDeleteId(null);
  };

  const openNewGroup = () => {
    setEditingGroup("new");
    setGroupName("");
    setGroupIcon("stethoscope");
    setGroupColor("emerald");
  };

  const openEditGroup = (group: ClientGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupIcon(group.icon);
    setGroupColor(group.color);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = groupName.trim();
    if (!clean) return;
    if (editingGroup === "new") {
      setGroups(saveClientGroup({ name: clean, icon: groupIcon, color: groupColor }));
    } else if (editingGroup) {
      setGroups(updateClientGroup(editingGroup.id, { name: clean, icon: groupIcon, color: groupColor }));
    }
    setEditingGroup(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    const nextGroups = deleteClientGroup(groupId);
    setGroups(nextGroups);
    for (const c of clients) {
      if ((c.group_ids || []).includes(groupId)) {
        db.updateClient(c.id, {
          group_ids: (c.group_ids || []).filter((id) => id !== groupId),
        });
      }
    }
    setClients(db.getClients());
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    setEditingGroup(null);
  };

  const toggleClientGroup = (client: Client, groupId: string) => {
    const current = client.group_ids || [];
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    db.updateClient(client.id, { group_ids: next });
    setClients(db.getClients());
  };

  return (
    <div className="clients-page" data-page-cascade onFocusCapture={revealFocusedCascade}>
      <div className="clients-hero" data-cascade="0">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Clientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowBatch(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Layers className="w-4 h-4" />
            Asignación Masiva
          </button>
          <Link
            href="/clients/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Link>
        </div>
      </div>

      <div data-cascade="1">
        <IntakeLeadsPanel onClientCreated={() => setClients(db.getClients())} />
      </div>

      <div className="clients-tabs" data-cascade="1">
        <button
          type="button"
          onClick={() => {
            setTab("todos");
            setSelectedTag(null);
          }}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all uppercase tracking-wider ${
            tab === "todos"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Todos ({clients.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pendientes")}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all uppercase tracking-wider ${
            tab === "pendientes"
              ? "bg-red-600 text-white border-red-600 shadow-sm"
              : "bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600"
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Pendientes ({overdueIds.size})
        </button>
      </div>

      {/* Agrupaciones personalizadas editables */}
      <div className="flex flex-wrap items-center gap-2" data-cascade="2">
        {groups.map((g) => {
          const color = getGroupColor(g.color);
          const count = clients.filter((c) => (c.group_ids || []).includes(g.id)).length;
          const active = selectedGroupId === g.id;
          return (
            <div key={g.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setSelectedGroupId(active ? null : g.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-l-xl border transition-all ${
                  active
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm"
                    : `${color.bg} ${color.text} ${color.border} hover:brightness-95`
                }`}
              >
                <GroupIcon name={g.icon} className="w-3.5 h-3.5" />
                <span>{g.name}</span>
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
              <button
                type="button"
                onClick={() => openEditGroup(g)}
                aria-label={`Editar grupo ${g.name}`}
                title={`Editar ${g.name}`}
                className={`px-2 py-1.5 text-xs rounded-r-xl border border-l-0 transition-all ${
                  active
                    ? "bg-gray-800 text-gray-200 border-gray-900 dark:bg-gray-200 dark:text-gray-800 dark:border-white"
                    : `${color.bg} ${color.text} ${color.border} hover:brightness-95`
                }`}
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={openNewGroup}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          Nuevo grupo
        </button>
      </div>

      <div className="clients-search" data-cascade="2">
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
          <button
            onClick={() => setSelectedTag(null)}
            className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
              !selectedTag
                ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
            }`}
          >
            <Users className="w-3 h-3 inline mr-1" />
            Todos
          </button>
          {tagsInUse.map((t) => {
            const count = clients.filter((c) => (c.tags || []).includes(t)).length;
            return (
              <button
                key={t}
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all uppercase tracking-wider ${
                  selectedTag === t
                    ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Tags className="w-3 h-3 inline mr-1" />
                {t} <span className="opacity-60 ml-0.5">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="clients-directory" data-cascade="3">
        {filtered.map((c) => {
          const overdue = overdueIds.has(c.id);
          const clientGroups = groups.filter((g) => (c.group_ids || []).includes(g.id));
          const isAssigning = assignClientId === c.id;
          return (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/clients/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/clients/${c.id}`);
                }
              }}
              className={`client-directory-row group ${
                overdue
                  ? "border-red-200 dark:border-red-900/60 hover:border-red-300 dark:hover:border-red-700 bg-gradient-to-r from-red-50/50 to-white dark:from-red-950/20 dark:to-gray-900"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
              }`}
            >
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm ${
                      overdue
                        ? "bg-gradient-to-br from-red-500 to-red-600"
                        : "bg-gradient-to-br from-brand-500 to-brand-600"
                    }`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center flex-wrap gap-1">
                      <span>{c.name}</span>
                      <GoalBadge clientId={c.id} />
                      {overdue && <OverdueBadge />}
                      {clientGroups.map((g) => {
                        const color = getGroupColor(g.color);
                        return (
                          <span
                            key={g.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                          >
                            <GroupIcon name={g.icon} className="w-2.5 h-2.5" />
                            {g.name}
                          </span>
                        );
                      })}
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
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        >
                          {t}
                        </span>
                      ))}
                      {c.next_check_in_date && (
                        <span
                          className={`text-[9px] font-medium ${
                            overdue ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {overdue ? `Vencido ${daysAgo(c.next_check_in_date)}` : `Próximo: ${formatDate(c.next_check_in_date)}`}
                        </span>
                      )}
                      {!c.next_check_in_date && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">Sin check-ins</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {groups.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignClientId(isAssigning ? null : c.id);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                        isAssigning
                          ? "bg-brand-600 text-white border-brand-600"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-500 hover:text-brand-600"
                      }`}
                      title="Asignar a grupos"
                    >
                      Grupos
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Eliminar a ${c.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(c.id);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
              {isAssigning && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="px-3.5 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-1.5"
                >
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1">Asignar grupos:</span>
                  {groups.map((g) => {
                    const active = (c.group_ids || []).includes(g.id);
                    const color = getGroupColor(g.color);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleClientGroup(c, g.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                          active
                            ? "bg-brand-600 text-white border-brand-600"
                            : `${color.bg} ${color.text} ${color.border} opacity-75 hover:opacity-100`
                        }`}
                      >
                        <GroupIcon name={g.icon} className="w-3 h-3" />
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
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
                  href="/clients/new"
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                >
                  Crear primer cliente
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingGroup === "new" ? "Nueva agrupación" : `Editar "${editingGroup.name}"`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                aria-label="Cerrar editor de grupo"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Nombre de la agrupación
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  placeholder="Ej. Clínicos, Online, Hipertrofia, VIP…"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Icono
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {GROUP_ICONS.map((iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setGroupIcon(iconKey)}
                      className={`h-10 rounded-xl border grid place-items-center transition-all ${
                        groupIcon === iconKey
                          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-500"
                      }`}
                    >
                      <GroupIcon name={iconKey} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setGroupColor(c.id)}
                      aria-label={c.label}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        groupColor === c.id ? "scale-110 border-gray-900 dark:border-white" : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                {editingGroup !== "new" ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(editingGroup.id)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Eliminar grupo
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700"
                  >
                    {editingGroup === "new" ? "Crear grupo" : "Guardar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
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
