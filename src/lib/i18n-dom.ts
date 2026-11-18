'use client';

import type { AppLanguage } from './language';

const ATTRS = ['placeholder', 'title', 'aria-label'] as const;

const ES_TO_EN: Record<string, string> = {
  // Generales y acciones
  'Guardar': 'Save',
  'Guardar cambios': 'Save changes',
  'Guardando…': 'Saving…',
  'Guardando...': 'Saving...',
  'Guardando automáticamente…': 'Auto-saving…',
  'Guardado automático': 'Auto-saved',
  'Cambios sin guardar': 'Unsaved changes',
  'Tienes cambios sin guardar': 'You have unsaved changes',
  'Seguir editando': 'Keep editing',
  'Descartar cambios': 'Discard changes',
  'Cancelar': 'Cancel',
  'Cerrar': 'Close',
  'Listo': 'Done',
  'Confirmar': 'Confirm',
  'Eliminar': 'Delete',
  'Duplicar': 'Duplicate',
  'Editar': 'Edit',
  'Nuevo': 'New',
  'Nueva': 'New',
  'Agregar': 'Add',
  'Quitar': 'Remove',
  'Buscar': 'Search',
  'Limpiar búsqueda': 'Clear search',
  'Filtrar': 'Filter',
  'Todos': 'All',
  'Todas': 'All',
  'Activa': 'Active',
  'Activo': 'Active',
  'Borrador': 'Draft',
  'Archivada': 'Archived',
  'Pendiente': 'Pending',
  'Vencidos': 'Expired',
  'Finalizada': 'Completed',
  'En curso': 'In progress',
  'Hecha': 'Done',
  'Hoy': 'Today',
  'Próximo': 'Next',
  'Historial': 'History',
  'Resumen': 'Summary',
  'Detalles': 'Details',
  'Notas': 'Notes',
  'Fecha': 'Date',
  'Estado': 'Status',
  'Acciones': 'Actions',
  'Nombre *': 'Name *',
  'Nombre': 'Name',
  'Correo': 'Email',
  'Teléfono': 'Phone',
  'Contraseña': 'Password',
  'Categoría': 'Category',
  'Unidad': 'Unit',
  'Cantidad': 'Quantity',
  'Porciones': 'Servings',
  'Por porción': 'Per serving',
  'Porción': 'Serving',
  'Tamaño de la porción': 'Serving size',
  'Unidad de porción': 'Serving unit',
  'Automático': 'Automatic',
  'Tiempo real': 'Real time',
  'Sincronización': 'Sync',
  'Reintentar': 'Retry',
  'Reintentar sincronización': 'Retry sync',
  'Sin datos': 'No data',
  'Sin resultados.': 'No results.',
  'No hay coincidencias': 'No matches',
  'Cargando…': 'Loading…',
  'Cargando foto…': 'Loading photo…',

  // Dashboard y Centro de Operaciones
  'Panel de Coach': 'Coach Dashboard',
  'Panel de control nutricional': 'Nutritional Control Panel',
  'CENTRO DE OPERACIONES': 'OPERATIONS CENTER',
  'SEGUIMIENTO DEL COACH': 'COACH FOLLOW-UP',
  'Seguimiento claro de clientes, planes y decisiones del día.': 'Clear tracking of clients, plans, and daily decisions.',
  'Revisa alertas, etiquetas y el estado reciente sin salir del Dashboard.': 'Review alerts, tags, and recent status right from the Dashboard.',
  'Total Clientes': 'Total Clients',
  'Clientes recientes y estado de plan': 'Recent clients and plan status',
  'Clientes que requieren atención': 'Clients requiring attention',
  'Check-ins esta semana': 'Check-ins this week',
  'Check-ins vencidos': 'Overdue check-ins',
  'Check-ins atrasados': 'Overdue check-ins',
  'Todos al día': 'All up to date',
  'Evaluaciones del coach': 'Coach evaluations',
  'Distribución de macros': 'Macro distribution',
  'Promedio energético de los planes guardados.': 'Average energy across saved plans.',
  'Estado del acceso': 'Access status',
  'Vencimiento actual': 'Current expiration',
  'Vencimiento': 'Expiration',
  'Salud de la sesión': 'Session health',
  'Adherencia': 'Adherence',
  'Sin clientes aún': 'No clients yet',
  'No hay clientes': 'No clients',
  'No hay clientes registrados': 'No registered clients',
  'No hay clientes pendientes': 'No pending clients',
  'Aún no hay planes. Calcula macros y crea el primer plan.': 'No plans yet. Calculate macros and create the first plan.',
  'Ve a la calculadora para establecer las metas.': 'Go to the calculator to set targets.',

  // Clientes y Expediente
  'Clientes': 'Clients',
  'Todos los Clientes': 'All Clients',
  'Nuevo cliente': 'New client',
  'Agregar cliente': 'Add client',
  'Buscar cliente...': 'Search client...',
  'Buscar cliente por nombre': 'Search client by name',
  'Buscar por nombre…': 'Search by name…',
  'Atención y organización de clientes': 'Client care and organization',
  'Expediente': 'Record',
  'Expediente clínico': 'Clinical record',
  'Volver al expediente': 'Back to record',
  'Volver al cliente': 'Back to client',
  'Cliente no encontrado': 'Client not found',
  'Cliente no disponible.': 'Client unavailable.',
  'El cliente que buscas no existe o fue eliminado.': 'The client you are looking for does not exist or was deleted.',
  'Eliminar cliente': 'Delete client',
  'Portal del cliente': 'Client portal',
  'Acceso del cliente': 'Client access',
  'Habilitar acceso': 'Enable access',
  'Revocar acceso': 'Revoke access',
  'Abrir portal': 'Open portal',
  'Copiar enlace': 'Copy link',
  'Copia y comparte el enlace del portal.': 'Copy and share the portal link.',
  'El cliente valida su correo una vez; después entra con contraseña.': 'The client verifies their email once; afterwards they sign in with a password.',
  'Pasos para activar tu acceso': 'Steps to activate your access',
  'Este paso es independiente de la Agenda.': 'This step is independent of the Schedule.',
  'Evaluación nutricional': 'Nutritional assessment',
  'Progreso corporal': 'Body progress',
  'EVOLUCIÓN DEL CLIENTE': 'CLIENT PROGRESS',
  'Curva biométrica de evolución': 'Biometric progress curve',
  'Peso, grasa corporal y tendencia reunidos en una sola lectura.': 'Weight, body fat, and trend combined in a single view.',
  'Peso y composición registrados en cada evaluación.': 'Weight and body composition recorded at each assessment.',
  'Registros reales y media móvil de los últimos 7 días.': 'Real entries and 7-day moving average.',
  'Media suavizada': 'Moving average',
  'Composición corporal': 'Body composition',
  'Check-in y medición': 'Check-in & measurement',
  'Check-in vencido': 'Overdue check-in',
  'Próximo check-in': 'Next check-in',
  'Periodo de chequeo': 'Check-in period',
  'Feedback del Coach': 'Coach Feedback',
  'Feedback del cliente': 'Client feedback',
  'Feedback y revisión': 'Feedback & review',
  'Escribe tu feedback para el cliente...': 'Write your feedback for the client...',
  'Escribe tu feedback...': 'Write your feedback...',
  'Aún no hay check-ins. Crea el primero.': 'No check-ins yet. Create the first one.',
  'Registra el primero para comenzar su seguimiento.': 'Log the first one to start tracking.',
  'Check-ins recibidos': 'Received check-ins',
  'CHECK-INS RECIBIDOS': 'RECEIVED CHECK-INS',
  'Medidas, adherencia y fotos que envía el cliente desde su portal.': 'Measurements, adherence, and photos sent by the client from their portal.',
  'Filtrar check-ins': 'Filter check-ins',
  'Confirmar importación': 'Confirm import',
  'Todos los check-ins recibidos ya están importados.': 'All received check-ins have already been imported.',
  'Editar check-in': 'Edit check-in',
  'Eliminar check-in': 'Delete check-in',
  'Calendario Peak Week': 'Peak Week Calendar',
  'Preparación de competencia': 'Competition prep',
  'Sin competencias registradas': 'No competitions recorded',
  'Eliminar competencia': 'Delete competition',
  'Portal, seguimiento y acceso del cliente →': 'Client portal, tracking & access →',
  'Volver a clientes': 'Back to clients',
  'Reporte Progreso': 'Progress Report',
  'Fases': 'Phases',
  'Ocultar Fases': 'Hide Phases',
  'Rutina': 'Routine',
  'Plan de Comidas': 'Meal Plan',
  '+ Plan de Comidas': '+ Meal Plan',
  'Déficit': 'Deficit',
  'Mantenimiento': 'Maintenance',
  'Volumen': 'Bulk',
  'Aumento': 'Gain',
  'Editar macros guardados': 'Edit saved macros',
  'Macros calculados': 'Calculated macros',
  'Guardar actualiza este cálculo; Cancelar conserva sus valores originales.': 'Save updates this calculation; Cancel keeps its original values.',
  'Revisa, ajusta y guarda para incorporarlos al historial.': 'Review, adjust, and save to add them to history.',
  'Objetivo energético': 'Energy target',
  'Pasos de 50 kcal · redistribuye P/C/G': '50 kcal steps · redistributes P/C/F',
  'Meta diaria': 'Daily target',
  'Meta de fibra': 'Fiber target',
  'Cantidad diaria': 'Daily amount',
  'Combustible y rendimiento': 'Fuel & performance',
  'Soporte hormonal': 'Hormonal support',
  'Saciedad y salud digestiva': 'Satiety & digestive health',
  'Óptimo': 'Optimal',
  'Meta ≥ 30 g': 'Target ≥ 30 g',
  'Carbohidratos': 'Carbohydrates',
  'Total kcal': 'Total kcal',
  'Sobran': 'Excess',
  'Faltan': 'Remaining',
  'Peso actual': 'Current weight',
  'Sin cambio comparativo': 'No comparative change',
  '· promedio de 7 días': '· 7-day average',
  '▲ Ocultar': '▲ Hide',
  '▼ Nuevo cálculo': '▼ New calculation',
  '▼ Instrucciones': '▼ Instructions',
  'Fase de Competencia': 'Competition Phase',
  'Calcular o guardar macros no registra un check-in. El peso, la composición y la tendencia solo cambian desde el seguimiento del cliente.': 'Calculating or saving macros does not log a check-in. Weight, body composition, and trends only change from client tracking.',
  'Los campos con': 'Fields marked with',
  'son obligatorios': 'are required',
  'Altura': 'Height',
  'Edad': 'Age',
  'Hombre': 'Male',
  'Mujer': 'Female',
  'Actividad': 'Activity',
  'Sedentario': 'Sedentary',
  'Ligero': 'Light',
  'Moderado': 'Moderate',
  'Muy activo': 'Very active',
  'Perder grasa — Déficit': 'Lose fat — Deficit',
  'Mantener peso': 'Maintain weight',
  'Ganar músculo — Volumen': 'Gain muscle — Bulk',
  'Subir de peso — Aumento': 'Gain weight — Surplus',
  'Pre/intra/post entrenamiento': 'Pre/intra/post workout',
  'Aplicar cambios': 'Apply changes',
  '+ Agregar competencia': '+ Add competition',
  'Agregar competencia': 'Add competition',
  'Exportar CSV': 'Export CSV',
  'Competencias': 'Competitions',
  'Competencia para Peak Week': 'Peak Week Competition',
  'Editar Competencia': 'Edit Competition',
  'Nueva Competencia': 'New Competition',
  '+ Generar plan de preparación': '+ Generate prep plan',
  'Usar': 'Use',
  'Ver': 'View',
  'Abriendo…': 'Opening…',
  '¿Eliminar este plan de dieta?': 'Delete this meal plan?',
  '¿Eliminar esta competencia?': 'Delete this competition?',

  // Dieta, Menús y Recetas
  'ALIMENTACIÓN PERSONALIZADA': 'PERSONALIZED NUTRITION',
  'Plan nutricional': 'Nutrition plan',
  'Plan de alimentación': 'Meal plan',
  'Apartados de dieta': 'Diet sections',
  'Opciones de alimentación': 'Meal options',
  'Menús y recetas': 'Menus & recipes',
  'Menús del cliente': 'Client menus',
  'Mis menús': 'My menus',
  'Mis recetas': 'My recipes',
  'Mis menús asignados': 'My assigned menus',
  'Agregar menú': 'Add menu',
  'Crear Menú 1': 'Create Menu 1',
  'Su primer menú empieza aquí': 'Your first menu starts here',
  'Crea alternativas diarias combinando alimentos y tus propias recetas.': 'Create daily alternatives combining foods and your own recipes.',
  'NOMBRE DEL MENÚ': 'MENU NAME',
  'Nombre del menú': 'Menu name',
  'Totales del menú': 'Menu totals',
  'Asignar al portal': 'Assign to portal',
  'Asignado al portal': 'Assigned to portal',
  'Visible en el portal': 'Visible in portal',
  'Agregar comida': 'Add meal',
  'Nombre de la comida': 'Meal name',
  'Sin tiempos de comida': 'No meal slots yet',
  'Agrega Desayuno, Comida o Cena para empezar a armar este menú.': 'Add Breakfast, Lunch, or Dinner to start building this menu.',
  'Eliminar menú': 'Delete menu',
  'Eliminar comida': 'Delete meal',
  'Quitar elemento': 'Remove item',
  'Quitar alimento': 'Remove food',
  'CATÁLOGO RÁPIDO': 'QUICK CATALOG',
  'Agregando a': 'Adding to',
  'Comida de destino': 'Target meal',
  'Selecciona una comida': 'Select a meal',
  'Biblioteca para la comida': 'Meal library',
  'Buscar para agregar': 'Search to add',
  'Buscar alimento…': 'Search food…',
  'Buscar alimento...': 'Search food...',
  'Buscar receta…': 'Search recipe…',
  'Buscar recetas': 'Search recipes',
  'Buscar en mi recetario…': 'Search my recipes…',
  'Nueva receta': 'New recipe',
  'Editar receta': 'Edit recipe',
  'Volver al recetario': 'Back to recipes',
  'Tu biblioteca privada, disponible para todos tus clientes.': 'Your private library, available for all your clients.',
  'Recetas que tus clientes querrán preparar': 'Recipes your clients will love to make',
  'Agrega una foto, los ingredientes y los pasos. El cálculo por porción es automático.': 'Add a photo, ingredients, and steps. Per-serving nutrition is calculated automatically.',
  'Ingredientes de la receta completa': 'Full recipe ingredients',
  'Explica los pasos para preparar la receta…': 'Explain the steps to prepare the recipe…',
  'Foto de la receta': 'Recipe photo',
  'Quitar foto': 'Remove photo',
  'Primero agrega alimentos a tu base para crear recetas.': 'Add foods to your database first to create recipes.',
  'Calorías': 'Calories',
  'Proteína': 'Protein',
  'Carbos': 'Carbs',
  'Grasas': 'Fats',
  'Fibra': 'Fiber',
  'Desayuno': 'Breakfast',
  'Comida': 'Lunch',
  'Cena': 'Dinner',
  'Colación': 'Snack',
  'Alimentos': 'Foods',
  'Recetas': 'Recipes',
  'Cargar Plantilla': 'Load Template',
  'Nombre de la plantilla': 'Template name',
  'No hay plantillas guardadas': 'No saved templates',
  'No hay plantillas guardadas. Crea una desde el plan de comidas.': 'No saved templates. Create one from the meal plan.',
  'Usar plantilla en cliente destino': 'Use template on target client',
  'Distribución por Comidas': 'Distribution by Meals',
  'Reducción Rest Day': 'Rest Day Reduction',
  'Reducción Rest Day (%)': 'Rest Day Reduction (%)',
  'Macros — Rest Day': 'Macros — Rest Day',
  'Macros Diarios': 'Daily Macros',
  'Macros ajustados por fase': 'Phase-adjusted macros',
  'Ajustar macros': 'Adjust macros',
  'Ajuste de macros': 'Macro adjustment',
  'Editar macros': 'Edit macros',
  'Guardar macros': 'Save macros',
  'Restaurar macros originales': 'Restore original macros',
  'Comparación de macros': 'Macro comparison',
  'No hay macros configurados': 'No macros configured',
  'Eliminar plan': 'Delete plan',
  'Eliminar todos los planes': 'Delete all plans',
  'Planes Anteriores': 'Previous Plans',
  'Nombre del plan': 'Plan name',
  'Plan no encontrado': 'Plan not found',
  'El plan de comidas no existe o fue eliminado.': 'The meal plan does not exist or was deleted.',

  // Alimentos
  'Explorador de alimentos': 'Food Explorer',
  'BIBLIOTECA NUTRICIONAL': 'NUTRITION LIBRARY',
  'Alimentos disponibles': 'Available foods',
  'Nuevo alimento': 'New food',
  'Buscar alimentos': 'Search foods',
  'Buscar en mis alimentos…': 'Search my foods…',
  'Filtrar por categoría': 'Filter by category',
  'Importar': 'Import',
  'Importar desde fuentes externas': 'Import from external sources',
  'Distribución del catálogo': 'Catalog distribution',
  'Fuentes más concentradas en tu base': 'Most concentrated sources in your database',
  'FICHA DEL ALIMENTO': 'FOOD DETAILS',
  'Información nutricional': 'Nutrition facts',
  'Valores nutricionales de la porción registrada': 'Nutrition values for the recorded serving',
  'Eliminar alimento': 'Delete food',
  'Cerrar información nutricional': 'Close nutrition facts',

  // Entrenamiento y Ejercicios
  'ENTRENAMIENTO': 'TRAINING',
  'BIBLIOTECA DE ENTRENAMIENTO': 'TRAINING LIBRARY',
  'MI BIBLIOTECA DE EJERCICIOS': 'MY EXERCISE LIBRARY',
  'Base de ejercicios': 'Exercise database',
  'Cómo usar la base de ejercicios': 'How to use the exercise database',
  'Buscar ejercicios': 'Search exercises',
  'Buscar ejercicio o músculo': 'Search exercise or muscle',
  'Buscar ejercicio o músculo…': 'Search exercise or muscle…',
  'Nombre del ejercicio': 'Exercise name',
  'Agregar video o personalizar': 'Add video or customize',
  'Eliminar ejercicio': 'Delete exercise',
  'Cambia los filtros o crea un ejercicio propio.': 'Change the filters or create a custom exercise.',
  'Rutinas personalizadas': 'Custom routines',
  'Rutinas del cliente': 'Client routines',
  'Entrenamiento por cliente': 'Training by client',
  'Bloques semanales, prescripción de series/RIR y control de volumen por músculo.': 'Weekly blocks, set/RIR prescription, and volume tracking per muscle.',
  'Abre un expediente de programación para crear o continuar una rutina.': 'Open a programming record to create or continue a routine.',
  'Registra un cliente antes de crear su rutina.': 'Register a client before creating their routine.',
  'Crea la primera rutina personalizada': 'Create the first custom routine',
  'Nueva rutina': 'New routine',
  'Eliminar rutina': 'Delete routine',
  'Duplicar rutina al cliente': 'Duplicate routine to client',
  'Guardar bloque como plantilla': 'Save block as template',
  'Publicar para el cliente': 'Publish to client',
  'Rutina en borrador': 'Draft routine',
  'Borrador · el cliente aún no la ve': 'Draft · hidden from client',
  'El cliente todavía no la ve': 'Not yet visible to client',
  'No hay rutinas publicadas.': 'No published routines.',
  'CONFIGURACIÓN DEL BLOQUE': 'BLOCK SETUP',
  'Control del bloque junto a los ejercicios de la semana.': 'Block controls alongside the week exercises.',
  'Distribución de series': 'Set distribution',
  'MATERIAL DE APOYO': 'SUPPORT MATERIAL',
  'Material de apoyo': 'Support material',
  'CIERRE DEL BLOQUE': 'BLOCK CLOSURE',
  'Semanas del mesociclo': 'Mesocycle weeks',
  'Semana de entrenamiento': 'Training week',
  'Guardar Semana': 'Save Week',
  'Esta semana aún no tiene días programados.': 'This week has no scheduled days yet.',
  'Agrega ejercicios desde tu biblioteca.': 'Add exercises from your library.',
  'Carga · Series · Reps · RIR': 'Load · Sets · Reps · RIR',
  'Series directas': 'Direct sets',
  'Series directas / meta': 'Direct sets / target',
  'Directas': 'Direct',
  'Indirectas': 'Indirect',
  'Frecuencia': 'Frequency',
  'Grupo prioritario': 'Priority group',
  'Músculo': 'Muscle',
  'Ejercicio': 'Exercise',
  'Serie': 'Set',
  'Reps reales': 'Actual reps',
  'RIR real': 'Actual RIR',
  'Mayor carga': 'Highest load',
  'Mayor número de reps': 'Most reps',
  'Registro de entrenamiento': 'Workout log',
  'Récords e historial por ejercicio': 'Records and history by exercise',
  'Iniciar registro': 'Start log',
  'Cerrar biblioteca': 'Close library',
  'Día de descanso.': 'Rest day.',
  'Nombre del día': 'Day name',
  'Notas del día': 'Day notes',

  // Calculadora y Antropometría
  'Calculadora de Macros': 'Macro Calculator',
  'Calcular Macros': 'Calculate Macros',
  'Estima gasto energético y distribuye macronutrientes con datos antropométricos.': 'Estimate energy expenditure and distribute macros using anthropometric data.',
  'Mediciones': 'Measurements',
  'Mediciones Corporales': 'Body Measurements',
  'ANÁLISIS CORPORAL': 'BODY ANALYSIS',
  'Peso': 'Weight',
  '% Grasa corporal': 'Body fat %',
  'Grasa corporal': 'Body fat',
  'Sexo': 'Sex',
  'Cintura': 'Waist',
  'Cadera': 'Hip',
  'Abdominal': 'Abdominal',
  'Brazo relajado': 'Relaxed arm',
  'Brazo flexionado': 'Flexed arm',
  'Muslo anterior': 'Front thigh',
  'Pantorrilla max': 'Max calf',
  'Pierna medial': 'Medial calf',
  'Bíceps': 'Biceps',
  'Tríceps': 'Triceps',
  'Subescapular': 'Subscapular',
  'Cresta ilíaca': 'Iliac crest',
  'Supraspinal': 'Supraspinal',
  'Pectoral': 'Chest',
  'Talla sentado': 'Sitting height',
  'Perímetros (cm)': 'Circumferences (cm)',
  'Diámetros óseos (cm)': 'Bone breadths (cm)',
  'Objetivo': 'Goal',
  'Modo de dieta': 'Diet mode',
  'Aumentar calorías': 'Increase calories',
  'Reducir calorías': 'Decrease calories',
  'Historial de cálculos': 'Calculation history',
  'Ver cálculo anterior': 'View previous calculation',
  'Ver cálculo más reciente': 'View latest calculation',
  'Proteína/kg': 'Protein/kg',
  'Patrón de Carb Cycling': 'Carb Cycling Pattern',
  'Tipo de carbohidrato': 'Carb type',

  // Reportes
  'Reportes': 'Reports',
  'Visión general del progreso de tus clientes': 'Overview of your clients’ progress',
  'Crecimiento de Clientes': 'Client Growth',
  'Altas por mes': 'New clients per month',
  'Estado de Clientes': 'Client Status',
  'Resumen de actividad': 'Activity summary',
  'Resumen por cliente': 'Summary by client',
  'Tasa de cumplimiento': 'Completion rate',
  'Nuevos este mes': 'New this month',
  'Con medición': 'With measurement',
  'Clientes con datos registrados': 'Clients with recorded data',
  'Clientes con ambos registros': 'Clients with both records',

  // Agenda
  'AGENDA DEL COACH': 'COACH SCHEDULE',
  'Citas y seguimiento por cliente': 'Appointments & follow-up by client',
  'Cliente de la agenda': 'Schedule client',
  'Mes anterior': 'Previous month',
  'Mes siguiente': 'Next month',
  'Mes del calendario': 'Calendar month',
  'Resumen del mes': 'Month summary',
  'Tipos de eventos': 'Event types',
  'Solicitar una cita': 'Request an appointment',
  'Solicitar cita': 'Request appointment',
  'Agendando…': 'Scheduling…',
  'Citas, Peak Week y check-ins del mes. Selecciona un día para ver el detalle.': 'Appointments, Peak Week, and check-ins for the month. Select a day to view details.',
  'No hay citas, Peak Week ni check-ins programados.': 'No appointments, Peak Week, or check-ins scheduled.',

  // Calidad y Respaldo
  'Calidad y respaldo': 'Quality & backup',
  'ARCHIVO ÚNICO (.JSON)': 'SINGLE FILE (.JSON)',
  'Descargar respaldo': 'Download backup',
  'Qué incluye tu respaldo descargable': 'What your downloadable backup includes',

  // Administración
  'Gestión de coaches y periodos de acceso': 'Coach & access period management',
  'Acceso exclusivo del administrador': 'Administrator-only access',
  'Tu cuenta no tiene permisos para administrar la plataforma.': 'Your account does not have permission to administer the platform.',
  'Coaches y accesos': 'Coaches & access',
  'DIRECTORIO': 'DIRECTORY',
  'AUDITORÍA': 'AUDIT LOG',
  'Historial administrativo': 'Admin history',
  'Buscar coach': 'Search coach',
  'Buscar por correo…': 'Search by email…',
  'Filtrar coaches por estado': 'Filter coaches by status',
  'Filtrar historial por tipo': 'Filter history by type',
  'Clientes / Planes': 'Clients / Plans',
  'Actualizando cuentas…': 'Updating accounts…',
  'No hay cuentas que coincidan con el filtro actual.': 'No accounts match the current filter.',
  'Confirmar correo para eliminar': 'Confirm email to delete',
  'Selecciona una cuenta': 'Select an account',
};

