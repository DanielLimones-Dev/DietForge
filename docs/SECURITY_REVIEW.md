# Revisión de ciberseguridad — DietForge

Fecha: 7 de septiembre de 2026. Alcance: aplicación Next.js, autenticación, autorización, persistencia Supabase, rutas API, exportaciones HTML/PDF, secretos y dependencias instaladas.

## Resultado ejecutivo

No se encontró una vía crítica que permita a un coach convertirse en administrador, leer el espacio de otra cuenta o exponer las claves de proveedores desde el navegador. La separación principal se aplica en servidor con `auth.uid()`, RPC `SECURITY DEFINER` con `search_path=''`, permisos revocados y comprobación explícita de administrador. El acceso a `/admin/login` es público como cualquier pantalla de autenticación; conocer esa URL no concede el rol.

Se añadieron defensas HTTP contra clickjacking, MIME sniffing, objetos embebidos, cambios de base URL y acceso innecesario a cámara, micrófono o geolocalización. Las exportaciones codifican texto de usuario y las ventanas de impresión eliminan la referencia a `window.opener`.

## Controles verificados

| Área | Estado | Evidencia |
|---|---|---|
| Identidad y aislamiento | Correcto | `dietforge_load/save` usan `auth.uid()`; RLS limita `owner_id`; el cliente no envía un propietario confiable. |
| Rol administrador | Correcto | `dietforge_is_admin()` consulta una identidad Auth confirmada; el handler valida el bearer antes de usar la service role. |
| Eliminación de coaches | Correcto | Requiere rol administrador en RPC y Route Handler, confirmación exacta del correo, ID idempotente y bloquea la identidad administradora. |
| Secretos | Correcto | `SUPABASE_SERVICE_ROLE_KEY` solo aparece en documentación y código de servidor; `.env` y `.env.local` están ignorados. |
| Altas y renovaciones | Correcto | Periodos limitados a 1, 3 o 12 meses, `requestId` idempotente, bloqueo transaccional y registro de auditoría. |
| API de alimentos | Correcto | Requiere sesión, valida proveedor y consulta, aplica timeout, no cachea y oculta errores del proveedor. |
| Exportaciones | Corregido | Texto variable escapado, `window.opener = null`, formato A4 y tablas con cortes controlados. |
| Dependencias de producción | Correcto | `npm audit --omit=dev`: 0 vulnerabilidades. |
| Encabezados web | Corregido | `nosniff`, `DENY`, referrer restringido, Permissions Policy y CSP parcial compatible con Next.js. |

## Riesgos pendientes

### Prioridad media — límite distribuido de solicitudes

Las rutas administrativas y de búsqueda no tienen un límite de frecuencia propio. La autenticación, los límites de Supabase y las cuotas del proveedor reducen el impacto, pero una cuenta válida podría generar carga o consumir cuota. Antes de abrir el servicio al público se debe aplicar un límite por identidad e IP en el proxy o plataforma de despliegue. Un contador en memoria dentro de Next.js no es suficiente para una ejecución distribuida.

### Prioridad media — respaldo pendiente en el navegador

Para evitar pérdida de datos durante una desconexión, la cola cloud guarda temporalmente el snapshot pendiente por propietario en `localStorage`. Esto puede incluir datos personales del cliente y queda disponible para cualquier script que logre ejecutarse en ese origen o para una persona con acceso al perfil local del navegador. La CSP parcial y la ausencia de HTML sin codificar reducen XSS; a futuro conviene definir retención máxima, limpieza al confirmar la sincronización y una política de equipos compartidos.

### Prioridad media — dependencias de desarrollo

La auditoría completa reporta 24 entradas de severidad alta en ramas de `puppeteer`, ESLint, Babel, Browserslist y `minimatch/brace-expansion`. No forman parte del paquete de producción y varias no tienen corrección automática disponible en el árbol actual. Deben revisarse al actualizar las herramientas de pruebas y lint; no se recomienda forzar versiones incompatibles sin ejecutar toda la validación.

### Prioridad baja — política CSP completa

La CSP actual protege marcos, objetos, formularios y `base-uri`, pero no restringe todavía `script-src` o `connect-src`. Next.js requiere nonce o hash para una política estricta sin romper hidratación, y Supabase necesita sus orígenes en `connect-src`. Conviene completar esto durante la preparación del despliegue, cuando estén definidos dominio, proxy, telemetría y URL final de Supabase.

## Modelo de amenaza y pruebas recomendadas antes de producción

- Ejecutar pruebas reales de RLS con dos cuentas Auth y confirmar que ninguna carga o escritura cruza `owner_id`.
- Probar que un coach autenticado recibe 403 en `POST` y `DELETE /api/admin/coaches` y que ninguna service role llega al bundle del navegador.
- Configurar alertas para renovaciones, suspensiones y errores repetidos de autenticación administrativa.
- Aplicar rate limiting distribuido y revisar límites de tamaño de solicitud en el proxy.
- Repetir `npm audit --omit=dev`, pruebas, typecheck, lint y build en cada entrega.
- Revisar respaldos, recuperación y eliminación de datos con el dominio y la política de privacidad definitivos.

Esta revisión es técnica y corresponde al estado actual del repositorio; debe repetirse cuando cambien autenticación, almacenamiento, proveedores, despliegue o facturación.
