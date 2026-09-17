import os, sys, math, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import setup_preview, shoot
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
objs = [o for o in sc.objects if o.type == 'MESH']
big = [o for o in objs if max(o.dimensions) > 1.2]
small = [o for o in objs if max(o.dimensions) <= 1.2]
x = 0
for o in big:
    o.location = (x, 0, 0); x += max(o.dimensions.x, 1.0) + 0.6
x2 = 0
for i, o in enumerate(small):
    o.location = (x2, -3.0, 0); x2 += max(o.dimensions.x, 0.3) + 0.35
    if o.name.startswith('prop_'):
        o.location.z = 0.7
cam = setup_preview(sc, res=(1800, 700), samples=12)
cam.data.lens = 24
cx = max(x, x2) / 2
shoot(sc, cam, out, az_deg=0, el_deg=22, target=(cx, -1.5, 0.9), dist=max(x, x2) * 0.62)
