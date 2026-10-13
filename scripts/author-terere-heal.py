# Author the Paraguayan player's heal: she sips tereré from a guampa instead of a potion.
#   python3 scripts/author-terere-heal.py RIG_IN.glb MANIFEST_IN.json RIG_OUT.glb MANIFEST_OUT.json
# The retained V18 heal barely moved. This replaces it with a keyed clip built on the guard idle:
# the left hand (its shield goes onto the forearm strap at runtime, src/game/actors.js) raises the
# guampa to her mouth by two-bone IK, the fingers close round it, the head dips to the bombilla for
# three sips, and the arm lowers back into the guard. Same 1.4 s and heal point as before, so the
# fight's timing is unchanged.
# The guampa itself is code (src/game/guampa.js); its frame - origin at the cup's centre, +Y up the
# cup, the bombilla leaning toward -Z to a tip at GUAMPA_TIP - must match the constants below. The
# manifest gets the guampa's transform in the LeftHand bone, solved so the bombilla tip is at the
# mouth while she sips, and the window in which it is in her hand.
import json, struct, sys, hashlib
import numpy as np

RIG_IN, MAN_IN, RIG_OUT, MAN_OUT = sys.argv[1:5]
DURATION, FPS = 1.4, 30
RAISE, LOWER = (0.06, 0.44), (1.02, 1.36)          # arm up / arm down (s)
SIPS = (0.55, 0.75, 0.93)                           # bombilla pulls (s)
GUAMPA_TIP = np.array([0.0, 0.123, -0.050])         # bombilla tip in the guampa frame (m), see guampa.js
SHOW = (0.1, 1.3)                                   # guampa in hand (s)
P = 'mixamorig:'

