import bpy
import mathutils
import os

print("Starting high-resolution export script...")

# === CONFIG ===
TARGET_OBJECT_NAME = "Plane"
OUTPUT_DIR = "/Users/jb/Documents/PYTHON/space_sim/terrain_generation/terrain_env/blender_templates"
HEIGHTMAP_NAME = "baked_height_highres.png"
COLORMAP_NAME = "baked_color_highres.png"
GLB_EXPORT_NAME = "mars_terrain_highres.glb"
HEIGHTMAP_RESOLUTION = 16384  # Higher resolution heightmap
SUBDIV_LEVELS = 10           # Increased subdivision levels
DISPLACEMENT_STRENGTH = 2.0  # Adjust as needed

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
# Use better UV unwrapping method with more segments
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=0.01, angle_limit=66)
bpy.ops.object.mode_set(mode='OBJECT')

# === BAKE HEIGHTMAP ===
try:
    # Create a high-resolution height map image
    height_img = bpy.data.images.new("HeightBake", width=HEIGHTMAP_RESOLUTION, height=HEIGHTMAP_RESOLUTION)
    mat = obj.active_material
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Create image texture node for baking
    height_tex = nodes.new("ShaderNodeTexImage")
    height_tex.image = height_img
    height_tex.select = True
    nodes.active = height_tex

    # Find color ramp node and connect to emission for baking
    color_ramp = nodes.get("Color Ramp")
    emit_node = nodes.new("ShaderNodeEmission")
    
    # Connect color ramp to emission
    if color_ramp and emit_node:
        links.new(color_ramp.outputs["Color"], emit_node.inputs["Color"])
    
        # Temporarily modify material for baking
        mat_out = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if mat_out:
            # Store existing surface connection
            original_surface_links = []
            if mat_out.inputs["Surface"].is_linked:
                for link in mat_out.inputs["Surface"].links:
                    original_surface_links.append((link.from_socket, link.to_socket))
                    links.remove(link)
            
            # Connect emission for baking
            links.new(emit_node.outputs["Emission"], mat_out.inputs["Surface"])
            
            # Set material displacement method
            mat.cycles.displacement_method = 'DISPLACEMENT'
            
            # Bake
            bpy.ops.object.bake(type='EMIT', use_clear=True)
            
            # Save heightmap
            heightmap_path = os.path.join(OUTPUT_DIR, HEIGHTMAP_NAME)
            height_img.filepath_raw = heightmap_path
            height_img.file_format = 'PNG'
            height_img.save()
            print(f"✅ High resolution heightmap saved to: {heightmap_path}")
            
            # Restore original connections
            for from_socket, to_socket in original_surface_links:
                links.new(from_socket, to_socket)
            
            # Cleanup temporary nodes
            nodes.remove(emit_node)
            nodes.remove(height_tex)

except Exception as e:
    print(f"Error during height bake: {e}")

# === APPLY DISPLACEMENT AND SMOOTHING ===
try:
    # Add a high-resolution displacement
    tex = bpy.data.textures.new("BakedDisplaceTex", type='IMAGE')
    tex.image = height_img

    # Create a subdivision modifier first (best practice)
    subdiv = obj.modifiers.new(name="Subdiv", type='SUBSURF')
    subdiv.levels = SUBDIV_LEVELS
    subdiv.render_levels = SUBDIV_LEVELS
    subdiv.subdivision_type = 'CATMULL_CLARK'  # More organic smoothing
    subdiv.quality = 6  # Higher quality subdivisions

    # Add displacement modifier after subdivision
    disp_mod = obj.modifiers.new(name="ShaderDisplace", type='DISPLACE')
    disp_mod.texture = tex
    disp_mod.texture_coords = 'UV'
    disp_mod.direction = 'Z'
    disp_mod.strength = DISPLACEMENT_STRENGTH
    disp_mod.mid_level = 0.5  # Balanced displacement

    # Apply subdivision first
    bpy.ops.object.modifier_apply(modifier="Subdiv")
    
    # Then apply displacement
    bpy.ops.object.modifier_apply(modifier="ShaderDisplace")
    
    # Add smooth shading to mesh
    bpy.ops.object.shade_smooth()
    
    # Set auto-smooth for crisp edges while maintaining overall smoothness
    obj.data.use_auto_smooth = True
    obj.data.auto_smooth_angle = 0.523599  # 30 degrees in radians

    print("✅ High-resolution displacement and smoothing applied.")
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
        export_tangents=True,  # Include tangent data for better normal mapping
        export_materials='EXPORT',
        export_colors=True,
        export_attributes=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,  # Use Draco compression
        export_draco_mesh_compression_level=7  # Higher compression level
    )
    print(f"✅ High-resolution GLB file exported to: {glb_path}")
except Exception as e:
    print(f"Error exporting GLB: {e}") 