const PATTERN_RULES: Array<[RegExp, (...args: string[]) => string]> = [
  [/^Menú (\d+)$/, (_, n) => `Menu ${n}`],
  [/^Crear Menú (\d+)$/, (_, n) => `Create Menu ${n}`],
  [/^Semana (\d+)$/, (_, n) => `Week ${n}`],
  [/^Día (\d+)$/, (_, n) => `Day ${n}`],
  [/^Comida (\d+)$/, (_, n) => `Meal ${n}`],
  [/^(\d+) plan$/, (_, n) => `${n} plan`],
  [/^(\d+) planes$/, (_, n) => `${n} plans`],
  [/^(\d+) cliente$/, (_, n) => `${n} client`],
  [/^(\d+) clientes$/, (_, n) => `${n} clients`],
  [/^(\d+) comida$/, (_, n) => `${n} meal`],
  [/^(\d+) comidas$/, (_, n) => `${n} meals`],
  [/^(\d+) ejercicio$/, (_, n) => `${n} exercise`],
  [/^(\d+) ejercicios$/, (_, n) => `${n} exercises`],
  [/^(\d+) días programados$/, (_, n) => `${n} scheduled days`],
  [/^Por importar \((\d+)\)$/, (_, n) => `Pending import (${n})`],
  [/^Adherencia (\d+)%$/, (_, n) => `Adherence ${n}%`],
  [/^Eliminar «(.+)»$/, (_, name) => `Delete «${name}»`],
  [/^Eliminar receta (.+)$/, (_, name) => `Delete recipe ${name}`],
  [/^Eliminar (.+)$/, (_, name) => `Delete ${name}`],
  [/^Seleccionar (.+)$/, (_, name) => `Select ${name}`],
  [/^Variantes de comidas y recetario práctico para (.+)\.$/, (_, name) => `Meal variants and practical recipes for ${name}.`],
  [/^(\d+) registros$/, (_, n) => `${n} records`],
  [/^Cálculo (\d+) de (\d+)$/, (_, a, b) => `Calculation ${a} of ${b}`],
  [/^(\d+) semanas$/, (_, n) => `${n} weeks`],
  [/^Preparación ideal: 16-24 sem • (\d+) semanas restantes$/, (_, n) => `Ideal prep: 16-24 wks • ${n} weeks left`],
  [/^(\d+) check-ins · (\d+) competencias$/, (_, a, b) => `${a} check-ins · ${b} competitions`],
  [/^(.+) g\/kg de peso$/, (_, v) => `${v} g/kg body weight`],
  [/^Ajuste de fase \((.+)\)$/, (_, p) => `Phase adjustment (${p})`],
  [/^Ajuste sugerido — (.+)$/, (_, p) => `Suggested adjustment — ${p}`],
  [/^¿Eliminar TODOS los (\d+) planes de dieta\?$/, (_, n) => `Delete ALL ${n} meal plans?`],
  [/^(\d+) alimentos · (\d+) kcal$/, (_, a, b) => `${a} foods · ${b} kcal`],
];

