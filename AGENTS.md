# Contexto operativo para agentes — DietForge

Este archivo es la entrada obligatoria para cualquier IA o persona que modifique el proyecto. La descripción detallada vive en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y el inventario en [docs/MODULE_MAP.md](docs/MODULE_MAP.md).

## Objetivo del producto

DietForge es una aplicación web para coaches de nutrición y entrenamiento. Administra clientes, mediciones, check-ins, alimentos, planes de comidas, Rest Day, ciclos de carbohidratos, Peak Week, rutinas por bloques, reportes y acceso comercial. La cuenta administradora pertenece a la identidad verificada configurada en Supabase; nunca se debe deducir el rol desde un correo enviado por el navegador.

## Tecnología y arranque

- Next.js 16 App Router, React 19, TypeScript y Tailwind CSS 4.
- Supabase Auth y Postgres mediante RPC para identidad, autorización y persistencia.
- Node.js 22 LTS recomendado; mínimo declarado: 20.9.
- Desarrollo: `npm run dev`.
- Validación requerida: `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.
- `.env.local` contiene la configuración de esta instalación. No sobrescribirlo ni publicar secretos.

## Orden de lectura

1. Este archivo.
2. `docs/ARCHITECTURE.md` para entender flujos y conexiones.
3. `docs/MODULE_MAP.md` para localizar la implementación.
4. `README.md` y `supabase/DEPLOY.md` para operación.
5. La memoria externa de DietForge en `/Users/daniellimones/Desktop/boveda/Proyectos/DietForge/documentacion/Estado.md` cuando esté disponible.

## Invariantes que no se deben romper

- El portal `/portal` usa autorización por expediente mediante RPC; nunca cargar el snapshot del coach desde el portal. Véase `docs/CLIENT_CARE.md`.
- Todas las pantallas de trabajo del coach pasan por `CloudGate`, `SubscriptionGate` y `CloudDataGate` antes de leer `db`.
- `auth.uid()` es la identidad propietaria. Cada consulta o escritura cloud debe permanecer aislada por esa identidad y por RLS/RPC.
- La clave `SUPABASE_SERVICE_ROLE_KEY` solo puede usarse en código de servidor. Nunca debe llevar el prefijo `NEXT_PUBLIC_`.
- `db` expone operaciones síncronas sobre un snapshot en memoria; cada mutación llama `persist()` y entra en `SaveQueue`.
- `SaveQueue` serializa escrituras con revisión esperada e ID de mutación. Un conflicto no puede sobrescribir silenciosamente datos remotos.
- Los respaldos pendientes y operaciones ambiguas se guardan por `ownerId`. Cambiar de cuenta desmonta la interfaz y desconecta el estado anterior.
- Plan Normal y Rest Day comparten un plan, pero sus alimentos se separan por `MealPlanItem.day_type`. Agregar o eliminar una comida de un día no debe cambiar el otro.
- Al apagar Rest Day, mantener temporalmente su columna montada durante la transición de unión; después desmontarla. `restDay` gobierna el modo y `restDayLayout` la presencia visual durante esos 1050 ms.
- El título de un plan nunca puede persistirse vacío. Si la edición queda en blanco se conserva el nombre anterior; un registro histórico vacío muestra `Plan sin título` y mantiene un control accesible para editarlo.
- El porcentaje de Rest Day modifica las metas mostradas; las cantidades y nutrientes reales de los alimentos no se reducen artificialmente.
- El control compacto de reducción Rest Day persiste `rd_percent_{planId}` y mantiene visible que el ajuste solo cambia las metas.
- Las unidades admitidas en comidas son gramos, mililitros, libras y pieza. Una libra equivale a `453.59237 g`; una pieza usa `Food.serving_size` como peso declarado.
- Una Peak Week siempre contiene los siete días terminando en la fecha de competencia. Guardar vuelve a usar el plan del mismo `competition_id` y `peak_week_date` para evitar duplicados.
- Una rutina pertenece a un cliente y guarda dentro del mismo registro sus días, ejercicios y prescripciones. `week_days` es la agenda canónica por semana; cada semana puede tener una cantidad y composición distinta de días. `days` conserva la semana 1 por compatibilidad. Toda lectura semanal debe pasar por `trainingDays`, y toda sustitución por `replaceTrainingDays`.
- `weekly_volume_targets` guarda metas editables por número de semana y grupo muscular. Las series directas suman todos los ejercicios de todos los días de la semana seleccionada; las indirectas se muestran aparte con su factor. Cambiar días, ejercicios o metas de una semana no puede modificar otra salvo que el coach use explícitamente “Copiar anterior” o “Aplicar a todas”.
- La fecha inicial de una rutina es fecha civil local. No derivarla con `toISOString()` porque puede avanzar un día respecto del coach.
- El resumen original de volumen es directo; el análisis ampliado separa volumen indirecto configurable. Volumen directo: suma las series del músculo principal de cada ejercicio y calcula frecuencia por número de sesiones. Es una ayuda para el coach, no una prescripción clínica automática.
- La biblioteca incluida es estática y trazable internamente a la hoja `Base de datos` del Excel de referencia: 463 ejercicios únicos, sin videos predeterminados. En la interfaz se integra bajo “Mis ejercicios” y no se muestra el nombre histórico del archivo. Cada coach decide si agrega YouTube o un archivo privado; ese contenido usa `video_custom`, `video_url` y `TrainingProgram.resources`. Ver `docs/TRAINING_MEDIA.md`. Personalizar una rutina no modifica la biblioteca global.
- Renovar acceso suma 1, 3 o 12 meses desde el vencimiento vigente si sigue activo, o desde la fecha actual si venció.
- `/` es el único acceso para coaches y administradores. Después de autenticar, consulta `dietforge_is_admin()` y dirige según el rol; nunca deducir el rol desde el correo. `/admin/login` solo redirige a `/` por compatibilidad.
- Los HTML imprimibles deben escapar cualquier texto de usuario, desconectar `window.opener` y conservar formato A4 con cortes de página controlados.
- Los campos `input[type="number"]` normalizan ceros iniciales mediante `NumericInputNormalizer`; el usuario puede vaciar el campo y escribir decimales sin quedar atrapado en valores como `050`. El mismo componente gobierna la zona derecha de 30 px para los steppers personalizados: mitad superior incrementa y mitad inferior decrementa respetando `min`, `max` y `step`. No reactivar los controles nativos blancos de WebKit.
- En impresión, no usar márgenes negativos para compensar `@page`. Las comidas pueden fragmentarse entre páginas por filas y cada fila debe permanecer íntegra.
- Los parámetros dinámicos de rutas deben validarse antes de llegar a los componentes.

## Modelo de datos resumido

`Client` es la raíz funcional. Sus identificadores conectan mediciones, competencias, check-ins, planes semanales, planes de comidas y rutinas. `MealPlanItem` conecta un plan con un alimento. Las fotos dependen de un check-in. Cada `TrainingProgram` contiene sus días, ejercicios y prescripciones semanales. Las plantillas y preferencias viven en el snapshot de la cuenta. Los tipos canónicos están en `src/types/index.ts`.

Supabase conserva el snapshot sin perder la forma histórica: `dietforge_workspaces` mantiene revisión y metadatos; `dietforge_records` almacena cada entidad por colección e ID; `dietforge_mutations` hace idempotentes los reintentos. Las tablas de acceso y auditoría son independientes de los datos nutricionales.

## Protocolo de cambios

- Antes de editar, revisar `git status` y no revertir cambios ajenos.
- Cuando cambie un contrato, flujo, ruta, colección, variable de entorno o relación, actualizar `docs/ARCHITECTURE.md` y `docs/MODULE_MAP.md` en la misma tarea.
- Una función nueva debe tener nombre y tipos que expliquen su contrato. Añadir comentarios cerca del código únicamente para invariantes, seguridad o razonamiento que no resulte evidente.
- Cada bug necesita una prueba de regresión cuando pueda reproducirse de forma determinista.
- No usar datos reales en pruebas ni llamar proveedores externos desde `npm test`.
- Dashboard, Base de Alimentos, Administración, Panel Coach, Calculadora, Reportes, Clientes y Planificación usan el sistema visual clínico definido al final de `src/index.css`: superficies claras, marca esmeralda y colores semánticos consistentes para proteína, carbohidratos y grasas. Toda pantalla nueva debe contemplar `.dark`, diseño adaptable y `prefers-reduced-motion`.
- En modo oscuro, Dieta y Planificación usan superficies carbón con matiz verde. Azul, índigo y violeta quedan reservados para información semántica como calorías o Rest Day, no para fondos estructurales.
- Tras un cambio, documentar resultado, causa cuando sea bug, archivos y validación en la memoria de DietForge; después ejecutar el sincronizador de la bóveda.

## Estado heredado

`legacy/vite` y `src-tauri` son referencia de la antigua aplicación de escritorio y no forman parte del build Next.js. No eliminarlos durante cambios ordinarios. `.next`, `dist` y `node_modules` son artefactos, no fuentes de arquitectura.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
