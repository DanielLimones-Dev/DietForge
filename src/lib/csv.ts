import type { Client, ClientMeasurement } from "@/types";

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function measurementsToCSV(client: Client, measurements: ClientMeasurement[]): string {
  const headers = ["Fecha", "Peso (kg)", "Altura (cm)", "Edad", "% Grasa", "TMB", "TDEE", "Proteína (g)", "Carbos (g)", "Grasa (g)", "Fibra (g)", "Objetivo", "Actividad"];
  const rows = measurements.map((m) => [
    m.date.slice(0, 10),
    m.weight,
    m.height,
    m.age,
    m.body_fat ?? "",
    m.tmb,
    m.tdee,
    m.protein,
    m.carbs,
    m.fat,
    m.fiber,
    m.goal,
    m.activity_level,
  ].map(csvCell).join(","));

  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
