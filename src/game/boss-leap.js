import * as T from 'three';
// The leaping eruption (13 Oct 2026, user: "when he does the area attack on the floor I'd like him to jump, with a
// Dark Souls / Elden Ring style animation"). The rig has no jump clip, so the burst keeps the approved slam clip
// (stretched by its `segments` so the scythe hangs overhead through the flight) and this module adds the jump on top:
//  - a crouch before take-off and a hard compression on landing: the hips drop, both boots stay on the stone;
//  - the flight: the whole body rises on an arc that hangs at the top and drops fast, the knees tuck (the lead
//    leg high, the trailing leg folded under), the toes point down and the body rocks back on the rise and pitches
//    into the cut on the way down;
//  - the travel: when he leaves the floor the landing spot locks a little short of where the player stood, and the
//    ring of coals moves there (motion.js carries him, impact-effects.js draws the ring).
// All times are action seconds (`action.elapsed`), all lengths world metres (createActionTimings scales them).
const UP=new T.Vector3(0,1,0);
const clamp01=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp01(x);return x*x*(3-2*x);};
const between=(t,a,b)=>smooth((t-a)/(b-a));

/** 0..1 through the flight, or -1 on the ground before take-off (1 after the landing). */
export function leapFlight(leap,elapsed){
 if(!leap)return -1;
 if(elapsed<leap.takeoff)return -1;
 return clamp01((elapsed-leap.takeoff)/(leap.land-leap.takeoff));
}

/** Height of the body above its standing pose at flight fraction `s`: a quick rise that decelerates into a hang at
 * `apex` and a fall that accelerates into the floor (the fall is the shorter half, so the slam lands hard). */
export function leapHeight(leap,s){
 if(!(s>0&&s<1))return 0;
 const apex=leap.apex??.54;
 return leap.height*(s<apex?1-(1-s/apex)**2:1-((s-apex)/(1-apex))**2);
}

/** The pose of the leap at `elapsed`: `lift` (m, the body off the floor), `crouch` (m, the hips below a standing
 * stance with the boots planted), `tuck` (0..1, the knees drawn up), `pitch` (rad about the lateral axis, + into
 * the cut) and `travel` (0..1 of the way to the landing spot). */
export function leapPose(leap,elapsed){
 const t=Math.max(0,elapsed||0),s=leapFlight(leap,t),air=s>0&&s<1;
 const {takeoff,land}=leap,depth=leap.crouch,impact=leap.impact??depth;
 // The gather: he sinks over the last .4 s before the spring and drives out of it as he leaves the floor.
 const gather=between(t,takeoff-.42,takeoff-.06)*(1-between(t,takeoff-.06,takeoff+.1));
 // The landing: the knees take the fall in a few frames, hold under the planted scythe and rise with it.
 const absorb=between(t,land-.01,land+.07)*(1-between(t,land+.16,land+.85));
 const crouch=depth*gather+impact*absorb;
 const tuck=air?between(s,.04,.3)*(1-between(s,.68,.95)):0;
 // Back on the spring (the scythe is cocked behind him), forward into the cut as he drops.
 const pitch=air?-.16*Math.sin(Math.PI*clamp01(s/.6))*(1-between(s,.35,.6))+.2*between(s,.5,.82)*(1-between(s,.9,1)):0;
 return {lift:leapHeight(leap,s),crouch,tuck,pitch,travel:s<0?0:s,airborne:air};
}

/** Where the leap lands: toward the player, `gap` short of them (so the eruption is around them, not under the
 * boss's boots on top of them) and never more than `maxDistance` from the take-off; straight up when already close. */
export function leapLanding(leap,boss,player){
 const dx=player.x-boss.x,dz=player.z-boss.z,distance=Math.hypot(dx,dz);
 const travel=Math.min(leap.maxDistance??Infinity,Math.max(0,distance-leap.gap));
 const ux=distance>1e-6?dx/distance:Math.sin(boss.yaw??0),uz=distance>1e-6?dz/distance:Math.cos(boss.yaw??0);
 return {x:boss.x+ux*travel,z:boss.z+uz*travel,distance:travel,yaw:Math.atan2(ux,uz)};
}

/** The visual half: lift, pitch, crouch and tuck on the evaluated slam pose. Runs after the floor correction and
 * before the soles are read for footsteps. It writes only bones BossFootwork restores before the next clip sample
 * (hips and both legs), and marks it dirty so that happens even on a frame its own plant left alone. */
