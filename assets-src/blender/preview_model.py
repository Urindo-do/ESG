"""모델 미리보기 렌더 (Cycles CPU)."""
import os, sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import setup_preview, shoot
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.name.startswith('prop_twig'):
        o.hide_render = True
cam = setup_preview(sc, res=(560, 700), samples=20)
tgt = (0, 0, 0.56)
for az in (0, -35, 90, 180):
    shoot(sc, cam, f'{out}_{az}.png', az_deg=az, el_deg=6, target=tgt, dist=2.9)
