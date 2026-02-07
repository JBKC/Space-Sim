import bpy
import mathutils
import os

# === CONFIG ===
TARGET_OBJECT_NAME = "Plane"
OUTPUT_DIR = "/Users/jb/Documents/PYTHON/space_sim/terrain_generation/terrain_env/blender_templates"
COLOR_MAP_NAME = "baked_color.png"
HEIGHT_MAP_NAME = "baked_height.png"
GLB_EXPORT_NAME = "mars_terrain_export.glb"

# === SELECT OBJECT ===
obj = bpy.data.objects.get(TARGET_OBJECT_NAME)
if not obj:
    raise Exception(f"Object '{TARGET_OBJECT_NAME}' not found.")

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

# === APPLY ALL MODIFIERS ===
bpy.context.view_layer.objects.active = obj
for mod in obj.modifiers:
    bpy.ops.object.modifier_apply(modifier=mod.name)

# === UV UNWRAP ===
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')

# === BAKE COLOR MAP ===
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'
bpy.context.scene.cycles.bake_type = 'DIFFUSE'
bpy.context.scene.render.bake.use_pass_direct = False
bpy.context.scene.render.bake.use_pass_indirect = False

color_img = bpy.data.images.new("baked_color", width=2048, height=2048)
color_img.file_format = 'PNG'

mat = obj.active_material
nodes = mat.node_tree.nodes
links = mat.node_tree.links

bake_node = nodes.new('ShaderNodeTexImage')
bake_node.image = color_img
bake_node.select = True
nodes.active = bake_node

bpy.ops.object.bake(type='DIFFUSE', use_clear=True)

color_path = os.path.join(OUTPUT_DIR, COLOR_MAP_NAME)
color_img.filepath_raw = color_path
color_img.save_render(filepath=color_path)
print(f"✅ Color map saved to: {color_path}")

# Plug color map into Principled BSDF
bsdf = nodes.get("Principled BSDF")
if bsdf:
    links.new(bake_node.outputs["Color"], bsdf.inputs["Base Color"])

# === BAKE HEIGHT MAP FROM COLOR RAMP ===
bpy.context.scene.cycles.bake_type = 'EMIT'
height_img = bpy.data.images.new("baked_height", width=2048, height=2048)
height_img.file_format = 'PNG'

height_node = nodes.new("ShaderNodeTexImage")
height_node.image = height_img
height_node.select = True
nodes.active = height_node

color_ramp = nodes.get("Color Ramp")
if not color_ramp:
    raise Exception("Color Ramp node not found in material.")

emit_node = nodes.new("ShaderNodeEmission")
links.new(color_ramp.outputs["Color"], emit_node.inputs["Color"])

material_output = nodes.get("Material Output")

# Store original input
original_input = None
if material_output.inputs["Surface"].is_linked:
    original_input = material_output.inputs["Surface"].links[0].from_socket
    # Remove existing link
    for link in material_output.inputs["Surface"].links:
        links.remove(link)

# Create new link for baking
links.new(emit_node.outputs["Emission"], material_output.inputs["Surface"])

bpy.ops.object.bake(type='EMIT', use_clear=True)

height_path = os.path.join(OUTPUT_DIR, HEIGHT_MAP_NAME)
height_img.filepath_raw = height_path
height_img.save_render(filepath=height_path)
print(f"✅ Height map saved to: {height_path}")

# Restore original surface connection if we stored one
if original_input:
    # Remove the temporary emission link
    for link in material_output.inputs["Surface"].links:
        links.remove(link)
    # Recreate the original link
    links.new(original_input, material_output.inputs["Surface"])

# Clean up
nodes.remove(emit_node)
nodes.remove(height_node)

# === APPLY HEIGHTMAP AS DISPLACEMENT ===
tex = bpy.data.textures.new("BakedDisplaceTex", type='IMAGE')
tex.image = height_img

disp_mod = obj.modifiers.new(name="ShaderDisplace", type='DISPLACE')
disp_mod.texture = tex
disp_mod.texture_coords = 'UV'
disp_mod.direction = 'Z'
disp_mod.strength = 2.0
disp_mod.mid_level = 0.5

subdiv = obj.modifiers.new(name="Subdiv", type='SUBSURF')
subdiv.levels = 6
subdiv.render_levels = 6
subdiv.subdivision_type = 'SIMPLE'

bpy.ops.object.modifier_apply(modifier="Subdiv")
bpy.ops.object.modifier_apply(modifier="ShaderDisplace")
print("✅ Displacement applied.")

# === ALIGN BASE TO Z = 0 ===
bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
z_min = min(v.z for v in bbox)
obj.location.z -= z_min
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
print("✅ Origin centered and base aligned to Z=0.")

# === EXPORT TO GLB ===
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

glb_path = os.path.join(OUTPUT_DIR, GLB_EXPORT_NAME)
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)
print(f"✅ GLB file exported to: {glb_path}") 