export class BossLeapPose{
 constructor(body,footwork,{scale=1}={}){
  this.footwork=footwork;this.scale=scale;this.hips=body.getObjectByName('mixamorigHips');
  this.ready=!!(footwork&&footwork.legs.length===2&&this.hips);
  this.lift=0;
  this.v=Array.from({length:4},()=>new T.Vector3());this.q=Array.from({length:4},()=>new T.Quaternion());
  this.targets=[new T.Vector3(),new T.Vector3()];this.clipFeet=[new T.Quaternion(),new T.Quaternion()];this.lead=0;this.rotations=[new T.Quaternion(),new T.Quaternion()];
 }
 /** `visualRoot` carries the lift; `root` is the gameplay transform (its facing gives forward and the lean axis). */
 apply(action,spec,visualRoot,root){
  this.lift=0;
  const leap=spec?.leap;
  if(!this.ready||!leap||!action)return;
  const pose=leapPose(leap,action.elapsed);
  if(pose.lift<=1e-5&&pose.crouch<=1e-5&&pose.tuck<=1e-5&&Math.abs(pose.pitch)<=1e-5)return;
  this.lift=pose.lift;
  const [forward,lean,hip,offset]=this.v,[turn,toe]=this.q;
  forward.set(0,0,1).applyQuaternion(root.getWorldQuaternion(this.q[2])).setY(0).normalize();
  lean.crossVectors(UP,forward).normalize();
  // The whole body leaves the floor; the clip's own hips stay where the clip put them inside it.
  visualRoot.position.y+=pose.lift/this.scale;visualRoot.updateMatrixWorld(true);
  if(Math.abs(pose.pitch)>1e-5)this.footwork.rotateInWorld(this.hips,turn.setFromAxisAngle(lean,pose.pitch));
  // The boots as the (lifted, pitched) clip has them; these are what the legs reach for.
  const legs=this.footwork.legs;
  this.hips.getWorldPosition(hip);
  for(const [i,leg] of legs.entries()){leg.foot.getWorldPosition(this.targets[i]);leg.foot.getWorldQuaternion(this.rotations[i]);}
  // The crouch lowers everything above the boots; the legs then fold to keep the boots where they were.
  if(pose.crouch>1e-5){visualRoot.position.y-=pose.crouch/this.scale;visualRoot.updateMatrixWorld(true);this.hips.getWorldPosition(hip);}
  if(pose.tuck>1e-5){
   // Placed from each hip socket, not from the clip's standing boots (reaching up from those kicked the lead leg
   // out straight): the lead boot (the one further forward) tucks under the knee drawn up in front of him, the
   // trailing boot folds back behind the hips with the knee pointing down; both toes drop.
   const ahead=legs.map((_,i)=>offset.copy(this.targets[i]).sub(hip).dot(forward)),lead=ahead[0]>ahead[1]?0:1;this.lead=lead;
   for(const [i,leg] of legs.entries()){
    const high=i===lead,goal=leg.upper.getWorldPosition(offset);
    goal.addScaledVector(forward,(high?.24:-.36)*this.scale).addScaledVector(UP,-(high?.42:.46)*this.scale);
    this.targets[i].lerp(goal,pose.tuck);
   }
  }
  for(const [i,leg] of legs.entries())this.clipFeet[i].copy(leg.foot.quaternion);
  for(const [i,leg] of legs.entries())this.footwork.solve(leg,this.targets[i],this.rotations[i]);
  if(pose.tuck>1e-5)for(const [i,leg] of legs.entries()){
   // In the air a boot hangs off its shin as the clip holds it there, toes pointed (the trailing one more), not
   // level with the floor it left: a level boot on a folded leg read as a hinge at the ankle.
   const shin=leg.knee.getWorldQuaternion(this.q[2]),hang=turn.copy(shin).multiply(this.clipFeet[i]);
   hang.premultiply(toe.setFromAxisAngle(lean,i===this.lead?.55:1.15));
   const now=leg.foot.getWorldQuaternion(this.q[3]).slerp(hang,pose.tuck);
   leg.foot.quaternion.copy(shin.invert().multiply(now));leg.foot.updateMatrixWorld(true);
  }
  this.footwork.dirty=true;
 }
}
