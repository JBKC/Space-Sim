import bpy
import mathutils

obj = bpy.context.active_object

# Move mesh so its base is at Z=0
bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
z_min = min(v.z for v in bbox)
obj.location.z -= z_min

# Set origin to geometry center
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

print("✅ Terrain base aligned with Z=0 and origin centered.")
