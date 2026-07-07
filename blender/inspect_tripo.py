"""Meshy GLB の構造調査 + プレビューレンダリング"""
import bpy
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "assets", "triangle dog 3d model.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.import_scene.gltf(filepath=GLB)

print("========== OBJECTS ==========")
for o in bpy.data.objects:
    dims = tuple(round(v, 3) for v in o.dimensions)
    loc = tuple(round(v, 3) for v in o.location)
    print(f"- {o.name} | type={o.type} | dims={dims} | loc={loc} | parent={o.parent.name if o.parent else None}")
    if o.type == "MESH":
        me = o.data
        print(f"    verts={len(me.vertices)} polys={len(me.polygons)} materials={[m.name if m else None for m in me.materials]}")
        print(f"    shape_keys={bool(me.shape_keys)} uv_layers={[u.name for u in me.uv_layers]}")

print("========== MATERIALS ==========")
for m in bpy.data.materials:
    print(f"- {m.name}")
    if m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                print(f"    image: {n.image.name} {n.image.size[0]}x{n.image.size[1]}")

print("========== ARMATURES / ANIMS ==========")
print("armatures:", [o.name for o in bpy.data.objects if o.type == "ARMATURE"])
print("actions:", [a.name for a in bpy.data.actions])

# ---- ざっくり接続パーツ(アイランド)数を確認 ----
import bmesh
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    islands = 0
    for v in bm.verts:
        if v.index in seen:
            continue
        islands += 1
        stack = [v]
        seen.add(v.index)
        while stack:
            cur = stack.pop()
            for e in cur.link_edges:
                w = e.other_vert(cur)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
    print(f"ISLANDS {o.name}: {islands}")
    bm.free()

# ---- プレビューレンダリング ----
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 0.6

def add_area(name, loc, rot_deg, size, energy):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.size = size
    l.data.energy = energy
    l.rotation_euler = tuple(math.radians(a) for a in rot_deg)

# モデル全体のバウンディングから概算スケールを出す
import mathutils
mins = mathutils.Vector((1e9, 1e9, 1e9))
maxs = mathutils.Vector((-1e9, -1e9, -1e9))
for o in bpy.data.objects:
    if o.type == "MESH":
        for corner in o.bound_box:
            wc = o.matrix_world @ mathutils.Vector(corner)
            mins = mathutils.Vector(map(min, mins, wc))
            maxs = mathutils.Vector(map(max, maxs, wc))
size = maxs - mins
center = (maxs + mins) / 2
print("BBOX min:", tuple(round(v, 3) for v in mins))
print("BBOX max:", tuple(round(v, 3) for v in maxs))
print("SIZE:", tuple(round(v, 3) for v in size))

s = max(size.x, size.y, size.z)
add_area("Key", (center.x - 2 * s, center.y - 2.5 * s, center.z + 2.5 * s), (50, -20, -35), 2 * s, 400 * s * s)
add_area("Fill", (center.x + 2 * s, center.y - 2 * s, center.z + s), (75, 25, 50), 3 * s, 150 * s * s)

bpy.ops.object.camera_add(location=(center.x - 1.7 * s, center.y - 2.6 * s, center.z + 1.1 * s))
cam = bpy.context.object
cam.data.lens = 55
scene.camera = cam
target = bpy.data.objects.new("CamTarget", None)
target.location = center
scene.collection.objects.link(target)
tc = cam.constraints.new("TRACK_TO")
tc.target = target

for vt in ("Khronos PBR Neutral", "Standard"):
    try:
        scene.view_settings.view_transform = vt
        break
    except TypeError:
        continue
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 768
scene.render.resolution_y = 768
out = os.path.join(ROOT, "blender", "renders", "tripo_preview.png")
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDER_DONE:", out)
