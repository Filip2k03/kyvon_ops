"""Generate K-10, the KYVON companion pet, and export it as a web-ready GLB.

Run headless:

    blender --background --python assets/blender/scripts/generate_pet_k10.py

What this is, and is not
------------------------
This produces an *original, procedurally generated* low-poly companion in the
KYVON visual language — dark body, emissive blue accents, oversized eyes. It is
deliberately simple geometry so it loads fast on a landing page and so the
asset in the repository is one this pipeline can actually reproduce.

It is not a reproduction of the character-sheet artwork. That illustration
implies a sculpted, rigged, hand-textured model, which is a 3D artist's job and
cannot be honestly generated from a script. When such an asset exists, drop it
into `assets/blender/pets/` and point `export_web_assets.py` at it — the export
settings here are the ones it should use.

Everything is created from scratch, so no third-party asset licensing applies
(see docs/kyvon-assets.md).
"""

import math
import os
import sys

import bpy

# Brand colours, matching the accent used across the web UI.
ACCENT = (0.22, 0.74, 0.97, 1.0)   # #38bdf8
BODY = (0.055, 0.063, 0.09, 1.0)   # near-black, the app background
EYE = (0.02, 0.85, 0.95, 1.0)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT_DIR = os.path.join(REPO, "apps", "desktop", "public", "models")

# The roster from the character system. Each entry varies silhouette only —
# ear shape, proportions, tail — over one shared body, so the family reads as
# one design language and every asset stays inside the size budget.
PETS = {
    "k10": {"name": "K-10", "species": "cat", "ears": "pointed", "tail": "long",
            "body": (1.00, 1.35, 0.90), "accent": ACCENT},
    "k11": {"name": "K-11", "species": "fox", "ears": "tall", "tail": "bushy",
            "body": (0.95, 1.45, 0.85), "accent": (0.98, 0.55, 0.20, 1.0)},
    "k12": {"name": "K-12", "species": "dog", "ears": "folded", "tail": "short",
            "body": (1.10, 1.40, 0.95), "accent": (0.55, 0.80, 1.00, 1.0)},
    "k13": {"name": "K-13", "species": "owl", "ears": "tufted", "tail": "none",
            "body": (1.00, 1.00, 1.15), "accent": (0.75, 0.65, 1.00, 1.0)},
    "k14": {"name": "K-14", "species": "drone", "ears": "none", "tail": "none",
            "body": (1.00, 1.00, 1.00), "accent": (0.30, 0.95, 0.75, 1.0)},
}


def clear_scene():
    """Start from an empty file so repeated runs are deterministic."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def emissive(name, colour, strength=4.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Emission Color"].default_value = colour
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def matte(name, colour, roughness=0.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.25
    return mat


def add(primitive, material, **kwargs):
    primitive(**kwargs)
    obj = bpy.context.active_object
    obj.data.materials.append(material)
    return obj


def build(spec):
    key = spec["key"]
    body_mat = matte(f"{key}_Body", BODY)
    accent_mat = emissive(f"{key}_Accent", spec["accent"])
    eye_mat = emissive(f"{key}_Eye", EYE, strength=6.0)

    parts = []

    # Body and head. Low segment counts keep the export small; smooth shading
    # does the visual work instead of geometry.
    parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, body_mat,
                     radius=0.55, segments=24, ring_count=12, location=(0, 0, 0.55)))
    parts[-1].scale = spec["body"]

    head = add(bpy.ops.mesh.primitive_uv_sphere_add, body_mat,
               radius=0.42, segments=24, ring_count=12, location=(0, -0.85, 0.95))
    parts.append(head)

    # Ears vary by species; a drone has none.
    ear_shape = {
        "pointed": (0.16, 0.34, 14),
        "tall": (0.13, 0.48, 10),
        "folded": (0.19, 0.24, 42),
        "tufted": (0.10, 0.22, 20),
    }.get(spec["ears"])
    if ear_shape:
        radius, depth, tilt = ear_shape
        for side in (-1, 1):
            ear = add(bpy.ops.mesh.primitive_cone_add, body_mat,
                      radius1=radius, depth=depth, vertices=12,
                      location=(0.22 * side, -0.92, 1.32))
            ear.rotation_euler = (math.radians(12), 0, math.radians(tilt * side))
            parts.append(ear)

    # Eyes — oversized, emissive, the feature that carries the character.
    for side in (-1, 1):
        parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, eye_mat,
                         radius=0.13, segments=16, ring_count=8,
                         location=(0.17 * side, -1.19, 1.00)))

    # Forehead sigil and collar: the KYVON accent lighting.
    parts.append(add(bpy.ops.mesh.primitive_torus_add, accent_mat,
                     major_radius=0.11, minor_radius=0.022,
                     major_segments=16, minor_segments=6,
                     location=(0, -1.05, 1.25)))
    collar = add(bpy.ops.mesh.primitive_torus_add, accent_mat,
                 major_radius=0.40, minor_radius=0.035,
                 major_segments=20, minor_segments=6, location=(0, -0.50, 0.82))
    collar.rotation_euler = (math.radians(80), 0, 0)
    parts.append(collar)

    # Legs.
    for x, y in ((0.28, -0.35), (-0.28, -0.35), (0.28, 0.45), (-0.28, 0.45)):
        parts.append(add(bpy.ops.mesh.primitive_cylinder_add, body_mat,
                         radius=0.10, depth=0.55, vertices=10, location=(x, y, 0.27)))

    # Tail, where the species has one.
    tail_shape = {"long": (0.055, 0.85), "bushy": (0.11, 0.70), "short": (0.07, 0.34)}
    if spec["tail"] in tail_shape:
        radius, depth = tail_shape[spec["tail"]]
        tail = add(bpy.ops.mesh.primitive_cylinder_add, accent_mat,
                   radius=radius, depth=depth, vertices=8, location=(0, 0.95, 0.80))
        tail.rotation_euler = (math.radians(58), 0, 0)
        parts.append(tail)

    for obj in parts:
        for poly in obj.data.polygons:
            poly.use_smooth = True

    # One object exports as one draw call.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    pet = bpy.context.active_object
    pet.name = spec["key"].upper()
    return pet


def add_idle_animation(pet):
    """A slow breathing bob — enough to read as alive without a rig."""
    pet.animation_data_create()
    for frame, z in ((1, 0.0), (30, 0.045), (60, 0.0)):
        pet.location.z = z
        pet.keyframe_insert(data_path="location", index=2, frame=frame)
    # Blender 5's slotted actions moved `fcurves` off the Action object; the
    # default interpolation is already Bezier, which is what this needs.
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60


def export(pet, key):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{key}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    pet.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_draco_mesh_compression_enable=False,  # keep loaders simple
        export_apply=True,
    )
    return path


def main():
    """Build every pet in the roster, each in its own clean scene."""
    manifest = []
    for key, spec in PETS.items():
        clear_scene()
        pet = build({**spec, "key": key})
        add_idle_animation(pet)
        path = export(pet, key)
        size = os.path.getsize(path)
        faces = len(pet.data.polygons)
        manifest.append((key, spec["name"], size, faces))
        print(f"KYVON: wrote {os.path.basename(path)} ({size} bytes, {faces} faces)")
        if size > 512_000:
            print(f"KYVON: WARNING {key} exceeds the 500 kB budget", file=sys.stderr)

    total = sum(m[2] for m in manifest)
    print(f"KYVON: {len(manifest)} pets, {total} bytes total")


if __name__ == "__main__":
    main()
