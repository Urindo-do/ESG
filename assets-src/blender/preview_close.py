import os, sys, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import setup_preview, shoot
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.name.startswith('prop_twig'): o.hide_render = True
cam = setup_preview(sc, res=(700, 560), samples=24)
shoot(sc, cam, f'{out}_face.png', az_deg=0, el_deg=4, target=(0, 0, 0.66), dist=1.35)
shoot(sc, cam, f'{out}_side.png', az_deg=-60, el_deg=15, target=(0, 0, 0.62), dist=1.5)
