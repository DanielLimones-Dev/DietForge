import type { Client, TrainingProgram } from "@/types";
import {exerciseVideo} from './training-media';
import {trainingDays} from './training';

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character] ?? character));

const safeUrl = (value?: string) => {
  if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? escapeHtml(url.href) : ""; }
  catch { return ""; }
};

export function trainingProgramHtml(program: TrainingProgram, client: Client): string {
  const weeks = Array.from({ length: program.duration_weeks }, (_, index) => index + 1);
  const priorities = program.priorities.filter(Boolean).join(" · ") || "Sin prioridades indicadas";
  const pages = weeks.map(week => `<section class="week-page">
    <div class="week-title"><div><span>ROTACIÓN ${program.rotation_number}</span><h2>Semana ${week}</h2></div><p>${escapeHtml(program.split || `${trainingDays(program,week).length} días de entrenamiento`)}</p></div>
    ${trainingDays(program,week).map(day => `<article class="day">
      <header><div><span>${String(day.day_number).padStart(2, "0")}</span><h3>${escapeHtml(day.name)}</h3></div><small>${day.exercises.length} ejercicios</small></header>
      ${day.notes ? `<p class="day-note">${escapeHtml(day.notes)}</p>` : ""}
      <table><thead><tr><th>Grupo</th><th>Ejercicio</th><th>Series</th><th>Repeticiones</th><th>RIR</th><th>Carga kg</th><th>Nota</th></tr></thead><tbody>
      ${day.exercises.length ? day.exercises.map(exercise => {
        const prescription = exercise.prescriptions.find(item => item.week === week);
        const coachVideo = safeUrl(exerciseVideo(exercise));
        return `<tr><td>${escapeHtml(exercise.muscle_group)}</td><td><strong>${escapeHtml(exercise.name)}</strong>${coachVideo ? `<a href="${coachVideo}" target="_blank" rel="noreferrer">Video del coach</a>` : ""}</td><td>${prescription?.sets ?? 0}</td><td>${prescription ? `${prescription.reps_min}–${prescription.reps_max}` : "—"}</td><td>${prescription ? `${prescription.rir_start}→${prescription.rir_end}` : "—"}</td><td>${escapeHtml(prescription?.load_kg ?? "—")}</td><td>${escapeHtml(exercise.notes || "—")}</td></tr>`;
      }).join("") : `<tr><td colspan="7" class="empty">Día de descanso o sesión sin ejercicios.</td></tr>`}
      </tbody></table>
    </article>`).join("")}
  </section>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(program.name)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef4f1;color:#173329;font-family:Inter,Arial,sans-serif;font-size:11px}.document{max-width:210mm;margin:auto;background:#fff}.cover{padding:28px 30px;background:linear-gradient(135deg,#123d30,#087450 58%,#0a9968);color:#fff;position:relative;overflow:hidden}.cover:after{content:"";position:absolute;width:230px;height:230px;border:42px solid #ffffff14;border-radius:50%;right:-80px;top:-105px}.brand{font-size:13px;font-weight:800;letter-spacing:.16em}.eyebrow{margin-top:32px;font-size:9px;letter-spacing:.18em;opacity:.7}.cover h1{margin:8px 0 3px;font-size:29px;letter-spacing:-.04em}.cover>p{margin:0;opacity:.82}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 30px}.meta div{padding:12px;border:1px solid #dce9e4;border-radius:10px}.meta span{display:block;color:#668078;font-size:7px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.meta strong{display:block;margin-top:5px;font-size:11px}.notes{margin:0 30px 18px;padding:12px 14px;border-left:4px solid #0a9968;background:#eff9f5;color:#46635a}.week-page{padding:20px 30px;break-before:page}.week-page:first-of-type{break-before:auto}.week-title{display:flex;align-items:end;justify-content:space-between;padding-bottom:11px;border-bottom:2px solid #0a875d}.week-title span{font-size:7px;letter-spacing:.13em;color:#0a875d;font-weight:800}.week-title h2{margin:2px 0 0;font-size:21px}.week-title p{margin:0;color:#668078}.day{margin-top:13px;border:1px solid #d6e5df;border-radius:10px;overflow:hidden;break-inside:auto}.day header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:#eff7f4;break-after:avoid}.day header>div{display:flex;align-items:center;gap:9px}.day header span{color:#0a875d;font-weight:800}.day h3{margin:0;font-size:12px}.day small{color:#668078}.day-note{margin:0;padding:8px 11px;color:#59726a;border-bottom:1px solid #e2ece8}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid}th{padding:7px 8px;background:#145541;color:#fff;text-align:left;font-size:7px;letter-spacing:.08em;text-transform:uppercase}td{padding:7px 8px;border-bottom:1px solid #e5eeeb;vertical-align:top}td:nth-child(3),td:nth-child(4),td:nth-child(5){text-align:center;font-variant-numeric:tabular-nums}td strong{display:block}td a{display:block;margin-top:3px;color:#087450;font-size:8px}.empty{text-align:center!important;color:#789087;padding:12px}.footer{padding:14px 30px;color:#799087;font-size:8px;text-align:center}@page{size:A4;margin:10mm}@media print{body{background:#fff}.document{max-width:none}.cover{padding:18px 20px}.meta{padding:14px 0}.notes{margin:0 0 14px}.week-page{padding:14px 0}.footer{padding:10px 0}.day{overflow:visible}}
  </style></head><body><main class="document"><header class="cover"><div class="brand">DIETFORGE</div><div class="eyebrow">PROGRAMA DE ENTRENAMIENTO PERSONALIZADO</div><h1>${escapeHtml(program.name)}</h1><p>${escapeHtml(client.name)} · ${escapeHtml(program.start_date)}</p></header><section class="meta"><div><span>Objetivo</span><strong>${escapeHtml(program.objective)}</strong></div><div><span>Mesociclo / rotación</span><strong>${program.mesocycle_number} / ${program.rotation_number}</strong></div><div><span>Duración</span><strong>${program.duration_weeks} semanas</strong></div><div><span>Prioridades</span><strong>${escapeHtml(priorities)}</strong></div></section>${program.notes ? `<p class="notes">${escapeHtml(program.notes)}</p>` : ""}${pages}<footer class="footer">Programa preparado en DietForge · Ajustar según respuesta, técnica y recuperación del cliente.</footer></main><script>window.opener=null;window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}

export function printTrainingProgram(program: TrainingProgram, client: Client): void {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("El navegador bloqueó la ventana de impresión.");
  popup.opener = null;
  popup.document.open();
  popup.document.write(trainingProgramHtml(program, client));
  popup.document.close();
}
