"""Generate the app-ready Piramidog GLB without launching Blender.

This is a fallback for environments where Blender crashes on Metal startup.
The model is built from simple meshes that mimic the reference character:
a soft square pyramid body, glossy droopy ears, cream muzzle/paws, tiny eyes,
nose, tongue, and closed-eye arcs.
"""
import json
import math
import os
import struct

import numpy as np


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "piramidog.glb")

BODY_W = 1.72
BODY_D = 1.14
BODY_H = 1.36
FRONT_Z = BODY_D / 2


def normalize(v):
    v = np.asarray(v, dtype=np.float32)
    n = float(np.linalg.norm(v))
    return v if n == 0 else v / n


def quat_from_axis_angle(axis, angle):
    axis = normalize(axis)
    s = math.sin(angle / 2)
    return np.array([axis[0] * s, axis[1] * s, axis[2] * s, math.cos(angle / 2)], dtype=np.float32)


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ], dtype=np.float32)


def quat_rotate(q, v):
    qv = np.array([v[0], v[1], v[2], 0], dtype=np.float32)
    qi = np.array([-q[0], -q[1], -q[2], q[3]], dtype=np.float32)
    return quat_mul(quat_mul(q, qv), qi)[:3]


def quat_from_to(a, b):
    a = normalize(a)
    b = normalize(b)
    dot = float(np.dot(a, b))
    if dot > 0.9999:
        return np.array([0, 0, 0, 1], dtype=np.float32)
    if dot < -0.9999:
        axis = normalize(np.cross(a, [1, 0, 0]))
        if np.linalg.norm(axis) < 0.001:
            axis = normalize(np.cross(a, [0, 1, 0]))
        return quat_from_axis_angle(axis, math.pi)
    axis = np.cross(a, b)
    q = np.array([axis[0], axis[1], axis[2], 1 + dot], dtype=np.float32)
    return normalize(q)


def srgb_factor(hexcode):
    return [int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0]


def make_materials():
    specs = [
        ("warm biscuit body", "F2D49B", 0.52, 0.0),
        ("soft side shade", "E8C184", 0.58, 0.0),
        ("cream muzzle paws", "F7E8BE", 0.5, 0.0),
        ("glossy black ears nose eyes", "151310", 0.16, 0.0),
        ("soft pink tongue", "E94F67", 0.42, 0.0),
        ("warm under shadow", "B98648", 0.75, 0.0),
    ]
    mats = []
    for name, color, roughness, metallic in specs:
        mats.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": srgb_factor(color),
                "roughnessFactor": roughness,
                "metallicFactor": metallic,
            },
        })
    return mats


def face_y_to_z(y):
    return FRONT_Z * (1 - y / BODY_H)


FRONT_NORMAL = normalize([0, FRONT_Z, BODY_H])


def face_point(x, y, out=0.0):
    return np.array([x, y, face_y_to_z(y)], dtype=np.float32) + FRONT_NORMAL * out


def transform_points(points, translation=(0, 0, 0), rotation=(0, 0, 0, 1)):
    q = np.asarray(rotation, dtype=np.float32)
    t = np.asarray(translation, dtype=np.float32)
    return np.array([quat_rotate(q, p) + t for p in points], dtype=np.float32)


def uv_ellipsoid(rx, ry, rz, seg=36, rings=18, offset=(0, 0, 0), material=0):
    pos = []
    nor = []
    idx = []
    for r in range(rings + 1):
        v = r / rings
        phi = math.pi * v
        for s in range(seg):
            u = s / seg
            theta = math.tau * u
            unit = np.array([
                math.sin(phi) * math.cos(theta),
                math.cos(phi),
                math.sin(phi) * math.sin(theta),
            ], dtype=np.float32)
            p = np.array([unit[0] * rx, unit[1] * ry, unit[2] * rz], dtype=np.float32)
            pos.append(p + np.asarray(offset, dtype=np.float32))
            nor.append(normalize([unit[0] / max(rx, 1e-6), unit[1] / max(ry, 1e-6), unit[2] / max(rz, 1e-6)]))
    for r in range(rings):
        for s in range(seg):
            a = r * seg + s
            b = r * seg + (s + 1) % seg
            c = (r + 1) * seg + s
            d = (r + 1) * seg + (s + 1) % seg
            idx += [a, c, b, b, c, d]
    return {"positions": np.array(pos, dtype=np.float32), "normals": np.array(nor, dtype=np.float32),
            "indices": np.array(idx, dtype=np.uint32), "material": material}


