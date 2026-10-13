import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadGLB} from '../scripts/load-glb-node.mjs';
import {ASSETS} from '../src/game/asset-paths.js';
import {SkirtSway} from '../src/game/skirt-sway.js';
import {createPlayerTrim} from '../src/game/player-trim.js';

// The Paraguayan player's code cloth: skirt panels (src/game/skirt-sway.js) and the shawl fringe /
// sash tassels (src/game/player-trim.js). Whatever the clip does, the panels must clear the legs,
// stay within their swing cone and keep their length; every strand stays finite, starts on its
// anchor, keeps its segment lengths and hangs below it when the body is still.

const localPath = href => decodeURIComponent(new URL(href).pathname);
const trimConfig = ASSETS.motion.player.trim;

async function dressed() {
  const gltf = await loadGLB(localPath(ASSETS.playerRig));
  const root = new T.Group(); root.add(gltf.scene); root.updateMatrixWorld(true);
  const skirt = SkirtSway.from(gltf.scene);
  const trim = createPlayerTrim(gltf.scene, trimConfig, skirt);
  root.add(trim.object);
  const mixer = new T.AnimationMixer(gltf.scene);
  const play = name => { mixer.stopAllAction(); mixer.clipAction(gltf.animations.find(c => c.name === name)).reset().play(); };
  const step = () => { mixer.update(1 / 60); root.updateMatrixWorld(true); skirt.update(1 / 60); trim.update(1 / 60, root); };
  return {gltf, root, skirt, trim, play, step};
}

test('the current player has skirt panels and trim anchors', {skip: !trimConfig && 'the current player has no trim'}, async () => {
  const {skirt, trim} = await dressed();
  assert.equal(skirt.panels.length, ASSETS.motion.player.skirt.bones.length);
  assert.ok(trimConfig.fringe.length >= 12 && trimConfig.tassels.length === 3);
  assert.ok(trim.object.children.length >= 4, 'fringe ribbons plus three cords and heads');
});

test('skirt panels clear the legs and trim strands hold through idle, run, heavy and the roll', {skip: !trimConfig && 'the current player has no trim'}, async () => {
  const {skirt, trim, play, step} = await dressed();
  for (const clip of ['idle', 'run-forward', 'heavy', 'dodge']) {
    play(clip);
    let worstLeg = 0, worstSwing = 0, worstLength = 0;
    for (let frame = 0; frame < 90; frame++) {
      step();
      for (const panel of skirt.panels) {
        assert.ok(Number.isFinite(panel.p.x + panel.p.y + panel.p.z), `${clip}: panel went non-finite`);
        worstLength = Math.max(worstLength, Math.abs(panel.p.distanceTo(panel.pivot) - panel.length));
        worstSwing = Math.max(worstSwing, panel.p.clone().sub(panel.pivot).angleTo(panel.target.clone().sub(panel.pivot)));
      }
      for (const [hip, knee, ankle] of skirt.legs) {
        const pts = [hip, knee, ankle].map(b => b.getWorldPosition(new T.Vector3()));
        for (const panel of skirt.panels) for (const [a, b, r] of [[pts[0], pts[1], skirt.thighRadius], [pts[1], pts[2], skirt.shinRadius]]) {
          // sample the lower two thirds of the panel against the leg segment
          for (let s = .35; s <= 1; s += .05) {
            const q = panel.pivot.clone().lerp(panel.p, s), line = new T.Line3(a, b), c = line.closestPointToPoint(q, true, new T.Vector3());
            worstLeg = Math.max(worstLeg, r - q.distanceTo(c));
          }
        }
      }
    }
    assert.ok(worstLength < 1e-4, `${clip}: panel length drifts ${worstLength}`);
    assert.ok(worstSwing <= skirt.maxSwing + 1e-3, `${clip}: panel swings ${worstSwing} rad`);
    assert.ok(worstLeg < .03, `${clip}: a skirt panel sinks ${worstLeg.toFixed(3)} m into a leg`);
  }
  for (const child of trim.object.children) {
    const position = child.geometry.attributes.position.array;
    for (const value of position) assert.ok(Number.isFinite(value), 'trim vertex went non-finite');
  }
});

test('at rest the fringe and tassels hang below their anchors', {skip: !trimConfig && 'the current player has no trim'}, async () => {
  const {trim, play, step, gltf} = await dressed();
  play('idle');
  for (let frame = 0; frame < 120; frame++) step();
  const mesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
  const anchor = mesh.getVertexPosition(trimConfig.tassels[0], new T.Vector3()).applyMatrix4(mesh.matrixWorld);
  const heads = trim.object.children.filter(c => c.geometry?.type === 'CylinderGeometry');
  assert.equal(heads.length, 3);
  for (const head of heads) {
    const at = new T.Vector3().setFromMatrixPosition(head.matrix);
    assert.ok(at.y < anchor.y - .08, `tassel head at ${at.y.toFixed(3)} hangs below the sash at ${anchor.y.toFixed(3)}`);
  }
});
