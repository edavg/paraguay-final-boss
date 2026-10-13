# Rig the boss body (the man in the suit) with a mixamorig skeleton fitted to the mesh, for
# scripts/retarget-player-paraguay.py to carry the approved boss clips onto.
#   python3 scripts/rig-boss-man.py BODY.glb RIG_OUT.glb
# The Tripo auto-rig found one leg only (asset-plan.md, 2026-10-12), so the joints are placed here
# from slices of the A-pose mesh (legs split below the crotch, arms split from the torso by the gap
# between them) and the skin weights are inverse distance to the bone segments, limited per region
# so a hand never pulls the hip and a thigh never pulls the other thigh.
# Output follows the Tripo rig layout the retarget script reads: mesh space 0..1 high with the feet
# at 0, front +X, the character's left at -Z, joints world-aligned (rest = bind), and an
# 'Armature' node holding the mesh and the skeleton root.
import json, struct, sys
import numpy as np

BODY, OUT = sys.argv[1:3]
P = 'mixamorig:'

f = open(BODY, 'rb').read()
jl = struct.unpack('<I', f[12:16])[0]
j = json.loads(f[20:20 + jl])
b = bytearray(f[28 + jl:28 + jl + struct.unpack('<I', f[20 + jl:24 + jl])[0]])
assert len(j['meshes']) == 1 and len(j['meshes'][0]['primitives']) == 1
prim = j['meshes'][0]['primitives'][0]
a = j['accessors'][prim['attributes']['POSITION']]; bv = j['bufferViews'][a['bufferView']]
assert a['componentType'] == 5126 and bv.get('byteStride', 12) == 12
V = np.frombuffer(bytes(b), np.float32, a['count'] * 3, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, 3).astype(float)
V[:, 1] -= V[:, 1].min()  # feet on 0
H = V[:, 1].max()
assert abs(H - 1) < 0.02, f'expected a 1-unit mesh, got {H}'
x, y, z = V.T

# ---------- regions ----------
# Arms: in each 1 cm slice where the hanging arm is separate from the torso, the widest empty band
# in |z| on each side splits them. Above the armpit there is no band and distance decides.
arm_of = np.zeros(len(V), int)  # -1 left arm, +1 right arm, 0 not an arm
for y0 in np.arange(0.35, 0.70, 0.01):
    for s in (-1, 1):
        sel = np.where((y >= y0) & (y < y0 + 0.01) & (z * s > 0))[0]
        if len(sel) < 10: continue
        az = np.sort(np.abs(z[sel])); gaps = np.diff(az); k = int(np.argmax(gaps))
        if gaps[k] > 0.012 and az[k] > 0.06: arm_of[sel[np.abs(z[sel]) > (az[k] + az[k + 1]) / 2]] = s
crotch = max(y[(np.abs(z) < 0.01) & (arm_of == 0)].min(), 0.3)  # lowest torso point on the midline
leg_of = np.where((y < crotch) & (arm_of == 0), np.sign(z).astype(int), 0)
print(f'crotch {crotch:.3f}, arm verts L {np.sum(arm_of == -1)} R {np.sum(arm_of == 1)}')

def centroid(mask, y0, h=0.012):
    m = mask & (np.abs(y - y0) < h)
    assert m.sum() > 5, f'empty slice at {y0}'
    return V[m].mean(0)

# ---------- joints (mesh space) ----------
J = {}
torso = (arm_of == 0) & (leg_of == 0)
for name, h in (('Hips', crotch + 0.05), ('Spine', 0.57), ('Spine2', 0.70), ('Neck', 0.855), ('Head', 0.90)):
    c = centroid(torso, min(h, 0.84)); J[name] = np.array([c[0], h, 0.0])
