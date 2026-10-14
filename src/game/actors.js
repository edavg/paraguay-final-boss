import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPlayerCloth,updatePlayerCloth,bindCloth} from './player-cloth.js';
import {SkirtSway} from './skirt-sway.js';
import {createPlayerTrim} from './player-trim.js';
import {createGuampa,createShieldSling} from './guampa.js';
import {createBossCloth} from './boss-cloth.js';
import {capObjectTextures} from './texture-budget.js';
import {bossWeaponPose,playerWeaponPose, actionDuration, createActionTimings} from './weapon-motion.js';
import {clipPlayback} from './weapon-motion.js';
import {ActorAnimation} from './animation-controller.js';
import {FootContacts} from './contact-feedback.js';
import {SoleClearance} from './sole-clearance.js';
import {FootPlant} from './foot-plant.js';
import {LocomotionFootBlend} from './locomotion-foot-blend.js';
import {BossFootwork} from './boss-footwork.js';
import {BossLeapPose,leapFlight} from './boss-leap.js';
import {actorDimensions} from './actor-scale.js';
import {createHeadEffect} from './head-effect.js';
import {applyClipAdjustments} from './clip-adjustments.js';
import {FacingGizmo} from './facing-gizmo.js';
import {GazeLock} from './gaze-lock.js';
import {createShieldStrap} from './shield-strap.js';
import {createShieldDrop} from './shield-drop.js';
import {ShieldBash,BossStagger} from './shield-bash.js';
const loader=new GLTFLoader();
/** Shield placement in the ShieldSocket frame, solved by scripts/solve-shield-mount.mjs:
 * face normal along the fist, height axis upright. The legacy fallback lay along the forearm. */
