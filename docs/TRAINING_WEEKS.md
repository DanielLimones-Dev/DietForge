# Semanas, volumen y progreso de entrenamiento

## Agenda independiente

`TrainingProgram.week_days` relaciona cada número de semana con su propia lista de días. Por eso semana 1 puede tener cinco días y semana 2 tres. `trainingDays(program, week)` es la única lectura válida; `replaceTrainingDays` actualiza una semana y sincroniza `days` únicamente cuando se edita la semana 1. Los programas heredados se materializan mediante `independentTrainingProgram` sin borrar su estructura original.

“Copiar anterior” reemplaza la agenda de la semana actual por una copia profunda de la anterior. El coach puede modificarla después sin afectar la fuente. “Aplicar a todas” copia la prescripción visible solo a las apariciones del mismo ejercicio que ya existen en las demás semanas.

## Series semanales

La columna **Directas** suma las series prescritas de todos los ejercicios de todos los días de la semana seleccionada, agrupadas por `muscle_group`. Si Pectoral tiene 4 series el lunes y 3 el jueves, muestra 7 y frecuencia de 2 días.

Los músculos seleccionados dentro del icono de ajustes participan en **Indirectas**. Cada uno suma `series × indirect_factor`; este dato se informa aparte y no completa la meta directa.

`weekly_volume_targets` tiene la forma `{ "1": { "Pectoral": 12 }, "2": { "Pectoral": 15 } }`. La barra muscular usa `min(100, directas / meta × 100)`. La barra general compara la suma de series directas con la suma de metas de esa semana. Una meta igual a cero se presenta como “Sin meta”.

La vista usa una matriz compacta de cinco tarjetas por fila en escritorio. Cada tarjeta conserva nombre y estado, meta semanal con botones `− / +`, series directas, indirectas y efectivas, barra de progreso, frecuencia y diferencia. Baja a cuatro, tres, dos o una columna según el ancho; no oculta grupos con cero series. El campo central usa `data-plain-number` para evitar duplicar el control de flechas global, porque esta tarjeta ya expone botones accesibles propios.

## Portal y Supabase

El cliente puede registrar carga, repeticiones, RIR, series completadas, fatiga y notas. No puede cambiar días, ejercicios, metas ni prescripciones. La RPC `dietforge_activity_save` obtiene los días desde `dietforge_program_days(programa, semana)`, exige una rutina activa y reconstruye en servidor las metas canónicas antes de guardar.

La migración `20260908070000_independent_training_weeks.sql` mantiene compatibilidad con rutinas que solo contienen `days` y amplía la política de videos privados para ejercicios almacenados dentro de `week_days`.

## Biblioteca y videos

`/exercises` es la base persistente del coach. `ExerciseDB` permite crear, buscar, filtrar, editar y eliminar registros propios con nombre, grupo principal, indicaciones y video. La colección `exercises` viaja en el snapshot por `db`, `SaveQueue` y las RPC de Supabase. Las cuentas antiguas reciben una colección vacía al validar su snapshot; la migración `20260908090000_exercise_catalog.sql` amplía las colecciones remotas sin modificar datos anteriores.

“Mis ejercicios” combina primero los movimientos personalizados del coach (`coach-<id>`) y después los 463 movimientos incluidos. Permanece abierta después de añadir un ejercicio para permitir selección múltiple y el pie muestra el número agregado al día activo. Al insertar un ejercicio personalizado, se copian nombre, músculo, indicaciones y video dentro de la rutina. Editar o eliminar posteriormente la ficha del catálogo no cambia las rutinas ya entregadas.

El catálogo base no asigna videos. Cada coach puede agregar el suyo con `TrainingVideoEditor`; los enlaces pasan por `youtubeUrl` y los archivos MP4, WebM o MOV de hasta 50 MB se guardan en el bucket privado `training-videos`. La rutina conserva solamente `storage:<ruta>` y el portal genera una URL firmada temporal al abrirlo. Si no se agrega video, el cliente y el PDF muestran el ejercicio sin enlace.

Mientras la biblioteca está abierta, `TrainingPlanner` bloquea el scroll de `html/body`, compensa la barra vertical y lo restaura al cerrar. La lista lateral conserva scroll interno, el diálogo declara `aria-modal` y `Esc` lo cierra.
