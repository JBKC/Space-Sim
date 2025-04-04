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
PYTHON_SCRIPT="$SCRIPT_DIR/blender_export.py"
BLEND_FILE="$SCRIPT_DIR/blender_templates/mars_procedural_1.blend"

echo "Running Python script: $PYTHON_SCRIPT"
echo "On Blender file: $BLEND_FILE"

# Fix the output path in the Python script
sed -i.bak "s|output_path = \"/mars_terrain.glb\"|output_path = \"$SCRIPT_DIR/blender_templates/mars_terrain_baked.glb\"|g" "$PYTHON_SCRIPT"

# Run Blender with the Python script
"$BLENDER" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if the GLB file was created
GLB_FILE="$SCRIPT_DIR/blender_templates/mars_terrain_baked.glb"
if [ -f "$GLB_FILE" ]; then
    echo "Mars terrain successfully exported to: $GLB_FILE"
    # Get file size
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        FILE_SIZE=$(stat -f%z "$GLB_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -f%z "$GLB_FILE")
    else
        # Linux
        FILE_SIZE=$(stat -c%s "$GLB_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -c%s "$GLB_FILE")
    fi
    echo "File size: $FILE_SIZE"

    # Check if the texture was created
    TEXTURE_FILE="$SCRIPT_DIR/blender_templates/BakedColor.png"
    if [ -f "$TEXTURE_FILE" ]; then
        echo "Texture successfully exported to: $TEXTURE_FILE"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            TEXTURE_SIZE=$(stat -f%z "$TEXTURE_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -f%z "$TEXTURE_FILE")
        else
            # Linux
            TEXTURE_SIZE=$(stat -c%s "$TEXTURE_FILE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -c%s "$TEXTURE_FILE")
        fi
        echo "Texture size: $TEXTURE_SIZE"
    else
        echo "Warning: Texture file not found"
    fi
else
    echo "Failed to export GLB file"
fi 