export function shieldMountTransform(metadata={}){
 const mount=metadata.shieldMount,legacy={quaternion:new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,Math.PI/2,0)),position:new T.Vector3()};
 // During the shoulder roll the guard mount would sweep through the floor, so the shield
 // is tucked back along the forearm (the legacy mount) for the tumbling part of the clip.
 const tuck=mount?.tuck?{quaternion:new T.Quaternion().fromArray(mount.tuck.quaternion??legacy.quaternion.toArray()),position:new T.Vector3().fromArray(mount.tuck.position??[0,0,0])}:legacy;
 return mount?{height:mount.height??.73,quaternion:new T.Quaternion().fromArray(mount.quaternion),position:new T.Vector3().fromArray(mount.position),tuck}
  :{height:.73,...legacy,tuck:null};
}
const smoothstep=(edge0,edge1,x)=>{const t=Math.min(1,Math.max(0,(x-edge0)/(edge1-edge0)));return t*t*(3-2*t);};
export function shieldTuckWeight(action,duration){
 if(action?.name!=='dodge'||!Number.isFinite(duration))return 0;
 const t=action.elapsed||0;
 // Strapped on early, while the character is still upright and the elbow is high:
 // a 1.5 m shield sweeps low while it is halfway between the guard and the strap.
 return smoothstep(.03,.14,t)*(1-smoothstep(duration-.33,duration-.22,t));
}
export function weaponSegmentFor(isBoss,paths={}){
 return (isBoss?paths.motion?.boss:paths.motion?.player)?.weaponSegment || (isBoss
  ? [[.18,3.12,-.12],[.93,2.65,-.2]].map(point=>point.map(value=>value*(paths.scytheHeight||3.2)/3.2))
  : [[0,.28,0],[0,1.27,0]]);
}
function prepare(root,height,yaw=0){const wrapper=new T.Group();wrapper.add(root);root.rotation.y=yaw;wrapper.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());const scale=height/size.y;root.scale.multiplyScalar(scale);root.updateMatrixWorld(true);box.setFromObject(root);const center=box.getCenter(new T.Vector3());root.position.sub(new T.Vector3(center.x,box.min.y,center.z));root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;if(n.material){n.material.envMapIntensity=.75;}}});wrapper.updateMatrixWorld(true);return wrapper;}
export async function loadActors(scene,paths,{textureCap=0,serial=false}={}){
 const files=[paths.playerRig||paths.playerBody,paths.bossRig||paths.bossBody,paths.playerSword,paths.playerShield,paths.scythe];
 // Touch (17 Sep 2026): one file at a time on a phone, so the decodes never stack; the desktop keeps loading all five at once.
 const results=serial?await files.reduce(async(done,p)=>{const list=await done;list.push(await loader.loadAsync(p));return list;},Promise.resolve([])):await Promise.all(files.map(p=>loader.loadAsync(p)));
 // Touch (17 Sep 2026): the five GLBs carry fifteen 4096-square maps; on a phone they are shrunk to textureCap before
 // their first upload (texture-budget.js). The desktop passes 0 and keeps them whole.
 if(textureCap)await Promise.all(results.map(gltf=>capObjectTextures(gltf.scene,textureCap)));
 const player=createActor(results[0],1.85,false,!!paths.playerRig,paths.motion?.player),boss=createActor(results[1],2.5,true,!!paths.bossRig,paths.motion?.boss);scene.add(player.root,boss.root);
 // Props are independent rigid assets with explicit shaft/grip transforms.
 function prop(g,height,yaw=-Math.PI/2){return prepare(g.scene,height,yaw);}
 results[2].scene.rotation.z=Math.PI;player.weapon=prop(results[2],1.28);player.weapon.name='Thorn blade';(player.body.getObjectByName('WeaponSocket')||player.root).add(player.weapon);
 const shieldMount=shieldMountTransform(paths.motion?.player);player.shield=prop(results[3],shieldMount.height);(player.body.getObjectByName('ShieldSocket')||player.root).add(player.shield);player.shield.quaternion.copy(shieldMount.quaternion);player.shield.position.copy(shieldMount.position);player.shieldMount=shieldMount;
 for(const a of [player,boss]){a.gizmo=new FacingGizmo(a);scene.add(a.gizmo.group);}
 boss.weapon=prop(results[4],paths.scytheHeight||3.2);boss.weapon.name='Death scythe';(boss.body.getObjectByName('WeaponSocket')||boss.root).add(boss.weapon);
 // Align the real handle geometry, rather than the center of the entire
 // asymmetric blade, with each socket's grip axis.
 function centerGrip(wrapper,lo,hi){
  scene.updateMatrixWorld(true);const inv=wrapper.matrixWorld.clone().invert(),xs=[],zs=[];
  wrapper.children[0].traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++){
   const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).applyMatrix4(inv);
   if(p.y>lo&&p.y<hi){xs.push(p.x);zs.push(p.z);}
  }}});
  if(xs.length){xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);wrapper.children[0].position.x-=xs[Math.floor(xs.length/2)];wrapper.children[0].position.z-=zs[Math.floor(zs.length/2)];}
 }
 centerGrip(player.weapon,.08,.25);centerGrip(boss.weapon,.55,1.25);
 player.weapon.rotation.set(Math.PI/2,0,0);boss.weapon.rotation.set(Math.PI/2,0,0);
 player.weaponSegment=weaponSegmentFor(false,paths);
 boss.weaponSegment=weaponSegmentFor(true,paths);
 // Cloth is detachable: each garment declares which bone carries it, and the
 // offset is captured in the bind pose so the sewn rows stay on the armour.
 // The knight's garments are measured for his armour; a manifest with "cloth": false (the Paraguayan player) hides them.
 player.cloth=createPlayerCloth(1.85);player.cloth.visible=paths.motion?.player?.cloth!==false;player.root.add(player.cloth);
 player.trim=createPlayerTrim(player.body,paths.motion?.player?.trim,player.skirt);if(player.trim)player.root.add(player.trim.object);
 player.guampa=createGuampa(player.body,paths.motion?.player?.clips?.heal?.guampa);
 // The guampa takes the shield hand, so the shield is slung at her side while she drinks.
 player.shieldSling=player.guampa?createShieldSling(player):null;
 boss.cloth=createBossCloth(2.5);boss.cloth.visible=paths.motion?.boss?.cloth!==false;boss.root.add(boss.cloth); // the man in the suit wears no cloak
 for(const a of [player,boss]){
  a.root.updateMatrixWorld(true);
  a.clothBindings=bindCloth(a.cloth,a.body);
 }
 return{player,boss};
}
/** The clip under a pose layer: the bash runs the guard (`block`) at its own pace from the top; the stagger drives the
 * boss's `hit` recoil to its peak, holds it, and plays it out over the last .3 s. */
