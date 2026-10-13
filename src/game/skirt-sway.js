import * as T from 'three';

// The Paraguayan player's skirt hangs from the pelvis on a ring of panel bones (Skirt0..N under
// Hips, each with a SkirtNTip child at the hem; scripts/dress-player-paraguay.py builds them and
// reweights the skirt onto them). The clips never key these bones: this module swings them.
//
// Each panel is one hem point integrated in world space (Verlet, a few fixed substeps), pulled
// toward where the animated pelvis would carry it, weighed down by gravity, kept at the panel's
// length, pushed outside the thigh and shin capsules so a stride lifts the skirt instead of
// tearing through it, and limited to a cone around the animated direction so a roll cannot fold
// the skirt through the body. collide() pushes other cloth (the sash tassels, the shawl fringe)
// out of the skirt: a cone through the current panels, shaped per panel and height by the real
// skirt surface measured at bind (the gathers below the sash bulge well past a straight cone).

const STEP = 1 / 120;
const _onPanel = new T.Vector3(), _onLeg = new T.Vector3();
const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _d = new T.Vector3(), _q = new T.Quaternion(), _pq = new T.Quaternion();

function closestOnSegments(p1, q1, p2, q2, outA, outB) {
  const d1 = _c.subVectors(q1, p1), d2 = _d.subVectors(q2, p2), r = _a.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  let s = den > 1e-9 ? T.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = T.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = T.MathUtils.clamp((b - c) / a, 0, 1); }
  outA.copy(p1).addScaledVector(d1, s); outB.copy(p2).addScaledVector(d2, t);
  return s;
}

export class SkirtSway {
  static from(body, options) {
    const sway = new SkirtSway(body, options);
    return sway.panels.length ? sway : null;
  }

  constructor(body, {thighRadius = .1, shinRadius = .075, stiffness = 55, damping = 5, gravity = 1.5, maxSwing = .95} = {}) {
    Object.assign(this, {thighRadius, shinRadius, stiffness, damping, gravity, maxSwing});
    this.panels = [];
    body.traverse(node => {
      if (!/^Skirt\d+$/.test(node.name)) return;
      const tip = node.children.find(child => child.name === node.name + 'Tip');
      if (tip) this.panels.push({bone: node, tip, rest: node.quaternion.clone(), pivot: new T.Vector3(), target: new T.Vector3(), hang: new T.Vector3(),
        p: new T.Vector3(), prev: new T.Vector3(), length: 0});
    });
    const leg = side => ['UpLeg', 'Leg', 'Foot'].map(name => body.getObjectByName('mixamorig' + side + name));
    this.legs = [leg('Left'), leg('Right')].filter(bones => bones.every(Boolean));
    this.ready = false;
    this.accumulator = 0;
    this.profile = this.panels.length ? measureProfile(body, this.panels) : null;
    this.cone = {waist: new T.Vector3(), hem: new T.Vector3(), axis: new T.Vector3(0, -1, 0), length: 0, waistRadius: 0, hemRadius: 0};
  }

  reset() { this.ready = false; }

