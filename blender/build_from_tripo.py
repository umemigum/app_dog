"""Tripo3D のセグメント済みGLBをアプリ用 piramidog.glb に変換する

Tripoのパーツは既に分離されているので、やることは:
  1. 向きの正規化(顔 +X → -Y)とスケール(高さ1.3・床z=0)
  2. パーツを位置・色でアプリの規約名にリネーム(EarL/EarR/Tongue など)
  3. 片方しかない独立目をミラー複製して両目化、
     本体に焼き付いたもう片方の目はテクスチャを肌色に塗って無効化
  4. とじ目(∩)の追加、耳・舌のピボット設定
  5. GLB書き出し + .blend保存 + 確認レンダリング

使い方:
  Blender --background --python blender/build_from_tripo.py
"""
import bpy
import bmesh
import math
import os
import mathutils
from mathutils import Vector
import numpy as np

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT_DIR, "assets", "triangle dog 3d model.glb")
H = 1.3

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)

# ---------------------------------------------------------------- 前処理
# 親のEMPTYを外して全パーツをワールド直下に
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(bpy.data.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o, do_unlink=True)

# 顔 +X → -Y(Z軸まわりに-90°)。回転モードに関係なく行列で合成する
Rz = mathutils.Matrix.Rotation(-math.pi / 2, 4, "Z")
for o in meshes:
    o.matrix_world = Rz @ o.matrix_world
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 床 z=0・高さ 1.3 に正規化
mins = Vector((1e9,) * 3)
maxs = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        mins = Vector(map(min, mins, wc))
        maxs = Vector(map(max, maxs, wc))
scale = H / (maxs.z - mins.z)
for o in meshes:
    o.location.z -= mins.z
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in meshes:
    o.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print("NORMALIZED: scale =", round(scale, 3))


def info(o):
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    bmins = Vector(map(min, *bb))
    bmaxs = Vector(map(max, *bb))
    return (bmins + bmaxs) / 2, bmaxs - bmins, bmins, bmaxs


