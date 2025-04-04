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

# Fix the output paths in the Python script
sed -i.bak "s|output_dir = \"/tmp\"|output_dir = \"$SCRIPT_DIR/blender_templates\"|g" "$PYTHON_SCRIPT"

# Run Blender with the Python script
"$BLENDER" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if the GLB file was created
GLB_FILE="$SCRIPT_DIR/blender_templates/mars_terrain.glb"
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

    # Check if the textures were created
    COLOR_TEXTURE="$SCRIPT_DIR/blender_templates/mars_terrain_color.png"
    HEIGHT_TEXTURE="$SCRIPT_DIR/blender_templates/mars_terrain_height.png"
    
    if [ -f "$COLOR_TEXTURE" ]; then
        echo "Color texture successfully exported to: $COLOR_TEXTURE"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            COLOR_SIZE=$(stat -f%z "$COLOR_TEXTURE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -f%z "$COLOR_TEXTURE")
        else
            # Linux
            COLOR_SIZE=$(stat -c%s "$COLOR_TEXTURE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -c%s "$COLOR_TEXTURE")
        fi
        echo "Color texture size: $COLOR_SIZE"
    else
        echo "Warning: Color texture file not found"
    fi
    
    if [ -f "$HEIGHT_TEXTURE" ]; then
        echo "Height texture successfully exported to: $HEIGHT_TEXTURE"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            HEIGHT_SIZE=$(stat -f%z "$HEIGHT_TEXTURE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -f%z "$HEIGHT_TEXTURE")
        else
            # Linux
            HEIGHT_SIZE=$(stat -c%s "$HEIGHT_TEXTURE" | numfmt --to=iec-i --suffix=B --format="%.2f" 2>/dev/null || stat -c%s "$HEIGHT_TEXTURE")
        fi
        echo "Height texture size: $HEIGHT_SIZE"
    else
        echo "Warning: Height texture file not found"
    fi
else
    echo "Failed to export GLB file"
fi 