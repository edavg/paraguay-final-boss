import {MathUtils,Quaternion,Vector3} from 'three';
import {FootPlant} from './foot-plant.js';

const UP=new Vector3(0,1,0),FORWARD=new Vector3(0,0,1),LEFT=new Vector3(1,0,0);
const ease=t=>t*t*(3-2*t);
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

/** Procedural footwork for the boss, on top of whatever clip is playing (src/game/actors.js).
 *
 * Turning and shuffling: his clips have no turn-in-place, so the body used to yaw over a
 * frozen idle and both boots pivoted on the floor. Here every boot stays where it stands
 * in the world while the body turns or drifts over it; when one falls too far behind, it
 * takes a step (lift arc, landing a little ahead of the turn), the other boot follows, and
 * after he stops a leftover twist is settled with one last step. The walk owns the feet:
 * with its weight in, the planted offsets fade out and the cycle's own steps take over.
 *
 * Walking: the captured walk keeps the pelvis on a rail. The hips sway over the stance
 * boot and roll down on the swing side, the spine takes most of the roll back, and both
 * boots are pinned to their clip positions with the same two-bone solve, so nothing slides.
 */
export class BossFootwork extends FootPlant {
  constructor(root,soles,{scale=1,gait='walk-forward'}={}){
    super(root,soles);
    this.gait=gait;this.scale=scale;
    this.hips=root.getObjectByName('mixamorigHips');
    this.spine=root.getObjectByName('mixamorigSpine');
    this.stepDistance=.15*scale;
    this.stepAngle=MathUtils.degToRad(20);
    this.stepDuration=.3;
    this.stepHeight=.12*scale;
    this.swayAmplitude=.035*scale;
    this.rollAmplitude=MathUtils.degToRad(3.5);
    this.teleport=1.5*scale;
    // three's PropertyMixer skips writing a bone whose mixed value did not change since its last write, so on a
    // still stretch of a clip our edits would survive into the next frame and compound. restore() puts them back.
    this.edited=[...this.legs.flatMap(leg=>[leg.upper,leg.knee,leg.foot]),this.hips,this.spine].filter(Boolean)
      .map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()}));
    this.w=Array.from({length:8},()=>new Vector3());
    this.r=Array.from({length:3},()=>new Quaternion());
    this.reset();
  }

  reset(){
    this.feet=this.legs.map(()=>({offset:new Vector3(),yaw:0,step:null,shown:new Vector3(),shownYaw:0,lift:0,clip:new Vector3(),rotation:new Quaternion()}));
    this.previous=null;this.yawRate=0;this.still=0;this.sway=0;this.stepping=false;
  }

  /** Before the clip is sampled: the bones as the clip left them last frame. */
  restore(){
    if(!this.dirty)return;
    for(const saved of this.edited){saved.bone.position.copy(saved.position);saved.bone.quaternion.copy(saved.quaternion);}
    this.dirty=false;
  }

  /** `motion` is the actor's gameplay transform {x,z,yaw}; `suspended` fades the plant out (death, raw review poses). */
  apply(animation,motion,dt,{suspended=false}={}){
    if(this.legs.length!==2||!(dt>0))return;
    const previous=this.previous??motion;
    let turn=wrap(motion.yaw-previous.yaw),dx=motion.x-previous.x,dz=motion.z-previous.z;
    this.previous={x:motion.x,z:motion.z,yaw:motion.yaw};
    if(Math.hypot(dx,dz)>this.teleport){this.reset();this.previous={...motion};turn=dx=dz=0;}
    this.yawRate=MathUtils.damp(this.yawRate,turn/dt,10,dt);
    const walk=animation.layers.get(this.gait)?.weight??0,plant=suspended?0:1-walk;
    this.still=Math.abs(turn/dt)<.05&&Math.hypot(dx,dz)/dt<.05?this.still+dt:0;
    const [radius,drift,lead,target]=this.w;
    for(const saved of this.edited){saved.position.copy(saved.bone.position);saved.quaternion.copy(saved.bone.quaternion);}
    this.dirty=true;

    // Clip pose first: the targets are the boots as authored, before the sway moves the hips.
    for(const [index,leg] of this.legs.entries()){
      const foot=this.feet[index];
      leg.foot.getWorldPosition(foot.clip);leg.foot.getWorldQuaternion(foot.rotation);
      // Where this boot stood before this frame's root motion: the body turned and slid under it.
      radius.set(foot.clip.x-motion.x,0,foot.clip.z-motion.z);
      drift.copy(radius).applyAxisAngle(UP,-turn).sub(radius);drift.x-=dx;drift.z-=dz;
      foot.offset.addScaledVector(drift,plant);foot.yaw-=turn*plant;
      if(foot.step)foot.step.from.addScaledVector(drift,plant),foot.step.fromYaw-=turn*plant;
      // The walk (or a fade-out) takes the boot back to its clip position.
      if(plant<1){const keep=Math.exp(-(1-plant)*12*dt);foot.offset.multiplyScalar(keep);foot.yaw*=keep;if(plant<.5)foot.step=null;}
      foot.offset.clampLength(0,this.stepDistance*3);foot.yaw=MathUtils.clamp(foot.yaw,-1.4,1.4);
    }

    this.startStep(plant);

    for(const [index,foot] of this.feet.entries()){
      foot.lift=0;
      if(!foot.step){foot.shown.copy(foot.offset);foot.shownYaw=foot.yaw;continue;}
      const step=foot.step;step.elapsed+=dt;
      const progress=Math.min(1,step.elapsed/step.duration),blend=ease(progress);
      // Land ahead of the turn by half a step's worth of it, so a steady turn stays centred.
      const ahead=MathUtils.clamp(this.yawRate*step.duration*.5,-this.stepAngle*.8,this.stepAngle*.8);
      radius.set(foot.clip.x-motion.x,0,foot.clip.z-motion.z);
      lead.copy(radius).applyAxisAngle(UP,ahead).sub(radius).clampLength(0,this.stepDistance*.8);
      foot.shown.lerpVectors(step.from,lead,blend);foot.shownYaw=MathUtils.lerp(step.fromYaw,ahead,blend);
      foot.lift=step.height*Math.sin(Math.PI*progress);
      if(progress>=1){foot.offset.copy(lead);foot.yaw=ahead;foot.step=null;}
    }

    const swaying=walk>1e-3&&this.hips&&!suspended;
    if(swaying)this.swayHips(walk,motion.yaw,dt);else this.sway=0;
    this.stepping=false;
    for(const [index,foot] of this.feet.entries()){
      if(!swaying&&foot.lift<1e-5&&foot.shown.lengthSq()<1e-8&&Math.abs(foot.shownYaw)<1e-4)continue;
      target.copy(foot.clip).add(foot.shown);target.y+=foot.lift;
      const rotation=this.r[0].setFromAxisAngle(UP,foot.shownYaw).multiply(foot.rotation);
      this.solve(this.legs[index],target,rotation);this.stepping||=foot.lift>0;
    }
  }

  /** One boot at a time, the next once the first is past mid-swing: it needs to have drifted
   * a step's distance or angle, or, once he has stood still for half a second, a third of it. */
  startStep(plant){
    if(plant<.5)return;
    let best=-1,need=0;
    for(const [index,foot] of this.feet.entries()){
      if(foot.step)continue;
      const other=this.feet[1-index].step;
      if(other&&other.elapsed<other.duration*.55)continue;
      const value=Math.max(foot.offset.length()/this.stepDistance,Math.abs(foot.yaw)/this.stepAngle);
      if(value>need){need=value;best=index;}
    }
    if(best<0||need<(this.still>.5?.35:1))return;
    const foot=this.feet[best];
    foot.step={elapsed:0,duration:this.stepDuration,from:foot.offset.clone(),fromYaw:foot.yaw,height:this.stepHeight*Math.min(1,.45+need*.55)};
  }

  /** Pelvis over the stance boot (the lower one in the clip) and dropped on the swing side. */
  swayHips(walk,yaw,dt){
    const [left,forward,position]=[this.w[4],this.w[5],this.w[6]];
    const heights=this.legs.map((leg,index)=>this.feet[index].clip.y),side=this.legs[0].side==='Left'?1:-1;
    const stance=MathUtils.clamp((heights[1]-heights[0])/(.05*this.scale),-1,1)*side;
    this.sway=MathUtils.damp(this.sway,stance,7,dt);
    // These rigs face +Z with anatomical left at +X.
    left.copy(LEFT).applyAxisAngle(UP,yaw);forward.copy(FORWARD).applyAxisAngle(UP,yaw);
    this.hips.getWorldPosition(position).addScaledVector(left,this.sway*this.swayAmplitude*walk);
    this.hips.position.copy(this.hips.parent.worldToLocal(position));this.hips.updateMatrixWorld(true);
    const roll=this.sway*this.rollAmplitude*walk;
    this.rotateInWorld(this.hips,this.r[1].setFromAxisAngle(forward,roll));
    if(this.spine)this.rotateInWorld(this.spine,this.r[1].setFromAxisAngle(forward,-roll*.8));
  }

  /** Two-bone solve on the captured knee plane, boot held at `rotation`. */
  solve({upper,knee,foot},target,rotation){
    const [a,b,c,axis,plane,bend,from,to]=[...this.v.slice(0,8)];
    upper.getWorldPosition(a);knee.getWorldPosition(b);foot.getWorldPosition(c);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),distance=MathUtils.clamp(a.distanceTo(target),Math.abs(l1-l2)+1e-4,l1+l2-1e-4);
    axis.copy(target).sub(a).normalize();
    const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
    plane.copy(b).sub(a);plane.addScaledVector(axis,-plane.dot(axis));
    if(plane.lengthSq()<1e-8)return;
    bend.copy(a).addScaledVector(axis,along).addScaledVector(plane.normalize(),Math.sqrt(Math.max(0,l1*l1-along*along)));
    this.rotateInWorld(upper,this.q[1].setFromUnitVectors(from.copy(b).sub(a).normalize(),to.copy(bend).sub(a).normalize()));
    knee.getWorldPosition(b);foot.getWorldPosition(c);
    this.rotateInWorld(knee,this.q[1].setFromUnitVectors(from.copy(c).sub(b).normalize(),to.copy(target).sub(b).normalize()));
    foot.quaternion.copy(foot.parent.getWorldQuaternion(this.q[2]).invert().multiply(rotation));
    foot.updateMatrixWorld(true);
  }
}
