# Diseño 3D — Oficina Isométrica (Claude)

DISEÑO 3D — OFICINA ISOMÉTRICA (Three.js r149, 1 unidad = 1 m)

0) RENDERER BASE
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; toneMappingExposure=1.05;
renderer.setPixelRatio(Math.min(devicePixelRatio,2)). Usa materiales MeshStandardMaterial (roughness 0.6–0.85, metalness 0–0.3).
Comparte geometrías y materiales en un objeto GEO/MAT; nunca crees uno por agente (23 × 20 piezas = mucho).

1) PERSONAJE SENTADO (función makeWorker(rolColor), devuelve un Group; el original queda como padre)
Piel #e0b48f / #c68c62 / #8d5a3b (variar por índice). Pantalón #2b3140. Zapatos #1a1a1a.
Cabeza: SphereGeometry(0.11,24,16) en y=1.18; cabello: SphereGeometry(0.115,24,16,0,2π,0,π*0.55) #2a1d14 encima.
Cuello: CylinderGeometry(0.04,0.045,0.06) en y=1.05.
Torso: CapsuleGeometry(0.15,0.28,4,12) escalado (1,1,0.7) en y=0.86, color del rol:
  Dirección #1f3a5f (saco) · Gerencia #3d5a80 · Equipo #4f8a8b · Soporte #c9a227. Camisa: BoxGeometry(0.08,0.2,0.01) #f4f4f4 al frente (cuello en V).
Hombros→brazos: cada brazo es un Group pivote en (±0.19,1.0,0): brazo superior CapsuleGeometry(0.045,0.22) rotation.x=-0.5,
  antebrazo Group hijo en el codo, CapsuleGeometry(0.04,0.2) rotation.x=-1.2 (apunta al teclado); mano SphereGeometry(0.042) piel.
Piernas sentadas: muslo CapsuleGeometry(0.06,0.32) rotation.x=π/2 en y=0.52 hacia adelante; espinilla vertical CapsuleGeometry(0.055,0.34) en z=+0.36; zapato Box(0.09,0.06,0.2).
Silla (Group): asiento Box(0.48,0.07,0.46) #23262d y=0.46; respaldo Box(0.46,0.55,0.06) y=0.8 z=-0.22 rotation.x=0.12;
  poste Cylinder(0.025,0.025,0.32) cromo #9aa0a6 metalness 0.8; base 5 patas Box(0.28,0.03,0.04) rotadas 72° + ruedas Sphere(0.03).
Tecleo (en el bucle existente, sin cambiar su estructura): por agente fase = i*1.7;
  w.armL.forearm.rotation.x = -1.2 + Math.sin(t*14+fase)*0.06; armR con +π de fase; cabeza rotation.y = Math.sin(t*0.4+fase)*0.15.
  Estado "ausente/idle": amplitud 0; "ocupado": 0.08. Torso respira: scale.y = 1+Math.sin(t*2+fase)*0.008.
castShadow=true en todas las piezas; receiveShadow en torso y silla.

2) MOBILIARIO
Escritorio: tablero Box(1.4,0.04,0.7) roble #b08a5e roughness 0.55 en y=0.74; patas metal Box(0.05,0.72,0.6) #3a3d42 en los extremos;
  panel de privacidad Box(1.4,0.35,0.02) #5b6470 en el borde trasero.
Monitor: pantalla Box(0.6,0.36,0.025) #111 + plano 0.56×0.32 con MeshBasicMaterial emissive #3b82f6 al 35 % (azulado);
  cuello Box(0.04,0.18,0.04), base Box(0.22,0.015,0.16). Director: 2 monitores girados ±12°.
Teclado Box(0.42,0.02,0.14) #2d2f33; mouse CapsuleGeometry(0.02,0.04) acostado; taza Cylinder(0.035,0.03,0.09) #e8e2d6;
  papeles: 2–3 Plane(0.21,0.297) #fafafa rotados al azar ±0.3 rad, y=0.762.
