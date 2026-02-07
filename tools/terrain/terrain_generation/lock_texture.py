
import bpy
import mathutils
import os

print("Starting lock_texture.py script...")

# === CONFIG ===
TARGET_OBJECT_NAME = "Plane"
OUTPUT_DIR = "/Users/jb/Documents/PYTHON/space_sim/terrain_generation/terrain_env/blender_templates"
HEIGHTMAP_NAME = "baked_height.png"

# === OBJECT SETUP ===
if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

obj = bpy.data.objects.get(TARGET_OBJECT_NAME)
if not obj:
    raise Exception(f"Object named '{TARGET_OBJECT_NAME}' not found.")

# Deselect all objects and select only target
for o in bpy.data.objects:
    o.select_set(False)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

# === SWITCH TO CYCLES ===
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'

# === ENSURE UVS EXIST ===
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')

# === BAKE HEIGHTMAP FROM EXISTING SHADER ===
try:
    img = bpy.data.images.new("HeightBake", width=2048, height=2048)
    mat = obj.active_material
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Bake image node
    tex_node = nodes.new("ShaderNodeTexImage")
    tex_node.image = img
    tex_node.select = True
    nodes.active = tex_node

    # Hook ColorRamp to Emission for baking
    color_ramp = nodes.get("Color Ramp")
    if not color_ramp:
        raise Exception("Color Ramp node not found in material.")

    emit_node = nodes.new("ShaderNodeEmission")
    links.new(color_ramp.outputs["Color"], emit_node.inputs["Color"])

    material_output = None
    for node in nodes:
        if node.type == 'OUTPUT_MATERIAL':
            material_output = node
            break
    if not material_output:
        raise Exception("Material Output node not found.")

    old_link = None
    if material_output.inputs["Surface"].is_linked:
        old_link = material_output.inputs["Surface"].links[0]

    links.new(emit_node.outputs["Emission"], material_output.inputs["Surface"])

    mat.cycles.displacement_method = 'DISPLACEMENT'

    bpy.ops.object.bake(type='EMIT', use_clear=True)

    # Save the baked heightmap
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    heightmap_path = os.path.join(OUTPUT_DIR, HEIGHTMAP_NAME)
    img.filepath_raw = heightmap_path
    img.file_format = 'PNG'
    img.save()
    print(f"Heightmap saved to: {heightmap_path}")

    # Restore original shader output
    if old_link:
        links.new(old_link.from_socket, material_output.inputs["Surface"])
    nodes.remove(emit_node)
    nodes.remove(tex_node)

except Exception as e:
    print(f"Error during baking: {e}")

# === APPLY DISPLACEMENT USING HEIGHTMAP ===
try:
    tex = bpy.data.textures.new("BakedDisplaceTex", type='IMAGE')
    tex.image = img

    disp_mod = obj.modifiers.new(name="ShaderDisplace", type='DISPLACE')
    disp_mod.texture = tex
    disp_mod.texture_coords = 'UV'
    disp_mod.direction = 'Z'
    disp_mod.strength = 1.0

    subdiv = obj.modifiers.new(name="Subdiv", type='SUBSURF')
    subdiv.levels = 4
    subdiv.render_levels = 4
    subdiv.subdivision_type = 'SIMPLE'

    bpy.ops.object.modifier_apply(modifier="Subdiv")
    bpy.ops.object.modifier_apply(modifier="ShaderDisplace")

    print("✅ Displacement baked and applied to mesh.")
except Exception as e:
    print(f"Error applying displacement: {e}")

# === ALIGN OBJECT TO Z = 0 ===
try:
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    z_min = min(v.z for v in bbox)
    obj.location.z -= z_min
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    print("✅ Aligned base to Z=0 and centered origin.")
except Exception as e:
    print(f"Error during alignment: {e}")
