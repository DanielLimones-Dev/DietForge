# La Oficina · Rediseño profesional con menú superior

> Documento de diseño para `oficina-local.html` (Three.js, 23 agentes).
> Objetivo: que al abrir la página se vea **de inmediato** un menú superior con 6 secciones
> (Oficina · Chat · Pizarrón · Entregas · Bitácora · Medidores), sin romper la lógica JS existente
> y sin perder la vista 3D ni los nombres grandes.

---

## 0. Diagnóstico: por qué "los estilos anteriores no se notaban nada"

Revisé el CSS actual (líneas 7–709) y el marcado (713–870). Los problemas son estructurales, no de detalle:

| Problema | Evidencia en el archivo | Efecto |
|---|---|---|
| Todas las superficies son casi el mismo color | `--bg #0a0e14`, `--bg2 #0d131b`, `--panel #111822`, `--panel2 #0d141d`, `--panel3 #151d28` | Diferencia de luminancia de ~2–4 %: el ojo no distingue cabecera, paneles ni fondo. |
| Bordes casi invisibles | `--line #202b38` sobre `#111822` | Los paneles "se funden"; nada parece clicable ni separado. |
| No hay navegación | No existe `<nav>`; la cabecera `.top` solo tiene marca, estado y reloj | No hay nada que "ver" como menú. |
| Todo queda bajo el pliegue | `.stage-wrap{height:calc(100vh - 78px)}` y `.dash` va **debajo** | Al abrir solo se ve el 3D; Medidores, Entregas, Pizarrón, Bitácora, Recap y la consola OpenCode quedan escondidos y hay que hacer scroll sin saber que existen. |
| 14 botones iguales encima del 3D | `.controls` con `min-height:52px` todos con el mismo estilo | Ruido visual: proyectos, cámara, demo y permisos se ven idénticos. |
| El acento compite con un estado | `--accent:#3b82f6` es el mismo azul de "Trabajando" | El acento no comunica "seleccionado": se confunde con un estado de agente. |

**Principio del rediseño:** tres niveles de superficie con saltos de luminancia claros,
un menú en una barra **más clara que todo lo demás** con un indicador de sección activa
de color propio (índigo, que no se usa para ningún estado), y un layout de
**3D siempre visible + panel lateral (dock) que cambia según la pestaña**.

---

## 1. Paleta (códigos hex exactos)

### 1.1 Superficies (de más oscura a más clara)

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0E1116` | Fondo de la app y fondo detrás del canvas 3D |
| `--panel-inset` | `#0F1319` | Inputs, selects, barras de progreso vacías, transcript del Inspector |
| `--panel` | `#151A21` | Dock lateral y cuerpos de panel |
| `--header` | `#161B22` | Fila 1: cabecera con marca/estado |
| `--panel-raised` | `#1D2430` | Cabeceras de panel, tarjetas (entregas, meter-row, board-card), botones secundarios |
| `--nav` | `#1F2733` | **Fila 2: barra del menú** (la superficie más clara de la página → se ve al instante) |
| `--nav-hover` | `#28323F` | Hover de pestaña |
| `--nav-active` | `#2D3550` | Fondo de la pestaña activa (tinte índigo) |

### 1.2 Líneas

| Token | Hex | Uso |
|---|---|---|
| `--line` | `#2A3341` | Separadores internos, borde de paneles |
| `--line-strong` | `#3A4658` | Borde de controles interactivos (botones, inputs, badges) |
| `--line-hover` | `#4A5870` | Borde en hover |

### 1.3 Texto

| Token | Hex | Contraste aprox. sobre `#151A21` | Uso |
|---|---|---|---|
| `--ink` | `#F2F5F9` | 16:1 | Títulos, nombres de agentes, valores |
| `--ink2` | `#C3CCD8` | 11:1 | Texto de cuerpo, pestañas inactivas |
| `--muted` | `#8B97A8` | 6:1 (AA) | Metadatos, etiquetas en mayúsculas |
| `--faint` | `#5E6A7B` | 3.3:1 | Placeholders, atajos `kbd` (solo decorativo) |

### 1.4 Acento (selección, foco, acción primaria)

| Token | Hex | Uso |
|---|---|---|
| `--accent` | `#7B82FF` | Subrayado de pestaña activa, anillo de foco, iconos activos |
| `--accent-strong` | `#5B61F0` | Fondo de botón primario (texto blanco, 4.9:1) |
| `--accent-hover` | `#6A70F5` | Hover de botón primario |
| `--accent-ink` | `#D9DBFF` | Texto sobre fondos con tinte índigo |
| `--accent-soft` | `rgba(123,130,255,.16)` | Fondos con tinte (toggles `.on`, badge de no leídos) |

> El índigo se eligió porque **no coincide con ningún estado del 3D** (azul, ámbar, rojo, verde)
> ni con el violeta claro de los DMs (`#c3b3ef`). Así "activo/seleccionado" nunca se confunde con "Trabajando".

### 1.5 Estados semánticos (se mantienen idénticos a los del 3D)

| Estado | Sólido (punto, barra) | Texto | Fondo suave | Borde |
|---|---|---|---|---|
| Trabajando | `#3B82F6` | `#9EC5FF` | `rgba(59,130,246,.16)` | `rgba(59,130,246,.50)` |
| Por revisar | `#F59E0B` | `#FCD38A` | `rgba(245,158,11,.16)` | `rgba(245,158,11,.55)` |
| Con cambios | `#EF4444` | `#FCA5A5` | `rgba(239,68,68,.16)` | `rgba(239,68,68,.55)` |
| Libre / OK / EN VIVO | `#22C55E` | `#86EFAC` | `rgba(34,197,94,.15)` | `rgba(34,197,94,.50)` |
| Info (bitácora) | `#38BDF8` | `#A8D8F5` | `rgba(56,189,248,.14)` | `rgba(56,189,248,.45)` |
| Conectando / neutro | `#8B97A8` | `#C3CCD8` | `#222A36` | `#3A4658` |

Los colores de oficina del listado de agentes (`#f59e0b` Patrón, `#f5d547` Segundo,
`#818cf8` Chalanes, `#a78bfa` Subagentes) se conservan: están en `style="--oc:…"` del HTML.

---

## 2. Tipografía

**Familias**

```css
--sans: "Inter", "SF Pro Text", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
--mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```

En macOS sin Inter instalado cae a SF Pro (vía `system-ui`), que se ve igual de profesional; no hace falta
cargar fuentes de red. Si se quiere Inter exacto, añadir un `<link>` a Google Fonts (opcional).

**Escala** (px · peso · interlineado · tracking)

