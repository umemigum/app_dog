"""ハイブリッド版 piramidog.glb の生成

Meshy モデルは本体シルエットの土台として使い、
目・鼻・マズル・舌・耳はシンプルな Blender プリミティブで上乗せする。

使い方:
  Blender --background --python blender/build_hybrid.py -- build
"""
import bpy
import bmesh
import math
import os
import sys
import mathutils
from mathutils import Vector, Quaternion
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "assets", "Meshy_AI_Pyramid_Pup_0706053840_texture.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")

# ---------------------------------------------------------------- 島に分解
bpy.context.view_layer.objects.active = mesh_obj
mesh_obj.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [o for o in bpy.data.objects if o.type == "MESH"]


def part_info(o):
    verts = len(o.data.vertices)
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mins = Vector(map(min, *bb))
    maxs = Vector(map(max, *bb))
    return verts, (mins + maxs) / 2, maxs - mins


# ---------------------------------------------------------------- テクスチャ
mat = bpy.data.materials[0]
base_img = None
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
for link in mat.node_tree.links:
    if link.to_node == bsdf and link.to_socket.name == "Base Color":
        node = link.from_node
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

W, Hpx = base_img.size
px = np.array(base_img.pixels[:], dtype=np.float32).reshape(Hpx, W, 4)

# 色補正: 体をクリーム寄りに、黒を締める(リファレンス合わせ)
r_, g_, b_ = px[:, :, 0], px[:, :, 1], px[:, :, 2]
peach = (r_ > 0.55) & ((r_ - g_) > 0.08) & ((r_ - g_) < 0.35) & (b_ < r_)
target = np.array([0.95, 0.87, 0.72], dtype=np.float32)
px[:, :, :3][peach] = px[:, :, :3][peach] * 0.55 + target * 0.45
dark_px = px[:, :, :3].max(axis=2) < 0.42
px[:, :, :3][dark_px] *= 0.8


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


# ---------------------------------------------------------------- 置き換え対象の島を削除
removed = {"speck": 0, "ear": 0, "tongue": 0, "face": 0}
ear_boxes = {"L": [], "R": []}   # あて布用に削除範囲を記録(旧座標)
face_boxes = []
for o in list(parts):
    verts, center, dims = part_info(o)
    r, g, b = avg_color(o)
    maxdim = max(dims)
    if maxdim < 0.08 and verts <= 80 and max(r, g, b) < 0.5:
        kind = "speck"          # 黒ゴミ
    elif max(r, g, b) < 0.38 and abs(center.x) > 0.42 and center.z > -0.5:
        kind = "ear"            # Meshyの耳
        ear_boxes["L" if center.x < 0 else "R"].append((center, dims))
    elif r > 0.9 and (r - g) > 0.3 and center.y < -0.5:
        kind = "tongue"         # Meshyの舌
        face_boxes.append((center, dims))
    elif center.y < -0.82 and abs(center.x) < 0.45 and -0.65 < center.z < -0.1:
        kind = "face"           # 鼻・マズル・口まわりのふくらみ
        face_boxes.append((center, dims))
    else:
        continue
    removed[kind] += 1
    parts.remove(o)
    bpy.data.objects.remove(o, do_unlink=True)
print("REMOVED:", removed)


def combined_box(box_list):
    mins = Vector((1e9,) * 3)
    maxs = Vector((-1e9,) * 3)
    for center, dims in box_list:
        mins = Vector(map(min, mins, center - dims / 2))
        maxs = Vector(map(max, maxs, center + dims / 2))
    return (mins + maxs) / 2, maxs - mins

# ---------------------------------------------------------------- Body に統合
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = "Body"

