"""환경이 캐릭터 모델 생성 (Blender 4.5, bpy).

실행: python build_character.py <텍스처 폴더> <출력 폴더>
좌표: Blender 기준 Z 위, 캐릭터 정면 -Y, 캐릭터 오른쪽 -X. glTF로 내보내면 Y 위, 정면 +Z.
모든 부품은 뼈 하나에 100%(망토·끈은 두 뼈 사이 보간) 가중치를 준 스킨 메시다.
"""
import math
import os
import sys

import bpy
from mathutils import Vector, Quaternion, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (MeshBuilder, hexc, mix, mul, reset_scene, material, lens_leaf, place_leaf,
                 frame_map, sph, sphere_map, cone_map, tube, uv_sphere, paint_vertices,
                 weight_all, apply_modifiers, to_mesh_object, join, tri_count, link)

TEX = os.path.abspath(sys.argv[-2]) if len(sys.argv) >= 3 else os.path.abspath('build/tex')
OUT = os.path.abspath(sys.argv[-1]) if len(sys.argv) >= 3 else os.path.abspath('build')
os.makedirs(OUT, exist_ok=True)

# ── 치수 (미터) ──────────────────────────────────────────────
HIP_Z = 0.205
TORSO_Z = 0.315
NECK_Z = 0.425
HEAD_Z = 0.655
HEAD_R = 0.235
HEAD_SCALE = (1.0, 0.93, 0.96)
FACE_HALF = 0.21           # make_textures.py 와 같아야 한다
HOOD_C = Vector((0.0, 0.014, HEAD_Z + 0.014))
HOOD_R = 0.262
HOOD_TOP = HOOD_C.z + HOOD_R * 0.98
SHOULDER = Vector((0.118, 0.0, 0.385))
ARM_DOWN = math.radians(38)
ARM_LEN = 0.145
HIP = Vector((0.072, 0.0, HIP_Z))

# ── 색 ───────────────────────────────────────────────────────
SKIN = hexc('#FBF1DF')
SKIN_SHADE = hexc('#EBD8BC')
LEAF_BASE = hexc('#4E9E2C')
LEAF_TIP = hexc('#9FD84A')
HOOD_TOP_C = hexc('#A2D647')
HOOD_MID_C = hexc('#6EBB33')
HOOD_LOW_C = hexc('#4C962B')
TUNIC_BASE = hexc('#5BAA2E')
TUNIC_TIP = hexc('#B3DB45')
SPROUT_BASE = hexc('#5DB133')
SPROUT_TIP = hexc('#A9DE55')
NUT = hexc('#E39C45')
NUT_DARK = hexc('#A9652A')
NUT_LIGHT = hexc('#F6C477')
LEATHER = hexc('#9A6035')
LEATHER_DARK = hexc('#6E4022')
WOOD = hexc('#D9AE74')
WOOD_DARK = hexc('#B4834C')
CLAY = hexc('#8E5B38')
CLAY_DARK = hexc('#5E3A22')
SOIL = hexc('#4A3020')
TWIG = hexc('#6B4A30')
TWIG_LEAF = hexc('#8A6A3A')

sc = reset_scene()
col_char = bpy.data.collections.new('Hwangyeongi')
sc.collection.children.link(col_char)

M_SKIN = material('skin', rough=0.62, spec=0.35)
M_LEAF = material('leaf', rough=0.48, spec=0.45)
M_NUT = material('acorn_nut', rough=0.28, spec=0.6)
M_CAP = material('acorn_cap', rough=0.75, vcol=False, image=os.path.join(TEX, 'acorn_cap.png'))
M_LEATHER = material('leather', rough=0.62)
M_WOOD = material('wood', rough=0.7)
M_BADGE = material('badge', rough=0.6, vcol=False, image=os.path.join(TEX, 'badge.png'))
M_FACE = material('face', rough=0.45, vcol=False, image=os.path.join(TEX, 'face_default.png'), alpha=True)
M_CLAY = material('clay', rough=0.85, spec=0.3)

parts = {}  # 이름 → 오브젝트


PART_MAT = {'skin': M_SKIN, 'leaf': M_LEAF, 'acorn_nut': M_NUT, 'acorn_cap': M_CAP, 'leather': M_LEATHER,
            'wood': M_WOOD, 'badge': M_BADGE, 'face': M_FACE}


