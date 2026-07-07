"""Meshy GLB をパーツ分けして、アプリ用の piramidog.glb に仕上げる

使い方:
  Blender --background --python blender/build_from_meshy.py -- stats   # アイランド調査のみ
  Blender --background --python blender/build_from_meshy.py -- build   # 分離+リネーム+書き出し
"""
import bpy
import bmesh
import math
import os
import sys
import mathutils

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "assets", "Meshy_AI_Pyramid_Pup_0706053840_texture.glb")
MODE = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "stats"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.import_scene.gltf(filepath=GLB)

mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")

# ---------------------------------------------------------------- 分離
bpy.context.view_layer.objects.active = mesh_obj
mesh_obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

parts = [o for o in bpy.data.objects if o.type == "MESH"]


def part_info(o):
    verts = len(o.data.vertices)
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    mins = mathutils.Vector(map(min, *bb))
    maxs = mathutils.Vector(map(max, *bb))
    center = (mins + maxs) / 2
    dims = maxs - mins
    return verts, center, dims


infos = sorted([(o, *part_info(o)) for o in parts], key=lambda x: -x[1])

print("========== TOP ISLANDS ==========")
for o, verts, center, dims in infos[:25]:
    print(f"verts={verts:7d} center=({center.x:+.3f},{center.y:+.3f},{center.z:+.3f}) "
          f"dims=({dims.x:.3f},{dims.y:.3f},{dims.z:.3f})")

if MODE == "stats":
    sys.exit(0)

# ---------------------------------------------------------------- 色でパッチ分類
import numpy as np

# ベースカラー画像(Principled の Base Color につながっている画像)を探す
mat = bpy.data.materials[0]
base_img = None
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
for link in mat.node_tree.links:
    if link.to_node == bsdf and link.to_socket.name == "Base Color":
        node = link.from_node
        # Mix ノード等を1段だけ遡る
        for _ in range(3):
            if node.type == "TEX_IMAGE":
                base_img = node.image
                break
            srcs = [l.from_node for l in mat.node_tree.links if l.to_node == node]
            if not srcs:
                break
            node = srcs[0]
if base_img is None:
    base_img = bpy.data.images[0]
print("BASE COLOR IMAGE:", base_img.name, base_img.size[:])

W, Hpx = base_img.size
px = np.array(base_img.pixels[:], dtype=np.float32).reshape(Hpx, W, 4)

# ---------------------------------------------------------------- テクスチャ色補正
# リファレンス(斜め正面イラスト)に合わせて、体色をクリーム寄りに・黒を締める
r_, g_, b_ = px[:, :, 0], px[:, :, 1], px[:, :, 2]
peach = (r_ > 0.55) & ((r_ - g_) > 0.08) & ((r_ - g_) < 0.35) & (b_ < r_)
target = np.array([0.95, 0.87, 0.72], dtype=np.float32)
px[:, :, :3][peach] = px[:, :, :3][peach] * 0.55 + target * 0.45
dark = px[:, :, :3].max(axis=2) < 0.42
px[:, :, :3][dark] *= 0.8
base_img.pixels.foreach_set(px.ravel())
base_img.update()
print("TEXTURE CORRECTED: peach px =", int(peach.sum()), " dark px =", int(dark.sum()))


