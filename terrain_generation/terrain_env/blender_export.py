import bpy
import mathutils
import os

print("Starting blender_export.py script...")

# === CONFIG ===
TARGET_OBJECT_NAME = "Plane"
OUTPUT_DIR = "/Users/jb/Documents/PYTHON/space_sim/terrain_generation/terrain_env/blender_templates"
HEIGHTMAP_NAME = "baked_height.png"
COLORMAP_NAME = "baked_color.png"
GLB_EXPORT_NAME = "mars_terrain_export.glb"

# === OBJECT SETUP ===
if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

obj = bpy.data.objects.get(TARGET_OBJECT_NAME)
if not obj:
    raise Exception(f"Object named '{TARGET_OBJECT_NAME}' not found.")

# Deselect all objects and select only the target
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

# === BAKE HEIGHTMAP ===
try:
    height_img = bpy.data.images.new("HeightBake", width=2048, height=2048)
    mat = obj.active_material
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    height_tex = nodes.new("ShaderNodeTexImage")
    height_tex.image = height_img
    height_tex.select = True
    nodes.active = height_tex

    # Bake from ColorRamp
    color_ramp = nodes.get("Color Ramp")
    emit_node = nodes.new("ShaderNodeEmission")
    links.new(color_ramp.outputs["Color"], emit_node.inputs["Color"])

    mat_out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
    old_link = None
    if mat_out.inputs["Surface"].is_linked:
        old_link = mat_out.inputs["Surface"].links[0]
        links.remove(old_link)

    links.new(emit_node.outputs["Emission"], mat_out.inputs["Surface"])
    mat.cycles.displacement_method = 'DISPLACEMENT'
    bpy.ops.object.bake(type='EMIT', use_clear=True)

    heightmap_path = os.path.join(OUTPUT_DIR, HEIGHTMAP_NAME)
    height_img.filepath_raw = heightmap_path
    height_img.file_format = 'PNG'
    height_img.save()
    print(f"✅ Heightmap saved to: {heightmap_path}")

    # Cleanup
    if old_link:
        links.new(old_link.from_socket, mat_out.inputs["Surface"])
    nodes.remove(emit_node)
    nodes.remove(height_tex)

except Exception as e:
    print(f"Error during height bake: {e}")

# === APPLY DISPLACEMENT ===
try:
    tex = bpy.data.textures.new("BakedDisplaceTex", type='IMAGE')
    tex.image = height_img

    disp_mod = obj.modifiers.new(name="ShaderDisplace", type='DISPLACE')
    disp_mod.texture = tex
    disp_mod.texture_coords = 'UV'
    disp_mod.direction = 'Z'
    disp_mod.strength = 2.0

    subdiv = obj.modifiers.new(name="Subdiv", type='SUBSURF')
    subdiv.levels = 6
    subdiv.render_levels = 6
    subdiv.subdivision_type = 'SIMPLE'

    bpy.ops.object.modifier_apply(modifier="Subdiv")
    bpy.ops.object.modifier_apply(modifier="ShaderDisplace")

    print("✅ Displacement applied.")
except Exception as e:
    print(f"Error applying displacement: {e}")

# === ALIGN BASE TO Z = 0 ===
try:
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    z_min = min(v.z for v in bbox)
    obj.location.z -= z_min
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    print("✅ Origin centered and base aligned to Z=0.")
except Exception as e:
    print(f"Error during alignment: {e}")

# === BAKE FINAL COLOR TEXTURE ===
try:
    color_img = bpy.data.images.new("ColorBake", width=2048, height=2048)
    color_tex_node = nodes.new("ShaderNodeTexImage")
    color_tex_node.image = color_img
    color_tex_node.select = True
    nodes.active = color_tex_node

    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)

    colormap_path = os.path.join(OUTPUT_DIR, COLORMAP_NAME)
    color_img.filepath_raw = colormap_path
    color_img.file_format = 'PNG'
    color_img.save()
    color_img.pack()
    print(f"✅ Final color map saved to: {colormap_path}")

    # Now connect the baked color to the Principled BSDF for export
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    links.new(color_tex_node.outputs['Color'], bsdf.inputs['Base Color'])

except Exception as e:
    print(f"Error baking final color: {e}")

# === EXPORT GLB ===
try:
    glb_path = os.path.join(OUTPUT_DIR, GLB_EXPORT_NAME)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

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
except Exception as e:
    print(f"Error exporting GLB: {e}")
