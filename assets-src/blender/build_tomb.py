# Builds the burial chamber, the booth and DJ MONOLITH as low-poly meshes and writes public/models/tomb.glb.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python assets-src/blender/build_tomb.py -- public/models/tomb.glb
#
# The look is a 1996 console adventure: rooms made of two-metre blocks with one small picture per face,
# light baked into the vertices, characters made of rigid pieces. Everything that moves on the page (every
# knob, fader, platter, tonearm, arm segment, flame, woofer) is its own object with its pivot where it
# turns. Run `node scripts/textures.mjs` first: it makes the texture sheet and says where things are on it.
import bpy
import bmesh
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # this file is in assets-src/blender, two folders down
sys.path.insert(0, HERE)
from kit import *  # noqa: E402,F403
from mathutils import Vector, Matrix  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

TEX = os.path.join(HERE, 'tex')
ATLAS = json.load(open(os.path.join(TEX, 'atlas.json')))
LAY = json.load(open(os.path.join(ROOT, 'src', 'dj', 'layout.json')))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(ROOT, 'public', 'models', 'tomb.glb'))
random.seed(1996)

SKIN = 0x5d92e6
NAVY = 0x1c2a4f
INK = 0x10162b
GOLD = 0xd9a441
WHITE = 0xe6e1d6
LEATHER = 0x7b4a27
LEATHER_DARK = 0x54301a
RUBBER = 0x1a1d26
SHELL = 0xd8d3c9
STEEL = 0xc9ced6
BLACK = 0x17181d
STONE = 0xa98f6a
STONE_DARK = 0x5a4a38
SHEET = ('env', 'prop', 'cutout', 'glow')  # materials that read the texture sheet

OBJECTS = []


def obj(name, geo, pivot=None, parent=None, occluders=(), **extras):
    OBJECTS.append({'name': name, 'geo': geo, 'pivot': Vector(pivot) if pivot is not None else geo.centre(), 'parent': parent, 'extras': extras, 'occluders': occluders})


def group(name, pivot=(0, 0, 0), parent=None, **extras):
    OBJECTS.append({'name': name, 'geo': None, 'pivot': Vector(pivot), 'parent': parent, 'extras': extras, 'occluders': ()})


def basis(x, y, z):
    return Matrix(((x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1)))


# ── where a picture is on the sheet ──────────────────────────────────────────
def uv(name, sub=(0, 0, 1, 1), flip=False, rot=0):
    """Corner UVs (bottom-left, bottom-right, top-right, top-left) of a picture, or of part of it."""
    a = ATLAS['labels'][name]
    W, H = ATLAS['w'], ATLAS['h']
    e = 0.06
    x0, x1 = a['x'] + e + (a['w'] - 2 * e) * sub[0], a['x'] + e + (a['w'] - 2 * e) * sub[2]
    y0, y1 = a['y'] + a['h'] - e - (a['h'] - 2 * e) * sub[1], a['y'] + a['h'] - e - (a['h'] - 2 * e) * sub[3]
    out = [(x0 / W, 1 - y0 / H), (x1 / W, 1 - y0 / H), (x1 / W, 1 - y1 / H), (x0 / W, 1 - y1 / H)]
    if flip:
        out = [out[1], out[0], out[3], out[2]]
    for _ in range(rot):
        out = out[1:] + out[:1]
    return out


def face(p0, right, up, w, h, name, **kw):
    """A flat picture: bottom-left corner p0, w along `right`, h along `up`. It faces right x up."""
    p0, right, up = Vector(p0), Vector(right), Vector(up)
    return [p0, p0 + right * w, p0 + right * w + up * h, p0 + up * h], [(0, 1, 2, 3)], [uv(name, **kw)]


def top(w, d, name, **kw):
    """A picture lying flat, drawn the way the DJ reads it: their left (+x) is its left, far (+z) is its top."""
    return [(w / 2, 0, -d / 2), (-w / 2, 0, -d / 2), (-w / 2, 0, d / 2), (w / 2, 0, d / 2)], [(0, 1, 2, 3)], [uv(name, **kw)]


FLAT = RY(math.pi) @ RX(-math.pi / 2)  # lays one of kit's discs down the same way round


def texbox(w, h, d, default=None, **faces):
    """A box with a picture on some faces: front (+z), back, right (+x), left, top, bottom."""
    v, f = box(w, h, d)
    order = ('front', 'back', 'right', 'left', 'top', 'bottom')
    uvs = []
    for k in order:
        n = faces.get(k, default)
        uvs.append(uv(n) if isinstance(n, str) else (n if n else None))
    return v, f, uvs


def lathe_tex(profile, segs, name, every=1):
    """A lathe whose every quad carries the whole picture (or 1/every of its width)."""
    v, f = lathe(profile, segs)
    uvs = []
    for i, fc in enumerate(f):
        if len(fc) == 4:
            k = (i % segs) % every
            uvs.append(uv(name, sub=(k / every, 0, (k + 1) / every, 1)))
        else:
            q = uv(name)
            uvs.append([q[0], q[1], q[2]])
    return v, f, uvs


# ════════════════════════════════════════════════════════════════════════════
# The chamber: x from -8 to 8, z from -5 (the wall behind the DJ) to 13 (the door), eight metres high
# ════════════════════════════════════════════════════════════════════════════
X0, X1, Z0, Z1, HI = -8, 8, -5, 13, 8
STEP = 3.0  # the dance floor starts here, half a metre down
PIT = -0.5
# fire: (x, y, z, strength, reach). The first six are on the walls, the last two stand by the booth.
# where the big things stand. Everything tall is kept out of the middle of the room, so that no camera
# ever has a column or a loudspeaker between it and the booth.
PILLARS = [(6.7, -3.2, 0.0), (6.7, 4.6, -0.5), (6.7, 9.6, -0.5)]  # (x, z, the floor it stands on); mirrored
SPEAKER = (5.1, -3.55, 0.2)  # x, z, and how far it is turned in: against the wall behind him, either side of the painting; mirrored
BRAZIER = (5.7, 2.35)  # at the front corners of the dais; mirrored
FIRES = [(-3.9, 3.5, -4.6, 1.15, 3.2), (3.9, 3.5, -4.6, 1.15, 3.2), (-7.6, 3.3, 1.2, 0.95, 3.0), (7.6, 3.3, 1.2, 0.95, 3.0), (-7.6, 3.3, 7.1, 0.95, 3.0), (7.6, 3.3, 7.1, 0.95, 3.0), (-BRAZIER[0], 1.5, BRAZIER[1], 0.7, 2.6), (BRAZIER[0], 1.5, BRAZIER[1], 0.7, 2.6)]

tomb = Geo()


def wall(p0, right, up, nx, ny, pick, size=2.0, mat='env'):
    p0, right, up = Vector(p0), Vector(right), Vector(up)
    for j in range(ny):
        for i in range(nx):
            name, kw = pick(i, j)
            if name:
                tomb.add(face(p0 + right * (i * size) + up * (j * size), right, up, size, size, name, **kw), mat, 0xffffff, smooth=False)


def stones(i, j, band=None):
    r = random.random()
    if band is not None and j == band:
        return 'wall_glyph', {'flip': r < 0.5}
    return ('wall_cracked' if r < 0.22 else 'wall_block'), {'flip': random.random() < 0.5}


