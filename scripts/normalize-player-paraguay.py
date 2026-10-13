# Bake the Paraguayan player body into rig-import pose: front -> +Z, feet at y=0, height 1.65 m.
# Source front faces +X (see docs/asset-plan.md), so rotate -90 deg about Y: (x,y,z) -> (-z, y, x).
import json, struct, sys
src, dst, height = sys.argv[1], sys.argv[2], float(sys.argv[3])
f = open(src, 'rb').read()
jl = struct.unpack('<I', f[12:16])[0]
j = json.loads(f[20:20 + jl])
bin_start = 20 + jl + 8
data = bytearray(f[bin_start:])
prim = j['meshes'][0]['primitives'][0]
pa = j['accessors'][prim['attributes']['POSITION']]
s = height / (pa['max'][1] - pa['min'][1])
ty = -pa['min'][1]
def xform(acc_i, is_pos):
    a = j['accessors'][acc_i]; bv = j['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 12)
    lo, hi = [1e9] * 3, [-1e9] * 3
    for i in range(a['count']):
        o = off + i * stride
        x, y, z = struct.unpack_from('<3f', data, o)
        v = (-z * s, (y + ty) * s, x * s) if is_pos else (-z, y, x)
        struct.pack_into('<3f', data, o, *v)
        lo = [min(p, q) for p, q in zip(lo, v)]; hi = [max(p, q) for p, q in zip(hi, v)]
    a['min'], a['max'] = lo, hi
xform(prim['attributes']['POSITION'], True)
xform(prim['attributes']['NORMAL'], False)
js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(data))
out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(data), 0x004E4942) + data
open(dst, 'wb').write(out)
print('scale', s, 'min', j['accessors'][prim['attributes']['POSITION']]['min'], 'max', j['accessors'][prim['attributes']['POSITION']]['max'])
