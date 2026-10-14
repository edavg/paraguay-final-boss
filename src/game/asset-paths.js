// Player bundle: the Paraguayan player (12 Oct 2026), V18's clips retargeted onto her Tripo rig by
// scripts/retarget-player-paraguay.py; v2 adds the skirt panel bones and trim anchors (scripts/dress-player-paraguay.py);
// v3 replaces the heal with the tereré sip (scripts/author-terere-heal.py). Fallback to the Thorn Exile knight: swap both this import and playerRig
// below (desktop and MOBILE_ASSETS) back to player-motion-revision-3/player-video-candidate-v18.
// V18 = V17 + light2 (the light combo's second hit); V17 fallback: swap v18 -> v17.
import playerMotion from '../../docs/player-paraguay/player-paraguay-rig-v3-manifest.json' with {type:'json'};
// Boss bundle: the man from the user's photos (12 Oct 2026), the Round 3 Armored Death clips retargeted onto his
// mesh-fitted rig (scripts/rig-boss-man.py + scripts/retarget-player-paraguay.py). Fallback to Armored Death: swap this
// import back to boss-round3-manifest.json and bossRig below (desktop and MOBILE_ASSETS) to boss-supported-combat.glb.
import bossMotion from '../../docs/boss-man/boss-man-rig-v1-manifest.json' with {type:'json'};
import {withActorScale} from './actor-scale.js';
// Round 2 (stream FX): the user's chosen combat sounds. Each key in the JSON is a
// list of local takes under assets/sfx/; the game picks one per play and never
// repeats the last (src/game/audio.js). Extend or swap takes by editing the JSON
// alone. Under Vite every mp3 in assets/sfx/ is resolved (and hashed in a build)
// by the glob; Node (tests, scripts) has no import.meta.env and takes plain URLs.
import soundsChosen from '../../docs/round-2-2026-09-16/sounds-chosen.json' with {type:'json'};
const SFX_URLS=import.meta.env?import.meta.glob('../../assets/sfx/**/*.mp3',{eager:true,query:'?url',import:'default'}):{};
const sfxUrl=relative=>SFX_URLS['../../'+relative]??new URL('../../'+relative,import.meta.url).href;
const chosenSounds=(key,fallback)=>{const takes=(Array.isArray(soundsChosen[key])?soundsChosen[key]:[soundsChosen[key]]).filter(take=>typeof take==='string'&&take.endsWith('.mp3')).map(sfxUrl);return takes.length?takes:fallback;};
export const ASSETS={
 playerRig:new URL('../../assets/player-paraguay/player-paraguay-rig-v3.glb',import.meta.url).href, // knight fallback: player-motion-revision-3/player-video-candidate-v18.glb + its manifest import above
 bossRig:new URL('../../assets/boss-man/boss-man-rig-v1.glb',import.meta.url).href, // Armored Death fallback: production/boss-supported-combat.glb
 scythe:new URL('../../assets/idle-video-motion/scythe-fitted.glb',import.meta.url).href,
 scytheHeight:2.85,
 motion:{player:playerMotion,boss:withActorScale(bossMotion,1.3)},
 footstep:new URL('../../assets/a-single-muted-heavy-armored-boot-footst-cmu1i7mt.mp3',import.meta.url).href,
 playerShield:new URL('../../assets/create-the-exact-isolated-player-shield-cmu12nf3.glb',import.meta.url).href,
 playerSword:new URL('../../assets/create-the-exact-isolated-player-sword-s-cmu12ngf.glb',import.meta.url).href,
 stone:new URL('../../assets/webp/ancient-gothic-cathedral-limestone-mason-cmu1fw79.webp',import.meta.url).href,
 floor:new URL('../../assets/webp/ancient-dark-cathedral-flagstone-floor-l-cmu1fw8c.webp',import.meta.url).href,
 // The one music track (13 Oct 2026, the load pass): the choir, formerly "Coro de pavor" in the pause menu.
 // The other three tracks are no longer bundled; the files stay in assets/.
 music:new URL('../../assets/a-dark-gothic-boss-battle-theme-slow-and-cmu4dws4.mp3',import.meta.url).href,
 impact:new URL('../../assets/one-powerful-heavy-steel-scythe-impact-a-cmu1fwan.mp3',import.meta.url).href,
 swing:new URL('../../assets/one-heavy-two-handed-scythe-swing-whoosh-cmu1fwbo.mp3',import.meta.url).href,
 groundSlam:new URL('../../assets/sfx/boss-ground-slam-cmu37r5d.mp3',import.meta.url).href,
 darkFire:new URL('../../assets/sfx/scythe-dark-fire-cmu37rdp.mp3',import.meta.url).href,
 bossRoar:new URL('../../assets/sfx/boss-awaken-roar-cmu37rfo.mp3',import.meta.url).href,
 // Cathedral surfaces and fittings (stream A). The banner atlas, lancet glass
 // and wall grunge are cropped and de-fringed copies of the generated PNGs.
 cathedralFloor:new URL('../../assets/webp/seamless-tiling-ancient-cathedral-flagst-cmu38eyn.webp',import.meta.url).href,
 cathedralWall:new URL('../../assets/webp/seamless-tiling-weathered-gothic-limesto-cmu38f00.webp',import.meta.url).href,
 cathedralOak:new URL('../../assets/webp/seamless-tiling-very-dark-oxidised-oak-c-cmu38f1h.webp',import.meta.url).href,
 cathedralMetal:new URL('../../assets/webp/seamless-tiling-tarnished-brass-and-wrou-cmu38f45.webp',import.meta.url).href,
 lancetGlass:new URL('../../assets/webp/environment/lancet-glass.webp',import.meta.url).href,
 bannerAtlas:new URL('../../assets/webp/environment/banner-atlas.webp',import.meta.url).href,
 // The ANR flag as a torn nave banner (scripts/make-anr-banner.py).
 bannerAnr:new URL('../../assets/webp/environment/banner-anr.webp',import.meta.url).href,
 wallGrunge:new URL('../../assets/webp/environment/wall-grunge.webp',import.meta.url).href,
 windowCookie:new URL('../../assets/webp/greyscale-light-cookie-gobo-mask-three-t-cmu38gk1.webp',import.meta.url).href,
 // Cloth relief and the chancel swag row (stream A, second session). Both were
 // generated last night and were sitting on disk wired to nothing.
 bannerDamask:new URL('../../assets/webp/environment/banner-damask.webp',import.meta.url).href,
 valanceSwag:new URL('../../assets/webp/environment/valance-swag.webp',import.meta.url).href,
 // Round 2, 16 Sep (stream ENV): three floor paving sets blended by a world-
 // space zone mask, the wall relief and a debris sprite sheet. The texture lane
 // returns base colour only on this account, so every *-nr.png is a normal map
 // (xyz) with roughness packed in alpha, derived from the photograph by
 // scripts/derive-pbr-maps.py. The wall relief is derived from cathedralWall
 // itself so its joints and streaks match the albedo exactly.
 floorFlagstoneGrey:new URL('../../assets/webp/environment/floor-flagstone-grey.webp',import.meta.url).href,
 floorFlagstoneGreyNR:new URL('../../assets/webp/environment/floor-flagstone-grey-nr.webp',import.meta.url).href,
 // The nave set: black basalt, the only floor since 13 Oct 2026 (the load pass removed the pause-menu Floor choice
 // and with it the chequer and diagonal-marble sets; their files stay in assets/environment/).
 floorBasalt:new URL('../../assets/webp/environment/floor-basalt.webp',import.meta.url).href,
 floorBasaltNR:new URL('../../assets/webp/environment/floor-basalt-nr.webp',import.meta.url).href,
 floorTomb:new URL('../../assets/webp/environment/floor-tomb.webp',import.meta.url).href,
 floorTombNR:new URL('../../assets/webp/environment/floor-tomb-nr.webp',import.meta.url).href,
 wallAshlarNR:new URL('../../assets/webp/environment/wall-ashlar-nr.webp',import.meta.url).href,
 debrisAtlas:new URL('../../assets/webp/environment/debris-atlas.webp',import.meta.url).href,
 // Round 3 (16 Sep evening, graphics pass): a 2x2 atlas of floor damage decals (shattered slab, crack, crater,
 // rubble scatter), de-fringed copy of the generated sheet, laid over the fighting floor by arena.js.
 floorDamageAtlas:new URL('../../assets/webp/environment/floor-damage-atlas.webp',import.meta.url).href,
 // Round 4 (17 Sep, afternoon): the funerary seal inlaid in the fighting floor, a generated top-down inlay with alpha
 // between the metal (prepared by scripts/prepare-floor-seal.py) and a normal map derived from it.
 floorSeal:new URL('../../assets/webp/environment/floor-seal.webp',import.meta.url).href,
 floorSealNR:new URL('../../assets/webp/environment/floor-seal-nr.webp',import.meta.url).href,
 // The user's chosen combat sounds (round 2, stream FX): lists of takes from
 // docs/round-2-2026-09-16/sounds-chosen.json, falling back to the old pair.
 playerHitArmor:chosenSounds('playerHitArmor',[new URL('../../assets/one-powerful-heavy-steel-scythe-impact-a-cmu1fwan.mp3',import.meta.url).href]),
 bossSwing:chosenSounds('bossSwing',[new URL('../../assets/one-heavy-two-handed-scythe-swing-whoosh-cmu1fwbo.mp3',import.meta.url).href]),
 bossHitPlayer:chosenSounds('bossHitPlayer',[new URL('../../assets/one-powerful-heavy-steel-scythe-impact-a-cmu1fwan.mp3',import.meta.url).href]),
 playerSwing:chosenSounds('playerSwing',[new URL('../../assets/one-heavy-two-handed-scythe-swing-whoosh-cmu1fwbo.mp3',import.meta.url).href]),
 // The bombilla slurp of the Paraguayan player's tereré heal (npx genex sfx, generation cmv62f8dz03gr3jl79uskbp00).
 terereSip:sfxUrl('assets/sfx/terere-sip-cmv62f8d.mp3'),
 // The parry (13 Oct 2026, user: better parry sounds): three generated takes of the scythe glancing off the shield
 // (npx genex sfx, generations cmv7hjxj, cmv7hk1z, cmv7hk6j; a fourth, cmv7hkal, came back near silent and is unused)
 // and two of the boss reeling (cmv7hkep, cmv7hkiu). Each file carries a stray second event after ~1 s, so audio.js
 // plays only the [start, end] seconds in `soundTrims`, with a fade-out.
 parry:['parry-1-cmv7hjxj','parry-2-cmv7hk1z','parry-3-cmv7hk6j'].map(name=>sfxUrl(`assets/sfx/parry/${name}.mp3`)),
 stagger:['stagger-1-cmv7hkep','stagger-2-cmv7hkiu'].map(name=>sfxUrl(`assets/sfx/parry/${name}.mp3`)),
 soundTrims:{parry:[[0,.95],[0,1.2],[.08,.85]],stagger:[[0,1.6],[0,1.5]]},
 playerFootstep:chosenSounds('playerFootstep',[new URL('../../assets/a-single-muted-heavy-armored-boot-footst-cmu1i7mt.mp3',import.meta.url).href]),
 block:chosenSounds('block',[new URL('../../assets/one-powerful-heavy-steel-scythe-impact-a-cmu1fwan.mp3',import.meta.url).href]),
};

