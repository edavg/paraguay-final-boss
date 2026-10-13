# Retarget the approved player clips (V18 bundle, mixamorig skeleton) onto the Tripo-rigged
# Paraguayan player body, renaming the Tripo bones to the mixamorig names the game uses.
#   python3 scripts/retarget-player-paraguay.py SOURCE_V18.glb TRIPO_RIG.glb OUT.glb HEIGHT
# Conventions copied from the source so runtime code (sockets, cloth, foot plant) sees the same
# space: the rig faces +Z, feet at y=0, bones carry the source's world scale, and WeaponSocket /
# ShieldSocket follow the hands with the source's per-frame grip transforms.
# Each mapped bone keeps the source's world-space rotation delta from rest, after aligning the
# target rest bone direction to the source rest bone direction (handles A-pose vs T-pose rests).
import json, struct, sys
import numpy as np

SRC, TGT, OUT, HEIGHT = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])

# Tripo bone -> mixamorig name. Tripo's limb labels are mirrored: its "Right"/"Left" limb chains
# sit on the character's left/right (the body faces +X with its left side at -Z).
MAP = {
    'tripo::0_Right_Limb_0': 'Hips', 'tripo::0_Right_Limb_1': 'Spine', 'tripo::0_Right_Limb_2': 'Spine2',
    'tripo::Head_0': 'Neck', 'tripo::Head_1': 'Head',
    'tripo::Spine_0': 'LeftShoulder', 'tripo::Spine_1': 'LeftArm', 'bone_8': 'LeftForeArm', 'bone_9': 'LeftHand',
    'bone_10': 'LeftHandMiddle1', 'bone_11': 'LeftHandMiddle2', 'bone_12': 'LeftHandMiddle3',
    'tripo::0_Right_Limb_3': 'RightShoulder', 'tripo::0_Right_Limb_4': 'RightArm', 'tripo::0_Right_Limb_5': 'RightForeArm',
    'tripo::0_Right_Limb_7': 'RightHand', 'tripo::0_Right_Limb_8': 'RightHandMiddle1', 'tripo::0_Right_Limb_9': 'RightHandMiddle2',
    'tripo::1_Right_Limb_0': 'LeftUpLeg', 'tripo::1_Right_Limb_1': 'LeftLeg', 'tripo::1_Right_Limb_2': 'LeftFoot', 'tripo::1_Right_Limb_3': 'LeftToeBase',
    'tripo::0_Left_Limb_0': 'RightUpLeg', 'tripo::0_Left_Limb_1': 'RightLeg', 'tripo::0_Left_Limb_2': 'RightFoot', 'tripo::0_Left_Limb_3': 'RightToeBase',
}
# Child used for each bone's rest direction (same names on both rigs once mapped).
DIR_CHILD = {
    'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head',
    'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandMiddle1',
    'LeftHandMiddle1': 'LeftHandMiddle2', 'LeftHandMiddle2': 'LeftHandMiddle3',
    'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHandMiddle1',
    'RightHandMiddle1': 'RightHandMiddle2',
    'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase',
    'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase',
}
SOCKETS = {'WeaponSocket': 'RightHand', 'ShieldSocket': 'LeftHand'}
P = 'mixamorig:'

# ---------- glb io ----------
def read_glb(path):
    f = open(path, 'rb').read()
    jl = struct.unpack('<I', f[12:16])[0]
    j = json.loads(f[20:20 + jl])
    bl = struct.unpack('<I', f[20 + jl:24 + jl])[0]
    return j, bytearray(f[28 + jl:28 + jl + bl])

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def accessor(j, b, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NCOMP[a['type']]
    assert a['componentType'] == 5126 and bv.get('byteStride', n * 4) == n * 4
    return np.frombuffer(bytes(b), np.float32, a['count'] * n, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(a['count'], n).astype(np.float64)

def write_glb(path, j, b):
    while len(b) % 4: b.append(0)
    j['buffers'][0]['byteLength'] = len(b)
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(b)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(b), 0x004E4942)); f.write(bytes(b))

# ---------- math (quaternions x,y,z,w) ----------
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
                     aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz])
