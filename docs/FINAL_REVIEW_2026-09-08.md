# Revisión de cierre — 2026-09-08

## Correcciones

1. Catálogo heredado: `seedFoods` ya no reemplaza alimentos personalizados ni reinicia sus IDs al cambiar la versión. Solo inicializa catálogos vacíos sin semilla vigente.
2. Rutinas: semanas enteras 1–12, copias independientes de prescripciones y validación de todas las semanas al guardar, incluidas las ocultas. Fechas civiles imposibles y valores no finitos/negativos se rechazan.
3. Progresión: registros del mismo día no simulan dos exposiciones; la propuesta no baja una carga ya superior ni llama aumento a un redondeo sin cambio.
4. CSV: textos que podrían iniciar fórmulas se neutralizan; comas, comillas y saltos se escapan.
5. FatSecret: normaliza solo cantidades explícitas g/ml. Una porción sin peso no se convierte falsamente en 100 g; faltantes no se inventan como cero. La documentación oficial confirma que los alimentos de marca se resumen por porción: https://platform.fatsecret.com/docs/v1/foods.search . No se recalculan registros antiguos sin una base verificable.

## Validación

- 55 pruebas Node aprobadas; typecheck, ESLint y build Next aprobados.
- Auditoría de dependencias de producción: cero vulnerabilidades conocidas reportadas en esta ejecución. No equivale a auditoría de penetración.
- `tests/sql/client-portal.sql` y `tests/sql/training-videos.sql` ejecutadas contra Supabase con datos sintéticos y rollback.
- Navegador: dashboard, filtro de alimentos, separación Rest Day, material de entrenamiento y persistencia de referencia. Capturas escritorio 1440×900 y móvil 390×844. Las pruebas visuales usan componentes reales y backend simulado, no validan Auth/correo de producción.
- Nuevo material de videos descrito en [TRAINING_MEDIA.md](TRAINING_MEDIA.md).
- Semanas independientes, metas musculares y progreso descritos en [TRAINING_WEEKS.md](TRAINING_WEEKS.md); su SQL transaccional y revisión en Brave fueron aprobados.

## Límites pendientes

No afirmar 10/10 garantizado ni ausencia total de bugs. El resultado habilita beta interna controlada; los bloqueos de [BETA_READINESS.md](BETA_READINESS.md) siguen abiertos. Correo, subida/reproducción real de archivos, proveedores externos, impresión completa multidispositivo y aceptación con coach/cliente deben comprobarse en el despliegue definitivo.

## Video promocional

Recorrido editado de pantallas de DietForge con expedientes ficticios, rótulos y narración sintética en español. No es grabación continua ni evidencia de operaciones reales en Supabase. Artefactos y fuente: carpeta `outputs/dietforge` de la tarea Codex. No publicado en redes.
