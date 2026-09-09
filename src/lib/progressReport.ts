import type { Client, ClientMeasurement, CheckIn, Competition, CompetitionPhase } from "@/types";
import { calculateWeightTrend } from "./trends";
import { calculateFFMI, calculateLeanBodyMass, calculateFatMass, calculateBmi } from "./metrics";
import { getPhaseLabel } from "./phases";
const escapeHTML = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

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
      <td>${escapeHTML(d.date.slice(0, 10))}</td>
      <td>${escapeHTML(d.weight)} kg</td>
      <td>${escapeHTML(bf ?? "—")}${bf == null ? "" : "%"}</td>
    </tr>`;
  }).join("");

  const avgKcal = measurements.length > 0
    ? Math.round(measurements.reduce((s, m) => s + m.tdee, 0) / measurements.length)
    : 0;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  @page{size:A4;margin:11mm}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#173129;background:#edf3f0}
  .page{max-width:760px;margin:24px auto;background:#fff;box-shadow:0 24px 70px #18352a1f}
  .report-header{position:relative;overflow:hidden;padding:28px 32px;background:linear-gradient(130deg,#0e4938,#177356 72%,#21936d);color:#fff}
  .report-header:after{content:"";position:absolute;right:-50px;top:-80px;width:230px;height:230px;border:1px solid #ffffff24;border-radius:50%;box-shadow:0 0 0 34px #ffffff0c,0 0 0 70px #ffffff08}
  .brand{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9e8da}.report-header h1{position:relative;z-index:1;font-size:28px;letter-spacing:-.03em;margin:25px 0 5px}.sub{position:relative;z-index:1;color:#d9eee5;font-size:11px}
  .content{padding:23px 32px 30px}h2{display:flex;align-items:center;gap:8px;font-size:10px;color:#365e50;margin:22px 0 10px;text-transform:uppercase;letter-spacing:.12em}h2:before{content:"";width:18px;height:2px;border-radius:99px;background:#1a8663}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
  .stat{background:#f7faf8;padding:14px;border-radius:11px;border:1px solid #dfe9e5;break-inside:avoid}
  .stat-label{font-size:8px;color:#758b83;text-transform:uppercase;letter-spacing:.08em}
  .stat-value{font-size:19px;font-weight:750;color:#173129;margin-top:5px}
  table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;margin:10px 0;border:1px solid #dfe9e5;border-radius:11px;page-break-inside:auto}
  thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#174f3e;color:#dff1e9;padding:8px;font-size:8px;text-align:left;text-transform:uppercase;letter-spacing:.06em}td{padding:9px;border-bottom:1px solid #e8efec;font-size:10px}td:not(:first-child),th:not(:first-child){text-align:center}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fbfdfc}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .badge-green{background:#dcfce7;color:#16a34a}
  .badge-red{background:#fee2e2;color:#dc2626}
  .badge-blue{background:#dff4ea;color:#17684d}
  .trend-up{color:#dc2626}
  .trend-down{color:#16a34a}
  .trend-flat{color:#64748b}
  .report-footer{text-align:center;color:#81938c;font-size:8px;margin-top:26px;padding-top:10px;border-top:1px solid #dfe9e5}
  @media(max-width:560px){.page{margin:0}.content,.report-header{padding-left:18px;padding-right:18px}.grid-2{grid-template-columns:1fr}}
  @media print{body{background:#fff}.page{margin:0;max-width:none;box-shadow:none}.report-header{margin:0;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.content{padding:16px 0 0}.stat{break-inside:avoid;page-break-inside:avoid}}
</style>
</head><body><main class="page"><header class="report-header"><div class="brand">DF · DietForge</div>
<h1>${escapeHTML(client.name)}</h1>
<p class="sub">Reporte de progreso · ${new Date().toLocaleDateString("es-MX")}${phase ? ` · ${escapeHTML(getPhaseLabel(phase))}` : ""}</p></header><div class="content">

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
  <div class="stat"><div class="stat-label">Nombre</div><div class="stat-value">${escapeHTML(competition.name)}</div></div>
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

<p class="report-footer">DietForge · Reporte generado el ${new Date().toLocaleString("es-MX")}</p>
</div></main></body></html>`;
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
  if (win) { win.opener = null; win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
}
