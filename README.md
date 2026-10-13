# Batalla Épica en Paraguay contra el Demonio Rojo

> **La versión paraguaya** del encuentro. Antes «Lost Cathedral» (título de trabajo *Vesper — The Last Rite*, renombrado el 17 Sep 2026); el slug hospedado en Genex sigue siendo `lost-cathedral`.

Un duelo de jefe gótico en tercera persona: la **combatiente paraguaya** — blusa blanca de ao po'i y encaje ñandutí, falda blanca de volantes, pañuelo negro con flecos y flores bordadas, faja roja-blanca-azul con borlas y una flor roja en el pelo — pelea con su espada y su escudo contra el **Gran Demonio Rojo de Paraguay**: el señor de las fotos del usuario, con su rostro y su pelo, traje azul marino envejecido y ahumado, camisa amarillenta, corbata roja intacta como único color vivo, pin rojo de estrella y los toques góticos aprobados (gemelo de hierro sobre un hombro, cadena con relicario, piel de ceniza), de escala de jefe (~2.3 m), que sigue empuñando la guadaña aprobada a dos manos en la Catedral del Último Rito. Ya no sana con brebajes: **toma tereré de su guampa** — tres sorbos de la bombilla, con su sonido propio. Construido con Three.js y Vite; los assets generados son archivos locales.

## Jugar

```sh
npm install
npm run dev -- --port 5179
```

Abre http://127.0.0.1:5179/. Para la compilación de producción:

```sh
npm run build
npm run preview -- --port 4174
```

Abre http://127.0.0.1:4174/. Teclado y ratón en escritorio, controles táctiles en teléfonos y tabletas; WebGL 2 requerido.

| Acción | Control |
|---|---|
| Moverse | W A S D |
| Ataque ligero | Clic izquierdo o J · pulsa de nuevo para el combo |
| Ataque fuerte | Mantén J o K |
| Rodadura al frente | Espacio |
| Bloquear | Mantén el clic derecho o L |
| Sanar (tereré) | R — tres usos por pelea; la guampa entra al primer sorbo |
| Fijar objetivo | Q o el botón central del ratón |
| Cámara libre | Suelta el fijado y arrastra; doble clic captura el ratón |
| Distancia de cámara | Rueda del ratón |
| Pausa, gráficos, audio y controles | Escape |

En un teléfono o una tableta el juego toma su propio camino (v1.1.0, `src/game/device.js`): un palo flotante a la izquierda; a la derecha, arrastra para mirar y pellizca para el zoom; y los botones Golpear (toca para el golpe, toca de nuevo para el combo, mantén para el fuerte), Rodar, Defensa, Tereré (el contador de usos), Fijar y Pausa. Usa un preset de render más ligero (Rendimiento por defecto, un presupuesto de píxeles en vez de los ratios del escritorio, sin AO de contacto, sin espejo de charcos por debajo de Alta, mapas de sombra a la mitad, 18 luces por píxel en vez de 28, sin SMAA en Rendimiento) y copias telefónicas de los dos rigs actuales con sus mapas de 4096 redimensionados a 1024 (`assets/mobile/`, hechas por `scripts/make-mobile-assets.py`; malla, rig y clips idénticos). El render de escritorio no cambia; `?touch=1` muestra la capa táctil en un escritorio.

Los ajustes incluyen alternativas de movimiento y de escudo para quien prefiere pulsar una vez antes que mantener la tecla. Suelta el escudo durante la recuperación para regenerar la resistencia más rápido. Ambas fases tienen ventajas deliberadas, ataques comprometidos y ventanas de castigo. La repetición («Álzate de nuevo») está disponible tras cualquiera de los dos desenlaces.

## Assets y autoría

