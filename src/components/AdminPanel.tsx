"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ShieldCheck, Users, Clock, Plus, RefreshCw, Search, Trash2,
  AlertTriangle, CheckCircle2, PauseCircle, X, SlidersHorizontal, History as HistoryIcon, ExternalLink, Copy
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { db, retryCloudSave } from "@/lib/db";
import { grantPortal, memberships, type PortalMembership } from "@/lib/client-portal";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { revealFocusedCascade } from "@/lib/page-cascade";
import type { Client } from "@/types";

type Coach = {
  email: string;
  user_id: string | null;
  is_admin: boolean;
  suspended: boolean;
  confirmed: boolean;
  expires_at: string | null;
  trial_started_at: string | null;
  clients: number;
  plans: number;
};

type AuditEntry = {
  id: number;
  email: string;
  action: string;
  months: number | null;
  note: string;
  created_at: string;
};

type StatusFilter = "all" | "active" | "pending" | "attention";
type AuditFilter = "all" | "renew" | "suspend" | "delete";

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    : "Sin periodo";

function effectiveUntil(c: Coach): string | null {
  return (
    c.expires_at ??
    (c.trial_started_at ? new Date(Date.parse(c.trial_started_at) + 15 * 86400000).toISOString() : null)
  );
}

function state(c: Coach) {
  if (c.is_admin) return "Administrador";
  if (c.suspended) return "Suspendido";
  const until = effectiveUntil(c);
  return until ? (Date.parse(until) > Date.now() ? "Activo" : "Vencido") : "Pendiente";
}

function relativeDaysLabel(c: Coach): { text: string; urgent: boolean } | null {
  if (c.is_admin) return null;
  const until = effectiveUntil(c);
  if (!until) return null;
  const diffDays = Math.ceil((Date.parse(until) - Date.now()) / 86400000);
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return { text: `Venció hace ${abs} ${abs === 1 ? "día" : "días"}`, urgent: true };
  }
  if (diffDays === 0) return { text: "Vence hoy", urgent: true };
  if (diffDays <= 7) return { text: `En ${diffDays} ${diffDays === 1 ? "día" : "días"}`, urgent: true };
  return { text: `En ${diffDays} días`, urgent: false };
}

function statusBadgeClass(s: string) {
  if (s === "Administrador") return "admin-status-badge is-admin";
  if (s === "Activo") return "admin-status-badge is-active";
  if (s === "Vencido" || s === "Suspendido") return "admin-status-badge is-danger";
  return "admin-status-badge is-pending";
}

