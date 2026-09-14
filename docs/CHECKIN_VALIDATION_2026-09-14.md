# Validación check-in / notificaciones

79 pruebas Node aprobadas; TypeScript, ESLint y build de producción correctos.
Prueba real PostgreSQL con cuatro identidades ficticias (dos coaches/dos clientes), migración y fixtures dentro de transacción revertida: RLS solo muestra registros propios, portal y escritura cruzados rechazados, grasa enviada por cliente rechazada, valores inválidos rechazados, rutas de fotos cruzadas rechazadas, UUID repetido conserva una actividad y una notificación, coach B no puede marcar alerta de A. Sin conservación de fixtures.
Revisión independiente: review_protocol; formulario y pruebas auxiliares: portal_checkin_form. Se corrigieron carga inicial sin recuperación, pérdida de borrador por pestaña, reintento de lectura, URLs privadas vencidas, peso divergente y migración no atómica.

Límites: no prueba de carga, ni verificación exhaustiva de vulnerabilidades. La prueba SQL no sustituye dos sesiones de navegador ni una subida real de archivos. Datos recibidos del portal no se incorporan automáticamente al snapshot/gráficas del coach. La sesión de navegador puede bloquear almacenamiento; reintento tras cerrar pestaña no garantizado. Fotos subidas sin enviar quedan privadas sin limpieza automática; no hay política de borrado del bucket aún.

Hallazgos previos fuera del cambio: borrar/restaurar clientes con ID reutilizado puede conservar relaciones de portal/actividad antiguas; importación legacy sin propietario puede ofrecer datos antiguos en un navegador compartido. No se consideran resueltos con la separación normal de coaches ni con estas pruebas. Revisar antes de afirmar aislamiento completo en restauraciones/importaciones.
