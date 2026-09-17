"""환경이 뼈대·동작 제작 후 GLB 내보내기.

실행: python rig_and_export.py <build 폴더>
입력: hwangyeongi_model.blend, rig_points.json (build_character.py 결과)
출력: hwangyeongi.glb, hwangyeongi_rigged.blend

동작은 armature 좌표축 기준 회전(X: 앞으로 숙임, Y: 옆으로 기울임, Z: 좌우 돌기)으로 적는다.
팔: arm_L 은 Y축 음수, arm_R 은 Y축 양수가 '들어 올리기'. 다리·팔의 X축 음수가 '앞으로'.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector, Quaternion, Matrix

BUILD = os.path.abspath(sys.argv[-1]) if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.abspath('build')
bpy.ops.wm.open_mainfile(filepath=os.path.join(BUILD, 'hwangyeongi_model.blend'))
P = {k: (Vector(v) if isinstance(v, list) else v) for k, v in json.load(open(os.path.join(BUILD, 'rig_points.json'))).items()}
sc = bpy.context.scene
sc.render.fps = 30

# ── 뼈대 ─────────────────────────────────────────────────────
arm_data = bpy.data.armatures.new('RigData')
rig = bpy.data.objects.new('Hwangyeongi', arm_data)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None, roll=0.0):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.roll = roll
    if parent:
        b.parent = eb[parent]
    return b


HIP_Z, TORSO_Z, NECK_Z = P['HIP_Z'], P['TORSO_Z'], P['NECK_Z']
bone('root', (0, 0, 0), (0, 0, 0.1))
bone('hips', (0, 0, HIP_Z), (0, 0, TORSO_Z), 'root')
bone('spine', (0, 0, TORSO_Z), (0, 0, NECK_Z), 'hips')
bone('head', (0, 0, NECK_Z), (0, 0, NECK_Z + 0.26), 'spine')
bone('sprout', P['STEM_BASE'], P['STEM_TOP'], 'head')
bone('leaf_L', P['STEM_TOP'], P['STEM_TOP'] + Vector((0.52, 0.06, 0.85)).normalized() * 0.24, 'sprout')
bone('leaf_R', P['STEM_TOP'], P['STEM_TOP'] + Vector((-0.9, 0.02, 0.42)).normalized() * 0.2, 'sprout')
for side, s in (('L', 1), ('R', -1)):
    sh = Vector((P['SHOULDER'].x * s, P['SHOULDER'].y, P['SHOULDER'].z))
    d = Vector((math.cos(P['ARM_DOWN']) * s, 0, -math.sin(P['ARM_DOWN'])))
    hand = sh + d * P['ARM_LEN']
    bone('arm_' + side, sh, hand, 'spine')
    bone('hand_' + side, hand, hand + d * 0.05, 'arm_' + side)
    # 소품 부착점: 손 위, 휴지 자세에서 위(+Z)를 향한다
    bone('socket_' + side, hand + Vector((0, -0.02, 0.035)), hand + Vector((0, -0.02, 0.085)), 'hand_' + side)
    hp = Vector((P['HIP'].x * s, 0, HIP_Z))
    bone('leg_' + side, hp, Vector((0.076 * s, -0.004, 0.05)), 'hips')
bone('cape', (0, 0.12, NECK_Z), (0, 0.17, HIP_Z - 0.05), 'spine')
bone('bag', P['BAG_C'] + Vector((-0.005, -0.01, 0.075)), P['BAG_C'] + Vector((0, 0, -0.05)), 'hips')
bpy.ops.object.mode_set(mode='OBJECT')

# ── 메시 연결 ────────────────────────────────────────────────
for o in list(sc.objects):
    if o.type != 'MESH':
        continue
    if o.name == 'prop_twig' or o.name == 'prop_pot':
        pass
    mod = o.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    o.parent = rig
    o.matrix_parent_inverse = rig.matrix_world.inverted()

# ── 포즈 도구 ────────────────────────────────────────────────
pbones = rig.pose.bones
REST = {b.name: b.matrix_local.to_quaternion() for b in arm_data.bones}
for pb in pbones:
    pb.rotation_mode = 'QUATERNION'

AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}


def q_arm(rots):
    """[('X', deg), ('Y', deg)...] 를 순서대로(먼저 적은 것이 먼저) 적용한 armature 공간 회전."""
    q = Quaternion()
    for axis, deg in rots:
        q = Quaternion(AX[axis], math.radians(deg)) @ q
    return q


def to_local_q(name, rots):
    r = REST[name]
    # 부모까지 누적된 회전에 대해 '휴지 자세 축' 기준으로 준다
    return r.inverted() @ q_arm(rots) @ r


def to_local_loc(name, vec):
    return REST[name].inverted() @ Vector(vec)


def sstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def S(x):
    return math.sin(2 * math.pi * x)


# 기본 '화분 들기' 팔 자세
HOLD_R = [('Y', 28), ('X', -52)]


def base():
    return {}


# ── 동작 정의: t ∈ [0,1) → {뼈: 회전목록 | ('loc', 벡터)} ─────────
def idle(t):
    return {
        'hips': [('Y', 1.5 * S(t))],
        'spine': [('X', -1.5 * S(t + 0.25))],
        'head': [('Y', 4 * S(t)), ('X', 2 * S(2 * t))],
        'sprout': [('Y', 5 * S(t + 0.15)), ('X', 2 * S(t))],
        'leaf_L': [('Y', 4 * S(t + 0.3))],
        'leaf_R': [('Y', -4 * S(t + 0.45))],
        'arm_R': HOLD_R + [('X', 2.5 * S(t))],
        'arm_L': [('Y', -6), ('X', 4 * S(t))],
        'cape': [('X', -3 * S(t + 0.2))],
        'bag': [('Y', 3 * S(t + 0.1))],
        '_root': (0, 0, 0.003 * S(t)),
    }


def happy_idle(t):
    hop = max(0.0, math.sin(2 * math.pi * t))
    return {
        '_root': (0, 0, 0.045 * hop),
        'hips': [('Y', 4 * S(t))],
        'spine': [('Y', -3 * S(t)), ('X', -4 * hop)],
        'head': [('Y', 9 * S(t)), ('X', -4 * hop)],
        'sprout': [('X', -10 * S(t + 0.15)), ('Y', 6 * S(t))],
        'leaf_L': [('Y', -8 * S(t + 0.2))],
        'leaf_R': [('Y', 8 * S(t + 0.2))],
        'arm_R': [('Y', 62 + 8 * S(t)), ('X', -30)],
        'arm_L': [('Y', -108 - 16 * S(2 * t)), ('X', -10)],
        'leg_L': [('X', -14 * hop)],
        'leg_R': [('X', 10 * hop)],
        'cape': [('X', 8 * hop)],
        'bag': [('Y', 10 * S(t + 0.25))],
    }


def sad_idle(t):
    return {
        '_root': (0, 0, -0.004 + 0.002 * S(t)),
        'spine': [('X', 9 + 2 * S(t))],
        'head': [('X', 17 + 2 * S(t + 0.1)), ('Y', 4 * S(t * 1))],
        'sprout': [('X', 34 + 3 * S(t + 0.2))],
        'leaf_L': [('Y', 42 + 3 * S(t))],
        'leaf_R': [('Y', -38 - 3 * S(t))],
        'arm_R': [('Y', 6), ('X', -22 + 2 * S(t))],
        'arm_L': [('Y', 10), ('X', 3 * S(t + 0.3))],
        'cape': [('X', -2)],
        'bag': [('Y', 1.5 * S(t))],
    }


def walk_like(t, amp=1.0, sad=False):
    s = S(t)
    bounce = (1 - math.cos(4 * math.pi * t)) / 2
    head_x = 17 if sad else 0
    d = {
        '_root': (0, 0, (0.016 if not sad else 0.007) * bounce),
        'leg_L': [('X', -28 * amp * s)],
        'leg_R': [('X', 28 * amp * s)],
        'hips': [('Z', 6 * amp * s)],
        'spine': [('Y', 3 * amp * s), ('X', (8 if sad else -2))],
        'head': [('X', head_x + 2 * bounce), ('Y', -2 * s)],
        'sprout': [('X', (32 if sad else 0) - 6 * amp * bounce), ('Y', 4 * s)],
        'leaf_L': [('Y', (40 if sad else 0) + 6 * amp * s)],
        'leaf_R': [('Y', (-36 if sad else 0) + 6 * amp * s)],
        'arm_L': [('Y', 6 if sad else -6), ('X', 24 * amp * s)],
        'cape': [('X', 6 * amp * bounce)],
        'bag': [('X', -8 * amp * s)],
    }
    d['arm_R'] = ([('Y', 6), ('X', -20 - 10 * amp * s)] if sad else HOLD_R + [('X', 3 * bounce)])
    return d


def walk(t):
    return walk_like(t)


def sad_walk(t):
    return walk_like(t, amp=0.55, sad=True)


def jump(t):
    crouch = sstep(t / 0.18) * (1 - sstep((t - 0.18) / 0.08))
    air = max(0.0, min(1.0, (t - 0.22) / 0.46))
    h = 4 * air * (1 - air) if 0 < air < 1 else 0.0
    land = sstep((t - 0.68) / 0.08) * (1 - sstep((t - 0.8) / 0.2))
    up = sstep((t - 0.18) / 0.1) * (1 - sstep((t - 0.75) / 0.25))
    return {
        '_root': (0, 0, -0.035 * crouch + 0.17 * h - 0.03 * land),
        'spine': [('X', 12 * crouch - 6 * up + 8 * land)],
        'head': [('X', 8 * crouch - 10 * up)],
        'leg_L': [('X', -22 * h)],
        'leg_R': [('X', -10 * h)],
        'arm_L': [('Y', -120 * up), ('X', -10 * up)],
        'arm_R': [('Y', 28 + 55 * up), ('X', -52 + 22 * up)],
        'sprout': [('X', 14 * crouch - 18 * h + 12 * land)],
        'leaf_L': [('Y', 18 * h - 8 * land)],
        'leaf_R': [('Y', -18 * h + 8 * land)],
        'cape': [('X', 22 * h)],
        'bag': [('X', 18 * h)],
    }


def wave(t):
    return {
        'arm_L': [('Y', -118 + 22 * S(2 * t)), ('X', -12)],
        'arm_R': HOLD_R,
        'head': [('Y', 8), ('X', -3 + 2 * S(2 * t))],
        'spine': [('Y', -3)],
        'sprout': [('Y', -5 * S(2 * t + 0.2))],
        'leaf_L': [('Y', 5 * S(2 * t))],
        'leaf_R': [('Y', 5 * S(2 * t))],
        'bag': [('Y', 2 * S(t))],
        '_root': (0, 0, 0.004 * S(2 * t)),
    }


def water(t):
    tilt = 28 + 10 * S(2 * t)
    return {
        'spine': [('X', 7)],
        'head': [('X', 14), ('Z', -6)],
        'arm_R': [('Y', 22), ('X', -62)],
        'hand_R': [('Y', -tilt)],
        'arm_L': [('Y', -10), ('X', -8)],
        'sprout': [('X', 6 + 3 * S(t))],
        'leaf_L': [('Y', 3 * S(t))],
        'leaf_R': [('Y', -3 * S(t))],
        '_root': (0, 0, 0.002 * S(2 * t)),
    }


def plant(t):
    tap = S(3 * t)
    return {
        '_root': (0, 0, -0.06),
        'hips': [('X', 12)],
        'spine': [('X', 26)],
        'head': [('X', 12)],
        'leg_L': [('X', -44)],
        'leg_R': [('X', -40)],
        'arm_R': [('Y', 14), ('X', -70 + 12 * tap)],
        'arm_L': [('Y', -14), ('X', -60 - 10 * tap)],
        'sprout': [('X', 10 + 4 * tap)],
        'cape': [('X', -10)],
        'bag': [('X', 12)],
    }


def sweep(t):
    sw = S(t)
    return {
        'spine': [('Z', 18 * sw), ('X', 10)],
        'hips': [('Z', 6 * sw)],
        'head': [('Z', -8 * sw), ('X', 8)],
        'arm_L': [('Y', 16), ('X', -42)],
        'arm_R': [('Y', -16), ('X', -48)],
        'sprout': [('Y', -7 * sw)],
        'leaf_L': [('Y', 6 * sw)],
        'leaf_R': [('Y', 6 * sw)],
        'bag': [('Y', -10 * sw)],
        'cape': [('Y', 6 * sw)],
    }


def shake(t):
    w = S(2 * t)
    return {
        '_root': (0, 0, 0.012 * abs(S(2 * t))),
        'spine': [('Y', 13 * w)],
        'hips': [('Y', -5 * w)],
        'head': [('Y', -12 * w)],
        'arm_L': [('Y', -20 - 16 * w)],
        'arm_R': [('Y', 20 - 16 * w)],
        'sprout': [('Y', 18 * S(2 * t + 0.15))],
        'leaf_L': [('Y', 14 * w)],
        'leaf_R': [('Y', 14 * w)],
        'cape': [('Y', -10 * w)],
        'bag': [('Y', 16 * w)],
    }


def pickup(t):
    down = sstep(t / 0.35) * (1 - sstep((t - 0.62) / 0.33))
    return {
        '_root': (0, 0, -0.02 * down),
        'hips': [('X', 16 * down)],
        'spine': [('X', 42 * down)],
        'head': [('X', 8 * down)],
        'leg_L': [('X', -12 * down)],
        'leg_R': [('X', -12 * down)],
        'arm_L': [('Y', -4), ('X', -74 * down)],
        'arm_R': [('Y', 4), ('X', -80 * down)],
        'sprout': [('X', 16 * down)],
        'cape': [('X', -12 * down)],
        'bag': [('X', 25 * down)],
    }


def seated(t, sad=False):
    br = S(t)
    d = {
        '_root': (0, 0.02, -0.095 + 0.003 * br),
        'leg_L': [('Y', 8), ('X', -84)],
        'leg_R': [('Y', -8), ('X', -84)],
        'cape': [('X', 10)],
        'bag': [('X', -8)],
    }
    if sad:
        rock = S(t)
        d.update({
            'hips': [('X', 4 * rock)],
            'spine': [('X', 16 + 3 * rock)],
            'head': [('X', 26 + 2 * rock), ('Y', 3)],
            'arm_L': [('Y', 18), ('X', -62)],
            'arm_R': [('Y', -18), ('X', -62)],
            'sprout': [('X', 38 + 3 * rock)],
            'leaf_L': [('Y', 46)],
            'leaf_R': [('Y', -42)],
        })
    else:
        d.update({
            'spine': [('X', -9 + 2 * br)],
            'head': [('X', 14 + 2 * br), ('Y', 16)],
            'arm_L': [('Y', 8), ('X', -10)],
            'arm_R': [('Y', -8), ('X', -10)],
            'sprout': [('Y', 14), ('X', 12 + 3 * br)],
            'leaf_L': [('Y', 16)],
            'leaf_R': [('Y', -12)],
        })
    return d


def sleep(t):
    return seated(t)


def sit_sad(t):
    return seated(t, sad=True)


def stretch(t):
    e = math.sin(math.pi * t) ** 1.5
    return {
        '_root': (0, 0, 0.012 * e),
        'spine': [('X', -12 * e)],
        'head': [('X', -16 * e)],
        'arm_L': [('Y', -150 * e), ('X', -8 * e)],
        'arm_R': [('Y', 150 * e), ('X', -8 * e)],
        'sprout': [('X', -10 * e)],
        'leaf_L': [('Y', -8 * e)],
        'leaf_R': [('Y', 8 * e)],
        'leg_L': [('Y', 3 * e)],
        'leg_R': [('Y', -3 * e)],
    }


def look(t):
    turn = 34 * (sstep((t - 0.08) / 0.12) - sstep((t - 0.4) / 0.12) * 2 + sstep((t - 0.72) / 0.12))
    return {
        'head': [('Z', turn), ('X', -4), ('Y', 0.2 * turn)],
        'spine': [('Z', 0.25 * turn)],
        'arm_R': HOLD_R,
        'arm_L': [('Y', -6)],
        'sprout': [('Z', -0.2 * turn), ('Y', -0.15 * turn)],
    }


CLIPS = [
    ('idle', idle, 72), ('happy_idle', happy_idle, 36), ('sad_idle', sad_idle, 96),
    ('walk', walk, 24), ('sad_walk', sad_walk, 40), ('jump', jump, 32), ('wave', wave, 40),
    ('water', water, 48), ('plant', plant, 48), ('sweep', sweep, 32), ('shake', shake, 20),
    ('pickup', pickup, 50), ('sleep', sleep, 96), ('sit_sad', sit_sad, 90),
    ('stretch', stretch, 60), ('look', look, 90),
]

ALL = [pb.name for pb in pbones]
rig.animation_data_create()
first = None
for name, fn, frames in CLIPS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    step = 2
    for f in list(range(0, frames, step)) + [frames]:
        pose = fn((f % frames) / frames if f < frames else 0.0)
        for bname in ALL:
            pb = pbones[bname]
            rots = pose.get(bname, [])
            pb.rotation_quaternion = to_local_q(bname, rots)
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
            loc = pose.get('_root', (0, 0, 0)) if bname == 'root' else (0, 0, 0)
            pb.location = to_local_loc(bname, loc)
            if bname == 'root':
                pb.keyframe_insert('location', frame=f + 1)
    act.frame_range = (1, frames + 1)
    try:
        act.use_frame_range = True
        act.use_cyclic = True
    except Exception:
        pass
    first = first or act
    print(f'clip {name:12s} {frames} frames')

rig.animation_data.action = bpy.data.actions['idle']
sc.frame_start, sc.frame_end = 1, 73

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, 'hwangyeongi_rigged.blend'))

bpy.ops.export_scene.gltf(
    filepath=os.path.join(BUILD, 'hwangyeongi.glb'),
    export_format='GLB',
    export_yup=True,
    export_apply=False,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_vertex_color='MATERIAL',
    export_all_vertex_colors=False,
    export_skins=True,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_image_format='AUTO',
    export_extras=False,
)
print('exported', os.path.getsize(os.path.join(BUILD, 'hwangyeongi.glb')) // 1024, 'KB')