| Rol | Tamaño | Peso | Notas |
|---|---|---|---|
| Marca `h1` "La Oficina" | 22 | 750 | `letter-spacing:-.01em` |
| Subtítulo marca | 11.5 | 650 | MAYÚSCULAS, `.14em`, `--muted` |
| **Pestaña del menú** | 15 | 600 | Sentence case, `--ink2`; activa `#FFFFFF` 650 |
| Contador en pestaña | 12 | 700 | mono tabular |
| Título de sección en dock (`.panel-title b`) | 20 | 700 | `--ink`, sin mayúsculas forzadas |
| Etiqueta de grupo (`office-label`, `tool-label`, `mh`) | 11.5 | 700 | MAYÚSCULAS, `.12em`, `--muted` |
| **Nombre de agente** (`.agent-row .name`) | **19** | 650 | Se mantiene grande (antes 18) |
| Nombre en Inspector (`.insp-head .t`) | 22 | 700 | |
| Nombre en chat (`.chat-name`) | 17 | 650 | |
| Nombre en medidores (`.m-name`) | 17 | 650 | |
| Cuerpo (chat, entregas, bitácora) | 15–16 | 400 | interlineado 1.55 |
| Metadatos (hora, modelo, ms) | 12–13 | 500 | mono, `--muted`, `font-variant-numeric:tabular-nums` |
| Cifras grandes (recap, medidores) | 28 | 700 | mono tabular |

---

## 3. Layout general

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [3D] La Oficina            ● EN VIVO  actualizado 10:42 · 38 ms   🔊  10:42:07│  ← .app-header  56px  #161B22
│      PATRÓN DANIEL · 23 AGENTES                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▣ Oficina 23 │ 💬 Chat +3 │ ▤ Pizarrón 7 │ 📦 Entregas 2● │ ≣ Bitácora │ ◔ Medidores ●│ ⟩ │ ← .app-nav 52px #1F2733
│ ━━━━━━━━━━━━                                                                  │     subrayado índigo 3px
├───────────────────────────────────────────────────────┬──────────────────────┤
│ [Proyecto: RepForge DietForge Suplementos]             │ DOCK (cambia según   │
│ [Vista: Centrar Girar Arriba + −] [Demo Permiso …]     │ la pestaña)          │
│                                     Días sin incidente │                      │
│                                                        │  Oficina → Agentes   │
│                 ESCENA 3D (siempre visible)            │  Chat → Chat         │
│                                                        │  Pizarrón → 3 cols   │
│                                                        │  Entregas → lista    │
│ ● Trabajando ● Por revisar ● Con cambios ● Libre       │  Bitácora → Recap+log│
│                                   Arrastra para girar… │  Medidores → tabla + │
│                                                        │       OpenCode       │
└───────────────────────────────────────────────────────┴──────────────────────┘
   alto = 100dvh − 108px; la página ya no necesita scroll en escritorio
```

**Decisiones clave**

1. **Dos filas fijas arriba** (`.shell-top`, `position:sticky; top:0`): cabecera (56 px) + menú (52 px).
   `--shell-h: 108px`. El menú está en una fila propia y es la superficie más clara → imposible no verlo.
2. **El 3D nunca se oculta.** Solo cambia de ancho. `#stage` está observado por `ResizeObserver`
   (línea ~2655) y `resize()` recalcula renderer y cámara solo. Si se usara `display:none`,
   `clientWidth` sería 0 y el renderer caería al tamaño de respaldo 800×520: por eso **no** se oculta.
3. **Dock lateral derecho** con un solo panel visible a la vez (las pestañas muestran/ocultan vistas).
   Ancho por sección:
   - Oficina: 440 px (lista de agentes con nombres grandes)
   - Chat, Entregas, Bitácora: 500 px
   - Pizarrón, Medidores: `min(880px, 56vw)` (3 columnas / tabla de 4 columnas + iframe)
   - Botón `⟩` al final del menú: colapsa el dock en la vista Oficina para ver el 3D a pantalla completa.
4. **Todo lo que estaba bajo el pliegue entra en el dock**: Recap va arriba de Bitácora; la consola
   "OpenCode en vivo" va al final de Medidores. El pie `.foot` se elimina (su texto pasa a `title` del logo).
5. **Inspector** sigue siendo modal (`#inspBackdrop`), **"Te necesita"** (`#permStack`) sigue flotando arriba a la
   derecha bajo el menú, y el **banner de incidente** sigue abajo al centro. Solo se ajusta su `top`.

---

## 4. Menú superior (especificación)

### 4.1 Anatomía de una pestaña

```
┌───────────────────────────┐
│  [icono 18px]  Entregas  (2)  1 │   alto 52px · padding 0 18px · gap 10px
└───────────────────────────┘
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   activo: barra inferior 3px #7B82FF + fondo #2D3550 + texto #FFF
```

| Estado | Fondo | Texto | Icono | Borde/indicador |
|---|---|---|---|---|
| Normal | transparente sobre `#1F2733` | `#C3CCD8` | `#8B97A8` | — |
| Hover | `#28323F` | `#F2F5F9` | `#C3CCD8` | — |
| **Activo** | `#2D3550` | `#FFFFFF` peso 650 | `#7B82FF` | barra inferior 3 px `#7B82FF`, `box-shadow: inset 0 -3px 0 #7B82FF` |
| Foco teclado | igual que hover | | | `outline:2px solid #7B82FF; outline-offset:-4px` |

Separadores verticales de 1 px `#2A3341` entre pestañas (no en la activa).

Iconos: SVG inline de 18 px, trazo 2 px, `currentColor` (estilo Lucide):
Oficina `building-2`, Chat `message-square`, Pizarrón `kanban-square`, Entregas `package-check`,
Bitácora `scroll-text`, Medidores `gauge`.

Atajo `kbd` (1–6) a la derecha de cada pestaña: 11 px mono, `#5E6A7B`, borde `#3A4658`, radio 4 px.
Se oculta en < 1200 px.

### 4.2 Contadores en las pestañas (colores distintos por significado)

Se **espejan** los badges que el JS ya actualiza, con `MutationObserver` (sin tocar el JS original):

| Pestaña | Fuente | Estilo del contador |
|---|---|---|
| Oficina | `#agentCount` | Neutro: `#222A36` / `#C3CCD8` |
| Chat | `#chatCount` → no leídos desde la última visita | Índigo `#5B61F0` / `#FFFFFF`, formato `+3`; oculto si 0 |
| Pizarrón | `#taskCount` | Azul trabajo: fondo `rgba(59,130,246,.16)`, texto `#9EC5FF` |
| Entregas | `#deliveryCount` | **Ámbar sólido** `#F59E0B` / texto `#1A1205` con pulso suave si > 0 (son cosas que esperan a Daniel) |
| Bitácora | `#logCount` + punto verde "en vivo" | Neutro + punto `#22C55E` |
| Medidores | `#meterStatus` | Solo punto: verde `#22C55E` si hay datos, gris `#5E6A7B` si dice "sin datos" |

