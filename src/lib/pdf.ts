import type { Client, ClientMeasurement, MealPlan, MealPlanItem, Food } from "@/types";

function escapeHTML(s: string | number): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

interface PDFData {
  client: Client;
  measurement: ClientMeasurement;
  plan: MealPlan;
  items: (MealPlanItem & { food: Food })[];
}

const MEAL_LABELS: Record<string, string> = {
  pre_workout: "Pre-Entreno",
  intra_workout: "Intra-Entreno",
  post_workout: "Post-Entreno",
  meal1: "Comida 1",
  meal2: "Comida 2",
  meal3: "Comida 3",
  meal4: "Comida 4",
  meal5: "Comida 5",
  meal6: "Comida 6",
};

const GOAL_LABELS: Record<string, string> = {
  lose_fat: "Pérdida de grasa",
  maintain: "Mantenimiento",
  build_muscle: "Ganancia muscular",
  gain_weight: "Aumento de peso",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  light: "Ligero",
  moderate: "Moderado",
  active: "Activo",
  very_active: "Muy activo",
};

function groupBy<T>(arr: T[], key: string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = (item as Record<string, unknown>)[key] as string;
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function generateDietPDF(data: PDFData) {
  const mealGroups = groupBy(data.items, "meal_time");

  const totalKcal = data.items.reduce((s, i) => s + Math.round((i.food.protein * 4 + i.food.carbs * 4 + i.food.fat * 9) * i.quantity / 100), 0);
  const totalP = data.items.reduce((s, i) => s + Math.round(i.food.protein * i.quantity / 100 * 10) / 10, 0);
  const totalC = data.items.reduce((s, i) => s + Math.round(i.food.carbs * i.quantity / 100 * 10) / 10, 0);
  const totalF = data.items.reduce((s, i) => s + Math.round(i.food.fat * i.quantity / 100 * 10) / 10, 0);
  const proteinPct = Math.round((totalP * 4 / totalKcal) * 100);
  const carbsPct = Math.round((totalC * 4 / totalKcal) * 100);
  const fatPct = Math.round((totalF * 9 / totalKcal) * 100);

  let mealsHTML = "";
  for (const [mealTime, items] of Object.entries(mealGroups)) {
    const label = MEAL_LABELS[mealTime] || mealTime;
    const mKcal = items.reduce((s, i) => s + Math.round((i.food.protein * 4 + i.food.carbs * 4 + i.food.fat * 9) * i.quantity / 100), 0);
    const mP = items.reduce((s, i) => s + Math.round(i.food.protein * i.quantity / 100 * 10) / 10, 0);
    const mC = items.reduce((s, i) => s + Math.round(i.food.carbs * i.quantity / 100 * 10) / 10, 0);
    const mF = items.reduce((s, i) => s + Math.round(i.food.fat * i.quantity / 100 * 10) / 10, 0);

    const rows = items.map((item) => {
      const kcal = Math.round((item.food.protein * 4 + item.food.carbs * 4 + item.food.fat * 9) * item.quantity / 100);
      return `<tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a">${escapeHTML(item.food.name)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;white-space:nowrap">${item.quantity}${escapeHTML(item.serving_unit)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center">${item.food.protein}g</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center">${item.food.carbs}g</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center">${item.food.fat}g</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#0f172a;text-align:center;font-weight:600;white-space:nowrap">${kcal} kcal</td>
      </tr>`;
    }).join("");

    mealsHTML += `
      <div style="margin-bottom:16px">
        <div style="background:#f1f5f9;border-radius:8px;padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:14px;color:#0f172a">${escapeHTML(label)}</span>
          <span style="font-size:12px;color:#64748b">${mKcal} kcal · P:${mP}g C:${mC}g G:${mF}g</span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:480px">
            <thead>
              <tr style="background:#0ea5e9;color:#fff">
                <th style="padding:7px 8px;font-size:12px;text-align:left;border-radius:6px 0 0 0">Alimento</th>
                <th style="padding:7px 8px;font-size:12px;text-align:center">Cant.</th>
                <th style="padding:7px 8px;font-size:12px;text-align:center">Prot</th>
                <th style="padding:7px 8px;font-size:12px;text-align:center">CH</th>
                <th style="padding:7px 8px;font-size:12px;text-align:center">Grasa</th>
                <th style="padding:7px 8px;font-size:12px;text-align:center;border-radius:0 6px 0 0">Kcal</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<title>${escapeHTML(data.plan.name)} - ${escapeHTML(data.client.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;padding:0 0 40px}
  .header{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;padding:28px 16px 20px}
  .header h1{font-size:20px;font-weight:700;margin-bottom:4px}
  .header p{font-size:13px;opacity:.9}
  .section{padding:16px}
  .section-title{font-size:13px;font-weight:700;color:#0ea5e9;margin-bottom:10px;display:flex;align-items:center;gap:6px}
  .section-title::before{content:"";display:inline-block;width:3px;height:14px;background:#0ea5e9;border-radius:2px}
  .card{background:#fff;border-radius:12px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .label{font-size:11px;color:#94a3b8;margin-bottom:2px}
  .value{font-size:15px;font-weight:600;color:#0f172a}
  .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
  @media(prefers-color-scheme:dark){body{background:#0f172a;color:#f1f5f9}.card{background:#1e293b;box-shadow:0 1px 3px rgba(0,0,0,.3)}.value{color:#f8fafc}.label{color:#64748b}.section-title{color:#38bdf8}.section-title::before{background:#38bdf8}}
  @media print{body{background:#fff;padding:0;color:#0f172a}.card{background:#fff!important;box-shadow:none;border:1px solid #e2e8f0}.value{color:#0f172a!important}.label{color:#94a3b8!important}.header{background:linear-gradient(135deg,#0ea5e9,#0284c7)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  @media(max-width:480px){.header{padding:20px 14px 16px}.header h1{font-size:18px}.section{padding:12px}.grid-2,.grid-3{grid-template-columns:1fr 1fr}.card{padding:12px}}
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHTML(data.plan.name)}</h1>
    <p>${escapeHTML(data.client.name)} · ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <div class="section">
    <div class="section-title">Datos del Cliente</div>
    <div class="card">
      <div class="grid-2">
        <div><div class="label">Nombre</div><div class="value">${escapeHTML(data.client.name)}</div></div>
        <div><div class="label">Email</div><div class="value">${escapeHTML(data.client.email || "—")}</div></div>
        <div><div class="label">Teléfono</div><div class="value">${escapeHTML(data.client.phone || "—")}</div></div>
        <div><div class="label">Edad</div><div class="value">${data.measurement.age} años</div></div>
      </div>
      <div style="height:10px"></div>
      <div class="grid-3">
        <div><div class="label">Peso</div><div class="value">${data.measurement.weight} kg</div></div>
        <div><div class="label">Altura</div><div class="value">${data.measurement.height} cm</div></div>
        <div><div class="label">% Grasa</div><div class="value">${escapeHTML(data.measurement.body_fat || "—")}</div></div>
      </div>
      <div style="height:10px"></div>
      <div class="grid-2">
        <div><div class="label">Actividad</div><div class="value">${escapeHTML(ACTIVITY_LABELS[data.measurement.activity_level] || data.measurement.activity_level)}</div></div>
        <div><div class="label">Objetivo</div><div class="value">${escapeHTML(GOAL_LABELS[data.measurement.goal] || data.measurement.goal)}</div></div>
      </div>
    </div>

    <div class="section-title">Macros Diarios</div>
    <div class="card">
      <div class="grid-2" style="margin-bottom:12px">
        <div><div class="label">Calorías</div><div class="value" style="font-size:22px">${data.plan.total_kcal} kcal</div></div>
        <div style="display:flex;gap:6px;align-items:end;justify-content:end">
          <span class="pill" style="background:#fee2e2;color:#dc2626">P ${proteinPct}%</span>
          <span class="pill" style="background:#ffedd5;color:#ea580c">C ${carbsPct}%</span>
          <span class="pill" style="background:#fef9c3;color:#ca8a04">G ${fatPct}%</span>
        </div>
      </div>
      <div style="display:flex;gap:4px;margin-bottom:10px">
        <div style="flex:${proteinPct};height:6px;background:#ef4444;border-radius:3px 0 0 3px"></div>
        <div style="flex:${carbsPct};height:6px;background:#f97316"></div>
        <div style="flex:${fatPct};height:6px;background:#eab308;border-radius:0 3px 3px 0"></div>
      </div>
      <div class="grid-3">
        <div><div class="label">Proteína</div><div class="value">${data.plan.total_protein}g</div></div>
        <div><div class="label">Carbohidratos</div><div class="value">${data.plan.total_carbs}g</div></div>
        <div><div class="label">Grasas</div><div class="value">${data.plan.total_fat}g</div></div>
      </div>
    </div>

    <div class="section-title">Plan de Comidas</div>
    ${mealsHTML}

    <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;padding:14px;color:#fff;text-align:center;margin-top:8px">
      <div style="font-size:13px;opacity:.9">Total del día</div>
      <div style="font-size:20px;font-weight:700">${totalKcal} kcal</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px">P: ${totalP}g · C: ${totalC}g · G: ${totalF}g</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