def add(name, obj):
    """부품 등록. 재질이 없으면 그룹 재질을 넣는다(합칠 때 빈 슬롯 방지)."""
    me = obj.data
    if not me.materials or me.materials[0] is None:
        me.materials.clear()
        me.materials.append(PART_MAT[name])
    parts.setdefault(name, []).append(obj)
    return obj


def side_sign(side):
    return 1 if side == 'L' else -1


# ════════════════════════════════════════════════════════════
# 머리 (피부 구)
# ════════════════════════════════════════════════════════════
head = uv_sphere('head_skin', HEAD_R, (0, 0, HEAD_Z), HEAD_SCALE, segs=44, rings=26, coll=col_char)
paint_vertices(head, lambda co: mix(SKIN, SKIN_SHADE, max(0.0, (HEAD_Z - co.z) / HEAD_R - 0.35) * 0.9))
weight_all(head, 'head')
add('skin', head)

# ── 얼굴 데칼: 머리 구 앞면을 복제해 살짝 띄우고 정면 투영 UV ──
mb = MeshBuilder()
hm = head.data
cen = Vector((0, 0, HEAD_Z))
keep = {}
for poly in hm.polygons:
    c = poly.center - cen
    d = Vector((c.x / HEAD_SCALE[0], c.y / HEAD_SCALE[1], c.z / HEAD_SCALE[2])).normalized()
    if d.y < -0.2 and abs(c.x) < FACE_HALF * 0.98 and abs(c.z) < FACE_HALF * 0.98:
        idx = []
        uvs = []
        for vi in poly.vertices:
            if vi not in keep:
                co = hm.vertices[vi].co
                n = (co - cen)
                n = Vector((n.x / HEAD_SCALE[0] ** 2, n.y / HEAD_SCALE[1] ** 2, n.z / HEAD_SCALE[2] ** 2)).normalized()
                keep[vi] = mb.add_vertex(co + n * 0.0016, (1, 1, 1), {'head': 1.0})
            idx.append(keep[vi])
            co = hm.vertices[vi].co
            uvs.append((0.5 + co.x / (2 * FACE_HALF), 0.5 + (co.z - HEAD_Z) / (2 * FACE_HALF)))
        mb.add_face(idx, uv=uvs)
face = mb.build('face', M_FACE, col_char)
add('face', face)

# ════════════════════════════════════════════════════════════
# 후드 (구 껍질, 얼굴 구멍 + 목 구멍)
# ════════════════════════════════════════════════════════════
def build_hood(nphi=44, nt=12):
    """얼굴 구멍 테두리가 매끈하도록 '앞쪽 축' 기준 매개변수로 만든 후드 껍질."""
    front = Vector((0, -1, 0))
    X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))
    sx, sy, sz = 1.02, 1.0, 0.98
    mbh = MeshBuilder()
    rows = []
    for j in range(nt):
        t = j / nt
        row = []
        for i in range(nphi):
            phi = 2 * math.pi * i / nphi
            sp = math.sin(phi)
            beta = 53 + (34 - 53) * max(0.0, sp) ** 1.4 + (105 - 53) * max(0.0, -sp) ** 2.2
            beta = math.radians(beta)
            g = beta + (math.pi - beta) * (t ** 0.9)
            d = front * math.cos(g) + (X * math.cos(phi) + Z * sp) * math.sin(g)
            p = Vector((d.x * sx, d.y * sy, d.z * sz)) * HOOD_R + HOOD_C
            row.append(mbh.add_vertex(p, (1, 1, 1), {'head': 1.0}))
        rows.append(row)
    pole = mbh.add_vertex(HOOD_C + Vector((0, HOOD_R * sy, 0)), (1, 1, 1), {'head': 1.0})
    for j in range(nt - 1):
        for i in range(nphi):
            a0, a1 = rows[j][i], rows[j][(i + 1) % nphi]
            b0, b1 = rows[j + 1][i], rows[j + 1][(i + 1) % nphi]
            mbh.add_face((a0, b0, b1, a1))
    for i in range(nphi):
        mbh.add_face((rows[-1][i], pole, rows[-1][(i + 1) % nphi]))
    return mbh.build('hood', None, col_char)