# ---------- glb + math ----------
f = open(RIG_IN, 'rb').read()
jl = struct.unpack('<I', f[12:16])[0]
j = json.loads(f[20:20 + jl])
b = bytearray(f[28 + jl:28 + jl + struct.unpack('<I', f[20 + jl:24 + jl])[0]])
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NC[a['type']]
    return np.frombuffer(b, np.float32, a['count'] * n, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(a['count'], n).astype(float)
def add_acc(arr, typ, minmax=False):
    while len(b) % 4: b.append(0)
    data = np.ascontiguousarray(arr, np.float32); off = len(b); b.extend(data.tobytes())
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': data.nbytes})
    a = {'bufferView': len(j['bufferViews']) - 1, 'componentType': 5126, 'count': len(data), 'type': typ}
    if minmax: a['min'] = data.min(0).tolist(); a['max'] = data.max(0).tolist()
    j['accessors'].append(a); return len(j['accessors']) - 1

def qmul(a, c):
    ax, ay, az, aw = a; bx, by, bz, bw = c
    return np.array([aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz])
def qinv(q): return np.array([-q[0], -q[1], -q[2], q[3]])
def qn(q): return q / np.linalg.norm(q)
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
def mq(m):
    m = m / np.linalg.norm(m, axis=0); t = np.trace(m)
    if t > 0: s = np.sqrt(t + 1) * 2; return qn(np.array([(m[2,1]-m[1,2])/s, (m[0,2]-m[2,0])/s, (m[1,0]-m[0,1])/s, s/4]))
    i = int(np.argmax(np.diag(m)))
    if i == 0: s = np.sqrt(1 + m[0,0] - m[1,1] - m[2,2]) * 2; return qn(np.array([s/4, (m[0,1]+m[1,0])/s, (m[0,2]+m[2,0])/s, (m[2,1]-m[1,2])/s]))
    if i == 1: s = np.sqrt(1 + m[1,1] - m[0,0] - m[2,2]) * 2; return qn(np.array([(m[0,1]+m[1,0])/s, s/4, (m[1,2]+m[2,1])/s, (m[0,2]-m[2,0])/s]))
    s = np.sqrt(1 + m[2,2] - m[0,0] - m[1,1]) * 2; return qn(np.array([(m[0,2]+m[2,0])/s, (m[1,2]+m[2,1])/s, s/4, (m[1,0]-m[0,1])/s]))
def arc(u, v):
    u = u / np.linalg.norm(u); v = v / np.linalg.norm(v); c = np.cross(u, v); d = np.dot(u, v)
    if d < -0.99999: ax = np.cross(u, [1, 0, 0]); ax /= np.linalg.norm(ax); return np.array([*ax, 0.0])
    return qn(np.array([*c, 1 + d]))
def axis_angle(axis, ang):
    axis = axis / np.linalg.norm(axis); return np.array([*(axis * np.sin(ang / 2)), np.cos(ang / 2)])
def slerp(a, c, t):
    d = np.dot(a, c)
    if d < 0: c = -c; d = -d
    if d > 0.9995: return qn(a + (c - a) * t)
    th = np.arccos(d); return (np.sin((1 - t) * th) * a + np.sin(t * th) * c) / np.sin(th)
def trs(t, r, s):
    m = np.eye(4); m[:3, :3] = qmat(r) * np.asarray(s); m[:3, 3] = t; return m
def smooth(a, c, x):
    x = np.clip((x - a) / (c - a), 0, 1); return x * x * (3 - 2 * x)
def frame(x, y):  # rotation whose columns are (x, y, x cross y) after orthonormalising y against x
    x = x / np.linalg.norm(x); y = y - x * np.dot(x, y); y /= np.linalg.norm(y); return np.column_stack([x, y, np.cross(x, y)])

nodes = j['nodes']
par = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
order, seen = [], set()
def visit(i):
    if i in seen: return
    if i in par: visit(par[i])
    seen.add(i); order.append(i)
for i in range(len(nodes)): visit(i)
name = {n.get('name'): i for i, n in enumerate(nodes)}
rest = [(np.array(n.get('translation', [0, 0, 0.0])), np.array(n.get('rotation', [0, 0, 0, 1.0])), np.array(n.get('scale', [1, 1, 1.0]))) for n in nodes]
def fk(local):
    W = [None] * len(nodes)
    for i in order: W[i] = (W[par[i]] if i in par else np.eye(4)) @ trs(*local[i])
    return W
pos = lambda W, n: W[name[n]][:3, 3]
rot = lambda W, n: mq(W[name[n]][:3, :3])

# Rest frames: the rig faces +Z with its left at +X.
W0 = fk(rest)
head_fwd_l = qmat(qinv(rot(W0, P + 'Head'))) @ np.array([0, 0, 1.0])
head_up_l = qmat(qinv(rot(W0, P + 'Head'))) @ np.array([0, 1.0, 0])
# The lips, measured on the mesh's face profile at rest (reddish vertices at 1.60 m, 15 cm forward).
mouth_l = qmat(qinv(rot(W0, P + 'Head'))) @ (np.array([0.0, 1.60, 0.15]) - pos(W0, P + 'Head'))
hand_q0 = rot(W0, P + 'LeftHand')
finger_l = qmat(qinv(hand_q0)) @ (pos(W0, P + 'LeftHandMiddle1') - pos(W0, P + 'LeftHand'))
palm_l = qmat(qinv(hand_q0)) @ np.array([-1.0, -0.3, 0])  # A-pose left palm faces in and down

# ---------- idle as the base ----------
idle = next(a for a in j['animations'] if a['name'] == 'idle')
chans = {}
for ch in idle['channels']:
    s = idle['samplers'][ch['sampler']]
    chans[(ch['target']['node'], ch['target']['path'])] = (acc(s['input'])[:, 0], acc(s['output']), s.get('interpolation', 'LINEAR'))
idle_len = max(v[0][-1] for v in chans.values())
def sample(key, t, is_rot):
    T, V, mode = chans[key]
    t = t % T[-1] if T[-1] > 0 else 0
    k = int(np.clip(np.searchsorted(T, t) - 1, 0, len(T) - 1))
    if mode == 'STEP' or k == len(T) - 1: return V[k]
    u = (t - T[k]) / (T[k + 1] - T[k])
    return slerp(V[k], V[k + 1], u) if is_rot else V[k] + (V[k + 1] - V[k]) * u
def idle_local(t):
    local = list(rest)
    for (i, path), _ in chans.items():
        tr, r, s = local[i]
        if path == 'rotation': r = qn(sample((i, path), t, True))
        elif path == 'translation': tr = sample((i, path), t, False)
        elif path == 'scale': s = sample((i, path), t, False)
        local[i] = (tr, r, s)
    return local

def set_world_rot(local, W, n, q):
    i = name[n]; parent = W[par[i]]
    tr, _, s = local[i]
    local[i] = (tr, qn(qmul(qinv(mq(parent[:3, :3])), q)), s)

def solve(t, record=None):
    """The heal pose at time t: idle breathing with the drink layered on top."""
    local = idle_local(t * 0.5)
    w = smooth(*RAISE, t) * (1 - smooth(*LOWER, t))
    sip = sum(np.exp(-((t - s) / 0.05) ** 2) for s in SIPS) * w
    W = fk(local)
    # The guard looks at the floor (in game the gaze lock lifts it; it lets go for the heal), so
    # she straightens to drink: chest, neck and head share the turn that brings her gaze to just
    # below level, dipping a little more toward the bombilla on each pull.
    fwd0 = qmat(rot(W, P + 'Head')) @ head_fwd_l
    flat0 = fwd0 - np.array([0, 1.0, 0]) * fwd0[1]; flat0 /= np.linalg.norm(flat0)
    pitch = -np.radians(8 + 4 * sip / max(w, 1e-6) if w > 0 else 8)
    lift = arc(fwd0, flat0 * np.cos(pitch) + np.array([0, 1.0, 0]) * np.sin(pitch))
    for n, share in ((P + 'Spine2', .3), (P + 'Neck', .3), (P + 'Head', .4)):
        set_world_rot(local, W, n, qmul(slerp(np.array([0, 0, 0, 1.0]), lift, share * w), rot(W, n))); W = fk(local)
    hq = rot(W, P + 'Head')
    fwd, up = qmat(hq) @ head_fwd_l, qmat(hq) @ head_up_l
    mouth = pos(W, P + 'Head') + qmat(hq) @ mouth_l
    flat = fwd - up * np.dot(fwd, up); flat /= np.linalg.norm(flat)
    left = np.cross(up, flat); left /= np.linalg.norm(left)  # her left (+X when facing +Z)
    # The guampa: tilted back toward her, bombilla tip on the lips (pulled 1 cm in on a sip).
    cup_y = up * 1.0 - flat * 0.22; cup_y /= np.linalg.norm(cup_y)
    cup_z = flat - cup_y * np.dot(flat, cup_y); cup_z /= np.linalg.norm(cup_z)
    cup_R = np.column_stack([np.cross(cup_y, cup_z), cup_y, cup_z])
    cup = mouth + flat * (0.01 * (1 - sip)) - cup_R @ GUAMPA_TIP
    # Grip: the hand on the cup's left, fingers forward round it, palm toward the cup.
    wrist = cup + left * 0.045 - flat * 0.055 - cup_y * 0.01
    finger_d, palm_d = flat - left * 0.25, -left
    hand_target = mq(frame(finger_d, palm_d) @ frame(finger_l, palm_l).T)
    # Two-bone IK for LeftArm -> LeftForeArm -> LeftHand, elbow down and out.
    S, E, H = pos(W, P + 'LeftArm'), pos(W, P + 'LeftForeArm'), pos(W, P + 'LeftHand')
    a, c = np.linalg.norm(E - S), np.linalg.norm(H - E)
    to = wrist - S; d = np.clip(np.linalg.norm(to), abs(a - c) + 1e-3, a + c - 1e-3); to_n = to / np.linalg.norm(to)
    pole = -up * 1.0 + left * 0.7 + flat * 0.25
    pole = pole - to_n * np.dot(pole, to_n); pole /= np.linalg.norm(pole)
    x = (a * a - c * c + d * d) / (2 * d); h = np.sqrt(max(a * a - x * x, 0))
    elbow = S + to_n * x + pole * h
    reach = S + to_n * d
    ik = {}
    ik['LeftArm'] = qmul(arc(E - S, elbow - S), rot(W, P + 'LeftArm'))
    fore_rest = qmul(arc(E - S, elbow - S), rot(W, P + 'LeftForeArm'))
    fore_dir = qmat(fore_rest) @ (qmat(qinv(rot(W, P + 'LeftForeArm'))) @ (H - E))
    ik['LeftForeArm'] = qmul(arc(fore_dir, reach - elbow), fore_rest)
    ik['LeftHand'] = hand_target
    for n in ('LeftArm', 'LeftForeArm', 'LeftHand'):
        set_world_rot(local, W, P + n, slerp(rot(W, P + n), ik[n], w)); W = fk(local)
    # Fingers close round the cup.
    hq = rot(W, P + 'LeftHand'); curl_axis = qmat(hq) @ np.cross(finger_l, palm_l)
    for k, n in enumerate(('LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3')):
        if P + n not in name: continue
        set_world_rot(local, W, P + n, qmul(axis_angle(curl_axis, np.radians(35 + 10 * k) * w), rot(W, P + n))); W = fk(local)
    if record is not None:
        record.update(W=W, cup=cup, cup_R=cup_R, mouth=mouth)
    return local

# ---------- write the clip ----------
times = np.arange(0, DURATION + 1e-6, 1 / FPS)
poses = [solve(t) for t in times]
animated = sorted({i for (i, _) in chans})
tin = add_acc(times.reshape(-1, 1), 'SCALAR', True)
samplers, channels = [], []
for i in animated:
    for path, k in (('rotation', 1), ('translation', 0), ('scale', 2)):
        if (i, path) not in chans and not (path == 'rotation' and i in {name[P + n] for n in ('Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand')}): continue
        vals = np.array([p[i][k] for p in poses])
        if path == 'rotation':
            for r in range(1, len(vals)):
                if np.dot(vals[r], vals[r - 1]) < 0: vals[r] = -vals[r]
        samplers.append({'input': tin, 'output': add_acc(vals, 'VEC4' if path == 'rotation' else 'VEC3'), 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': i, 'path': path}})
heal = next(a for a in j['animations'] if a['name'] == 'heal')
heal['samplers'], heal['channels'] = samplers, channels

# The guampa in the hand, from the middle of the sip.
probe = {}; solve(0.75, probe)
hand_W = probe['W'][name[P + 'LeftHand']]
cup_W = np.eye(4); cup_W[:3, :3] = probe['cup_R']; cup_W[:3, 3] = probe['cup']
local = np.linalg.inv(hand_W) @ cup_W
scale = float(np.linalg.norm(local[:3, 0]))

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
m['revision'] = 'paraguay-v3-terere-heal-2026-10-12'
idle_meta = m['clips']['idle']
m['clips']['heal'] = {'duration': DURATION, 'blendIn': 0.16, 'facingYawDegrees': idle_meta.get('facingYawDegrees', 0),
    'source': 'scripts/author-terere-heal.py: guard idle + left-arm IK to the mouth, head dip and three sips',
    'sips': list(SIPS), 'guampa': {'bone': 'mixamorigLeftHand', 'position': local[:3, 3].tolist(),
    'quaternion': mq(local[:3, :3]).tolist(), 'scale': scale, 'show': list(SHOW)}}
json.dump(m, open(MAN_OUT, 'w'), indent=1)
print('mouth', np.round(probe['mouth'], 3), 'cup', np.round(probe['cup'], 3), 'hand', np.round(hand_W[:3, 3], 3), 'guampa scale in hand', round(scale, 2))
