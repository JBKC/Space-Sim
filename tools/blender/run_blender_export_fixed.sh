#!/bin/bash

# Define paths
BLENDER_APP="/Applications/Blender.app/Contents/MacOS/Blender"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_SCRIPT="$SCRIPT_DIR/blender_export_fixed.py"
BLEND_FILE="$SCRIPT_DIR/../terrain/terrain_generation/terrain_env/blender_templates/mars_procedural_1.blend"

# Check if Blender exists
if [ ! -f "$BLENDER_APP" ]; then
    echo "Error: Blender not found at $BLENDER_APP"
    exit 1
fi

# Check if Python script exists
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Error: Python script not found at $PYTHON_SCRIPT"
    exit 1
fi

# Check if Blender file exists
if [ ! -f "$BLEND_FILE" ]; then
    echo "Error: Blender file not found at $BLEND_FILE"
    exit 1
fi

# Print info
echo "Using Blender at: $BLENDER_APP"
echo "Running Python script: $PYTHON_SCRIPT"
echo "On Blender file: $BLEND_FILE"

# Run Blender with Python script
"$BLENDER_APP" "$BLEND_FILE" --background --python "$PYTHON_SCRIPT"

# Check if export was successful
if [ $? -eq 0 ]; then
    echo "Export completed successfully!"
else
    echo "Failed to export GLB file"
fi 