export function AdminPanel() {
  const { status } = useSubscription();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [adminSection, setAdminSection] = useState<"coaches" | "portal_clients">("coaches");
  const [portalClients, setPortalClients] = useState<Client[]>(() => db.getClients());
  const [portalMemberships, setPortalMemberships] = useState<PortalMembership[]>([]);
  const [portalOwnerId, setPortalOwnerId] = useState<string>("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientAccessFilter, setClientAccessFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [clientEmailDrafts, setClientEmailDrafts] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Coach | null>(null);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [enteringEmail, setEnteringEmail] = useState("");
  const [removingEmail, setRemovingEmail] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);
  const rowAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadPortalClients = useCallback(async () => {
    setPortalClients(db.getClients());
    try {
      const [{ data }, rows] = await Promise.all([supabase.auth.getUser(), memberships()]);
      if (data.user?.id) setPortalOwnerId(data.user.id);
      setPortalMemberships(rows);
    } catch {
      // Ignore transient membership read failure.
    }
  }, []);

  const togglePortalAccess = async (client: Client, nextEnabled: boolean) => {
    const targetEmail = (clientEmailDrafts[client.id] ?? client.email ?? "").trim().toLowerCase();
    if (!targetEmail) {
      setError(`Ingresa un correo para habilitar el portal de ${client.name}.`);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (targetEmail !== (client.email ?? "").trim().toLowerCase()) {
        db.updateClient(client.id, { email: targetEmail });
      }
      await retryCloudSave();
      await grantPortal(client.id, targetEmail, nextEnabled);
      await reloadPortalClients();
      setNotice(
        nextEnabled
          ? `Acceso al portal habilitado para ${client.name} (${targetEmail}).`
          : `Acceso al portal revocado para ${client.name}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el acceso del cliente.");
    } finally {
      setBusy(false);
    }
  };

  const reload = useCallback(async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc("dietforge_admin_list");
      if (rpcError) throw rpcError;
      setCoaches(data.coaches);
      setHistory(data.history);
      await reloadPortalClients();
    } catch {
      setError("No pudimos cargar el panel. Vuelve a intentar.");
    } finally {
      setLoading(false);
    }
  }, [reloadPortalClients]);

  useEffect(() => {
    if (!status.isAdmin) return;
    let live = true;
    void supabase.rpc("dietforge_admin_list").then(({ data, error: rpcError }) => {
      if (!live) return;
      if (rpcError) setError("No pudimos cargar el panel. Vuelve a intentar.");
      else {
        setCoaches(data.coaches);
        setHistory(data.history);
      }
      setLoading(false);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (live && data.user?.id) setPortalOwnerId(data.user.id);
    });
    void memberships()
      .then((rows) => {
        if (live) setPortalMemberships(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [status.isAdmin]);

  useEffect(() => () => {
    if (rowAnimationTimer.current) clearTimeout(rowAnimationTimer.current);
  }, []);

  function open(coach: Coach | null) {
    setSelected(coach);
    setAdding(!coach);
    setEmail(coach?.email ?? "");
    setMonths(1);
    setNote("");
    setConfirmingDelete(false);
    setDeleteConfirmation("");
    setError("");
    setNotice("");
    request.current = null;
  }

  function closeEditor() {
    setAdding(false);
    setSelected(null);
    setConfirmingDelete(false);
    setDeleteConfirmation("");
  }

  async function save(action: "renew" | "suspend" | "resume") {
    setBusy(true);
    setError("");
    setNotice("");
    const normalized = email.trim().toLowerCase();
    const payload = JSON.stringify({
      email: normalized,
      action,
      months: action === "renew" ? months : null,
      note: note.trim(),
    });
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    try {
      if (adding) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch("/api/admin/coaches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + session?.access_token,
          },
          body: JSON.stringify({
            email: normalized,
            months,
            note: note.trim(),
            requestId: request.current.id,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        setEnteringEmail(normalized);
        setNotice(
          result.emailSent
            ? `Coach activado. Enviamos a ${normalized} la invitación para validar su correo y crear su contraseña.`
            : "El correo ya estaba registrado. Actualizamos su periodo; puede iniciar sesión o recuperar su contraseña."
        );
      } else {
        const { error: rpcError } = await supabase.rpc("dietforge_admin_set_access", {
          p_email: normalized,
          p_action: action,
          p_months: action === "renew" ? months : null,
          p_note: note.trim(),
          p_request_id: request.current.id,
        });
        if (rpcError) throw Error("No se pudo guardar. Reintenta la misma operación.");
      }
      request.current = null;
      setAdding(false);
      setSelected(null);
      if (!adding) {
        setNotice(
          action === "renew"
            ? "Acceso actualizado. El coach puede iniciar sesión con su contraseña."
            : action === "suspend"
              ? "Acceso suspendido. Los datos se conservan."
              : "Suspensión retirada. Se conserva el vencimiento del periodo."
        );
      }
      await reload();
      if (adding) {
        rowAnimationTimer.current = setTimeout(() => setEnteringEmail(""), 700);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCoach() {
    if (!selected || deleteConfirmation.trim().toLowerCase() !== selected.email) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/coaches", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session?.access_token,
        },
        body: JSON.stringify({ email: selected.email, requestId: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      const removedEmail = selected.email;
      setRemovingEmail(removedEmail);
      setSelected(null);
      setConfirmingDelete(false);
      setDeleteConfirmation("");
      setNotice(`Eliminamos la cuenta y los datos de ${removedEmail}.`);
      const reduceMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : 480));
      setCoaches((current) => current.filter((coach) => coach.email !== removedEmail));
      setRemovingEmail("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  const users = useMemo(() => coaches.filter((c) => !c.is_admin), [coaches]);
  const activeCount = useMemo(() => users.filter((c) => state(c) === "Activo").length, [users]);
  const attentionCount = useMemo(
    () => users.filter((c) => ["Vencido", "Suspendido"].includes(state(c))).length,
    [users]
  );
  const pendingCount = useMemo(() => users.filter((c) => !c.confirmed || state(c) === "Pendiente").length, [users]);

  const filteredCoaches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coaches.filter((c) => {
      if (q && !c.email.toLowerCase().includes(q)) return false;
      const s = state(c);
      if (statusFilter === "active") return s === "Activo";
      if (statusFilter === "attention") return s === "Vencido" || s === "Suspendido";
      if (statusFilter === "pending") return !c.confirmed || s === "Pendiente";
      return true;
    });
  }, [coaches, query, statusFilter]);

  const filteredHistory = useMemo(() => {
    if (auditFilter === "all") return history;
    if (auditFilter === "suspend") return history.filter((h) => h.action === "suspend" || h.action === "resume");
    return history.filter((h) => h.action === auditFilter);
  }, [history, auditFilter]);

  if (!status.isAdmin) {
    return (
      <section className="df-card p-8">
        <ShieldCheck />
        <h1 className="text-2xl font-semibold mt-4">Acceso exclusivo del administrador</h1>
        <p className="df-muted mt-2">Tu cuenta no tiene permisos para administrar la plataforma.</p>
      </section>
    );
  }

  const metrics: Array<{
    key: StatusFilter;
    label: string;
    value: number;
    detail: string;
    icon: typeof Users;
    tone: string;
  }> = [
    {
      key: "all",
      label: "Coaches registrados",
      value: users.filter((c) => c.user_id).length,
      detail: `${users.length} ${users.length === 1 ? "acceso configurado" : "accesos configurados"}`,
      icon: Users,
      tone: "green",
    },
    {
      key: "active",
      label: "Accesos activos",
      value: activeCount,
      detail: "Con periodo vigente",
      icon: ShieldCheck,
      tone: "teal",
    },
    {
      key: "attention",
      label: "Vencidos o suspendidos",
      value: attentionCount,
      detail: attentionCount ? "Requieren revisión" : "Sin alertas pendientes",
      icon: Clock,
      tone: "amber",
    },
    {
      key: "pending",
      label: "Primer acceso pendiente",
      value: pendingCount,
      detail: "Correo por confirmar",
      icon: RefreshCw,
      tone: "blue",
    },
  ];

  return (
    <div className="admin-page" data-page-cascade onFocusCapture={revealFocusedCascade}>
      <header className="admin-header" data-cascade="0">
        <div>
          <span className="admin-master-pill">
            <i />
            Panel maestro de administración
          </span>
          <h1>Gestión de coaches y periodos de acceso</h1>
          <p>Alta de cuentas, renovaciones, suspensiones y auditoría administrativa en un solo control.</p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="df-button-secondary"
            disabled={loading || busy}
            onClick={() => void reload()}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <button type="button" className="df-button" disabled={busy} onClick={() => open(null)}>
            <Plus size={17} />
            Dar de alta coach
          </button>
        </div>
      </header>

      <div className="admin-filter-tabs mb-4" role="tablist" aria-label="Apartados de administración" data-cascade="1">
        <button
          type="button"
          role="tab"
          aria-selected={adminSection === "coaches"}
          onClick={() => setAdminSection("coaches")}
        >
          <span>Coaches y accesos</span>
          <small>{coaches.length}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminSection === "portal_clients"}
          onClick={() => {
            setAdminSection("portal_clients");
            void reloadPortalClients();
          }}
        >
          <span>Clientes del portal (Asesoría)</span>
          <small>{portalClients.length}</small>
        </button>
      </div>

      {adminSection === "portal_clients" ? (
        <section className="admin-directory" data-cascade="2" aria-label="Clientes dados de alta para el portal">
          {(() => {
            const membershipMap = new Map(
              portalMemberships
                .filter((m) => !portalOwnerId || m.owner_id === portalOwnerId)
                .map((m) => [m.client_id, m])
            );
            const enabledCount = portalClients.filter((c) => membershipMap.get(c.id)?.enabled).length;
            const q = clientQuery.trim().toLowerCase();
            const list = portalClients.filter((c) => {
              const m = membershipMap.get(c.id);
              const isEnabled = Boolean(m?.enabled);
              if (clientAccessFilter === "enabled" && !isEnabled) return false;
              if (clientAccessFilter === "disabled" && isEnabled) return false;
              const mail = (m?.email || c.email || "").toLowerCase();
              if (q && !c.name.toLowerCase().includes(q) && !mail.includes(q)) return false;
              return true;
            });

            return (
              <>
                <div className="admin-directory-head">
                  <div>
                    <p className="df-eyebrow">MIS ASESORÍAS</p>
                    <div className="admin-directory-title">
                      <h2>Clientes del portal</h2>
                      <span className="admin-count-pill">
                        {enabledCount} activos de {portalClients.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="admin-search">
                      <Search size={16} />
                      <input
                        aria-label="Buscar cliente del portal"
                        placeholder="Buscar por nombre o correo…"
                        value={clientQuery}
                        onChange={(e) => setClientQuery(e.target.value)}
                      />
                      {clientQuery && (
                        <button type="button" aria-label="Limpiar búsqueda" onClick={() => setClientQuery("")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="df-button-secondary"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/portal`)
                          .then(() => setNotice("Enlace /portal copiado."))
                          .catch(() => {})
                      }
                    >
                      <Copy size={14} />
                      Copiar enlace /portal
                    </button>
                    <Link href="/clients/new" className="df-button">
                      <Plus size={15} />
                      Nuevo cliente
                    </Link>
                  </div>
                </div>

                <div className="admin-filter-tabs" role="tablist" aria-label="Filtrar clientes por estado del portal">
                  {(
                    [
                      ["all", "Todos", portalClients.length],
                      ["enabled", "Portal activo", enabledCount],
                      ["disabled", "Sin acceso", portalClients.length - enabledCount],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      type="button"
                      role="tab"
                      key={key}
                      aria-selected={clientAccessFilter === key}
                      onClick={() => setClientAccessFilter(key)}
                    >
                      <span>{label}</span>
                      <small>{count}</small>
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="df-table admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Modalidad</th>
                        <th>Correo del portal</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => {
                        const membership = membershipMap.get(c.id);
                        const isEnabled = Boolean(membership?.enabled);
                        const currentEmail = clientEmailDrafts[c.id] ?? membership?.email ?? c.email ?? "";
                        return (
                          <tr key={c.id} className="admin-coach-row">
                            <td>
                              <div className="admin-account-cell">
                                <span className="admin-avatar" aria-hidden="true">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div>
                                  <span className="admin-email">{c.name}</span>
                                  <p className="admin-subline">ID #{c.id}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="admin-usage-pill">
                                {c.modality === "online" ? "Online" : "Presencial"}
                              </span>
                            </td>
                            <td>
                              <input
                                type="email"
                                aria-label={`Correo de portal para ${c.name}`}
                                value={currentEmail}
                                onChange={(e) =>
                                  setClientEmailDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                placeholder="cliente@correo.com"
                                className="df-input min-w-[200px]"
                              />
                            </td>
                            <td>
                              <span className={`admin-status-badge ${isEnabled ? "is-active" : "is-pending"}`}>
                                {isEnabled ? "Activo" : "Sin acceso"}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={busy || !currentEmail.trim()}
                                  onClick={() => void togglePortalAccess(c, !isEnabled)}
                                  className="admin-manage-btn"
                                >
                                  {isEnabled ? "Revocar" : "Habilitar portal"}
                                </button>
                                <Link href={`/clients/${c.id}`} className="admin-manage-btn">
                                  <ExternalLink size={13} />
                                  Expediente
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!list.length && (
                  <div className="admin-empty">
                    <p>No hay clientes en este apartado todavía.</p>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      ) : (
        <>
          <div className="admin-metrics" data-cascade="1">
            {metrics.map((m) => {
              const pressed = statusFilter === m.key && m.key !== "all";
              return (
                <button
                  type="button"
                  key={m.label}
                  aria-pressed={statusFilter === m.key}
                  className={`admin-metric metric-${m.tone}${pressed ? " is-active-filter" : ""}`}
                  onClick={() => setStatusFilter((current) => (current === m.key ? "all" : m.key))}
                >
                  <div>
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                    <small>{m.detail}</small>
                  </div>
                  <span>
                    <m.icon size={18} />
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div role="alert" className="admin-alert is-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div role="status" className="admin-alert is-notice">
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          <div className="admin-workspace" data-cascade="2">
        <section className="admin-directory">
          <div className="admin-directory-head">
            <div>
              <p className="df-eyebrow">DIRECTORIO</p>
              <div className="admin-directory-title">
                <h2>Coaches y accesos</h2>
                <span className="admin-count-pill">
                  {filteredCoaches.length} de {coaches.length}
                </span>
              </div>
            </div>
            <div className="admin-search">
              <Search size={16} />
              <input
                aria-label="Buscar coach"
                placeholder="Buscar por correo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="admin-filter-tabs" role="tablist" aria-label="Filtrar coaches por estado">
            {(
              [
                ["all", "Todos", coaches.length],
                ["active", "Activos", activeCount],
                ["pending", "Pendientes", pendingCount],
                ["attention", "Vencidos / Susp.", attentionCount],
              ] as const
            ).map(([key, label, count]) => (
              <button
                type="button"
                role="tab"
                key={key}
                aria-selected={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                <span>{label}</span>
                <small>{count}</small>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="df-table admin-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Clientes / Planes</th>
                  <th>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoaches.map((c) => {
                  const s = state(c);
                  const rel = relativeDaysLabel(c);
                  const isEditing = selected?.email === c.email;
                  return (
                    <tr
                      key={c.email}
                      className={`admin-coach-row ${enteringEmail === c.email ? "is-entering" : ""} ${
                        removingEmail === c.email ? "is-removing" : ""
                      } ${isEditing ? "is-selected" : ""}`}
                    >
                      <td>
                        <div className="admin-account-cell">
                          <span className="admin-avatar" aria-hidden="true">
                            {c.email.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <span className="admin-email">{c.email}</span>
                            <p className="admin-subline">
                              {!c.user_id
                                ? "Pendiente de alta"
                                : c.confirmed
                                  ? "Correo confirmado"
                                  : "Pendiente de primer acceso"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={statusBadgeClass(s)}>{s}</span>
                      </td>
                      <td>
                        <div className="admin-expiry-cell">
                          <span>{c.is_admin ? "Permanente" : formatDate(c.expires_at)}</span>
                          {rel && <small className={rel.urgent ? "is-urgent" : ""}>{rel.text}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="admin-usage-pill">
                          {c.clients} / {c.plans}
                        </span>
                      </td>
                      <td>
                        {!c.is_admin && (
                          <button
                            type="button"
                            className={`admin-manage-btn${isEditing ? " is-active" : ""}`}
                            disabled={busy}
                            onClick={() => open(c)}
                          >
                            <SlidersHorizontal size={13} />
                            {isEditing ? "Editando" : "Gestionar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && (
            <p role="status" className="p-5 df-muted text-sm">
              Actualizando cuentas…
            </p>
          )}
          {!loading && !filteredCoaches.length && (
            <div className="admin-empty">
              <p>No hay cuentas que coincidan con el filtro actual.</p>
              {(query || statusFilter !== "all") && (
                <button
                  type="button"
                  className="df-button-secondary"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                  }}
                >
                  Mostrar todos
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="admin-side">
          {adding || selected ? (
            <section className="admin-editor animate-slide-down" aria-label={adding ? "Dar de alta coach" : "Gestionar acceso"}>
              <div className="admin-editor-head">
                <div>
                  <span className="df-eyebrow">{adding ? "ALTA DE CUENTA" : "CONTROL DE ACCESO"}</span>
                  <h2>{adding ? "Dar de alta coach" : "Gestionar acceso"}</h2>
                </div>
                <button type="button" className="admin-close-btn" aria-label="Cerrar panel" disabled={busy} onClick={closeEditor}>
                  <X size={16} />
                </button>
              </div>
              <p className="admin-editor-desc">
                Registra el periodo pagado. Si sigue activo, se suma al vencimiento; si venció, comienza hoy.
              </p>

              <form
                className="admin-editor-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void save("renew");
                }}
              >
                <fieldset disabled={busy} className="admin-editor-fields">
                  <label className="df-label">
                    Correo del coach
                    <input
                      className="df-input mt-1.5"
                      required
                      type="email"
                      maxLength={254}
                      readOnly={!adding}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="coach@correo.com"
                    />
                  </label>
                  <label className="df-label">
                    Periodo pagado
                    <select
                      className="df-input mt-1.5"
                      value={months}
                      onChange={(e) => setMonths(Number(e.target.value))}
                    >
                      <option value={1}>1 mes</option>
                      <option value={3}>3 meses</option>
                      <option value={12}>1 año</option>
                    </select>
                  </label>
                  <label className="df-label">
                    Referencia o nota (opcional)
                    <input
                      className="df-input mt-1.5"
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ej. transferencia de noviembre"
                    />
                  </label>
                </fieldset>

                {selected && (
                  <div className="admin-selected-summary">
                    <span>Vencimiento actual</span>
                    <strong>{formatDate(selected.expires_at)}</strong>
                    <span className={statusBadgeClass(state(selected))}>{state(selected)}</span>
                  </div>
                )}

                <div className="admin-editor-actions">
                  <button type="submit" disabled={busy} className="df-button">
                    {busy ? "Guardando…" : adding ? "Activar y enviar invitación" : "Registrar pago y renovar"}
                  </button>
                  {selected && (
                    <button
                      type="button"
                      disabled={busy}
                      className="df-button-secondary"
                      onClick={() => void save(selected.suspended ? "resume" : "suspend")}
                    >
                      {selected.suspended ? <CheckCircle2 size={15} /> : <PauseCircle size={15} />}
                      {selected.suspended ? "Retirar suspensión" : "Suspender acceso"}
                    </button>
                  )}
                </div>

                {adding ? (
                  <ol className="admin-steps">
                    <li>
                      <b>1</b>
                      <span>
                        <strong>Das de alta</strong>: autorizas su correo y periodo.
                      </span>
                    </li>
                    <li>
                      <b>2</b>
                      <span>
                        <strong>DietForge invita</strong>: enviamos el enlace a su correo.
                      </span>
                    </li>
                    <li>
                      <b>3</b>
                      <span>
                        <strong>El coach activa</strong>: valida su correo y crea su contraseña.
                      </span>
                    </li>
                  </ol>
                ) : (
                  <p className="admin-editor-hint">Una renovación amplía el acceso y conserva la contraseña actual.</p>
                )}

                {selected && (
                  <div className="admin-danger-zone">
                    {!confirmingDelete ? (
                      <button
                        type="button"
                        className="df-button-danger"
                        disabled={busy}
                        onClick={() => setConfirmingDelete(true)}
                      >
                        <Trash2 size={14} />
                        Eliminar coach permanentemente
                      </button>
                    ) : (
                      <div className="admin-delete-confirm">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>Eliminación permanente</strong>
                          <p>
                            Se borrarán la cuenta, clientes, planes, rutinas y videos. Escribe{" "}
                            <b>{selected.email}</b> para confirmar.
                          </p>
                          <input
                            className="df-input"
                            aria-label="Confirmar correo para eliminar"
                            autoComplete="off"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder={selected.email}
                          />
                          <div>
                            <button
                              type="button"
                              className="df-button-danger"
                              disabled={busy || deleteConfirmation.trim().toLowerCase() !== selected.email}
                              onClick={() => void removeCoach()}
                            >
                              {busy ? "Eliminando…" : "Eliminar definitivamente"}
                            </button>
                            <button
                              type="button"
                              className="df-button-secondary"
                              disabled={busy}
                              onClick={() => {
                                setConfirmingDelete(false);
                                setDeleteConfirmation("");
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </section>
          ) : (
            <section className="admin-placeholder-card">
              <div className="admin-placeholder-icon">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <span className="df-eyebrow">CONTROL RÁPIDO</span>
                <h2>Selecciona una cuenta</h2>
                <p>
                  Pulsa <strong>Gestionar</strong> en cualquier coach para renovar su periodo, suspender el acceso o
                  eliminar la cuenta.
                </p>
              </div>
              <button type="button" className="df-button-secondary" onClick={() => open(null)}>
                <Plus size={15} />
                Nuevo coach
              </button>
            </section>
          )}

          <section className="admin-history">
            <div className="admin-history-head">
              <div>
                <p className="df-eyebrow">AUDITORÍA</p>
                <h2>Historial administrativo</h2>
                <p>Últimos {history.length} movimientos registrados.</p>
              </div>
              <span className="admin-history-badge">
                <HistoryIcon size={13} />
                {filteredHistory.length}
              </span>
            </div>

            <div className="admin-audit-filters" role="group" aria-label="Filtrar historial por tipo">
              {(
                [
                  ["all", "Todo"],
                  ["renew", "Renovaciones"],
                  ["suspend", "Suspensiones"],
                  ["delete", "Eliminaciones"],
                ] as const
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={auditFilter === key}
                  onClick={() => setAuditFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="admin-history-list">
              {filteredHistory.map((h) => (
                <div key={h.id}>
                  <span className={`admin-history-icon ${h.action}`}>
                    {h.action === "delete" ? (
                      <Trash2 size={14} />
                    ) : h.action === "suspend" ? (
                      <PauseCircle size={14} />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </span>
                  <div>
                    <strong>{h.email}</strong>
                    <p>
                      {h.action === "renew"
                        ? "Renovación · " + (h.months === 12 ? "1 año" : h.months + " mes" + (h.months === 1 ? "" : "es"))
                        : h.action === "suspend"
                          ? "Acceso suspendido"
                          : h.action === "delete"
                            ? "Coach eliminado"
                            : "Suspensión retirada"}
                      {h.note ? " · " + h.note : ""}
                    </p>
                  </div>
                  <time>{formatDate(h.created_at)}</time>
                </div>
              ))}
              {!filteredHistory.length && (
                <p className="df-muted text-xs py-5 text-center">
                  {history.length
                    ? "No hay movimientos de este tipo."
                    : "Los movimientos aparecerán aquí al registrar el primer cambio."}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
        </>
      )}
    </div>
  );
}
