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
PYTHON_SCRIPT="$SCRIPT_DIR/lock_texture_fixed.py"
BLEND_FILE="$SCRIPT_DIR/blender_templates/mars_procedural_1.blend"

echo "Running Python script: $PYTHON_SCRIPT"
echo "On Blender file: $BLEND_FILE"

# Run Blender with the Python script
"$BLENDER" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if the heightmap was created
HEIGHTMAP_FILE="/tmp/baked_height.png"
if [ -f "$HEIGHTMAP_FILE" ]; then
    echo "Heightmap successfully created at: $HEIGHTMAP_FILE"
    # Copy it to a more accessible location
    cp "$HEIGHTMAP_FILE" "$SCRIPT_DIR/blender_templates/baked_height.png"
    echo "Copied heightmap to: $SCRIPT_DIR/blender_templates/baked_height.png"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        HEIGHTMAP_SIZE=$(stat -f%z "$HEIGHTMAP_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -f%z "$HEIGHTMAP_FILE")
    else
        # Linux
        HEIGHTMAP_SIZE=$(stat -c%s "$HEIGHTMAP_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -c%s "$HEIGHTMAP_FILE")
    fi
    echo "Heightmap size: $HEIGHTMAP_SIZE"
else
    echo "Warning: Heightmap file not found at $HEIGHTMAP_FILE"
fi

echo "Completed running lock_texture_fixed.py on the Blender file." 