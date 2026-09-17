import os, sys, math, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import setup_preview, shoot
blend, out = sys.argv[-3], sys.argv[-2]
names = sys.argv[-1].split(',')
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
for o in sc.objects:
    if o.type == 'MESH' and o.name not in names:
        o.hide_render = True
x = 0
for n in names:
    o = sc.objects[n]
    o.location = (x + o.dimensions.x / 2, 0, 0)
    x += o.dimensions.x + 0.25
cam = setup_preview(sc, res=(1600, 600), samples=16)
cam.data.lens = 40
shoot(sc, cam, out, az_deg=-15, el_deg=18, target=(x / 2, 0, 0.5), dist=x * 1.05 + 1)