J['HeadTop_End'] = np.array([J['Head'][0], 1.0, 0.0])
for side, s in (('Left', -1), ('Right', 1)):
    leg = leg_of == s
    up = centroid(leg, crotch - 0.04); J[side + 'UpLeg'] = np.array([up[0], crotch + 0.02, up[2]])
    J[side + 'Leg'] = centroid(leg, 0.285)
    ank = centroid(leg, 0.09); J[side + 'Foot'] = np.array([ank[0], 0.055, ank[2]])
    foot = leg & (y < 0.04); tip = V[foot][np.argmax(x[foot])]
    J[side + 'ToeBase'] = np.array([ank[0] + 0.6 * (tip[0] - ank[0]), 0.02, ank[2]])
    J[side + 'Toe_End'] = np.array([tip[0], 0.02, ank[2]])
    # Arm axis: principal direction of the separated arm verts above the hand.
    arm = V[(arm_of == s) & (y > 0.47)]; c = arm.mean(0)
    d = np.linalg.svd(arm - c)[2][0]; d = d if d[1] < 0 else -d  # pointing down the arm
    sh_y = 0.755
    J[side + 'Arm'] = c + d * (sh_y - c[1]) / d[1]
    J[side + 'Shoulder'] = np.array([J['Spine2'][0], 0.78, s * 0.035])
    hand = V[arm_of == s]; tip = hand[np.argmin(hand[:, 1])]
    span = np.dot(tip - J[side + 'Arm'], d)
    along = lambda t: J[side + 'Arm'] + d * t
    J[side + 'Hand'] = along(span - 0.10)
    J[side + 'ForeArm'] = along((span - 0.10) * 0.56)
    for k, t in enumerate((0.045, 0.068, 0.085), 1): J[f'{side}HandMiddle{k}'] = along(span - 0.10 + t)
    J[side + 'HandMiddle4'] = along(span)

PARENT = {'Hips': None, 'Spine': 'Hips', 'Spine2': 'Spine', 'Neck': 'Spine2', 'Head': 'Neck', 'HeadTop_End': 'Head'}
for side in ('Left', 'Right'):
    PARENT.update({side + 'UpLeg': 'Hips', side + 'Leg': side + 'UpLeg', side + 'Foot': side + 'Leg',
                   side + 'ToeBase': side + 'Foot', side + 'Toe_End': side + 'ToeBase',
                   side + 'Shoulder': 'Spine2', side + 'Arm': side + 'Shoulder', side + 'ForeArm': side + 'Arm',
                   side + 'Hand': side + 'ForeArm', side + 'HandMiddle1': side + 'Hand',
                   side + 'HandMiddle2': side + 'HandMiddle1', side + 'HandMiddle3': side + 'HandMiddle2',
                   side + 'HandMiddle4': side + 'HandMiddle3'})
ENDS = {n for n in PARENT if n.endswith(('_End', 'Middle4'))}  # tips: no weights
names = [n for n in PARENT if n not in ENDS]
child = {}
for n, p in PARENT.items():
    if p and p not in child and not n.startswith(('LeftShoulder', 'RightShoulder', 'LeftUpLeg', 'RightUpLeg')): child[p] = n
child['Hips'] = 'Spine'; child['Spine2'] = 'Neck'
for n in names: print(f'  {n:20s} {np.round(J[n], 3)}')

# ---------- weights ----------
def seg_dist(p0, p1):
    d = p1 - p0; t = np.clip(((V - p0) @ d) / (d @ d), 0, 1)
    return np.linalg.norm(V - (p0 + t[:, None] * d), axis=1)
