# Mapa de módulos

Este inventario indica dónde vive cada responsabilidad. Actualizarlo cuando se añada, elimine o cambie de función un módulo.

## Rutas

| Ruta | Entrada | Componente o función |
|---|---|---|
| `/` | `src/app/(workspace)/page.tsx` | `Dashboard` |
| `/clients` | `src/app/(workspace)/clients/page.tsx` | `ClientList` |
| `/clients/new` | `src/app/(workspace)/clients/new/page.tsx` | `ClientForm` |
| `/clients/[id]` | `src/app/(workspace)/clients/[id]/page.tsx` | `ClientDetail` |
| `/clients/[id]/edit` | `src/app/(workspace)/clients/[id]/edit/page.tsx` | `ClientForm` |
| `/clients/[id]/plan/week` | `src/app/(workspace)/clients/[id]/plan/week/page.tsx` | `WeekPlanView` |
| `/clients/[id]/training` | `src/app/(workspace)/clients/[id]/training/page.tsx` | `TrainingPlanner` |
| `/plans/[id]` | `src/app/(workspace)/plans/[id]/page.tsx` | `MealPlanner` |
| `/calculator` | `src/app/(workspace)/calculator/page.tsx` | `CalculatorPage` |
| `/foods` | `src/app/(workspace)/foods/page.tsx` | `FoodDB` |
| `/coach` | `src/app/(workspace)/coach/page.tsx` | `CoachDashboard` |
| `/reports` | `src/app/(workspace)/reports/page.tsx` | `Reports` |
| `/training` | `src/app/(workspace)/training/page.tsx` | `TrainingHub` |
| `/admin` | `src/app/(workspace)/admin/page.tsx` | `AdminPanel` |
| `/admin/login` | `src/app/admin/login/page.tsx` | redirección compatible al login único `/` |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | validación de correo y recuperación |
| `/auth/password` | `src/app/auth/password/page.tsx` | creación o cambio de contraseña |
| `/api/admin/coaches` | `src/app/api/admin/coaches/route.ts` | alta, renovación y eliminación administrativa |
| `/api/nutrition/[provider]` | `src/app/api/nutrition/[provider]/route.ts` | proxy USDA/FatSecret autenticado |

`src/app/layout.tsx` carga fuentes, estilos y metadatos. `src/app/(workspace)/layout.tsx` aplica los proveedores compartidos. `not-found.tsx`, `loading.tsx` y `error.tsx` cubren estados de ruta.

## Componentes

| Archivo | Responsabilidad principal | Se conecta con |
|---|---|---|
| `WorkspaceProviders.tsx` | orden de proveedores del área privada | Cloud, toast, suscripción y layout |
| `NumericInputNormalizer.tsx` | normalización global de campos numéricos controlados | `numeric-input`, DOM y eventos React |
| `CloudGate.tsx` | sesión, carga de cuenta, importación heredada y estado de guardado | Supabase Auth, `db`, `SaveQueue` |
| `LoginScreen.tsx` | login único por rol y recuperación; la primera activación solo llega por invitación | Supabase Auth, RPC `dietforge_is_admin`, `auth-role` |
| `SubscriptionGate.tsx` / `SubscriptionPage.tsx` | bloquea o explica acceso comercial | `SubscriptionContext` |
| `AdminPanel.tsx` | consola administrativa clínica: métricas, directorio, alta, periodos, suspensión, eliminación confirmada e historial | RPC Supabase y API `/admin/coaches` |
| `Layout.tsx` | navegación, tema y cierre de sesión | rutas, suscripción |
| `Dashboard.tsx` | panel clínico con métricas, clientes recientes, matriz de macros y acceso | clientes, planes, check-ins y cuenta desde `db`/suscripción |
| `ClientList.tsx` / `ClientForm.tsx` | directorio clínico, filtros, estados, alta y edición | `db.clients` |
| `ClientDetail.tsx` | expediente clínico, acciones, evolución y salida animada al abrir planes anteriores | mediciones, competencias, check-ins, planes, Peak Week |
| `CalculatorPage.tsx` | captura clínica de antropometría, gasto y macros | `calculator`, `metrics`, mediciones y planes |
| `MealPlanner.tsx` | entrada animada; edición Normal/Rest Day, alimentos, metas, PDF y plantillas | `db`, `meal-day`, `nutrition`, `pdf` |
| `FoodDB.tsx` | explorador, filtros, alta, ficha, importación y eliminación | `db.foods`, `NutritionWheel`, `nutrition`, APIs Next |
| `NutritionWheel.tsx` | rueda accesible, distribución energética, filtro dominante e información contextual | colección `Food`, `FoodDB` |
| `PeakWeekSimulator.tsx` | edición diaria de Peak Week | `peak-week`, `PeakCalendar` |
| `PeakCalendar.tsx` | cuadrícula mensual y selección por fecha | configuración Peak Week |
| `CompetitionPeakWeekEditor.tsx` | edición embebida desde competencia | `PeakWeekSimulator` |
| `WeekPlanView.tsx` / `BatchAssign.tsx` | planificación semanal adaptable y asignación múltiple | planes, carb cycle, `db` |
| `TrainingHub.tsx` | portafolio de bloques por cliente y métricas reales | clientes y `trainingPrograms` de `db` |
| `TrainingPlanner.tsx` | editor con días y metas de volumen independientes por semana, tabla de todos los músculos, progreso, biblioteca, feedback, guardado y PDF | `training`, `training-tracking`, `training-pdf`, `db`, catálogo incluido |
| `CheckInForm.tsx` / `CheckInHistory.tsx` | capturas y evolución | check-ins, fotos, tendencias |
| `CoachDashboard.tsx` | panel clínico de seguimiento del portafolio | clientes, check-ins, alertas |
| `Reports.tsx` | indicadores, gráficas y tabla operativa | tendencias, reporte, CSV |
| `Toast.tsx` | mensajes transitorios | cualquier componente bajo provider |
| `ui.tsx` | diálogos reutilizables | confirmaciones y texto |
| `LoadingScreen.tsx` | espera uniforme | Auth, datos y rutas |

