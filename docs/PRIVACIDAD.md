# Privacidad, consentimiento y derechos del titular — 2026-11-16

Implementación local aprobada por el Patrón Daniel. **No se desplegó ni se aplicó a
producción**: el deploy y la migración en Supabase requieren su aprobación expresa.

## Qué quedó hecho

| Pieza | Ruta | Detalle |
|---|---|---|
| Aviso de privacidad público | `src/app/privacidad/page.tsx` | Ruta `/privacidad`, sin sesión. 13 secciones: responsable, datos tratados, finalidades, datos sensibles, retención, quién los ve, transferencias, derechos ARCO (20 días hábiles + 10 de prórroga), exportación/eliminación, seguridad, almacenamiento local, menores y cambios. Versión **1.0**, vigente **16/11/2026**, contacto **hola@dietforge.com.mx**. Conforme a LFPDPPP. |
| Contrato del aviso | `src/lib/privacy.ts` | `PRIVACY_NOTICE_VERSION = "1.0"`, fecha, correo, frase de eliminación y validaciones puras de registro y confirmación. La página, el registro y el consentimiento comparten la misma versión. |
| Enlace en la app | `src/components/Layout.tsx`, `LoginScreen.tsx`, `ClientPortal.tsx`, `PortalAuth.tsx`, `auth/password` | Pie del espacio de trabajo (barra lateral), pie del login, encabezado del portal y pie del registro/activación. |
| Consentimiento en el registro | `src/components/PortalAuth.tsx`, `src/components/PrivacyConsentField.tsx` | Checkbox obligatorio con enlace a `/privacidad`. El botón queda deshabilitado y el alta se bloquea antes de `supabase.auth.signUp`; además se envía `privacy_notice_version`, `privacy_accepted_at` y `privacy_source` en `user_metadata`. |
| Consentimiento del coach invitado | `src/app/auth/password/page.tsx` | El coach no se registra solo (lo invita el administrador), por lo que la aceptación se exige al crear la contraseña y activar la cuenta. Sin aceptar no se habilita el acceso. |
| Registro autoritativo del consentimiento | `src/lib/privacy-client.ts` + RPC `dietforge_privacy_record_consent` | Fecha/hora del servidor y versión publicada. Si el alta queda pendiente de confirmar correo, la aceptación vive en `user_metadata` y se replica al entrar con sesión. |
| Perfil del titular | `src/app/(workspace)/cuenta/page.tsx`, `src/components/AccountPrivacy.tsx` | Accesible en **Sistema → Mi cuenta** y en el portal del cliente (**Privacidad y mis datos**). Muestra consentimiento, permite **Exportar mis datos** y **Eliminar mi cuenta** con doble confirmación (correo + palabra `ELIMINAR`). |
| Exportación | RPC `dietforge_privacy_export(uuid)` + `src/lib/privacy.ts` | JSON con cuenta, consentimiento, espacio, clientes/dietas/mediciones/check-ins/rutinas (`_dietforge_load_storage`), actividad, accesos al portal y solicitudes previas. Registra la solicitud en la bitácora. |
| Eliminación | RPC `dietforge_privacy_delete_account(uuid)` + `src/app/api/account/delete/route.ts` + `src/lib/server/account-privacy-handler.ts` | Purga `dietforge_backups` (snapshots), historial, notificaciones, vínculos del portal, registros, mutaciones y espacio de trabajo; retira acceso y suscripción. El servidor elimina videos, fotos de check-in y fotos de recetas (`training-videos`, `checkin-photos`, `recipe-photos`) y la identidad Auth con la service role. |
| Migración | `supabase/migrations/20261116010000_privacy_consent_and_deletion.sql` | Tablas `dietforge_privacy_notices`, `dietforge_privacy_consents` y `dietforge_privacy_requests`; RLS por `auth.uid()`; RPC de consentimiento, lectura, exportación y eliminación. Revoca `anon`; la cuenta administradora no puede autodestruirse desde la app. |
| Pruebas | `tests/privacy.test.ts`, `tests/portal-onboarding.test.ts`, `tests/account-privacy-ui.test.ts`, `tests/sql/privacy.sql` | Consentimiento obligatorio, confirmación doble, migración con RLS y purga de respaldos, orden del endpoint de eliminación, panel del titular y flujo completo del registro. |