# ---------------------------------------------------------------- 目テクセルを肌色に塗りつぶし + 目位置検出(旧座標系)
me = body.data
uvd = me.uv_layers.active.data
skin = np.array([0.93, 0.80, 0.62], dtype=np.float32)
eye_pos_old = {"L": [], "R": []}
paint = 0
for p in me.polygons:
    c = p.center
    if c.y < -0.42 and -0.28 < c.z < 0.02 and abs(c.x) < 0.28:
        uv = uvd[p.loop_start].uv
        xi = min(W - 1, max(0, int(uv.x * W)))
        yi = min(Hpx - 1, max(0, int(uv.y * Hpx)))
        if px[yi, xi, :3].max() < 0.45:
            eye_pos_old["L" if c.x < 0 else "R"].append((c.x, c.y, c.z))
            px[max(0, yi - 4):yi + 5, max(0, xi - 4):xi + 5, :3] = skin
            paint += 1
print("EYE POLY PAINTED:", paint, {k: len(v) for k, v in eye_pos_old.items()})

# 削除跡のまわりに残った「影のこげ茶テクセル」も肌色に塗り替える
zones = []
for side in ("L", "R"):
    if ear_boxes[side]:
        c_, d_ = combined_box(ear_boxes[side])
        zones.append((c_, d_ / 2 + Vector((0.12, 0.12, 0.12))))
if face_boxes:
    c_, d_ = combined_box(face_boxes)
    zones.append((c_, d_ / 2 + Vector((0.08, 0.08, 0.08))))

sock = 0
for p in me.polygons:
    c = p.center
    for zc, zh in zones:
        if abs(c.x - zc.x) < zh.x and abs(c.y - zc.y) < zh.y and abs(c.z - zc.z) < zh.z:
            uv = uvd[p.loop_start].uv
            xi = min(W - 1, max(0, int(uv.x * W)))
            yi = min(Hpx - 1, max(0, int(uv.y * Hpx)))
            col = px[yi, xi, :3]
            if col.max() < 0.62 and not (col[0] - col[1] > 0.3):
                px[max(0, yi - 4):yi + 5, max(0, xi - 4):xi + 5, :3] = skin
                sock += 1
            break
print("SOCKET POLY PAINTED:", sock)

base_img.pixels.foreach_set(px.ravel())
base_img.update()

eyeC_old = {}
for side, fallback_x in (("L", -0.145), ("R", 0.145)):
    if eye_pos_old[side]:
        arr = np.array(eye_pos_old[side])
        eyeC_old[side] = Vector(arr.mean(axis=0))
    else:
        eyeC_old[side] = Vector((fallback_x, -0.56, -0.13))

# ---------------------------------------------------------------- 正規化(床 z=0、高さ1.3)
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
mins = Vector(map(min, *bb))
maxs = Vector(map(max, *bb))
scale = 1.3 / (maxs.z - mins.z)
body.location.z -= mins.z
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

H = 1.3
eyeC = {s: (eyeC_old[s] + Vector((0, 0, -mins.z))) * scale for s in ("L", "R")}
print("EYE CENTERS(new):", {s: tuple(round(v, 3) for v in eyeC[s]) for s in eyeC})

# 顔は膨らんでいるので D を2種類使う:
#  D_face = 顔パーツ配置用(頂点と目の実測位置を通る面)
#  D_base = 土台用(足元の実測。内側ピラミッド・耳の辺方向に使う)
co = np.empty(len(me.vertices) * 3, dtype=np.float32)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)

eye_mid_tmp = (eyeC["L"] + eyeC["R"]) / 2
pt_y = eye_mid_tmp.y + 0.05  # 目ビーズの出っ張りぶんを面に引き戻す
D_face = min(1.0, max(0.7, -pt_y / (1 - eye_mid_tmp.z / H)))

D_base = 0.62
print("FACE D_face =", round(D_face, 3), " D_base =", D_base)

D = D_face
L = math.sqrt(D * D + H * H)
UP = Vector((0, D / L, H / L))        # 斜面に沿って上る方向
N = Vector((0, -H / L, D / L))        # 面の外向き法線
FACE_TILT = math.atan2(H, D)

