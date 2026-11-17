LA OFICINA v2: ESPECIFICACIÓN DE LUJO (CSS puro, sin imágenes)

0) TOKENS NUEVOS (:root)
--bg:#06080c; --panel:#131a24; --amber:#f5a524; --amber-hi:#ffc65c; --amber-lo:#b8730a; --cyan:#22d3ee; --text:#f4f1ea; --muted:#9aa3ae; --line:rgba(244,241,234,.08);
--shadow-deep:0 1px 0 rgba(255,255,255,.06) inset,0 24px 48px -12px rgba(0,0,0,.75),0 8px 16px -8px rgba(0,0,0,.6);
--glow-amber:0 0 0 1px rgba(245,165,36,.35),0 0 24px rgba(245,165,36,.25); --ease:cubic-bezier(.2,.8,.2,1);
body{background:radial-gradient(1200px 600px at 50% -10%,#1a1408 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#061a20 0%,transparent 55%),#06080c;}

1) TEXTURAS
A. MADERA de nogal (piso, muros y contenedor del canvas: .scene-wrap, ::before detrás del canvas con pointer-events:none):
background:
 repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 140px),            /* juntas entre tablones */
 repeating-linear-gradient(2deg,rgba(255,220,170,.035) 0 2px,transparent 2px 7px),          /* vetas finas */
 repeating-linear-gradient(-1deg,rgba(0,0,0,.12) 0 1px,transparent 1px 23px),               /* vetas profundas */
 radial-gradient(ellipse 40px 12px at 30% 40%,rgba(0,0,0,.25),transparent 70%),             /* nudo */
 linear-gradient(180deg,#3a2414 0%,#2a190d 55%,#1c1009 100%);
Muro: igual con 0deg y base linear-gradient(180deg,#24170e,#120b06) + zócalo inferior: box-shadow inset 0 -40px 60px -20px rgba(0,0,0,.8).
En Three.js (solo material, sin tocar la lógica): CanvasTexture generada con las mismas vetas, color #5a3a22, roughness .62, metalness 0.
B. METAL CEPILLADO (menú superior #topbar):
background:
 repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px),
 repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 1px,transparent 1px 7px),
 linear-gradient(180deg,#2b313a 0%,#1a1f26 48%,#14181e 52%,#0f1217 100%);
border-bottom:1px solid #000; box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 1px 0 rgba(245,165,36,.18),0 12px 30px rgba(0,0,0,.6);
C. CRISTAL ESMERILADO (paneles: chat, pizarrón, bitácora, medidores, modales):
background:linear-gradient(180deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 38%),rgba(19,26,36,.62);
backdrop-filter:blur(18px) saturate(160%); -webkit-backdrop-filter:blur(18px) saturate(160%);
border:1px solid rgba(255,255,255,.09); border-radius:16px; box-shadow:var(--shadow-deep);
Brillo superior: ::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);}
D. CUERO (tarjetas de entregas y agentes):
background:
 radial-gradient(circle at 20% 30%,rgba(255,255,255,.025) 0 1px,transparent 1.5px) 0 0/5px 5px,
 radial-gradient(circle at 70% 60%,rgba(0,0,0,.25) 0 1px,transparent 1.5px) 0 0/7px 7px,
 linear-gradient(160deg,#2a1d14 0%,#1a120c 100%);
Costura: outline:1px dashed rgba(245,165,36,.28); outline-offset:-7px; border-radius:12px; border:1px solid #0a0604.
E. TELA (fondo del chat y del pizarrón): repeating-linear-gradient(45deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,rgba(0,0,0,.08) 0 1px,transparent 1px 4px),#10161f;

2) MENÚ SUPERIOR v2 (64px, fijo, grid: marca | pestañas | buscador | estado)
grid-template-columns:220px 1fr 280px 160px; padding:0 20px; gap:16px.
Marca: "LA OFICINA" en 13px, peso 700, letter-spacing .28em, background:linear-gradient(180deg,#ffd88a,#f5a524 55%,#b8730a); -webkit-background-clip:text; color:transparent; + subtítulo "23 agentes" en 10px #9aa3ae.
Pestañas (orden e iconos SVG inline de 16px, stroke 1.75, currentColor):
 1 🏢 Oficina · 2 💬 Chat · 3 🖍 Pizarrón · 4 📦 Entregas · 5 📜 Bitácora · 6 📊 Medidores
Pestaña: height:40px; padding:0 14px; border-radius:10px; font:500 13px/1 Inter; color:#9aa3ae; gap:8px.
Hover: color #f4f1ea; background:rgba(255,255,255,.04); box-shadow:inset 0 1px 0 rgba(255,255,255,.06).
Activa: color #ffc65c; background:linear-gradient(180deg,rgba(245,165,36,.16),rgba(245,165,36,.04)); box-shadow:inset 0 1px 0 rgba(255,214,140,.25),inset 0 -2px 0 #f5a524;
Atajo visible: <kbd> 10px monospace, padding 1px 5px, border 1px solid rgba(255,255,255,.12), border-bottom-width 2px, radius 4px, color #6b7480. Teclas 1-6 cambian pestaña (ignorar si el foco está en input o textarea).
Badge pendientes (Chat, Entregas, Pizarrón): min-width 18px; height 18px; radius 9px; font 700 10px; background:linear-gradient(180deg,#ffc65c,#f5a524); color:#1a1205; box-shadow:0 0 0 2px #14181e,0 0 12px rgba(245,165,36,.5). Si el valor es 0, ocultarlo.
Separadores: 1px × 24px, linear-gradient(180deg,transparent,rgba(255,255,255,.14),transparent) entre los grupos [Oficina] | [Chat Pizarrón Entregas] | [Bitácora Medidores].
Buscador global (⌘K / Ctrl+K): height 36px; radius 10px; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.08); box-shadow:inset 0 2px 4px rgba(0,0,0,.5); placeholder "Buscar agentes, entregas, notas…" en #6b7480; foco: border-color #22d3ee y box-shadow 0 0 0 3px rgba(34,211,238,.18). Resultados en un panel de cristal (C).
EN VIVO: punto de 8px #22d3ee con box-shadow 0 0 10px #22d3ee; animación pulse 1.8s (scale 1→1.8, opacity .6→0) sobre ::after; texto "EN VIVO" 10px peso 700 con letter-spacing .2em #22d3ee. Si el polling falla: punto #6b7480 y texto "RECONECTANDO".

3) JERARQUÍA PREMIUM
Tipografía: Inter o "SF Pro Display" para UI; "JetBrains Mono" para cifras y kbd; font-variant-numeric:tabular-nums.
Escala: H1 28px/700/-0.02em · H2 20px/600 · H3 15px/600 con uppercase y .12em en #9aa3ae · cuerpo 14px/1.55 #d9d5cc · meta 12px #9aa3ae · micro 10px.
Cifras de Medidores: 36px/700 con gradiente ámbar (igual que la marca); unidad en 13px #9aa3ae.
Espaciado en base 4: 4/8/12/16/24/32/48. Paneles con padding 24px; tarjetas 16px; gap de grid 20px.
Profundidad en 3 niveles: n1 tarjeta 0 2px 6px rgba(0,0,0,.4) · n2 panel var(--shadow-deep) · n3 modal 0 40px 80px -20px rgba(0,0,0,.9) + var(--glow-amber).
Brillos: botón primario linear-gradient(180deg,#ffc65c,#f5a524 50%,#d98c0f), color #1a1205, inset 0 1px 0 rgba(255,255,255,.5) y 0 6px 16px -4px rgba(245,165,36,.55); hover con translateY(-1px).
Bordes de cristal biselados: border-top rgba(255,255,255,.14) y border-bottom rgba(0,0,0,.5).
Vignette sobre la escena: radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.65) 100%), con pointer-events:none.
Usa el cian solo para estado o datos en vivo y el ámbar para acción, selección y valor. Nunca deben coincidir en el mismo elemento.
Movimiento: 180ms var(--ease). Con @media (prefers-reduced-motion:reduce) se desactivan pulse, translate y blur animado.

4) NO TOCAR (solo capa CSS más el marcado mínimo del menú)
- Three.js: scene, camera, renderer, loop de animación, posiciones y rutas de los 23 agentes, raycasting y clics. Solo se permite cambiar color/roughness de materiales vía CanvasTexture.
- Polling: intervalos, endpoints, manejo de errores y reconexión. El punto EN VIVO solo lee el estado que ya existe.
- Chat, Entregas, Pizarrón, Bitácora y Recap: funciones, handlers, render de mensajes, formato de datos y orden.
- Todos los id y clases existentes. Los estilos nuevos se agregan como clases extra (.v2-*) o selectores más específicos; nada se renombra ni se elimina.
- Lógica de cambio de pestañas: los atajos 1-6 y ⌘K llaman a la misma función actual de activar pestaña. No se crea un router nuevo.
- Contadores de los badges: se calculan desde los arrays o estados que ya se usan, sin fetch adicional.
- Canvas: ninguna capa decorativa encima intercepta eventos (todas con pointer-events:none) y el tamaño del renderer sigue igual.
- Altura del menú en 64px: el offset de los paneles (top:64px) no cambia.