hood = build_hood()
# 바깥쪽을 향하도록 법선 확인 후 필요하면 뒤집는다
import bmesh
bm = bmesh.new()
bm.from_mesh(hood.data)
bm.faces.ensure_lookup_table()
f0 = bm.faces[len(bm.faces) // 2]
if f0.normal.dot(f0.calc_center_median() - HOOD_C) < 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
bm.to_mesh(hood.data)
bm.free()
for p in hood.data.polygons:
    p.use_smooth = True


def hood_color(co):
    d = (co - HOOD_C)
    r = d.length
    d.normalize()
    inner = r < HOOD_R * 0.99
    c = mix(HOOD_MID_C, HOOD_TOP_C, max(0.0, d.z) ** 1.2)
    c = mix(c, HOOD_LOW_C, max(0.0, -d.z + 0.1) * 0.9 + max(0.0, d.y) * 0.35)
    return mul(c, 0.72) if inner else c


sol = hood.modifiers.new('solid', 'SOLIDIFY')
sol.thickness = 0.038
sol.offset = -1
sol.use_even_offset = True
sub = hood.modifiers.new('sub', 'SUBSURF')
sub.levels = 1
apply_modifiers(hood)
paint_vertices(hood, hood_color)
weight_all(hood, 'head')
add('leaf', hood)

# ── 후드를 덮는 잎들 ─────────────────────────────────────────
mb = MeshBuilder()
HR = HOOD_R * 1.0
crown = [
    # (col, az, L, W, thick)
    (4, 0, 0.225, 0.2, 0.04),
    (8, 64, 0.2, 0.17, 0.034),
    (8, -64, 0.2, 0.17, 0.034),
    (10, 128, 0.21, 0.17, 0.032),
    (10, -128, 0.21, 0.17, 0.032),
    (12, 180, 0.21, 0.17, 0.03),
]
for col, az, L, W, th in crown:
    lf = lens_leaf(L, W, th, cup=0.035, bend=-0.02, droop=0.03, c_base=HOOD_MID_C, c_tip=HOOD_TOP_C, groove=0.45)
    place_leaf(mb, lf, sphere_map(HOOD_C, HR, col, az, lift=0.004 + th * 0.4, scale=(1.02, 1.0, 0.98)), {'head': 1.0})
# 이마를 덮는 작은 잎
lf = lens_leaf(0.105, 0.085, 0.026, cup=0.08, bend=0.25, c_base=HOOD_LOW_C, c_tip=HOOD_MID_C)
place_leaf(mb, lf, sphere_map(HOOD_C, HR, 44, 0, lift=0.016, scale=(1.02, 1.0, 0.98)), {'head': 1.0})
# 옆·뒤 판 잎
for col, az in [(58, 78), (58, -78), (70, 118), (70, -118), (64, 160), (64, -160), (95, 100), (95, -100), (95, 150), (95, -150)]:
    lf = lens_leaf(0.17 if col > 90 else 0.2, 0.17, 0.022, cup=0.05, bend=0.02, c_base=HOOD_LOW_C, c_tip=HOOD_MID_C, groove=0.3, nu=9, nv=4)
    place_leaf(mb, lf, sphere_map(HOOD_C, HR, col, az, lift=0.006, scale=(1.02, 1.0, 0.98)), {'head': 1.0})
hood_leaves = mb.build('hood_leaves', M_LEAF, col_char)
add('leaf', hood_leaves)

# ════════════════════════════════════════════════════════════
# 새싹 (머리 위 줄기 + 잎 두 장)
# ════════════════════════════════════════════════════════════
STEM_BASE = Vector((0.0, HOOD_C.y, HOOD_TOP - 0.01))
STEM_TOP = Vector((0.006, HOOD_C.y + 0.004, HOOD_TOP + 0.075))
mb = MeshBuilder()
tube(mb, [STEM_BASE, STEM_BASE.lerp(STEM_TOP, 0.5) + Vector((-0.004, 0, 0)), STEM_TOP],
     [0.02, 0.016, 0.014], segs=10, color=SPROUT_BASE, color_end=SPROUT_TIP, weight={'sprout': 1.0})
stem = mb.build('sprout_stem', M_LEAF, col_char)
add('leaf', stem)

mb = MeshBuilder()
# 캐릭터 왼쪽(+X, 화면 오른쪽): 크고 위로 뻗은 잎
lf = lens_leaf(0.30, 0.19, 0.036, cup=0.10, bend=0.10, c_base=SPROUT_BASE, c_tip=SPROUT_TIP, groove=0.45)
place_leaf(mb, lf, frame_map(STEM_TOP - Vector((0, 0, 0.006)), (0.52, 0.06, 0.85), (-0.25, -0.9, 0.2)), {'leaf_L': 1.0})
# 캐릭터 오른쪽(-X, 화면 왼쪽): 옆으로 뻗은 잎
lf = lens_leaf(0.25, 0.155, 0.032, cup=0.10, bend=0.12, c_base=SPROUT_BASE, c_tip=SPROUT_TIP, groove=0.45)
place_leaf(mb, lf, frame_map(STEM_TOP - Vector((0.004, 0, 0.012)), (-0.9, 0.02, 0.42), (0.3, -0.55, 0.78)), {'leaf_R': 1.0})
sprout_leaves = mb.build('sprout_leaves', M_LEAF, col_char)
add('leaf', sprout_leaves)

# ════════════════════════════════════════════════════════════
# 도토리 장식 (후드 오른쪽 위)
# ════════════════════════════════════════════════════════════
ac_dir = sph(56, -70)
AC = HOOD_C + Vector((ac_dir.x * 1.02, ac_dir.y, ac_dir.z * 0.98)) * (HOOD_R + 0.04)
ac_axis = Vector((0.55, -0.45, -0.70)).normalized()   # 깍정이 → 열매 끝 방향
rot = ac_axis.to_track_quat('-Z', 'Y')
nut = uv_sphere('acorn_nut', 0.056, (0, 0, 0), (1.0, 1.0, 1.22), segs=24, rings=16, coll=col_char)
for v in nut.data.vertices:  # 끝을 살짝 뾰족하게
    if v.co.z < 0:
        k = (-v.co.z / (0.056 * 1.22)) ** 3
        v.co.x *= 1 - 0.35 * k
        v.co.y *= 1 - 0.35 * k
paint_vertices(nut, lambda co: mix(mix(NUT, NUT_LIGHT, max(0.0, co.z / 0.068) * 0.6 + max(0.0, -co.y / 0.056) * 0.2),
                                   NUT_DARK, max(0.0, -co.z / 0.068 - 0.4) * 1.4))
nut_tip = uv_sphere('acorn_tip', 0.008, (0, 0, -0.07), (1, 1, 1.4), segs=8, rings=6, coll=col_char)
paint_vertices(nut_tip, lambda co: NUT_DARK)
cap = uv_sphere('acorn_cap', 0.064, (0, 0, 0.03), (1.0, 1.0, 0.85), segs=32, rings=16, coll=col_char)
bm = bmesh.new()
bm.from_mesh(cap.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < 0.022], context='FACES')
bm.to_mesh(cap.data)
bm.free()
tx = bpy.data.textures.new('capH', 'IMAGE')
tx.image = bpy.data.images.load(os.path.join(TEX, 'acorn_cap_height.png'))
dsp = cap.modifiers.new('disp', 'DISPLACE')
dsp.texture = tx
dsp.texture_coords = 'UV'
dsp.strength = 0.006
dsp.mid_level = 0.3
sol = cap.modifiers.new('solid', 'SOLIDIFY')
sol.thickness = 0.008
apply_modifiers(cap)
for p in cap.data.polygons:
    p.use_smooth = True
