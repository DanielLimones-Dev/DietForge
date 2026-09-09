type AdminRoleResult = {
  data: boolean | null;
  error: { message?: string } | null;
};

// Navigation follows the server-backed role result; email text is never trusted.
export function destinationForRole(result: AdminRoleResult) {
  if (result.error) throw new Error("No se pudo verificar el rol de esta cuenta. Intenta iniciar sesión de nuevo.");
  return result.data === true ? "/admin" : "/";
}
