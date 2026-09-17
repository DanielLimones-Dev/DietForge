# DietForge

Web en **Next.js 16 (App Router), React 19, TypeScript y Tailwind CSS 4**. Los clientes, medidas, nutrición, rutinas y preferencias se guardan en el espacio de cada cuenta de Supabase.

## Contexto técnico

Antes de modificar el sistema, leer [AGENTS.md](AGENTS.md). La explicación completa de cómo funciona y cómo se conectan autenticación, acceso, datos, planes, Rest Day, Peak Week, administración y proveedores está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). El archivo [docs/MODULE_MAP.md](docs/MODULE_MAP.md) permite localizar cada ruta, componente, servicio, migración y prueba.

## Arranque

Usar Node.js 22 LTS o posterior compatible y npm. Next.js requiere como mínimo Node 20.9; algunas herramientas de desarrollo requieren Node 20.19 o superior.

```sh
npm ci
cp .env.example .env.local  # solo en una instalación nueva
# Completar las variables de .env.local.
npm run dev
```

En esta instalación `.env.local` ya contiene la configuración migrada. **No sobrescribirlo.** Abrir http://localhost:3000. La aplicación carga la sesión y los datos antes de montar las pantallas privadas.

## Producción y validación

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run start
```

Se requiere un servidor compatible con Next.js. No es una exportación HTML estática: las búsquedas nutricionales tienen Route Handlers. Esta migración no publica un dominio.

`npm test` usa datos ficticios y servicios simulados, sin modificar la base real. `tests/web-smoke.mjs` contiene una prueba de navegador cuya ejecución completa quedó pendiente porque el entorno impidió lanzar Chrome. La pantalla de acceso sí se comprobó con el navegador integrado. ESLint conserva visibles advertencias de los componentes existentes; las excepciones están limitadas a sus archivos.

## Estructura

- `src/app/(workspace)`: las rutas de trabajo, incluyendo clientes, nutrición y entrenamiento con identificadores dinámicos.
- `src/app/api/nutrition/[provider]`: proxy autenticado USDA/FatSecret con secretos en el servidor.
- `src/app/auth/callback`: recepción opcional de enlaces con `token_hash`.
- `src/components`: interfaz y proveedores interactivos; las páginas y el layout principal son Server Components.
- `src/lib/cloud`: repositorio Supabase, validación, revisiones y reintentos idempotentes.
- `supabase`: esquema, migraciones y funciones de suscripción existentes.
- `legacy/vite` y `src-tauri`: archivos de escritorio conservados como referencia; no participan en el build web.

El layout compartido mantiene la sesión y la cola durante la navegación. Cambiar de cuenta desmonta las pantallas anteriores. Las peticiones cloud quedan asociadas al token del propietario; una respuesta antigua no reemplaza la cuenta actual.

## Configuración

Solo son públicas la URL y clave pública/anon de Supabase y los enlaces de pago Stripe. `FATSECRET_CONSUMER_KEY`, `FATSECRET_CONSUMER_SECRET`, `FATSECRET_WORKER` y `USDA_API_KEY` se leen en el servidor. Nunca usar una clave `service_role` en el frontend.

En Supabase Auth permitir los orígenes locales usados y, al publicar, el dominio HTTPS definitivo. Se soportan enlaces estándar y pegado manual de código/enlace. El alta administrativa envía la invitación para validar el correo y crear la primera contraseña; el login no permite solicitar esa activación manualmente. `Olvidé mi contraseña` permanece disponible para cuentas activadas. Las pruebas automatizadas no envían correos.

Si existe `FATSECRET_WORKER`, se conserva ese proveedor a través de Next.js; en caso contrario se usan las credenciales OAuth. La base de alimentos propia sigue disponible si un proveedor falla.

Se conservan las tablas, RLS, datos importados y suscripciones anteriores. El control comercial de suscripciones sigue en el flujo existente; endurecerlo en el servidor es una mejora separada antes de una venta pública.

## Conservación

Existe un respaldo privado del código y configuración anteriores. Las entradas Vite se movieron a `legacy/vite`; la pantalla de suscripción pasó a `src/components/SubscriptionPage.tsx` para evitar que Next la interpretara como Pages Router. No se reimportaron ni eliminaron datos de Supabase ni de la app instalada.

La evidencia y el historial se registran en la memoria de DietForge en la bóveda.

## Administración de coaches (2026-09-06)

Administradores y coaches entran en `/` con correo y contraseña. El login consulta el rol real contra `dietforge_admins` mediante Supabase y dirige automáticamente al área correspondiente; no crea cuentas automáticamente. `/admin/login` redirige al acceso único por compatibilidad.

En `/admin`, dar de alta el correo y registrar el periodo pagado: 1, 3 o 12 meses. Renovar suma desde el vencimiento vigente o desde ahora si ya venció. Al vencer un periodo pagado, el acceso se bloquea hasta registrar otra renovación. Suspender conserva datos; retirar suspensión no extiende el periodo. El panel registra pagos manualmente y no hace cargos. Al dar de alta un correo nuevo, activa el periodo y Supabase envía automáticamente una invitación: el coach abre el enlace, valida su correo y crea su propia contraseña. Después entra normalmente desde `/`; una renovación conserva esa contraseña y no vuelve a enviar invitación. El administrador también puede eliminar permanentemente una cuenta después de escribir el correo exacto; se retiran datos, acceso, videos e identidad Auth. También puede usar `Olvidé mi contraseña`.

Configurar `SUPABASE_SERVICE_ROLE_KEY` únicamente en el servidor, nunca como `NEXT_PUBLIC_`. Aplicar `supabase/migrations/20260906020000_admin_access.sql` al proyecto correspondiente (esta instalación ya está aplicada). El UUID administrador de esta migración es específico de esta instalación.

Verificación: `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`. Prueba SQL transaccional: `supabase db query --linked --file tests/sql/admin-access.sql --output json`; requiere un coach confirmado de prueba/existente y revierte todos sus cambios.

Vista local actual: http://127.0.0.1:3003/. No se ha publicado un dominio.

## Rutinas personalizadas (2026-09-07)

`/training` abre el portafolio de entrenamiento y cada expediente enlaza a `/clients/[id]/training`. El editor usa el esquema de **M1 Rotacion 1**: bloque, rotación, prioridades, split, semanas, días, ejercicios, series, repeticiones, RIR, volumen directo y feedback. “Mis ejercicios” reúne los 183 movimientos incluidos y los ejercicios personalizados del coach, sin videos predeterminados. El botón **Video** de cualquier movimiento incluido crea una personalización del coach con YouTube o archivo privado y sustituye la ficha incluida sin duplicarla. Las rutinas se guardan en la colección `trainingPrograms` de Supabase y se pueden imprimir en formato A4.

La migración `20260907030000_training_programs.sql` está aplicada en la instalación vinculada. El historial remoto de las tres migraciones está sincronizado con el repositorio.