paint_vertices(cap, lambda co: (1, 1, 1))
mb = MeshBuilder()
tube(mb, [(0, 0, 0.075), (0.004, 0, 0.095), (0.012, 0, 0.108)], [0.011, 0.009, 0.008], segs=8,
     color=hexc('#6B4226'), weight=None)
acorn_stem = mb.build('acorn_stem', M_CAP, col_char)
for o in (nut, nut_tip, cap, acorn_stem):
    o.data.transform(Matrix.Translation(AC) @ rot.to_matrix().to_4x4())
    weight_all(o, 'head')
add('acorn_nut', nut)
add('acorn_nut', nut_tip)
add('acorn_cap', cap)
add('acorn_cap', acorn_stem)

# ════════════════════════════════════════════════════════════
# 몸통·팔·다리 (메타볼 → 메시)
# ════════════════════════════════════════════════════════════
K = 1 / 0.57  # 메타볼 반지름 → 표면 반지름 보정


def metaball(name, elems, res=0.009):
    mbd = bpy.data.metaballs.new(name)
    mbd.resolution = res
    mbd.render_resolution = res
    mbd.threshold = 0.6
    ob = bpy.data.objects.new(name + '_mb', mbd)
    link(ob)
    for kind, co, r, size, q in elems:
        e = mbd.elements.new(type=kind)
        e.co = co
        e.radius = r * K
        e.stiffness = 2.0
        if size:
            e.size_x, e.size_y, e.size_z = size
        if q is not None:
            e.rotation = q
    mesh = to_mesh_object(ob, name, col_char)
    bpy.data.objects.remove(ob)
    dec = mesh.modifiers.new('dec', 'DECIMATE')
    dec.ratio = 0.28
    apply_modifiers(mesh)
    for p in mesh.data.polygons:
        p.use_smooth = True
    return mesh