D = np.stack([seg_dist(J[n], J[child[n]]) for n in names], 1)
allow = np.zeros_like(D, bool)
col = {n: k for k, n in enumerate(names)}
ARM = ('Arm', 'ForeArm', 'Hand', 'HandMiddle1', 'HandMiddle2', 'HandMiddle3')
LEG = ('UpLeg', 'Leg', 'Foot', 'ToeBase')
for side, s in (('Left', -1), ('Right', 1)):
    on = arm_of == s
    for n in ARM: allow[on, col[side + n]] = True
    on = leg_of == s
    for n in LEG: allow[on, col[side + n]] = True
    allow[on & (y > crotch - 0.06), col['Hips']] = True
    t = torso & (z * s >= -0.02)
    allow[t & (y > 0.62), col[side + 'Shoulder']] = True
    allow[t & (y > 0.62) & (np.abs(z) > 0.06), col[side + 'Arm']] = True
    allow[t & (y < crotch + 0.10), col[side + 'UpLeg']] = True
for n in ('Hips', 'Spine', 'Spine2', 'Neck', 'Head'): allow[torso, col[n]] = True
assert allow.any(1).all()
Wf = np.where(allow, 1 / (D + 0.004) ** 4, 0)
top = np.argsort(-Wf, 1)[:, :4]
Wt = np.take_along_axis(Wf, top, 1); Wt /= Wt.sum(1, keepdims=True)
Wt[Wt < 0.01] = 0; Wt /= Wt.sum(1, keepdims=True)

# ---------- glb out ----------
def append(arr, typ, ctype, target=None, minmax=False):
    while len(b) % 4: b.append(0)
    data = np.ascontiguousarray(arr); off = len(b); b.extend(data.tobytes())
    view = {'buffer': 0, 'byteOffset': off, 'byteLength': data.nbytes}
    if target: view['target'] = target
    j['bufferViews'].append(view)
    acc = {'bufferView': len(j['bufferViews']) - 1, 'componentType': ctype, 'count': len(data), 'type': typ}
    if minmax: acc['min'] = data.min(0).tolist(); acc['max'] = data.max(0).tolist()
    j['accessors'].append(acc); return len(j['accessors']) - 1
prim['attributes']['POSITION'] = append(V.astype(np.float32), 'VEC3', 5126, 34962, True)
prim['attributes']['JOINTS_0'] = append(top.astype(np.uint16), 'VEC4', 5123, 34962)
prim['attributes']['WEIGHTS_0'] = append(Wt.astype(np.float32), 'VEC4', 5126, 34962)

mesh_node = next(i for i, n in enumerate(j['nodes']) if 'mesh' in n)
assert all(k not in j['nodes'][mesh_node] for k in ('translation', 'rotation', 'scale', 'matrix'))
idx = {}
for n in PARENT:
    p = PARENT[n]; t = J[n] - (J[p] if p else 0)
    j['nodes'].append({'name': P + n, 'translation': t.tolist()}); idx[n] = len(j['nodes']) - 1
for n, p in PARENT.items():
    if p: j['nodes'][idx[p]].setdefault('children', []).append(idx[n])
j['nodes'].append({'name': 'Root', 'children': [idx['Hips']]}); root = len(j['nodes']) - 1
j['nodes'].append({'name': 'Armature', 'children': [mesh_node, root]}); arm = len(j['nodes']) - 1
ibm = np.stack([np.eye(4) for _ in names]); ibm[:, :3, 3] = -np.array([J[n] for n in names])
j['skins'] = [{'joints': [idx[n] for n in names], 'skeleton': root,
               'inverseBindMatrices': append(ibm.transpose(0, 2, 1).astype(np.float32).reshape(-1, 16), 'MAT4', 5126)}]
j['nodes'][mesh_node]['skin'] = 0
sc = j['scenes'][j.get('scene', 0)]; sc['nodes'] = [arm if i == mesh_node else i for i in sc['nodes']]
while len(b) % 4: b.append(0)
j['buffers'][0]['byteLength'] = len(b)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
with open(OUT, 'wb') as o:
    o.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(b)))
    o.write(struct.pack('<II', len(js), 0x4E4F534A)); o.write(js)
    o.write(struct.pack('<II', len(b), 0x004E4942)); o.write(bytes(b))
print('wrote', OUT, len(names), 'joints')
