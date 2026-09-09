"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, FileText, HardDrive, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { db, checkStorageQuota } from "@/lib/db";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { STRIPE_PAYMENT_LINK_MONTHLY, daysUntilExpiry } from "@/lib/subscription";
import { openExternal } from "@/lib/openExternal";
import type { Adherence, Client, MealPlan } from "@/types";

function averageAdherence(values: Adherence[]) {
  if (!values.length) return null;
  const scores = values.map((item) => (item.meals + item.supplements + item.training + item.cardio) / 4);
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function planMacroShare(plans: MealPlan[]) {
  const protein = plans.reduce((sum, plan) => sum + plan.total_protein * 4, 0);
  const carbs = plans.reduce((sum, plan) => sum + plan.total_carbs * 4, 0);
  const fat = plans.reduce((sum, plan) => sum + plan.total_fat * 9, 0);
  const total = protein + carbs + fat;
  return total ? [protein, carbs, fat].map((value) => Math.round(value / total * 100)) : [30, 45, 25];
}

export function Dashboard() {
  const [snapshot] = useState(() => {
    const clients = db.getClients();
    const plans = clients.flatMap((client) => db.getMealPlans(client.id));
    const checkins = clients.flatMap((client) => db.getCheckIns(client.id));
    return { stats: db.getStats(), clients, plans, checkins };
  });
  const { email, status, trialActive, trialDaysLeft, logout } = useSubscription();
  const daysLeft = daysUntilExpiry(status.expiresAt);
  const isExpiring = status.active && daysLeft !== null && daysLeft <= 7;
  const [quota, setQuota] = useState(() => checkStorageQuota());

  useEffect(() => {
    const interval = setInterval(() => setQuota(checkStorageQuota()), 30000);
    return () => clearInterval(interval);
  }, []);

  const recentClients = useMemo(() => [...snapshot.clients].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4), [snapshot.clients]);
  const adherence = averageAdherence(snapshot.checkins.map((item) => item.adherence).filter((item): item is Adherence => Boolean(item)));
  const [proteinShare, carbShare, fatShare] = planMacroShare(snapshot.plans);
  const averageKcal = snapshot.plans.length ? Math.round(snapshot.plans.reduce((sum, plan) => sum + plan.total_kcal, 0) / snapshot.plans.length) : 0;

  const metrics = [
    { label: "Clientes registrados", value: snapshot.stats.clients, detail: `${snapshot.stats.activeClients} activos en 14 días`, icon: Users, tone: "green", href: "/clients" },
    { label: "Adherencia promedio", value: adherence === null ? "—" : `${adherence}%`, detail: adherence === null ? "Sin check-ins evaluados" : "Basada en hábitos registrados", icon: CheckCircle2, tone: "teal", href: "/coach" },
    { label: "Balance calórico", value: averageKcal ? averageKcal.toLocaleString("es-MX") : "—", detail: averageKcal ? "kcal promedio por plan" : "Crea el primer plan", icon: TrendingUp, tone: "blue", href: "/calculator" },
    { label: "Planes nutricionales", value: snapshot.stats.mealPlans, detail: `${snapshot.stats.checkins} check-ins acumulados`, icon: FileText, tone: "amber", href: "/reports" },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-hero">
        <div><p className="df-eyebrow">CENTRO DE OPERACIONES</p><h1>Panel de control nutricional</h1><p>Seguimiento claro de clientes, planes y decisiones del día.</p></div>
        <div className="dashboard-hero-actions"><span><i />Datos sincronizados</span></div>
      </header>

      <div className="dashboard-metrics">{metrics.map((metric) => <Link href={metric.href} key={metric.label} className={`dashboard-metric metric-${metric.tone}`}><div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div><span className="dashboard-metric-icon"><metric.icon size={20} /></span><ArrowRight className="dashboard-metric-arrow" size={15} /></Link>)}</div>

      {!quota.ok && <div className="dashboard-warning"><HardDrive size={19} /><span>Almacenamiento casi lleno ({quota.percent.toFixed(0)}%). Reduce el tamaño de las fotos o elimina datos antiguos para proteger el guardado.</span></div>}

      <div className="dashboard-grid">
        <section className="dashboard-activity-card">
          <div className="dashboard-card-heading"><div><p className="df-eyebrow">ACTIVIDAD CLÍNICA</p><h2>Clientes recientes y estado de plan</h2></div><Link href="/clients">Ver todos <ArrowRight size={14} /></Link></div>
          <div className="dashboard-client-list">{recentClients.length ? recentClients.map((client) => <ClientStatus key={client.id} client={client} />) : <div className="dashboard-empty"><Users size={25} /><strong>Aún no hay clientes</strong><span>Registra el primero para comenzar su seguimiento.</span><Link href="/clients/new">Registrar cliente</Link></div>}</div>
        </section>

        <aside className="dashboard-side-stack">
          <section className="dashboard-macro-card">
            <div className="dashboard-card-heading"><div><p className="df-eyebrow">MATRIZ DE PLANES</p><h2>Distribución de macros</h2></div><Activity size={18} /></div>
            <p>Promedio energético de los planes guardados.</p>
            <div className="dashboard-donut" style={{ background: `conic-gradient(#00855d 0 ${proteinShare}%, #d97706 ${proteinShare}% ${proteinShare + carbShare}%, #e11d48 ${proteinShare + carbShare}% 100%)` }}><div><strong>100%</strong><span>{snapshot.plans.length ? `${snapshot.plans.length} planes` : "Referencia"}</span></div></div>
            <div className="dashboard-macro-legend"><span className="macro-protein"><i />{proteinShare}%<small>Proteína</small></span><span className="macro-carbs"><i />{carbShare}%<small>Carbos</small></span><span className="macro-fat"><i />{fatShare}%<small>Grasas</small></span></div>
            <Link href="/foods">Explorar alimentos y matrices <ArrowRight size={14} /></Link>
          </section>

          <section className="dashboard-access-card">
            <div className="dashboard-card-heading"><div><p className="df-eyebrow">CUENTA</p><h2>Estado del acceso</h2></div>{status.isAdmin ? <ShieldCheck size={18} /> : <CheckCircle2 size={18} />}</div>
            <div className={`dashboard-access-status ${isExpiring ? "is-expiring" : ""}`}><i /> <strong>{status.isAdmin ? "Administrador" : status.active ? "Acceso activo" : trialActive ? "Periodo de prueba" : "Acceso pendiente"}</strong><span>{status.isAdmin ? "Permanente" : status.active ? `${daysLeft ?? "—"} días restantes` : trialActive ? `${trialDaysLeft} días restantes` : "Requiere activación"}</span></div>
            {email && <p>{email}</p>}
            <div>{!status.active && !trialActive && email && <button onClick={() => openExternal(`${STRIPE_PAYMENT_LINK_MONTHLY}?prefilled_email=${encodeURIComponent(email)}`)}>Suscribirse</button>}<button onClick={logout}>Cerrar sesión</button></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ClientStatus({ client }: { client: Client }) {
  const plans = db.getMealPlans(client.id);
  const checkins = db.getCheckIns(client.id);
  const latestPlan = [...plans].sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestCheckin = [...checkins].sort((a, b) => b.date.localeCompare(a.date))[0];
  const adherence = latestCheckin?.adherence ? averageAdherence([latestCheckin.adherence]) : null;
  return <Link href={`/clients/${client.id}`} className="dashboard-client-row"><div className="dashboard-client-avatar">{client.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</div><div className="dashboard-client-name"><strong>{client.name}</strong><span>{client.prep_type || "Seguimiento general"}</span></div><div className="dashboard-client-plan"><small>ÚLTIMO PLAN</small><strong>{latestPlan ? `${latestPlan.total_kcal.toLocaleString("es-MX")} kcal` : "Sin plan"}</strong></div><div className="dashboard-client-adherence"><small>ADHERENCIA</small><span>{adherence === null ? "Sin datos" : `${adherence}%`}</span><i><b style={{ width: `${adherence ?? 0}%` }} /></i></div><ArrowRight size={16} /></Link>;
}