torso = metaball('torso', [
    ('ELLIPSOID', (0, 0.01, TORSO_Z), 0.1, (1.15, 0.95, 1.45), None),
    ('BALL', (0, 0.0, NECK_Z - 0.03), 0.055, None, None),
])
paint_vertices(torso, lambda co: mix(SKIN, SKIN_SHADE, 0.3))
weight_all(torso, lambda co: {'spine': 1.0} if co.z > TORSO_Z - 0.02 else {'hips': 1.0})
add('skin', torso)

for side in ('L', 'R'):
    s = side_sign(side)
    sh = Vector((SHOULDER.x * s, SHOULDER.y, SHOULDER.z))
    ad = Vector((math.cos(ARM_DOWN) * s, 0, -math.sin(ARM_DOWN)))
    hand = sh + ad * ARM_LEN
    mid = sh + ad * (ARM_LEN * 0.5)
    q = ad.to_track_quat('X', 'Z')
    thumb = hand + Vector((0, -0.032, 0.018)) + ad * -0.012
    arm = metaball('arm_' + side, [
        ('BALL', sh, 0.046, None, None),
        ('CAPSULE', mid, 0.044, (ARM_LEN * 0.32, 0, 0), q),
        ('ELLIPSOID', hand, 0.052, (1.12, 0.9, 1.0), q),
        ('BALL', thumb, 0.022, None, None),
    ], res=0.007)
    paint_vertices(arm, lambda co: SKIN)
    weight_all(arm, 'arm_' + side)
    add('skin', arm)

    hp = Vector((HIP.x * s, HIP.y, HIP.z))
    ankle = Vector((0.076 * s, -0.004, 0.06))
    foot = Vector((0.079 * s, -0.026, 0.038))
    leg = metaball('leg_' + side, [
        ('CAPSULE', (hp + ankle) / 2, 0.058, ((hp - ankle).length * 0.42, 0, 0), (hp - ankle).to_track_quat('X', 'Z')),
        ('ELLIPSOID', foot, 0.062, (1.0, 1.35, 0.72), None),
    ], res=0.008)
    for v in leg.data.vertices:  # 바닥 평평하게
        if v.co.z < 0.0:
            v.co.z = 0.0
    paint_vertices(leg, lambda co: mix(SKIN, SKIN_SHADE, max(0.0, 0.08 - co.z) * 4))
    weight_all(leg, 'leg_' + side)
    add('skin', leg)

# ════════════════════════════════════════════════════════════
# 목깃 잎, 잎 튜닉, 뒤 망토
# ════════════════════════════════════════════════════════════
mb = MeshBuilder()
for i in range(7):
    th = -90 + 25 + i * 51.4
    lf = lens_leaf(0.175, 0.16, 0.032, cup=0.12, bend=-0.08, c_base=TUNIC_BASE, c_tip=TUNIC_TIP, groove=0.3,
                   nu=10, nv=4, a=0.55, b=0.6)
    place_leaf(mb, lf, cone_map((0, 0.005, NECK_Z + 0.012), th, 0.055, 58, yscale=0.9), {'spine': 1.0})
