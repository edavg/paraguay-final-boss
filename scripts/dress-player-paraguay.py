# Dress the retargeted Paraguayan player for runtime cloth: a ring of skirt bones and the anchors
# for the shawl fringe and the sash tassels.
#   python3 scripts/dress-player-paraguay.py RIG_IN.glb MANIFEST_IN.json RIG_OUT.glb MANIFEST_OUT.json
# The Tripo auto-rig skinned the skirt to the thighs and shins, so it tore between the legs in any
# wide stride. Here every skirt vertex is reweighted to the pelvis (at the waist) blending into
# SKIRT_BONES panels hanging from the waist ring (towards the hem). Their motion is code:
# src/game/skirt-sway.js swings them with inertia and pushes them clear of the legs. Each panel has
# a non-joint child "<name>Tip" at the hem so the runtime reads the panel length and rest direction.
# Anchors are vertex indices into the body mesh: the lower edge of the black shawl (found by its
# texture colour) for src/game/player-trim.js's fringe, and the left front of the sash for tassels.
import io, json, struct, sys, hashlib
import numpy as np
from PIL import Image

RIG_IN, MAN_IN, RIG_OUT, MAN_OUT = sys.argv[1:5]
SKIRT_BONES = 8
WAIST_Y, BLEND_Y, HEM_SEARCH = 0.60, 0.50, (0.12, 0.24)  # mesh space: 0..1 high, front +X, left -Z

f = open(RIG_IN, 'rb').read()
jl = struct.unpack('<I', f[12:16])[0]
j = json.loads(f[20:20 + jl])
b = bytearray(f[28 + jl:28 + jl + struct.unpack('<I', f[20 + jl:24 + jl])[0]])
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
DT = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}
def view(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NC[a['type']]
    assert bv.get('byteStride', 0) in (0, n * np.dtype(DT[a['componentType']]).itemsize)
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(b, DT[a["componentType"]], a["count"] * n, off).reshape(a["count"], n).copy(), off
def append(arr, typ, ctype=5126):
    while len(b) % 4: b.append(0)
    data = np.ascontiguousarray(arr, DT[ctype]); off = len(b); b.extend(data.tobytes())
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': data.nbytes})
    j['accessors'].append({'bufferView': len(j['bufferViews']) - 1, 'componentType': ctype, 'count': len(data), 'type': typ})
    return len(j['accessors']) - 1

prim = j['meshes'][0]['primitives'][0]
P = view(prim['attributes']['POSITION'])[0].astype(float)
UV = view(prim['attributes']['TEXCOORD_0'])[0]
J, joff = view(prim['attributes']['JOINTS_0'])
Wt, woff = view(prim['attributes']['WEIGHTS_0'])
J = J.copy(); Wt = Wt.astype(float).copy()
idx = view(prim['indices'])[0].reshape(-1, 3).astype(np.int64) if 'indices' in prim else np.arange(len(P)).reshape(-1, 3)
skin = j['skins'][0]
names = [j['nodes'][i]['name'] for i in skin['joints']]
jid = {n: k for k, n in enumerate(names)}

# Base colour per vertex.
img_i = j['textures'][j['materials'][prim['material']]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
bv = j['bufferViews'][j['images'][img_i]['bufferView']]
img = np.asarray(Image.open(io.BytesIO(bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]))).convert('RGB')).astype(float)
h, w = img.shape[:2]
C = img[np.clip((UV[:, 1] % 1) * h, 0, h - 1).astype(int), np.clip((UV[:, 0] % 1) * w, 0, w - 1).astype(int)]
lum = C.mean(1)
red = (C[:, 0] > 140) & (C[:, 1] < 90) & (C[:, 2] < 90)
blue = (C[:, 2] > 110) & (C[:, 0] < 100)

