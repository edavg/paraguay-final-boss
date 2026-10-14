import * as T from 'three';
// The shield bash and the parried boss's stagger (13 Oct 2026, user: "add the shield bash animation and, instead of
// blocking damage with the shield, parry the boss's attacks to stun him briefly"). Neither rig has a clip for them, so
// both are pose layers in world space on top of the clip the mixer just evaluated: the bash plays over the guard
// (`block`), the stagger over the boss's own `hit` recoil. The mixer does not rewrite a bone whose clip value is
// unchanged, so each layer puts back the clip pose under what it wrote itself (PoseMemory) before it writes again.
const UP=new T.Vector3(0,1,0);
const clamp01=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp01(x);return x*x*(3-2*x);};
const _q=new T.Quaternion(),_parent=new T.Quaternion(),_world=new T.Quaternion(),_a=new T.Vector3(),_b=new T.Vector3();

/** Turn `bone` by the world-space rotation `rotation`, keeping its parent where it is. */
export function rotateBoneWorld(bone,rotation){
 if(!bone)return;
 bone.getWorldQuaternion(_world);
 if(bone.parent)bone.parent.getWorldQuaternion(_parent);else _parent.identity();
 bone.quaternion.copy(_parent.invert().multiply(rotation).multiply(_world));
 bone.updateMatrixWorld(true);
}

/** three's PropertyMixer only writes a bone when its mixed value changed since its last write. On a held clip frame
 * (the stagger holds the recoil at its peak) a layer's rotation therefore survived into the next frame and was
 * applied again on top: it compounded every frame and the boss spun like a rotor. The memory keeps the clip pose under
 * each bone the layer wrote and restores it whenever the mixer left that bone alone. */
export class PoseMemory{
 constructor(bones){this.entries=bones.filter(Boolean).map(bone=>({bone,clip:new T.Quaternion(),written:new T.Quaternion(),held:false}));}
 /** Undo last frame's layer where the mixer did not overwrite it; true when any bone was put back. */
 restore(){let changed=false;for(const e of this.entries){if(e.held&&e.bone.quaternion.equals(e.written)){e.bone.quaternion.copy(e.clip);e.bone.updateMatrixWorld(true);changed=true;}e.held=false;}return changed;}
 capture(){for(const e of this.entries)e.clip.copy(e.bone.quaternion);}
 commit(){for(const e of this.entries){e.written.copy(e.bone.quaternion);e.held=true;}}
}

/** Gameplay forward and the lean axis (up × forward: a positive angle about it tips the chest toward forward). */
function frame(root){
 const forward=new T.Vector3(0,0,1).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
 return {forward,lean:new T.Vector3().crossVectors(UP,forward).normalize()};
}

/** The bash in action seconds: a short cock back (the shield drawn in, the left shoulder turned away), a fast shove
 * of the left shoulder and arm through the boss's line, a held brace and the settle back to the guard. */
export const SHIELD_BASH={duration:.8,cock:[0,.1],thrust:[.08,.2],hold:.36};
export function shieldBashWeights(elapsed,duration=SHIELD_BASH.duration){
 const t=Math.max(0,elapsed||0);
 const cock=smooth(t/SHIELD_BASH.cock[1])*(1-smooth((t-SHIELD_BASH.thrust[0])/(SHIELD_BASH.thrust[1]-SHIELD_BASH.thrust[0])));
 const thrust=smooth((t-SHIELD_BASH.thrust[0])/(SHIELD_BASH.thrust[1]-SHIELD_BASH.thrust[0]))*(1-smooth((t-SHIELD_BASH.hold)/Math.max(.05,duration-SHIELD_BASH.hold-.04)));
 return {cock,thrust};
}