## Cómo se validó localmente

- `npm test`: **121 pruebas en verde**.
- `npm run typecheck`, `npm run lint` y `npm run build`: aprobados.
- Build de producción servido localmente: `/privacidad` responde 200 con 13
  secciones; el login enlaza el aviso; el registro sin aceptar bloquea el botón y,
  al forzar el envío, muestra el aviso **sin** emitir la petición a
  `/auth/v1/signup` (Puppeteer, 1440×980).
- Migración aplicada sobre un Postgres 17 local con todas las migraciones del
  repo, `schema.sql`, `auth`/`storage` simulados y `auth.uid()` leyendo
  `request.jwt.claims`; `tests/sql/privacy.sql` pasó de punta a punta con
  `ROLLBACK`: consentimiento, exportación, purga de `dietforge_backups`,
  bloqueo a `anon` y prohibición de autodestruir al administrador.
- Panel del titular probado en JSDOM: exporta con `p_request_id`, exige correo y
  `ELIMINAR`, no llama al endpoint con confirmación inválida y cierra sesión al
  eliminar.
- No se creó ninguna cuenta en el Supabase de producción ni se aplicó la
  migración al proyecto vinculado.


La bitácora de privacidad (`dietforge_privacy_requests`) guarda correo, fecha y tipo
de solicitud hasta 5 años como evidencia de cumplimiento; no conserva datos
clínicos.

## Importación de check-ins del portal — 2026-11-16

Los check-ins que el cliente envía al portal viven en `dietforge_client_activity`.
El coach asignado puede copiarlos a su expediente con el botón **Importar al
check-in del cliente**; la copia es explícita, con confirmación en pantalla y sin
duplicados gracias al UUID de origen. No hay importación automática ni lectura
cruzada entre coaches.

- La bandeja solo se monta en la vista del coach (`/clients/[id]/care?tab=progress`);
  el portal del cliente no ofrece la acción. La lectura sigue protegida por
  `dietforge_portal_read` y sus RPC de acceso vigente.
- Se copian peso, notas, medidas, adherencia y fotos. La grasa corporal y el
  feedback del coach nunca se sobrescriben. Si el cliente no registró adherencia
  completa, no se completa a mano.
- Las fotos se guardan como referencia privada al objeto del bucket
  `checkin-photos`; al mostrarlas se genera una URL firmada de cinco minutos, así
  que no se persisten enlaces temporales.
- Borrar el check-in local elimina la referencia y sus fotos dentro del snapshot
  del coach; el archivo original del portal permanece porque pertenece a la
  actividad del cliente. La eliminación de cuenta sigue purgando el bucket con la
  service role según el flujo ya documentado.

## Qué falta antes de producción

1. **Aplicar la migración en Supabase** (local y luego producción) con el sí de
   Daniel: `supabase db push` o el flujo aprobado. Sin ella, el consentimiento
   solo queda en `user_metadata` y la exportación/eliminación responden error de
   función inexistente.
2. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` existe en Vercel (solo servidor) para
   que la eliminación retire archivos e identidad. No usa prefijo `NEXT_PUBLIC_`.
3. **Probar alta real con SMTP** y una cuenta de prueba: aceptar el aviso,
   confirmar correo, exportar JSON y eliminar la cuenta verificando que los
   respaldos desaparecen.
4. Revisar con abogado el texto y la identidad legal del responsable (razón social
   y domicilio fiscal); hoy el aviso declara la marca DietForge y el correo de
   contacto.
5. Definir el plazo de conservación con el coach (el aviso declara hasta 5 años
   como referencia de expediente de salud de la NOM-004-SSA3-2012).
6. Comunicar a los coaches existentes que sus clientes deben aceptar el aviso en
   el portal y documentar la aceptación de expedientes ya cargados.

## Nota de alcance

No existe registro público de coaches: las cuentas se crean por invitación del
administrador. Por eso el consentimiento del coach se captura al activar su
contraseña. Si en el futuro se abre un alta pública de coach, debe reutilizar
`PrivacyConsentField` y el mismo RPC.
