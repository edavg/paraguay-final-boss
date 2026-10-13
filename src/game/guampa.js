import * as T from 'three';

// The guampa the Paraguayan player sips tereré from when she heals: a horn cup with silver
// bands, wet yerba at the rim and a metal bombilla. Built in code, in its own frame - origin at
// the cup's centre, +Y up the cup, the bombilla leaning toward -Z with its tip at
// (0, .123, -.050) m - which scripts/author-terere-heal.py assumed when it solved the heal clip
// so the tip meets her lips. The manifest's clips.heal.guampa says where it sits in the hand and
// when it is there; it pops in as the hand comes up and is put away as the arm lowers.

const BOMBILLA_BASE = new T.Vector3(0, -.03, .012), BOMBILLA_TIP = new T.Vector3(0, .123, -.0498);

function buildGuampa() {
  const group = new T.Group();
  group.name = 'guampa';
  const horn = new T.MeshStandardMaterial({color: 0x5b3a22, roughness: .42, metalness: .05});
  const silver = new T.MeshStandardMaterial({color: 0xcfcac0, roughness: .28, metalness: .92});
  const yerba = new T.MeshStandardMaterial({color: 0x5f7f2e, roughness: .95});
  // Horn body: narrow rounded foot, widening to a slightly flared lip.
  const profile = [[0, -.058], [.016, -.057], [.024, -.052], [.027, -.04], [.03, -.01], [.033, .02], [.035, .045], [.037, .055], [.033, .056]]
    .map(([r, y]) => new T.Vector2(r, y));
  group.add(new T.Mesh(new T.LatheGeometry(profile, 28), horn));
  for (const [y, r] of [[-.046, .0275], [.049, .0365]]) {
    const band = new T.Mesh(new T.CylinderGeometry(r + .0015, r + .0015, .007, 28, 1, true), silver);
    band.position.y = y; group.add(band);
  }
  const leaves = new T.Mesh(new T.CircleGeometry(.032, 20), yerba);
  leaves.rotation.x = -Math.PI / 2; leaves.position.y = .046; group.add(leaves);
  // Bombilla: a thin tube from the filter bulb in the yerba up to a flattened mouthpiece.
  const along = new T.Vector3().subVectors(BOMBILLA_TIP, BOMBILLA_BASE), length = along.length();
  const tube = new T.Mesh(new T.CylinderGeometry(.0032, .0032, length, 10), silver);
  tube.position.copy(BOMBILLA_BASE).addScaledVector(along, .5);
  tube.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), along.clone().normalize());
  const filter = new T.Mesh(new T.SphereGeometry(.009, 14, 10), silver);
  filter.scale.set(1, .55, 1); filter.position.copy(BOMBILLA_BASE);
  const mouthpiece = new T.Mesh(new T.CylinderGeometry(.0042, .0034, .012, 10), silver);
  mouthpiece.scale.set(1, 1, .6); mouthpiece.quaternion.copy(tube.quaternion);
  mouthpiece.position.copy(BOMBILLA_TIP).addScaledVector(along.clone().normalize(), -.006);
  group.add(tube, filter, mouthpiece);
  group.traverse(node => { if (node.isMesh) node.castShadow = true; });
  return group;
}

export function createGuampa(body, spec) {
  const hand = spec && body.getObjectByName(spec.bone);
  if (!hand) return null;
  const holder = new T.Group();
  holder.position.fromArray(spec.position); holder.quaternion.fromArray(spec.quaternion); holder.scale.setScalar(spec.scale);
  const guampa = buildGuampa();
  holder.add(guampa); hand.add(holder);
  holder.visible = false;
  const [from, to] = spec.show;
  return {
    object: holder,
    update(action) {
      const t = action?.name === 'heal' ? action.elapsed ?? 0 : -1;
      const shown = t >= from && t <= to;
      holder.visible = shown;
      if (shown) guampa.scale.setScalar(Math.min(1, (t - from) / .08, (to - t) / .08) * .3 + .7);
    },
  };
}