export function translateTextToEnglish(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  let translated = ES_TO_EN[trimmed];
  if (!translated) {
    for (const [pattern, formatter] of PATTERN_RULES) {
      const match = trimmed.match(pattern);
      if (match) {
        translated = formatter(...match);
        break;
      }
    }
  }
  if (!translated) return raw;

  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);
  return `${leading}${translated}${trailing}`;
}

const originalTextMap = new WeakMap<Text, string>();
const appliedTextMap = new WeakMap<Text, string>();
const originalAttrMap = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], string>>>();

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (el.closest('script, style, code, pre, svg, [data-no-translate]')) return true;
  return false;
}

export function attachDomTranslator(root: HTMLElement, lang: AppLanguage): () => void {
  let applying = false;

  const processTextNode = (node: Text) => {
    if (shouldSkipElement(node.parentElement)) return;
    const current = node.nodeValue ?? '';

    if (lang === 'es') {
      const original = originalTextMap.get(node);
      if (original !== undefined && current === appliedTextMap.get(node)) {
        applying = true;
        node.nodeValue = original;
        applying = false;
        appliedTextMap.delete(node);
      }
      return;
    }

    // Track the latest Spanish source text if React changed the node.
    if (!originalTextMap.has(node) || current !== appliedTextMap.get(node)) {
      originalTextMap.set(node, current);
    }
    const source = originalTextMap.get(node) ?? current;
    const next = translateTextToEnglish(source);
    if (next !== current) {
      applying = true;
      node.nodeValue = next;
      applying = false;
      appliedTextMap.set(node, next);
    }
  };

  const processAttributes = (el: Element) => {
    if (shouldSkipElement(el)) return;
    let stored = originalAttrMap.get(el);

    for (const attr of ATTRS) {
      const current = el.getAttribute(attr);
      if (current === null) continue;

      if (lang === 'es') {
        const orig = stored?.[attr];
        if (orig !== undefined && current !== orig) {
          applying = true;
          el.setAttribute(attr, orig);
          applying = false;
        }
        continue;
      }

      if (!stored) {
        stored = {};
        originalAttrMap.set(el, stored);
      }
      if (stored[attr] === undefined) {
        stored[attr] = current;
      } else {
        const translatedStored = translateTextToEnglish(stored[attr]!);
        if (current !== translatedStored) {
          stored[attr] = current;
        }
      }
      const next = translateTextToEnglish(stored[attr]!);
      if (next !== current) {
        applying = true;
        el.setAttribute(attr, next);
        applying = false;
      }
    }
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node as Text);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (shouldSkipElement(el)) return;
      processAttributes(el);
      node.childNodes.forEach(walk);
    }
  };

  walk(root);

  if (lang === 'es' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    if (applying) return;
    for (const m of mutations) {
      if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
        processTextNode(m.target as Text);
      } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        processAttributes(m.target as Element);
      } else if (m.type === 'childList') {
        m.addedNodes.forEach(walk);
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });

  return () => observer.disconnect();
}