# floors
for i in range(8):
    for k in range(4):  # the dais
        tomb.add(face((X0 + i * 2, 0, Z0 + k * 2 + 2), (1, 0, 0), (0, 0, -1), 2, 2, 'floor', rot=random.randrange(4)), 'env', 0xffffff, smooth=False)
    for k in range(5):  # the dance floor: sand in the middle, flagstones along the walls
        sandy = 1 <= i <= 6
        tomb.add(face((X0 + i * 2, PIT, STEP + k * 2 + 2), (1, 0, 0), (0, 0, -1), 2, 2, 'sand' if sandy else 'floor', rot=random.randrange(4)), 'env', 0xffffff, smooth=False)
    # one step down, faced with gold
    tomb.add(face((X0 + i * 2, PIT, STEP), (1, 0, 0), (0, 1, 0), 2, -PIT, 'wall_block', sub=(0, 0.5, 1, 0.75)), 'env', 0xffffff, smooth=False)
# walls: behind the DJ, the two long sides (with a band of writing at head height), the far end round the door
wall((X0, 0, Z0), (1, 0, 0), (0, 1, 0), 8, 4, lambda i, j: stones(i, j))
wall((X0, 0, Z1), (0, 0, -1), (0, 1, 0), 9, 4, lambda i, j: stones(i, j, 1))
wall((X1, 0, Z0), (0, 0, 1), (0, 1, 0), 9, 4, lambda i, j: stones(i, j, 1))
wall((X1, 0, Z1), (-1, 0, 0), (0, 1, 0), 8, 4, lambda i, j: (None, {}) if (3 <= i <= 4 and j <= 2) else stones(i, j))
# the skirting below the dais level, down in the pit
for i in range(5):
    tomb.add(face((X0, PIT, STEP + i * 2 + 2), (0, 0, -1), (0, 1, 0), 2, -PIT, 'wall_block', sub=(0, 0, 1, 0.25)), 'env', 0xffffff, smooth=False)
    tomb.add(face((X1, PIT, STEP + i * 2), (0, 0, 1), (0, 1, 0), 2, -PIT, 'wall_block', sub=(0, 0, 1, 0.25)), 'env', 0xffffff, smooth=False)
for i in range(8):
    if not 3 <= i <= 4:
        tomb.add(face((X1 - i * 2, PIT, Z1), (-1, 0, 0), (0, 1, 0), 2, -PIT, 'wall_block', sub=(0, 0, 1, 0.25)), 'env', 0xffffff, smooth=False)
# the door at the far end: four metres wide, six and a half high, sealed
tomb.add(face((2, PIT, Z1), (-1, 0, 0), (0, 1, 0), 4, 6.5, 'door'), 'env', 0xffffff, smooth=False)
# ceiling
wall((X0, HI, Z0), (1, 0, 0), (0, 0, 1), 8, 9, lambda i, j: ('wall_block', {'rot': random.randrange(4)}))
# the painting behind the booth, on a slab that stands a little proud of the wall
tomb.add(face((-3.3, 2.5, Z0 + 0.135), (1, 0, 0), (0, 1, 0), 6.6, 4.4, 'mural'), 'env', 0xffffff, smooth=False)
tomb.add(box(7.0, 4.8, 0.12), 'env', STONE_DARK, smooth=False, m=T(0, 4.7, Z0 + 0.06), uvs=[uv('wall_block', sub=(0, 0, 1, 0.1))] * 6)
# flyers, pasted up where people come in
for (x, y, z, ry, tilt) in ((X1 - 0.03, 1.5, 10.2, -math.pi / 2, 0.06), (X1 - 0.03, 1.3, 11.2, -math.pi / 2, -0.09), (X0 + 0.03, 1.4, 9.4, math.pi / 2, -0.05), (X0 + 0.03, 2.9, 9.9, math.pi / 2, 0.1)):
    tomb.add(quad(0.8, 1.2, uv('flyer')), 'env', 0xffffff, smooth=False, m=T(x, y, z) @ RY(ry) @ RZ(tilt))


def pillar(x, z, base=0.0):
    r = 0.62
    h = HI - base
    tomb.add(texbox(1.7, 0.5, 1.7, default=uv('wall_block', sub=(0, 0, 1, 0.5))), 'env', 0xffffff, smooth=False, m=T(x, base + 0.25, z))
    tomb.add(texbox(1.8, 0.6, 1.8, default=uv('wall_block', sub=(0, 0.5, 1, 1))), 'env', 0xffffff, smooth=False, m=T(x, HI - 0.3, z))
    n = 8
    for i in range(n):
        a0, a1 = TAU * i / n, TAU * (i + 1) / n
        p0 = Vector((math.sin(a0) * r, 0, math.cos(a0) * r))
        p1 = Vector((math.sin(a1) * r, 0, math.cos(a1) * r))
        k = i % 4
        q = uv('pillar', sub=(k / 4, 0, (k + 1) / 4, 1))
        tomb.add(([p0 + Vector((x, base + 0.5, z)), p1 + Vector((x, base + 0.5, z)), p1 + Vector((x, HI - 0.6, z)), p0 + Vector((x, HI - 0.6, z))], [(0, 1, 2, 3)], [q]), 'env', 0xffffff, smooth=True)


for side in (-1, 1):
    for (px, pz, base) in PILLARS:
        pillar(side * px, pz, base)
# a block that could be pushed, if anybody were minded to, and a pedestal for the crystal
tomb.add(texbox(2, 2, 2, default='wall_glyph'), 'env', 0x9a8a78, smooth=False, m=T(-6.7, PIT + 1, 11.8))
tomb.add(texbox(0.9, 0.5, 0.9, default=uv('wall_block', sub=(0, 0, 0.5, 0.5)), top=uv('gold')), 'env', 0xffffff, smooth=False, m=T(3.7, 0.25, -2.5))
obj('tomb', tomb, pivot=(0, 0, 0), light='baked')

# ════════════════════════════════════════════════════════════════════════════
# Things standing in it
# ════════════════════════════════════════════════════════════════════════════
props = Geo()
TB = LAY['table']
TY = TB['y']
# the booth is a sarcophagus: painted side to the room, a stone lid for a table top
zc = (TB['z0'] + TB['z1']) / 2
zd = TB['z1'] - TB['z0']
props.add(texbox(TB['x'] * 2, TY - 0.08, zd, default=uv('sarcophagus', sub=(0.4, 0, 0.6, 1)), front='sarcophagus', back=uv('wall_block', sub=(0, 0, 1, 0.5)), top=uv('wall_block', sub=(0, 0, 1, 0.5))), 'prop', 0xffffff, smooth=False, m=T(0, (TY - 0.08) / 2, zc))
props.add(texbox(TB['x'] * 2 + 0.12, 0.08, zd + 0.06, default=uv('gold'), top=uv('wall_block', sub=(0.05, 0.05, 0.45, 0.45)), bottom=uv('gold')), 'prop', 0x8a8480, smooth=False, m=T(0, TY - 0.04, zc + 0.03))  # overhangs the room's side only
props.add(quad(1.5, 0.31, uv('banner')), 'prop', 0xffffff, smooth=False, m=T(0, TY - 0.26, TB['z1'] + 0.07), ao=False)
# cables off the back of the mixer, over the edge of the lid
for i, dx in enumerate((-0.16, -0.04, 0.1, 0.2)):
    z = LAY['mixer']['z'] + LAY['mixer']['d'] / 2
    props.add(tube([(dx, TY + 0.07, z - 0.02), (dx * 1.1, TY + 0.05, z + 0.07), (dx * 1.3, TY + 0.014, TB['z1'] - 0.08), (dx * 1.35, TY - 0.03, TB['z1'] - 0.04)], 0.012, 4), 'rubber', (RUBBER, 0x7a2a22, RUBBER, 0x2a4a7a)[i])


def cabinet(m):
    """One loudspeaker box, 1.2 wide, 1.8 high, 0.95 deep, its face on local +z."""
    props.add(texbox(1.2, 1.8, 0.95, front='speaker'), 'prop', 0xffffff, smooth=False, m=m)
    v, f = box(1.2, 1.8, 0.95)
    props.add((v, [f[i] for i in (1, 2, 3, 4, 5)]), 'rubber', 0x202127, smooth=False, m=m)


