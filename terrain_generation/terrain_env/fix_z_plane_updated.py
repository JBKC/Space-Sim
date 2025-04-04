import bpy
import mathutils

print("Starting fix_z_plane.py script...")

# Make sure we're in object mode
if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
    try:
        bpy.ops.object.mode_set(mode='OBJECT')
        print("Switched to object mode")
    except Exception as e:
        print(f"Warning: Could not switch to object mode: {e}")

# Get the active object
obj = bpy.context.active_object
if not obj:
    # Try to find and select the Plane object
    obj = bpy.data.objects.get("Plane")
    if obj:
        # Select the object
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        print(f"Selected object: {obj.name}")
    else:
        print("Error: No active object and no Plane object found")
        exit(1)

print(f"Working with object: {obj.name}")

# Move mesh so its base is at Z=0
try:
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    z_min = min(v.z for v in bbox)
    obj.location.z -= z_min
    print(f"Adjusted Z position to align base at Z=0 (offset: {z_min})")
except Exception as e:
    print(f"Error adjusting Z position: {e}")

# Set origin to geometry center
try:
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    print("Centered origin to geometry bounds")
except Exception as e:
    print(f"Error setting origin: {e}")
    try:
        # Alternative approach: manually calculate center
        sum_co = mathutils.Vector((0, 0, 0))
        for v in obj.data.vertices:
            sum_co += v.co
        center_co = sum_co / len(obj.data.vertices)
        
        # Apply the offset
        for v in obj.data.vertices:
            v.co -= center_co
        obj.location += center_co
        print("Centered origin by manually calculating center of geometry")
    except Exception as e2:
        print(f"Error with alternative centering approach: {e2}")

print("✅ Terrain base aligned with Z=0 and origin centered.") 