### 4.3 Comportamiento

- Clic en pestaña → `setView(nombre)`: marca pestaña, muestra su vista en el dock, oculta las demás.
- La vista elegida se recuerda (`localStorage['oficina-ui-view']`) y se puede enlazar con `#chat`, `#medidores`, etc.
- Teclado: `1`–`6` cambian de sección (si no se está escribiendo en un input/select y no hay modal abierto);
  `←`/`→` mueven el foco dentro del menú (patrón *roving tabindex* de ARIA tabs).
- **Chat**: el panel `#chatPanel` lo sigue abriendo/cerrando **solo** la función existente `chatToggle`
  (vía `#chatBtn.click()`), así se conserva el `chatRender()` y la clase `.on`. Si el usuario pulsa "Cerrar"
  dentro del chat, el menú vuelve a "Oficina" automáticamente (observando el atributo `hidden`).

---

## 5. Jerarquía visual

1. **Nivel 1 – Lo que exige acción**: tarjetas "Te necesita" (borde ámbar 1.5 px, sombra nivel 3),
   banner de incidente (rojo), contador ámbar de Entregas en el menú.
2. **Nivel 2 – Navegación y estado global**: menú (superficie más clara), chip EN VIVO/CAÍDO
   (relleno de color, no solo texto), reloj.
3. **Nivel 3 – Contenido de la sección**: título de 20 px en la cabecera del dock, nombres de agentes 19 px.
4. **Nivel 4 – Herramientas del 3D**: barra flotante agrupada y translúcida sobre la escena.
5. **Nivel 5 – Metadatos**: horas, modelos, ms, en mono 12–13 px `#8B97A8`.

Cuando la conexión cae, toda la cabecera lo dice: `.app-header:has(.live-chip.off)` recibe una línea roja
inferior de 2 px `#EF4444` (no requiere JS; `:has` funciona en Safari/Chrome actuales).

---

## 6. Botones

Altura mínima: 44 px (HUD y acciones), 36 px (`.mini`). Radio 10 px (`.mini` 8 px). Fuente 15 px 600.

| Variante | Fondo | Borde | Texto | Hover | Uso |
|---|---|---|---|---|---|
| `.btn` (secundario) | `#1D2430` | `#3A4658` | `#F2F5F9` | fondo `#253041`, borde `#4A5870` | Cámara, demo, filtros |
| `.btn.primary` | `#5B61F0` | `#6D74F7` | `#FFFFFF` | `#6A70F5` | Enviar tarea (agent-form) |
| `.btn.on` (toggle activo) | `rgba(123,130,255,.16)` | `#7B82FF` | `#D9DBFF` | — | Modo demo encendido, Chat abierto |
| `.btn.approve` | `#15803D` | `#22C55E` | `#F0FFF6` | `#16A34A` | Aprobar entrega |
| `.btn.changes` | `rgba(245,158,11,.16)` | `rgba(245,158,11,.55)` | `#FCD38A` | fondo `.24`, borde `.8` | Pedir cambios |
| `.btn.danger` | `rgba(239,68,68,.14)` | `rgba(239,68,68,.55)` | `#FCA5A5` | fondo `.22` | Limpiar chat |
| `.btn.ghost` | transparente | transparente | `#C3CCD8` | fondo `#253041` | Cerrar, colapsar dock |
| `.btn.proj` | `#1D2430` + punto de color del proyecto | `#3A4658` | `#F2F5F9` | | RepForge `#a78bfa`, DietForge `#22c55e`, Suplementos `#f59e0b` |
| `:disabled` | opacidad .45, sin sombra, `cursor:not-allowed` | | | | |

Foco: `outline:2px solid #7B82FF; outline-offset:2px` en todos.
Pulsado: `transform:translateY(1px)`.

**Barra de herramientas del 3D** (sustituye a los 14 botones iguales): tres grupos en "píldoras" translúcidas
`rgba(21,26,33,.88)` + `backdrop-filter:blur(10px)`, borde `#2A3341`, radio 14 px, con una etiqueta de grupo:

- **PROYECTO**: RepForge · DietForge · Suplementos
- **VISTA**: Centrar · Girar · Arriba · + · − (los dos últimos como botones cuadrados 44×44)
- **ACCIONES**: Modo demo · Simular permiso · Terminar reunión* · Todo claro* · 🔊 Sonido
  (*aparecen solo cuando el JS les quita `hidden`)

`#chatBtn` se conserva en el DOM con `hidden` (el JS lo necesita y alterna su clase `.on`); el usuario usa la pestaña Chat.

---

## 7. Badges y pills de estado

| Componente | Estilo |
|---|---|
| `.badge` (neutro) | 12.5 px 600, fondo `#222A36`, borde `#3A4658`, texto `#C3CCD8`, radio 999, padding 4×11 |
| `.badge.live-now` | verde: fondo `rgba(34,197,94,.15)`, borde `rgba(34,197,94,.5)`, texto `#86EFAC`, MAYÚSCULAS 11.5 px |
| `.pill.working/.review/.changes/.free` | colores de la tabla 1.5, **con punto de 7 px** (`::before`) del color sólido, 11.5 px 700 MAYÚSCULAS |
| `.pill` (sin estado) | neutro |
| `.live-tag.on` | verde como `live-now` |
| Chip de conexión `.live-chip` | Conectando: fondo `#222A36`, borde `#3A4658`, texto `#C3CCD8`, punto gris parpadeante. **EN VIVO** (`.ok`): fondo `#0F2A1A`, borde `#22C55E`, texto `#86EFAC`, punto verde con pulso. **CAÍDO** (`.off`): fondo `#2A1214`, borde `#EF4444`, texto `#FCA5A5`, punto rojo fijo |
| `.meet-chip.show` | ámbar: fondo `#2A1F0A`, borde `rgba(245,158,11,.6)`, texto `#FCD38A` |
| `.incident-sign` / `.bad` | verde / rojo con los mismos tokens |

---

## 8. Sombras, bordes y radios

```css
--r-xs: 6px;  --r-sm: 8px;  --r: 10px;  --r-lg: 14px;  --r-pill: 999px;

--shadow-1: inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.40);   /* botones, badges, tarjetas */
--shadow-2: 0 4px 14px rgba(0,0,0,.38);                                       /* barra HUD, menú */
--shadow-3: 0 24px 60px rgba(0,0,0,.58);                                      /* modal Inspector, "Te necesita", incidente */
--shadow-nav: 0 8px 18px -10px rgba(0,0,0,.75);                               /* separa el menú del 3D */
```