WOOFERS = []
for side in (-1, 1):
    for level in range(2):
        m = T(side * SPEAKER[0], 0.9 + level * 1.8, SPEAKER[1]) @ RY(side * -SPEAKER[2])
        cabinet(m)
        for wy in (0.164, -0.495):  # where the two cones are painted on the picture
            WOOFERS.append(m @ T(0, wy, 0.48))
    # a crate to stand the top box's amp on, and one more beside it
    props.add(texbox(1, 1, 1, default='crate'), 'prop', 0xffffff, smooth=False, m=T(side * 6.75, 0.5, -1.2) @ RY(side * 0.3))
# the record box, on a crate behind the DJ and to their left
props.add(texbox(1, 1, 1, default='crate'), 'prop', 0xffffff, smooth=False, m=T(1.72, 0.5, -0.5) @ RY(0.22))
BOX = T(1.66, 1.0, -0.46) @ RY(0.22)
for (w, h, d, x, y, z) in ((0.74, 0.02, 0.42, 0, 0.01, 0), (0.74, 0.3, 0.02, 0, 0.15, 0.2), (0.74, 0.3, 0.02, 0, 0.15, -0.2), (0.02, 0.3, 0.42, 0.36, 0.15, 0), (0.02, 0.3, 0.42, -0.36, 0.15, 0)):
    props.add(box(w, h, d), 'wood', 0x3b2a1e, smooth=False, m=BOX @ T(x, y, z))
SLEEVE_IDS = ('medipack', 'swandive', 'secret', 'tank', 'block', 'lever', 'crystal', 'butler', 'valley', 'boulder')
for i, sid in enumerate(SLEEVE_IDS):
    q = uv('sleeve_' + sid)
    lean = -0.16 + 0.03 * (i % 3)
    props.add(texbox(0.006, 0.34, 0.34, right=q, left=q), 'prop', 0xffffff, smooth=False, m=BOX @ T(-0.3 + i * 0.066, 0.2, 0) @ RZ(lean), ao=False)
# braziers either side of the booth
for side in (-1, 1):
    m = T(side * BRAZIER[0], 0, BRAZIER[1])
    props.add(lathe([(0.3, 0), (0.24, 0.08), (0.09, 0.2), (0.07, 0.95), (0.3, 1.12), (0.38, 1.3), (0.33, 1.3), (0.2, 1.2), (0, 1.2)], 8), 'metal', 0x5a4632, m=m)
    props.add(lathe([(0.3, 1.26), (0, 1.3)], 8), 'glow', (1.0, 0.45, 0.1), smooth=False, m=m, ao=False, uvs=[uv('white')[:3]] * 8)
# wall torches: an iron cup on a bracket
for (x, y, z, s, r) in FIRES[:6]:
    out = Vector((0, 0, 1)) if z < Z0 + 1 else Vector((-1 if x > 0 else 1, 0, 0))
    wallp = Vector((x, y, z)) - out * 0.4
    props.add(tube([wallp, wallp + out * 0.2 + Vector((0, -0.25, 0)), Vector((x, y - 0.42, z))], 0.035, 4), 'metal', 0x3a3028)
    props.add(lathe([(0.05, -0.45), (0.17, -0.2), (0.2, -0.16), (0.15, -0.16), (0, -0.22)], 6), 'metal', 0x4a3a2c, m=T(x, y, z))
# the lever, on the wall behind the booth beside the painting, its plate at chest height
LEVER = Vector((-3.95, 1.45, Z0 + 0.05))
props.add(box(0.5, 0.7, 0.1), 'metal', 0x4a5a6a, smooth=False, m=T(*LEVER))
obj('props', props, pivot=(0, 0, 0))

lever = Geo()
lever.add(box(0.06, 0.42, 0.05), 'metal', 0x2a2420, smooth=False, m=T(0, 0.2, 0.02))
lever.add(ellipsoid(0.065, 0.065, 0.065, 6, 4), 'plastic', 0xb5372f, m=T(0, 0.44, 0.02))
obj('lever', lever, pivot=(0, 0, 0), kind='lever')
OBJECTS[-1]['matrix'] = T(LEVER.x, LEVER.y - 0.12, LEVER.z + 0.07)

