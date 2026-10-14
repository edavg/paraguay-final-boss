// The shield bash that replaced the held guard (13 Oct 2026): a timed bash parries a blade swing and staggers the boss.
import test from 'node:test';import assert from 'node:assert/strict';
import {Fight} from '../src/game/encounter.js';
import {PLAYER_PARRY,BOSS_STAGGER} from '../src/game/weapon-motion.js';
import {shieldBashWeights,staggerWeights} from '../src/game/shield-bash.js';
const near={distance:2,bossHit:true,playerFacing:true};
const run=(f,seconds,g)=>{for(let i=0;i<Math.round(seconds*120);i++)f.step(1/120,g);};
function swingAt(f){f.boss.action={name:'sweep',elapsed:1.099,hits:[]};}
function bashed(elapsed){const f=new Fight();f.playerDamageTaken=1;f.start();assert.ok(f.request('parry'));f.player.action.elapsed=elapsed;return f;}

test('a bash inside its window parries the swing: no damage, the boss staggers, then chooses again',()=>{
 const f=bashed(.15);swingAt(f);f.step(1/120,near);
 assert.equal(f.player.health,100);assert.equal(f.stats.parries,1);assert.equal(f.boss.action.name,'stagger');
 assert.ok(f.drain().some(e=>e.type==='parry'));
 run(f,BOSS_STAGGER.duration+.05,{distance:10,bossHit:false,playerFacing:true});
 assert.equal(f.boss.action,null);assert.ok(f.drain().some(e=>e.type==='stagger-end'));
});

test('the stagger lasts the same in phase two',()=>{
 const f=bashed(.15);f.boss.phase=2;f.boss.health=800;swingAt(f);f.step(1/120,near);
 run(f,BOSS_STAGGER.duration-.1,{distance:10,bossHit:false,playerFacing:true});assert.equal(f.boss.action?.name,'stagger');
});

test('a mistimed bash, a bash facing away and no bash all take the full hit',()=>{
 for(const [elapsed,facing] of [[.01,true],[.5,true],[.15,false]]){
  const f=bashed(elapsed);swingAt(f);f.step(1/120,{...near,playerFacing:facing});
  assert.ok(f.player.health<100,`elapsed ${elapsed} facing ${facing}`);assert.equal(f.stats.parries,0);assert.notEqual(f.boss.action?.name,'stagger');
 }
 const f=new Fight();f.playerDamageTaken=1;f.start();f.player.blocking=true;swingAt(f);f.step(1/120,near);
 assert.ok(f.player.health<100,'holding the old guard no longer blocks anything');
});

test('the bash costs stamina, is refused without it, and ends on its own',()=>{
 const f=new Fight();f.start();assert.ok(f.request('parry'));assert.equal(f.player.stamina,100-PLAYER_PARRY.cost);
 run(f,PLAYER_PARRY.duration+.02,{distance:10,bossHit:false,playerFacing:true});assert.equal(f.player.action,null);
 f.player.stamina=PLAYER_PARRY.cost-1;assert.equal(f.request('parry'),false);
});

test('the bash pose cocks, shoves inside the parry window and settles; the stagger reels and recovers',()=>{
 const at=t=>shieldBashWeights(t);
 assert.ok(at(.06).cock>.5);assert.ok(at(.22).thrust>.95);assert.ok(at(.3).thrust>.9);
 assert.ok(at(PLAYER_PARRY.duration).thrust<.02&&at(PLAYER_PARRY.duration).cock<.02);
 assert.ok(at(PLAYER_PARRY.window[0]+.08).thrust>.3,'the shield is moving out once the window is open');
 const d=BOSS_STAGGER.duration;assert.ok(staggerWeights(.15,d).reel>.8);assert.ok(staggerWeights(.8,d).sag>.9);
 const end=staggerWeights(d,d);assert.ok(end.reel<.01&&end.sag<.05);
});

test('the stagger layer never compounds on a held clip frame (the boss spun like a rotor)',async()=>{
 const T=await import('three');const {BossStagger}=await import('../src/game/shield-bash.js');
 const root=new T.Group(),body=new T.Group();root.add(body);
 let parent=body;const bones={};for(const name of ['Hips','Spine','Spine2','Neck','Head']){const b=new T.Bone();b.name='mixamorig'+name;b.position.y=name==='Hips'?1:.3;parent.add(b);parent=b;bones[name]=b;}
 root.updateMatrixWorld(true);const layer=new BossStagger(body,root),action={name:'stagger',elapsed:.9};
 // The mixer leaves the bones alone (unchanged clip value): the layer must restore and reapply, not stack.
 layer.apply(action,BOSS_STAGGER.duration);const first=bones.Spine.quaternion.clone(),head=bones.Head.getWorldPosition(new T.Vector3());
 for(let i=0;i<30;i++)layer.apply(action,BOSS_STAGGER.duration);
 assert.ok(bones.Spine.quaternion.angleTo(first)<1e-6);assert.ok(bones.Head.getWorldPosition(new T.Vector3()).distanceTo(head)<1e-6);
 layer.apply(null);assert.ok(bones.Spine.quaternion.angleTo(new T.Quaternion())<1e-6,'the clip pose comes back when the stagger ends');
});

test('parry takes are trimmed to their first hit and faded out',async()=>{
 const {trimBuffer}=await import('../src/game/audio.js');
 const make=(channels,length,rate)=>{const data=[...Array(channels)].map(()=>new Float32Array(length).fill(1));return {numberOfChannels:channels,length,sampleRate:rate,getChannelData:c=>data[c]};};
 const context={createBuffer:make},source=make(2,1000,100);
 const out=trimBuffer(context,source,[1,5],.5);
 assert.equal(out.length,400);assert.equal(out.getChannelData(1)[0],1);assert.ok(out.getChannelData(0)[399]<.03);
 assert.equal(trimBuffer(context,source,undefined),source);assert.equal(trimBuffer(context,source,[5,1]),source);
});
