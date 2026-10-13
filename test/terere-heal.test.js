import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadGLB} from '../scripts/load-glb-node.mjs';
import {ASSETS} from '../src/game/asset-paths.js';
import {createGuampa} from '../src/game/guampa.js';

// The Paraguayan player's heal (scripts/author-terere-heal.py + src/game/guampa.js): the guampa is
// in her hand only while she drinks, the bombilla meets her lips mid-sip, and the heal keeps the
// fight's 1.4 s timing.

const heal = ASSETS.motion.player.clips.heal;
const skip = !heal?.guampa && 'the current player does not drink tereré';

test('the tereré heal keeps the fight timing and shows the guampa only while drinking', {skip}, async () => {
  assert.ok(Math.abs(heal.duration - 1.4) < 1e-6);
  const gltf = await loadGLB(decodeURIComponent(new URL(ASSETS.playerRig).pathname));
  const root = new T.Group(); root.add(gltf.scene); root.updateMatrixWorld(true);
  // Lips measured on the face at rest (1.60 m high, 15 cm forward), carried by the head bone.
  const head = gltf.scene.getObjectByName('mixamorigHead');
  const lipsLocal = new T.Vector3(0, 1.6, .15).applyMatrix4(head.matrixWorld.clone().invert());
  const guampa = createGuampa(gltf.scene, heal.guampa);
  const mixer = new T.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find(c => c.name === 'heal')).play();
  const at = t => { mixer.setTime(t); root.updateMatrixWorld(true); guampa.update({name: 'heal', elapsed: t}); root.updateMatrixWorld(true); };
  at(0); assert.equal(guampa.object.visible, false, 'hidden before the hand comes up');
  at(1.38); assert.equal(guampa.object.visible, false, 'put away as the arm lowers');
  guampa.update({name: 'idle', elapsed: .75}); assert.equal(guampa.object.visible, false);
  at(.75); assert.equal(guampa.object.visible, true);
  const tip = new T.Vector3(0, .123, -.0498).applyMatrix4(guampa.object.children[0].matrixWorld);
  const lips = lipsLocal.applyMatrix4(head.matrixWorld);
  assert.ok(tip.distanceTo(lips) < .03, `bombilla tip ${tip.distanceTo(lips).toFixed(3)} m from her lips`);
});