# woofer cones: each its own object, facing out of its box, so they can pump
for i, m in enumerate(WOOFERS):
    g = Geo()
    n = 10
    rim = [(math.cos(TAU * k / n) * 0.36, math.sin(TAU * k / n) * 0.36, 0) for k in range(n)]
    q = uv('cone')
    cu, cv_ = (q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2
    ru, rv = (q[1][0] - q[0][0]) / 2, (q[2][1] - q[1][1]) / 2
    verts = rim + [(0, 0, -0.1)]
    faces = [(k, (k + 1) % n, n) for k in range(n)]
    uvs = [[(cu + math.cos(TAU * k / n) * ru, cv_ + math.sin(TAU * k / n) * rv), (cu + math.cos(TAU * (k + 1) / n) * ru, cv_ + math.sin(TAU * (k + 1) / n) * rv), (cu, cv_)] for k in range(n)]
    g.add((verts, faces, uvs), 'prop', 0xffffff, smooth=False, ao=False)
    obj(f'woofer_{i}', g, pivot=(0, 0, 0), kind='woofer')
    OBJECTS[-1]['matrix'] = m

# fire: two crossed cards, each showing one frame of the flame; the page turns the pages
for i, (x, y, z, s, r) in enumerate(FIRES):
    g = Geo()
    size = 0.62 if i < 6 else 0.9
    q = uv('flame', sub=(0, 0, 0.25, 1))
    for a in (0.5, 2.07):
        g.add(quad(size * 0.6, size * 1.2, q), 'cutout', 0xffffff, smooth=False, m=RY(a) @ T(0, size * 0.6, 0), ao=False)
        g.add(quad(size * 0.6, size * 1.2, q), 'cutout', 0xffffff, smooth=False, m=RY(a + math.pi) @ T(0, size * 0.6, 0), ao=False)
    obj(f'flame_{i}', g, pivot=(0, 0, 0), kind='flame', strength=s, reach=r)
    OBJECTS[-1]['matrix'] = T(x, y - 0.2 if i < 6 else 1.27, z)

# the save crystal: saturated blue-violet, flat-shaded, floating over its pedestal
crystal = Geo()
cn = 6
ring_ = [(math.cos(TAU * k / cn) * 0.26, 0, math.sin(TAU * k / cn) * 0.26) for k in range(cn)]
cverts = ring_ + [(0, 0.62, 0), (0, -0.62, 0)]
shades = (0x7b6cff, 0x4f3df2, 0x9d8cff, 0x3526c9, 0x6a58ff, 0x2a1ca8)
for k in range(cn):
    crystal.add((cverts, [((k + 1) % cn, k, cn)], [uv('white')[:3]]), 'glow', shades[k], smooth=False, ao=False)
    crystal.add((cverts, [(k, (k + 1) % cn, cn + 1)], [uv('white')[:3]]), 'glow', shades[(k + 3) % cn], smooth=False, ao=False)
obj('crystal', crystal, pivot=(0, 0, 0), kind='crystal')
OBJECTS[-1]['matrix'] = T(3.7, 1.45, -2.5)

# a small medipack on the dais: a flat sprite that always faces the camera
med = Geo()
med.add(quad(0.42, 0.35, uv('medipack')), 'cutout', 0xffffff, smooth=False, m=T(0, 0.175, 0), ao=False)
obj('medipack', med, pivot=(0, 0, 0), kind='sprite')
OBJECTS[-1]['matrix'] = T(-3.4, 0, -1.6)

# ════════════════════════════════════════════════════════════════════════════
# The gear
# ════════════════════════════════════════════════════════════════════════════
MX = LAY['mixer']
MTOP = TY + MX['h']
mixer = Geo()
mixer.add(box(MX['w'], MX['h'], MX['d']), 'plastic', 0x2c2e36, smooth=False, m=T(MX['x'], TY + MX['h'] / 2, MX['z']))
mixer.add(top(MX['w'], MX['d'], 'mixer_face'), 'prop', 0xffffff, smooth=False, m=T(MX['x'], MTOP + 0.001, MX['z']), ao=False)
obj('mixer', mixer, pivot=(0, 0, 0))


def control(cid, kind, geo, at, **extras):
    name = 'ctl_' + cid.replace('.', '_')
    obj(name, geo, pivot=(0, 0, 0), ctl=cid, kind=kind, **extras)
    OBJECTS[-1]['matrix'] = T(*at)


def knob(cid, x, z, r, cap, skirt=0x24262c):
    g = Geo()
    h = LAY['knob']['h']
    g.add(cyl(r * 1.12, r * 0.92, h, 8, caps=False), 'rubber', skirt, m=T(0, h / 2, 0))
    g.add(disc(r * 0.95, 8, uv_rect=uv(cap)), 'prop', 0xffffff, smooth=False, m=T(0, h, 0) @ FLAT, ao=False)
    control(cid, 'knob', g, (MX['x'] + x, MTOP, MX['z'] + z))


def fader_cap(w, d, stripe=0xe8e4d8):
    g = Geo()
    g.add(loft(rounded_rect(w, d, 0.006, n=0), [(0, 1, 1), (0.03, 1, 1), (0.04, 0.8, 0.8)]), 'plastic', 0x3a3c44, smooth=False)
    g.add(box(w * 0.9 if w > d else 0.008, 0.004, 0.008 if w > d else d * 0.9), 'plastic', stripe, smooth=False, m=T(0, 0.041, 0))
    return g


for ch in ('A', 'B'):
    sx = LAY['strip'][ch]
    for row, z in LAY['rows'].items():
        big = row == 'filter'
        knob(f'{ch}.{row}', sx, z, LAY['knob']['big'] if big else LAY['knob']['r'], 'knob_teal' if big else 'knob_dark')
    # the fader's cap rides from z0 (shut, towards the DJ) to z1
    control(f'{ch}.fader', 'fader', fader_cap(0.06, 0.03), (MX['x'] + sx, MTOP, MX['z'] + LAY['fader']['z0']), axis=[0, 0, 1], travel=LAY['fader']['z1'] - LAY['fader']['z0'])
    g = Geo()
    g.add(box(0.044, 0.016, 0.044), 'glow', (0.5, 0.33, 0.08), smooth=False, m=T(0, 0.008, 0), ao=False, uvs=[uv('white')] * 6)
    control(f'{ch}.cue', 'button', g, (MX['x'] + math.copysign(LAY['cue']['x'], sx), MTOP, MX['z'] + LAY['cue']['z']))
knob('master', LAY['master']['x'], LAY['master']['z'], LAY['knob']['r'], 'knob_red')
knob('echo', LAY['echo']['x'], LAY['echo']['z'], LAY['knob']['r'], 'knob_amber')
knob('reverb', LAY['reverb']['x'], LAY['reverb']['z'], LAY['knob']['r'], 'knob_amber')
# crossfader: fully to the DJ's left (+x) is deck A alone
control('xfader', 'fader', fader_cap(0.03, 0.056, 0xd8382e), (MX['x'] + LAY['xfader']['travel'], MTOP, MX['z'] + LAY['xfader']['z']), axis=[-1, 0, 0], travel=LAY['xfader']['travel'] * 2)
g = Geo()
g.add(box(0.022, 0.03, 0.03), 'metal', STEEL, smooth=False, m=T(0, 0.015, 0))
control('fxsel', 'switch', g, (MX['x'] + LAY['fxsel']['x'] + LAY['fxsel']['travel'], MTOP, MX['z'] + LAY['fxsel']['z']), axis=[-1, 0, 0], travel=LAY['fxsel']['travel'] * 2)

# level meters: ten lamps each, lit from the page
ME = LAY['meter']
for name, xs in (('A', (math.copysign(ME['ch'], LAY['strip']['A']),)), ('B', (math.copysign(ME['ch'], LAY['strip']['B']),)), ('M', (ME['master'], -ME['master']))):
    g = Geo()
    n = ME['leds']
    pitch_ = (ME['z1'] - ME['z0']) / n
    for x in xs:
        for k in range(n):
            g.add(top(0.016, pitch_ * 0.7, 'white'), 'glow', 0x202020, smooth=False, m=T(MX['x'] + x, MTOP + 0.004, MX['z'] + ME['z0'] + (k + 0.5) * pitch_), ao=False)
    obj('meter_' + name, g, pivot=(0, 0, 0), kind='meter', meter=name, leds=n, columns=len(xs))

DK = LAY['deck']
DTOP = TY + DK['h']
for d in ('A', 'B'):
    cx, cz = DK[d]['x'], DK[d]['z']
    g = Geo()
    g.add(box(DK['w'], DK['h'], DK['d']), 'metal', 0x9a9da6, smooth=False, m=T(cx, TY + DK['h'] / 2, cz))
    g.add(top(DK['w'], DK['d'], 'deck_top'), 'prop', 0xffffff, smooth=False, m=T(cx, DTOP + 0.001, cz), ao=False)
    for fx in (-1, 1):  # rubber feet
        for fz in (-1, 1):
            g.add(cyl(0.05, 0.05, 0.02, 6), 'rubber', RUBBER, m=T(cx + fx * 0.33, TY + 0.005, cz + fz * 0.25))
    # the dial with the red lamp, the two speed buttons, the tonearm's post
    g.add(cyl(0.036, 0.03, 0.05, 8), 'metal', 0x33353d, m=T(cx + 0.33, DTOP + 0.025, cz - 0.12))
    for dx in (0.11, 0.18):
        g.add(box(0.045, 0.012, 0.04), 'plastic', 0x33353d, smooth=False, m=T(cx + LAY['start']['x'] - dx, DTOP + 0.006, cz + LAY['start']['z'] + 0.018))
    g.add(cyl(0.042, 0.042, 0.06, 8), 'metal', 0x4a4d57, m=T(cx + LAY['tonearm']['x'], DTOP + 0.03, cz + LAY['tonearm']['z']))
    g.add(box(0.03, 0.05, 0.11), 'metal', 0x4a4d57, smooth=False, m=T(cx + LAY['tonearm']['x'] - 0.05, DTOP + 0.025, cz + LAY['tonearm']['z'] - 0.21))  # the arm's rest
    obj('deck_' + d, g, pivot=(0, 0, 0))

    # the platter turns; the record and its label ride on it
    PL = (cx + LAY['platter']['x'], DTOP, cz + LAY['platter']['z'])
    g = Geo()
    R_ = LAY['platter']['r']
    g.add(lathe([(R_, 0.002), (R_, 0.02), (R_ - 0.012, 0.03), (0, 0.03)], 16), 'metal', 0xc2c5cc, smooth=False)
    for k in range(16):  # the strobe dots round the rim
        a = TAU * (k + 0.5) / 16
        g.add(box(0.012, 0.012, 0.004), 'metal', 0x4a4d57, smooth=False, m=RY(a) @ T(0, 0.011, R_ + 0.001), ao=False)
    g.add(disc(R_ - 0.014, 12), 'rubber', 0x1c1d22, smooth=False, m=T(0, 0.0315, 0) @ FLAT, ao=False)  # slipmat
    g.add(cyl(0.008, 0.006, 0.03, 5), 'metal', STEEL, m=T(0, 0.045, 0))
    obj('platter_' + d, g, pivot=(0, 0, 0), kind='platter', deck=d)
    OBJECTS[-1]['matrix'] = T(*PL)
    g = Geo()
    g.add(disc(0.262, 16, uv_rect=uv('vinyl')), 'prop', 0xffffff, smooth=False, m=T(0, 0.034, 0) @ FLAT, ao=False)
    obj('record_' + d, g, pivot=(0, 0, 0), parent='platter_' + d, kind='record', deck=d)
    g = Geo()
    g.add(disc(0.088, 10, uv_rect=uv('sleeve_medipack')), 'prop', 0xffffff, smooth=False, m=T(0, 0.0355, 0) @ FLAT, ao=False)
    obj('label_' + d, g, pivot=(0, 0, 0), parent='record_' + d, kind='label', deck=d)

    # the tonearm, built pointing towards the DJ (-z) from its pivot; the page swings it over the record
    g = Geo()
    L = LAY['tonearm']['len']
    g.add(tube([(0, 0.05, 0.1), (0, 0.05, 0), (0.012, 0.05, -L * 0.55), (0.04, 0.042, -L * 0.9), (0.045, 0.036, -L)], 0.007, 4), 'metal', STEEL)
    g.add(cyl(0.024, 0.024, 0.05, 6), 'metal', 0x6a6d77, m=T(0, 0.05, 0.11) @ RX(math.pi / 2))  # counterweight
    g.add(box(0.03, 0.016, 0.055), 'plastic', 0x1c1d22, smooth=False, m=T(0.047, 0.03, -L - 0.01) @ RY(-0.35))  # headshell
    g.add(box(0.008, 0.012, 0.008), 'plastic', 0xd8382e, smooth=False, m=T(0.05, 0.017, -L - 0.022))  # cartridge and stylus
    g.add(cyl(0.02, 0.02, 0.03, 6), 'metal', 0x6a6d77, m=T(0, 0.035, 0))
    obj('tonearm_' + d, g, pivot=(0, 0, 0), kind='tonearm', deck=d, length=L)
    OBJECTS[-1]['matrix'] = T(cx + LAY['tonearm']['x'], DTOP + 0.03, cz + LAY['tonearm']['z'])

    # pitch fader (towards the DJ is faster) and the start/stop button
    obj('pitch_' + d, fader_cap(0.05, 0.026, 0xd8d3c9), pivot=(0, 0, 0), ctl=f'{d}.pitch', kind='fader', axis=[0, 0, -1], travel=LAY['pitch']['travel'] * 2)
    OBJECTS[-1]['matrix'] = T(cx + LAY['pitch']['x'], DTOP, cz + LAY['pitch']['z'] + LAY['pitch']['travel'])
    g = Geo()
    g.add(box(0.085, 0.02, 0.085), 'plastic', 0x33353d, smooth=False, m=T(0, 0.01, 0))
    g.add(top(0.05, 0.016, 'white'), 'glow', 0x551510, smooth=False, m=T(0, 0.0205, 0.022), ao=False)
    obj('start_' + d, g, pivot=(0, 0, 0), ctl=f'{d}.play', kind='button')
    OBJECTS[-1]['matrix'] = T(cx + LAY['start']['x'], DTOP, cz + LAY['start']['z'])

# a record on its way from the box to a deck, carried flat
g = Geo()
g.add(disc(0.262, 16, uv_rect=uv('vinyl')), 'prop', 0xffffff, smooth=False, m=FLAT, ao=False)
g.add(disc(0.262, 16, uv_rect=uv('vinyl')), 'prop', 0xffffff, smooth=False, m=RX(math.pi) @ FLAT, ao=False)
obj('carry', g, pivot=(0, 0, 0), kind='carry')
g = Geo()
g.add(disc(0.088, 10, uv_rect=uv('sleeve_medipack')), 'prop', 0xffffff, smooth=False, m=T(0, 0.002, 0) @ FLAT, ao=False)
obj('carry_label', g, pivot=(0, 0, 0), parent='carry', kind='label')

# ════════════════════════════════════════════════════════════════════════════
# DJ MONOLITH
# ════════════════════════════════════════════════════════════════════════════
SEG, RINGS = 16, 12


def egg(segs=SEG, rings=RINGS):
    prof = [(body_r(math.pi * j / rings), body_y(math.pi * j / rings)) for j in range(rings + 1)]
    prof[0] = (0, body_y(0))
    prof[-1] = (0, body_y(math.pi))
    return prof


def shoe(side):
    g = Geo()
    half = [(0.09, -0.235), (0.14, -0.16), (0.155, -0.02), (0.15, 0.16), (0.125, 0.3), (0.07, 0.375)]
    outline = half + [(0, 0.39)] + [(-x, z) for x, z in reversed(half)] + [(0, -0.25)]
    g.add(prism(outline, 0, 0.032), 'rubber', 0xc48a4f, smooth=False)
    g.add(loft(outline, [(0.032, 1.02, 1.01), (0.085, 1.02, 1.01)]), 'rubber', 0xefeadf, smooth=False)
    g.add(loft(outline, [(0.05, 1.028, 1.016), (0.06, 1.028, 1.016)], cap_bottom=False, cap_top=False), 'rubber', NAVY, smooth=False)
    zs = [-0.235, -0.14, -0.03, 0.09, 0.2, 0.3, 0.365]
    ws = [0.085, 0.135, 0.148, 0.145, 0.13, 0.1, 0.05]
    hs = [0.115, 0.135, 0.125, 0.085, 0.06, 0.045, 0.025]
    y0 = 0.085
    K = 5
    grid = [[(ws[j] * math.cos(math.pi * k / (K - 1)), y0 + hs[j] * math.sin(math.pi * k / (K - 1)), zs[j]) for k in range(K)] for j in range(len(zs))]
    verts = [p for row in grid for p in row]
    upper, toe, stripe = [], [], []
    for j in range(len(zs) - 1):
        for k in range(K - 1):
            if j < 2 and k in (1, 2):
                continue
            fc = (j * K + k, j * K + k + 1, (j + 1) * K + k + 1, (j + 1) * K + k)
            outer = (k == 0) if side > 0 else (k == K - 2)
            (toe if j >= 4 else stripe if (outer and j in (1, 2)) else upper).append(fc)
    for faces, mat, col in ((upper, 'leather', WHITE), (toe, 'rubber', 0xd4cfc4), (stripe, 'leather', SKIN)):
        if faces:
            g.add((verts, faces), mat, col)
    g.add((verts, [tuple(reversed(range(K)))]), 'leather', NAVY, smooth=False)
    g.add((verts, [tuple((len(zs) - 1) * K + k for k in range(K))]), 'rubber', 0xd4cfc4, smooth=False)
    rim = [grid[0][1], grid[0][2], grid[0][3], grid[1][3], grid[2][3], grid[2][2], grid[2][1], grid[1][1]]
    g.add(tube([(x * 0.98, y + 0.004, z) for x, y, z in rim], 0.017, 4, closed=True), 'fabric', NAVY)
    return g


group('pebble', kind='dj')
# the sneakers stay planted; the rest of the Pebble leans and bounces above them
shoes = Geo()
for side in (-1, 1):
    shoes.add(ellipsoid(0.072, 0.1, 0.105, 7, 4), 'skin', 0x24345e, m=T(side * 0.3, 0, 0.25) @ RY(side * 0.24) @ T(0, 0.11, -0.09))
    shoes.merge(shoe(side), T(side * 0.3, 0, 0.25) @ RY(side * 0.24))
obj('shoes', shoes, pivot=(0, 0, 0), parent='pebble')
body = Geo()
body.add(lathe(egg(), SEG), 'skin', SKIN)
# a belt with a gold buckle, and where a raider would wear pistols, a pair of glow sticks
ro = lambda y: radius_at(y) + 0.03  # noqa: E731
ri = lambda y: radius_at(y) + 0.008  # noqa: E731
body.add(lathe([(ro(0.46), 0.46), (ro(0.57), 0.57), (ri(0.57), 0.57), (ri(0.46), 0.46), (ro(0.46), 0.46)], SEG), 'leather', LEATHER, smooth=False)
BK = surf_frame(0, 0.515, 0.042)
for w, h, x, y in ((0.17, 0.022, 0, 0.065), (0.17, 0.022, 0, -0.065), (0.022, 0.15, 0.074, 0), (0.022, 0.15, -0.074, 0)):
    body.add(box(w, h, 0.02), 'metal', GOLD, smooth=False, m=BK @ T(x, y, 0))
for side, col in ((-1, (0.25, 1.0, 0.55)), (1, (1.0, 0.25, 0.75))):
    hm = surf_frame(side * 1.35, 0.4, 0.07)
    body.add(loft(rounded_rect(0.13, 0.08, 0.02), [(-0.14, 0.8, 0.8), (-0.1, 1, 1), (0.1, 1, 1)]), 'leather', LEATHER_DARK, m=hm)
    body.add(box(0.05, 0.14, 0.012), 'leather', LEATHER_DARK, smooth=False, m=surf_frame(side * 1.35, 0.5, 0.045))
    body.add(cyl(0.022, 0.022, 0.3, 5), 'glow', col, m=hm @ T(0, 0.14, 0) @ RZ(side * 0.12), ao=False, uvs=None)
# the little backpack
PACK = T(0, 1.02, -(radius_at(1.0) + 0.13)) @ RY(math.pi)
body.add(loft(rounded_rect(0.52, 0.24, 0.06), [(-0.28, 0.86, 0.86), (-0.22, 1, 1), (0.2, 1, 1), (0.27, 0.92, 0.9)]), 'leather', 0x6a4526, m=PACK)
body.add(loft(rounded_rect(0.36, 0.08, 0.03), [(-0.1, 0.94, 0.9), (-0.07, 1, 1), (0.07, 1, 1), (0.1, 0.95, 0.9)]), 'leather', LEATHER_DARK, m=PACK @ T(0, -0.1, 0.14))
body.add(box(0.05, 0.05, 0.02), 'metal', GOLD, smooth=False, m=PACK @ T(0, -0.02, 0.19))
for side in (-1, 1):
    body.add(surf_ribbon([(side * 2.7, 0.86), (side * 1.9, 1.02), (side * 1.3, 1.2), (side * 1.9, 1.42), (side * 2.7, 1.4)], 0.07, off=0.012, thick=0.012, segs=8)[:2], 'leather', LEATHER_DARK)
# a heavy gold chain: real links, all the way round, hanging to a point in front where a gold record
# swings from it. It goes over the shoulders and behind the headphones, well clear of the glasses.


def chain_at(t):
    """Where the chain lies, as (angle round the body, height): t = 0 is the front, t = +-1 the back."""
    a = abs(t) * math.pi
    # In front it hangs in a shallow V, well under the glasses, out to his sides. There it climbs to go
    # over the shoulders, and from there it runs nearly level round the back.
    if a < 0.95:
        y = 1.13 + 0.15 * a / 0.95
    elif a < 1.12:
        y = 1.28 + 0.13 * (a - 0.95) / 0.17
    else:
        y = 1.41 + 0.07 * (a - 1.12) / (math.pi - 1.12)
    return math.copysign(a, t), y


LINKS = 76
cpts = [surf(*chain_at(-1 + 2 * (i + 0.5) / LINKS), 0.034) for i in range(LINKS)]
for i in range(LINKS):
    p0, p1 = cpts[i], cpts[(i + 1) % LINKS]
    tan = (p1 - p0).normalized()
    n = surf_normal(*chain_at(-1 + 2 * (i + 1) / LINKS))
    side_ = n.cross(tan).normalized()
    out = tan.cross(side_)
    m = T(*((p0 + p1) / 2)) @ basis(tan, side_, out)
    lying = i % 2 == 0  # every other link lies flat against him; the ones between stand on edge
    body.add(box((p1 - p0).length * 1.3, 0.04 if lying else 0.02, 0.018 if lying else 0.036), 'metal', GOLD if lying else 0xa9772a, smooth=False, m=m)
MED = surf_frame(0, 1.05, 0.05)
body.add(box(0.022, 0.06, 0.016), 'metal', GOLD, smooth=False, m=surf_frame(0, 1.115, 0.04))
body.add(cyl(0.088, 0.088, 0.022, 10), 'metal', GOLD, smooth=False, m=MED @ RX(math.pi / 2))
body.add(disc(0.07, 10), 'metal', 0x8a5f1c, smooth=False, m=MED @ T(0, 0, 0.012), ao=False)  # the grooves
body.add(disc(0.034, 8), 'metal', 0xf2c85a, smooth=False, m=MED @ T(0, 0, 0.014), ao=False)  # the label
body.add(disc(0.009, 4), 'plastic', INK, smooth=False, m=MED @ T(0, 0, 0.016), ao=False)
obj('body', body, pivot=(0, 0.45, 0), parent='pebble')

for side, name in ((-1, 'eye_r'), (1, 'eye_l')):
    g = Geo()
    m = surf_frame(side * 0.4, 1.56, 0.016)
    g.add(disc(0.047, 8, rz=0.076), 'plastic', INK, smooth=False, m=m, ao=False)
    g.add(disc(0.012, 4), 'plastic', 0xffffff, smooth=False, m=m @ T(-0.014, 0.032, 0.004), ao=False)
    obj(name, g, pivot=surf(side * 0.4, 1.56, 0.016), parent='body', kind='eye')

# round dark glasses with gold rims, worn low so the eyes show over them
shades_ = Geo()
for side in (-1, 1):
    m = surf_frame(side * 0.4, 1.47, 0.06) @ RX(0.1)
    shades_.add(ring(0.118, 10, 0.012, 4, plane='xy'), 'metal', GOLD, m=m)
    shades_.add(disc(0.112, 10), 'plastic', 0x1a1420, smooth=False, m=m, ao=False)
    shades_.add(disc(0.03, 4), 'plastic', 0x6a5a8a, smooth=False, m=m @ T(-0.04, 0.045, 0.004), ao=False)
    shades_.add(tube([surf(side * p, y, o) for p, y, o in ((0.63, 1.49, 0.06), (0.8, 1.5, 0.045), (0.95, 1.51, 0.036), (1.12, 1.52, 0.03))], 0.007, 4), 'metal', GOLD)
shades_.add(tube([surf(p, y, o) for p, y, o in ((-0.2, 1.5, 0.066), (-0.1, 1.522, 0.08), (0, 1.528, 0.084), (0.1, 1.522, 0.08), (0.2, 1.5, 0.066))], 0.008, 4), 'metal', GOLD)
obj('shades', shades_, pivot=(0, 1.5, radius_at(1.5) + 0.06), parent='body')

# headphones: big cups, a padded band, and the curly cable down the back like a braid
phones = Geo()
band = [(math.cos(t) * 0.672, 1.5 + math.sin(t) * 0.695, 0) for t in (0.19 + (math.pi - 0.38) * i / 14 for i in range(15))]
phones.add(tube(band, 0.024, 4, up=(0, 0, 1), scale=(2.8, 1)), 'plastic', SHELL)
pad_ = [(x * 0.975, 1.5 + (y - 1.5) * 0.985 + 0.02, 0) for x, y, _ in band[4:11]]
phones.add(tube(pad_, 0.032, 4, up=(0, 0, 1), scale=(2.2, 1)), 'rubber', RUBBER)
for side in (-1, 1):
    m = T(side * 0.662, 1.5, 0) @ RZ(side * -math.pi / 2)
    phones.add(cyl(0.17, 0.17, 0.05, 8), 'rubber', RUBBER, m=m @ T(0, -0.01, 0))
    phones.add(cyl(0.165, 0.15, 0.07, 8), 'plastic', SHELL, m=m @ T(0, 0.045, 0))
    phones.add(cyl(0.15, 0.115, 0.03, 8), 'plastic', SHELL, m=m @ T(0, 0.092, 0))
    phones.add(cyl(0.12, 0.12, 0.008, 8), 'metal', GOLD, smooth=False, m=m @ T(0, 0.11, 0))
    phones.add(cyl(0.06, 0.06, 0.01, 6), 'plastic', SKIN, smooth=False, m=m @ T(0, 0.117, 0))
    phones.add(box(0.034, 0.22, 0.056), 'plastic', SHELL, smooth=False, m=T(side * 0.692, 1.62, 0) @ RZ(side * 0.17))
coil = []
for i in range(25):
    t = i / 24
    y = 1.36 - t * 0.9
    a = t * TAU * 6
    coil.append(Vector((0.6 - t * 0.5 + math.cos(a) * 0.03, y, -(radius_at(max(y, 0.3)) * (0.55 + 0.45 * t) + 0.06) + math.sin(a) * 0.03)))
phones.add(tube(coil, 0.013, 3), 'rubber', RUBBER)
obj('phones', phones, pivot=(0, 1.72, 0), parent='body')

# arms: an upper arm, a forearm and a mitten, each a rigid piece that hangs down (-y) from its own joint.
# The page stands them up with a little arithmetic every frame; nothing here bends.
ARM = {'upper': 0.6, 'fore': 0.6}
SHOULDER = {}
for side, s in ((1, 'l'), (-1, 'r')):
    phi = side * 1.3  # at his sides, a little forward of square
    sh = Vector((math.sin(phi) * (radius_at(1.26) - 0.05), 1.26, math.cos(phi) * (radius_at(1.26) - 0.05)))  # above the gear, so an arm goes over it, not through
    SHOULDER[s] = sh
    g = Geo()
    g.add(lathe([(0, 0.1), (0.09, 0.07), (0.115, 0), (0.105, -ARM['upper'] + 0.04), (0.07, -ARM['upper'] - 0.05), (0, -ARM['upper'] - 0.07)][::-1], 7), 'skin', SKIN)  # (a lathe wants its profile from the bottom up)
    obj(f'arm_{s}_upper', g, pivot=(0, 0, 0), parent='pebble', kind='bone', length=ARM['upper'], shoulder=[sh.x, sh.y, sh.z])
    OBJECTS[-1]['matrix'] = T(*sh)
    g = Geo()
    g.add(lathe([(0, 0.07), (0.075, 0.045), (0.1, 0), (0.092, -ARM['fore'] + 0.05), (0.06, -ARM['fore'] - 0.03), (0, -ARM['fore'] - 0.05)][::-1], 7), 'skin', SKIN)
    # a watch on one wrist, a sweatband on the other
    if s == 'l':
        g.add(ring(0.098, 8, 0.014, 4, plane='xz', scale=(3, 1)), 'leather', LEATHER_DARK, m=T(0, -ARM['fore'] + 0.1, 0))
        g.add(cyl(0.05, 0.05, 0.022, 8), 'metal', GOLD, m=T(0, -ARM['fore'] + 0.1, 0.1) @ RX(math.pi / 2))
    else:
        g.add(lathe([(0.1, -ARM['fore'] + 0.06), (0.105, -ARM['fore'] + 0.16)], 7), 'fabric', 0xd8382e, m=S(1.06, 1, 1.06))
    obj(f'arm_{s}_fore', g, pivot=(0, 0, 0), parent='pebble', kind='bone', length=ARM['fore'])
    OBJECTS[-1]['matrix'] = T(sh.x, sh.y - ARM['upper'], sh.z)
    g = Geo()
    g.add(ellipsoid(0.12, 0.135, 0.105, 7, 5), 'skin', SKIN, m=T(0, -0.1, 0))
    g.add(ellipsoid(0.045, 0.07, 0.05, 5, 4), 'skin', SKIN, m=T(-side * 0.1, -0.06, 0.03) @ RZ(side * 0.7))  # thumb, on the inside
    obj(f'hand_{s}', g, pivot=(0, 0, 0), parent='pebble', kind='hand', reach=0.2)
    OBJECTS[-1]['matrix'] = T(sh.x, sh.y - ARM['upper'] - ARM['fore'], sh.z)

# ════════════════════════════════════════════════════════════════════════════
# The crowd: one mummy; the page stands copies of it on the dance floor
# ════════════════════════════════════════════════════════════════════════════
group('mummy', kind='mummy')
g = Geo()
g.add(lathe_tex(egg(10, 8), 10, 'bandage'), 'prop', 0xd8cdb4, smooth=True)
for side in (-1, 1):
    g.add(ellipsoid(0.08, 0.1, 0.12, 6, 4), 'fabric', 0xa89a80, m=T(side * 0.28, 0.09, 0.12))
obj('mummy_body', g, pivot=(0, 0, 0), parent='mummy')
g = Geo()
for side in (-1, 1):
    m = surf_frame(side * 0.4, 1.52, 0.012)
    g.add(disc(0.055, 6, rz=0.08, uv_rect=uv('white')), 'glow', (0.35, 1.0, 0.85), smooth=False, m=m, ao=False)
# a dark slot in the wrappings for the eyes to look out of
g.add(surf_ribbon([(-0.75, 1.52), (-0.4, 1.53), (0, 1.535), (0.4, 1.53), (0.75, 1.52)], 0.2, off=0.004, thick=0.004, segs=6)[:2], 'fabric', 0x1a1410, ao=False)
obj('mummy_eyes', g, pivot=(0, 0, 0), parent='mummy_body')
for side, s in ((1, 'l'), (-1, 'r')):
    sh = Vector((side * (radius_at(1.1) - 0.06), 1.1, 0.05))
    g = Geo()
    g.add(lathe_tex([(0, 0.08), (0.1, 0.04), (0.11, -0.34), (0.135, -0.5), (0.11, -0.66), (0, -0.7)][::-1], 6, 'bandage'), 'prop', 0xd8cdb4)
    obj(f'mummy_arm_{s}', g, pivot=(0, 0, 0), parent='mummy_body', kind='arm')
    OBJECTS[-1]['matrix'] = T(*sh)


# ════════════════════════════════════════════════════════════════════════════
# From bags of faces to Blender objects
# ════════════════════════════════════════════════════════════════════════════
def P(v):
    """Page coordinates (Y up, +Z to the room) to Blender's (Z up, -Y to the room)."""
    return (v.x, -v.z, v.y)


bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def material(name):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 1.0
    img = bpy.data.images.load(os.path.join(TEX, 'sheet.png' if name in SHEET else f'tile_{name}.png'), check_existing=True)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if name == 'cutout':
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        for attr, val in (('surface_render_method', 'DITHERED'), ('blend_method', 'CLIP')):
            try:
                setattr(mat, attr, val)
            except Exception:
                pass
    MATS[name] = mat
    return mat


def face_normal(geo, fc):
    n = Vector((0, 0, 0))
    for i in range(len(fc)):
        a, b = geo.v[fc[i]], geo.v[fc[(i + 1) % len(fc)]]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    return n.normalized() if n.length > 1e-12 else Vector((0, 1, 0))


random.seed(7)
HEMI = []
for _ in range(40):
    u, v = random.random(), random.random()
    r, t = math.sqrt(u), TAU * v
    HEMI.append(Vector((r * math.cos(t), r * math.sin(t), math.sqrt(1 - u))))


def bake_ao(o, by_name, reach=0.34):
    """Per-vertex ambient occlusion by ray casting, so creases and undersides go darker."""
    geo = o['geo']
    verts, faces = [], []
    for g in [geo] + [by_name[n]['geo'] for n in o['occluders']]:
        off = len(verts)
        verts += [tuple(p) for p in g.v]
        faces += [tuple(off + k for k in f) for f in g.f]
    tree = BVHTree.FromPolygons(verts, faces, all_triangles=False, epsilon=0.0)
    normal = [Vector((0, 0, 0)) for _ in geo.v]
    for f in geo.f:
        n = face_normal(geo, f)
        for k in f:
            normal[k] += n
    out = []
    for p, n in zip(geo.v, normal):
        if n.length < 1e-9:
            out.append(1.0)
            continue
        n = n.normalized()
        t = n.cross(Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))).normalized()
        b = n.cross(t)
        origin = p + n * 0.006
        hit = 0
        for h in HEMI:
            d = t * h.x + b * h.y + n * h.z
            if tree.ray_cast(origin, d, reach)[0] is not None:
                hit += 1
        out.append(1.0 - hit / len(HEMI))
    return out