# 目の実測位置から顔アンカーを決める(v=0.09 が目の高さになるように)
eye_mid = (eyeC["L"] + eyeC["R"]) / 2
FACE_H = eye_mid.z - UP.z * 0.09
EYE_X = (abs(eyeC["L"].x) + abs(eyeC["R"].x)) / 2


def face_pos(x, v, out):
    base_y = -D * (1 - FACE_H / H)
    return (x, base_y + UP.y * v + N.y * out, FACE_H + UP.z * v + N.z * out)


# ---------------------------------------------------------------- マテリアルとヘルパー
def make_simple_mat(name, hexcode, rough, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rr = int(hexcode[0:2], 16) / 255
    gg = int(hexcode[2:4], 16) / 255
    bb_ = int(hexcode[4:6], 16) / 255
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs["Base Color"].default_value = (lin(rr), lin(gg), lin(bb_), 1)
    b.inputs["Roughness"].default_value = rough
    if coat > 0:
        try:
            b.inputs["Coat Weight"].default_value = coat
        except KeyError:
            pass
    return m


MAT_CREAM = make_simple_mat("FaceCream", "F2E4BE", 0.5)
MAT_BLACK = make_simple_mat("FaceBlack", "1E1A17", 0.15, coat=0.8)
MAT_TONGUE = make_simple_mat("FaceTongue", "E84F63", 0.35)


def scale_verts(obj, sx, sy, sz, offset=(0, 0, 0)):
    for v in obj.data.vertices:
        v.co.x = v.co.x * sx + offset[0]
        v.co.y = v.co.y * sy + offset[1]
        v.co.z = v.co.z * sz + offset[2]


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def add_sphere(name, radius, m, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    smooth(o)
    return o


named = [body]

# ---------------------------------------------------------------- 内側ピラミッド(穴の裏打ち)
# Meshyの島を消した跡が穴として見えないよう、体色の内側ピラミッドを仕込む
MAT_INNER = make_simple_mat("InnerBody", "EDCC9E", 0.55)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=D_base * math.sqrt(2) * 0.97,
                                radius2=0, depth=H * 0.99,
                                location=(0, 0, H * 0.99 / 2),
                                rotation=(0, 0, math.radians(45)))
inner = bpy.context.object
inner.name = "InnerBody"
inner.data.materials.append(MAT_INNER)
named.append(inner)

# ---------------------------------------------------------------- 目
for name, ex in [("EyeL", -EYE_X), ("EyeR", EYE_X)]:
    eye = add_sphere(name, 0.06, MAT_BLACK)
    scale_verts(eye, 1, 1, 0.6)
    eye.location = face_pos(ex, 0.09, 0.03)
    eye.rotation_euler = (FACE_TILT, 0, 0)
    named.append(eye)

# とじ目(∩)
for name, ex in [("EyeClosedL", -EYE_X), ("EyeClosedR", EYE_X)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=0.055, minor_radius=0.016,
                                     major_segments=28, minor_segments=10)
    t = bpy.context.object
    t.name = name
    t.data.materials.append(MAT_BLACK)
    bm = bmesh.new()
    bm.from_mesh(t.data)
    doomed = [vv for vv in bm.verts if vv.co.y < -1e-4]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(t.data)
    bm.free()
    smooth(t)
    t.location = face_pos(ex, 0.09, 0.03)
    t.rotation_euler = (FACE_TILT, 0, 0)
    named.append(t)

# マズル
for name, ex in [("MuzzleL", -0.165), ("MuzzleR", 0.165)]:
    mz = add_sphere(name, 0.19, MAT_CREAM)
    scale_verts(mz, 1.05, 0.6, 0.4)
    mz.location = face_pos(ex, -0.12, 0.05)
    mz.rotation_euler = (FACE_TILT, 0, 0)
    named.append(mz)

# 鼻
nose = add_sphere("Nose", 0.095, MAT_BLACK)
scale_verts(nose, 1.1, 0.85, 0.7)
nose.location = face_pos(0, -0.02, 0.115)
nose.rotation_euler = (FACE_TILT, 0, 0)
named.append(nose)

# 舌
tongue = add_sphere("Tongue", 0.085, MAT_TONGUE)
scale_verts(tongue, 1, 1.15, 0.45)
tongue.location = face_pos(0, -0.29, 0.10)
tongue.rotation_euler = (FACE_TILT, 0, 0)
named.append(tongue)

# ---------------------------------------------------------------- 耳(ツヤ黒たまご・付け根が原点)
corner = Vector((D_base, -D_base, 0))
apex = Vector((0, 0, H))
edge_dir = (corner - apex).normalized()

for name, sx in [("EarL", -1), ("EarR", 1)]:
    ear = add_sphere(name, 0.3, MAT_BLACK)
    # Meshyの耳があった側面中央を覆う、大きめのたまご耳
    scale_verts(ear, 0.68, 0.44, 1.38, offset=(0, 0, -0.34))
    ear.location = (sx * 0.29, -0.16, 0.97)
    d = Vector((sx * 0.4, -0.22, -1.0)).normalized()
    q = Vector((0, 0, -1)).rotation_difference(d)
    roll = Quaternion((0, 0, 1), sx * math.radians(-20))
    ear.rotation_mode = 'QUATERNION'
    ear.rotation_quaternion = q @ roll
    named.append(ear)

# ---------------------------------------------------------------- あて布(削除跡を塞ぐパッド)
def to_new(v_old):
    """旧座標 → 正規化後の座標"""
    return (Vector(v_old) + Vector((0, 0, -mins.z))) * scale


side_tilt = math.atan2(D_base, H)
for side, sx in (("L", -1), ("R", 1)):
    if not ear_boxes[side]:
        continue
    c_old, d_old = combined_box(ear_boxes[side])
    c = to_new(c_old)
    dnew = Vector(d_old) * scale
    # 側面に沿った薄い板をシェルのすぐ内側に貼る
    n_side = Vector((sx * H, 0, D_base)).normalized()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1.0)
    pad = bpy.context.object
    pad.name = f"EarPad{side}"
    for v in pad.data.vertices:
        v.co.x *= 0.05
        v.co.y *= dnew.y * 0.66
        v.co.z *= dnew.z * 0.72
    pad.data.materials.append(MAT_INNER)
    smooth(pad)
    pad.rotation_euler = (0, -sx * side_tilt, 0)
    pad.location = Vector(c) - n_side * 0.07
    named.append(pad)

if face_boxes:
    c_old, d_old = combined_box(face_boxes)
    c = to_new(c_old)
    dnew = Vector(d_old) * scale
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1.0)
    pad = bpy.context.object
    pad.name = "MouthPad"
    for v in pad.data.vertices:
        v.co.x *= dnew.x * 0.62
        v.co.y *= dnew.y * 0.62
        v.co.z *= dnew.z * 0.60
    pad.data.materials.append(MAT_INNER)
    smooth(pad)
    pad.location = (c.x, c.y * 0.90, c.z)
    named.append(pad)

# ---------------------------------------------------------------- まとめて書き出し
root = bpy.data.objects.new("Piramidog", None)
scene.collection.objects.link(root)
for o in named:
    o.parent = root

blend_path = os.path.join(ROOT, "blender", "piramidog_hybrid.blend")
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
tgt = bpy.data.objects.new("CamTarget", None)
tgt.location = (0, 0, 0.55)
scene.collection.objects.link(tgt)
tc = cam.constraints.new("TRACK_TO")
tc.target = tgt

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
out_png = os.path.join(ROOT, "blender", "renders", "hybrid_preview.png")
scene.render.filepath = out_png
bpy.ops.render.render(write_still=True)
print("RENDER_DONE:", out_png)