for i in range(6):
    th = -90 + i * 60
    lf = lens_leaf(0.18, 0.16, 0.032, cup=0.1, bend=-0.08, c_base=TUNIC_BASE, c_tip=TUNIC_TIP, groove=0.3, nu=10, nv=4)
    place_leaf(mb, lf, cone_map((0, 0.008, TORSO_Z + 0.055), th, 0.118, 16, yscale=0.9), {'spine': 1.0})
for i in range(7):
    th = -90 + 25 + i * 51.4
    lf = lens_leaf(0.165, 0.15, 0.03, cup=0.1, bend=-0.06, c_base=TUNIC_BASE, c_tip=TUNIC_TIP, groove=0.3, nu=10, nv=4)
    place_leaf(mb, lf, cone_map((0, 0.008, TORSO_Z - 0.025), th, 0.13, 22, yscale=0.9), {'hips': 1.0})
tunic = mb.build('tunic', M_LEAF, col_char)
add('leaf', tunic)


def cape_weight(p):
    t = max(0.0, min(1.0, (NECK_Z - p.z) / (NECK_Z - HIP_Z + 0.02)))
    return {'spine': 1 - t, 'cape': t}


mb = MeshBuilder()
for th in (58, 90, 122, 74, 106):
    lf = lens_leaf(0.3, 0.16, 0.03, cup=0.08, bend=-0.03, c_base=HOOD_LOW_C, c_tip=HOOD_MID_C, groove=0.3, nu=10, nv=4)
    place_leaf(mb, lf, cone_map((0, 0.02, NECK_Z + 0.02), th, 0.15 if th in (58, 90, 122) else 0.16, 10))
mb.set_weight(cape_weight)
cape = mb.build('cape', M_LEAF, col_char)
add('leaf', cape)

# ── 배지 ─────────────────────────────────────────────────────
BADGE_C = Vector((0.0, -0.162, NECK_Z - 0.065))
badge_rot = Matrix.Rotation(math.radians(72), 4, 'X')  # 원판 법선이 앞(-Y)·약간 위
mb = MeshBuilder()
segs = 32
r_face, depth = 0.05, 0.018
ring_front, ring_back, rim = [], [], []
for k in range(segs):
    a = 2 * math.pi * k / segs
    ring_front.append(mb.add_vertex((r_face * math.cos(a), r_face * math.sin(a), depth / 2), (1, 1, 1), {'spine': 1}))
cf = mb.add_vertex((0, 0, depth / 2 + 0.002), (1, 1, 1), {'spine': 1})
for k in range(segs):
    a0, a1 = ring_front[k], ring_front[(k + 1) % segs]
    ang0, ang1 = 2 * math.pi * k / segs, 2 * math.pi * (k + 1) / segs
    mb.add_face((cf, a0, a1), uv=[(0.5, 0.5), (0.5 + 0.47 * math.cos(ang0), 0.5 + 0.47 * math.sin(ang0)),
                                  (0.5 + 0.47 * math.cos(ang1), 0.5 + 0.47 * math.sin(ang1))])
badge_face = mb.build('badge_face', M_BADGE, col_char)
mb = MeshBuilder()
pts = [(0, 0, -depth / 2), (0, 0, depth / 2 + 0.001)]
tube(mb, pts, [0.053, 0.053], segs=segs, color=WOOD_DARK, color_end=WOOD, weight={'spine': 1}, cap_end=False)
mb2 = MeshBuilder()
badge_rim = mb.build('badge_rim', M_WOOD, col_char)
for o in (badge_face, badge_rim):
    o.data.transform(Matrix.Translation(BADGE_C) @ badge_rot)
    for p in o.data.polygons:
        p.use_smooth = True
bev = badge_rim.modifiers.new('sub', 'SUBSURF')
bev.levels = 1
apply_modifiers(badge_rim)
add('badge', badge_face)
add('wood', badge_rim)

# ── 가죽끈 + 가방 ─────────────────────────────────────────────
BAG_C = Vector((0.172, -0.045, HIP_Z - 0.02))


