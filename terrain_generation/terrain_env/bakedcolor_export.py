import bpy
import os

# === CONFIG ===
output_path = "/Users/jb/Documents/PYTHON/space_sim/terrain_generation/terrain_env/blender_templates/mars_terrain_export.glb"
bake_image_name = "baked_color"
image_size = 2048  # 2K texture

# === SELECT THE TERRAIN OBJECT ===
terrain = bpy.data.objects.get("Plane")
if not terrain:
    raise Exception("Terrain object 'Plane' not found.")

bpy.ops.object.select_all(action='DESELECT')
terrain.select_set(True)
bpy.context.view_layer.objects.active = terrain

# === APPLY MODIFIERS (Subdivision) ===
for mod in terrain.modifiers:
    bpy.ops.object.modifier_apply(modifier=mod.name)

# === UV UNWRAP ===
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')

# === CREATE BAKED IMAGE TEXTURE ===
image = bpy.data.images.new(name=bake_image_name, width=image_size, height=image_size)
image.file_format = 'PNG'

# Add image texture node to material
mat = terrain.active_material
nodes = mat.node_tree.nodes
links = mat.node_tree.links

bake_node = nodes.new('ShaderNodeTexImage')
bake_node.image = image
bake_node.select = True
nodes.active = bake_node

# === SWITCH TO CYCLES FOR BAKING ===
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'  # Or 'GPU' if set up

# === BAKE COLOR PASS ===
bpy.context.view_layer.objects.active = terrain
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)

# === SAVE IMAGE TO FILE ===
image_filepath = os.path.join(os.path.dirname(output_path), bake_image_name + ".png")
image.filepath_raw = image_filepath
image.save()

# === PLUG BAKED IMAGE INTO PRINCIPLED SHADER ===
principled = nodes.get("Principled BSDF")
if principled:
    links.new(bake_node.outputs["Color"], principled.inputs["Base Color"])

# === EXPORT TO .glb ===
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB'
)

print(f"Export complete. GLB file saved to: {output_path}")