def avg_color(o, samples=60):
    me = o.data
    uvd = me.uv_layers.active.data
    n = len(me.polygons)
    step = max(1, n // samples)
    cols = []
    for i in range(0, n, step):
        p = me.polygons[i]
        uv = uvd[p.loop_start].uv
        x = min(W - 1, max(0, int(uv.x * W)))
        y = min(Hpx - 1, max(0, int(uv.y * Hpx)))
        cols.append(px[y, x, :3])
    return np.mean(cols, axis=0)


def classify(o):
    verts, center, dims = part_info(o)
    r, g, b = avg_color(o)
    # 舌: あかるいピンク
    if r > 0.9 and (r - g) > 0.3 and center.y < -0.5:
        return "Tongue", (r, g, b)
    # 耳: サイドの黒〜こげ茶パッチ
    if max(r, g, b) < 0.38 and abs(center.x) > 0.42 and center.z > -0.5:
        return ("EarL" if center.x < 0 else "EarR"), (r, g, b)
    return "Body", (r, g, b)


# ---------------------------------------------------------------- 黒い浮遊ゴミを削除
specks = []
for o in list(parts):
    verts, center, dims = part_info(o)
    if max(dims) < 0.08 and verts <= 80:
        r, g, b = avg_color(o)
        if max(r, g, b) < 0.5:
            specks.append(o)
            parts.remove(o)
for o in specks:
    bpy.data.objects.remove(o, do_unlink=True)
print("REMOVED SPECKS:", len(specks))

groups = {}
print("========== CLASSIFY (Body以外) ==========")
for o in parts:
    cls, col = classify(o)
    groups.setdefault(cls, []).append(o)
    if cls != "Body":
        verts, center, dims = part_info(o)
        print(f"{cls:8s} verts={verts:6d} center=({center.x:+.3f},{center.y:+.3f},{center.z:+.3f}) "
              f"dims=({dims.x:.3f},{dims.y:.3f},{dims.z:.3f}) rgb=({col[0]:.2f},{col[1]:.2f},{col[2]:.2f})")

print("GROUP COUNTS:", {k: len(v) for k, v in groups.items()})

required = ["EarL", "EarR", "Tongue"]
missing = [k for k in required if k not in groups]
if missing:
    print("MISSING_PARTS:", missing, "→ しきい値の調整が必要")
    sys.exit(1)


def join_group(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


body = join_group("Body", groups["Body"])
earL = join_group("EarL", groups["EarL"])
earR = join_group("EarR", groups["EarR"])
tongue = join_group("Tongue", groups["Tongue"])
named = [body, earL, earR, tongue]


def make_simple_mat(name, srgb_col, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bnode = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bnode.inputs["Base Color"].default_value = tuple(pow(cc, 2.2) for cc in srgb_col) + (1.0,)
    bnode.inputs["Roughness"].default_value = rough
    return m


mat_skin = make_simple_mat("LidSkin", (0.93, 0.80, 0.62), 0.55)
mat_dark = make_simple_mat("LidLine", (0.06, 0.05, 0.045), 0.2)

# ---------------------------------------------------------------- 位置・スケール正規化
# 床を z=0 に、高さを 1.3 に
mins = mathutils.Vector((1e9,) * 3)
maxs = mathutils.Vector((-1e9,) * 3)
for o in named:
    for c in o.bound_box:
        wc = o.matrix_world @ mathutils.Vector(c)
        mins = mathutils.Vector(map(min, mins, wc))
        maxs = mathutils.Vector(map(max, maxs, wc))
scale = 1.3 / (maxs.z - mins.z)

for o in named:
    o.location.z -= mins.z
bpy.ops.object.select_all(action="DESELECT")
for o in named:
    o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in named:
    o.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------------------------------------------------------------- 耳のピボット(付け根=上端の内側)
for ear, sx in [(earL, -1), (earR, 1)]:
    bb = [ear.matrix_world @ mathutils.Vector(c) for c in ear.bound_box]
    bmins = mathutils.Vector(map(min, *bb))
    bmaxs = mathutils.Vector(map(max, *bb))
    cx = (bmins.x + bmaxs.x) / 2
    cy = (bmins.y + bmaxs.y) / 2
    pivot = mathutils.Vector((cx - sx * (bmaxs.x - bmins.x) * 0.25, cy, bmaxs.z - 0.02))
    scene.cursor.location = pivot
    bpy.ops.object.select_all(action="DESELECT")
    ear.select_set(True)
    bpy.context.view_layer.objects.active = ear
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

    # 付け根のすきまを埋める黒いキャップ(耳と一緒に回る・外から見えない大きさ)
    ear_w = bmaxs.x - bmins.x
    rx = ear_w * 0.15
    ry = ear_w * 0.20
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0)
    cap = bpy.context.object
    for v in cap.data.vertices:
        v.co.x *= rx
        v.co.y *= ry
        v.co.z *= 0.08
    cap.data.materials.append(mat_dark)
    for pp in cap.data.polygons:
        pp.use_smooth = True
    cap.location = (pivot.x + sx * rx * 0.2, pivot.y, pivot.z - 0.13)
    bpy.ops.object.select_all(action="DESELECT")
    cap.select_set(True)
    ear.select_set(True)
    bpy.context.view_layer.objects.active = ear
    bpy.ops.object.join()

# ---------------------------------------------------------------- 舌のピボット(付け根=上・奥)
bb = [tongue.matrix_world @ mathutils.Vector(c) for c in tongue.bound_box]
tmins = mathutils.Vector(map(min, *bb))
tmaxs = mathutils.Vector(map(max, *bb))
scene.cursor.location = ((tmins.x + tmaxs.x) / 2, tmaxs.y - 0.005, tmaxs.z - 0.005)
bpy.ops.object.select_all(action="DESELECT")
tongue.select_set(True)
bpy.context.view_layer.objects.active = tongue
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# ---------------------------------------------------------------- 目の切り出し
# 前面上部の「暗いテクセル」の面を Body から分離して EyeL / EyeR にする
bpy.context.tool_settings.mesh_select_mode = (False, False, True)
me = body.data
uvd = me.uv_layers.active.data

eye_idx = {"L": [], "R": []}
eye_pos = {"L": [], "R": []}
for p in me.polygons:
    c = p.center
    # 鼻(z<0.52)より上、耳(|x|>0.28)より内側、前面(y<-0.42)に限定
    if c.y < -0.42 and 0.52 < c.z < 0.72 and abs(c.x) < 0.28:
        uv = uvd[p.loop_start].uv
        xi = min(W - 1, max(0, int(uv.x * W)))
        yi = min(Hpx - 1, max(0, int(uv.y * Hpx)))
        col = px[yi, xi, :3]
        if max(col) < 0.45:
            side = "L" if c.x < 0 else "R"
            eye_idx[side].append(p.index)
            eye_pos[side].append((c.x, c.y, c.z))

print("EYE POLYS:", {k: len(v) for k, v in eye_idx.items()})

eye_center = {}
eye_width = {}
for side in ("L", "R"):
    if eye_pos[side]:
        arr = np.array(eye_pos[side])
        eye_center[side] = mathutils.Vector(arr.mean(axis=0))
        eye_width[side] = min(0.14, max(0.06, float(arr[:, 0].max() - arr[:, 0].min())))
    else:
        sxx = -1 if side == "L" else 1
        eye_center[side] = mathutils.Vector((0.14 * sxx, -0.42, 0.72))
        eye_width[side] = 0.11
print("EYE CENTERS:", {k: tuple(round(v, 3) for v in eye_center[k]) for k in eye_center},
      "WIDTHS:", {k: round(eye_width[k], 3) for k in eye_width})


eyes = {}
if eye_idx["L"] and eye_idx["R"]:
    for p in me.polygons:
        p.select = False
    for side in ("L", "R"):
        for i in eye_idx[side]:
            me.polygons[i].select = True
    before = set(bpy.data.objects)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    tmp = next(o for o in bpy.data.objects if o not in before)
    # バラして左右に振り分け
    bpy.ops.object.select_all(action="DESELECT")
    tmp.select_set(True)
    bpy.context.view_layer.objects.active = tmp
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    frags = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    sides = {"L": [], "R": []}
    for f in frags:
        _, fc, _ = part_info(f)
        sides["L" if fc.x < 0 else "R"].append(f)
    if sides["L"]:
        eyes["L"] = join_group("EyeL", sides["L"])
    if sides["R"]:
        eyes["R"] = join_group("EyeR", sides["R"])

for side, ename in (("L", "EyeL"), ("R", "EyeR")):
    if side not in eyes:
        # 保険: 見つからなければ黒ビーズを置く
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10,
                                             radius=eye_width[side] * 0.5)
        o = bpy.context.object
        o.name = ename
        o.location = eye_center[side]
        o.data.materials.append(mat_dark)
        for pp in o.data.polygons:
            pp.use_smooth = True
        eyes[side] = o
named += [eyes["L"], eyes["R"]]

# ---------------------------------------------------------------- まぶた(とじ目)
model_h = 1.3
front_d = 0.78
tilt = math.atan2(model_h, front_d)
n_out = mathutils.Vector((0, -model_h, front_d)).normalized()

for side, name in (("L", "EyeClosedL"), ("R", "EyeClosedR")):
    w = eye_width[side]
    ec = mathutils.Vector(eye_center[side])

    # 肌色のまぶた(目の穴をふさぐ、うすいふくらみ)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=w * 0.85)
    lid = bpy.context.object
    for v in lid.data.vertices:
        v.co.z *= 0.3
    lid.data.materials.append(mat_skin)
    for pp in lid.data.polygons:
        pp.use_smooth = True

    # ∩ のライン
    bpy.ops.mesh.primitive_torus_add(major_radius=w * 0.45, minor_radius=w * 0.12,
                                     major_segments=24, minor_segments=8)
    arc = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(arc.data)
    doomed = [vv for vv in bm.verts if vv.co.y < -1e-4]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(arc.data)
    bm.free()
    arc.data.materials.append(mat_dark)
    for pp in arc.data.polygons:
        pp.use_smooth = True
    arc.location = (0, 0, w * 0.3)

    bpy.ops.object.select_all(action="DESELECT")
    lid.select_set(True)
    arc.select_set(True)
    bpy.context.view_layer.objects.active = lid
    bpy.ops.object.join()
    lid = bpy.context.view_layer.objects.active
    lid.name = name
    lid.rotation_euler = (tilt, 0, 0)
    lid.location = ec + n_out * 0.02
    lid.hide_render = True  # まばたき時のみアプリ側で表示
    named.append(lid)

# ---------------------------------------------------------------- ルートにまとめて書き出し
root = bpy.data.objects.new("Piramidog", None)
scene.collection.objects.link(root)
for o in named:
    o.parent = root

blend_path = os.path.join(ROOT, "blender", "piramidog_meshy.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("BLEND_SAVED:", blend_path)

bpy.ops.object.select_all(action="DESELECT")
for o in named + [root]:
    o.select_set(True)
out = os.path.join(ROOT, "assets", "piramidog.glb")
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True,
                          export_animations=False, export_yup=True)
print("EXPORT_DONE:", out)

# ---------------------------------------------------------------- 確認レンダリング
def add_area(name, loc, rot_deg, size, energy):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.size = size
    l.data.energy = energy
    l.rotation_euler = tuple(math.radians(a) for a in rot_deg)


world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 0.5
add_area("Key", (-2.5, -3.0, 3.5), (50, -20, -35), 3.0, 300)
add_area("Fill", (3.0, -2.5, 1.5), (75, 25, 50), 4.0, 100)

bpy.ops.object.camera_add(location=(-2.2, -4.0, 1.7))
cam = bpy.context.object
cam.data.lens = 60
scene.camera = cam
target = bpy.data.objects.new("CamTarget", None)
target.location = (0, 0, 0.55)
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
out_png = os.path.join(ROOT, "blender", "renders", "meshy_build_preview.png")
scene.render.filepath = out_png
bpy.ops.render.render(write_still=True)
print("RENDER_DONE:", out_png)
