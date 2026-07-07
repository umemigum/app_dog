"""リファレンス寄せのピラミッド犬モデル生成スクリプト。

Meshy 由来メッシュは使わず、Blender プリミティブだけで
アプリ用の名前付きノード(EarL/EyeL/Tongue など)を持つ GLB を作る。

使い方:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python blender/build_piramidog.py -- both
"""
import math
import os
import sys

import bmesh
import bpy
import mathutils


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODE = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "both"

# リファレンスの三面図に合わせた、おおまかなプロポーション。
BODY_W = 1.72
BODY_D = 1.14
BODY_H = 1.36
FRONT_Y = -BODY_D / 2
BACK_Y = BODY_D / 2

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(hexcode):
    r = int(hexcode[0:2], 16) / 255
    g = int(hexcode[2:4], 16) / 255
    b = int(hexcode[4:6], 16) / 255

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(r), lin(g), lin(b), 1.0)


def make_mat(name, hexcode, roughness=0.55, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb(hexcode)
    bsdf.inputs["Roughness"].default_value = roughness
    for socket in ("Coat Weight", "Clearcoat"):
        if socket in bsdf.inputs:
            bsdf.inputs[socket].default_value = coat
    return mat


MAT_BODY = make_mat("warm biscuit body", "F2D49B", 0.52, 0.08)
MAT_BODY_SIDE = make_mat("soft side shade", "EAC280", 0.58, 0.04)
MAT_CREAM = make_mat("cream muzzle paws", "F7E8BE", 0.5, 0.04)
MAT_BLACK = make_mat("glossy black ears nose eyes", "151310", 0.34, 0.28)
MAT_TONGUE = make_mat("soft pink tongue", "E94F67", 0.42, 0.12)
MAT_FLOOR = make_mat("preview white floor", "FFFFFF", 0.9)


def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def transform_vertices(obj, sx=1, sy=1, sz=1, offset=(0, 0, 0)):
    for vert in obj.data.vertices:
        vert.co.x = vert.co.x * sx + offset[0]
        vert.co.y = vert.co.y * sy + offset[1]
        vert.co.z = vert.co.z * sz + offset[2]


def add_uv_ellipsoid(name, radius, mat, scale=(1, 1, 1), loc=(0, 0, 0),
                     rot=(0, 0, 0), segments=40, rings=20, offset=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    transform_vertices(obj, scale[0], scale[1], scale[2], offset)
    obj.data.materials.append(mat)
    return smooth(obj)


def add_torus_arc(name, mat, major, minor):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=10,
    )
    obj = bpy.context.object
    obj.name = name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = [v for v in bm.verts if v.co.y < -0.0001]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.append(mat)
    return smooth(obj)


def taper_ear(obj):
    """Make an ellipsoid ear read more like a soft drooping teardrop."""
    min_z = min(v.co.z for v in obj.data.vertices)
    max_z = max(v.co.z for v in obj.data.vertices)
    span = max(max_z - min_z, 0.001)
    for vert in obj.data.vertices:
        down = (max_z - vert.co.z) / span
        # The lower tip of the ear is narrower and a touch fuller forward.
        width = 1.0 - 0.24 * down
        thickness = 1.0 - 0.12 * down
        vert.co.x *= width
        vert.co.y *= thickness
        vert.co.z -= 0.035 * down * down


objects = []

# ---------------------------------------------------------------------------
# Body: bevel 付きの柔らかい四角錐。前面が大きく見えるよう横長にする。
# ---------------------------------------------------------------------------
mesh = bpy.data.meshes.new("BodyMesh")
verts = [
    (-BODY_W / 2, FRONT_Y, 0),
    (BODY_W / 2, FRONT_Y, 0),
    (BODY_W / 2, BACK_Y, 0),
    (-BODY_W / 2, BACK_Y, 0),
    (0, 0, BODY_H),
]
faces = [
    (0, 1, 4),
    (1, 2, 4),
    (2, 3, 4),
    (3, 0, 4),
    (0, 3, 2, 1),
]
mesh.from_pydata(verts, [], faces)
mesh.update()
body = bpy.data.objects.new("Body", mesh)
scene.collection.objects.link(body)
body.data.materials.append(MAT_BODY)
body.data.materials.append(MAT_BODY_SIDE)
for poly in body.data.polygons:
    if poly.center.y > 0.02:
        poly.material_index = 1
bev = body.modifiers.new("large soft bevels", "BEVEL")
bev.width = 0.065
bev.segments = 12
bev.affect = "EDGES"
body.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
objects.append(body)

# A subtle under-lip shadow helps the body sit like the reference render.
under = add_uv_ellipsoid(
    "BellyShadow",
    1,
    make_mat("warm under shadow", "C18A4E", 0.7),
    scale=(0.78, 0.36, 0.028),
    loc=(0, -0.03, 0.025),
    segments=48,
    rings=12,
)
objects.append(under)

# ---------------------------------------------------------------------------
# Face helpers. The front face is the triangle y = FRONT_Y * (1 - z / BODY_H).
# ---------------------------------------------------------------------------
front_normal = mathutils.Vector((0, -BODY_H, -FRONT_Y)).normalized()
front_up = mathutils.Vector((0, -FRONT_Y, BODY_H)).normalized()
front_right = mathutils.Vector((1, 0, 0))
face_tilt = math.atan2(BODY_H, -FRONT_Y)


def front_surface_y(z):
    return FRONT_Y * (1 - z / BODY_H)


def face_point(x, z, out=0.0):
    surface = mathutils.Vector((x, front_surface_y(z), z))
    return surface + front_normal * out


def orient_on_front(obj, roll=0.0):
    obj.rotation_euler = (face_tilt, 0, roll)


def place_on_front(obj, x, z, out=0.035, roll=0.0):
    obj.location = face_point(x, z, out)
    orient_on_front(obj, roll)


# ---------------------------------------------------------------------------
# Face: tiny glossy eyes, wide two-lobed muzzle, bead nose, little tongue.
# ---------------------------------------------------------------------------
for name, x in (("EyeL", -0.16), ("EyeR", 0.16)):
    eye = add_uv_ellipsoid(name, 0.058, MAT_BLACK, scale=(0.82, 0.78, 1.12))
    place_on_front(eye, x, 0.60, 0.06)
    objects.append(eye)

for name, x in (("EyeClosedL", -0.16), ("EyeClosedR", 0.16)):
    arc = add_torus_arc(name, MAT_BLACK, 0.056, 0.013)
    place_on_front(arc, x, 0.60, 0.065)
    arc.hide_render = True
    objects.append(arc)

for name, x, roll in (("MuzzleL", -0.215, math.radians(-4)), ("MuzzleR", 0.215, math.radians(4))):
    muzzle = add_uv_ellipsoid(
        name,
        0.195,
        MAT_CREAM,
        scale=(1.34, 0.52, 0.56),
        segments=48,
        rings=20,
    )
    place_on_front(muzzle, x, 0.405, 0.09, roll)
    objects.append(muzzle)

nose = add_uv_ellipsoid("Nose", 0.078, MAT_BLACK, scale=(1.16, 0.78, 0.7), segments=36, rings=18)
place_on_front(nose, 0, 0.515, 0.14)
objects.append(nose)

# Origin is near the top/back of the tongue so app-side scale reads as "pull in".
tongue = add_uv_ellipsoid(
    "Tongue",
    0.075,
    MAT_TONGUE,
    scale=(0.72, 1.0, 0.46),
    offset=(0, -0.035, -0.018),
    segments=32,
    rings=16,
)
place_on_front(tongue, 0.0, 0.285, 0.107)
objects.append(tongue)

# ---------------------------------------------------------------------------
# Paws: cream ovals tucked into the four bottom corners.
# ---------------------------------------------------------------------------
for name, x, y, z, sc in [
    ("PawFrontL", -0.77, -0.54, 0.095, (0.95, 0.72, 0.72)),
    ("PawFrontR", 0.77, -0.54, 0.095, (0.95, 0.72, 0.72)),
    ("PawBackL", -0.72, 0.46, 0.105, (0.8, 0.62, 0.62)),
    ("PawBackR", 0.72, 0.46, 0.105, (0.8, 0.62, 0.62)),
]:
    paw = add_uv_ellipsoid(name, 0.145, MAT_CREAM, scale=sc, loc=(x, y, z), segments=32, rings=16)
    objects.append(paw)

# ---------------------------------------------------------------------------
# Ears: glossy teardrop-like ellipsoids. Mesh is offset below the origin so the
# app can flap them around a believable top attachment point.
# ---------------------------------------------------------------------------
for name, sx, roll in (("EarL", -1, math.radians(2)), ("EarR", 1, math.radians(-2))):
    ear = add_uv_ellipsoid(
        name,
        0.265,
        MAT_BLACK,
        scale=(0.62, 0.22, 1.12),
        offset=(0, 0, -0.25),
        loc=(sx * 0.55, 0.02, 0.91),
        segments=48,
        rings=24,
    )
    # Long local -Z axis follows the side edge, so the ears read as attached to
    # the side faces instead of pasted onto the front.
    down = mathutils.Vector((sx * 0.34, -0.02, -0.94)).normalized()
    base = mathutils.Vector((0, 0, -1)).rotation_difference(down)
    twist = mathutils.Quaternion((0, 0, 1), roll)
    ear.rotation_mode = "QUATERNION"
    ear.rotation_quaternion = base @ twist
    taper_ear(ear)
    objects.append(ear)

# ---------------------------------------------------------------------------
# Root object expected by the app.
# ---------------------------------------------------------------------------
root = bpy.data.objects.new("Piramidog", None)
scene.collection.objects.link(root)
for obj in objects:
    obj.parent = root

# ---------------------------------------------------------------------------
# Preview setup.
# ---------------------------------------------------------------------------
def add_area(name, loc, rot_deg, size, energy):
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name = name
    light.data.size = size
    light.data.energy = energy
    light.rotation_euler = tuple(math.radians(v) for v in rot_deg)
    return light


world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 0.55

add_area("Key", (-2.2, -3.4, 3.2), (52, -18, -32), 3.4, 350)
add_area("Fill", (3.0, -2.4, 1.6), (70, 25, 45), 4.2, 105)
add_area("Rim", (0.0, 2.8, 2.6), (-45, 0, 180), 3.0, 120)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.object
floor.name = "PreviewFloor"
floor.data.materials.append(MAT_FLOOR)

bpy.ops.object.camera_add(location=(-2.15, -4.05, 1.55))
cam = bpy.context.object
cam.data.lens = 62
scene.camera = cam
target = bpy.data.objects.new("CamTarget", None)
target.location = (0, -0.05, 0.58)
scene.collection.objects.link(target)
constraint = cam.constraints.new("TRACK_TO")
constraint.target = target

for vt in ("Khronos PBR Neutral", "Standard"):
    try:
        scene.view_settings.view_transform = vt
        break
    except TypeError:
        continue

blend_path = os.path.join(ROOT, "blender", "piramidog.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("BLEND_SAVED:", blend_path)

if MODE in ("render", "both"):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 80
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 896
    scene.render.resolution_y = 896
    out_png = os.path.join(ROOT, "blender", "renders", "preview.png")
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print("RENDER_DONE:", out_png)

if MODE in ("export", "both"):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects + [root]:
        obj.select_set(True)
    out_glb = os.path.join(ROOT, "assets", "piramidog.glb")
    os.makedirs(os.path.dirname(out_glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_yup=True,
    )
    print("EXPORT_DONE:", out_glb)
