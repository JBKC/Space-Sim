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
PYTHON_SCRIPT="$SCRIPT_DIR/extract_params.py"
BLEND_FILE="$SCRIPT_DIR/blender_templates/mars_procedural_1.blend"

echo "Running Python script: $PYTHON_SCRIPT"
echo "On Blender file: $BLEND_FILE"

# Run Blender with the Python script
"$BLENDER" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if the JSON file was created
JSON_FILE="$SCRIPT_DIR/blender_templates/mars_terrain_parameters.json"
if [ -f "$JSON_FILE" ]; then
    echo "Parameters successfully extracted to: $JSON_FILE"
    cat "$JSON_FILE"
else
    echo "Failed to extract parameters"
fi 