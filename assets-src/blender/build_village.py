"""환경이 마을 에셋 생성 (Blender 4.5, bpy) → village.glb

각 에셋은 원점(바닥 중심)에 놓인 독립 오브젝트이고, 이름으로 코드에서 찾아 복제·배치한다.
좌표: Blender Z 위, 정면 -Y (glTF에서는 Y 위, 정면 +Z).
색은 정점색. lupine_spike·daisy_petals 처럼 흰색 위주 에셋은 코드에서 인스턴스 색으로 물들인다.
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (MeshBuilder, hexc, mix, mul, reset_scene, material, lens_leaf, place_leaf,
                 frame_map, tube, apply_modifiers, join, tri_count, link)

OUT = os.path.abspath(sys.argv[-1]) if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.abspath('build')
sc = reset_scene()
M_ENV = material('env', rough=0.85, spec=0.35)
M_GLOW = material('env_glow', rough=0.5, vcol=True, emission=hexc('#FFC766'), emission_strength=1.2)
M_METAL = material('env_metal', rough=0.35, metallic=0.6)
M_2SIDE = material('env_2side', rough=0.8, spec=0.3)
M_2SIDE.use_backface_culling = False

ASSETS = []


def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ao(c, z, h=0.25):
    return mul(c, 0.72 + 0.28 * smooth01(z / h))


def bm_obj(bm, name, color_fn, mat=M_ENV, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    link(obj)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        c = color_fn(v.co, v.normal)
        attr.data[i].color = (c[0], c[1], c[2], 1.0)
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(mat)
    return obj


def xform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    m = Matrix.Translation(Vector(loc)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((*scale, 1)))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)


def jitter(bm, amt, seed=0, freq=2.0):
    off = Vector((seed * 1.7, seed * 3.1, seed * 5.3))
    for v in bm.verts:
        n = noise.noise_vector(v.co * freq + off)
        v.co += n * amt


def ico(r, sub=2, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), color=None, jit=0.0, seed=0, name='ico', mat=M_ENV, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    if jit:
        jitter(bm, jit * r, seed)
    xform(bm, loc, rot, scale)
    return bm_obj(bm, name, color if callable(color) else (lambda co, n, c=color: c), mat, smooth)


def cyl(r1, r2, depth, segs=12, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), color=None, caps=True, name='cyl',
        mat=M_ENV, smooth=True, jit=0.0, seed=0, base_at_zero=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    if base_at_zero:
        bmesh.ops.translate(bm, vec=(0, 0, depth / 2), verts=bm.verts)
    if jit:
        jitter(bm, jit, seed, 3.0)
    xform(bm, loc, rot, scale)
    return bm_obj(bm, name, color if callable(color) else (lambda co, n, c=color: c), mat, smooth)


def box(size, loc=(0, 0, 0), rot=(0, 0, 0), color=None, bevel=0.0, name='box', mat=M_ENV, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel / max(size), segments=2,
                        affect='EDGES', profile=0.5)
    xform(bm, (0, 0, 0), (0, 0, 0), size)
    xform(bm, loc, rot)
    return bm_obj(bm, name, color if callable(color) else (lambda co, n, c=color: c), mat, smooth)


def mb_obj(mb, name, mat=M_ENV):
    return mb.build(name, mat)


def asset(name, objs):
    obj = join(objs, name)
    ASSETS.append(obj)
    return obj


rng = random.Random(7)

# ── 공통 색 ──────────────────────────────────────────────────
BARK = hexc('#8A5A3A')
BARK_DARK = hexc('#5E3C26')
BARK_LIGHT = hexc('#B98457')
MOSS = hexc('#6DAF3C')
MOSS_LIGHT = hexc('#A3D35A')
LEAF_D = hexc('#2F7430')
LEAF_M = hexc('#4E9A3A')
LEAF_L = hexc('#86C150')
STONE = hexc('#A3A49B')
STONE_D = hexc('#7D7F77')
WOOD = hexc('#C48A55')
WOOD_D = hexc('#94643A')
CREAM = hexc('#F6EBD2')
SOIL = hexc('#5B3E2A')
WHITE = (1.0, 1.0, 1.0)
GRASS_D = hexc('#4E9A34')
GRASS_L = hexc('#9ED35A')


def bark_color(co, n):
    a = math.atan2(co.y, co.x)
    groove = 0.5 + 0.5 * math.sin(a * 17 + noise.noise(co * 3) * 3)
    c = mix(BARK_DARK, BARK_LIGHT, 0.25 + 0.55 * groove)
    return ao(c, co.z, 0.4)


def canopy_color(center):
    def f(co, n):
        up = (co.z - center.z)
        c = mix(LEAF_D, LEAF_L, smooth01(0.5 + up * 0.9 + n.z * 0.25))
        c = mix(c, LEAF_M, 0.25 + 0.25 * noise.noise(co * 2.5))
        return c
    return f


# ════════════════════════════════════════════════════════════
# 나무둥치 집
# ════════════════════════════════════════════════════════════
def house():
    parts = []
    parts.append(cyl(1.08, 0.9, 1.75, segs=28, color=bark_color, jit=0.035, seed=1, name='trunk'))
    for i in range(6):
        a = i * math.tau / 6 + 0.4
        parts.append(ico(0.34, 2, loc=(math.cos(a) * 1.02, math.sin(a) * 1.02, 0.1), scale=(1.6, 0.8, 0.55),
                         rot=(0, 0, a), color=bark_color, jit=0.12, seed=i))
    cap = lambda co, n: mix(MOSS, MOSS_LIGHT, smooth01((co.z - 1.75) * 2.2 + 0.2 * noise.noise(co * 3)))
    parts.append(ico(1.0, 3, loc=(0, 0, 1.78), scale=(1.1, 1.1, 0.42), color=cap, jit=0.05, seed=3))
    for k in range(9):  # 이끼 드리움
        a = k * math.tau / 9 + 0.2
        parts.append(ico(0.22, 2, loc=(math.cos(a) * 1.02, math.sin(a) * 1.02, 1.62), scale=(1.1, 1.1, 0.7), color=cap, jit=0.2, seed=k + 10))
    # 버섯
    for (x, y, s) in [(0.35, 0.2, 1.0), (0.12, 0.42, 0.7), (-0.4, -0.1, 0.8)]:
        parts.append(cyl(0.06 * s, 0.05 * s, 0.22 * s, 10, loc=(x, y, 2.05), color=CREAM))
        parts.append(ico(0.16 * s, 2, loc=(x, y, 2.05 + 0.22 * s), scale=(1, 1, 0.55),
                         color=lambda co, n: mix(hexc('#C9562F'), hexc('#EE8A4E'), smooth01(n.z))))
    # 문 (정면 -Y)
    door_rot = (math.pi / 2, 0, 0)
    parts.append(cyl(0.5, 0.5, 0.12, 24, loc=(0, -0.93, 0.6), rot=door_rot, color=BARK_DARK, name='door_frame'))
    parts.append(cyl(0.42, 0.42, 0.14, 24, loc=(0, -0.97, 0.6), rot=door_rot,
                     color=lambda co, n: mix(WOOD_D, WOOD, 0.5 + 0.5 * math.sin(co.x * 38)), name='door'))
    parts.append(ico(0.045, 1, loc=(0.25, -1.12, 0.55), color=hexc('#E3B341')))
    # 둥근 창
    wa = math.radians(-58)
    wd = Vector((math.sin(-wa), -math.cos(-wa), 0))
    wpos = Vector((0, 0, 1.12)) + Vector((math.cos(math.radians(-40)), math.sin(math.radians(-40)), 0)) * 0.94
    wrot = (math.pi / 2, 0, math.radians(50))
    parts.append(cyl(0.24, 0.24, 0.1, 20, loc=wpos, rot=wrot, color=BARK_DARK))
    glow = cyl(0.19, 0.19, 0.12, 20, loc=wpos + Vector((0.01, -0.01, 0)), rot=wrot, color=hexc('#FFD58A'), mat=M_GLOW)
    parts.append(glow)
    # 문 앞 디딤돌
    for (x, y, s) in [(0.0, -1.35, 1.0), (0.25, -1.75, 0.8)]:
        parts.append(ico(0.3 * s, 2, loc=(x, y, 0.0), scale=(1.2, 1.0, 0.25),
                         color=lambda co, n: mix(STONE_D, STONE, smooth01(n.z)), jit=0.15, seed=int(x * 10)))
    return asset('house_stump', parts)


# ════════════════════════════════════════════════════════════
# 나무·덤불
# ════════════════════════════════════════════════════════════
def tree(name, seed, height=2.2, blobs=7, spread=1.0):
    r = random.Random(seed)
    parts = [cyl(0.2, 0.13, height, 12, color=bark_color, jit=0.02, seed=seed, name='trunk')]
    for side in (-1, 1):
        mb = MeshBuilder()
        tube(mb, [(0, 0, height * 0.55), (side * 0.35, 0.05, height * 0.75), (side * 0.55, 0.0, height * 0.92)],
             [0.07, 0.05, 0.035], segs=7, color=BARK)
        parts.append(mb_obj(mb, 'branch'))
    cz = height + 0.55
    center = Vector((0, 0, cz))
    col = canopy_color(center)
    parts.append(ico(0.95 * spread, 2, loc=(0, 0, cz), scale=(1, 1, 0.85), color=col, jit=0.08, seed=seed))
    for i in range(blobs):
        a = i * math.tau / blobs + r.random() * 0.5
        rr = 0.62 * spread + r.random() * 0.15
        rad = (0.5 + r.random() * 0.2) * spread
        parts.append(ico(rad, 2, loc=(math.cos(a) * rr, math.sin(a) * rr, cz - 0.15 + r.random() * 0.55),
                         color=col, jit=0.1, seed=seed + i))
    parts.append(ico(0.55 * spread, 2, loc=(0.1, -0.05, cz + 0.62), color=col, jit=0.1, seed=seed + 50))
    return asset(name, parts)


def bare_tree(name, seed, height=2.3):
    r = random.Random(seed)
    dead = lambda co, n: ao(mix(hexc('#4A3B31'), hexc('#7A6858'), 0.4 + 0.3 * noise.noise(co * 4)), co.z, 0.4)
    parts = [cyl(0.19, 0.08, height + 0.4, 10, color=dead, jit=0.03, seed=seed)]
    for i in range(6):
        a = i * math.tau / 6 + r.random()
        h0 = height * (0.45 + 0.1 * i)
        L = 0.9 - i * 0.08
        p0 = Vector((0, 0, h0))
        p1 = p0 + Vector((math.cos(a) * L * 0.5, math.sin(a) * L * 0.5, 0.35))
        p2 = p0 + Vector((math.cos(a + 0.3) * L, math.sin(a + 0.3) * L, 0.45 + r.random() * 0.3))
        mb = MeshBuilder()
        tube(mb, [p0, p1, p2], [0.05, 0.03, 0.012], segs=6, color=hexc('#5A4A3E'))
        tw = p1 + (p2 - p1) * 0.5
        tube(mb, [tw, tw + Vector((math.cos(a - 0.8) * 0.25, math.sin(a - 0.8) * 0.25, 0.25))], [0.018, 0.006], segs=5,
             color=hexc('#5A4A3E'))
        parts.append(mb_obj(mb, 'br'))
    return asset(name, parts)


def bush(name, seed, size=1.0):
    r = random.Random(seed)
    parts = []
    center = Vector((0, 0, 0.35 * size))
    col = canopy_color(center)
    for i in range(4):
        a = i * math.tau / 4 + r.random()
        parts.append(ico((0.38 + r.random() * 0.12) * size, 2,
                         loc=(math.cos(a) * 0.3 * size, math.sin(a) * 0.25 * size, 0.28 * size + r.random() * 0.1),
                         color=col, jit=0.1, seed=seed + i))
    parts.append(ico(0.42 * size, 2, loc=(0, 0, 0.45 * size), color=col, jit=0.1, seed=seed + 9))
    return asset(name, parts)


# ════════════════════════════════════════════════════════════
# 꽃·풀 (인스턴싱용, 가벼운 모양)
# ════════════════════════════════════════════════════════════
def petal_ring(mb, center, n, L, W, color, tilt=0.35, lift=0.0, twist=0.0):
    for i in range(n):
        a = i * math.tau / n + twist
        along = Vector((math.cos(a), math.sin(a), tilt))
        nrm = Vector((-math.cos(a) * tilt, -math.sin(a) * tilt, 1))
        lf = lens_leaf(L, W, W * 0.25, nu=3, nv=2, cup=0.1, c_base=color, c_tip=color, groove=0.0, c_back=0.9, rib_dark=1.0)
        place_leaf(mb, lf, frame_map(Vector(center) + Vector((0, 0, lift)), along, nrm))


def daisy():
    stem = MeshBuilder()
    tube(stem, [(0, 0, 0), (0.01, 0, 0.14), (0, 0.01, 0.27)], [0.008, 0.007, 0.006], segs=5, color=GRASS_D, color_end=GRASS_L)
    for s in (-1, 1):
        lf = lens_leaf(0.09, 0.035, 0.008, nu=4, nv=2, c_base=GRASS_D, c_tip=GRASS_L)
        place_leaf(stem, lf, frame_map((0, 0, 0.02), (s * 0.8, 0.1, 0.5), (0, 0, 1)))
    top = ico(0.028, 1, loc=(0, 0.01, 0.285), scale=(1, 1, 0.55), color=hexc('#F4C23A'))
    stem_o = mb_obj(stem, 'stem')
    asset('daisy_stem', [stem_o, top])
    petals = MeshBuilder()
    petal_ring(petals, (0, 0.01, 0.28), 11, 0.06, 0.022, WHITE, tilt=0.15)
    asset('daisy_petals', [mb_obj(petals, 'petals')])


def forgetmenot():
    mb = MeshBuilder()
    tube(mb, [(0, 0, 0), (0, 0.005, 0.1)], [0.005, 0.004], segs=4, color=GRASS_D)
    lf = lens_leaf(0.05, 0.025, 0.006, nu=3, nv=2, c_base=GRASS_D, c_tip=GRASS_L)
    place_leaf(mb, lf, frame_map((0, 0, 0.01), (0.7, 0.2, 0.4), (0, 0, 1)))
    c = mb_obj(mb, 'fstem')
    ctr = ico(0.008, 1, loc=(0, 0.005, 0.108), color=hexc('#F6D65A'))
    p = MeshBuilder()
    petal_ring(p, (0, 0.005, 0.104), 5, 0.02, 0.018, WHITE, tilt=0.1)
    asset('forgetmenot_stem', [c, ctr])
    asset('forgetmenot_petals', [mb_obj(p, 'fp')])


def lupine():
    mb = MeshBuilder()
    tube(mb, [(0, 0, 0), (0.01, 0, 0.3), (0, 0, 0.62)], [0.012, 0.01, 0.006], segs=5, color=GRASS_D)
    for i in range(6):
        a = i * math.tau / 6
        lf = lens_leaf(0.13, 0.028, 0.008, nu=4, nv=2, c_base=GRASS_D, c_tip=GRASS_L, bend=-0.2)
        place_leaf(mb, lf, frame_map((0, 0, 0.05), (math.cos(a), math.sin(a), 0.25), (0, 0, 1)))
    asset('lupine_stem', [mb_obj(mb, 'lstem')])
    spike = MeshBuilder()
    rows = 8
    for j in range(rows):
        t = j / (rows - 1)
        z = 0.3 + t * 0.38
        rr = 0.045 * (1 - t * 0.75)
        n = max(3, int(5 - t * 2))
        shade = mix(mul(WHITE, 0.9), WHITE, t)
        for i in range(n):
            a = i * math.tau / n + j * 0.5
            c = Vector((math.cos(a) * rr, math.sin(a) * rr, z))
            lf = lens_leaf(0.036 * (1 - t * 0.4), 0.034 * (1 - t * 0.4), 0.014, nu=2, nv=2, cup=0.3,
                           c_base=shade, c_tip=shade, groove=0.0, c_back=0.85, rib_dark=1.0)
            place_leaf(spike, lf, frame_map(c - Vector((math.cos(a), math.sin(a), 0)) * 0.012,
                                            (math.cos(a), math.sin(a), -0.35), (math.cos(a) * 0.3, math.sin(a) * 0.3, 1)))
    asset('lupine_spike', [mb_obj(spike, 'spike')])


def grass():
    mb = MeshBuilder()
    r = random.Random(3)
    for i in range(7):
        a = i * math.tau / 7 + r.random() * 0.5
        h = 0.14 + r.random() * 0.1
        base = Vector((math.cos(a) * 0.02, math.sin(a) * 0.02, 0))
        tipd = Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, h))
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.012
        v0 = mb.add_vertex(base - side, GRASS_D)
        v1 = mb.add_vertex(base + side, GRASS_D)
        v2 = mb.add_vertex(base + tipd * 0.5 + side * 0.7 + Vector((0, 0, 0.02)), mix(GRASS_D, GRASS_L, 0.5))
        v3 = mb.add_vertex(base + tipd * 0.5 - side * 0.7 + Vector((0, 0, 0.02)), mix(GRASS_D, GRASS_L, 0.5))
        v4 = mb.add_vertex(base + tipd, GRASS_L)
        mb.add_face((v0, v1, v2, v3))
        mb.add_face((v3, v2, v4))
    asset('grass_tuft', [mb_obj(mb, 'g', M_2SIDE)])


def mushrooms():
    parts = []
    for (x, y, s) in [(0, 0, 1.0), (0.12, 0.05, 0.7), (-0.08, 0.1, 0.55)]:
        parts.append(cyl(0.03 * s, 0.025 * s, 0.13 * s, 8, loc=(x, y, 0), color=CREAM))
        parts.append(ico(0.08 * s, 2, loc=(x, y, 0.13 * s), scale=(1, 1, 0.6),
                         color=lambda co, n: mix(hexc('#B8492B'), hexc('#E7874A'), smooth01(n.z))))
    asset('mushrooms', parts)


# ════════════════════════════════════════════════════════════
# 바위·돌·물고기·통나무
# ════════════════════════════════════════════════════════════
def rock(name, seed, scale=(1, 1, 0.7), moss=True):
    col = lambda co, n: mix(mix(STONE_D, STONE, smooth01(n.z * 0.8 + 0.4)), MOSS, smooth01((n.z - 0.6) * 3) * (0.8 if moss else 0))
    asset(name, [ico(0.35, 2, loc=(0, 0, 0.1), scale=scale, color=col, jit=0.22, seed=seed)])


def fish():
    col = lambda co, n: mix(hexc('#DCE8E6'), hexc('#6F8F8C'), smooth01(co.z * 12 + 0.3))
    body = ico(0.07, 2, loc=(0, 0, 0), scale=(0.55, 1.6, 0.75), color=col)
    tail = cyl(0.0, 0.06, 0.1, 6, loc=(0, 0.1, 0), rot=(math.pi / 2, 0, 0), scale=(0.25, 1, 1), color=hexc('#7C9A96'), base_at_zero=False)
    eye1 = ico(0.009, 1, loc=(0.03, -0.065, 0.012), color=hexc('#1E2522'))
    eye2 = ico(0.009, 1, loc=(-0.03, -0.065, 0.012), color=hexc('#1E2522'))
    asset('fish', [body, tail, eye1, eye2])


def log():
    parts = [cyl(0.2, 0.2, 1.2, 14, loc=(-0.6, 0, 0.2), rot=(0, math.pi / 2, 0), color=bark_color, base_at_zero=True, jit=0.02)]
    for x in (-0.6, 0.6):
        parts.append(cyl(0.17, 0.17, 0.02, 14, loc=(x - (0.01 if x < 0 else -0.01), 0, 0.2), rot=(0, math.pi / 2, 0),
                         color=hexc('#E0B27A'), base_at_zero=False))
    parts.append(ico(0.08, 1, loc=(0.2, -0.05, 0.4), scale=(1.5, 1, 0.6), color=MOSS))
    asset('log', parts)


# ════════════════════════════════════════════════════════════
# 벤치·표지판·분리수거함·텃밭·우편함
# ════════════════════════════════════════════════════════════
def bench():
    parts = []
    for x in (-0.45, 0.45):
        parts.append(cyl(0.14, 0.15, 0.3, 12, loc=(x, 0, 0), color=bark_color))
    seat = cyl(0.19, 0.19, 1.2, 14, loc=(-0.6, 0, 0.36), rot=(0, math.pi / 2, 0), scale=(1, 1, 1),
               color=lambda co, n: mix(bark_color(co, n), hexc('#E2B57E'), smooth01((n.z - 0.6) * 4)))
    parts.append(seat)
    return asset('bench', parts)


def sign():
    parts = []
    for x in (-0.55, 0.55):
        parts.append(cyl(0.05, 0.045, 1.05, 8, loc=(x, 0, 0), color=bark_color))
    parts.append(box((1.35, 0.08, 0.46), loc=(0, 0, 0.78), color=lambda co, n: mix(WOOD_D, WOOD, 0.6 + 0.3 * math.sin(co.z * 40)), bevel=0.03))
    parts.append(box((1.45, 0.1, 0.06), loc=(0, 0, 1.04), color=BARK, bevel=0.02))
    for (x, s) in [(-0.62, 1.0), (0.5, 0.8)]:
        parts.append(ico(0.12 * s, 2, loc=(x, -0.05, 0.02), color=canopy_color(Vector((x, 0, 0.1))), jit=0.2))
    return asset('sign', parts)


def recycle_bins():
    parts = []
    cols = [hexc('#6FA8DC'), hexc('#F2C14E'), hexc('#E27D60')]
    for i, c in enumerate(cols):
        x = (i - 1) * 0.42
        parts.append(box((0.36, 0.34, 0.46), loc=(x, 0, 0.23), color=lambda co, n, c=c: ao(mul(c, 0.92), co.z, 0.2), bevel=0.03))
        parts.append(box((0.4, 0.38, 0.06), loc=(x, 0, 0.49), color=mul(c, 1.08), bevel=0.02))
        parts.append(box((0.24, 0.02, 0.14), loc=(x, -0.175, 0.3), color=CREAM, bevel=0.005))
    return asset('recycle_bins', parts)


def garden_bed():
    parts = []
    W, D, H = 1.5, 0.8, 0.2
    for (sx, sy, lx, ly) in [(W, 0.08, 0, -D / 2), (W, 0.08, 0, D / 2), (0.08, D, -W / 2, 0), (0.08, D, W / 2, 0)]:
        parts.append(box((sx, sy, H), loc=(lx, ly, H / 2), color=lambda co, n: mix(WOOD_D, WOOD, 0.4 + 0.4 * math.sin(co.x * 20 + co.y * 20)), bevel=0.015))
    parts.append(box((W - 0.06, D - 0.06, 0.05), loc=(0, 0, H - 0.04), color=SOIL, bevel=0.01))
    for row in (-0.18, 0.18):
        for k in range(5):
            x = -0.55 + k * 0.275
            mb = MeshBuilder()
            tube(mb, [(x, row, H - 0.02), (x, row, H + 0.06)], [0.006, 0.005], segs=4, color=GRASS_D)
            for s in (-1, 1):
                lf = lens_leaf(0.06, 0.04, 0.008, nu=4, nv=2, c_base=GRASS_D, c_tip=GRASS_L, bend=0.2)
                place_leaf(mb, lf, frame_map((x, row, H + 0.055), (s * 0.8, 0, 0.5), (0, -0.2, 1)))
            parts.append(mb_obj(mb, 'sp'))
    return asset('garden_bed', parts)


def mailbox():
    parts = [cyl(0.04, 0.04, 0.9, 8, color=bark_color)]
    parts.append(box((0.24, 0.36, 0.18), loc=(0, 0, 0.98), color=hexc('#7FB3A8'), bevel=0.02))
    parts.append(cyl(0.12, 0.12, 0.36, 12, loc=(0, 0.18, 1.07), rot=(math.pi / 2, 0, 0), scale=(1, 0.8, 1), color=hexc('#8FC2B6')))
    parts.append(box((0.02, 0.02, 0.16), loc=(0.13, 0.05, 1.08), color=hexc('#D9534F')))
    parts.append(box((0.02, 0.08, 0.05), loc=(0.13, 0.02, 1.15), color=hexc('#D9534F')))
    return asset('mailbox', parts)


# ════════════════════════════════════════════════════════════
# 손 소품 (원점 = 손잡이)
# ════════════════════════════════════════════════════════════
def watering_can():
    blue = hexc('#7EC8E3')
    blue_d = hexc('#4F9BBF')
    col = lambda co, n: mix(blue_d, blue, smooth01(n.z * 0.5 + 0.6))
    parts = [cyl(0.075, 0.068, 0.12, 16, loc=(0, 0.02, -0.14), color=col)]
    parts.append(cyl(0.068, 0.02, 0.03, 16, loc=(0, 0.02, -0.02), color=col))
    mb = MeshBuilder()
    tube(mb, [(0, -0.03, -0.1), (0, -0.1, -0.07), (0, -0.17, -0.02)], [0.016, 0.013, 0.011], segs=8, color=blue_d, color_end=blue)
    tube(mb, [(0, 0.02, -0.02), (0, 0.02, 0.03), (0, 0.06, 0.04), (0, 0.1, 0.0), (0, 0.095, -0.06)], [0.011] * 5, segs=6, color=blue_d)
    parts.append(mb_obj(mb, 'spout'))
    parts.append(cyl(0.012, 0.032, 0.03, 10, loc=(0, -0.17, -0.02), rot=(math.radians(-60), 0, 0), color=blue_d))
    obj = asset('prop_watering_can', parts)
    return obj


def broom():
    straw = hexc('#D9B25B')
    parts = [cyl(0.012, 0.012, 0.62, 8, loc=(0, 0, -0.42), color=WOOD)]
    parts.append(cyl(0.028, 0.1, 0.2, 12, loc=(0, 0, -0.40), rot=(math.pi, 0, 0), scale=(1, 0.45, 1),
                     color=lambda co, n: mix(mul(straw, 0.8), straw, 0.5 + 0.5 * math.sin(co.x * 120))))
    parts.append(cyl(0.032, 0.032, 0.025, 10, loc=(0, 0, -0.44), scale=(1, 0.6, 1), color=hexc('#8A5A2B')))
    return asset('prop_broom', parts)


def trowel():
    parts = [cyl(0.014, 0.012, 0.09, 8, loc=(0, 0, -0.045), color=WOOD)]
    mb = MeshBuilder()
    lf = lens_leaf(0.12, 0.07, 0.01, nu=6, nv=3, cup=0.12, c_base=hexc('#9AA3A8'), c_tip=hexc('#C7CED2'), groove=0.0)
    place_leaf(mb, lf, frame_map((0, 0, -0.05), (0, -0.25, -1), (0, -1, 0.2)))
    parts.append(mb_obj(mb, 'blade', M_METAL))
    return asset('prop_trowel', parts)


# ════════════════════════════════════════════════════════════
# 쓰레기 (sad 단계)
# ════════════════════════════════════════════════════════════
def trash():
    red = hexc('#C9453C')
    silver = hexc('#C9CDD1')
    can = lambda co, n: silver if abs(n.z) > 0.7 else mix(red, WHITE, 0.2 * (math.sin(co.z * 80) > 0.6))
    asset('trash_can', [cyl(0.045, 0.045, 0.13, 12, loc=(0, 0.065, 0.045), rot=(math.pi / 2, 0.3, 0), scale=(1, 0.75, 1),
                            color=can, jit=0.006, seed=2)])
    bottle = lambda co, n: mix(hexc('#A8D8EA'), hexc('#E3F4FA'), smooth01(n.z * 0.5 + 0.5))
    b = [cyl(0.045, 0.045, 0.16, 12, loc=(0, 0.1, 0.045), rot=(math.pi / 2, 0, 0), color=bottle),
         cyl(0.045, 0.018, 0.05, 12, loc=(0, -0.06, 0.045), rot=(math.pi / 2, 0, 0), color=bottle),
         cyl(0.02, 0.02, 0.025, 10, loc=(0, -0.11, 0.045), rot=(math.pi / 2, 0, 0), color=hexc('#3E7CC2'))]
    asset('trash_bottle', b)
    # 마스크: 주름진 곡면 + 끈
    mb = MeshBuilder()
    nx, nz = 8, 5
    idx = {}
    for i in range(nx + 1):
        for j in range(nz + 1):
            x = (i / nx - 0.5) * 0.17
            z = (j / nz - 0.5) * 0.09
            y = -0.03 * math.cos(x / 0.17 * math.pi) + 0.004 * math.sin(j * math.pi)
            c = mix(hexc('#9CCBE3'), hexc('#CFE7F3'), 0.5 + 0.5 * math.sin(j * math.pi))
            idx[i, j] = mb.add_vertex((x, z + 0.05, y + 0.012), c)
    for i in range(nx):
        for j in range(nz):
            mb.add_face((idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
    for s in (-1, 1):
        tube(mb, [(s * 0.085, 0.03, 0.01), (s * 0.13, 0.05, 0.006), (s * 0.085, 0.07, 0.01)], [0.003] * 3, segs=4, color=WHITE)
    asset('trash_mask', [mb_obj(mb, 'mask', M_2SIDE)])
    asset('trash_bag', [ico(0.1, 2, loc=(0, 0, 0.06), scale=(1.2, 1, 0.6),
                            color=lambda co, n: mix(hexc('#BFC3C0'), hexc('#EEEEE8'), smooth01(n.z + noise.noise(co * 20))),
                            jit=0.5, seed=5)])
    cb = lambda co, n: ao(mix(hexc('#9A7650'), hexc('#C29A6A'), smooth01(n.z)), co.z, 0.2)
    asset('trash_box', [box((0.32, 0.26, 0.22), loc=(0, 0, 0.1), rot=(0, 0.12, 0.3), color=cb, bevel=0.01),
                        box((0.3, 0.02, 0.12), loc=(0.02, -0.18, 0.24), rot=(0.9, 0.12, 0.3), color=cb)])
    rust = lambda co, n: mix(hexc('#6E3B22'), hexc('#A5623A'), 0.5 + 0.5 * noise.noise(co * 9)) if abs(math.sin(co.z * 9)) > 0.25 else hexc('#4A2B1C')
    asset('trash_barrel', [cyl(0.22, 0.22, 0.62, 16, loc=(0, 0.31, 0.22), rot=(math.pi / 2, 0, 0.4), color=rust, jit=0.01)])


# ════════════════════════════════════════════════════════════
# 공장·구름
# ════════════════════════════════════════════════════════════
def factory():
    wall = lambda co, n: ao(mix(hexc('#6F665D'), hexc('#8F867B'), smooth01(n.z * 0.5 + 0.5)), co.z, 1.0)
    parts = [box((3.0, 1.6, 1.6), loc=(0, 0, 0.8), color=wall)]
    for k in range(3):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=3, radius1=0.6, radius2=0.6, depth=1.6)
        m = (Matrix.Translation((-1.0 + k * 1.0, 0, 1.6 + 0.18)) @ Matrix.Rotation(math.pi / 2, 4, 'X')
             @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Diagonal((0.9, 0.5, 1, 1)))
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        parts.append(bm_obj(bm, 'roof', lambda co, n: hexc('#5B534B'), smooth=False))
    for (x, h) in [(-1.1, 3.8), (0.6, 4.4), (1.3, 3.2)]:
        parts.append(cyl(0.2, 0.16, h, 10, loc=(x, 0.4, 0), color=lambda co, n: hexc('#3C3632') if co.z > 2.9 else hexc('#7B7069')))
    for i in range(6):
        for j in range(2):
            parts.append(box((0.26, 0.04, 0.26), loc=(-1.2 + i * 0.48, -0.81, 0.45 + j * 0.55), color=hexc('#2F2B28')))
    return asset('factory', parts)


def cloud():
    col = lambda co, n: mix(hexc('#DCE6EE'), WHITE, smooth01(n.z * 0.6 + 0.5))
    parts = []
    for (x, z, r) in [(0, 0.2, 0.7), (-0.75, 0.05, 0.5), (0.75, 0.05, 0.55), (-0.3, 0.45, 0.45), (0.35, 0.4, 0.5)]:
        parts.append(ico(r, 2, loc=(x, 0, z), scale=(1, 0.8, 0.85), color=col))
    return asset('cloud', parts)


# ════════════════════════════════════════════════════════════
house()
tree('tree_a', 11, 2.2, 7, 1.0)
tree('tree_b', 23, 2.6, 6, 1.15)
tree('tree_c', 37, 1.7, 6, 0.85)
bare_tree('tree_bare_a', 5, 2.4)
bare_tree('tree_bare_b', 9, 2.0)
bush('bush_a', 3, 1.0)
bush('bush_b', 8, 0.75)
daisy()
forgetmenot()
lupine()
grass()
mushrooms()
rock('rock_a', 1)
rock('rock_b', 4, (1.3, 1.0, 0.55))
rock('stone_flat', 6, (1.1, 0.9, 0.22), moss=False)
fish()
log()
bench()
sign()
recycle_bins()
garden_bed()
mailbox()
watering_can()
broom()
trowel()
trash()
factory()
cloud()

total = 0
for i, a in enumerate(ASSETS):
    a.location = (0, 0, 0)
    n = tri_count(a)
    total += n
    print(f'  {a.name:22s} {n:6d}')
print('TOTAL', total)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'village_assets.blend'))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'village.glb'), export_format='GLB', export_yup=True,
    export_materials='EXPORT', export_vertex_color='MATERIAL', export_all_vertex_colors=False,
    export_animations=False, export_skins=False, export_normals=True, export_texcoords=False)
print('exported', os.path.getsize(os.path.join(OUT, 'village.glb')) // 1024, 'KB')
