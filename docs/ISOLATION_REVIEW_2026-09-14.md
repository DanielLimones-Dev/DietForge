# Revisión de aislamiento y portal · 14 septiembre 2026

Base de revisión: f40ce87; migración aplicada el 14 septiembre 2026 tras autorización explícita del usuario.

## Correcciones preparadas
- Arranque de cuenta remota vacía: ya no lee/adopta claves legacy globales del navegador. Los bytes se conservan intactos; respaldo por cuenta permanece disponible.
- Migración 20260914020000: retira autorizaciones, notificaciones y actividad de clientes borrados; archiva actividad en tabla privada. Sanea asociaciones huérfanas existentes. Bloquea rutas de fotos retiradas incluso tras reutilización del ID.
- Las escrituras de actividad, permisos y fotos coordinan mediante bloqueo de workspace con borrados y restauraciones.
- Restauración conservadora: copia previa, revisión optimista e idempotencia; restaura solo actividad del respaldo, retira relaciones anteriores y exige habilitar accesos nuevamente. Fotos retiradas no reviven. Aviso de recuperación actualizado.

## Evidencia
- 80 pruebas Node aprobadas; typecheck, lint y build aprobados.
- Prueba real en Brave incógnito, con coach y cliente ficticios: login, acceso al expediente correcto, check-in 72.4 kg, notas, adherencia 0 %, borrador conservado al cambiar pestaña y confirmación visible tras envío. Consulta backend verificó una actividad y una notificación de su propietario. En Brave, la cuenta ficticia del coach mostró campana «1 sin leer» y el enlace al check-in correcto; se abrió el detalle y el backend confirmó read_at. Las dos cuentas ficticias y sus datos se eliminaron al terminar; la sesión original del usuario quedó abierta.
- Storage API real con fixture PNG de un píxel: subida autenticada, URL firmada válida, referencia guardada en check-in y firma anónima rechazada. No se usaron fotos personales. Esto no prueba el selector de archivos de Brave.
- PostgreSQL local PGlite: funciones/tablas/constraints/policies/triggers DietForge leídos del esquema enlazado sin datos; auth/storage/subscriptions mínimos para fixtures. Ejecutadas migración y pruebas retire-client-associations.sql y checkin-notifications.sql: PASS. Incluyen reutilización, aislamiento entre coaches, archivo privado, bloqueo de fotos, conflicto de revisión y reintento de restauración. No equivale a ejecutar la migración en Supabase.
- Revisión real: portal_checkin_form implementó legacy y regresión; review_protocol implementó SQL y pruebas; raíz revisó ambos diffs e integró/ejecutó validación.

## Límites y publicación
El bloqueo inicial de revisión automática quedó resuelto con autorización explícita del usuario. Se aplicó 20260914020000 mediante supabase db push --linked --yes. Se ejecutaron retire-client-associations.sql y checkin-notifications.sql en Supabase enlazado con fixtures ficticios y ROLLBACK: ambos PASS. La aplicación se publica con este lote.
No se probó carrera con dos conexiones simultáneas, carga masiva ni todos los navegadores. Las URLs firmadas ya emitidas pueden durar hasta 300 segundos. Sustituir manualmente a una persona conservando exactamente su ID mediante el RPC de guardado del propio coach no es distinguible de una edición legítima sin identidad inmutable; no existe importador general en UI. Los respaldos incompatibles con validación vigente fallan de forma atómica. Los borradores no enviados y archivos huérfanos tienen las limitaciones documentadas en CHECKIN_VALIDATION_2026-09-14.md.