def firelight(p, n):
    """What the torches and the dark do to a point on a wall. Stored at half strength, so fire can go past white."""
    r, g, b = 0.085, 0.075, 0.125
    for (x, y, z, strength, reach) in FIRES:
        d = Vector((x, y, z)) - p
        dist = max(d.length, 1e-4)
        facing = max(0.0, n.dot(d) / dist)
        a = strength * (0.2 + 0.8 * facing) / (1 + (dist / reach) ** 2.4)
        r += a
        g += a * 0.7
        b += a * 0.42
    return (min(r * 0.5, 1.0), min(g * 0.5, 1.0), min(b * 0.5, 1.0))


def build(o, by_name):
    geo, pivot = o['geo'], o['pivot']
    if geo is None:
        ob = bpy.data.objects.new(o['name'], None)
        bpy.context.scene.collection.objects.link(ob)
        for k, v in o['extras'].items():
            ob[k] = v
        return ob
    mesh = bpy.data.meshes.new(o['name'])
    mesh.from_pydata([P(v - pivot) for v in geo.v], [], [tuple(f) for f in geo.f])
    mesh.update()
    assert len(mesh.polygons) == len(geo.f), f"{o['name']}: {len(geo.f) - len(mesh.polygons)} faces were rejected"
    names = sorted({fa['mat'] for fa in geo.fa})
    for n in names:
        mesh.materials.append(material(n))
    for poly, fa in zip(mesh.polygons, geo.fa):
        poly.material_index = names.index(fa['mat'])
        poly.use_smooth = fa['smooth']
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(38):
            e.smooth = False
    bm.to_mesh(mesh)
    bm.free()

    baked = o['extras'].get('light') == 'baked'
    ao = bake_ao(o, by_name, 1.1 if baked else 0.34)
    uvl = mesh.uv_layers.new(name='UVMap')
    col = mesh.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    tile = ATLAS['tile']
    white = uv('white')
    wu, wv = (white[0][0] + white[2][0]) / 2, (white[0][1] + white[2][1]) / 2
    for poly, fa, fc in zip(mesh.polygons, geo.fa, geo.f):
        n = face_normal(geo, fc)
        ax = max(range(3), key=lambda k: abs(n[k]))
        ua, va = ((2, 1), (0, 2), (0, 1))[ax]
        for k, li in enumerate(poly.loop_indices):
            vi = fc[k]
            if fa['uv'] is not None:
                uvl.data[li].uv = fa['uv'][k]
            elif fa['mat'] in SHEET:
                uvl.data[li].uv = (wu, wv)  # a plain colour: the white square on the sheet
            else:
                p = geo.v[vi] - pivot
                uvl.data[li].uv = (p[ua] * fa['density'] / tile, p[va] * fa['density'] / tile)
            c = fa['color']
            if baked:
                shade = 0.5 + 0.5 * ao[vi] if fa['ao'] else 1.0
                lr, lg, lb = firelight(geo.v[vi], n)
                col.data[li].color_srgb = (min(1, c[0] * shade * lr), min(1, c[1] * shade * lg), min(1, c[2] * shade * lb), 1.0)
            else:
                shade = 0.42 + 0.58 * ao[vi] ** 0.9 if fa['ao'] else 1.0
                col.data[li].color_srgb = (c[0] * shade, c[1] * shade, c[2] * shade, 1.0)
    mesh.color_attributes.active_color = col
    try:
        mesh.color_attributes.render_color_index = 0
    except Exception:
        pass
    ob = bpy.data.objects.new(o['name'], mesh)
    bpy.context.scene.collection.objects.link(ob)
    for k, v in o['extras'].items():
        ob[k] = v
    return ob