# ---------- skirt ----------
dominant = np.array([names[J[v, np.argmax(Wt[v])]] for v in range(len(P))])
legish = np.array([('UpLeg' in n) or n.endswith('Leg') or n.startswith('bone_3') or n == 'tripo::1_Left_Limb_0' or n.endswith('Hips') for n in dominant])
shin = np.array([n.endswith('LeftLeg') or n.endswith('RightLeg') for n in dominant])
skirt = legish & (P[:, 1] >= 0.1) & (P[:, 1] < WAIST_Y) & (lum >= 60) & ~red & ~blue
# Under the hem the shins and boots show: warm (skin) or dark (leather). Everything white there is
# skirt, including the generated underside that closes the hem in towards the legs: left on the
# shins it tore into spikes whenever a leg moved, on the panels it stays a hidden lining.
skirt &= ~((P[:, 1] < 0.25) & ((lum < 75) | (C[:, 0] - C[:, 2] > 35)))
cx, cz = (P[skirt, 0].max() + P[skirt, 0].min()) / 2, (P[skirt, 2].max() + P[skirt, 2].min()) / 2
theta = np.arctan2(P[:, 2] - cz, P[:, 0] - cx)  # 0 = front (+X)
radius = np.hypot(P[:, 0] - cx, P[:, 2] - cz)
step = 2 * np.pi / SKIRT_BONES
ring = []
for k in range(SKIRT_BONES):
    ang = k * step
    near = skirt & (np.abs(np.angle(np.exp(1j * (theta - ang)))) < step / 2)
    waist = near & (np.abs(P[:, 1] - (WAIST_Y - 0.02)) < 0.02)
    hem = near & (P[:, 1] >= HEM_SEARCH[0]) & (P[:, 1] < HEM_SEARCH[1])
    rw = np.percentile(radius[waist], 60) if waist.any() else np.percentile(radius[near & (P[:, 1] > 0.5)], 60)
    hy = P[hem, 1].min(); rh = np.percentile(radius[hem], 90)
    ring.append({'angle': ang, 'pivot': [cx + rw * np.cos(ang), WAIST_Y, cz + rw * np.sin(ang)],
                 'tip': [cx + rh * np.cos(ang), hy, cz + rh * np.sin(ang)]})

# Reweight: pelvis at the waist, two neighbouring panels below; no thigh or shin influence.
hips_j = jid['mixamorig:Hips']
first_new = len(names)
a = np.clip((WAIST_Y - P[:, 1]) / (WAIST_Y - BLEND_Y), 0, 1); a = a * a * (3 - 2 * a)
u = (theta % (2 * np.pi)) / step; k0 = np.floor(u).astype(int) % SKIRT_BONES; t = u - np.floor(u)
for v in np.nonzero(skirt)[0]:
    J[v] = [hips_j, first_new + k0[v], first_new + (k0[v] + 1) % SKIRT_BONES, hips_j]
    Wt[v] = [1 - a[v], a[v] * (1 - t[v]), a[v] * t[v], 0]
assert first_new + SKIRT_BONES <= 255
# Open the skirt underneath. The generated shell closes the hem in onto the shin skin, so any leg
# motion stretched that bridge into spikes. Real skirts are open: drop the bridge triangles (skirt
# to leg) and the floor of the underside near the legs, and render the material double-sided so
# the inside of the skirt shows in a roll.
leg_bound = np.zeros(len(P))
for c in range(4): leg_bound += Wt[:, c] * np.array([('Leg' in n) or ('Foot' in n) for n in names] + [False] * SKIRT_BONES)[J[:, c]]
legv = (leg_bound > .5) & ~skirt
tri_skirt, tri_leg = skirt[idx], legv[idx]
face_n = np.cross(P[idx[:, 1]] - P[idx[:, 0]], P[idx[:, 2]] - P[idx[:, 0]])
face_down = face_n[:, 1] / np.maximum(np.linalg.norm(face_n, axis=1), 1e-12) < -0.3  # the underside faces the floor
floor = tri_skirt.all(1) & face_down & (np.hypot(P[idx, 0] - cx, P[idx, 2] - cz) < 0.14).all(1) & (P[idx, 1] < 0.3).all(1)
drop = (tri_skirt.any(1) & tri_leg.any(1)) | floor
kept = idx[~drop]
ia = j['accessors'][prim['indices']]; ibv = j['bufferViews'][ia['bufferView']]
ioff = ibv.get('byteOffset', 0) + ia.get('byteOffset', 0)
packed = kept.astype(DT[ia['componentType']]).tobytes()
b[ioff:ioff + len(packed)] = packed
ia['count'] = int(kept.size)
j['materials'][prim['material']]['doubleSided'] = True
print(f'opened the skirt: dropped {int(drop.sum())} of {len(idx)} triangles')
b[joff:joff + J.nbytes] = J.astype(np.uint8).tobytes()
b[woff:woff + Wt.size * 4] = Wt.astype(np.float32).tobytes()

