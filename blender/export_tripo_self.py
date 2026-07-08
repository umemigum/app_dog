"""Export the hand-adjusted Tripo self model to the app GLB.

This uses blender/piramidog_tripo_self.blend as the source. That file keeps the
manually edited model where the original Body mesh is removed and InnerBody is
the visible pyramid body.

Usage:
  Blender --background --python blender/export_tripo_self.py
"""
import os

import bpy


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND = os.path.join(ROOT_DIR, "blender", "piramidog_tripo_self.blend")
OUT = os.path.join(ROOT_DIR, "assets", "piramidog.glb")


bpy.ops.wm.open_mainfile(filepath=BLEND)

root = bpy.data.objects.get("Piramidog")
if root is None:
    raise RuntimeError("Piramidog root object is missing")

objects = [root] + list(root.children_recursive)
missing = [name for name in ("InnerBody", "EarL", "EarR", "EyeL", "EyeR", "Tongue")
           if bpy.data.objects.get(name) is None]
if missing:
    raise RuntimeError(f"Required objects are missing: {', '.join(missing)}")
if bpy.data.objects.get("Body") is not None:
    raise RuntimeError("Body should not be present in piramidog_tripo_self.blend")

bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root

bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_apply=True,
                          export_animations=False, export_yup=True)
print("EXPORT_DONE:", OUT)
