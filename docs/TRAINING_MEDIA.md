# Videos de entrenamiento — 2026-09-08

## Uso

Los 451 enlaces externos que venían del Excel se eliminaron del catálogo. Los 183 ejercicios base no tienen video automático ni referencia común. Cada coach decide qué demostración compartir y puede agregarla desde su base de ejercicios o directamente en una rutina.

En Rutina → Videos y material de apoyo, el coach puede revisar una referencia de YouTube, añadirla a la rutina o crear una explicación propia (RIR, calentamiento, uso del programa). Cada ejercicio permite reemplazar o complementar la guía con un video individual de YouTube o un archivo MP4/WebM/MOV de hasta 50 MB. Guardar la rutina publica ese video específico en el portal cuando su estado es activo.

Tampoco existen videos generales precargados para RIR o calentamiento. Cada recurso del bloque `Videos y material de apoyo` lo crea el coach y solo se publica al guardar la rutina.

## Conexiones y permisos

- `TrainingProgram.resources` conserva `{id,title,url}`; `TrainingExercise.video_url` conserva el enlace o `storage:owner_uuid/object_uuid.mp4`, con `video_custom:true` para contenido elegido por el coach.
- En `/exercises`, el botón **Video** de un movimiento incluido abre YouTube y subida privada; al guardar crea una copia del coach que reemplaza visualmente al registro incluido equivalente.
- `TrainingMedia.tsx` carga directamente a Supabase Storage con sesión del usuario. El bucket `training-videos` es privado; el servidor impone tamaño, MIME y carpeta del propietario.
- La RPC/política `dietforge_video_allowed` permite al coach con acceso leer sus archivos. El cliente solo lee objetos referenciados en una rutina activa de un expediente autorizado. No puede subir ni modificar archivos.
- `TrainingVideo` solicita un enlace firmado de 15 minutos al reproducir. No se guarda ese enlace temporal en el snapshot. Revocar acceso impide nuevas firmas; una firma ya emitida puede funcionar hasta su vencimiento.
- `SessionTracker` muestra material y técnica del día; `TrainingPlanner` edita; el snapshot y las plantillas transportan las referencias. Una copia en otra cuenta no obtiene acceso al archivo original.
- Los enlaces del Excel se conservan como historial, pero ya no se asignan ni se muestran automáticamente. La biblioteca mantiene los ejercicios.
- Quitar una asignación no elimina el archivo, porque podría estar referenciado por otra rutina o respaldo. La limpieza física requiere futura gestión de archivos/retención; el almacenamiento sí consume la cuota de Supabase.
- El PDF solo incluye enlaces HTTPS elegidos para ejercicios; los archivos privados se reproducen desde el portal, sin introducir firmas caducables en el documento.

## Evidencia y límites

`tests/exercise-catalog.test.ts` comprueba que los 183 registros no tengan video predeterminado. `tests/training-media.test.ts` comprueba URLs, marcas de tiempo, hosts falsos, límites y la selección explícita del coach. `tests/sql/training-videos.sql` prueba permisos reales con identidades sintéticas y rollback: coach inserta, cliente lee solo asignado, cliente no inserta, borrador revoca y tercero no lee. Migración `20260908060000` aplicada.

El navegador confirmó añadir una referencia, guardar y volver a abrirla; escritorio sin desbordamiento y móvil con diferencia máxima de 1 px en rutina. No se ha completado una subida/reproducción de archivo real desde la cuenta de un coach en el dominio de producción; sigue siendo prueba de aceptación antes de beta pública. MOV depende de los códecs del dispositivo; MP4 H.264/AAC es la opción de intercambio preferida.