- Paneles dentro del dock: **sin** radio ni sombra (el dock es la superficie); separación con `1px solid #2A3341`.
- Tarjetas dentro de paneles (entrega, meter-row, board-col, recap-stat): fondo `#1D2430`, borde `#2A3341`, radio 10 px, `--shadow-1`; hover borde `#3A4658`.
- Dock: `border-left:1px solid #2A3341` + `box-shadow:-12px 0 28px -18px rgba(0,0,0,.7)`.
- Cabecera de cada vista del dock: fondo `#1D2430`, borde inferior `#2A3341`, `position:sticky; top:0` dentro del scroll del dock.

---

## 9. Mapeo de secciones → contenido existente

| Pestaña | Contenido (elementos existentes que se mueven, **sin cambiar IDs**) |
|---|---|
| **Oficina** | Panel Agentes (`#agentList`, `#agentCount`, `#sumBadge`, los 4 `officeBlock-*`). El 3D a la izquierda siempre. |
| **Chat** | `#chatPanel` completo (`#chatBody`, `#chatCount`, `#chatAgentFilter`, `#chatProjectFilter`, `#chatSearch`, `#chatClearBtn`, `#chatCloseBtn`) incrustado en el dock en vez de flotar. |
| **Pizarrón** | Panel Pizarrón (`#tasks`, `#taskCount`) — las 3 columnas caben con el dock ancho. |
| **Entregas** | Panel Entregas (`#deliveries`, `#deliveryCount`). |
| **Bitácora** | Panel Recap (`#recapGrid`, `#recapDate`) arriba como fila de cifras + Panel Bitácora (`#log`, `#logCount`, `#recapBtn`) ocupando el resto. |
| **Medidores** | Panel Medidores (`#metersGrid`, `#meterStatus`) + "OpenCode en vivo" (iframe :4096). |
| Fuera del menú | Inspector (modal), Te necesita (flotante), Incidente (banner + tinte), cabecera con estado/reloj/sonido (`#muteBtn2` pasa a la cabecera). |

---

## 10. Implementación

### 10.1 HTML (sustituye las líneas 713–831; todo lo demás queda igual)

```html
<div class="shell-top">
  <header class="app-header top">
    <div class="brand">
      <div class="logo" title="La Oficina · escena isométrica 3D · 23 agentes · poll de salud cada 5 s">3D</div>
      <div>
        <h1>La Oficina</h1>
        <small>Patrón Daniel · 23 agentes</small>
      </div>
    </div>
    <div class="live">
      <span class="live-chip" id="liveBadge"><i class="dot"></i><span id="liveText">CONECTANDO</span></span>
      <span class="live-meta" id="liveMeta" aria-live="polite">esperando primer sondeo…</span>
      <button class="btn mini ghost" type="button" id="muteBtn2" aria-pressed="false">🔊 Sonido</button>
      <span class="clock" id="clock">--:--:--</span>
    </div>
  </header>

  <nav class="app-nav" aria-label="Secciones de la oficina">
    <div class="nav-tabs" role="tablist">
      <button class="nav-tab" role="tab" type="button" data-view="oficina" aria-controls="view-oficina">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- building-2 --></svg>
        <span class="nav-label">Oficina</span><span class="nav-count" data-tone="neutral"></span><kbd>1</kbd>
      </button>
      <button class="nav-tab" role="tab" type="button" data-view="chat" aria-controls="view-chat">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- message-square --></svg>
        <span class="nav-label">Chat</span><span class="nav-count" data-tone="accent" hidden></span><kbd>2</kbd>
      </button>
      <button class="nav-tab" role="tab" type="button" data-view="pizarron" aria-controls="view-pizarron">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- kanban-square --></svg>
        <span class="nav-label">Pizarrón</span><span class="nav-count" data-tone="work"></span><kbd>3</kbd>
      </button>
      <button class="nav-tab" role="tab" type="button" data-view="entregas" aria-controls="view-entregas">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- package-check --></svg>
        <span class="nav-label">Entregas</span><span class="nav-count" data-tone="attn"></span><kbd>4</kbd>
      </button>
      <button class="nav-tab" role="tab" type="button" data-view="bitacora" aria-controls="view-bitacora">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- scroll-text --></svg>
        <span class="nav-label">Bitácora</span><i class="nav-dot is-live" aria-hidden="true"></i><span class="nav-count" data-tone="neutral"></span><kbd>5</kbd>
      </button>
      <button class="nav-tab" role="tab" type="button" data-view="medidores" aria-controls="view-medidores">
        <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true"><!-- gauge --></svg>
        <span class="nav-label">Medidores</span><i class="nav-dot" id="navMeterDot" aria-hidden="true"></i><kbd>6</kbd>
      </button>
    </div>
    <button class="btn mini ghost nav-collapse" type="button" id="dockToggle" aria-pressed="false"
            title="Ocultar/mostrar panel lateral">⟩ Panel</button>
  </nav>
</div>

<div class="workspace" id="workspace" data-view="oficina">
  <div class="stage-wrap" id="stageWrap">
    <div id="stage"></div>
    <div class="hud-left">
      <div class="controls toolbar">
        <div class="tool-group" role="group" aria-label="Lanzar proyecto">
          <span class="tool-label">Proyecto</span>
          <button class="btn proj" type="button" data-project="RepForge">RepForge</button>
          <button class="btn proj" type="button" data-project="DietForge">DietForge</button>
          <button class="btn proj" type="button" data-project="Suplementos">Suplementos</button>
        </div>
        <div class="tool-group" role="group" aria-label="Cámara">
          <span class="tool-label">Vista</span>
          <button class="btn" type="button" id="camBtn">Centrar</button>
          <button class="btn" type="button" id="rotateBtn">Girar</button>
          <button class="btn" type="button" id="topBtn">Arriba</button>
          <button class="btn sq" type="button" id="zoomIn" aria-label="Acercar">+</button>
          <button class="btn sq" type="button" id="zoomOut" aria-label="Alejar">−</button>
        </div>
        <div class="tool-group" role="group" aria-label="Acciones">
          <span class="tool-label">Acciones</span>
          <button class="btn" type="button" id="demoBtn" aria-pressed="false">Modo demo</button>
          <button class="btn" type="button" id="simPermBtn" title="Probar una petición de permiso">Simular permiso</button>
          <button class="btn changes" type="button" id="endMeetBtn" hidden>Terminar reunión</button>
          <button class="btn approve" type="button" id="clearIncidentBtn" hidden>Todo claro</button>
          <button class="btn mini" type="button" id="muteBtn" aria-pressed="false">🔊 Sonido</button>
        </div>
        <!-- Lo sigue usando el JS (chatToggle alterna .on); el usuario usa la pestaña Chat -->
        <button class="btn" type="button" id="chatBtn" aria-pressed="false" hidden>Chat</button>
      </div>
    </div>
    <div class="legend">
      <span><i style="background:#3b82f6"></i>Trabajando</span>
      <span><i style="background:#f59e0b"></i>Por revisar</span>
      <span><i style="background:#ef4444"></i>Con cambios</span>
      <span><i style="background:#22c55e"></i>Libre</span>
    </div>
    <div class="meet-chip" id="meetChip"><i></i><span id="meetText">SALA DE JUNTAS</span></div>
    <div class="incident-sign" id="incidentSign">Días sin incidente: 0</div>
    <div class="incident-tint" id="incidentTint" hidden></div>
    <div class="hint">Arrastra para girar · clic en un agente abre el Inspector</div>
  </div>

  <aside class="dock" id="dock">
    <section class="dock-view" id="view-oficina" role="tabpanel" data-view="oficina">
      <!-- panel Agentes actual, tal cual (líneas 769–780) -->
    </section>
    <section class="dock-view" id="view-chat" role="tabpanel" data-view="chat" hidden>
      <!-- #chatPanel actual, tal cual (líneas 833–855), conservando su atributo hidden -->
    </section>
    <section class="dock-view" id="view-pizarron" role="tabpanel" data-view="pizarron" hidden>
      <!-- panel Pizarrón actual (791–797) -->
    </section>
    <section class="dock-view" id="view-entregas" role="tabpanel" data-view="entregas" hidden>
      <!-- panel Entregas actual (783–789) -->
    </section>
    <section class="dock-view" id="view-bitacora" role="tabpanel" data-view="bitacora" hidden>
      <!-- panel Recap (813–819) y debajo panel Bitácora (799–808) -->
    </section>
    <section class="dock-view" id="view-medidores" role="tabpanel" data-view="medidores" hidden>
      <!-- panel Medidores (761–767) y debajo console-panel OpenCode (822–829) -->
    </section>
  </aside>
</div>
```

