import bpy

# Get the sketchfab model and all its child nodes
sketchfab_object = None
nodes = []

print("Starting to search for nodes in the sketchfab model...")

# First, find the sketchfab model object
for obj in bpy.context.scene.objects:
    if "sketchfab" in obj.name.lower():
        sketchfab_object = obj
        print(f"Found sketchfab model: {obj.name}")
        break

# If we found the model, look for its nodes
if sketchfab_object:
    # Approach 1: Try to find direct children
    for obj in bpy.context.scene.objects:
        if obj.parent and obj.parent.name == sketchfab_object.name:
            nodes.append(obj)
            print(f"Found node: {obj.name}")
    
    # Approach 2: If no nodes found, try searching all objects for names containing "node"
    if not nodes:
        print("No direct children found, looking for objects with 'node' in their name...")
        for obj in bpy.context.scene.objects:
            if "node" in obj.name.lower():
                nodes.append(obj)
                print(f"Found node by name: {obj.name}")

# If we still couldn't find any nodes, try a more general approach
if not nodes:
    print("No nodes found using standard approaches, trying to find all small objects within the model...")
    # Collect all mesh objects that might be nodes based on their size
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj != sketchfab_object:
            # Check if it's a small object, likely to be a node
            if all(d < 0.5 for d in obj.dimensions):
                nodes.append(obj)
                print(f"Found potential node based on size: {obj.name}")

print(f"Total nodes found: {len(nodes)}")

# Create a new glowing blue material
glow_material = bpy.data.materials.new(name="GlowingBlue")
glow_material.use_nodes = True
node_tree = glow_material.node_tree
nodes_mat = node_tree.nodes

# Clear existing nodes
for node in nodes_mat:
    nodes_mat.remove(node)

# Add new nodes for glowing effect
output = nodes_mat.new(type='ShaderNodeOutputMaterial')
emission = nodes_mat.new(type='ShaderNodeEmission')
# Bright blue color with alpha 1
emission.inputs[0].default_value = (0.0, 0.5, 1.0, 1.0)
# Strong emission for glow effect
emission.inputs[1].default_value = 3.0

# Connect nodes
node_tree.links.new(emission.outputs[0], output.inputs[0])

# Modified scale factor
scale_factor = 1.5

# Apply scale increase and material to each node
modified_count = 0
for obj in nodes:
    # Make the object larger
    obj.scale *= scale_factor
    print(f"Scaled up {obj.name}")
    
    # Apply the glowing material
    if obj.type == 'MESH':
        # Clear existing materials
        while len(obj.data.materials) > 0:
            obj.data.materials.pop(index=0)
        
        # Add new glowing material
        obj.data.materials.append(glow_material)
        print(f"Applied glowing material to {obj.name}")
        modified_count += 1

print(f"Completed: {modified_count} nodes have been modified with larger size and glowing blue material") 