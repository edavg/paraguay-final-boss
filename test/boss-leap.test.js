// 13 Oct 2026: the burst became a leaping slam (src/game/boss-leap.js) - a crouch, a flight that hangs and drops,
// a hard landing on the eruption, and travel toward the player locked at take-off.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ASSETS} from '../src/game/asset-paths.js';
import {Fight} from '../src/game/encounter.js';
import {MotionState} from '../src/game/motion.js';
import {createActionTimings} from '../src/game/weapon-motion.js';
import {leapPose,leapLanding,leapHeight} from '../src/game/boss-leap.js';

const timings=createActionTimings(ASSETS.motion.boss,true),leap=timings.burst.leap;

test('the leap crouches, leaves the floor at take-off, hangs, and lands as the eruption opens',()=>{
 assert.equal(leap.land,timings.burst.hitWindows[0][0],'the ring erupts the instant he lands');
 assert.ok(leapPose(leap,leap.takeoff-.1).crouch>leap.crouch*.6,'he sinks before the spring');
 assert.equal(leapPose(leap,leap.takeoff-.1).lift,0,'with both boots on the floor');
 const apex=leap.takeoff+(leap.land-leap.takeoff)*(leap.apex??.54);
 assert.ok(Math.abs(leapPose(leap,apex).lift-leap.height)<1e-9,'the top of the arc is the leap height');
 assert.ok(leapPose(leap,apex).tuck>.95,'knees drawn up at the top');
 assert.equal(leapPose(leap,leap.land).lift,0);assert.equal(leapPose(leap,leap.land).tuck,0,'legs reach for the floor before the landing');
 assert.ok(leapPose(leap,leap.land+.1).crouch>leap.impact*.9,'the knees take the landing');
 assert.ok(leapPose(leap,leap.land+1).crouch<1e-6,'and he is standing again for the recovery');
 // The fall is the shorter half: a hang, then a fast drop.
 const rise=leapHeight(leap,.02),fall=leapHeight(leap,.98);
 assert.ok(fall>rise,`hits the floor faster than it left it (last 2 %: ${fall.toFixed(3)} m, first 2 %: ${rise.toFixed(3)} m)`);
});

test('the landing locks short of the player, capped, and is straight up when already close',()=>{
 const far=leapLanding(leap,{x:0,z:0,yaw:0},{x:0,z:4});
 assert.ok(Math.abs(far.z-(4-leap.gap))<1e-9&&far.x===0,'lands gap metres short');
 const farther=leapLanding(leap,{x:0,z:0,yaw:0},{x:0,z:20});
 assert.ok(Math.abs(farther.distance-leap.maxDistance)<1e-9,'never farther than maxDistance');
 assert.equal(leapLanding(leap,{x:0,z:0,yaw:0},{x:0,z:1}).distance,0,'inside the gap he jumps in place');
});

test('motion carries the boss to the locked landing spot through the flight, and the ring hits from there',()=>{
 const fight=new Fight(ASSETS.motion),motion=new MotionState({animationMetadata:ASSETS.motion,bounds:{minX:-9.5,maxX:9.5,minZ:-15.5,maxZ:16}});
 fight.start();motion.boss={x:0,z:0,yaw:0};motion.player={x:0,z:4,yaw:Math.PI};
 fight.boss.action={name:'burst',elapsed:0,hits:[]};fight.cooldown=99;
 const input={forward:0,right:0,cameraYaw:0,lockOn:false};
 let landedAt=null;
 for(let i=0;i<120*5;i++){
  motion.step(1/120,input,fight);fight.step(1/120,motion.geometry());
  const a=fight.boss.action;if(!a)break;
  if(a.elapsed<leap.takeoff)assert.ok(Math.hypot(motion.boss.x,motion.boss.z)<1e-6,'planted until the spring');
  if(a.elapsed>=leap.land&&!landedAt)landedAt={...motion.boss};
  if(a.leap?.from&&a.elapsed<leap.land)motion.player.x=2;// the player sidesteps mid-air: too late
 }
 assert.ok(landedAt&&Math.abs(landedAt.z-(4-leap.gap))<.02&&Math.abs(landedAt.x)<1e-6,`landed on the spot locked at take-off: ${JSON.stringify(landedAt)}`);
 assert.equal(fight.stats.hits,1,'the eruption catches the player inside its reach');
});

test('on the real rig the boots leave the floor at the top of the leap and are back on it after the landing',async()=>{
 const {loadGLB}=await import('../scripts/load-glb-node.mjs');
 const {createActor}=await import('../src/game/actors.js');
 const actor=createActor(await loadGLB(fileURLToPath(ASSETS.bossRig)),2.5,true,true,ASSETS.motion.boss);
 const origin={x:0,z:0,yaw:0},action={name:'burst',elapsed:0,hits:[]};
 actor.reset(origin);actor.update(.3,0,{health:100,action:null},origin);
 const soles=()=>actor.soleClearance.minimumHeight();
 let apexSoles=null,landedSoles=null,crouchSoles=null;
 const apex=leap.takeoff+(leap.land-leap.takeoff)*(leap.apex??.54);
 for(let t=0;t<=leap.land+.3;t+=1/120){
  action.elapsed=t;actor.update(1/120,t,{health:100,action},origin);
  if(apexSoles===null&&t>=apex)apexSoles=soles();
  if(crouchSoles===null&&t>=leap.takeoff-.1)crouchSoles=soles();
  if(landedSoles===null&&t>=leap.land+.1)landedSoles=soles();
 }
 assert.ok(apexSoles>leap.height*.8,`soles ${apexSoles.toFixed(2)} m up at the apex`);
 assert.ok(Math.abs(crouchSoles)<.08,`crouched with the boots planted (${crouchSoles.toFixed(3)} m)`);
 assert.ok(Math.abs(landedSoles)<.08,`landed with the boots on the stone (${landedSoles.toFixed(3)} m)`);
});