// While she drinks, the shield hand holds the guampa, so the shield is slung at her left side:
// upright, its face turned out to her left, hung beside the hip, then taken back into the guard.
// The orientation comes from the shield's own shape (long axis up, thin axis out) and her pelvis's
// heading, and is blended over the socket-driven mount src/game/shield-strap.js leaves each frame.
const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _v = new T.Vector3(), _m = new T.Matrix4();
const SIDE = new T.Vector3(.36, -.04, -.05), UP = new T.Vector3(0, 1, 0), LEFT = new T.Vector3(1, 0, 0);
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function localBox(object) {
  object.updateMatrixWorld(true);
  const box = new T.Box3(), inverse = object.matrixWorld.clone().invert(), part = new T.Box3();
  object.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    box.union(part.copy(node.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inverse, node.matrixWorld)));
  });
  return box;
}

export function createShieldSling(actor) {
  const shield = actor.shield, hips = actor.body.getObjectByName('mixamorigHips');
  if (!shield || !hips) return null;
  actor.root.updateMatrixWorld(true);
  const hipsRest = hips.getWorldQuaternion(new T.Quaternion()).premultiply(actor.root.getWorldQuaternion(new T.Quaternion()).invert());
  const box = localBox(shield), size = box.getSize(new T.Vector3()), centreLocal = box.getCenter(new T.Vector3());
  const axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)], dims = size.toArray();
  const long = axes[dims.indexOf(Math.max(...dims))], thin = axes[dims.indexOf(Math.min(...dims))];
  // Shield frame -> slung frame (long axis up, thin axis to her left); her heading turns it each frame.
  const basis = (x, y) => new T.Matrix4().makeBasis(x, y, new T.Vector3().crossVectors(x, y));
  const slung = new T.Quaternion().setFromRotationMatrix(basis(UP, LEFT).multiply(basis(long, thin).transpose()));
  const heading = out => {
    // Her pelvis's facing, flattened: the rest heading (+Z) carried by the current hips rotation.
    hips.getWorldQuaternion(_q).multiply(_q2.copy(hipsRest).invert());
    _v.set(0, 0, 1).applyQuaternion(_q).setY(0);
    if (_v.lengthSq() < 1e-6) _v.set(0, 0, 1);
    return out.setFromUnitVectors(new T.Vector3(0, 0, 1), _v.normalize());
  };
  const frame = new T.Quaternion(), worldQ = new T.Quaternion(), targetQ = new T.Quaternion(), worldP = new T.Vector3(), targetP = new T.Vector3();
  return {
    update(action, duration) {
      const t = action?.name === 'heal' ? action.elapsed ?? 0 : -1;
      const weight = t < 0 || !Number.isFinite(duration) ? 0 : smoothstep(.02, .22, t) * (1 - smoothstep(duration - .3, duration - .08, t));
      if (!(weight > 0)) return;
      shield.updateMatrixWorld(true);
      shield.getWorldQuaternion(worldQ);
      shield.localToWorld(worldP.copy(centreLocal));
      heading(frame);
      targetQ.copy(frame).multiply(slung);
      hips.getWorldPosition(targetP).add(_v.copy(SIDE).applyQuaternion(frame));
      worldQ.slerp(targetQ, weight); worldP.lerp(targetP, weight);
      // Back into the socket's frame, with the shield's own centre landing on worldP.
      const parent = shield.parent; parent.updateMatrixWorld(true);
      shield.quaternion.copy(parent.getWorldQuaternion(_q2).invert().multiply(worldQ));
      const offset = centreLocal.clone().multiply(shield.scale).applyQuaternion(shield.quaternion);
      shield.position.copy(worldP).applyMatrix4(_m.copy(parent.matrixWorld).invert()).sub(offset);
      shield.updateMatrixWorld(true);
    },
  };
}