# Skirt bones under Hips, rest world from the mesh points through the placement used by the IBMs.
ibm, _ = view(skin['inverseBindMatrices']); ibm = ibm.reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
hips_node = skin['joints'][hips_j]
# joint world = place @ inv(IBM) with place = mesh -> world; recover place from any joint whose world we know:
def node_world(i, par):
    def trs(n):
        q = np.array(n.get('rotation', [0, 0, 0, 1.0])); x, y, z, ww = q
        R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*ww), 2*(x*z+y*ww)], [2*(x*y+z*ww), 1-2*(x*x+z*z), 2*(y*z-x*ww)], [2*(x*z-y*ww), 2*(y*z+x*ww), 1-2*(x*x+y*y)]])
        m = np.eye(4); m[:3, :3] = R * np.array(n.get('scale', [1, 1, 1.0])); m[:3, 3] = n.get('translation', [0, 0, 0]); return m
    m = trs(j['nodes'][i])
    while i in par: i = par[i]; m = trs(j['nodes'][i]) @ m
    return m
par = {c: i for i, n in enumerate(j['nodes']) for c in n.get('children', [])}
HW = node_world(hips_node, par)
place = HW @ ibm[hips_j]
new_ibm = list(ibm)
for k, r in enumerate(ring):
    pivot_w = place @ np.append(r['pivot'], 1); tip_w = place @ np.append(r['tip'], 1)
    local = np.linalg.inv(HW) @ pivot_w
    tip_local = (np.linalg.inv(HW) @ tip_w)[:3] - local[:3]  # bone has no rotation: same frame as Hips
    tip_node = {'name': f'Skirt{k}Tip', 'translation': tip_local.tolist()}
    j['nodes'].append(tip_node)
    j['nodes'].append({'name': f'Skirt{k}', 'translation': local[:3].tolist(), 'children': [len(j['nodes']) - 1]})
    bone = len(j['nodes']) - 1
    j['nodes'][hips_node].setdefault('children', []).append(bone)
    skin['joints'].append(bone)
    bw = HW.copy(); bw[:3, 3] = 0; bw = bw @ np.eye(4); bw[:3, 3] = (HW @ local)[:3]
    new_ibm.append(np.linalg.inv(bw) @ place)
skin['inverseBindMatrices'] = append(np.array(new_ibm).transpose(0, 2, 1).reshape(-1, 16), 'MAT4')

# ---------- trim anchors ----------
def boundary(mask):
    tri = mask[idx]; mixed = tri.any(1) & ~tri.all(1)
    edge = np.zeros(len(P), bool); edge[np.unique(idx[mixed][tri[mixed]])] = True
    return edge
def spaced(cands, spacing):
    out = []
    for v in cands[np.argsort(P[cands, 1])]:
        if all(np.linalg.norm(P[v] - P[o]) >= spacing for o in out): out.append(v)
    return out
def grow(mask):
    out = mask.copy(); out[idx[mask[idx].any(1)]] = True; return out
def close(mask, rings):  # fill the embroidered flowers so only the shawl's outline is an edge
    for _ in range(rings): mask = grow(mask)
    for _ in range(rings): mask = ~grow(~mask)
    return mask
