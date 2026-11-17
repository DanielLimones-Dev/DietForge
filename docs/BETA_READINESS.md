# Preparación para beta — 2026-09-08

## Veredicto

DietForge está listo para una **beta interna controlada** con el administrador y uno o dos expedientes ficticios o de confianza. Aún no está listo para una beta pública con clientes externos.

## Controles aprobados

- Next.js compila y las rutas de coach, administrador y cliente están separadas.
- 55 pruebas automatizadas, TypeScript, lint y build aprobados tras la revisión de cierre.
- Las pruebas SQL transaccionales comprueban aislamiento entre coaches y clientes, revocación de acceso, sesiones de entrenamiento, conflictos y restauración.
- Migraciones aplicadas hasta `20260908070000` (semanas de entrenamiento independientes); SQL de portal, videos y semanas aprobado con rollback.
- Los guardados mantienen respaldos y la pantalla de calidad permite descargarlos y restaurarlos.
- El healthcheck remoto devuelve una respuesta válida sin leer datos de usuarios.

## Bloqueos para beta externa

1. Publicar la aplicación en un dominio HTTPS estable y registrar sus redirects en Supabase Auth.
2. Configurar SMTP propio y probar alta, confirmación, recuperación y entrega real.
3. Pasar la organización de Supabase a Pro para eliminar de forma garantizada la pausa por baja actividad y obtener las prestaciones de respaldo del plan.
4. Aplicar rate limiting distribuido en rutas administrativas y proveedores de alimentos.
5. Hacer una prueba de aceptación en móvil y escritorio: coach, cliente, Rest Day, Peak Week, rutina, impresión y restauración.
6. ~~Definir privacidad, consentimiento, retención y eliminación/exportación de datos personales antes de invitar clientes reales.~~ **Hecho en local el 2026-11-16**: aviso en `/privacidad`, consentimiento obligatorio en el registro, exportación y eliminación con doble confirmación. Falta aplicar la migración `20261116010000_privacy_consent_and_deletion.sql` y una prueba real con SMTP. Ver `docs/PRIVACIDAD.md`.
7. Conectar alertas remotas de errores; el monitor actual solo vive durante la sesión del navegador.

## Comprobación de disponibilidad de Supabase

La migración `20260908050000_healthcheck.sql` expone `dietforge_healthcheck()`, una RPC de solo lectura que devuelve estado y fecha del servidor sin consultar espacios, cuentas ni expedientes. El script `scripts/supabase-healthcheck.mjs` la llama con la clave pública y termina con código distinto de cero si la red, el proyecto o la respuesta fallan.

Ejecución local:

```sh
npm run health:supabase
```

`.github/workflows/supabase-health.yml` está preparado para ejecutarse cada tres días. Antes de usarlo en GitHub deben existir los secretos `SUPABASE_HEALTH_URL` y `SUPABASE_HEALTH_ANON_KEY`, y los cambios deben estar publicados en el repositorio. No usar la service role.

Vercel también ejecuta `/api/cron/supabase-health` una vez al día desde el despliegue de producción, según `vercel.json`. Requiere `CRON_SECRET` en las variables de Vercel; la plataforma lo envía como Bearer token. La ruta usa la anon key para llamar a `dietforge_healthcheck` y nunca necesita la service role. GitHub Actions queda como respaldo independiente.

Además se creó una automatización local de Codex cada tres días. Solo debe avisar cuando la comprobación falle. Depende de que el host de Codex pueda ejecutar el proyecto.

Esta comprobación es útil para detectar caídas y genera actividad real, pero Supabase no garantiza que evite la pausa de un proyecto gratuito. La documentación oficial indica que los proyectos Free con poca actividad durante siete días pueden pausarse y que Pro garantiza que no se pausen por inactividad.

## Criterio de salida

La beta externa puede comenzar cuando los siete bloqueos estén cerrados y exista evidencia de una ejecución completa con una cuenta de coach y otra de cliente. Un script de disponibilidad no sustituye el SLA, los respaldos ni el soporte de un plan de producción.

## Privacidad y consentimiento — 2026-11-16 (local, sin desplegar)

Se implementó el bloqueo 6 en código local, pendiente de aprobación del Patrón
Daniel para migrar y desplegar:

- Aviso de privacidad integral en `/privacidad` (versión 1.0, 16/11/2026, LFPDPPP,
  contacto `hola@dietforge.com.mx`), enlazado en la app, el login, el registro y el
  portal del cliente.
- Consentimiento obligatorio con fecha/hora y versión en Supabase
  (`dietforge_privacy_consents`, con RLS) al crear la cuenta del portal y al
  activar la cuenta de un coach invitado.
- **Mi cuenta** y el portal permiten exportar un JSON con los datos del titular y
  eliminar la cuenta con doble confirmación, con purga de `dietforge_backups`,
  registros, archivos privados e identidad de Auth.
- Validación local: `npm test` (121 pruebas), `npm run typecheck`, `npm run lint` y
  `npm run build` aprobados; `/privacidad` responde 200 (13 secciones) y el
  registro sin aceptar queda bloqueado sin enviar la petición de alta.
- Pendiente: aplicar `supabase/migrations/20261116010000_privacy_consent_and_deletion.sql`
  (primero local, luego producción con autorización), confirmar
  `SUPABASE_SERVICE_ROLE_KEY` en Vercel y repetir la aceptación real con SMTP.
  Detalle en `docs/PRIVACIDAD.md`.

## Check-ins del portal en la vista del coach — 2026-11-16 (local, sin desplegar)

Se simplificó la bandeja de Progreso y se agregó la importación manual al
check-in del cliente, con confirmación e idempotencia por UUID. No hubo cambios
de RLS ni migraciones: la lectura sigue en `dietforge_portal_read` y la escritura
local usa `SaveQueue`. Validación local: 9 pruebas nuevas, typecheck, lint, build
y smoke con Brave sobre RPC interceptadas (`tests/checkin-inbox-smoke.mjs`);
cero escrituras reales en Supabase. Detalle en `docs/ARCHITECTURE.md` y
`docs/PRIVACIDAD.md`.