Se eliminan: el `<div class="mute-chip">` (su botón `#muteBtn2` pasa a la cabecera) y el `.foot`.
`#permStack`, `#incidentBanner`, `#inspBackdrop` se quedan donde están (al final del `<body>`).

> **Ojo:** el JS hace `document.querySelectorAll('[data-project]')` (línea ~1759). Las pestañas usan
> `data-view`, **nunca** `data-project`, para no lanzar proyectos al cambiar de sección.

### 10.2 CSS

Reemplazar el bloque `:root` por los tokens de la sección 1/2/8 y **añadir** al final del `<style>`:

```css
:root{
  color-scheme:dark;
  --bg:#0E1116; --panel-inset:#0F1319; --panel:#151A21; --header:#161B22;
  --panel-raised:#1D2430; --nav:#1F2733; --nav-hover:#28323F; --nav-active:#2D3550;
  --line:#2A3341; --line-strong:#3A4658; --line-hover:#4A5870;
  --ink:#F2F5F9; --ink2:#C3CCD8; --muted:#8B97A8; --faint:#5E6A7B;
  --accent:#7B82FF; --accent-strong:#5B61F0; --accent-hover:#6A70F5; --accent-ink:#D9DBFF;
  --accent-soft:rgba(123,130,255,.16);
  --blue:#3B82F6; --amber:#F59E0B; --red:#EF4444; --emerald:#22C55E; --info:#38BDF8;
  --blue-soft:rgba(59,130,246,.16); --amber-soft:rgba(245,158,11,.16);
  --red-soft:rgba(239,68,68,.16); --emerald-soft:rgba(34,197,94,.15);
  /* alias usados por reglas existentes */
  --bg2:var(--panel-inset); --panel2:var(--panel-inset); --panel3:var(--panel-raised);
  --line2:var(--line-strong); --muted2:var(--faint); --dim:var(--muted);
  --green:var(--emerald); --orange:var(--amber);
  --sans:"Inter","SF Pro Text",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  --mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --r-xs:6px; --r-sm:8px; --r:10px; --r-lg:14px; --r-pill:999px;
  --shadow-1:inset 0 1px 0 rgba(255,255,255,.04),0 1px 2px rgba(0,0,0,.40);
  --shadow-2:0 4px 14px rgba(0,0,0,.38);
  --shadow-3:0 24px 60px rgba(0,0,0,.58);
  --shadow-nav:0 8px 18px -10px rgba(0,0,0,.75);
  --shadow-sm:var(--shadow-1); --shadow:var(--shadow-2);
  --header-h:56px; --nav-h:52px; --shell-h:calc(var(--header-h) + var(--nav-h));
}

/* ---------- Armazón ---------- */
body{background:var(--bg);font-size:15px}
@media (min-width:981px){ body{overflow:hidden} }   /* escritorio: sin scroll de página */

.shell-top{position:sticky;top:0;z-index:60}
.app-header{
  position:static;height:var(--header-h);padding:0 20px;
  background:var(--header);border-bottom:1px solid var(--line);backdrop-filter:none;
}
.app-header:has(.live-chip.off){box-shadow:inset 0 -2px 0 var(--red)}
.brand h1{font-size:22px;font-weight:750}
.logo{width:40px;height:40px;background:var(--panel-raised);border-color:var(--line-strong);color:var(--accent)}

/* ---------- Menú ---------- */
.app-nav{
  height:var(--nav-h);display:flex;align-items:stretch;gap:8px;padding:0 12px;
  background:var(--nav);border-bottom:1px solid var(--line-strong);box-shadow:var(--shadow-nav);
}
.nav-tabs{display:flex;align-items:stretch;min-width:0;overflow-x:auto;scrollbar-width:none}
.nav-tabs::-webkit-scrollbar{display:none}
.nav-tab{
  appearance:none;border:0;background:transparent;cursor:pointer;
  display:inline-flex;align-items:center;gap:10px;padding:0 18px;white-space:nowrap;
  font:600 15px/1 var(--sans);color:var(--ink2);position:relative;
  transition:background .15s,color .15s;
}
.nav-tab + .nav-tab::before{
  content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:var(--line);
}
.nav-tab.is-active::before,.nav-tab.is-active + .nav-tab::before{display:none}
.nav-ico{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;
  stroke-linecap:round;stroke-linejoin:round;color:var(--muted);flex:0 0 auto}
.nav-tab:hover{background:var(--nav-hover);color:var(--ink)}
.nav-tab:hover .nav-ico{color:var(--ink2)}
.nav-tab.is-active{
  background:var(--nav-active);color:#fff;font-weight:650;
  box-shadow:inset 0 -3px 0 var(--accent);
}
.nav-tab.is-active .nav-ico{color:var(--accent)}
.nav-tab:focus-visible{outline:2px solid var(--accent);outline-offset:-4px}
.nav-tab kbd{
  font:600 11px/1 var(--mono);color:var(--faint);border:1px solid var(--line-strong);
  border-radius:4px;padding:3px 5px;
}
.nav-count{
  min-width:22px;padding:3px 7px;border-radius:var(--r-pill);text-align:center;
  font:700 12px/1 var(--mono);font-variant-numeric:tabular-nums;
  background:#222A36;color:var(--ink2);border:1px solid var(--line-strong);
}
.nav-count:empty{display:none}
.nav-count[data-tone="accent"]{background:var(--accent-strong);border-color:var(--accent);color:#fff}
.nav-count[data-tone="work"]{background:var(--blue-soft);border-color:rgba(59,130,246,.5);color:#9EC5FF}
.nav-count[data-tone="attn"].is-hot{
  background:var(--amber);border-color:var(--amber);color:#1A1205;animation:navAttn 2s ease-in-out infinite;
}
@keyframes navAttn{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}50%{box-shadow:0 0 0 6px rgba(245,158,11,0)}}
.nav-dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:0 0 auto}
.nav-dot.is-live{background:var(--emerald);box-shadow:0 0 0 3px rgba(34,197,94,.18)}
.nav-collapse{margin-left:auto;align-self:center}
.workspace:not([data-view="oficina"]) ~ * .nav-collapse{display:none}

/* ---------- Espacio de trabajo: 3D + dock ---------- */
.workspace{
  --dock-w:440px;
  height:calc(100vh - var(--shell-h));height:calc(100dvh - var(--shell-h));
  display:grid;grid-template-columns:minmax(0,1fr) var(--dock-w);
}
.workspace[data-view="chat"],
.workspace[data-view="entregas"],
.workspace[data-view="bitacora"]{--dock-w:500px}
.workspace[data-view="pizarron"],
.workspace[data-view="medidores"]{--dock-w:min(880px,56vw)}
.workspace.dock-collapsed[data-view="oficina"]{--dock-w:0px}
.workspace.dock-collapsed[data-view="oficina"] .dock{display:none}

.stage-wrap{height:100%;min-height:0;border-bottom:0;
  background:radial-gradient(ellipse at 50% 22%,#18202B 0%,#0E1116 72%)}

.dock{
  min-width:0;min-height:0;display:flex;flex-direction:column;
  background:var(--panel);border-left:1px solid var(--line);
  box-shadow:-12px 0 28px -18px rgba(0,0,0,.7);
}
.dock-view{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column}
.dock .panel{border:0;border-radius:0;box-shadow:none;background:transparent;overflow:visible}
.dock .panel + .panel,.dock .panel + .console-panel{border-top:1px solid var(--line)}
.dock .panel-head{position:sticky;top:0;z-index:3;background:var(--panel-raised);padding:14px 20px}
.dock .panel-title{text-transform:none;letter-spacing:0}
.dock .panel-title b{font-size:20px;letter-spacing:-.01em}
.dock .agent-list,.dock .log{max-height:none;overflow:visible}
.dock .console-panel{margin:0;max-width:none;border:0;border-radius:0;box-shadow:none}
.dock .recap-grid{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));padding:14px 20px}

/* Chat incrustado en el dock (JS sigue alternando su atributo hidden) */
.dock .chat-panel{position:static;inset:auto;width:auto;height:100%;
  border:0;box-shadow:none;background:transparent}
.dock .chat-head{background:var(--panel-raised)}

/* ---------- Barra de herramientas del 3D ---------- */
.hud-left{left:16px;top:16px;max-width:calc(100% - 260px)}
.toolbar{display:flex;flex-wrap:wrap;gap:10px}
.tool-group{
  display:flex;align-items:center;gap:6px;padding:6px;border-radius:var(--r-lg);
  background:rgba(21,26,33,.88);border:1px solid var(--line);
  backdrop-filter:blur(10px);box-shadow:var(--shadow-2);
}
.tool-label{font:700 11px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);padding:0 6px 0 8px}
.toolbar .btn{min-height:40px;font-size:14.5px;padding:0 13px}
.toolbar .btn.sq{width:40px;padding:0;font-size:18px}
.legend{position:absolute;left:16px;bottom:16px;z-index:6}

/* ---------- Botones ---------- */
.btn{background:var(--panel-raised);border-color:var(--line-strong);border-radius:var(--r);
  min-height:44px;font-size:15px;box-shadow:var(--shadow-1);backdrop-filter:none}
.btn:hover{background:#253041;border-color:var(--line-hover)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.mini{min-height:36px;font-size:13.5px}
.btn.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink);
  box-shadow:inset 0 0 0 1px rgba(123,130,255,.25)}
.btn.primary{background:var(--accent-strong);border-color:#6D74F7;color:#fff}
.btn.primary:hover{background:var(--accent-hover)}
.btn.approve{background:#15803D;border-color:#22C55E;color:#F0FFF6}
.btn.approve:hover{background:#16A34A}
.btn.changes{background:var(--amber-soft);border-color:rgba(245,158,11,.55);color:#FCD38A}
.btn.danger,#chatClearBtn{background:var(--red-soft);border-color:rgba(239,68,68,.55);color:#FCA5A5}
.btn.ghost{background:transparent;border-color:transparent;box-shadow:none;color:var(--ink2)}
.btn.ghost:hover{background:#253041}
.agent-form .btn:not(.approve):not(.changes){background:var(--accent-strong);border-color:#6D74F7;color:#fff}

/* ---------- Badges / pills / chips ---------- */
.badge{background:#222A36;border-color:var(--line-strong);color:var(--ink2);padding:4px 11px}
.pill{display:inline-flex;align-items:center;gap:6px}
.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.9}
.pill.working{color:#9EC5FF;border-color:rgba(59,130,246,.5);background:var(--blue-soft)}
.pill.working::before{background:var(--blue)}
.pill.review{color:#FCD38A;border-color:rgba(245,158,11,.55);background:var(--amber-soft)}
.pill.review::before{background:var(--amber)}
.pill.changes{color:#FCA5A5;border-color:rgba(239,68,68,.55);background:var(--red-soft)}
.pill.changes::before{background:var(--red)}
.pill.free{color:#86EFAC;border-color:rgba(34,197,94,.5);background:var(--emerald-soft)}
.pill.free::before{background:var(--emerald)}
.live-chip{background:#222A36;border-color:var(--line-strong);color:var(--ink2)}
.live-chip .dot{animation:blink 1.2s ease-in-out infinite}
.live-chip.ok{background:#0F2A1A;border-color:var(--emerald);color:#86EFAC}
.live-chip.ok .dot{animation:pulse 2s infinite}
.live-chip.off{background:#2A1214;border-color:var(--red);color:#FCA5A5}
.live-chip.off .dot{animation:none}
@keyframes blink{50%{opacity:.35}}

/* ---------- Tamaños de nombres (grandes) ---------- */
.agent-row .name{font-size:19px}
.insp-head .t{font-size:22px}
.chat-name,.meter-row .m-name{font-size:17px}

/* ---------- Tarjetas dentro de paneles ---------- */
.meter-row,.board-col,.recap-stat{background:var(--panel-raised);border-color:var(--line);box-shadow:var(--shadow-1)}
.board-card{background:var(--panel-inset);border-color:var(--line-strong)}
.agent-form input,.chat-filters select,.chat-filters input{background:var(--panel-inset);border-color:var(--line-strong)}
.agent-form input:focus,.chat-filters select:focus,.chat-filters input:focus{
  border-color:var(--accent);box-shadow:0 0 0 3px rgba(123,130,255,.22)}

/* ---------- Flotantes ajustados al nuevo alto de cabecera ---------- */
.perm-stack{top:calc(var(--shell-h) + 12px);max-height:calc(100vh - var(--shell-h) - 24px)}
.perm-card{border-width:1.5px;border-color:rgba(245,158,11,.65);box-shadow:var(--shadow-3)}
.insp-card,.incident-banner{box-shadow:var(--shadow-3)}

/* ---------- Responsivo ---------- */
@media (max-width:1200px){
  .nav-tab kbd{display:none}
  .nav-tab{padding:0 14px}
  .workspace{--dock-w:400px}
  .workspace[data-view="pizarron"],.workspace[data-view="medidores"]{--dock-w:62vw}
}
@media (max-width:980px){
  .workspace,.workspace[data-view]{display:block;height:auto}
  .stage-wrap{height:min(52vh,560px);min-height:360px}
  .dock{border-left:0;border-top:1px solid var(--line);box-shadow:none}
  .dock-view{overflow:visible}
  .nav-collapse{display:none}
  .chat-panel{min-height:70vh}
}
@media (max-width:600px){
  :root{--header-h:52px;--nav-h:48px}
  .brand small,.live-meta{display:none}
  .nav-tab{padding:0 12px;font-size:14px;gap:7px}
  .toolbar{flex-wrap:nowrap;overflow-x:auto;max-width:calc(100vw - 20px)}
  .tool-label{display:none}
  .hud-left{left:10px;top:10px;max-width:calc(100% - 20px)}
  .legend{display:none}
  .chat-panel{top:auto;width:auto}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
```