export class ShieldBash{
 constructor(body,root){
  const bone=name=>body.getObjectByName('mixamorig'+name);
  this.root=root;this.spine=bone('Spine');this.chest=bone('Spine2');this.arm=bone('LeftArm');this.forearm=bone('LeftForeArm');this.hand=bone('LeftHand');
  this.ready=!!(this.spine&&this.arm&&this.forearm&&this.hand);
  this.memory=new PoseMemory([this.spine,this.chest,this.arm,this.forearm,this.hand]);
 }
 apply(action,duration){
  if(!this.ready)return;
  this.memory.restore();
  if(action?.name!=='parry')return;
  const {cock,thrust}=shieldBashWeights(action.elapsed,duration);
  if(cock<=1e-4&&thrust<=1e-4)return;
  this.memory.capture();
  const {forward,lean}=frame(this.root),grip=this.hand.getWorldQuaternion(new T.Quaternion());
  // The guard already leads with the left shoulder, so the torso only turns a little further into the shove (a
  // negative turn about +Y brings the left side forward) and tips over the front foot; the arm does the driving.
  const twist=-.16*thrust+.2*cock,tip=.16*thrust-.05*cock;
  rotateBoneWorld(this.spine,_q.setFromAxisAngle(UP,twist*.55).premultiply(new T.Quaternion().setFromAxisAngle(lean,tip*.5)));
  rotateBoneWorld(this.chest,_q.setFromAxisAngle(UP,twist*.45).premultiply(new T.Quaternion().setFromAxisAngle(lean,tip*.5)));
  // Two-bone reach: the fist (and the shield on it) drives out along the facing, a little high, on a straightening elbow.
  const shoulder=this.arm.getWorldPosition(new T.Vector3()),hand=this.hand.getWorldPosition(new T.Vector3());
  const target=hand.clone().addScaledVector(forward,.32*thrust-.14*cock).addScaledVector(UP,.05*thrust);
  reachTwoBone(this.arm,this.forearm,this.hand,shoulder,target);
  // The shield keeps the guard's attitude, face to the opponent and upright, and is carried straight out on the fist.
  this.hand.quaternion.copy(this.forearm.getWorldQuaternion(new T.Quaternion()).invert().multiply(grip));this.hand.updateMatrixWorld(true);
  this.memory.commit();
 }
}

/** Bend the elbow so the hand lies at `target`'s distance from the shoulder (short of a locked arm), then swing the
 * upper arm onto it. Keeps the existing bend plane, so the elbow never flips. */
export function reachTwoBone(arm,forearm,hand,shoulder,target){
 const elbow=forearm.getWorldPosition(new T.Vector3()),wrist=hand.getWorldPosition(new T.Vector3());
 const upper=elbow.clone().sub(shoulder),lower=wrist.clone().sub(elbow),l1=upper.length(),l2=lower.length();
 const axis=new T.Vector3().crossVectors(shoulder.clone().sub(elbow),lower);
 if(axis.lengthSq()>1e-10){
  const reach=Math.min(target.distanceTo(shoulder),(l1+l2)*.985),current=shoulder.clone().sub(elbow).angleTo(lower);
  const desired=Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-reach*reach)/(2*l1*l2))));
  rotateBoneWorld(forearm,_q.setFromAxisAngle(axis.normalize(),desired-current));
 }
 const from=hand.getWorldPosition(new T.Vector3()).sub(shoulder).normalize(),to=target.clone().sub(shoulder).normalize();
 rotateBoneWorld(arm,_q.setFromUnitVectors(from,to));
}

/** The parried boss reels: thrown back off the deflected swing, a dazed sag with the head dropping and swaying, then
 * he gathers himself. Weights over the stagger's own length so a longer or shorter stun keeps the shape. */
export function staggerWeights(elapsed,duration){
 const t=Math.max(0,elapsed||0),d=Math.max(.6,duration||1.6);
 const reel=smooth(t/.16)*(1-smooth((t-.22)/.35));
 const sag=smooth((t-.2)/.35)*(1-smooth((t-(d-.45))/.4));
 return {reel,sag,sway:Math.sin(t*5.2)*sag};
}

export class BossStagger{
 constructor(body,root){
  const bone=name=>body.getObjectByName('mixamorig'+name);
  this.root=root;this.spine=bone('Spine');this.chest=bone('Spine2');this.neck=bone('Neck');this.head=bone('Head');
  this.ready=!!this.spine;
  this.memory=new PoseMemory([this.spine,this.chest,this.neck,this.head]);
 }
 apply(action,duration){
  if(!this.ready)return;
  this.memory.restore();
  if(action?.name!=='stagger')return;
  this.memory.capture();
  const {reel,sag,sway}=staggerWeights(action.elapsed,duration);
  const {lean}=frame(this.root);
  // Back on the reel, forward into the sag; the two-handed grip rides on the chest, so the scythe follows intact.
  const tip=-.42*reel+.3*sag;
  rotateBoneWorld(this.spine,_q.setFromAxisAngle(lean,tip*.5).premultiply(new T.Quaternion().setFromAxisAngle(UP,.12*sway)));
  rotateBoneWorld(this.chest,_q.setFromAxisAngle(lean,tip*.5));
  rotateBoneWorld(this.neck,_q.setFromAxisAngle(lean,-.18*reel+.22*sag));
  rotateBoneWorld(this.head,_q.setFromAxisAngle(lean,.16*sag).premultiply(new T.Quaternion().setFromAxisAngle(UP,.18*sway)));
  this.memory.commit();
 }
}