- Uthana aporta los esqueletos humanoides y la locomoción; Blender resuelve y corrige las poses del equipo y las acciones de combate.
- **Jugadora paraguaya** (12 Oct 2026): el cuerpo sale del concepto aprobado (`npx genex model --image`, cmv5w8g7, 17.6 MB, 142.866 tris) desde la referencia neutral de las dos fotos del usuario (`docs/references/user-paraguay-ao-poi-dress.png`, `user-paraguay-traditional-dancer.png`). Un auto-rig de Uthana fue rechazado (confianza 0.55: la falda y el pañuelo lo confundían); se usa el rig biped de Tripo (cmv5wlgn, 39 articulaciones) y los 25 clips aprobados del caballero V18 se retargetean con `scripts/retarget-player-paraguay.py` (huesos renombrados a mixamorig, sockets por fotograma, 1.80 m, ratio de pierna 0.849). El paquete actual es `assets/player-paraguay/player-paraguay-rig-v3.glb` (manifiesto `docs/player-paraguay/player-paraguay-rig-v3-manifest.json`); el caballero V18 (`assets/player-motion-revision-3/player-video-candidate-v18.glb` y su manifiesto) queda como fallback de una línea en `src/game/asset-paths.js`.
- **La v2** (pedido del usuario: mejorar falda y flecos; sin gastar créditos) añade 8 huesos de panel de falda (Skirt0..7 bajo Hips, con SkirtNTip en el ruedo) y anclas de flecos y borlas (`scripts/dress-player-paraguay.py`). En runtime la falda tiene inercia, empuje de pierna y cono de balanceo (`src/game/skirt-sway.js`) y los flecos y borlas son cintas Verlet (`src/game/player-trim.js`); es una aproximación, sin auto-colisión de tela. El código del caballero queda oculto (`"cloth": false`).
- **La v3** es la sanación de tereré: `scripts/author-terere-heal.py` reconstruye el clip de heal (base de guardia reposada, pecho y cuello más rectos, IK de dos huesos del brazo izquierdo hasta los labios medido sobre la malla de la cara, dedos curvados, tres sorbos; mismos 1.4 s y mismo punto de curación). La guampa es código (`src/game/guampa.js`: cuerno con bandas de plata, yerba húmeda y bombilla) y se cuelga a la mano izquierda según el manifiesto (`clips.heal.guampa`); el escudo se descuelga en vertical a su lado mientras bebe. El sonido del sorbo (`assets/sfx/terere-sip-cmv62f8d.mp3`, 1.23 s, generación cmv62f8d) suena una vez desde el primer sorbo (`clips.heal.sips[0]`) en `src/game/main.js`; el HUD usa `assets/ui/guampa.svg` y los avisos dicen «No queda tereré» y «Tereré · fuerzas recuperadas». Prueba: `test/terere-heal.test.js`.
- **Jefe: el Gran Demonio Rojo de Paraguay** (12 Oct 2026). El usuario pidió que el enemigo fuese el señor de sus dos fotos (`docs/references/user-boss-man-portrait.png`, `user-boss-man-closeup.png`): traje azul marino, corbata roja y pin rojo. Concepto cmv616dz (aprobado), referencia neutral cmv617sd y modelo 3D cmv619pn (`npx genex model --image`, 17.5 MB, 1.0 de alto, frente +X). El rig biped de Tripo fue rechazado (una sola cadena de pierna: la columna arrancaba en la otra rodilla); en su lugar `scripts/rig-boss-man.py` ajusta un esqueleto mixamorig de 27 articulaciones a la malla en A-pose y la pesa por distancia inversa a los segmentos. No hay clips nuevos: los 7 de Muerte Acorazada (idle, walk-forward, sweep, slam, hit, awaken, death) se retargetean con `scripts/retarget-player-paraguay.py` (2.5 m, ratio de pierna 0.779) y la guadaña aprobada se conserva a dos manos. Paquete actual: `assets/boss-man/boss-man-rig-v1.glb` (manifiesto `docs/boss-man/boss-man-rig-v1-manifest.json`); Muerte Acorazada (`assets/production/boss-supported-combat.glb`) queda como fallback de una línea.
- Escudo, espada, guadaña y telas sueltas siguen siendo mallas separadas. El escudo usa el montaje de empuñadura central de 0.95 m resuelto desde la pose de guardia (`scripts/solve-shield-mount.mjs`): de cara al oponente, en vertical y recogido a lo largo del antebrazo solo mientras rueda.
- Los ajustes de clips se declaran por clip en el manifiesto y los aplica `src/game/clip-adjustments.js` y el controlador de animación, nunca editando el GLB: la familia de guardia capturada (idle, block, hit, light) gira −35° para que la mirada hacia su izquierda del intérprete enfrente al oponente, mezclado por peso de animación; el fuerte queda cuadrado porque su corte vertical estrecho falla si no (`scripts/sweep-player-stance-yaw.mjs`); un tic de la mano izquierda en idle/block se elimina con una gaussiana de 0.6 s consciente del bucle sobre la cadena del brazo izquierdo (292 → 28 grados/s). Las **líneas de orientación** del estudio (cabeza cian, pelvis ámbar, orientación de juego blanca) y el monitor de rendimiento en el juego muestran el resultado; `scripts/inspect-player-pose.mjs` lo mide.
- En runtime `src/game/gaze-lock.js` gira la cabeza hacia el objetivo fijado, `src/game/shield-strap.js` mantiene el escudo en el antebrazo durante la rodadura, y las rodaduras siguen la dirección que se mantiene (`src/game/motion.js`).
- [Estudio de animación](http://127.0.0.1:4174/animation-review.html): elige **Jefe** o **Jugadora** y haz clic en un movimiento para reproducirlo. Los enlaces directos aceptan `?character=player&clip=idle&time=1&view=side&facing=1` (añade `&gaze=0` para ver la cabeza capturada sin el bloqueo de mirada). `scripts/studio-capture.mjs` renderiza esos enlaces sin interfaz para guardar fotogramas de revisión, y `scripts/browser-playtest.mjs` conduce entrada real de teclado por la página del juego. Espacio pausa; arrastra la línea de tiempo o usa las flechas para inspeccionar una pose. Carácter, Manos y Cabeza dan primeros planos; Ajustar vista restaura el movimiento completo. Los [vídeos simples de movimiento](http://127.0.0.1:4174/motion-videos.html) tienen controles de reproducción normales.
- Los assets históricos del proyecto siguen preservados; el visor de modelos antiguo es `/asset-review.html` en el servidor de desarrollo.
- [Plan de assets y procedencia](docs/asset-plan.md) (cada generación, aprobación y limitación conocida), [selección aprobada](docs/approved-selection.json), [referencias del usuario](docs/references/).

## Validar

```sh
npm test
node scripts/simulate-encounter.mjs
npm run build
```

Las pruebas cubren reglas de combate, movimiento, contactos barridos del arma, cambios de fase y reinicios. Las auditorías de runtime cargan los rigs y manifiestos seleccionados, y hay pruebas dedicadas a la guardia aprobada del jefe, al movimiento del cuerpo, al alcance de la hoja y al comportamiento de la empuñadura. Las pruebas archivadas del primer paquete están etiquetadas aparte.

`npm run verify` ejecuta las pruebas, la auditoría de suela ponderada, la auditoría de eventos de contacto de pie, la simulación completa del encuentro a tres cadencias de actualización y la compilación de producción. Registra los hashes de los assets y los registros por etapa en `docs/current-build-verification.json`. Estas comprobaciones complementan la revisión visual y la del navegador; no pueden certificar por sí solas que el movimiento parezca natural.

El reposo del jefe a cuarto de velocidad está horneado en su clip de 26.27 s y se reproduce a velocidad normal. El avance del jefe conserva la cadencia de Muerte Acorazada para no alterar el ritmo del combate (su zancada más corta desliza). La rodadura de hombro hacia adelante, la guardia, el reposo y la reacción de cuerpo entero tienen sus vídeos de referencia y de modelo corregido en la galería.

## Compilación y publicación

La compilación de producción usa render HDR, tone mapping ACES, MSAA, SMAA, AO de contacto en Alta y bloom contenido. Alta usa un máximo de 1.15 de ratio de píxeles; Equilibrado, 1.0. Los charcos irregulares reflejan la escena en Alta y Equilibrado; Rendimiento conserva la superficie mojada sin el pase de reflejo. Un velo de bruma con brillo de brasa incrustado en la cabeza del jefe responde al combate. Los sonidos de armas y botas están ubicados en el espacio con una respuesta de sala tenue. Elden Ring y Dark Souls III se usaron como referencias visuales; este es un encuentro original de navegador con sus propios assets, no una afirmación de paridad visual AAA. El juego está publicado en Genex (https://genex.games/lost-cathedral); las actualizaciones van primero al borrador (`npx genex preview`) y se publican con `npx genex promote`.