def qinv(q): return np.array([-q[0], -q[1], -q[2], q[3]])
def qnorm(q): return q / np.linalg.norm(q)
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
def mat_q(m):
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1) * 2; return qnorm(np.array([(m[2,1]-m[1,2])/s, (m[0,2]-m[2,0])/s, (m[1,0]-m[0,1])/s, s/4]))
    i = int(np.argmax(np.diag(m)))
    if i == 0:
        s = np.sqrt(1 + m[0,0] - m[1,1] - m[2,2]) * 2; return qnorm(np.array([s/4, (m[0,1]+m[1,0])/s, (m[0,2]+m[2,0])/s, (m[2,1]-m[1,2])/s]))
    if i == 1:
        s = np.sqrt(1 + m[1,1] - m[0,0] - m[2,2]) * 2; return qnorm(np.array([(m[0,1]+m[1,0])/s, s/4, (m[1,2]+m[2,1])/s, (m[0,2]-m[2,0])/s]))
    s = np.sqrt(1 + m[2,2] - m[0,0] - m[1,1]) * 2; return qnorm(np.array([(m[0,2]+m[2,0])/s, (m[1,2]+m[2,1])/s, s/4, (m[1,0]-m[0,1])/s]))
def arc(u, v):
    u = u / np.linalg.norm(u); v = v / np.linalg.norm(v); c = np.cross(u, v); d = np.dot(u, v)
    if d < -0.999999:
        ax = np.cross(u, [1, 0, 0]);
        if np.linalg.norm(ax) < 1e-6: ax = np.cross(u, [0, 1, 0])
        ax /= np.linalg.norm(ax); return np.array([*ax, 0.0])
    return qnorm(np.array([*c, 1 + d]))
def trs(t, r, s):
    m = np.eye(4); m[:3, :3] = qmat(r) * np.asarray(s); m[:3, 3] = t; return m
def node_trs(n):
    if 'matrix' in n: raise SystemExit('matrix nodes unsupported: ' + n.get('name', ''))
    return (np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float), np.array(n.get('scale', [1, 1, 1]), float))
def rot_of(m):
    r = m[:3, :3]; return mat_q(r / np.linalg.norm(r, axis=0))
def slerp(a, b, t):
    d = np.dot(a, b)
    if d < 0: b = -b; d = -d
    if d > 0.9995: return qnorm(a + (b - a) * t)
    th = np.arccos(d); return (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)

def topo(j):
    par = {c: i for i, n in enumerate(j['nodes']) for c in n.get('children', [])}
    order, seen = [], set()
    def visit(i):
        if i in seen: return
        if i in par: visit(par[i])
        seen.add(i); order.append(i)
    for i in range(len(j['nodes'])): visit(i)
    return par, order

# ---------- source ----------
sj, sb = read_glb(SRC)
spar, sorder = topo(sj)
sname = {n['name']: i for i, n in enumerate(sj['nodes'])}
srest = [node_trs(n) for n in sj['nodes']]
def fk(j, par, order, local):
    W = [None] * len(j['nodes'])
    for i in order: W[i] = (W[par[i]] if i in par else np.eye(4)) @ trs(*local[i])
    return W
SW0 = fk(sj, spar, sorder, srest)

# ---------- target: rename, insert Spine1, reparent, rescale, sockets ----------
tj, tb = read_glb(TGT)
tname = {n['name']: i for i, n in enumerate(tj['nodes'])}
# A rig already named mixamorig (scripts/rig-boss-man.py) skips the Tripo renames.
for tripo, mix in MAP.items():
    if tripo in tname: tj['nodes'][tname[tripo]]['name'] = P + mix
tname = {n['name']: i for i, n in enumerate(tj['nodes'])}
tpar, _ = topo(tj)
skin = tj['skins'][0]
ibm_acc = skin['inverseBindMatrices']
ibm = accessor(tj, tb, ibm_acc).reshape(-1, 4, 4).transpose(0, 2, 1)  # column-major -> row matrices
arm = tname['Armature']; hips = tname[P + 'Hips']; troot = tpar[hips]

# Rest world (Armature as authored), used only to validate and to reparent.
trest = [node_trs(n) for n in tj['nodes']]
_, torder = topo(tj)
TW0 = fk(tj, tpar, torder, trest)
# The rest pose must equal the bind pose (joint world * IBM = identity: mesh space is world).
mesh_node = next(i for i, n in enumerate(tj['nodes']) if 'mesh' in n)
for k, ji in enumerate(skin['joints']):
    err = np.abs(TW0[ji] @ ibm[k] - np.eye(4)).max()
    assert err < 1e-3, f"rest pose differs from bind pose at {tj['nodes'][ji]['name']}: {err}"

# Reparent every other Root child under Hips so legs and skirt helpers ride the pelvis.
root_children = tj['nodes'][troot]['children']
for c in [c for c in root_children if c != hips]:
    local = np.linalg.inv(TW0[hips]) @ TW0[c]
    tj['nodes'][c]['translation'] = local[:3, 3].tolist(); tj['nodes'][c]['rotation'] = rot_of(local).tolist()
    tj['nodes'][c].pop('scale', None)
    tj['nodes'][hips].setdefault('children', []).append(c)
tj['nodes'][troot]['children'] = [hips]

