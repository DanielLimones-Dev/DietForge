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
6. Definir privacidad, consentimiento, retención y eliminación/exportación de datos personales antes de invitar clientes reales.
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