def rounded_pyramid(material=0):
    seg_per_side = 10
    base = []
    # Perimeter starts at front-left and walks clockwise. Corners are slightly
    # rounded by using a superellipse-like interpolation on each side.
    for side in range(4):
        for i in range(seg_per_side):
            t = i / seg_per_side
            if side == 0:
                x = -BODY_W / 2 + BODY_W * t
                z = FRONT_Z
            elif side == 1:
                x = BODY_W / 2
                z = FRONT_Z - BODY_D * t
            elif side == 2:
                x = BODY_W / 2 - BODY_W * t
                z = -FRONT_Z
            else:
                x = -BODY_W / 2
                z = -FRONT_Z + BODY_D * t
            # Pull points near corners inward for a softer silhouette.
            cx = max(abs(x) - BODY_W * 0.42, 0) / (BODY_W * 0.08)
            cz = max(abs(z) - BODY_D * 0.42, 0) / (BODY_D * 0.08)
            shrink = min(0.045, 0.025 * (cx * cx + cz * cz))
            base.append(np.array([x * (1 - shrink), 0, z * (1 - shrink)], dtype=np.float32))

    levels = [0, 0.04, 0.12, 0.26, 0.46, 0.68, 0.86, 0.97]
    pos = []
    for lv in levels:
        y = BODY_H * lv
        scale = max(0.035, 1 - lv)
        lift = 0.018 * math.sin(math.pi * lv)
        for p in base:
            pos.append([p[0] * scale, y + lift, p[2] * scale])
    apex_i = len(pos)
    pos.append([0, BODY_H, 0])

    n = len(base)
    idx = []
    for r in range(len(levels) - 1):
        for s in range(n):
            a = r * n + s
            b = r * n + (s + 1) % n
            c = (r + 1) * n + s
            d = (r + 1) * n + (s + 1) % n
            idx += [a, c, b, b, c, d]
    top_start = (len(levels) - 1) * n
    for s in range(n):
        idx += [top_start + s, apex_i, top_start + (s + 1) % n]
    center_i = len(pos)
    pos.append([0, 0, 0])
    for s in range(n):
        idx += [center_i, (s + 1) % n, s]

    pos = np.array(pos, dtype=np.float32)
    idx = np.array(idx, dtype=np.uint32)
    nor = vertex_normals(pos, idx)
    return {"positions": pos, "normals": nor, "indices": idx, "material": material}


def torus_arc(major=0.052, minor=0.012, arc=math.pi, seg=28, tube=8, material=3):
    pos = []
    nor = []
    idx = []
    for i in range(seg + 1):
        a = math.pi - arc / 2 + arc * (i / seg)
        center = np.array([math.cos(a) * major, math.sin(a) * major, 0], dtype=np.float32)
        radial = normalize([math.cos(a), math.sin(a), 0])
        binormal = np.array([0, 0, 1], dtype=np.float32)
        for j in range(tube):
            b = math.tau * j / tube
            n = normalize(radial * math.cos(b) + binormal * math.sin(b))
            pos.append(center + n * minor)
            nor.append(n)
    for i in range(seg):
        for j in range(tube):
            a = i * tube + j
            b = i * tube + (j + 1) % tube
            c = (i + 1) * tube + j
            d = (i + 1) * tube + (j + 1) % tube
            idx += [a, c, b, b, c, d]
    return {"positions": np.array(pos, dtype=np.float32), "normals": np.array(nor, dtype=np.float32),
            "indices": np.array(idx, dtype=np.uint32), "material": material}


def vertex_normals(pos, idx):
    normals = np.zeros_like(pos)
    for i in range(0, len(idx), 3):
        a, b, c = idx[i:i + 3]
        n = normalize(np.cross(pos[b] - pos[a], pos[c] - pos[a]))
        normals[a] += n
        normals[b] += n
        normals[c] += n
    return np.array([normalize(n) for n in normals], dtype=np.float32)


def node_mesh(name, mesh, translation=None, rotation=None, hidden=False):
    node = {"name": name, "mesh": None}
    if translation is not None:
        node["translation"] = [float(v) for v in translation]
    if rotation is not None:
        node["rotation"] = [float(v) for v in rotation]
    if hidden:
        # Kept exported for the app; the app toggles visibility after load.
        node["extras"] = {"initiallyHidden": True}
    return node, mesh