def tex_avg(o):
    """パーツ個別テクスチャの平均色(sRGBのまま)"""
    for m in o.data.materials:
        if not m or not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
                w, h = img.size
                px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
                step = max(1, w // 32)
                sub = px[::step, ::step, :3]
                return sub.mean(axis=(0, 1))
    return np.array([0.5, 0.5, 0.5])


# ---------------------------------------------------------------- 分類・リネーム
body = max(meshes, key=lambda o: len(o.data.vertices))
body.name = "Body"

parts = []
for o in meshes:
    if o is body:
        continue
    center, dims, bmins, bmaxs = info(o)
    col = tex_avg(o)
    parts.append({"o": o, "c": center, "d": dims, "col": col})
    print(f"{o.name:22s} c=({center.x:+.2f},{center.y:+.2f},{center.z:+.2f}) "
          f"dims=({dims.x:.2f},{dims.y:.2f},{dims.z:.2f}) rgb=({col[0]:.2f},{col[1]:.2f},{col[2]:.2f})")

ears, paws, muzzles = [], [], []
eye_sep = tongue = nose = None
for p in parts:
    c, d, col = p["c"], p["d"], p["col"]
    dark = max(col) < 0.45
    reddish = col[0] > 0.55 and (col[0] - col[1]) > 0.2
    if dark and max(d) > 0.4:
        ears.append(p)                        # 大きくて黒い → 耳
    elif c.z < 0.35 and abs(c.x) > 0.4 and abs(c.y) > 0.4:
        paws.append(p)                        # 四隅の下 → 足
    elif dark and max(d) < 0.25:
        # 黒くて小さい: 高いほうが鼻、低ければ…どちらも候補にして後で決める
        if nose is None or c.z > nose["c"].z:
            if nose is not None:
                eye_sep = nose if max(nose["d"]) < 0.12 else eye_sep
            nose = p
        else:
            eye_sep = p
    elif reddish:
        tongue = p                            # 赤っぽい → 舌
    else:
        muzzles.append(p)                     # 残りのクリーム → マズル

# 目は「黒くてとても小さい」パーツ(鼻より小さい)
dark_small = [p for p in parts if max(p["col"]) < 0.5 and max(p["d"]) < 0.12]
if dark_small:
    eye_sep = min(dark_small, key=lambda p: max(p["d"]))
    if nose is eye_sep:
        nose = None
    # 鼻を選び直す: 黒くて中くらい・前面中央
    for p in parts:
        if p is eye_sep or p in ears:
            continue
        if max(p["col"]) < 0.45 and 0.1 < max(p["d"]) < 0.3 and abs(p["c"].x) < 0.2:
            nose = p
            break

assert len(ears) == 2, f"耳が2つ見つからない: {len(ears)}"
assert tongue is not None, "舌が見つからない"
assert eye_sep is not None, "独立した目が見つからない"

earL = min(ears, key=lambda p: p["c"].x)["o"]
earR = max(ears, key=lambda p: p["c"].x)["o"]
earL.name = "EarL"
earR.name = "EarR"
tongue["o"].name = "Tongue"
if nose:
    nose["o"].name = "Nose"
for i, p in enumerate(paws):
    p["o"].name = f"Paw{i}"
for i, p in enumerate(muzzles):
    p["o"].name = f"Muzzle{i}"

# ---------------------------------------------------------------- 両目化
eye_obj = eye_sep["o"]
eye_c = eye_sep["c"]
if eye_c.x >= 0:
    eye_obj.name = "EyeR"
    mirror_name = "EyeL"
else:
    eye_obj.name = "EyeL"
    mirror_name = "EyeR"

mirror = eye_obj.copy()
mirror.data = eye_obj.data.copy()
mirror.name = mirror_name
scene.collection.objects.link(mirror)
mirror.scale.x = -1
bpy.ops.object.select_all(action="DESELECT")
mirror.select_set(True)
bpy.context.view_layer.objects.active = mirror
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new()
bm.from_mesh(mirror.data)
bmesh.ops.reverse_faces(bm, faces=bm.faces)
bm.to_mesh(mirror.data)
bm.free()
print("EYES:", eye_obj.name, tuple(round(v, 3) for v in eye_c),
      "->", mirror_name, "mirrored")

mirror_c = Vector((-eye_c.x, eye_c.y, eye_c.z))

# 目を2割拡大して、下地(塗りつぶした眼窩)を完全に覆う
for obj, cc in ((eye_obj, eye_c), (mirror, mirror_c)):
    for v in obj.data.vertices:
        v.co = cc + (Vector(v.co) - cc) * 1.2

# ---------------------------------------------------------------- 焼き付いた目を塗りつぶし
# 目のまわりの暗いテクセルを肌色に塗る。目の残骸は本体だけでなく
# マズルパーツ側にも含まれているので、両方に同じ処理をかける
r = max(eye_sep["d"]) * 2.2
targets = [body] + [p["o"] for p in muzzles]
for obj in targets:
    img = None
    for m in obj.data.materials:
        if not m or not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
                break
    if img is None:
        continue
    W, Hpx = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(Hpx, W, 4)
    uvd = obj.data.uv_layers.active.data
    region, dark_px = [], []
    for p in obj.data.polygons:
        pc = Vector(p.center)
        if (pc - mirror_c).length < r or (pc - eye_c).length < r:
            uv = uvd[p.loop_start].uv
            xi = min(W - 1, max(0, int(uv.x * W)))
            yi = min(Hpx - 1, max(0, int(uv.y * Hpx)))
            c = px[yi, xi, :3]
            if c.max() < 0.5:
                dark_px.append((yi, xi))
            else:
                region.append(c)
    if not dark_px:
        print(f"FUSED EYES {obj.name}: none")
        continue
    skin = np.mean(region, axis=0) if region else np.array([0.95, 0.85, 0.66], dtype=np.float32)
    pad_r = max(4, W // 256)
    for yi, xi in dark_px:
        px[max(0, yi - pad_r):yi + pad_r + 1, max(0, xi - pad_r):xi + pad_r + 1, :3] = skin
    img.pixels.foreach_set(px.ravel())
    img.update()
    print(f"FUSED EYES {obj.name}: painted {len(dark_px)} polys, "
          f"skin = {tuple(round(float(v), 2) for v in skin)}")

# ---------------------------------------------------------------- 耳の下の影を体色に塗る
# 耳を持ち上げたときに、焼き付いた暗い影ではなく体色が見えるようにする
body_img = None
for m in body.data.materials:
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            body_img = n.image
            break
W, Hpx = body_img.size
px = np.array(body_img.pixels[:], dtype=np.float32).reshape(Hpx, W, 4)
uvd = body.data.uv_layers.active.data

ear_zones = []
for e in (earL, earR):
    center, dims, bmins, bmaxs = info(e)
    ear_zones.append((center, dims / 2 + Vector((0.06, 0.06, 0.06))))

region, dark_px = [], []
for p in body.data.polygons:
    pc = Vector(p.center)
    for zc, zh in ear_zones:
        if abs(pc.x - zc.x) < zh.x and abs(pc.y - zc.y) < zh.y and abs(pc.z - zc.z) < zh.z:
            uv = uvd[p.loop_start].uv
            xi = min(W - 1, max(0, int(uv.x * W)))
            yi = min(Hpx - 1, max(0, int(uv.y * Hpx)))
            c = px[yi, xi, :3]
            if c.max() < 0.6:
                dark_px.append((yi, xi))
            else:
                region.append(c)
            break
skin_body = np.mean(region, axis=0) if region else np.array([0.92, 0.78, 0.54], dtype=np.float32)
for yi, xi in dark_px:
    px[max(0, yi - 5):yi + 6, max(0, xi - 5):xi + 6, :3] = skin_body
body_img.pixels.foreach_set(px.ravel())
body_img.update()
print("UNDER-EAR PAINTED:", len(dark_px), "polys")

# ---------------------------------------------------------------- とじ目(∩)
def make_mat(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = tuple(pow(c, 2.2) for c in rgb) + (1.0,)
    b.inputs["Roughness"].default_value = rough
    return m


mat_line = make_mat("ClosedEyeLine", (0.05, 0.04, 0.035), 0.25)
mat_lid = make_mat("LidSkin", (0.92, 0.78, 0.54), 0.55)
mat_plug = make_mat("MouthPlug", (0.93, 0.86, 0.72), 0.5)
mat_earcap = make_mat("EarCap", (0.07, 0.06, 0.05), 0.3)

eyeR_c = eye_c if eye_c.x >= 0 else mirror_c
eyeL_c = mirror_c if eye_c.x >= 0 else eye_c
eye_w = max(eye_sep["d"].x, eye_sep["d"].z)

pt_y = eyeL_c.y + 0.03
D = -pt_y / (1 - eyeL_c.z / H)
tilt = math.atan2(H, D)
n_out = Vector((0, -H, D)).normalized()
print("FACE D =", round(D, 3))

extras = []
for name, ec in (("EyeClosedL", eyeL_c), ("EyeClosedR", eyeR_c)):
    # 肌色のまぶたドーム(空洞や眼窩を覆う)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=eye_w * 0.85)
    lid = bpy.context.object
    for v in lid.data.vertices:
        v.co.z *= 0.35
    lid.data.materials.append(mat_lid)
    for pp in lid.data.polygons:
        pp.use_smooth = True

    # ∩ のライン
    bpy.ops.mesh.primitive_torus_add(major_radius=eye_w * 0.62, minor_radius=eye_w * 0.17,
                                     major_segments=28, minor_segments=10)
    arc = bpy.context.object
    arc.data.materials.append(mat_line)
    bm = bmesh.new()
    bm.from_mesh(arc.data)
    doomed = [v for v in bm.verts if v.co.y < -1e-4]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(arc.data)
    bm.free()
    for pp in arc.data.polygons:
        pp.use_smooth = True
    arc.location = (0, 0, eye_w * 0.34)

    bpy.ops.object.select_all(action="DESELECT")
    lid.select_set(True)
    arc.select_set(True)
    bpy.context.view_layer.objects.active = lid
    bpy.ops.object.join()
    lid = bpy.context.view_layer.objects.active
    lid.name = name
    lid.rotation_euler = (tilt, 0, 0)
    lid.location = Vector(ec) + n_out * (eye_w * 0.28)
    lid.hide_render = True
    extras.append(lid)

# ---------------------------------------------------------------- 内側ピラミッド
# 体を「穴のない滑らかな四角錐」として構造的に確定させる。
# 体シェルにどんな隙間があっても、見えるのは常にこの体色の面になる。
c_b, d_b, bmn_b, bmx_b = info(body)
apex_z = bmx_b.z
base_half = max(d_b.x, d_b.y) / 2
mat_inner = make_mat("InnerBody",
                     (float(skin_body[0]), float(skin_body[1]), float(skin_body[2])), 0.55)
depth = (apex_z - 0.06) * 0.985
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=base_half * math.sqrt(2) * 0.90,
                                radius2=0, depth=depth,
                                location=(0, 0, 0.06 + depth / 2),
                                rotation=(0, 0, math.radians(45)))
inner = bpy.context.object
inner.name = "InnerBody"
inner.data.materials.append(mat_inner)
extras.append(inner)
print("INNER PYRAMID: base_half =", round(base_half, 3), " apex =", round(apex_z, 3))

# ---------------------------------------------------------------- ピボット
def set_origin(o, pivot):
    scene.cursor.location = pivot
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


# 耳はパッチ構造のため穴埋めすると表面にヒビが出る。
# 内側はアプリの両面描画で自然な暗い裏地に見えるので、そのままにする。
for ear, sx in ((earL, -1), (earR, 1)):
    center, dims, bmins, bmaxs = info(ear)
    pivot = Vector((center.x - sx * dims.x * 0.25, center.y, bmaxs.z - 0.02))
    set_origin(ear, pivot)

center, dims, bmins, bmaxs = info(tongue["o"])
set_origin(tongue["o"], Vector(((bmins.x + bmaxs.x) / 2, bmaxs.y - 0.005, bmaxs.z - 0.005)))

# 口栓: 舌をしまったときに穴が見えないよう、舌の根元にクリーム色の栓を置く
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1.0)
plug = bpy.context.object
plug.name = "MouthPlug"
for v in plug.data.vertices:
    v.co.x *= dims.x * 0.62
    v.co.y *= 0.05
    v.co.z *= dims.z * 0.62
plug.data.materials.append(mat_plug)
for pp in plug.data.polygons:
    pp.use_smooth = True
plug.rotation_euler = (tilt - math.pi / 2, 0, 0)  # 前面の斜面に沿わせる
plug.location = ((bmins.x + bmaxs.x) / 2, bmaxs.y - 0.02, (bmins.z + bmaxs.z) / 2 + 0.01)
extras.append(plug)

# ---------------------------------------------------------------- 書き出し
root = bpy.data.objects.new("Piramidog", None)
scene.collection.objects.link(root)
all_objs = meshes + [mirror] + extras
for o in all_objs:
    o.parent = root

blend_path = os.path.join(ROOT_DIR, "blender", "piramidog_tripo.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("BLEND_SAVED:", blend_path)

bpy.ops.object.select_all(action="DESELECT")
for o in all_objs + [root]:
    o.select_set(True)
out = os.path.join(ROOT_DIR, "assets", "piramidog.glb")
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True,
                          export_animations=False, export_yup=True)
print("EXPORT_DONE:", out)

# ---------------------------------------------------------------- 確認レンダリング
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 0.55


def add_area(name, loc, rot_deg, size, energy):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.size = size
    l.data.energy = energy
    l.rotation_euler = tuple(math.radians(a) for a in rot_deg)


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
scene.render.filepath = os.path.join(ROOT_DIR, "blender", "renders", "tripo_build_preview.png")
bpy.ops.render.render(write_still=True)
print("RENDER_DONE")
