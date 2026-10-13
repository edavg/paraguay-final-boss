import * as T from 'three';

// The Paraguayan player's loose trim, simulated in code like the knight's cloth: the black fringe
// under the embroidered shawl and the red, white and blue tassels hanging from the sash.
//
// Anchors are vertex indices into the skinned body (the manifest's "trim" block, measured by
// scripts/dress-player-paraguay.py), so each strand starts exactly on the shawl edge or the sash
// whatever the clip does. Strands are short Verlet chains in world space with gravity, damping,
// and collisions against the torso, the left arm (the shawl drapes over it) and the swinging
// skirt (src/game/skirt-sway.js). They render as thin ribbons in one draw call per material; the
// group cancels the actor's transform so its vertices can stay in world space.

const STEP = 1 / 120;
const FRINGE = {perGap: 4, segments: 5, length: [.13, .19], width: .0055, maxGap: .07, color: 0x0b0a0c};
const TASSEL = {segments: 4, length: [.13, .17], width: .007, head: .07, colors: [0xb3171c, 0xece6da, 0x1f3f8f]};
const _v = new T.Vector3(), _w = new T.Vector3(), _n = new T.Vector3(), _up = new T.Vector3(0, -1, 0), _one = new T.Vector3(1, 1, 1), _q = new T.Quaternion();

function capsulePush(point, a, b, radius) {
  const ab = _v.subVectors(b, a), t = T.MathUtils.clamp(_w.subVectors(point, a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
  const closest = _n.copy(a).addScaledVector(ab, t), offset = _w.subVectors(point, closest), distance = offset.length();
  if (distance < radius && distance > 1e-6) point.copy(closest).addScaledVector(offset, radius / distance);
}

function makeStrand(segments, length, phase) {
  const points = Array.from({length: segments + 1}, () => new T.Vector3());
  return {points, prev: points.map(() => new T.Vector3()), anchor: new T.Vector3(), rest: length / segments, phase};
}

function ribbonGeometry(count, segments) {
  const geometry = new T.BufferGeometry(), quads = count * segments;
  geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(quads * 4 * 3), 3));
  geometry.setAttribute('normal', new T.BufferAttribute(new Float32Array(quads * 4 * 3), 3));
  const index = [];
  for (let q = 0; q < quads; q++) index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3);
  geometry.setIndex(index);
  return geometry;
}

