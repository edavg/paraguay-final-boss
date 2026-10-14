# Asset plan — approvals and provenance

## 2026-10-12 — Player redesign: Paraguayan traditional dress

User request: replace the player's (Thorn Exile) armor with the typical Paraguayan
dress, on a woman's body.

User decisions (AskUserQuestion, 2026-10-12):
- Character: **Player (Thorn Exile)** — boss (Armored Death) unchanged.
- Body: **a woman of flesh and blood** (female proportions and rig), not a literal skeleton.
- Colors: **original colors**, clean white and vivid accents as in the photos.

References (user-supplied, copied into the repo):
- `docs/references/user-paraguay-ao-poi-dress.png` — white ao po'i / ñandutí-lace blouse
  and flared skirt, red-white-blue woven sash with tassels.
- `docs/references/user-paraguay-traditional-dancer.png` — tiered white lace skirt,
  black fringed shawl with embroidered flowers, red-white-blue sash, red hair flower,
  hair in a bun.

Proposed concept brief (awaiting approval — no generation yet):
- One concept sheet, front 3/4, full body, neutral dark background.
- Adult woman, athletic warrior build, dark hair in a low bun with a red flower.
- White lace blouse (ñandutí / ao po'i patterns), red-white-blue sash with tassels,
  black shawl with colorful floral embroidery and fringe, white tiered lace skirt
  ending above the ankle for readable footwork, practical dark boots.
- Sword and shield kept as separate meshes (existing approved assets).
- Production note: skirt, shawl fringe and sash tassels are loose cloth. For the 3D
  model the skirt would be a shorter, body-skinned bell; fringe/tassels attached
  later in code, consistent with the earlier player rule.

Approval (2026-10-12): user approved the brief ("Sí, generar") for **one concept
image**. Weapons: keep the existing approved sword and shield. 3D model, rig and
animation remain separate later approvals.

Concept v1 (2026-10-12): generation cmv5w5yxo02u037mlrzumof3l, `npx genex image`
--quality high (7 credits), saved to `assets/player-paraguay/concept-cmv5w5yx.png`
(downloaded manually; CLI 1.32.3 did not save it). Provenance:
https://assets.genex.technology/generations/cmv5w5yxo02u037mlrzumof3l/image-main
Sword/shield in the image are illustrative only; game keeps the approved meshes.

Approval (2026-10-12): user approved concept v1 ("aprobado") to proceed to 3D.

Neutral 3D reference: generation cmv5w7lmk02sv3jl7ffwhm10g (`--edit` of concept v1,
--quality high), saved to `assets/player-paraguay/reference-neutral-cmv5w7lm.png`.
Front A-pose, no weapons, shawl without fringe, sash without tassels.

3D model: generation cmv5w8g7t02uf37ml0f91r2ni, `npx genex model --image` from the
neutral reference (46 credits), saved to
`assets/player-paraguay/player-paraguay-body-cmv5w8g7.glb` (17.6 MB, 142,866 tris,
1 mesh, 1 MeshStandardMaterial, height 1.0 unit, front faces +X).
Turnaround render: `docs/player-paraguay/model-turnaround-cmv5w8g7.png`.
Approval (2026-10-12): user approved the 3D model and said "procede" (rig stage).

Rig attempt 1 — Uthana (`npx genex character import`, 18 credits), generation
cmv5wgir802vm37mltugn5sc9, input `assets/player-paraguay/player-paraguay-body-normalized.glb`
(made by `scripts/normalize-player-paraguay.py`: front +Z, 1.65 m). Output
`assets/player-paraguay/player-paraguay-rigged-cmv5wgir.glb`. REJECTED: confidence 0.55,
shoulders at the sash, hips mid-skirt, bent knees — the skirt and shawl misled the auto-rig.
Kept on disk, unused.

Rig attempt 2 — Tripo biped (`npx genex model rig`, 29 credits), generation
cmv5wlgn902w137mlucb0xu1g, saved to `assets/player-paraguay/player-paraguay-tripo-rig-cmv5wlgn.glb`.
39 joints, correct limb placement. USED.

Animation: no new clips generated. The 25 approved Thorn Exile clips (V18 bundle) were
retargeted onto the Tripo rig by `scripts/retarget-player-paraguay.py` (bones renamed to
mixamorig, Spine1 added, WeaponSocket/ShieldSocket copied per frame, 1.80 m, leg ratio 0.849,
per-clip sourceSpeed scaled by it). Output `assets/player-paraguay/player-paraguay-rig-v1.glb`,
manifest `docs/player-paraguay/player-paraguay-rig-v1-manifest.json` ("cloth": false hides the
knight's code cloth). Phone copy `assets/mobile/player-paraguay-rig-v1.glb` (1024 maps).
Wired into `src/game/asset-paths.js` with the V18 knight as a one-line fallback.
Review stills: `docs/player-paraguay/review-v1/`, `docs/player-paraguay/game-v1/`.

Known limitations: the skirt is skinned to the legs (no cloth sim) and stretches between
them in wide strides and the roll; shawl fringe and sash tassels are not attached yet;
roll landing feedback fires up to 2 frames after the first boot touches (test 84).

Status: in the game, awaiting the user's visual review. Credits left: 93 (refill Oct 19).

v2 (2026-10-12, user asked to improve the fringe and the skirt; no credits used):
`scripts/dress-player-paraguay.py` builds `assets/player-paraguay/player-paraguay-rig-v2.glb`
+ `docs/player-paraguay/player-paraguay-rig-v2-manifest.json` from v1: 8 skirt panel bones
(Skirt0..7 under Hips, SkirtNTip at the hem); skirt vertices reweighted from thighs/shins to
pelvis + panels; the generated underside that bridged the hem to the shins removed (it tore
into spikes) and the material made double-sided; fringe anchors along the shawl's lower edge
and tassel anchors on the sash (vertex indices in the manifest "trim" block).
Runtime: `src/game/skirt-sway.js` (panel inertia, leg push, swing cone, bind-measured skirt
profile) and `src/game/player-trim.js` (Verlet fringe ribbons + red/white/blue tassels),
wired in `src/game/actors.js`; tests `test/skirt-trim.test.js`. Phone copy
`assets/mobile/player-paraguay-rig-v2.glb`. Stills: `docs/player-paraguay/review-v2/`,
`docs/player-paraguay/game-v2/`. v1 stays on disk as the fallback.
Remaining limitations: the model has no thighs under the skirt, so in the roll the lower legs
show apart from the body; right armpit stretches in some poses (from the retarget);
roll landing feedback timing (test 84) unchanged.

v3 (2026-10-12, user: improve the potion animation and have her drink tereré; no credits used,
4 left): `scripts/author-terere-heal.py` replaces the heal clip in
`assets/player-paraguay/player-paraguay-rig-v3.glb` (+ `docs/player-paraguay/player-paraguay-rig-v3-manifest.json`):
guard idle base, straightened chest/neck/head, left-arm two-bone IK to the lips (measured on
the face mesh), curled fingers, three sips; same 1.4 s and heal point. The guampa is code
(`src/game/guampa.js`: horn cup, silver bands, yerba, bombilla) attached to the left hand per
the manifest; the shield is slung upright at her left side while she drinks (createShieldSling);
gaze lock releases during the heal. Notices/burst say tereré (green burst); HUD icon is the
new `assets/ui/guampa.svg` (flask.png kept). Test `test/terere-heal.test.js`. Phone copy
`assets/mobile/player-paraguay-rig-v3.glb`. Stills: `docs/player-paraguay/review-v3/`,
`docs/player-paraguay/game-v3/`. v2 stays on disk as the fallback.
Sip sound (user approved, 2 credits): `npx genex sfx` generation cmv62f8dz03gr3jl79uskbp00
→ `assets/sfx/terere-sip-cmv62f8d.mp3` (1.23 s bombilla slurp). Provenance:
https://assets.genex.technology/generations/cmv62f8dz03gr3jl79uskbp00/audio-sfx
Wired as sound `terereSip` (src/game/audio.js, asset-paths.js), played once from the first sip
(manifest clips.heal.sips[0]) in src/game/main.js.

## 2026-10-12 — Boss redesign: the man in the user's photos

User request: "necesito que el enemigo sea este señor" with two photos of a real man
(dark navy suit, white shirt, red tie, lapel pin; short dark hair, broad face).

References (user-supplied, copied into the repo):
- `docs/references/user-boss-man-portrait.png` — front portrait, smiling, red flag behind.
- `docs/references/user-boss-man-closeup.png` — 3/4 close-up, navy suit, red tie, red star pin.

User decisions (AskUserQuestion, 2026-10-12):
- Look: **dark suit + souls touches** — his face and hair, dark suit with red tie and pin,
  but worn, dusty, with gothic details so he fits the cathedral.
- Weapon: **keep the approved scythe** (two-handed), reusing the boss combat clips.

Proposed concept brief (awaiting approval — no generation yet):
- One concept image (`npx genex image --edit` from both photos, --quality high, 7 cr),
  full body, front 3/4, very dark cathedral background, Dark Souls III mood.
- Same face, hair and build as the photos; scaled up as a boss (~2.3 m in game, as now).
- Dark navy suit, aged and frayed: dust, ash stains, torn hem, tarnished silver buttons;
  white shirt yellowed; red tie kept vivid as the colour accent; red star lapel pin.
  Gothic touches: a tarnished iron gorget/pauldron over one shoulder, chain with a
  reliquary at the belt, pale ashen skin and faint ember glow in the eyes.
- Scythe shown in both hands only as illustration; the game keeps the approved mesh.
- Production plan after concept approval (each its own approval, credits 93 left):
  neutral A-pose edit (7) → 3D model (35) → Tripo biped rig (29) → retarget the
  existing boss clips + scythe socket in Blender (no new clips). Total ≈ 78 credits.
  The Armored Death assets stay on disk as a one-line fallback.

Approval (2026-10-12): user approved the brief ("procede") for one concept image.

Concept v1 (2026-10-12): generation cmv616dz203c73jl7892ewy4m, `npx genex image --edit`
of `docs/references/user-boss-man-portrait.png`, --quality high, saved to
`assets/boss-man/concept-cmv616dz.png` (816x816; downloaded manually, CLI did not save it).
Provenance: https://assets.genex.technology/generations/cmv616dz203c73jl7892ewy4m/image-main
Notes: feet cropped; the illustrative scythe has a second blade at the butt (game keeps the
approved mesh); --aspect 2:3 was ignored. Status: awaiting the user's review.
Approval (2026-10-12): user approved concept v1 ("me gusta") to proceed to the neutral
reference and 3D model. Rig and retarget remain a later approval.

Neutral 3D reference: generation cmv617sdq03cs3jl7vild24va (`--edit` of concept v1,
--quality high, 7 cr), saved to `assets/boss-man/reference-neutral-cmv617sd.png`. It came
out as a front/side/back sheet; front view cropped (no credits) to
`assets/boss-man/reference-neutral-front-cmv617sd.png`. A-pose, feet visible, no scythe,
no loose strips. The face drifted thinner than the photos. 3D model on hold pending the
user's choice (credits: 79 left; model 46 + rig 29).
Decision (2026-10-12): user chose to continue with this reference for the 3D model.

3D model: generation cmv619pn203ge37mlkkaaxtuy, `npx genex model --image` from the cropped
front reference (46 cr), saved to `assets/boss-man/boss-man-body-cmv619pn.glb` (17.5 MB,
height 1.0 unit, front faces +X, like the Paraguayan player). Turnaround render:
`docs/boss-man/model-turnaround-cmv619pn.png`. Status: awaiting the user's model review
before the rig (29 cr; 33 left).
Approval (2026-10-12): user approved the 3D model ("procede") — rig stage.
Decision (2026-10-12): Genex per-build allowance (16 cr) refused the 29-cr rig and `budget --assets` had no .genex/ to store it; user said "procede igual", so the rig ran with GENEX_ASSET_BUDGET_SHARE=1 for that one command.
Rig attempt 1 — Tripo biped (`npx genex model rig`, 29 cr), generation cmv61lsf703hd37mlsu1u7duv, saved to `assets/boss-man/boss-man-tripo-rig-cmv61lsf.glb`. REJECTED: only one leg chain; the spine chain starts at the other knee (y 0.28). Kept on disk, unused. Credits left: 4.

Rig attempt 2 — code (no credits): `scripts/rig-boss-man.py` fits a 27-joint mixamorig skeleton to
the A-pose mesh (legs split below the crotch at 0.432, arms split from the torso by the slice gap)
and skins by inverse distance to the bone segments per region. Output
`assets/boss-man/boss-man-rig-v1-bind.glb`. USED.

Animation: no new clips. The 7 Armored Death clips (assets/production/boss-supported-combat.glb:
idle, walk-forward, sweep, slam, hit, awaken, death) retargeted by
`scripts/retarget-player-paraguay.py` (now also accepts rigs already named mixamorig), 2.5 m,
leg ratio 0.779. Output `assets/boss-man/boss-man-rig-v1.glb`, manifest
`docs/boss-man/boss-man-rig-v1-manifest.json` (Round 3 rules; "cloth": false hides the cloak).
The walk keeps the Armored Death's speed so the fight keeps its pace; his shorter stride slides.
Phone copy `assets/mobile/boss-man-rig-v1.glb`. Wired in `src/game/asset-paths.js` with the
Armored Death as a one-line fallback. Review: `docs/boss-man/review-v1/`, `docs/boss-man/game-v1/`.
Tests: 191/199 pass; the 8 failures are the same set that fails with the Armored Death.
Status: in the game, awaiting the user's visual review.

## Pantalla de carga paraguaya (13 Oct 2026)

Pedido del usuario: una pantalla de carga nueva sobre el Gran Demonio Rojo y Paraguay. El brief de una imagen
generada (`--edit` del concepto cmv616dz) fue aprobado, pero la cuenta tenía 2 créditos (la imagen cuesta 7) y la
carpeta no tiene `.genex/`; el usuario eligió hacerla en código sin generar. Luego pidió no mostrar la foto del jefe,
textos más ligados a la cultura paraguaya y un ñandutí como el de su foto de referencia (centro azul, anillo blanco
de pétalos en punta, corona roja de triángulos y borde festoneado).

- `assets/ui/nanduti.webp`: la foto del ñandutí que el usuario pidió usar tal cual (13 Oct 2026; original en
  `docs/references/user-nanduti-flag.png`, reducida a 900 px y pasada a WebP, 356 KB), oscurecida por CSS; gira despacio (240 s por vuelta)
  sobre un cielo rojo de ceniza. Un primer ñandutí dibujado en SVG fue reemplazado por esta foto.
- `assets/ui/ash.svg`: mosaico de 46 motas de ceniza (semilla fija) que cae en dos escalas.
- Textos: título «Jaha, che retã»; etapas «Calentando la sopa paraguaya y el chipá.», «Tejiendo el ñandutí de
  Itauguá.», «Cebando el tereré con yuyos del Mercado 4.»; el mensaje de error no cambia.
- `assets/ui/loader-cathedral.jpg` (la pantalla anterior) queda en disco sin usarse. Ningún crédito gastado.

## 2026-10-13 · Nuevas habilidades del jefe (solo código, sin assets nuevos)

- El usuario pidió más habilidades para el jefe y eligió **Golpe retrasado** y **Pilares de fuego**, reutilizando solo el clip aprobado del slam (sin generar animaciones). Ningún crédito gastado.
- `delayedSlam`: el slam se sostiene en lo alto (clip 1.9 → 1.98 durante 1.1 s) y luego cae; la ventana de golpe se corre lo mismo que dura la pausa.
- `pillars`: anillos de brasas siguen al jugador, se fijan cuando clava la guadaña (2.36 s) y erupcionan a los 3.3 s. Un pilar en fase 1 y tres en fila en fase 2. El efecto reutiliza `BossBurst` (estrecho y alto).
- Los datos están en `docs/boss-man/boss-man-rig-v1-manifest.json` (`actions`, `attackWeights`).

## Sonidos del parry (13 oct 2026)

- Pedido: el usuario quiso mejores sonidos para el parry, después de que el golpe de escudo reemplazó al bloqueo.
- Generados con `npx genex sfx` (2 s cada uno) y descargados en `assets/sfx/parry/` (12 créditos):
  - Parry (la guadaña resbala del escudo, cola metálica): cmv7hjxj501ts2tqoaj0rz23q, cmv7hk1zl01ty2tqornz02jco,
    cmv7hk6jc01u52tqo4tmxea8t. Una cuarta toma, cmv7hkald01ue2tqoc9bhdua3, salió casi muda (pico 0.11) y no se usa.
  - Aturdimiento del jefe (tropiezo, gruñido, golpe grave): cmv7hkepg01uk2tqogfyct9n5, cmv7hkiu801ut2tqon4e5a45b.
- Cada toma trae un segundo evento suelto pasado ~1 s; `src/game/audio.js` reproduce solo la ventana de `ASSETS.soundTrims`
  (asset-paths.js) con 0.25 s de fundido. Un parry suena con una toma de parry, la toma de bloqueo vieja a 0.45 por
  debajo para dar cuerpo, y una toma de aturdimiento desde el jefe 0.12 s después.