# Spine1: an unweighted joint halfway between Spine and Spine2 (the source spine has three links).
spine, spine2 = tname[P + 'Spine'], tname[P + 'Spine2']
half = np.array(tj['nodes'][spine2].get('translation', [0, 0, 0])) / 2
tj['nodes'].append({'name': P + 'Spine1', 'translation': half.tolist(), 'children': [spine2]})
spine1 = len(tj['nodes']) - 1
tj['nodes'][spine2]['translation'] = half.tolist()
tj['nodes'][spine]['children'] = [spine1 if c == spine2 else c for c in tj['nodes'][spine]['children']]

# World placement: facing +Z (rotate -90 deg about Y), HEIGHT tall, feet on y=0 (mesh space is
# 0..1 high with feet at 0), and bones at the source's world scale so local offsets read in the
# same units: bone world' = bone world * diag(1/F), hence child translations * F.
src_arm_scale = np.linalg.norm(SW0[sname['Armature']][:3, 0])
F = HEIGHT / src_arm_scale
place = trs([0, 0, 0], np.array([0, -np.sin(np.pi / 4), 0, np.cos(np.pi / 4)]), [HEIGHT] * 3)
A = place @ trs(*trest[arm]) @ np.diag([1 / F, 1 / F, 1 / F, 1])
tj['nodes'][arm].update(translation=A[:3, 3].tolist(), rotation=rot_of(A).tolist(), scale=[src_arm_scale] * 3)
for i, n in enumerate(tj['nodes']):
    if i != arm and 'translation' in n and (i in tpar or i == spine1):
        n['translation'] = (np.array(n['translation']) * F).tolist()
# The mesh moves to the scene root with an identity transform (so glTF-spec viewers and three.js
# agree) and the IBMs are rebuilt from the new rest pose: joint world * IBM = place.
tj['nodes'][arm]['children'] = [c for c in tj['nodes'][arm]['children'] if c != mesh_node]
tj['scenes'][tj.get('scene', 0)]['nodes'].append(mesh_node)
for sock, hand in SOCKETS.items():
    rest_scale = np.linalg.norm(SW0[sname[sock]][:3, 0]) / src_arm_scale  # hand world scale is the Armature's
    tj['nodes'].append({'name': sock, 'scale': [rest_scale] * 3}); tj['nodes'][tname[P + hand]].setdefault('children', []).append(len(tj['nodes']) - 1)
tname = {n['name']: i for i, n in enumerate(tj['nodes'])}
tpar, torder = topo(tj)
trest = [node_trs(n) for n in tj['nodes']]
TW0 = fk(tj, tpar, torder, trest)
new_ibm = np.array([np.linalg.inv(TW0[ji]) @ place for ji in skin['joints']])
a = tj['accessors'][ibm_acc]; bv = tj['bufferViews'][a['bufferView']]
off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
tb[off:off + new_ibm.size * 4] = new_ibm.transpose(0, 2, 1).astype(np.float32).tobytes()

# ---------- rest alignment ----------
def wpos(W, i): return W[i][:3, 3]
mapped = list(dict.fromkeys(['Spine1'] + list(MAP.values())))
C = {}
for m in mapped:
    c = DIR_CHILD.get(m)
    if c and P + c in sname and P + c in tname:
        C[m] = arc(wpos(TW0, tname[P + c]) - wpos(TW0, tname[P + m]),
                   wpos(SW0, sname[P + c]) - wpos(SW0, sname[P + m]))
# Bones without a direction child inherit their parent's alignment.
for m in mapped:
    if m not in C:
        p = tpar.get(tname[P + m])
        while p is not None and tj['nodes'][p]['name'].replace(P, '') not in C: p = tpar.get(p)
        C[m] = C[tj['nodes'][p]['name'].replace(P, '')] if p is not None else np.array([0, 0, 0, 1.0])
# Hips yaw is set by the facing convention, not by the spine direction alone.
C['Hips'] = np.array([0, 0, 0, 1.0])
RWs = {m: rot_of(SW0[sname[P + m]]) for m in mapped}
RWt = {m: rot_of(TW0[tname[P + m]]) for m in mapped}
leg = lambda W, names: wpos(W, names[P + 'LeftUpLeg'])[1]
K = leg(TW0, tname) / leg(SW0, sname)
print(f'height {HEIGHT} m, leg ratio {K:.3f}, F {F:.2f}')

# ---------- sampling ----------
def sampler_values(j, b, an, ch):
    s = an['samplers'][ch['sampler']]
    return accessor(j, b, s['input'])[:, 0], accessor(j, b, s['output']), s.get('interpolation', 'LINEAR')
