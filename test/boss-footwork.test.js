import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {loadGLB} from '../scripts/load-glb-node.mjs';import {createActor} from '../src/game/actors.js';
import {ASSETS} from '../src/game/asset-paths.js';
const metadata=ASSETS.motion.boss,asset='assets/boss-man/boss-man-rig-v1.glb',standing={health:100,action:null};
async function boss(footwork=true){const actor=createActor(await loadGLB(asset),2.5,true,true,metadata);if(!footwork)actor.footwork=null;return actor;}
const feet=actor=>['Left','Right'].map(side=>actor.body.getObjectByName('mixamorig'+side+'Foot').getWorldPosition(new T.Vector3()));

/** 2 s of the idle turn at the gameplay rate, then a rest: how far the boots travel while on the floor. */
async function turnInPlace(footwork){
 const actor=await boss(footwork),motion={x:0,z:0,yaw:0},dt=1/60;actor.reset(motion);
 let previous=null,planted=0,steps=0;const stepping=[false,false];
 for(let frame=0;frame<240;frame++){
  if(frame>=18&&frame<138)motion.yaw+=metadata.idleTurnRate*dt;
  actor.update(dt,frame*dt,standing,motion);const now=feet(actor);
  for(let side=0;side<2;side++){
   const lifted=actor.footwork?.feet[side].lift>0;
   if(previous&&!lifted)planted+=Math.hypot(now[side].x-previous[side].x,now[side].z-previous[side].z);
   const step=!!actor.footwork?.feet[side].step;if(step&&!stepping[side])steps++;stepping[side]=step;
  }
  previous=now;
 }
 return {actor,planted,steps};
}

test('turning in place, the boss steps around instead of pivoting both boots on the floor',async()=>{
 const before=await turnInPlace(false),after=await turnInPlace(true);
 assert.ok(before.planted>2,`the old idle turn skated ${before.planted.toFixed(2)} m`);
 assert.ok(after.planted<before.planted*.1,`planted boots travelled ${after.planted.toFixed(3)} m`);
 assert.ok(after.steps>=6,`only ${after.steps} steps for a 250-degree turn`);
 // After the rest the leftover twist is settled: the boots are back under him.
 for(const foot of after.actor.footwork.feet){assert.ok(foot.offset.length()<.06);assert.ok(Math.abs(foot.yaw)<.15);assert.equal(foot.step,null);}
});

test('a teleport and a reset leave no planted offset behind, and the clip pose is restored before sampling',async()=>{
 const actor=await boss(),motion={x:0,z:0,yaw:0},dt=1/60;actor.reset(motion);
 for(let frame=0;frame<30;frame++){motion.yaw+=metadata.idleTurnRate*dt;actor.update(dt,frame*dt,standing,motion);}
 assert.ok(actor.footwork.feet.some(foot=>foot.offset.length()>.01||foot.step));
 motion.x=6;actor.update(dt,1,standing,motion);
 for(const foot of actor.footwork.feet){assert.equal(foot.offset.length(),0);assert.equal(foot.step,null);}
 actor.reset({x:0,z:0,yaw:0});for(const foot of actor.footwork.feet)assert.equal(foot.offset.length(),0);
 // A still clip leaves the bones unwritten by the mixer; restore() keeps last frame's solve from compounding.
 const thigh=actor.body.getObjectByName('mixamorigLeftUpLeg'),clip=thigh.quaternion.clone();
 thigh.quaternion.set(0,0,0,1);actor.footwork.dirty=true;actor.footwork.edited.find(saved=>saved.bone===thigh).quaternion.copy(clip);
 actor.footwork.restore();assert.ok(thigh.quaternion.angleTo(clip)<1e-9);
});

test('the walk sways the pelvis over the stance boot while the boots keep their clip paths',async()=>{
 const runs=await Promise.all([false,true].map(async footwork=>{
  const actor=await boss(footwork),motion={x:0,z:0,yaw:.4},dt=1/60,hips=[],paths=[];actor.reset(motion);
  for(let frame=0;frame<300;frame++){
   motion.x+=Math.sin(motion.yaw)*metadata.locomotionSpeed*dt;motion.z+=Math.cos(motion.yaw)*metadata.locomotionSpeed*dt;
   actor.update(dt,frame*dt,standing,motion);
   if(frame>60){const lateral=new T.Vector3(Math.cos(motion.yaw),0,-Math.sin(motion.yaw));hips.push(actor.body.getObjectByName('mixamorigHips').getWorldPosition(new T.Vector3()).dot(lateral));paths.push(feet(actor));}
  }
  return {hips,paths,rate:actor.animation.rate};
 }));
 const range=values=>Math.max(...values)-Math.min(...values);
 assert.ok(range(runs[0].hips)<.005,'the captured walk keeps the pelvis on a rail');
 assert.ok(range(runs[1].hips)>.05&&range(runs[1].hips)<.15,`pelvis sway ${range(runs[1].hips).toFixed(3)} m`);
 let error=0;for(let i=0;i<runs[0].paths.length;i++)for(let side=0;side<2;side++)error=Math.max(error,runs[0].paths[i][side].distanceTo(runs[1].paths[i][side]));
 assert.ok(error<.01,`boots left their clip paths by ${error.toFixed(4)} m`);
 // The cadence follows the measured stance speed: no 1.4x cap holding the stride behind the body.
 assert.ok(Math.abs(runs[1].rate*metadata.clips['walk-forward'].sourceSpeed-metadata.locomotionSpeed)<.01);
});