def strap_weight(p, t):
    return {'spine': 1 - t, 'bag': t} if t > 0.55 else {'spine': 1.0}


mb = MeshBuilder()
tube(mb, [(-0.07, -0.13, NECK_Z - 0.03), (0.0, -0.158, NECK_Z - 0.07), (0.07, -0.15, TORSO_Z + 0.03),
          (0.13, -0.12, TORSO_Z - 0.03), (0.165, -0.075, HIP_Z + 0.035)],
     [0.013] * 5, segs=8, flat=0.35, color=LEATHER, weight_fn=strap_weight, up=Vector((0, -1, 0.3)))
strap = mb.build('strap', M_LEATHER, col_char)
add('leather', strap)

bag = uv_sphere('bag', 0.068, BAG_C, (0.72, 0.62, 0.9), segs=20, rings=12, coll=col_char)
for v in bag.data.vertices:
    if v.co.z > BAG_C.z + 0.035:
        v.co.z = BAG_C.z + 0.035 + (v.co.z - BAG_C.z - 0.035) * 0.3
paint_vertices(bag, lambda co: mix(LEATHER, LEATHER_DARK, max(0.0, BAG_C.z - co.z) * 12))
weight_all(bag, 'bag')
add('leather', bag)
mb = MeshBuilder()
lf = lens_leaf(0.1, 0.105, 0.022, cup=0.15, bend=-0.35, c_base=TUNIC_BASE, c_tip=TUNIC_TIP)
place_leaf(mb, lf, frame_map(BAG_C + Vector((-0.004, 0.012, 0.058)), (0.05, -0.55, -0.83), (0.2, -0.85, 0.5)), {'bag': 1.0})
bag_flap = mb.build('bag_flap', M_LEAF, col_char)
add('leaf', bag_flap)

# ════════════════════════════════════════════════════════════
# 손에 드는 소품: 도토리 화분(기본), 마른 가지(sad)
# 기준점: 오른손 위, 나중에 hand_R 뼈에 붙는다
# ════════════════════════════════════════════════════════════
sR = Vector((-SHOULDER.x, SHOULDER.y, SHOULDER.z))
adR = Vector((-math.cos(ARM_DOWN), 0, -math.sin(ARM_DOWN)))
HAND_R = sR + adR * ARM_LEN
PROP_BASE = HAND_R + Vector((-0.004, -0.02, 0.04))

mb = MeshBuilder()
prof = [(0.012, 0.0), (0.03, 0.004), (0.045, 0.018), (0.053, 0.04), (0.054, 0.062), (0.05, 0.08), (0.046, 0.088), (0.04, 0.09)]
segs = 18
rings = []
for i, (r, h) in enumerate(prof):
    ring = []
    for k in range(segs):
        a = 2 * math.pi * k / segs
        wob = 1 + 0.03 * math.sin(a * 3 + i)
        c = mix(CLAY_DARK, CLAY, h / 0.09 + 0.1 * math.sin(a * 5))
        ring.append(mb.add_vertex(PROP_BASE + Vector((r * wob * math.cos(a), r * wob * math.sin(a), h)), c))
    rings.append(ring)
