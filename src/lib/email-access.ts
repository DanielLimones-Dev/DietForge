// Parse access input without fetching arbitrary URLs or exposing tokens in logs.
export function parseEmailAccess(input: string, email: string, supabaseUrl: string, appOrigin: string) {
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) {
    if (!/^\d{6,10}$/.test(value)) throw new Error("Pega el código o el enlace completo de tu correo.");
    return { email: email.trim().toLowerCase(), token: value, type: "email" as const };
  }
  const url = new URL(value);
  const expected = new URL(supabaseUrl);
  const isSupabase = url.origin === expected.origin && url.pathname === "/auth/v1/verify";
  const isCallback = url.origin === appOrigin && url.pathname === "/auth/callback";
  const tokenHash = url.searchParams.get("token_hash") || (isSupabase ? url.searchParams.get("token") : null);
  const type = url.searchParams.get("type") || "email";
  if ((!isSupabase && !isCallback) || !tokenHash || !["magiclink", "signup", "invite", "email"].includes(type)) {
    throw new Error("El enlace debe ser el de acceso a DietForge que recibiste en tu correo.");
  }
  return { token_hash: tokenHash, type: type as "magiclink" | "signup" | "invite" | "email" };
}