by_name = {o['name']: o for o in OBJECTS}
# an object given a `matrix` was modelled at its own origin; move its faces to where it stands, and its pivot with them
for o in OBJECTS:
    m = o.get('matrix')
    if m is None:
        continue
    if o['geo'] is not None:
        o['geo'].v = [m @ p for p in o['geo'].v]
    o['pivot'] = m @ o['pivot']
    # children were modelled in this object's space too
    for c in OBJECTS:
        if c['parent'] == o['name'] and c.get('matrix') is None:
            if c['geo'] is not None:
                c['geo'].v = [m @ p for p in c['geo'].v]
            c['pivot'] = m @ c['pivot']
            for cc in OBJECTS:
                if cc['parent'] == c['name'] and cc.get('matrix') is None:
                    if cc['geo'] is not None:
                        cc['geo'].v = [m @ p for p in cc['geo'].v]
                    cc['pivot'] = m @ cc['pivot']
    # which way the object was facing when it was put down, for anything the page moves along that line
    zx = m.to_3x3() @ Vector((0, 0, 1))
    o['extras']['facing'] = [zx.x, zx.y, zx.z]

built = {}
tris = 0
for o in OBJECTS:
    built[o['name']] = build(o, by_name)
    if o['geo'] is not None:
        tris += sum(len(f) - 2 for f in o['geo'].f)
for o in OBJECTS:
    ob = built[o['name']]
    if o['parent']:
        ob.parent = built[o['parent']]
        ob.location = P(o['pivot'] - by_name[o['parent']]['pivot'])
    else:
        ob.location = P(o['pivot'])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(filepath=OUT, export_format='GLB', export_yup=True, export_apply=False, export_extras=True, export_normals=True, export_texcoords=True, export_materials='EXPORT', export_animations=False, export_cameras=False, export_lights=False)
for extra in (dict(export_vertex_color='ACTIVE', export_all_vertex_colors=False), dict(export_vertex_color='ACTIVE'), dict(export_colors=True), {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra)
        break
    except TypeError as e:
        print('export option not accepted, trying the next set:', e)
print(f'\n{len(OBJECTS)} objects, {tris} triangles -> {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
for o in OBJECTS:
    if o['geo'] is None:
        continue
    a, b = o['geo'].bounds()
    print(f"  {o['name']:<16} parent={str(o['parent']):<13} tris={sum(len(f) - 2 for f in o['geo'].f):<5} size=({b.x - a.x:.2f}, {b.y - a.y:.2f}, {b.z - a.z:.2f})")
