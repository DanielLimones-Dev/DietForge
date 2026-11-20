export interface IntakeLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  goal: string;
  experience: string;
  daysPerWeek: number;
  injuries: string;
  notes: string;
  createdAt: string;
  convertedClientId?: number;
}

const STORAGE_KEY = "dietforge_intake_leads_v1";

export function loadIntakeLeads(): IntakeLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IntakeLead[]) : [];
  } catch {
    return [];
  }
}

export function saveIntakeLead(
  lead: Omit<IntakeLead, "id" | "createdAt">
): IntakeLead {
  const entry: IntakeLead = {
    ...lead,
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const current = loadIntakeLeads();
  const next = [entry, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors.
  }
  return entry;
}

export function markLeadConverted(leadId: string, clientId: number): IntakeLead[] {
  const next = loadIntakeLeads().map((lead) =>
    lead.id === leadId ? { ...lead, convertedClientId: clientId } : lead
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors.
  }
  return next;
}

export function deleteIntakeLead(leadId: string): IntakeLead[] {
  const next = loadIntakeLeads().filter((lead) => lead.id !== leadId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors.
  }
  return next;
}
