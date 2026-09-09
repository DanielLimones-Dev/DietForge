# Revisión de integridad de DietForge — 2026-09-08

## Veredicto

El producto está completo para una beta interna controlada. Nutrición, Rest Day, Peak Week, clientes, rutinas, agenda, portal, administración, suscripciones manuales, reportes, PDF, respaldos y Supabase ya forman un flujo conectado. Antes de usar expedientes reales con clientes externos deben cerrarse los puntos de producción siguientes.

## Prioridad 0 — requisito de salida pública

1. Publicar en un dominio HTTPS estable y registrar las URL de confirmación y recuperación en Supabase Auth.
2. Configurar SMTP propio y probar con una cuenta de coach y otra de cliente: alta, confirmación, contraseña olvidada y entrega real.
3. Ejecutar aceptación completa en teléfono y escritorio con cuentas separadas: dieta, Rest Day, Peak Week, rutina, video, portal, PDF y restauración.
4. Definir aviso de privacidad, consentimiento, retención, exportación y eliminación de datos personales.
5. Elegir Supabase Pro si se necesita garantía contra pausa, respaldo administrado y operación continua. El healthcheck gratuito detecta fallas, pero no constituye garantía.

## Prioridad 1 — endurecimiento operativo

1. Añadir rate limiting distribuido por identidad e IP a altas administrativas y proveedores nutricionales.
2. Conectar monitoreo remoto de errores y alertas de autenticación, guardado, renovación y carga de videos.
3. Definir cuotas de almacenamiento por coach y limpieza segura de videos privados que ya no estén referenciados.
4. Probar recuperación ante desastre con un respaldo real de producción y registrar tiempo y resultado.
5. Ejecutar pruebas RLS con dos coaches y dos clientes reales para confirmar aislamiento de lectura, escritura, videos y actividad.

## Prioridad 2 — calidad comercial

1. Incorporar onboarding guiado para el primer cliente, primera dieta y primera rutina.
2. Añadir avisos de vencimiento y seguimiento de pagos manuales; Vercel no necesita conocer la transferencia.
3. Añadir métricas de uso y rendimiento sin datos clínicos sensibles.
4. Repetir auditoría de accesibilidad con teclado, lector de pantalla y tamaños móviles.

## Módulo de rutinas verificado

- Semanas con días y ejercicios independientes.
- Selección múltiple de ejercicios sin cerrar la biblioteca.
- Ejercicios personalizados con nombre y grupo muscular.
- YouTube validado y videos privados MP4, WebM o MOV de hasta 50 MB.
- Metas y volumen directo, indirecto y efectivo por semana.
- Registro del cliente sin permiso para modificar la prescripción.
- PDF y material educativo.
- Modal con fondo bloqueado, scroll interno y cierre con `Esc`.

## Evidencia actual

- 55 de 55 pruebas automatizadas aprobadas.
- TypeScript aprobado.
- ESLint aprobado.
- Compilación Next.js de 18 rutas aprobada.
- Flujo de biblioteca y selección múltiple verificado en Brave.
- Datos temporales de validación descartados mediante recarga; la rutina guardada conservó cero ejercicios.

La salida pública depende de cerrar Prioridad 0. Prioridad 1 debe completarse antes de aumentar usuarios o almacenar expedientes sensibles a escala.