def sample(times, vals, interp, t, is_rot):
    if t <= times[0]: return vals[0]
    if t >= times[-1]: return vals[-1]
    i = int(np.searchsorted(times, t) - 1)
    if interp == 'STEP': return vals[i]
    u = (t - times[i]) / (times[i + 1] - times[i])
    return slerp(vals[i], vals[i + 1], u) if is_rot else vals[i] + (vals[i + 1] - vals[i]) * u

anims_out = []
blob = bytearray()
def add_accessor(arr, typ, minmax=False):
    global blob
    while len(blob) % 4: blob.append(0)
    off = len(blob); data = np.asarray(arr, np.float32); blob += data.tobytes()
    tj['bufferViews'].append({'buffer': 0, 'byteOffset': len(tb) + off, 'byteLength': data.nbytes})
    acc = {'bufferView': len(tj['bufferViews']) - 1, 'componentType': 5126, 'count': len(data), 'type': typ}
    if minmax: acc['min'] = data.min(0).tolist(); acc['max'] = data.max(0).tolist()
    tj['accessors'].append(acc); return len(tj['accessors']) - 1
while len(tb) % 4: tb.append(0)

hips_rest_s = wpos(SW0, sname[P + 'Hips']); hips_rest_t = wpos(TW0, tname[P + 'Hips'])
for an in sj['animations']:
    chans = {}
    for ch in an['channels']:
        chans[(ch['target']['node'], ch['target']['path'])] = sampler_values(sj, sb, an, ch)
    main = max((sampler_values(sj, sb, an, ch)[0] for ch in an['channels']), key=len)
    tracks = {}
    for t in main:
        local = []
        for i, n in enumerate(sj['nodes']):
            tr, r, s = srest[i]
            if (i, 'translation') in chans: tr = sample(*chans[(i, 'translation')], t, False)
            if (i, 'rotation') in chans: r = qnorm(sample(*chans[(i, 'rotation')], t, True))
            if (i, 'scale') in chans: s = sample(*chans[(i, 'scale')], t, False)
            local.append((tr, r, s))
        SW = fk(sj, spar, sorder, local)
        TW = [None] * len(tj['nodes'])
        for i in torder:
            n = tj['nodes'][i]; nm = n.get('name', '').replace(P, '')
            parent = TW[tpar[i]] if i in tpar else np.eye(4)
            tr, r, s = trest[i]
            if nm in RWs:
                q = qmul(qmul(qmul(rot_of(SW[sname[P + nm]]), qinv(RWs[nm])), C[nm]), RWt[nm])
                r = qnorm(qmul(qinv(rot_of(parent)), q))
                if nm == 'Hips':
                    want = hips_rest_t + K * (wpos(SW, sname[P + 'Hips']) - hips_rest_s)
                    tr = (np.linalg.inv(parent) @ np.append(want, 1))[:3]
                tracks.setdefault((i, 'rotation'), []).append(r)
                if nm == 'Hips': tracks.setdefault((i, 'translation'), []).append(tr)
            elif nm in SOCKETS:
                hand_s, sock_s = sname[P + SOCKETS[nm]], sname[nm]
                want = parent[:3, 3] + (wpos(SW, sock_s) - wpos(SW, hand_s))
                tr = (np.linalg.inv(parent) @ np.append(want, 1))[:3]
                r = qnorm(qmul(qinv(rot_of(parent)), rot_of(SW[sock_s])))
                # The source sockets carry world scale ~1 (props are sized in metres under them).
                s = np.full(3, np.linalg.norm(SW[sock_s][:3, 0]) / np.linalg.norm(parent[:3, 0]))
                tracks.setdefault((i, 'rotation'), []).append(r); tracks.setdefault((i, 'translation'), []).append(tr)
                tracks.setdefault((i, 'scale'), []).append(s)
            TW[i] = parent @ trs(tr, r, s)
    tin = add_accessor(main.reshape(-1, 1), 'SCALAR', True)
    samplers, channels = [], []
    for (node, path), vals in tracks.items():
        vals = np.array(vals)
        if path == 'rotation':  # keep quaternion signs continuous for linear interpolation
            for k in range(1, len(vals)):
                if np.dot(vals[k], vals[k - 1]) < 0: vals[k] = -vals[k]
        samplers.append({'input': tin, 'output': add_accessor(vals, 'VEC4' if path == 'rotation' else 'VEC3'), 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': node, 'path': path}})
    anims_out.append({'name': an['name'], 'samplers': samplers, 'channels': channels})
    print(f"  {an['name']:20s} {len(main)} keys")

tj['animations'] = anims_out
tb += blob
write_glb(OUT, tj, tb)
json.dump({'legRatio': K, 'height': HEIGHT}, open(OUT + '.retarget.json', 'w'))
print('wrote', OUT)