Notas sobre reglas existentes que hay que retocar o borrar:
- `.stage-wrap{height:calc(100vh - 78px)}` → lo sobreescribe `height:100%` dentro del grid.
- `.chat-panel{position:fixed;top:78px;…}` → lo neutraliza `.dock .chat-panel`.
- `.perm-stack{top:78px}` → lo sobreescribe el bloque de flotantes.
- `.mute-chip`, `.foot`, `.dash`, `.col`, `.recap-panel`: ya no se usan; se pueden borrar.
- `.meters-panel{grid-column:1/-1}`: inofensivo, se puede borrar.
- La regla `.workspace:not(...) ~ * .nav-collapse` no aplica porque el nav va antes del workspace; la ocultación del botón "Panel" fuera de Oficina la hace el JS de 10.3 (`dockToggle.hidden`).

### 10.3 JS del menú (nuevo `<script>`, **después** del script principal, antes de `</body>`)

Es aditivo: no modifica ninguna función existente. Usa solo IDs que ya existen.

```html
<script>
(function () {
  'use strict';
  var VIEWS = ['oficina', 'chat', 'pizarron', 'entregas', 'bitacora', 'medidores'];
  var KEY = 'oficina-ui-view';
  var $ = function (id) { return document.getElementById(id); };
  var ws = $('workspace');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.nav-tab[data-view]'));
  var views = Array.prototype.slice.call(document.querySelectorAll('.dock-view[data-view]'));
  var chatPanel = $('chatPanel');
  var chatBtn = $('chatBtn');            // su listener original llama a chatToggle()
  var dockToggle = $('dockToggle');
  var current = null;

  function tab(v) { return document.querySelector('.nav-tab[data-view="' + v + '"]'); }

  // Abre/cierra el chat SIEMPRE a través de la lógica existente.
  function setChat(open) {
    if (open === !chatPanel.hidden) return;
    chatBtn.click();
  }

  function setView(v, focusTab) {
    if (VIEWS.indexOf(v) < 0) v = 'oficina';
    current = v;
    ws.dataset.view = v;
    tabs.forEach(function (t) {
      var on = t.dataset.view === v;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    views.forEach(function (p) { p.hidden = p.dataset.view !== v; });
    setChat(v === 'chat');
    if (v === 'chat') markChatSeen();
    dockToggle.hidden = v !== 'oficina';
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (location.hash !== '#' + v) {
      try { history.replaceState(null, '', '#' + v); } catch (e) {}
    }
    if (focusTab) tab(v).focus();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { setView(t.dataset.view); });
  });

  // Si el chat se cierra con su botón "Cerrar" (o se abre por otra vía), el menú se sincroniza.
  new MutationObserver(function () {
    if (chatPanel.hidden && current === 'chat') setView('oficina');
    else if (!chatPanel.hidden && current !== 'chat') setView('chat');
  }).observe(chatPanel, { attributes: true, attributeFilter: ['hidden'] });

  // Colapsar el dock en la vista Oficina (3D a pantalla completa).
  dockToggle.addEventListener('click', function () {
    var c = ws.classList.toggle('dock-collapsed');
    dockToggle.setAttribute('aria-pressed', c ? 'true' : 'false');
    dockToggle.textContent = c ? '⟨ Panel' : '⟩ Panel';
  });

  // Teclado: 1–6 y flechas dentro del menú.
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (!$('inspBackdrop').hidden) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= VIEWS.length) { setView(VIEWS[n - 1]); e.preventDefault(); return; }
    if (e.target && e.target.classList && e.target.classList.contains('nav-tab') &&
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var i = VIEWS.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
      setView(VIEWS[(i + VIEWS.length) % VIEWS.length], true);
      e.preventDefault();
    }
  });

  // ---------- Contadores espejo (leen los badges que ya actualiza el JS) ----------
  function watch(srcId, fn) {
    var src = $(srcId);
    if (!src) return;
    var run = function () { fn((src.textContent || '').trim()); };
    new MutationObserver(run).observe(src, { childList: true, characterData: true, subtree: true });
    run();
  }
  function count(v) { return tab(v).querySelector('.nav-count'); }

  watch('agentCount', function (t) { count('oficina').textContent = t; });
  watch('taskCount', function (t) { count('pizarron').textContent = t === '0' ? '' : t; });
  watch('logCount', function (t) { count('bitacora').textContent = t === '0' ? '' : t; });
  watch('deliveryCount', function (t) {
    var el = count('entregas'), n = parseInt(t, 10) || 0;
    el.textContent = n ? String(n) : '';
    el.classList.toggle('is-hot', n > 0);
    tab('entregas').setAttribute('aria-label', 'Entregas' + (n ? ', ' + n + ' por revisar' : ''));
  });
  watch('meterStatus', function (t) {
    $('navMeterDot').classList.toggle('is-live', !/sin datos/i.test(t));
  });

  // Chat: no leídos desde la última vez que se abrió la pestaña.
  var chatSeen = 0, chatTotal = 0;
  function paintChat() {
    var unread = Math.max(0, chatTotal - chatSeen);
    var el = count('chat');
    el.hidden = unread === 0 || current === 'chat';
    el.textContent = unread ? '+' + unread : '';
  }
  function markChatSeen() { chatSeen = chatTotal; paintChat(); }
  watch('chatCount', function (t) {
    chatTotal = parseInt(t, 10) || 0;
    if (chatSeen > chatTotal) chatSeen = chatTotal;   // tras "Limpiar chat"
    if (current === 'chat') chatSeen = chatTotal;
    paintChat();
  });

  // ---------- Vista inicial ----------
  var initial = (location.hash || '').slice(1);
  if (VIEWS.indexOf(initial) < 0) {
    try { initial = localStorage.getItem(KEY) || 'oficina'; } catch (e) { initial = 'oficina'; }
  }
  chatSeen = chatTotal;          // lo cargado de localStorage no cuenta como "nuevo"
  setView(initial);
  window.addEventListener('hashchange', function () {
    var v = location.hash.slice(1);
    if (VIEWS.indexOf(v) >= 0 && v !== current) setView(v);
  });
})();
</script>
```