## Lógica de dominio y servicios

| Archivo | Contrato |
|---|---|
| `src/types/index.ts` | tipos canónicos de todas las entidades y configuraciones |
| `src/lib/db.ts` | fachada CRUD síncrona, snapshot en memoria, importación y persistencia |
| `src/lib/cloud/model.ts` | forma y validación del snapshot; lectura heredada |
| `src/lib/cloud/repository.ts` | RPC de lectura/escritura ligada al token del propietario |
| `src/lib/cloud/engine.ts` | cola serial, reintento idempotente y estados ready/saving/error |
| `src/lib/supabase.ts` | cliente browser y consulta del acceso actual |
| `src/lib/subscription.ts` | logout seguro, utilidades de periodo y enlaces Stripe |
| `src/lib/email-access.ts` | valida códigos y enlaces permitidos sin solicitar URLs arbitrarias |
| `src/lib/server/admin-handler.ts` | alta Auth, renovación sin reinvitación y eliminación total autorizada |
| `src/lib/server/nutrition-handler.ts` | autenticación y proxy seguro de proveedores |
| `src/lib/meal-day.ts` | separación Normal/Rest, unidades, totales y metas reducidas |
| `src/lib/numeric-input.ts` | elimina ceros enteros redundantes sin romper vacío ni decimales |
| `src/lib/peak-week.ts` | fechas, macros diarios, guardado idempotente de siete planes |
| `src/lib/training.ts` | acceso canónico a días por semana, compatibilidad heredada, copia/redimensionado, volumen directo y validación de rutinas |
| `src/lib/training-pdf.ts` | salida A4 segura de una rutina, una semana por página |
| `src/lib/calculator.ts` | grasa corporal, TMB, TDEE, macros y distribución |
| `src/lib/metrics.ts` | IMC, FFMI, masa magra/grasa y mantenimiento |
| `src/lib/carbCycle.ts` | macros por tipo de día y promedio semanal |
| `src/lib/phases.ts` | requisitos, macros y duración por fase |
| `src/lib/trends.ts` | tendencia y velocidad de cambio de peso |
| `src/lib/progression.ts` | sugerencias de ajuste según progreso |
| `src/lib/alerts.ts` | alertas por ritmo, adherencia y ausencias |
| `src/lib/nutrition.ts` | búsqueda y normalización USDA, FatSecret y OpenFoodFacts |
| `src/lib/pdf.ts` | documento A4 imprimible del plan, totales, tablas y escape de contenido |
| `src/lib/progressReport.ts` | documento A4 del progreso y apertura aislada de la ventana de impresión |
| `src/lib/csv.ts` | CSV de mediciones y descarga |
| `src/lib/macro-evaluation.ts` | guarda evaluaciones sin crear check-ins y selecciona su historial para el carrusel |
| `src/lib/client-progress.ts` | resuelve la comparación de peso entre evaluación, primer check-in y check-ins siguientes |
| `src/lib/cloud/engine.ts` | cola de persistencia, estado de sincronización y criterio para mostrar solo alertas de error |
| `src/lib/openExternal.ts` | apertura de URLs desde el navegador |
| `src/data/training-exercises.json` | 463 ejercicios incluidos sin videos; se muestran dentro de “Mis ejercicios” junto con los personalizados del coach |
| `src/app/(workspace)/exercises/page.tsx` | Entrada privada a la base de ejercicios del coach |
| `src/components/ExerciseDB.tsx` | Alta, búsqueda, filtros, edición, eliminación y video de ejercicios persistentes |
| `supabase/migrations/20260908090000_exercise_catalog.sql` | Colección `exercises` en las RPC de carga y guardado cloud |

