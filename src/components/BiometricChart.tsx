"use client";
import { useId, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProgressChartPoint } from "@/lib/client-progress";

/** Visual history only: rolling means never write measurements or check-ins. */
export function BiometricChart({ points }: { points: ProgressChartPoint[] }) {
  const [metric, setMetric] = useState<"weight" | "bodyFat">("weight");
  const [range, setRange] = useState(0);
  const [showMean, setShowMean] = useState(true);
  const gradient = useId().replace(/:/g, "");
  const unit = metric === "weight" ? "kg" : "%";
  const all = points.filter(p => p[metric] != null).map(p => {
    const time = Date.parse(p.date + "T12:00:00Z");
    const window = points.filter(row => row[metric] != null && Date.parse(row.date + "T12:00:00Z") <= time && Date.parse(row.date + "T12:00:00Z") > time - 7 * 86400000);
    return { ...p, value: p[metric]!, mean: Number((window.reduce((sum, row) => sum + row[metric]!, 0) / window.length).toFixed(2)) };
  });
  const lastTime = all.length ? Date.parse(all.at(-1)!.date + "T12:00:00Z") : 0;
  const data = all.filter(p => !range || Date.parse(p.date + "T12:00:00Z") >= lastTime - range * 86400000);
  const values = data.map(p => p.value);
  const delta = data.length ? data.at(-1)!.value - data[0].value : 0;
  const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });
  return <div className="biometric-studio">
    <header className="biometric-studio-toolbar"><div><span className="biometric-eyebrow">ANÁLISIS CORPORAL</span><h3>Curva biométrica de evolución</h3><p>Registros reales y media móvil de los últimos 7 días.</p></div><div className="biometric-segments">{(["weight", "bodyFat"] as const).map(key => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{key === "weight" ? "Peso" : "Grasa corporal"}</button>)}</div></header>
    <div className="biometric-chart-controls"><div className="biometric-chart-legend"><span><i/>Registro real</span><button type="button" aria-pressed={showMean} onClick={() => setShowMean(!showMean)}><i/>Media 7 días {showMean ? "✓" : "+"}</button></div><div className="biometric-segments">{[[7,"1S"],[30,"1M"],[90,"3M"],[180,"6M"],[365,"1A"],[0,"Todo"]].map(([days,label]) => <button type="button" key={days} aria-pressed={range === days} onClick={() => setRange(Number(days))}>{label}</button>)}</div></div>
    {data.length ? <div className="biometric-plot"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 30, right: 24, left: 0, bottom: 12 }}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--clinical-line)" strokeDasharray="4 7"/><XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={38} tick={{ fill: "var(--clinical-muted)", fontSize: 11 }} dy={12}/><YAxis domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} tickFormatter={v => `${v} ${unit}`} tickLine={false} axisLine={false} width={65} tick={{ fill: "var(--clinical-muted)", fontSize: 11 }}/><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="biometric-tooltip"><span>{dateLabel(String(label))}</span><strong>{Number(payload[0].payload.value).toFixed(2)} <small>{unit}</small></strong><p>Media 7 días: {payload[0].payload.mean} {unit}</p><p>{payload[0].payload.source === "checkin" ? "Check-in" : "Evaluación"}</p></div> : null}/><Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fill={`url(#${gradient})`} dot={{ r: 4, fill: "var(--clinical-surface)", strokeWidth: 2 }} activeDot={{ r: 7, stroke: "var(--clinical-surface)", strokeWidth: 3 }}/>{showMean && <Line type="monotone" dataKey="mean" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={false}/>}</ComposedChart></ResponsiveContainer></div> : <div className="biometric-chart-empty">No hay registros de {metric === "weight" ? "peso" : "grasa corporal"} para este periodo.</div>}
    <footer className="biometric-studio-footer"><span><i/>{data.length} registros · periodo seleccionado</span><span>Mínimo <b>{values.length ? Math.min(...values).toFixed(1) : "—"} {unit}</b></span><span>Máximo <b>{values.length ? Math.max(...values).toFixed(1) : "—"} {unit}</b></span><span>Cambio total <b>{delta > 0 ? "+" : ""}{delta.toFixed(1)} {unit}</b></span></footer>
  </div>;
}