  update(dt) {
    const segments = [];
    for (const [hip, knee, ankle] of this.legs) {
      const A = hip.getWorldPosition(new T.Vector3()), B = knee.getWorldPosition(new T.Vector3()), C = ankle.getWorldPosition(new T.Vector3());
      segments.push([A, B, this.thighRadius], [B, C, this.shinRadius]);
    }
    for (const panel of this.panels) {
      panel.bone.quaternion.copy(panel.rest);
      panel.bone.updateMatrixWorld(true);
      panel.bone.getWorldPosition(panel.pivot);
      panel.tip.getWorldPosition(panel.target);
      panel.length = panel.pivot.distanceTo(panel.target);
      panel.hang.subVectors(panel.target, panel.pivot).divideScalar(panel.length || 1);
    }
    if (!this.ready || dt > .25) {
      for (const panel of this.panels) { panel.p.copy(panel.target); panel.prev.copy(panel.target); }
      this.ready = true; this.accumulator = 0;
    }
    this.accumulator = Math.min(this.accumulator + dt, .1);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      for (const panel of this.panels) this.step(panel, segments);
    }
    for (const panel of this.panels) this.pose(panel);
    this.updateCone();
  }

  step(panel, segments) {
    const {p, prev, target, pivot} = panel;  // panel.hang: unit animated hang direction
    const velocity = _a.subVectors(p, prev).multiplyScalar(Math.max(0, 1 - this.damping * STEP));
    const accel = _b.subVectors(target, p).multiplyScalar(this.stiffness);
    accel.y -= this.gravity;
    prev.copy(p);
    p.add(velocity).addScaledVector(accel, STEP * STEP);
    for (let iteration = 0; iteration < 2; iteration++) {
      this.constrain(panel);
      for (const [A, B, radius] of segments) {
        const s = closestOnSegments(pivot, p, A, B, _onPanel, _onLeg);
        const gap = _onPanel.distanceTo(_onLeg);
        if (gap >= radius || s < .05) continue;
        // Below the hem the boots are outside the skirt: only the leg inside it may push.
        if (_c.subVectors(_onLeg, pivot).dot(panel.hang) > panel.length) continue;
        const away = gap > 1e-6 ? _onPanel.sub(_onLeg).divideScalar(gap) : _c.subVectors(target, pivot).setY(0).normalize();
        // Moving the hem by depth/s moves the contact point by the depth (capped near the waist).
        p.addScaledVector(away, (radius - gap) / Math.max(s, .3));
      }
    }
    this.constrain(panel);
  }

  // Panel length, then the swing cone around the animated hang.
  constrain({p, pivot, target, length}) {
    const dir = _c.subVectors(p, pivot), rest = _d.subVectors(target, pivot).normalize();
    if (dir.lengthSq() < 1e-10) dir.copy(rest);
    dir.normalize();
    const angle = dir.angleTo(rest);
    if (angle > this.maxSwing) {
      const axis = _b.crossVectors(rest, dir);
      if (axis.lengthSq() > 1e-10) dir.copy(rest).applyAxisAngle(axis.normalize(), this.maxSwing);
    }
    p.copy(pivot).addScaledVector(dir, length);
  }

  pose({bone, p, pivot, target}) {
    _q.setFromUnitVectors(_c.subVectors(target, pivot).normalize(), _d.subVectors(p, pivot).normalize());
    bone.getWorldQuaternion(_pq);
    _pq.premultiply(_q);
    bone.parent.getWorldQuaternion(_q).invert();
    bone.quaternion.copy(_q.multiply(_pq));
    bone.updateMatrixWorld(true);
  }

  updateCone() {
    const {waist, hem, axis} = this.cone, n = this.panels.length;
    waist.set(0, 0, 0); hem.set(0, 0, 0);
    for (const panel of this.panels) { waist.add(panel.pivot); hem.add(panel.p); }
    waist.divideScalar(n); hem.divideScalar(n);
    let waistRadius = 0, hemRadius = 0;
    for (const panel of this.panels) { waistRadius += panel.pivot.distanceTo(waist); hemRadius += panel.p.distanceTo(hem); }
    this.cone.waistRadius = waistRadius / n; this.cone.hemRadius = hemRadius / n;
    this.cone.length = axis.subVectors(hem, waist).length();
    axis.divideScalar(Math.max(this.cone.length, 1e-6));
  }

  // Push a world point out of the skirt (used by the sash tassels and the shawl fringe).
  collide(point, margin = .01) {
    const {waist, axis, length, waistRadius, hemRadius} = this.cone;
    if (!length) return;
    const along = _a.subVectors(point, waist).dot(axis);
    if (along < 0) return;  // above the waist the skirt is not there
    const s = Math.min(along, length);
    const centre = _b.copy(waist).addScaledVector(axis, s), radial = _c.subVectors(point, centre), distance = radial.length();
    if (distance < 1e-6) return;
    const radius = T.MathUtils.lerp(waistRadius, hemRadius, s / length) * this.shape(radial, s / length) + margin;
    if (distance < radius) point.copy(centre).addScaledVector(radial, radius / distance);
  }

  // Bind-measured radius ratio for the panel facing `radial`, at fraction s down the skirt.
  shape(radial, s) {
    if (!this.profile) return 1;
    let best = 0, panel = 0;
    this.panels.forEach((p, k) => { const d = _d.subVectors(p.pivot, this.cone.waist).dot(radial); if (d > best) { best = d; panel = k; } });
    const row = this.profile[panel], x = T.MathUtils.clamp(s, 0, 1) * (row.length - 1), i = Math.min(Math.floor(x), row.length - 2);
    return T.MathUtils.lerp(row[i], row[i + 1], x - i);
  }
}

// Per panel, per height band: how far the bind-pose skirt surface sits from a straight cone between
// the panel ring at the waist and the hem (90th percentile of the skirt vertices' radius / cone radius).
function measureProfile(body, panels, bands = 10) {
  const mesh = body.getObjectByProperty('isSkinnedMesh', true);
  if (!mesh) return null;
  body.updateMatrixWorld(true);
  const pivots = panels.map(p => p.bone.getWorldPosition(new T.Vector3())), tips = panels.map(p => p.tip.getWorldPosition(new T.Vector3()));
  const waist = pivots.reduce((a, v) => a.add(v), new T.Vector3()).divideScalar(pivots.length);
  const hem = tips.reduce((a, v) => a.add(v), new T.Vector3()).divideScalar(tips.length);
  const axis = new T.Vector3().subVectors(hem, waist), length = axis.length(); axis.divideScalar(length);
  const rw = pivots.reduce((a, v) => a + v.distanceTo(waist), 0) / pivots.length, rh = tips.reduce((a, v) => a + v.distanceTo(hem), 0) / tips.length;
  const dirs = pivots.map(v => v.clone().sub(waist).projectOnPlane(axis).normalize());
  const panelOf = new Map(panels.map((p, k) => [mesh.skeleton.bones.indexOf(p.bone), k]));
  const samples = panels.map(() => Array.from({length: bands}, () => []));
  const {skinIndex, skinWeight} = mesh.geometry.attributes, v = new T.Vector3(), radial = new T.Vector3();
  for (let i = 0; i < skinIndex.count; i++) {
    let onSkirt = false;
    for (let c = 0; c < 4; c++) if (skinWeight.getComponent(i, c) > .2 && panelOf.has(skinIndex.getComponent(i, c))) onSkirt = true;
    if (!onSkirt) continue;
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
    const s = v.clone().sub(waist).dot(axis) / length;
    if (s < 0 || s > 1) continue;
    radial.subVectors(v, waist).addScaledVector(axis, -s * length);
    let best = -Infinity, k = 0;
    dirs.forEach((d, j) => { const dot = d.dot(radial); if (dot > best) { best = dot; k = j; } });
    samples[k][Math.min(bands - 1, Math.floor(s * bands))].push(radial.length() / T.MathUtils.lerp(rw, rh, s));
  }
  return samples.map(row => {
    const values = row.map(list => list.length ? list.sort((a, b) => a - b)[Math.floor(list.length * .9)] : null);
    return values.map((value, b) => value ?? values.find(x => x !== null) ?? 1);
  });
}