Por qué es seguro:
- El `MutationObserver` del chat es idempotente: después de `setView('chat')` el panel queda visible y
  `current==='chat'`, así que el callback no hace nada; igual al salir. No hay bucles.
- `chatBtn.click()` funciona aunque el botón tenga `hidden` (los listeners no dependen de la visibilidad).
- Todo el contenido de los paneles sigue renderizándose aunque su vista esté oculta (el JS escribe en
  `#deliveries`, `#tasks`, `#log`, `#metersGrid`… sin comprobar visibilidad), así que al cambiar de pestaña
  los datos ya están al día.
- El script corre después del principal, por lo que `chatToggle`, `renderMeters`, etc. ya están cableados.

---

## 11. Lista de "no romper" (verificar antes y después)

**IDs que deben existir exactamente una vez** (los lee el `els`/`chatEls` al arrancar):
`stageWrap, stage, clock, liveBadge, liveText, liveMeta, agentList, agentCount, sumBadge,
deliveries, deliveryCount, tasks, taskCount, log, logCount, metersGrid, meterStatus,
recapGrid, recapDate, recapBtn, inspBackdrop, inspCard, permStack, incidentSign, incidentTint,
incidentBanner, incidentWhy, incidentTimer, clearIncidentBtn, clearIncidentBtn2, simPermBtn,
muteBtn, muteBtn2, demoBtn, endMeetBtn, meetChip, meetText, camBtn, rotateBtn, topBtn, zoomIn,
zoomOut, chatPanel, chatBody, chatCount, chatBtn, chatCloseBtn, chatClearBtn, chatAgentFilter,
chatProjectFilter, chatSearch, officeBlock-patron, officeBlock-segundo, officeBlock-chalanes,
officeBlock-subagentes`.

