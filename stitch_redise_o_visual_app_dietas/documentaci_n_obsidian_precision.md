# Sistema de Diseño: Obsidian Precision
## DietForge Pro - Visual Identity

Este documento detalla los estilos visuales utilizados en la interfaz "Obsidian Precision", enfocados en un rendimiento de alto nivel y una estética minimalista ultra-profesional.

### 1. Paleta de Colores (Obsidian Dark)

El sistema utiliza una jerarquía de superficies basada en tonos carbón y grafito para crear profundidad sin ruidos visuales.

| Token | Color | Uso |
|---|---|---|
| **Surface** | `#111318` | Fondo principal de la aplicación. |
| **Surface Dim** | `#111318` | Fondos de secciones menos prominentes. |
| **Surface Container** | `#1A1C20` | Tarjetas, paneles laterales y contenedores de contenido. |
| **Primary** | `#0EA5E9` | Acciones principales, indicadores de progreso y estados activos. |
| **Accent (Cian)** | `#2DD4BF` | Acentos visuales en gradientes y datos positivos. |
| **Text Primary** | `#FFFFFF` | Títulos y lectura principal (Alta énfasis). |
| **Text Secondary** | `#94A3B8` | Subtítulos, etiquetas y meta-datos (Medio énfasis). |
| **Outline** | `#37393E` | Bordes finos de 0.5px - 1px para separación de elementos. |

### 2. Tipografía

La legibilidad es clave para la gestión de datos precisos.

- **Fuente:** `Hanken Grotesk` (Sans-serif moderna).
- **Escala:**
  - **Headlines:** Medium/Bold (700). Tracking: -0.02em.
  - **Body:** Regular (400) para lectura larga.
  - **Labels:** Medium (500) en All Caps para micro-copy.

### 3. Componentes y Estructura

- **Navegación:** Barra lateral persistente de 256px (`w-64`) con fondo con efecto *glassmorphism* (backdrop-blur).
- **Radio de Borde:** `Rounded-lg` (8px) para un balance entre suavidad y rigor.
- **Efectos:** Sombras suaves y bordes ultra-finos (`border-[0.5px] border-white/10`) para delimitar superficies sin añadir peso visual.

### 4. Guía de Aplicación
Para mantener el look "Obsidian":
1. Usa el color cian selectivamente; menos es más.
2. Prioriza el espacio en blanco (aire) entre secciones para evitar la saturación de datos.
3. Utiliza gradientes lineales sutiles (`#0EA5E9` a `#2DD4BF`) solo en elementos de éxito o progreso principal.