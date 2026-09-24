# Menús y recetas — implementación local

Alcance aprobado en conversación: nueva pestaña independiente en Dieta, sin convertir planes existentes. Menús numerados sin límite de seis, renombrables/duplicables, comidas con alimentos y recetas con fotos. Biblioteca privada por coach. Portal muestra sólo menús asignados, elección diaria e historial de comidas aislado. Implementar local sin publicar ni aplicar migraciones remotas.

## Contrato
- `Recipe`, `RecipeIngredient`, `MenuEntry`, `MenuMeal`, `ClientMenu` en `src/types/diet-menus.ts`. Ingredientes y recetas insertadas son copias; nutrientes desde alimentos por 100g y rendimiento, sin contar el resumen otra vez.
- Colecciones `recipes`/`clientMenus` compatibles con snapshots previos; getters copia y mutaciones validadas con cola existente. `MealPlan` y `MealPlanItem` permanecen iguales.
- Fotos en bucket privado `recipe-photos`, paths owner UUID/photo UUID.jpg, sin imágenes en snapshot. Lectura cliente sólo por menús asignados. Migración local explícita, no aplicada a producción.
- `dietforge_menus_read(o,c)` devuelve `{menus,days}`; `dietforge_menu_day_save(o,c,d,m,completed)` guarda selección/comidas por día. Cambio de menú con comidas completas exige confirmación en UI y registro independiente en servidor.

## Tareas y propiedad
- [x] Dominio/db: agente portal_checkin_form, archivos tipos/diet-menus, lib/diet-menus, cloud/model, db y tests/diet-menus. Pruebas totales, porciones, copias, legacy, no alteración planes actuales.
- [x] SQL: agente review_protocol, migración y tests SQL exclusivos. Autorización, proyección, fotos, retiros, diarios; revisión cruzada final.
- [x] UI/integración: coordinador, DietWorkspace + DietMenus + RecipeEditor + componentes foto/portal, CSS acotado, subpestañas dentro del editor de Dieta. Plan actual montado conservando su estado al alternar pestañas.
- [ ] Prueba local: coach crea menús 1–7, duplica/renombra, crea receta e inserta porciones, prueba persistencia y portal; fotos/elección con fixtures y Brave. No llamadas reales en tests.
- [ ] Validación final: unitarias, typecheck, lint, build, revisión independiente. Documentar límites backend local/SQL y no publicar.

## Fallos a cubrir
Cantidad vacía/no finita; duplicado con arrays compartidos; eliminar receta sin alterar copia; cambio de menú con completadas; acceso a biblioteca/foto ajena; coexistencia de menús y Plan Normal/Rest Day sin mezclar totales.

## Evidencia y límites
102 pruebas iniciales aprobadas, más regresión JSDOM de guardado lento/error. SQL validado con 16 migraciones en PostgreSQL temporal PGlite y rollback; sin conexión a Supabase real. Brave: siete menús, alta de receta con foto sintética y rendimiento de dos porciones (185 kcal), tema oscuro. Fotos reales/portal requieren aplicar migración en un entorno autorizado. No publicado.

Aclaración final: sin apartado ni enlace separado en expediente. Menús y recetas se abre como subpestaña dentro del editor de Dieta (/plans/[id]); ambos paneles permanecen montados. La vista dev reproduce esa navegación con una explicación del plan habitual, sin modificar datos reales.

## Cierre del lote
- Subpestañas dentro de Dieta verificadas en Brave: Plan de alimentación / Menús y recetas. Se retiró el enlace y ruta independientes. Revisión y prueba JSDOM por portal_checkin_form: cambio conserva estado y URL.
- Estilos enlazados a tokens existentes df-surface/text/muted/line y color-brand; colores claros/oscuros, botones y bordes consistentes.
- Compilación Webpack aprobada. Turbopack bloqueado por puertos internos del sandbox (EPERM), no presentado como fallo de aplicación.
- Validación visual móvil y JWT/Storage reales pendientes; no se certifican desde mocks. Preview local en http://127.0.0.1:3012/dev/menus.
- Agentes: portal_checkin_form (dominio, revisión UI y pruebas); review_protocol (SQL y ejecución local). Hallazgos de bloqueo de guardado, falso éxito y unidades corregidos y comprobados.

Ajuste de ubicación solicitado: pestañas dentro de la pantalla Planificación (/plans/[id]), debajo de la cabecera del plan nutricional. Cabecera, controles Rest Day y diálogos originales conservados; el plan permanece montado al cambiar a Menús y recetas. Sólo local.

Corrección visual tras comparación en Brave /plans/2: se reemplaza la paleta df por clinical (la usada por MealPlanner), encabezado con el mismo degradado verde-negro, tarjetas de comidas con cabecera degradada y filas soft, fuentes y botones 14 px. Retirado el contenedor exterior adicional. Verificado visualmente claro/oscuro en el plan, sin modificar sus alimentos ni guardar el borrador.

Distribución corregida según plan de alimentación: botón agregar comida arriba, tarjetas apiladas a izquierda y biblioteca lateral derecha con destino y pestañas alimentos/recetas. Selector persistente al añadir varias entradas. En móvil biblioteca debajo (sin superposición). Verificado desktop en Brave demo; tipos/lint aprobados.

Bug selección alimento: Brave mostró una única comida y biblioteca deshabilitada con picker nulo. Corregido destino automático cuando hay una comida y al crearla; botones visibles Agregar alimento/receta en cada tarjeta. Revisor portal_checkin_form actualizó regresión de destino, nueva comida y eliminación; 3/3 aprobadas. Tipos/lint aprobados.

Retirados por solicitud del usuario: ruta /dev/menus y componente MenusPreview, además del botón Agregar alimento en tarjetas. La biblioteca lateral y la selección automática siguen disponibles en Planificación.

Lote final: alerta nativa sustituida por dialog modal unsaved, Seguir editando/Descartar, Escape conserva datos; prueba JSDOM aprobada. Filas MealPlanner reflejan resumen izquierda + cantidad/unidad/basura derecha con densidad reducida (padding vertical8/control32), observadas en Brave /plans/2. Gramaje válido se aplica onChange con updateMealPlanItem/setPlan, valores vacíos no corrompen último válido; conversiones usan item fresco. Agentes portal_checkin_form implementó filas/tiempo real, review_protocol validó alerta y añadió test. Tipos/lint y 7 pruebas enfocadas aprobadas antes del último ajuste de densidad; tipos/lint final aprobados. Sin publicar.