## Supabase

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260906010000_dietforge_cloud.sql` | workspaces, registros, mutaciones, RLS y RPC de snapshot |
| `supabase/migrations/20260906020000_admin_access.sql` | administradores, acceso, auditoría, periodos y protección de persistencia |
| `supabase/migrations/20260909010000_admin_delete_and_strict_expiry.sql` | vencimiento estricto y eliminación administrativa idempotente |
| `supabase/migrations/20260907030000_training_programs.sql` | colección `trainingPrograms` en snapshot, RPC y restricción de colecciones |
| `supabase/schema.sql` | esquema histórico/consolidado de suscripciones y funciones |
| `supabase/functions/check-subscription/index.ts` | función heredada de consulta de suscripción |
| `supabase/functions/stripe-webhook/index.ts` | eventos Stripe y actualización de suscripciones |
| `supabase/DEPLOY.md` | pasos operativos de Supabase |

## Pruebas

| Archivo | Cobertura |
|---|---|
| `cloud-account.test.ts` | aislamiento por cuenta, montaje de pantallas y flujo Normal/Rest Day |
| `cloud-queue.test.ts` | orden, revisión, reintento e idempotencia |
| `meal-day.test.ts` | unidades, totales, separación y reducción |
| `peak-week.test.ts` / `peak-calendar.test.ts` | siete fechas, macros, guardado y calendario |
| `training.test.ts` | volumen/frecuencia, copias independientes, validación, compatibilidad cloud y PDF seguro |
| `admin-handler.test.ts` | autorización, alta, renovación sin reinvitación, eliminación e idempotencia |
| `nutrition-api.test.ts` | autenticación, parámetros, proveedores y errores seguros |
| `email-access.test.ts` / `auth-errors.test.ts` | enlaces/códigos permitidos y mensajes de Auth |
| `domain-regression.test.ts` | cálculos críticos de dominio |
| `tests/sql/admin-access.sql` | políticas y periodos contra Supabase vinculado, con rollback |
| `web-smoke.mjs` | navegación en navegador cuando Chrome está disponible |

## Configuración y archivos heredados

- `.env.example`: nombres de variables requeridas, sin valores privados.
- `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.js`: compilación, calidad y encabezados defensivos HTTP.
- `docs/SECURITY_REVIEW.md`: revisión de amenazas, controles verificados y riesgos pendientes.
- `src/index.css`: tema, estilos globales y animaciones, incluidas comidas y Rest Day.
- `legacy/vite`: entradas anteriores preservadas; no se importan desde Next.js.
- `src-tauri`: aplicación de escritorio histórica; no participa en `npm run build`.

## Módulos de seguimiento (2026-09-08)

| Archivo | Responsabilidad |
|---|---|
| `ClientPortal.tsx`, `/portal` | Autenticación del cliente y selección del expediente autorizado |
| `ClientCare.tsx`, `/clients/[id]/care` | Integración de acceso, dieta, sesiones, check-ins y agenda |
| `SessionTracker.tsx`, `training-tracking.ts` | Captura real por semana/día, historial, validación, volumen directo/indirecto y métricas |
| `TrainingTools.tsx` | Plantillas, duplicación, progresión y comparación de volumen |
| `CareAgenda.tsx`, `AgendaHub.tsx`, `/agenda` | Calendario integrado por cliente |
| `client-portal.ts` | Contratos RPC del portal y actividad |
| `QualityPanel.tsx`, `/quality` | Listado, descarga, captura y restauración |
| `ErrorMonitor.tsx`, `error-monitor.ts` | Categorías de error en memoria de sesión |
| Migraciones `20260908*` | Autorización, portal, respaldos, versiones, videos privados y validación de agendas independientes por semana |
| `docs/TRAINING_WEEKS.md` | Contrato de semanas independientes, metas musculares y barras de cumplimiento |
| `tests/sql/client-portal.sql` | Regresiones reales de autorización y recuperación con rollback |
| `scripts/supabase-healthcheck.mjs` | Comprobación externa de disponibilidad sin datos privados |
| `.github/workflows/supabase-health.yml` | Programación cada tres días cuando el repositorio y sus secretos estén configurados |
| `20260908050000_healthcheck.sql` | RPC mínima de salud para anon y usuarios autenticados |

Detalle de conexión y límites: [CLIENT_CARE.md](CLIENT_CARE.md).

| Módulo añadido | Responsabilidad |
| --- | --- |
| `TrainingMedia.tsx`, `training-media.ts` | Edición, referencias YouTube, carga privada y reproducción firmada |
| `20260908060000_training_videos.sql` | Bucket privado y autorización por rutina activa |
| `tests/sql/training-videos.sql` | Aislamiento real de lectura/escritura de medios |
| `nutrition-normalization.ts` | Base g/ml verificable en resúmenes FatSecret |
| `tests/final-review.test.ts`, `tests/nutrition-normalization.test.ts` | Regresiones de rutina, progresión, CSV y porciones |
