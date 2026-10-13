// 13 Oct 2026 boss abilities: the delayed slam (a held raise on the approved slam clip) and the pillars of fire
// (rings that follow the player, lock when the scythe is planted, and erupt there).
import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSETS} from '../src/game/asset-paths.js';
import {Fight} from '../src/game/encounter.js';
import {createActionTimings,actionDuration,clipPlayback,strikeIndex,pillarCenters,pillarContact} from '../src/game/weapon-motion.js';

const timings=createActionTimings(ASSETS.motion.boss,true);
const geo=(over={})=>({distance:5,playerFacing:true,bossFacing:true,bossSpeed:0,playerHit:false,bossHit:false,playerRadius:.45,bossX:0,bossZ:0,playerX:0,playerZ:5,...over});
const run=(fight,seconds,g)=>{for(let i=0;i<Math.round(seconds*120);i++)fight.step(1/120,g);};

test('the delayed slam holds the raise and moves the slam hit window by the hold',()=>{
 const d=timings.delayedSlam,slam=timings.slam;
 assert.equal(d.clip,'slam');assert.ok(Math.abs(actionDuration(d)-5.92)<1e-9);
 assert.deepEqual(d.engagementRange,slam.engagementRange,'it stands where the slam stands');
 const clipAt=elapsed=>clipPlayback({name:'delayedSlam',elapsed},timings).time;
 assert.ok(Math.abs(clipAt(1.9)-1.9)<1e-9);assert.ok(clipAt(2.9)>1.9&&clipAt(2.9)<1.98,'still raised a second later');
 const shift=d.hitWindows[0][0]-slam.hitWindows[0][0];
 assert.ok(Math.abs(clipAt(d.hitWindows[0][0])-slam.hitWindows[0][0])<1e-6,'the cut opens on the same clip frame as the slam');
 assert.ok(shift>1,'about a second later than the plain slam');
 assert.equal(strikeIndex('delayedSlam',slam.hitWindows[0][0]+.05,true,timings),-1,'a roll timed to the plain slam lands in the hold');
 const fight=new Fight(ASSETS.motion);fight.playerDamageTaken=1;fight.start();
 fight.boss.action={name:'delayedSlam',elapsed:0,hits:[]};
 run(fight,(slam.hitWindows[0][1]+.1)/d.speed,geo({distance:2.9,bossHit:true}));
 assert.equal(fight.player.health,100,'no hit while the scythe is held');
 run(fight,1,geo({distance:2.9,bossHit:true}));
 assert.equal(fight.player.health,100-d.damage);
});

test('pillar centres sit on the player, across the boss-to-player line, in world metres',()=>{
 const p=timings.pillars,scale=ASSETS.motion.boss.worldScale??1;
 assert.ok(p.targeted&&p.reach>0);
 assert.deepEqual(pillarCenters(p,1,geo()),[{x:0,z:5}],'phase one: one pillar under the player');
 const three=pillarCenters(p,2,geo());assert.equal(three.length,3);
 for(const c of three)assert.ok(Math.abs(c.z-5)<1e-9,'phase two: a row across the line');
 assert.ok(Math.abs(Math.abs(three[1].x)-1.6*scale)<1e-9);
 const side=pillarCenters(p,2,geo({playerX:5,playerZ:0}));assert.ok(side.every(c=>Math.abs(c.x-5)<1e-9),'the row turns with the line');
 assert.ok(pillarContact(p,{targets:[{x:0,z:5}]},geo({playerZ:5+p.reach+.4})));
 assert.ok(!pillarContact(p,{targets:[{x:0,z:5}]},geo({playerZ:5+p.reach+.5})));
 assert.ok(!pillarContact(p,{},geo()),'nothing hits before the lock');
 assert.throws(()=>createActionTimings({clips:{slam:{duration:1}},actions:{x:{clip:'slam',targeted:true,reach:1,pillars:{phase1:[[0,0]]}}}},true),RangeError,'a lockAt is required');
});

test('the pillars lock where the player stands at the plant; stepping out before the eruption is safe',()=>{
 const p=timings.pillars,fight=new Fight(ASSETS.motion);fight.playerDamageTaken=1;fight.start();
 fight.boss.action={name:'pillars',elapsed:0,hits:[]};
 run(fight,(p.lockAt+.02)/p.speed,geo());
 assert.deepEqual(fight.boss.action.targets,[{x:0,z:5}]);
 assert.ok(fight.drain().some(e=>e.type==='boss-mark'&&e.action==='pillars'));
 run(fight,2,geo({playerX:2.5,distance:5.6}));
 assert.equal(fight.player.health,100,'moved out of the ring');
 fight.boss.action={name:'pillars',elapsed:0,hits:[]};
 run(fight,(p.lockAt+.02)/p.speed,geo());
 run(fight,2,geo());
 assert.equal(fight.player.health,100-p.damage,'standing in the ring is hit once');
});

test('the pillars answer a player far beyond the fissure',()=>{
 const fight=new Fight(ASSETS.motion);fight.start();fight.cooldown=0;
 fight.step(1/120,geo({distance:11,playerZ:11}));
 assert.equal(fight.boss.action?.name,'pillars');
});
