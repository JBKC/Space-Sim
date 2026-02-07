import bpy
import os
import mathutils

def export_plane_to_glb():
    # Path to save the exported file
    output_dir = os.path.dirname(bpy.data.filepath)
    output_path = os.path.join(output_dir, "mars_terrain_export.glb")
    
    # Deselect everything
    bpy.ops.object.select_all(action='DESELECT')
    
    # Find and select the Plane object
    plane_obj = None
    for obj in bpy.data.objects:
        if obj.name == "Plane" or obj.name.startswith("Plane"):
            plane_obj = obj
            plane_obj.select_set(True)
            bpy.context.view_layer.objects.active = plane_obj
            break
    
    if not plane_obj:
        print("No object named 'Plane' found in the scene.")
        return
    
    # === APPLY ALL MODIFIERS (Displace/Subdivision) ===
    for modifier in plane_obj.modifiers:
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            print(f"Applied modifier: {modifier.name}")
        except Exception as e:
            print(f"Failed to apply modifier {modifier.name}: {e}")

    # === MOVE OBJECT ORIGIN TO BOTTOM ===
    # Get bounding box after modifiers are applied
    bbox_world = [plane_obj.matrix_world @ mathutils.Vector(corner) for corner in plane_obj.bound_box]
    z_min = min([v.z for v in bbox_world])
    plane_obj.location.z -= z_min
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

    # === BAKE COLOR TEXTURE ===
    if plane_obj.active_material and plane_obj.active_material.use_nodes:
        try:
            mat = plane_obj.active_material
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links

            # Create a 2K bake target
            bake_img = bpy.data.images.new(name="BakedTexture", width=2048, height=2048)
            bake_img.file_format = 'PNG'
            bake_img.filepath_raw = os.path.join(output_dir, "mars_terrain_texture.png")

            # Add image texture node
            bake_node = nodes.new('ShaderNodeTexImage')
            bake_node.image = bake_img
            bake_node.select = True
            nodes.active = bake_node

            # Ensure UV unwrap
            bpy.context.view_layer.objects.active = plane_obj
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.uv.smart_project()
            bpy.ops.object.mode_set(mode='OBJECT')

            bpy.context.scene.render.engine = 'CYCLES'
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)

            # Save the image
            bake_img.save()
            print("✅ Baked texture and saved to PNG")

            # Assign the baked image to the final material
            principled = nodes.get("Principled BSDF")
            if principled:
                links.new(bake_node.outputs["Color"], principled.inputs["Base Color"])
            else:
                print("⚠️ Couldn't find Principled BSDF")

        except Exception as e:
            print(f"⚠️ Baking failed: {e}")

    # === EXPORT AS GLB ===
    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=True,
            export_texcoords=True,
            export_normals=True,
            export_materials='EXPORT',
            export_colors=True,
            export_yup=True,
        )
        print(f"✅ Exported GLB to: {output_path}")
    except Exception as e:
        print(f"❌ Export failed: {e}")

# Run the export
export_plane_to_glb()