export function layerPlayback(action,timings,clips){
 if(action?.name==='parry'&&clips.has('block')){const duration=clips.get('block').getClip().duration;return {name:'block',duration,action};}
 if(action?.name==='stagger'&&clips.has('hit')){const duration=clips.get('hit').getClip().duration,total=actionDuration(timings.stagger)??1.7,peak=duration/2,t=action.elapsed||0;
  const time=t<total-peak?Math.min(peak,t):Math.min(duration,peak+(t-(total-peak)));return {name:'hit',duration,action:{...action,elapsed:time}};}
 return null;
}
export function createActor(gltf,height,isBoss,rigged,metadata={}){const root=new T.Group(),visualRoot=new T.Group();root.add(visualRoot);const dimensions=actorDimensions(isBoss,metadata);root.scale.setScalar(dimensions.scale);if(rigged){visualRoot.add(gltf.scene);gltf.scene.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});}else visualRoot.add(prepare(gltf.scene,height,-Math.PI/2));root.name=isBoss?'Gran demonio rojo':'Exiliado de Espinas';applyClipAdjustments(gltf.animations,metadata);const animation=new ActorAnimation(gltf.scene,gltf.animations,metadata),mixer=animation.mixer,clips=animation.actions;const timings=createActionTimings(metadata,isBoss),footContacts=new FootContacts(),soleClearance=new SoleClearance(gltf.scene,{maxLift:.06*dimensions.scale}),footPlant=!isBoss&&rigged?new FootPlant(gltf.scene,soleClearance):null,locomotionFootBlend=!isBoss&&rigged?new LocomotionFootBlend(gltf.scene,soleClearance,gltf.animations):null,skirt=!isBoss&&rigged?SkirtSway.from(gltf.scene):null,footwork=isBoss&&rigged?new BossFootwork(gltf.scene,soleClearance,{scale:dimensions.scale}):null;const leap=footwork?new BossLeapPose(gltf.scene,footwork,{scale:dimensions.scale}):null;const headEffect=isBoss&&rigged?createHeadEffect(gltf.scene.getObjectByName('mixamorigHead')):null,gazeLock=!isBoss&&rigged?new GazeLock(gltf.scene,root):null,poseLayer=rigged?(isBoss?new BossStagger(gltf.scene,root):new ShieldBash(gltf.scene,root)):null;const footBones=Object.fromEntries(['Left','Right'].map(side=>[side,gltf.scene.getObjectByName('mixamorig'+side+'Foot')]).filter(([,bone])=>bone));return{poseLayer,footwork,leap,skirt,trim:null,guampa:null,headEffect,gazeLock,dimensions,worldScale:dimensions.scale,authoredHeight:height,locomotionFootBlend,footPlant,soleClearance,footContacts,footBones,footsteps:[],root,visualRoot,body:gltf.scene,animation,mixer,clips,metadata,timings,height:height*dimensions.scale,isBoss,lastPosition:new T.Vector3(),speed:0,deathTime:0,weapon:null,segment:null,previousSegment:null,reset(motion){
 this.shieldDrop?.reset();this.skirt?.reset();this.footwork?.reset();this.trim?.reset();this.animation.reset();this.headEffect?.reset();this.gazeLock?.reset();this.footContacts.reset();this.footsteps=[];this.current=null;this.lastAction=null;this.deathTime=0;this.speed=0;this.moving=false;this.moveDirection='forward';
 this.root.position.set(motion.x,0,motion.z);this.root.rotation.y=motion.yaw;this.lastPosition.copy(this.root.position);this.previousPosition=this.root.position.clone();
 this.previousSegment=null;this.segment=null;
 },update(dt,time,state,motion){
 this.root.position.set(motion.x,0,motion.z);this.root.rotation.y=motion.yaw;this.speed=this.root.position.distanceTo(this.lastPosition)/Math.max(dt,.001);this.lastPosition.copy(this.root.position);
 let action=state.action;
 if(state.health<=0){this.deathTime+=dt;action={name:'death',elapsed:this.deathTime};}
 this.headEffect?.update(dt,time,action,this.timings[action?.name],state.health);
 this.moving=this.speed>(this.moving?.09:.18);
 let direction=this.moveDirection||'forward';
 if(this.moving&&!this.isBoss){
  const delta=this.root.position.clone().sub(this.previousPosition||this.root.position);
  const local=delta.applyAxisAngle(new T.Vector3(0,1,0),-motion.yaw),angle=Math.atan2(local.x,local.z);
  // These rigs face +Z: anatomical right is -X (the right-hand bone is at -X).
  const names=['forward','forward-left','left','back-left','backward','back-right','right','forward-right'];
  const previous=names.indexOf(direction)*Math.PI/4;
  const difference=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));
  // A small dead band prevents alternation at the 45-degree sector boundary.
  if(Math.abs(difference)>Math.PI/8+.09)direction=names[(Math.round(angle/(Math.PI/4))+8)%8];
 }
 this.moveDirection=direction;
 this.previousPosition=this.root.position.clone();
 const locomotion=this.isBoss?'walk-forward':(state.blocking&&this.clips.has('walk-'+direction)?'walk-':'run-')+direction;
 const name=action?.name||(this.moving?locomotion:state.blocking?'block':'idle');
 // A derived boss action (flurry, burst) plays its base clip at the clip time its segment program asks for.
 // The shield bash plays over the guard in real time and the parried boss over his recoil (src/game/shield-bash.js).
 const playback=clipPlayback(action,this.timings)??layerPlayback(action,this.timings,this.clips);
 this.footwork?.restore();
 this.animation.update(dt,playback?playback.name:name,{action:playback?playback.action:action,token:state.health<=0?'death':state.action,duration:playback?playback.duration:actionDuration(this.timings[action?.name]),speed:this.speed});
 // Root displacement stays on the ground. Dodge rotation belongs to the skeleton clip;
 // the blended stance yaw turns a camera-facing capture toward the gameplay facing.
 this.visualRoot.rotation.set(0,this.animation.yawOffset||0,0);this.visualRoot.position.set(0,0,0);
 this.root.updateMatrixWorld(true);
 this.poseLayer?.apply(action,actionDuration(this.timings[action?.name]));
 // The boss's boots stay planted while he turns and step to follow; his walk sways over the stance boot (src/game/boss-footwork.js).
 // Through a leap (the burst) the body flies over the floor: the boots ride with it instead of staying planted.
 const flight=leapFlight(this.timings[action?.name]?.leap,action?.elapsed||0),leaping=flight>=0&&flight<1;
 this.footwork?.apply(this.animation,motion,dt,{suspended:state.health<=0||!!action?.rawPose||leaping});
 // The gaze follows the opponent on top of the clip (dodge and death keep the captured head).
 this.gazeLock?.update(dt,{layers:this.animation.layers,raw:!!action?.rawPose});
 // Pure clips, actions and direct/raw inspection retain their original poses.
 this.locomotionFootBlend?.apply(this.animation,{rawPose:!!action?.rawPose,directClipTime:!!action?.directClipTime});
 // Blend rotations can drive a boot below the floor even when both source
 // poses are planted. Lift only negative sole clearance; keep airborne clips.
 if(!action?.rawPose){
  this.footPlant?.correct();
  const soleLift=this.soleClearance.lift();
  if(soleLift>0){this.visualRoot.position.y=soleLift/this.worldScale;this.visualRoot.updateMatrixWorld(true);}
  // The leap's lift, crouch and tucked legs go on the corrected pose (src/game/boss-leap.js).
  this.leap?.apply(state.health>0?action:null,this.timings[action?.name],this.visualRoot,this.root);
 }else if(this.footPlant)this.footPlant.maxCorrection=0;
 // The skirt panels and the shawl/sash trim are code cloth on top of the final pose (src/game/skirt-sway.js, player-trim.js).
 this.skirt?.update(dt);this.trim?.update(dt,this.root);this.guampa?.update(action);
 const solePoints=this.soleClearance.contactPoints(),actualSoles=Object.keys(solePoints).length>0;
 const feet=actualSoles?solePoints:Object.fromEntries(Object.entries(this.footBones).map(([side,bone])=>[side,bone.getWorldPosition(new T.Vector3())]));
 this.footsteps=this.footContacts.update(dt,feet,{moving:this.moving,boss:this.isBoss,settled:!this.animation.transition,action,groundHeight:actualSoles?0:undefined,scale:this.worldScale});
 const wp=this.isBoss?bossWeaponPose(action?.name,action?.elapsed||0):playerWeaponPose(action?.name,action?.elapsed||0);
 if(this.weapon){if(this.weapon.parent===this.root){this.weapon.position.fromArray(wp.position);this.weapon.rotation.set(...wp.rotation);}this.weapon.updateMatrixWorld(true);this.previousSegment=this.segment;const ends=this.weaponSegment||[[0,.28,0],[0,1.27,0]],a=new T.Vector3(...ends[0]),b=new T.Vector3(...ends[1]);this.segment=[a.applyMatrix4(this.weapon.matrixWorld).toArray(),b.applyMatrix4(this.weapon.matrixWorld).toArray()];}
 // On death the shield slips out of the hand and falls (src/game/shield-drop.js); created on the first frame, while it is still in the socket.
 if(this.shield&&!this.isBoss&&this.shieldDrop===undefined)this.shieldDrop=createShieldDrop(this);
 this.shieldDrop?.update(dt,state.health<=0,this.deathTime);
 // Socket animation owns shield orientation when rigged.
 if(this.shield&&this.shield.parent===this.root){this.shield.position.set(.43,state.blocking?1.13:.8,state.blocking?.47:.08);this.shield.rotation.y=state.blocking?0:Math.PI/2;}
 // The roll tuck straps the shield to the left forearm instead of following the whipping
 // hand socket; src/game/shield-strap.js keeps it off the floor and blends it back.
 else if(this.shield&&!this.shieldDrop?.dropped){if(this.shieldStrap===undefined)this.shieldStrap=createShieldStrap(this);this.shieldStrap?.update(dt,shieldTuckWeight(action,actionDuration(this.timings.dodge)));if(this.shieldSling&&!this.shieldDrop?.dropped)this.shieldSling.update(action,actionDuration(this.timings.heal));}
 if(this.cloth){
  // Two temporaries kept on the actor: this used to clone a Matrix4 for the
  // inverse and clone it again per garment, 9 allocations every frame.
  const inverse=this.clothInverse??=new T.Matrix4(),matrix=this.clothMatrix??=new T.Matrix4();
  inverse.copy(this.root.matrixWorld).invert();
  for(const {garment,bone,offset} of this.clothBindings||[]){
   matrix.copy(inverse).multiply(bone.matrixWorld).multiply(offset);
   matrix.decompose(garment.position,garment.quaternion,garment.scale);
  }
  updatePlayerCloth(this.cloth,dt,time,{speed:this.speed});}
 this.gizmo?.update();
 }};}
