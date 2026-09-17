"""Blender(bpy) 절차적 모델링 공용 도구.

- MeshBuilder: 정점·면·정점색·UV·뼈 가중치를 모아 한 번에 메시 오브젝트로 만든다.
- lens_leaf: 가운데가 두툼하고 가장자리가 얇은 '점토 느낌' 잎 모양.
- tube: 경로를 따라가는 원/타원 단면 튜브(줄기, 끈, 나뭇가지).
- 매핑 함수: 잎을 구면(후드)·원뿔면(목깃·잎 튜닉)·자유 공간에 붙인다.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion


# ── 색 ───────────────────────────────────────────────────────
def s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    h = h.lstrip('#')
    return tuple(s2l(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def mul(a, k):
    return tuple(min(1.0, x * k) for x in a)


# ── 씬 ───────────────────────────────────────────────────────
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.unit_settings.system = 'METRIC'
    return sc


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


# ── 재질 ─────────────────────────────────────────────────────
def material(name, rough=0.6, vcol=True, image=None, alpha=False, metallic=0.0,
             emission=None, emission_strength=0.0, spec=0.5):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = spec
    if image:
        tex = nt.nodes.new('ShaderNodeTexImage')
        img = bpy.data.images.load(image, check_existing=True)
        tex.image = img
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            try:
                m.surface_render_method = 'BLENDED'
            except Exception:
                m.blend_method = 'BLEND'
    elif vcol:
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = 'Col'
        nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    return m


# ── 메시 빌더 ────────────────────────────────────────────────
class MeshBuilder:
    def __init__(self):
        self.v = []      # Vector
        self.f = []      # (idx...)
        self.col = []    # per-vertex rgb
        self.w = []      # per-vertex {bone: weight}
        self.uv = []     # per-face list of (u,v) or None
        self.smooth = []

    def add_vertex(self, p, c=(1, 1, 1), w=None):
        self.v.append(Vector(p))
        self.col.append(tuple(c))
        self.w.append(dict(w) if w else {})
        return len(self.v) - 1

    def add_face(self, idx, uv=None, smooth=True):
        self.f.append(tuple(idx))
        self.uv.append(uv)
        self.smooth.append(smooth)

    def extend(self, other):
        off = len(self.v)
        self.v += other.v
        self.col += other.col
        self.w += other.w
        for face, uv, sm in zip(other.f, other.uv, other.smooth):
            self.f.append(tuple(i + off for i in face))
            self.uv.append(uv)
            self.smooth.append(sm)

    def set_weight(self, bone_or_fn):
        for i, p in enumerate(self.v):
            self.w[i] = {bone_or_fn: 1.0} if isinstance(bone_or_fn, str) else bone_or_fn(p)

    def build(self, name, mat=None, coll=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(p) for p in self.v], [], self.f)
        me.update()
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, c in enumerate(self.col):
            attr.data[i].color = (c[0], c[1], c[2], 1.0)
        if any(u is not None for u in self.uv):
            uvl = me.uv_layers.new(name='UVMap')
            li = 0
            for fi, poly in enumerate(me.polygons):
                uvs = self.uv[fi]
                for k, loop_index in enumerate(poly.loop_indices):
                    uvl.data[loop_index].uv = uvs[k] if uvs else (0.0, 0.0)
        for fi, poly in enumerate(me.polygons):
            poly.use_smooth = self.smooth[fi]
        obj = bpy.data.objects.new(name, me)
        link(obj, coll)
        bones = sorted({b for w in self.w for b in w})
        for b in bones:
            obj.vertex_groups.new(name=b)
        for i, w in enumerate(self.w):
            for b, val in w.items():
                if val > 0:
                    obj.vertex_groups[b].add([i], val, 'REPLACE')
        if mat:
            me.materials.append(mat)
        return obj


# ── 잎 ───────────────────────────────────────────────────────
def leaf_width(u, a=0.45, b=0.75):
    peak = a / (a + b)
    norm = (peak ** a) * ((1 - peak) ** b)
    return (max(u, 0.0) ** a) * (max(1 - u, 0.0) ** b) / norm


def lens_leaf(L, W, thick, nu=12, nv=5, cup=0.12, bend=0.0, groove=0.25,
              c_base=(0.2, 0.5, 0.1), c_tip=(0.5, 0.8, 0.2), c_back=0.72,
              a=0.45, b=0.75, curl=0.0, droop=0.0, rib_dark=0.85):
    """로컬 좌표 잎: x 폭, y 길이(밑동 0 → 끝 L), z 윗면 방향.
    반환: [(x,y,z,color)], faces"""
    verts, faces = [], []
    ring = 2 * nv
    for i in range(nu + 1):
        u = 0.015 + 0.975 * i / nu
        wn = leaf_width(u, a, b)
        half = W * 0.5 * wn
        t = thick * 0.5 * wn ** 0.8
        base_z = bend * L * u * u - droop * L * u ** 3
        for k in range(ring):
            # 윗면: v -1→1 (k=0..nv), 아랫면: v 1→-1 (k=nv..2nv, 끝점 공유를 위해 각도로)
            ang = math.pi * k / nv  # 0..2pi
            v = -math.cos(ang)
            top = math.sin(ang) >= 0
            x = v * half
            s = math.sqrt(max(0.0, 1 - v * v))
            z = base_z + cup * L * v * v * wn + curl * L * v * u
            if top:
                z += t * s - groove * t * math.exp(-(v / 0.2) ** 2) * math.sin(math.pi * u)
            else:
                z -= t * s
            edge = abs(v)
            c = mix(c_base, c_tip, 0.25 + 0.75 * u ** 1.3)
            c = mix(c, mul(c_tip, 1.12), edge * 0.35)
            if top and abs(v) < 0.12:
                c = mul(c, rib_dark)
            if not top:
                c = mul(c, c_back)
            verts.append((x, u * L, z, c))
    for i in range(nu):
        for k in range(ring):
            a0 = i * ring + k
            a1 = i * ring + (k + 1) % ring
            b0 = (i + 1) * ring + k
            b1 = (i + 1) * ring + (k + 1) % ring
            faces.append((a0, a1, b1, b0))
    # 밑동·끝 마개
    base_i = len(verts)
    verts.append((0, 0.0, bend * 0.0, c_base))
    tip_i = len(verts)
    verts.append((0, L, bend * L - droop * L, c_tip))
    for k in range(ring):
        faces.append((base_i, k, (k + 1) % ring)[::-1])
        faces.append((tip_i, nu * ring + (k + 1) % ring, nu * ring + k)[::-1])
    return verts, faces


def place_leaf(mb, leaf, mapping, weight=None):
    verts, faces = leaf
    off = len(mb.v)
    for (x, y, z, c) in verts:
        mb.add_vertex(mapping(x, y, z), c, weight)
    for f in faces:
        mb.add_face([i + off for i in f])


# ── 매핑 ─────────────────────────────────────────────────────
def frame_map(origin, along, normal):
    """자유 배치: y→along, z→normal, x→along×normal."""
    y = Vector(along).normalized()
    z = Vector(normal)
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z).normalized()
    o = Vector(origin)
    return lambda px, py, pz: o + x * px + y * py + z * pz


def sph(col_deg, az_deg):
    c, a = math.radians(col_deg), math.radians(az_deg)
    return Vector((math.sin(c) * math.sin(a), -math.sin(c) * math.cos(a), math.cos(c)))


def sphere_map(center, R, col_deg, az_deg, grow_dir=None, lift=0.0, scale=(1, 1, 1)):
    """구면 위에 잎을 눕힌다. 기본 성장 방향은 자오선을 따라 아래(극에서 멀어지는 쪽)."""
    center = Vector(center)
    a = sph(col_deg, az_deg)
    if grow_dir is None:
        t = sph(col_deg + 90, az_deg)
        t = (t - a * t.dot(a)).normalized()
    else:
        t = Vector(grow_dir)
        t = (t - a * t.dot(a)).normalized()
    b = a.cross(t).normalized()
    sx, sy, sz = scale

    def f(px, py, pz):
        rot = Quaternion(b, py / R)
        p = rot @ a
        phi = px / R
        d = (p * math.cos(phi) - b * math.sin(phi)).normalized()
        r = R + lift + pz
        v = d * r
        return center + Vector((v.x * sx, v.y * sy, v.z * sz))
    return f


def cone_map(origin, theta_deg, r0, tilt_deg, lift=0.0, yscale=1.0):
    """세로축 주위 원뿔면. theta: +X에서 반시계(위에서 볼 때), 잎은 아래·바깥으로 자란다."""
    o = Vector(origin)
    th0 = math.radians(theta_deg)
    T = math.radians(tilt_deg)

    def f(px, py, pz):
        r = r0 + py * math.sin(T)
        h = -py * math.cos(T)
        th = th0 - px / max(r, 1e-3)
        radial = Vector((math.cos(th), math.sin(th), 0.0))
        n = radial * math.cos(T) + Vector((0, 0, 1)) * math.sin(T)
        p = Vector((r * math.cos(th), r * math.sin(th) * yscale, h)) + n * (pz + lift)
        return o + p
    return f


# ── 튜브 ─────────────────────────────────────────────────────
def tube(mb, pts, radii, segs=10, color=(1, 1, 1), color_end=None, weight=None,
         cap_start=True, cap_end=True, flat=1.0, up=Vector((0, 0, 1)), weight_fn=None):
    pts = [Vector(p) for p in pts]
    n = len(pts)
    base = len(mb.v)
    # 평행 이동 프레임
    tangents = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized())
    ref = Vector(up)
    if abs(ref.dot(tangents[0])) > 0.95:
        ref = Vector((1, 0, 0))
    nrm = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    frames = []
    for i in range(n):
        if i > 0:
            axis = tangents[i - 1].cross(tangents[i])
            if axis.length > 1e-6:
                ang = tangents[i - 1].angle(tangents[i])
                nrm = Quaternion(axis.normalized(), ang) @ nrm
        bin_ = tangents[i].cross(nrm).normalized()
        frames.append((nrm.copy(), bin_))
    for i in range(n):
        nrm_i, bin_i = frames[i]
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        c = mix(color, color_end, i / (n - 1)) if color_end else color
        for k in range(segs):
            a = 2 * math.pi * k / segs
            off = nrm_i * (math.cos(a) * r * flat) + bin_i * (math.sin(a) * r)
            p = pts[i] + off
            w = weight_fn(pts[i], i / (n - 1)) if weight_fn else weight
            mb.add_vertex(p, c, w)
    for i in range(n - 1):
        for k in range(segs):
            a0 = base + i * segs + k
            a1 = base + i * segs + (k + 1) % segs
            b0 = base + (i + 1) * segs + k
            b1 = base + (i + 1) * segs + (k + 1) % segs
            mb.add_face((a0, a1, b1, b0))
    if cap_start:
        w = weight_fn(pts[0], 0.0) if weight_fn else weight
        ci = mb.add_vertex(pts[0] - tangents[0] * (radii[0] if isinstance(radii, (list, tuple)) else radii) * 0.4, color, w)
        for k in range(segs):
            mb.add_face((ci, base + (k + 1) % segs, base + k))
    if cap_end:
        last = base + (n - 1) * segs
        r_end = radii[-1] if isinstance(radii, (list, tuple)) else radii
        w = weight_fn(pts[-1], 1.0) if weight_fn else weight
        ce = mb.add_vertex(pts[-1] + tangents[-1] * r_end * 0.4, color_end or color, w)
        for k in range(segs):
            mb.add_face((ce, last + k, last + (k + 1) % segs))


# ── 기본 도형(bpy) ────────────────────────────────────────────
def uv_sphere(name, radius, loc, scale=(1, 1, 1), segs=32, rings=16, coll=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius, calc_uvs=True)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    link(obj, coll)
    return obj


def paint_vertices(obj, fn):
    me = obj.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        c = fn(v.co)
        attr.data[i].color = (c[0], c[1], c[2], 1.0)


def weight_all(obj, bone_or_fn):
    me = obj.data
    if isinstance(bone_or_fn, str):
        g = obj.vertex_groups.get(bone_or_fn) or obj.vertex_groups.new(name=bone_or_fn)
        g.add([v.index for v in me.vertices], 1.0, 'REPLACE')
        return
    for v in me.vertices:
        for b, val in bone_or_fn(v.co).items():
            g = obj.vertex_groups.get(b) or obj.vertex_groups.new(name=b)
            if val > 0:
                g.add([v.index], val, 'REPLACE')


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)
    return obj


def to_mesh_object(src, name, coll=None):
    """메타볼 등 평가 결과를 새 메시 오브젝트로."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = src.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
    me.name = name
    obj = bpy.data.objects.new(name, me)
    link(obj, coll)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def join(objs, name):
    objs = [o for o in objs if o]
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    with bpy.context.temp_override(active_object=objs[0], object=objs[0],
                                   selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ── 렌더 미리보기 ─────────────────────────────────────────────
def setup_preview(sc, target=(0, 0, 0.55), dist=2.6, bg=(0.93, 0.96, 0.98), res=(640, 800), samples=24):
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (*bg, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    sc.world = world
    cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
    cam.data.lens = 70
    link(cam)
    sc.camera = cam
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    link(sun)
    fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
    fill.data.energy = 0.8
    fill.rotation_euler = (math.radians(70), 0, math.radians(140))
    link(fill)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    return cam


def shoot(sc, cam, path, az_deg=0, el_deg=8, target=(0, 0, 0.55), dist=2.6):
    t = Vector(target)
    a, e = math.radians(az_deg), math.radians(el_deg)
    pos = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.location = pos
    d = (t - pos)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