export function createPlayerTrim(body, trim, skirt) {
  const mesh = body.getObjectByProperty('isSkinnedMesh', true);
  if (!mesh || !trim) return null;
  const bone = name => body.getObjectByName('mixamorig' + name);
  // The torso capsule starts above the sash; below it the skirt cone collides.
  const torso = [bone('Spine'), bone('Spine2')], arm = [bone('LeftArm'), bone('LeftForeArm'), bone('LeftHand')];
  const object = new T.Group();
  object.name = 'player-trim';
  object.matrixAutoUpdate = false;

  // Fringe: interpolate strands between consecutive anchors along the shawl edge.
  const random = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
  const rest = i => mesh.getVertexPosition(i, new T.Vector3());
  const fringe = [];
  const anchors = trim.fringe || [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i], b = anchors[i + 1];
    const steps = b !== undefined && rest(a).distanceTo(rest(b)) * body.matrixWorld.getMaxScaleOnAxis() < FRINGE.maxGap ? FRINGE.perGap : 1;
    for (let k = 0; k < steps; k++) {
      const length = T.MathUtils.lerp(FRINGE.length[0], FRINGE.length[1], random());
      fringe.push({a, b: steps > 1 ? b : a, t: k / steps, ...makeStrand(FRINGE.segments, length, random() * 6.28)});
    }
  }
  const fringeMaterial = new T.MeshStandardMaterial({color: FRINGE.color, roughness: .82, side: T.DoubleSide});
  const fringeMesh = new T.Mesh(ribbonGeometry(fringe.length, FRINGE.segments), fringeMaterial);

  // Tassel cords leave the knot over the gathered skirt: the second point is pinned on the skirt's
  // outer surface just below the sash (src/game/skirt-sway.js collide), the rest hangs free.
  const tassels = (trim.tassels || []).slice(0, 3).map((a, i) => ({a, b: a, t: 0, color: TASSEL.colors[i % 3], overSkirt: new T.Vector3(),
    ...makeStrand(TASSEL.segments, T.MathUtils.lerp(TASSEL.length[0], TASSEL.length[1], i / 2), i * 2.1)}));
  const tasselMeshes = tassels.map(tassel => {
    const material = new T.MeshStandardMaterial({color: tassel.color, roughness: .9, side: T.DoubleSide});
    const cord = new T.Mesh(ribbonGeometry(1, TASSEL.segments), material);
    const head = new T.Mesh(new T.CylinderGeometry(.006, .02, TASSEL.head, 10, 3, true).translate(0, -TASSEL.head / 2, 0), material);
    head.matrixAutoUpdate = false;
    object.add(cord, head);
    return {cord, head};
  });
  object.add(fringeMesh);
  object.traverse(node => { if (node.isMesh) { node.castShadow = true; node.frustumCulled = false; } });

  const anchorWorld = (strand, out) => {
    mesh.getVertexPosition(strand.a, out).applyMatrix4(mesh.matrixWorld);
    if (strand.b !== strand.a) out.lerp(mesh.getVertexPosition(strand.b, _w).applyMatrix4(mesh.matrixWorld), strand.t);
    return out;
  };
  const colliders = {torso: [new T.Vector3(), new T.Vector3()], arm: [new T.Vector3(), new T.Vector3(), new T.Vector3()]};
  const torsoRadius = (trim.torsoRadius || .19) * .92;
  let ready = false, accumulator = 0, time = 0;
  const all = [...fringe, ...tassels];

  function simulate(strand, anchor) {
    const {points, prev, rest: segment, overSkirt} = strand;
    points[0].copy(anchor); prev[0].copy(anchor);
    const pinned = overSkirt && skirt ? 2 : 1;
    if (pinned === 2) { points[1].copy(overSkirt); prev[1].copy(overSkirt); }
    for (let i = pinned; i < points.length; i++) {
      const p = points[i], velocity = _v.subVectors(p, prev[i]).multiplyScalar(.985);
      prev[i].copy(p);
      p.add(velocity);
      p.y -= 9.8 * STEP * STEP;
      // A faint draught keeps resting strands from freezing into a comb.
      p.x += Math.sin(time * 1.7 + strand.phase + i) * 2e-6;
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      for (let i = pinned; i < points.length; i++) {
        const a = points[i - 1], b = points[i], d = _v.subVectors(b, a), length = d.length() || 1e-6;
        b.copy(a).addScaledVector(d, segment / length);
      }
      for (let i = pinned; i < points.length; i++) {
        const p = points[i];
        // Only the fringe drapes over the torso and the shawl arm; the tassels hang at the hip where
        // the shield hand passes, and resting them on the forearm propped them up off the skirt.
        if (!overSkirt) {
          capsulePush(p, colliders.torso[0], colliders.torso[1], torsoRadius);
          capsulePush(p, colliders.arm[0], colliders.arm[1], .052);
          capsulePush(p, colliders.arm[1], colliders.arm[2], .042);
        }
        skirt?.collide(p, .008);
      }
    }
  }

  function writeRibbon(geometry, strands, segments, width, offset = 0) {
    const position = geometry.attributes.position.array, normal = geometry.attributes.normal.array;
    let q = offset;
    for (const {points} of strands) {
      for (let s = 0; s < segments; s++, q++) {
        const a = points[s], b = points[s + 1];
        const along = _v.subVectors(b, a).normalize();
        // Ribbons face away from the torso axis, so they read as strands from outside.
        const out = _n.subVectors(a, colliders.torso[0]); out.addScaledVector(along, -out.dot(along));
        if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
        const side = _w.crossVectors(along, out.normalize()).multiplyScalar(width / 2);
        const base = q * 12;
        position.set([a.x - side.x, a.y - side.y, a.z - side.z, a.x + side.x, a.y + side.y, a.z + side.z,
          b.x - side.x, b.y - side.y, b.z - side.z, b.x + side.x, b.y + side.y, b.z + side.z], base);
        for (let k = 0; k < 4; k++) normal.set([out.x, out.y, out.z], base + k * 3);
      }
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  return {
    object,
    reset() { ready = false; },
    update(dt, root) {
      object.matrix.copy(root.matrixWorld).invert();
      object.matrixWorldNeedsUpdate = true;
      torso[0].getWorldPosition(colliders.torso[0]); torso[1].getWorldPosition(colliders.torso[1]);
      arm.forEach((b, i) => b.getWorldPosition(colliders.arm[i]));
      if (!ready || dt > .25) {
        for (const strand of all) {
          const anchor = anchorWorld(strand, strand.anchor);
          strand.points.forEach((p, i) => { p.copy(anchor).y -= i * strand.rest; strand.prev[i].copy(p); });
        }
        ready = true; accumulator = 0;
      }
      accumulator = Math.min(accumulator + dt, .1);
      for (const strand of all) anchorWorld(strand, strand.anchor);
      if (skirt) for (const tassel of tassels) {
        // 3 cm below the skirt's waist ring (the knot sits on the sash, above it), then out to the
        // skirt surface: the cord leaves the knot over the gathers.
        const along = _v.subVectors(tassel.anchor, skirt.cone.waist).dot(skirt.cone.axis);
        tassel.overSkirt.copy(tassel.anchor).addScaledVector(skirt.cone.axis, .03 - along);
        skirt.collide(tassel.overSkirt, .012);
      }
      while (accumulator >= STEP) {
        accumulator -= STEP; time += STEP;
        for (const strand of all) simulate(strand, strand.anchor);
      }
      writeRibbon(fringeMesh.geometry, fringe, FRINGE.segments, FRINGE.width);
      tassels.forEach((tassel, i) => {
        writeRibbon(tasselMeshes[i].cord.geometry, [tassel], TASSEL.segments, TASSEL.width);
        const end = tassel.points[tassel.points.length - 1], before = tassel.points[tassel.points.length - 2];
        const down = _v.subVectors(before, end).normalize().negate();
        tasselMeshes[i].head.matrix.compose(end, _q.setFromUnitVectors(_up, down), _one);
        tasselMeshes[i].head.matrixWorldNeedsUpdate = true;
      });
    },
  };
}