def build_scene_meshes():
    nodes = []
    meshes = []

    def add(name, mesh, translation=None, rotation=None, hidden=False):
        node, m = node_mesh(name, mesh, translation, rotation, hidden)
        node["mesh"] = len(meshes)
        nodes.append(node)
        meshes.append(m)

    add("Body", rounded_pyramid(0))
    add("BellyShadow", uv_ellipsoid(0.74, 0.025, 0.30, 40, 8, material=5), translation=[0, 0.025, 0.03])

    # Face parts are baked onto the front sloping plane.
    face_rot = quat_from_to([0, 0, 1], FRONT_NORMAL)
    for name, x in (("EyeL", -0.15), ("EyeR", 0.15)):
        add(name, uv_ellipsoid(0.045, 0.052, 0.035, 24, 12, material=3), face_point(x, 0.56, 0.06), face_rot)
    for name, x in (("EyeClosedL", -0.15), ("EyeClosedR", 0.15)):
        add(name, torus_arc(material=3), face_point(x, 0.56, 0.065), face_rot, hidden=True)

    for name, x in (("MuzzleL", -0.155), ("MuzzleR", 0.155)):
        add(name, uv_ellipsoid(0.25, 0.11, 0.095, 40, 16, material=2), face_point(x, 0.405, 0.08), face_rot)
    add("Nose", uv_ellipsoid(0.10, 0.062, 0.058, 28, 14, material=3), face_point(0, 0.50, 0.14), face_rot)
    add("Tongue", uv_ellipsoid(0.055, 0.092, 0.042, 24, 12, offset=(0, -0.035, -0.014), material=4),
        face_point(0, 0.285, 0.115), face_rot)

    for name, x, z, scale in [
        ("PawFrontL", -0.77, 0.54, (0.125, 0.095, 0.10)),
        ("PawFrontR", 0.77, 0.54, (0.125, 0.095, 0.10)),
        ("PawBackL", -0.72, -0.46, (0.105, 0.085, 0.085)),
        ("PawBackR", 0.72, -0.46, (0.105, 0.085, 0.085)),
    ]:
        add(name, uv_ellipsoid(scale[0], scale[1], scale[2], 28, 12, material=2), [x, 0.09, z])

    for name, sx, roll in (("EarL", -1, math.radians(18)), ("EarR", 1, math.radians(-18))):
        mesh = uv_ellipsoid(0.20, 0.45, 0.095, 42, 20, offset=(0, -0.33, 0), material=3)
        q = quat_from_axis_angle([0, 0, 1], sx * math.radians(13))
        q = quat_mul(q, quat_from_axis_angle([1, 0, 0], sx * math.radians(0)))
        add(name, mesh, [sx * 0.54, 1.03, 0.21], q)
        add(f"EarRoot{'L' if sx < 0 else 'R'}", uv_ellipsoid(0.09, 0.055, 0.05, 20, 10, material=0),
            [sx * 0.49, 0.91, 0.26])

    root_index = len(nodes)
    nodes.append({"name": "Piramidog", "children": list(range(root_index))})
    return nodes, meshes, root_index


def build_glb(nodes, meshes, scene_root):
    materials = make_materials()
    gltf = {
        "asset": {"version": "2.0", "generator": "Codex procedural Piramidog"},
        "scene": 0,
        "scenes": [{"nodes": [scene_root]}],
        "nodes": nodes,
        "meshes": [],
        "materials": materials,
        "buffers": [{"byteLength": 0}],
        "bufferViews": [],
        "accessors": [],
    }
    blob = bytearray()

    def align():
        while len(blob) % 4:
            blob.append(0)

    def add_buffer(data, target):
        align()
        offset = len(blob)
        blob.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target}
        gltf["bufferViews"].append(view)
        return len(gltf["bufferViews"]) - 1

    def add_accessor(array, component_type, typ, target):
        data = array.tobytes()
        view = add_buffer(data, target)
        accessor = {
            "bufferView": view,
            "byteOffset": 0,
            "componentType": component_type,
            "count": len(array),
            "type": typ,
        }
        if typ == "VEC3":
            accessor["min"] = [float(v) for v in array.min(axis=0)]
            accessor["max"] = [float(v) for v in array.max(axis=0)]
        gltf["accessors"].append(accessor)
        return len(gltf["accessors"]) - 1

    for mesh in meshes:
        pos = mesh["positions"].astype(np.float32)
        nor = mesh["normals"].astype(np.float32)
        idx = mesh["indices"].astype(np.uint32)
        pos_i = add_accessor(pos, 5126, "VEC3", 34962)
        nor_i = add_accessor(nor, 5126, "VEC3", 34962)
        idx_i = add_accessor(idx, 5125, "SCALAR", 34963)
        gltf["meshes"].append({
            "name": "Mesh",
            "primitives": [{
                "attributes": {"POSITION": pos_i, "NORMAL": nor_i},
                "indices": idx_i,
                "material": mesh["material"],
            }],
        })

    gltf["buffers"][0]["byteLength"] = len(blob)
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    while len(blob) % 4:
        blob.append(0)
    total = 12 + 8 + len(json_bytes) + 8 + len(blob)
    out = bytearray()
    out.extend(struct.pack("<4sII", b"glTF", 2, total))
    out.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    out.extend(json_bytes)
    out.extend(struct.pack("<II", len(blob), 0x004E4942))
    out.extend(blob)
    return out


def main():
    nodes, meshes, root = build_scene_meshes()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(build_glb(nodes, meshes, root))
    print("EXPORT_DONE:", OUT)
    print("nodes:", len(nodes), "meshes:", len(meshes))


if __name__ == "__main__":
    main()