**Clases que genera el JS y que el CSS debe seguir estilando (no renombrar):**
`agent-row, agent-form, who, name, role, task-line, dot, pill (+working/review/changes/free), live-tag(.on),
delivery, delivery-top/name/task/meta/actions, btn approve, btn changes, btn mini, empty,
board-3col, board-col, board-col-head, board-col-body, board-card(.done), board-empty, pin, a, n,
log-item (+review/changes/approve/meet/info/dm), log-time, log-text, meter-head, mh, meter-row, m-agent,
m-name, m-model, m-mem, meter-val(.est), meter-bar(.amber/.red), meters-more, meters-empty,
recap-stat, v, l, insp-head, insp-body, insp-kv, insp-tools, insp-tool(.failed), insp-xcript, insp-note, t, x,
perm-card, perm-head, perm-body, perm-actions, h, chat-msg, chat-avatar, chat-main, chat-msg-head,
chat-name, chat-time, chat-reply, chat-to, chat-text, chat-empty, stage-fallback`.

**Clases de estado que alterna el JS:** `.live-chip.ok/.off`, `.btn.on` (demo, chat), `.meet-chip.show`,
`.incident-sign.bad`, atributo `hidden` en `endMeetBtn`, `clearIncidentBtn`, `incidentBanner`,
`incidentTint`, `inspBackdrop`, `chatPanel`.

**Reglas de oro**
1. `#stage` nunca con `display:none` (solo cambia de ancho).
2. Ningún elemento nuevo con `data-project`.
3. `#chatPanel` solo lo muestra/oculta `chatToggle` (vía `#chatBtn`).
4. El script del menú va después del script principal.

---

## 12. Criterios de aceptación (prueba manual)

1. Al abrir la página, sin hacer scroll, se ven: cabecera, **barra de menú con 6 pestañas y "Oficina" resaltada
   en índigo**, el 3D y el panel de Agentes con nombres de 19 px.
2. Pulsar cada pestaña (y las teclas 1–6) cambia el panel derecho; el 3D se reajusta sin deformarse
   (redimensionar la ventana tampoco lo deforma).
3. Chat: abrir la pestaña muestra mensajes y filtros funcionales; "Cerrar" vuelve a Oficina;
   con Modo demo activo y otra pestaña abierta, el contador `+N` índigo sube.
4. Entregas: cuando llega una entrega, el contador del menú se vuelve ámbar con pulso;
   Aprobar / Pedir cambios siguen funcionando.
5. EN VIVO: con OpenCode arriba el chip es verde; al apagarlo pasa a CAÍDO rojo y aparece la línea roja bajo la cabecera.
6. Medidores: la tabla de 4 columnas y el iframe de OpenCode se ven completos; el punto de la pestaña es verde con datos.
7. Inspector (clic en agente del 3D o de la lista), "Simular permiso", incidente y /recap funcionan igual que antes.
8. Recargar la página conserva la pestaña elegida; `oficina-local.html#medidores` abre directo en Medidores.
9. En < 980 px el 3D queda arriba y el panel debajo; en < 600 px las pestañas se desplazan horizontalmente.
