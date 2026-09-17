"""동작 미리보기: 클립별 대표 프레임을 렌더해 한 장으로."""
import os, sys, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import setup_preview, shoot
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
rig = bpy.data.objects['Hwangyeongi']
cam = setup_preview(sc, res=(300, 360), samples=10)
shots = [('idle', 0.0), ('happy_idle', 0.25), ('sad_idle', 0.3), ('walk', 0.25), ('sad_walk', 0.25), ('jump', 0.45),
         ('wave', 0.2), ('water', 0.3), ('plant', 0.3), ('sweep', 0.25), ('shake', 0.2), ('pickup', 0.48),
         ('sleep', 0.3), ('sit_sad', 0.3), ('stretch', 0.5), ('look', 0.25)]
sad = {'sad_idle', 'sad_walk', 'sit_sad', 'pickup', 'shake'}
for name, frac in shots:
    act = bpy.data.actions[name]
    rig.animation_data.action = act
    f0, f1 = act.frame_range
    sc.frame_set(int(f0 + (f1 - f0) * frac))
    bpy.data.objects['prop_twig'].hide_render = name not in sad
    bpy.data.objects['prop_pot'].hide_render = name in sad or name in ('water', 'sweep', 'plant', 'stretch')
    shoot(sc, cam, f'{out}_{name}.png', az_deg=-30, el_deg=10, target=(0, 0, 0.5), dist=3.3)
