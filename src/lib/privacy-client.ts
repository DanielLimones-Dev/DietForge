import { PRIVACY_NOTICE_VERSION, type PrivacySource } from "./privacy";
import { supabase } from "./supabase";

/**
 * Registro autoritativo del consentimiento. La fecha la pone el servidor, no el
 * navegador, y la versión debe existir como aviso publicado.
 */
export async function recordPrivacyConsent(source: PrivacySource): Promise<string> {
  const { data, error } = await supabase.rpc("dietforge_privacy_record_consent", {
    p_version: PRIVACY_NOTICE_VERSION,
    p_source: source,
  });
  if (error) throw error;
  const acceptedAt = (data as { accepted_at?: unknown } | null)?.accepted_at;
  return typeof acceptedAt === "string" ? acceptedAt : "";
}

/**
 * Si el alta quedó pendiente de confirmar correo, el consentimiento solo vive en
 * `user_metadata`. Al entrar con sesión se replica en la bitácora de Supabase.
 */
export async function syncConsentFromMetadata(user: { user_metadata?: Record<string, unknown> } | null): Promise<boolean> {
  const version = user?.user_metadata?.privacy_notice_version;
  if (version !== PRIVACY_NOTICE_VERSION) return false;
  try {
    await recordPrivacyConsent("portal_signup");
    return true;
  } catch {
    return false;
  }
}
