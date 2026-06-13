import type { Client, ClientMeasurement, CheckIn, Competition, CompetitionPhase } from "@/types";
import { calculateWeightTrend } from "./trends";
import { calculateFFMI, calculateLeanBodyMass, calculateFatMass, calculateBmi } from "./metrics";
import { getPhaseLabel } from "./phases";

export function generateProgressReportHTML(
  client: Client,
  measurements: ClientMeasurement[],
  checkins: CheckIn[],
  competition?: Competition,
  phase?: CompetitionPhase,
): string {
  const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const trend = calculateWeightTrend([...measurements, ...checkins]);

  const weightDiff = last && first ? (last.weight - first.weight).toFixed(1) : "—";
  const allData = [...measurements, ...checkins].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rows = allData.map((d) => {
    const bf = "body_fat" in d ? d.body_fat : d.body_fat;
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px">${d.date.slice(0, 10)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${d.weight} kg</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center">${bf ?? "—"}%</td>
    </tr>`;
  }).join("");

  const avgKcal = measurements.length > 0
    ? Math.round(measurements.reduce((s, m) => s + m.tdee, 0) / measurements.length)
    : 0;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,sans-serif;color:#0f172a;padding:40px;max-width:800px;margin:0 auto}
  h1{font-size:24px;margin-bottom:4px}
  h2{font-size:18px;color:#0ea5e9;margin:24px 0 12px;border-bottom:2px solid #0ea5e9;padding-bottom:4px}
  .sub{color:#64748b;font-size:14px;margin-bottom:16px}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
  .stat{background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0}
  .stat-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .stat-value{font-size:20px;font-weight:700;color:#0f172a;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#f1f5f9;padding:8px;font-size:12px;text-align:left}
  td{font-size:13px}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .badge-green{background:#dcfce7;color:#16a34a}
  .badge-red{background:#fee2e2;color:#dc2626}
  .badge-blue{background:#dbeafe;color:#2563eb}
  .trend-up{color:#dc2626}
  .trend-down{color:#16a34a}
  .trend-flat{color:#64748b}
  @media print{body{padding:20px}}
</style>
</head><body>
<h1>${client.name}</h1>
<p class="sub">Reporte de progreso — ${new Date().toLocaleDateString("es-MX")}${phase ? ` · ${getPhaseLabel(phase)}` : ""}</p>

<h2>Resumen</h2>
<div class="grid-2">
  <div class="stat"><div class="stat-label">Peso Actual</div><div class="stat-value">${trend.currentWeight} kg</div></div>
  <div class="stat"><div class="stat-label">Cambio Total</div><div class="stat-value ${Number(weightDiff) > 0 ? "trend-up" : Number(weightDiff) < 0 ? "trend-down" : "trend-flat"}">${Number(weightDiff) > 0 ? "+" : ""}${weightDiff} kg</div></div>
  <div class="stat"><div class="stat-label">Promedio 7 días</div><div class="stat-value">${trend.rollingAverage7 ?? "—"} kg</div></div>
  <div class="stat"><div class="stat-label">Calorías Promedio</div><div class="stat-value">${avgKcal} kcal</div></div>
</div>

<h2>Historial de Mediciones</h2>
<table>
  <thead><tr><th>Fecha</th><th style="text-align:center">Peso</th><th style="text-align:center">% Grasa</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

${competition ? `
<h2>Competencia</h2>
<div class="grid-2">
  <div class="stat"><div class="stat-label">Nombre</div><div class="stat-value">${competition.name}</div></div>
  <div class="stat"><div class="stat-label">Fecha</div><div class="stat-value">${new Date(competition.date).toLocaleDateString("es-MX")}</div></div>
  ${competition.weight ? `<div class="stat"><div class="stat-label">Peso en Escenario</div><div class="stat-value">${competition.weight} kg</div></div>` : ""}
  ${competition.placement ? `<div class="stat"><div class="stat-label">Colocación</div><div class="stat-value">#${competition.placement}</div></div>` : ""}
</div>
` : ""}

<h2>Métricas</h2>
${last ? `
<div class="grid-2">
  <div class="stat"><div class="stat-label">IMC</div><div class="stat-value">${calculateBmi(last.weight, last.height)}</div></div>
  <div class="stat"><div class="stat-label">MML</div><div class="stat-value">${last.body_fat ? calculateLeanBodyMass(last.weight, last.body_fat) + " kg" : "—"}</div></div>
  <div class="stat"><div class="stat-label">Masa Grasa</div><div class="stat-value">${last.body_fat ? calculateFatMass(last.weight, last.body_fat) + " kg" : "—"}</div></div>
  <div class="stat"><div class="stat-label">FFMI</div><div class="stat-value">${last.body_fat ? calculateFFMI(last.weight, last.height, last.body_fat) : "—"}</div></div>
</div>
` : ""}

<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:32px">DietForge · Reporte generado el ${new Date().toLocaleString("es-MX")}</p>
</body></html>`;
}

export function openProgressReport(options: {
  client: Client;
  measurements: ClientMeasurement[];
  checkins: CheckIn[];
  competition?: Competition;
  phase?: CompetitionPhase;
}): void {
  const html = generateProgressReportHTML(options.client, options.measurements, options.checkins, options.competition, options.phase);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
}