// Phone copies (17 Sep 2026, the mobile pass): the same models with their 4096-square maps resized to 1024 by
// scripts/make-mobile-assets.py (mesh, rig, clips and materials byte-for-byte the same), and the seal at 1024.
// main.js swaps these in on the touch path only; the desktop never reads this table.
export const MOBILE_ASSETS={
 playerRig:new URL('../../assets/mobile/player-paraguay-rig-v3.glb',import.meta.url).href, // knight fallback: mobile/player-video-candidate-v18.glb
 bossRig:new URL('../../assets/mobile/boss-man-rig-v1.glb',import.meta.url).href, // Armored Death fallback: mobile/boss-supported-combat.glb
 scythe:new URL('../../assets/mobile/scythe-fitted.glb',import.meta.url).href,
 playerSword:new URL('../../assets/mobile/player-sword.glb',import.meta.url).href,
 playerShield:new URL('../../assets/mobile/player-shield.glb',import.meta.url).href,
 monument:new URL('../../assets/mobile/funerary-monument.glb',import.meta.url).href,
 monumentLod:new URL('../../assets/mobile/funerary-monument-lod.glb',import.meta.url).href,
 floorSeal:new URL('../../assets/webp/mobile/floor-seal.webp',import.meta.url).href,
 floorSealNR:new URL('../../assets/webp/mobile/floor-seal-nr.webp',import.meta.url).href,
};