region = (P[:, 1] > 0.55) & (P[:, 1] < 0.86) & (P[:, 2] < -0.03)
shawl = close((lum < 45) & region, 6) & region
# The lower edge: around the torso axis, the lowest shawl vertex in each angular sector, walked
# from the front over the left side to the back (the shawl drapes over the left shoulder).
ang_all = np.arctan2(P[:, 2] - cz, P[:, 0] - cx)
ids = np.nonzero(shawl)[0]
fringe = []
for lo in np.arange(-np.pi, np.pi, np.radians(5)):
    sector = ids[(ang_all[ids] >= lo) & (ang_all[ids] < lo + np.radians(5))]
    if len(sector) < 8: continue
    fringe.append(int(sector[np.argmin(P[sector, 1])]))
# Order front -> left -> back: angle 0 is the front (+X), the left side is negative angles.
fringe.sort(key=lambda v: -ang_all[v] if ang_all[v] <= 0 else -ang_all[v] + 2 * np.pi)
sash = (red | blue) & (P[:, 1] > 0.58) & (P[:, 1] < 0.7)
front_left = (P[:, 0] - cx) * np.cos(-np.pi / 4) + (P[:, 2] - cz) * np.sin(-np.pi / 4)
sash_ids = np.nonzero(sash)[0]
lowest = sash_ids[P[sash_ids, 1] < np.percentile(P[sash_ids, 1], 20)]
knot = lowest[np.argmax(front_left[lowest])]
tassels = [knot] + [v for v in lowest[np.argsort(np.linalg.norm(P[lowest] - P[knot], axis=1))] if 0.008 < np.linalg.norm(P[v] - P[knot]) < 0.02][:2]

def torso_radius(lo, hi):
    m = (P[:, 1] > lo) & (P[:, 1] < hi) & (np.abs(P[:, 2] - cz) < 0.11) & ~np.array([('Arm' in n) or ('Hand' in n) or ('Shoulder' in n) for n in dominant])
    return float(np.percentile(np.hypot(P[m, 0] - cx, P[m, 2] - cz), 80))
scale = np.linalg.norm(place[:3, 0])

# ---------- write ----------
while len(b) % 4: b.append(0)
j['buffers'][0]['byteLength'] = len(b)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
with open(RIG_OUT, 'wb') as out:
    out.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(b)))
    out.write(struct.pack('<II', len(js), 0x4E4F534A)); out.write(js)
    out.write(struct.pack('<II', len(b), 0x004E4942)); out.write(bytes(b))

m = json.load(open(MAN_IN))
m['asset'] = RIG_OUT; m['previousCandidateSha256'] = m.get('sha256')
m['sha256'] = hashlib.sha256(open(RIG_OUT, 'rb').read()).hexdigest()
m['revision'] = 'paraguay-v2-skirt-bones-and-trim-2026-10-12'
m['skirt'] = {'bones': [f'Skirt{k}' for k in range(SKIRT_BONES)], 'script': 'scripts/dress-player-paraguay.py',
              'vertices': int(skirt.sum()), 'note': 'Skirt reweighted from thighs/shins to pelvis + hanging panels; src/game/skirt-sway.js drives the panels.'}
m['trim'] = {'mesh': j['meshes'][0].get('name'), 'fringe': [int(v) for v in fringe], 'tassels': [int(v) for v in tassels],
             'torsoRadius': torso_radius(0.62, 0.75) * scale, 'waistRadius': torso_radius(0.56, 0.62) * scale,
             'note': 'Vertex indices into the body mesh: shawl lower edge (fringe) and the sash at the left front (tassels).'}
m['limitations'] = [x for x in m.get('limitations', []) if not x.startswith(('Skirt is skinned', 'The knight cloth'))] + [
    'The knight cloth garments are hidden ("cloth": false); the shawl fringe and sash tassels are code cloth (src/game/player-trim.js).']
json.dump(m, open(MAN_OUT, 'w'), indent=1)
print(f'skirt vertices {int(skirt.sum())}, centre ({cx:.3f},{cz:.3f}), fringe anchors {len(fringe)}, tassels {tassels}')
for k, r in enumerate(ring): print(f"  Skirt{k} angle {np.degrees(r['angle']):5.0f} pivot {np.round(r['pivot'], 3)} tip {np.round(r['tip'], 3)}")
print('torso r', m['trim']['torsoRadius'], 'waist r', m['trim']['waistRadius'])
