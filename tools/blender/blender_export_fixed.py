import bpy
import mathutils
import os

print("Starting Blender export script...")

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
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as e:
        print(f"Warning: Could not apply modifier {mod.name}: {e}")

# === UV UNWRAP ===
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')
print("✅ UV unwrap complete")

# === SET UP RENDERING ENGINE ===
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'
print("✅ Rendering engine set to Cycles")

# === BAKE COLOR MAP ===
try:
    # Create color image
    color_img = bpy.data.images.new("baked_color", width=2048, height=2048)
    color_img.file_format = 'PNG'
    
    # Get material nodes
    mat = obj.active_material
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    # Create image texture node for baking
    bake_node = nodes.new('ShaderNodeTexImage')
    bake_node.image = color_img
    bake_node.select = True
    nodes.active = bake_node
    
    # Bake diffuse color
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
    
    # Save color map
    color_path = os.path.join(OUTPUT_DIR, COLOR_MAP_NAME)
    color_img.filepath_raw = color_path
    color_img.save()
    print(f"✅ Color map saved to: {color_path}")
    
    # Connect baked texture to material
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        # Check if base color already has connections
        if bsdf.inputs["Base Color"].is_linked:
            for link in bsdf.inputs["Base Color"].links:
                links.remove(link)
        
        # Connect our baked texture
        links.new(bake_node.outputs["Color"], bsdf.inputs["Base Color"])
        print("✅ Baked color connected to material")
except Exception as e:
    print(f"Error during color baking: {e}")

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

# Store original socket for reconnection
original_socket = None
if material_output.inputs["Surface"].is_linked:
    original_socket = material_output.inputs["Surface"].links[0].from_socket
    # Remove all links to the surface input
    while material_output.inputs["Surface"].links:
        links.remove(material_output.inputs["Surface"].links[0])

# Create emission link for baking
links.new(emit_node.outputs["Emission"], material_output.inputs["Surface"])

bpy.ops.object.bake(type='EMIT', use_clear=True)

height_path = os.path.join(OUTPUT_DIR, HEIGHT_MAP_NAME)
height_img.filepath_raw = height_path
height_img.save_render(filepath=height_path)
print(f"✅ Height map saved to: {height_path}")

# Restore original connection if we had one
if original_socket:
    # First remove the emission link
    while material_output.inputs["Surface"].links:
        links.remove(material_output.inputs["Surface"].links[0])
    
    # Reconnect the original link
    try:
        links.new(original_socket, material_output.inputs["Surface"])
    except Exception as e:
        print(f"Warning: Could not restore original material link: {e}")

# Clean up nodes
nodes.remove(emit_node)
nodes.remove(height_node)

# === APPLY DISPLACEMENT ===
try:
    # Create texture for displacement
    tex = bpy.data.textures.new("DisplaceTex", type='IMAGE')
    tex.image = height_img
    
    # Add displacement modifier
    disp_mod = obj.modifiers.new(name="ShaderDisplace", type='DISPLACE')
    disp_mod.texture = tex
    disp_mod.texture_coords = 'UV'
    disp_mod.direction = 'Z'
    disp_mod.strength = 2.0
    disp_mod.mid_level = 0.5
    
    # Add subdivision modifier
    subdiv = obj.modifiers.new(name="Subdiv", type='SUBSURF')
    subdiv.levels = 6
    subdiv.render_levels = 6
    subdiv.subdivision_type = 'SIMPLE'
    
    # Apply modifiers
    bpy.ops.object.modifier_apply(modifier="Subdiv")
    bpy.ops.object.modifier_apply(modifier="ShaderDisplace")
    print("✅ Displacement applied")
except Exception as e:
    print(f"Error applying displacement: {e}")

# === ALIGN BASE TO Z=0 ===
try:
    # Get bounding box
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    z_min = min(v.z for v in bbox)
    
    # Shift object up
    obj.location.z -= z_min
    
    # Set origin to center of bounds
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    print("✅ Base aligned to Z=0 and origin centered")
except Exception as e:
    print(f"Error aligning base: {e}")

# === EXPORT GLB ===
try:
    # Ensure object is selected
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    
    # Set export path
    glb_path = os.path.join(OUTPUT_DIR, GLB_EXPORT_NAME)
    
    # Export GLB
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

print("Export process complete") 