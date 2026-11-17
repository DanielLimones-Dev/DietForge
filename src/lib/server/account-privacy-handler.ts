type Options = { url: string; publicKey: string; serviceKey?: string; fetch: typeof fetch };
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Eliminación de la propia cuenta. La sesión identifica al titular; la base de
 * datos purga su información con RPC y el servidor completa lo que exige la
 * service role: archivos privados e identidad de Auth.
 */
export function createAccountDeleteHandler(options: Options) {
  return async (request: Request): Promise<Response> => {
    const fail = (message: string, status: number) => Response.json({ error: message }, { status });
    const token = request.headers.get('authorization');
    if (!token?.startsWith('Bearer ')) return fail('Inicia sesión para eliminar tu cuenta.', 401);
    if (!options.serviceKey) return fail('El servicio de eliminación no está configurado.', 503);
    const body = await request.json().catch(() => null);
    const requestId = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { requestId?: unknown }).requestId === 'string'
      ? (body as { requestId: string }).requestId
      : '';
    if (!requestIdPattern.test(requestId)) return fail('La solicitud no es válida.', 400);
    try {
      const userHeaders = { apikey: options.publicKey, Authorization: token };
      const identity = await options.fetch(new URL('/auth/v1/user', options.url), {
        method: 'GET', headers: userHeaders, cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (!identity.ok) return fail('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
      const user = await identity.json() as { id?: string; email?: string };
      if (!user.id) return fail('Tu sesión expiró. Vuelve a iniciar sesión.', 401);

      const purged = await options.fetch(new URL('/rest/v1/rpc/dietforge_privacy_delete_account', options.url), {
        method: 'POST',
        headers: { ...userHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_request_id: requestId }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      if (!purged.ok) return fail('No se pudo eliminar tu información. Intenta de nuevo o escríbenos.', 502);
      const result = await purged.json() as { deleted?: boolean; email?: string } | null;

      const serviceHeaders = { apikey: options.serviceKey, Authorization: 'Bearer ' + options.serviceKey, 'Content-Type': 'application/json' };
      for (const bucket of ['training-videos', 'checkin-photos', 'recipe-photos']) {
        const listed = await options.fetch(new URL(`/storage/v1/object/list/${bucket}`, options.url), {
          method: 'POST', headers: serviceHeaders, body: JSON.stringify({ prefix: user.id + '/', limit: 1000, offset: 0 }), signal: AbortSignal.timeout(15000),
        });
        if (!listed.ok) return fail('Tus datos se eliminaron, pero no se pudieron revisar los archivos privados. Reintenta la eliminación.', 502);
        const objects = await listed.json() as { name?: string }[];
        const prefixes = objects.flatMap(item => item.name ? [user.id + '/' + item.name] : []);
        if (!prefixes.length) continue;
        const removed = await options.fetch(new URL(`/storage/v1/object/${bucket}`, options.url), {
          method: 'DELETE', headers: serviceHeaders, body: JSON.stringify({ prefixes }), signal: AbortSignal.timeout(15000),
        });
        if (!removed.ok) return fail('Tus datos se eliminaron, pero no se pudieron retirar todos los archivos privados. Reintenta la eliminación.', 502);
      }

      const deleted = await options.fetch(new URL('/auth/v1/admin/users/' + encodeURIComponent(user.id), options.url), {
        method: 'DELETE', headers: serviceHeaders, signal: AbortSignal.timeout(15000),
      });
      if (!deleted.ok && deleted.status !== 404) return fail('Tus datos se eliminaron, pero la cuenta de acceso sigue activa. Reintenta la eliminación.', 502);
      return Response.json({ deleted: true, email: result?.email ?? user.email ?? null });

    } catch {
      return fail('No se pudo completar la eliminación. Reintenta para comprobar su estado.', 502);
    }
  };
}
