import bpy
import json
import os

def extract_modifiers_parameters(obj):
    """Extract parameters from all modifiers on the object"""
    modifiers_data = {}
    
    for modifier in obj.modifiers:
        mod_data = {}
        # Get all properties of the modifier
        for prop in dir(modifier):
            if not prop.startswith('__') and not callable(getattr(modifier, prop)):
                try:
                    value = getattr(modifier, prop)
                    # Convert to serializable types
                    if hasattr(value, 'to_list'):  # Handle Vector types
                        value = value.to_list()
                    elif hasattr(value, 'name'):  # Handle object references
                        value = value.name
                    # Skip properties that aren't JSON serializable
                    if type(value) in (str, int, float, bool, list, dict) or value is None:
                        mod_data[prop] = value
                except:
                    pass
        
        modifiers_data[modifier.name] = mod_data
    
    return modifiers_data

def extract_material_parameters(obj):
    """Extract parameters from materials assigned to the object"""
    materials_data = {}
    
    for material_slot in obj.material_slots:
        if material_slot.material:
            material = material_slot.material
            mat_data = {
                "name": material.name,
                "use_nodes": material.use_nodes
            }
            
            # Extract node properties if using nodes
            if material.use_nodes:
                mat_data["nodes"] = {}
                for node in material.node_tree.nodes:
                    node_data = {
                        "type": node.type,
                        "location": [node.location.x, node.location.y],
                        "inputs": {}
                    }
                    
                    # Extract input parameters
                    for input in node.inputs:
                        if hasattr(input, "default_value"):
                            if hasattr(input.default_value, "__len__"):
                                if len(input.default_value) <= 4:  # Only handle Vector, Color
                                    node_data["inputs"][input.name] = list(input.default_value)
                            else:
                                node_data["inputs"][input.name] = input.default_value
                    
                    mat_data["nodes"][node.name] = node_data
            
            materials_data[material.name] = mat_data
    
    return materials_data

def extract_mesh_parameters(obj):
    """Extract parameters from the mesh data"""
    mesh_data = {}
    
    if obj.data:
        mesh = obj.data
        # Basic mesh properties
        mesh_data = {
            "name": mesh.name,
            "vertices_count": len(mesh.vertices),
            "faces_count": len(mesh.polygons),
            "has_custom_normals": mesh.has_custom_normals
        }
        
        # Extract vertex group data
        if obj.vertex_groups:
            mesh_data["vertex_groups"] = [vg.name for vg in obj.vertex_groups]
    
    return mesh_data

def extract_object_parameters(obj):
    """Extract basic object parameters"""
    obj_data = {
        "name": obj.name,
        "type": obj.type,
        "location": list(obj.location),
        "rotation_euler": [round(r, 6) for r in obj.rotation_euler],
        "scale": list(obj.scale),
        "dimensions": list(obj.dimensions)
    }
    
    return obj_data

def main():
    # Find the object named "Plane"
    target_obj = None
    for obj in bpy.data.objects:
        if obj.name == "Plane" or obj.name.startswith("Plane"):
            target_obj = obj
            break
    
    if not target_obj:
        print("No object named 'Plane' found in the scene.")
        return
    
    # Extract all parameters
    terrain_data = {
        "object": extract_object_parameters(target_obj),
        "mesh": extract_mesh_parameters(target_obj),
        "modifiers": extract_modifiers_parameters(target_obj),
        "materials": extract_material_parameters(target_obj)
    }
    
    # Add information about the world and render settings
    terrain_data["world"] = {
        "name": bpy.context.scene.world.name if bpy.context.scene.world else "None"
    }
    
    terrain_data["render"] = {
        "engine": bpy.context.scene.render.engine,
        "resolution": [
            bpy.context.scene.render.resolution_x,
            bpy.context.scene.render.resolution_y
        ]
    }
    
    # Save to JSON file
    output_path = os.path.join(os.path.dirname(bpy.data.filepath), "mars_terrain_parameters.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(terrain_data, f, indent=2)
    
    print(f"Terrain parameters saved to: {output_path}")

if __name__ == "__main__":
    main() 