for i in range(len(rings) - 1):
    for k in range(segs):
        mb.add_face((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
bottom = mb.add_vertex(PROP_BASE + Vector((0, 0, -0.002)), CLAY_DARK)
for k in range(segs):
    mb.add_face((bottom, rings[0][(k + 1) % segs], rings[0][k]))
soil = mb.add_vertex(PROP_BASE + Vector((0, 0, 0.082)), SOIL)
for k in range(segs):
    a = 2 * math.pi * k / segs
    inner = mb.add_vertex(PROP_BASE + Vector((0.036 * math.cos(a), 0.036 * math.sin(a), 0.083)), SOIL)
for k in range(segs):
    i0 = soil + 1 + k
    i1 = soil + 1 + (k + 1) % segs
    mb.add_face((soil, i0, i1))
    mb.add_face((rings[-1][k], rings[-1][(k + 1) % segs], i1, i0))
tube(mb, [PROP_BASE + Vector((0, 0, 0.078)), PROP_BASE + Vector((0.002, 0, 0.11)), PROP_BASE + Vector((0.0, -0.002, 0.13))],
     [0.007, 0.006, 0.005], segs=8, color=SPROUT_BASE, color_end=SPROUT_TIP)
TOP = PROP_BASE + Vector((0.0, -0.002, 0.128))
for along, nrm, L, W in [((-0.85, -0.1, 0.5), (0.35, -0.5, 0.8), 0.085, 0.055), ((0.8, -0.15, 0.58), (-0.3, -0.6, 0.75), 0.095, 0.06)]:
    lf = lens_leaf(L, W, 0.012, cup=0.12, bend=0.12, c_base=SPROUT_BASE, c_tip=SPROUT_TIP, groove=0.35, nu=8, nv=4)
    place_leaf(mb, lf, frame_map(TOP, along, nrm))
mb.set_weight('hand_R')
prop_pot = mb.build('prop_pot', M_CLAY, col_char)
# 새싹 부분은 잎 재질로: 높이로 나눠 재질 슬롯 지정
prop_pot.data.materials.append(M_LEAF)
for p in prop_pot.data.polygons:
    if p.center.z > PROP_BASE.z + 0.084:
        p.material_index = 1

mb = MeshBuilder()
tb = HAND_R + Vector((0.0, -0.02, 0.02))
tube(mb, [tb, tb + Vector((0.01, -0.004, 0.06)), tb + Vector((-0.005, -0.006, 0.13)), tb + Vector((0.012, -0.004, 0.2))],
     [0.009, 0.008, 0.006, 0.004], segs=7, color=TWIG, color_end=mul(TWIG, 0.8))
tube(mb, [tb + Vector((0.004, -0.005, 0.09)), tb + Vector((0.045, -0.006, 0.13)), tb + Vector((0.06, -0.008, 0.17))],
     [0.005, 0.004, 0.003], segs=6, color=TWIG)
tube(mb, [tb + Vector((-0.004, -0.005, 0.15)), tb + Vector((-0.04, -0.004, 0.18))], [0.004, 0.003], segs=6, color=TWIG)
for org, along, nrm in [((0.06, -0.008, 0.17), (0.5, -0.1, -0.85), (0.1, -0.95, 0.2)),
                        ((-0.04, -0.004, 0.18), (-0.4, -0.2, -0.9), (-0.1, -0.95, 0.2))]:
    lf = lens_leaf(0.05, 0.03, 0.006, cup=0.3, bend=-0.4, c_base=TWIG_LEAF, c_tip=mul(TWIG_LEAF, 0.75), nu=6, nv=3, curl=0.2)
    place_leaf(mb, lf, frame_map(tb + Vector(org), along, nrm))
mb.set_weight('hand_R')
prop_twig = mb.build('prop_twig', M_CLAY, col_char)

# ════════════════════════════════════════════════════════════
# 재질별 합치기
# ════════════════════════════════════════════════════════════
merged = {}
for key, objs in parts.items():
    merged[key] = join(objs, 'body_' + key)
merged['face'].name = 'face'
merged['prop_pot'] = prop_pot
merged['prop_twig'] = prop_twig

total = 0
for k, o in merged.items():
    n = tri_count(o)
    total += n
    print(f'  {o.name:20s} {n:6d} tris')
print('TOTAL tris', total)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hwangyeongi_model.blend'))

# 다음 단계(rig_and_export.py)에서 쓸 기준점 기록
import json
json.dump({
    'HIP_Z': HIP_Z, 'TORSO_Z': TORSO_Z, 'NECK_Z': NECK_Z, 'HEAD_Z': HEAD_Z, 'HOOD_TOP': HOOD_TOP,
    'SHOULDER': list(SHOULDER), 'ARM_DOWN': ARM_DOWN, 'ARM_LEN': ARM_LEN, 'HIP': list(HIP),
    'STEM_BASE': list(STEM_BASE), 'STEM_TOP': list(STEM_TOP), 'BAG_C': list(BAG_C),
    'HOOD_C': list(HOOD_C), 'PROP_BASE': list(PROP_BASE),
}, open(os.path.join(OUT, 'rig_points.json'), 'w'), indent=1)
print('saved')