SALA DE JUNTAS: mesa ovalada = CylinderGeometry(1,1,0.05,48) scale(2.2,1,1.0) nogal #6b4a2f en y=0.75, pedestales Cylinder(0.12,0.2,0.72) ×2;
  10 sillas ejecutivas (respaldo alto 0.7, cuero #1c1c1e) en elipse: x=2.6cos θ, z=1.35sin θ, lookAt al centro.
  Pantalla: Box(2.2,1.25,0.06) #0b0b0b en pared, y=1.6, plano emisivo #1e293b con logo; pizarrón Box(1.6,1.0,0.03) #f5f5f2 marco #9ca3af.
  Credenza bajo la pantalla Box(2.4,0.6,0.45) #3f3a35. Muros de vidrio: Box(L,2.4,0.04) MeshPhysicalMaterial transmission 0.9, roughness 0.05, color #dfeff2, perfil aluminio #8b9198.
Plantas: maceta Cylinder(0.18,0.14,0.4) #e6e1d8 o cerámica #2f3e46; follaje 5–7 IcosahedronGeometry(0.16,1) #2f6b3a/#3f8a4a/#567d46 con flatShading,
  dispersos ±0.12, y 0.5–0.95. Ficus alto: tronco Cylinder(0.025,0.035,1.2) #5a3e2b + 10 icosaedros. Una por esquina de zona + 2 en recepción.
Lámpara de pie: base Cylinder(0.16,0.18,0.03), poste Cylinder(0.015,0.015,1.55) #2b2b2b, pantalla Cylinder(0.16,0.22,0.28,24,1,true) #f3e9d2 side DoubleSide, emissive #ffd9a0 0.4.
Lámpara de escritorio (solo dirección/gerencia): base Cylinder(0.07), brazo Box(0.015,0.35,0.015) rotado 0.4, cabeza Cone(0.06,0.1) #1f1f1f.
Muros divisorios por oficina: Box(L,1.1,0.08) tela #c9c3b8 con remate superior Box(L,0.03,0.1) roble #b08a5e. Dejar huecos de 1 m como puertas.
  Zona dirección: muro completo 2.6 m vidrio esmerilado (transmission 0.6, roughness 0.4).
Recepción: mostrador en L Box(2.4,1.05,0.6)+Box(0.6,1.05,1.4) blanco #f2f0ec con franja de luz (Box 2.4×0.02×0.02, MeshBasic #ffe2b0) en el zócalo;
  cubierta Box(2.5,0.04,0.7) mármol (CanvasTexture gris con vetas). Logo en la pared detrás: Plane 1.6×0.4 emisivo. Sofá: 3 Box de cojín #6b7f73 + brazos.

3) PISO CON TEXTURA (CanvasTexture 1024×1024)
Tablones de 1024×128 px (8 filas), junta de tablón desfasada por fila (offset=rand*512). Base por tablón: hsl(30, 35–42 %, 48–56 %).
Vetas: 60 líneas por tablón, ctx.strokeStyle=`rgba(60,35,15,${0.05+rand*0.12})`, lineWidth 0.5–1.6, curva bezier con ondulación ±3 px;
  2–3 nudos: ellipse 6×3 px rgba(70,40,20,0.35). Juntas: líneas de 2 px #5a3e28 al 60 %.
tex.wrapS=wrapT=RepeatWrapping; tex.repeat.set(6,6); tex.anisotropy=renderer.capabilities.getMaxAnisotropy(); tex.encoding=sRGBEncoding.
Crea un segundo canvas en escala de grises con las mismas vetas → roughnessMap (vetas más ásperas). Piso: roughness 0.7, receiveShadow=true.
Alfombras (Plane a y=0.005, con borde Box de 0.01 de alto): Dirección #2b3a4a 6×5 m; Gerencia #4a5a52; Equipo #8c8577 con patrón de cuadros sutil;
  Juntas #3b3530 oval (CircleGeometry 64 scale 3.2×1.8). Textura de tela: canvas 256 con ruido 1 px ±8 de luminosidad, repeat 8.
Rodapié perimetral Box(L,0.1,0.02) #e9e5df. Muros perimetrales solo en los 2 lados posteriores (altura 2.8, #ece8e1) para no tapar la cámara isométrica.

4) ILUMINACIÓN Y SOMBRAS
HemisphereLight(0xfff4e6, 0x8a7a66, 0.55) + AmbientLight(0xffe8cc, 0.15).
Sol: DirectionalLight(0xfff1dc, 1.6) en (14,22,10), target al centro; castShadow; shadow.mapSize 2048×2048;
  shadow.camera left/right/top/bottom = ±18, near 1, far 60; shadow.bias=-0.0004; shadow.normalBias=0.02; shadow.radius=4.
Lámparas de pie: PointLight(0xffc98a, 0.6, 4.5, 2) dentro de cada pantalla, castShadow=false (máximo 6 en total).
Sala de juntas: RectAreaLight(0xfff6ea, 3, 3, 1.2) en el techo apuntando hacia abajo (RectAreaLightUniformsLib.init()).
Monitores: sin luz real; solo emisivo. Niebla: scene.fog = new THREE.Fog(0xefe9e1, 35, 70); scene.background = #efe9e1 (mismo color).
Opcional: plano de sombra de contacto bajo cada escritorio (Plane 1.5×0.8, textura radial negra a 25 % de opacidad, depthWrite false) para dar profundidad barata.

5) QUÉ NO TOCAR
Coordenadas (x,z) y rotación de los 23 agentes ni su mapa de estados: el nuevo modelo se agrega como hijo del Group actual de cada agente.
Burbujas de nombre (tamaño grande, misma altura +0.25 para librar la cabeza nueva en y≈1.3), punto de estado y sus colores.
Raycasting: conserva el mesh de colisión original (hazlo invisible con visible=true y material opacity 0 / colorWrite false) o asigna userData.agentId a todas las piezas nuevas;
  excluye muebles, alfombras y vidrio de la lista de intersección.
Bucle requestAnimationFrame, el polling, los handlers de clic y el chat fijo lateral (el canvas conserva su ancho actual). La cámara isométrica y su zoom quedan igual.
Rendimiento: InstancedMesh para sillas, teclados y follaje; matrixAutoUpdate=false en muebles estáticos. Objetivo: menos de 250 draw calls y 60 fps.

No leí ningún archivo del proyecto, así que todos los valores son estimados para una escala de 1 unidad = 1 m. Antes de aplicarlos, ajústalos a la escala y a las coordenadas reales de tu escena. Tampoco escribí ni ejecuté código.
