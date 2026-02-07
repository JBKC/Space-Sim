#!/bin/bash

# Find blender executable
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

# If default path doesn't exist, try to find Blender
if [ ! -f "$BLENDER" ]; then
    # Try with which
    BLENDER=$(which blender)
    
    if [ -z "$BLENDER" ]; then
        echo "Blender executable not found. Please specify the path manually."
        exit 1
    fi
fi

echo "Using Blender at: $BLENDER"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_SCRIPT="$SCRIPT_DIR/export_glb.py"
BLEND_FILE="$SCRIPT_DIR/blender_templates/mars_procedural_1.blend"

echo "Running Python script: $PYTHON_SCRIPT"
echo "On Blender file: $BLEND_FILE"

# Run Blender with the Python script
"$BLENDER" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if the GLB file was created
GLB_FILE="$SCRIPT_DIR/blender_templates/mars_terrain_export.glb"
if [ -f "$GLB_FILE" ]; then
    echo "Mars terrain successfully exported to: $GLB_FILE"
    # Get file size
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        FILE_SIZE=$(stat -f%z "$GLB_FILE" | numfmt --to=iec-i --suffix=B)
    else
        # Linux
        FILE_SIZE=$(stat -c%s "$GLB_FILE" | numfmt --to=iec-i --suffix=B)
    fi
    echo "File size: $FILE_SIZE"
else
    echo "Failed to export GLB file"
fi 