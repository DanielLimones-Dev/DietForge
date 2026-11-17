LA OFICINA — REDISEÑO "SALA DE CONTROL"

1) PALETA NUEVA (el azul desaparece por completo)
Fondo base ........ #06080c (casi negro, más profundo)
Fondo con malla ... #0b1018 + cuadrícula de líneas #ffffff08 cada 32 px
Paneles ........... #131a24, borde #243042 de 1 px y borde superior #f5a524 de 2 px
Panel elevado ..... #1a2330 (hover y modales)
Acento principal .. #f5a524 (ámbar). Reemplaza al azul en todo
Acento secundario . #22d3ee (cian). Datos en vivo, enlaces y foco
Éxito / EN VIVO ... #34d399 | Alerta #fb7185 | Aviso #facc15
Texto principal ... #f4f1ea (blanco cálido) | secundario #9aa7b8 | tenue #5b6778

2) TIPOGRAFÍA
Títulos y marca: "Space Grotesk" 700, con letter-spacing -0.02em
Interfaz y texto: "Inter" 400/500/600, 14 px base, interlineado 1.5
Datos, bitácora y consola: "JetBrains Mono" 13 px, con tabular-nums
Etiquetas de panel: Inter 600, 11 px, MAYÚSCULAS, tracking 0.12em, en ámbar

3) MENÚ SUPERIOR FIJO (64 px, sticky, fondo #06080ccc con blur de 12 px y borde inferior #243042)
Izquierda: un cuadro ámbar con un icono isométrico y "LA OFICINA" en Space Grotesk.
Centro: las pestañas, de 40 px de alto, con texto en #9aa7b8 y hover en #f4f1ea sobre #131a24.
La pestaña activa tiene fondo #f5a5241a, texto #f5a524, una barra inferior ámbar de 3 px que se desliza entre pestañas (240 ms) y un icono relleno.
Derecha: la píldora EN VIVO (punto #34d399 que pulsa y borde verde) y el contador "23 agentes".
- Oficina: muestra la escena 3D sola, a pantalla completa bajo el menú. Encima va una franja HUD translúcida con los Medidores en versión mini.
- Chat: abre el chat como vista principal. Sustituye al botón actual, que se elimina.
- Pizarrón: muestra el pizarrón a ancho completo, con tarjetas en rejilla.
- Entregas: muestra una tabla o lista de entregas con estados de color (ámbar en curso, verde lista, rosa con error).
- Bitácora: une la bitácora y la consola OpenCode en dos columnas monoespaciadas, con el Recap fijo arriba.
- Medidores: muestra el tablero completo con tarjetas KPI grandes y la lista de Agentes al lado.
Las teclas 1 a 6 cambian de pestaña y la pestaña elegida se guarda en un hash (#chat, #pizarron…).

4) CINCO CAMBIOS VISUALES OBVIOS
1. El ámbar sustituye al azul en todos los botones, bordes y estados activos. El color cambia a primera vista.
2. Una sola vista a la vez: se acaban los paneles sueltos apilados y hay menos scroll y ruido.
3. Cada panel lleva el filo ámbar superior de 2 px, la etiqueta en MAYÚSCULAS y una sombra 0 8px 32px #00000080.
4. La escena 3D tiene viñeta radial (#000 al 60 % en los bordes) y un resplandor ámbar suave bajo la oficina.
5. Los números de Medidores se muestran a 40 px en Space Grotesk, con sparkline cian y un cambio porcentual con flecha de color.
Extra: los avatares de agente llevan un anillo de estado (verde activo, ámbar ocupado, gris inactivo).

5) QUÉ NO TOCAR DE LA LÓGICA JS
- La inicialización de Three.js (escena, cámara, renderer) y su bucle de animación (requestAnimationFrame).
- Todos los ID y clases que usa JS (getElementById o querySelector): solo se mueven nodos, no se renombran.
- La lógica de los 23 agentes: posiciones, movimientos y estados.
- Los fetch, el polling, los WebSocket o SSE y sus intervalos.
- Los manejadores del chat: envío, recepción, scroll y estado de abierto o cerrado. Si existe una función para abrirlo, la pestaña Chat la reutiliza.
- El render de Entregas, Pizarrón, Bitácora, Recap y la consola OpenCode.
Reglas para las pestañas:
- Cambiar de pestaña solo pone un atributo body[data-view="..."]. El CSS oculta y muestra, y no se destruye ni se recrea ningún nodo del DOM.
- Al volver a Oficina hay que disparar window.dispatchEvent(new Event('resize')) para que el canvas recupere su tamaño.
- La lógica nueva va en un script aparte, sin modificar las funciones existentes.
