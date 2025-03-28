#!/usr/bin/env python3
"""
Direct test of the Huggingface API for Hunyuan3D-2 without using the Gradio client.
This script helps diagnose connection issues by going directly to the API.
"""

import argparse
import base64
import json
import os
import sys
import time
from PIL import Image
from io import BytesIO
from huggingface_hub import InferenceClient

def resize_image(image_path, max_size=1024):
    """Resize an image to a maximum dimension while preserving aspect ratio"""
    try:
        with Image.open(image_path) as img:
            # Get original dimensions
            width, height = img.size
            
            # Calculate scaling factor
            scale = min(max_size / width, max_size / height)
            
            # If image is already smaller than max_size, don't resize
            if scale >= 1.0:
                return img
            
            # Calculate new dimensions
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Resize the image
            resized_img = img.resize((new_width, new_height), Image.LANCZOS)
            print(f"Resized image from {width}x{height} to {new_width}x{new_height}")
            
            return resized_img
    except Exception as e:
        print(f"Error resizing image: {e}")
        return None

def prepare_image(image_path, max_size=1024):
    """Prepare image for API by resizing and converting to bytes"""
    try:
        # Resize image if needed
        img = resize_image(image_path, max_size)
        if not img:
            raise Exception("Failed to resize image")
        
        # Convert to bytes
        buffer = BytesIO()
        img.save(buffer, format=img.format or "JPEG")
        img_bytes = buffer.getvalue()
        
        print(f"Image prepared successfully: {len(img_bytes) / 1024:.2f} KB")
        
        return img_bytes
    except Exception as e:
        print(f"Error preparing image: {e}")
        return None

def test_huggingface_api(api_key, image_path, caption="", output_path=None):
    """Test the Huggingface API directly"""
    try:
        print("\n=== Testing Huggingface API Directly ===")
        
        if not api_key:
            print("Error: API key is required")
            return False
        
        # Prepare the image
        image_data = prepare_image(image_path)
        if not image_data:
            return False
        
        # Create client
        endpoint = "https://api-inference.huggingface.co/models/Tencent/Hunyuan3D-2"
        print(f"Creating InferenceClient for: {endpoint}")
        client = InferenceClient(endpoint, token=api_key)
        
        # Prepare parameters
        parameters = {
            "caption": caption,
            "steps": 20,
            "guidance_scale": 5.0,
            "octree_resolution": 128,
            "check_box_rembg": True,
            "num_chunks": 4000,
            "randomize_seed": True,
        }
        
        print(f"Parameters: {parameters}")
        print("Sending request to Huggingface API...")
        start_time = time.time()
        
        # Call API
        output_type = "glb"
        response = client.post(
            data={"data": [image_data, parameters, output_type]},
            model_kwargs={"wait_for_model": True}
        )
        
        elapsed_time = time.time() - start_time
        print(f"Request completed in {elapsed_time:.2f} seconds")
        
        # Determine output path
        if not output_path:
            output_path = f"direct_test_model_{int(time.time())}.glb"
        
        # Save the model
        with open(output_path, "wb") as f:
            f.write(response)
        
        file_size = os.path.getsize(output_path) / 1024
        print(f"Model saved to {output_path} ({file_size:.2f} KB)")
        
        return True
        
    except Exception as e:
        print(f"Error testing Huggingface API: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Check for common errors
        error_msg = str(e).lower()
        if "unauthorized" in error_msg or "authentication" in error_msg:
            print("\nPossible issue: API key invalid or missing required permissions")
            print("Make sure your API key has 'read' and 'inference' access rights")
        elif "timeout" in error_msg or "connection" in error_msg:
            print("\nPossible issue: Network connectivity or timeout")
            print("Consider increasing timeout settings or checking network connectivity")
        elif "rate limit" in error_msg or "quota" in error_msg:
            print("\nPossible issue: API rate limit or quota exceeded")
            print("Check your HuggingFace account for usage limits")
        
        return False

def main():
    parser = argparse.ArgumentParser(description="Test the Huggingface API directly")
    parser.add_argument("--image", type=str, required=True, help="Path to the image file")
    parser.add_argument("--caption", type=str, default="", help="Optional caption for the image")
    parser.add_argument("--output", type=str, default=None, help="Path to save the output model")
    parser.add_argument("--key", type=str, default=None, help="HuggingFace API key (alternatively, set HUGGINGFACE_API_KEY environment variable)")
    
    args = parser.parse_args()
    
    # Check if the image file exists
    if not os.path.isfile(args.image):
        print(f"Error: Image file '{args.image}' not found")
        return 1
    
    # Get API key from arguments or environment
    api_key = args.key or os.environ.get("HUGGINGFACE_API_KEY")
    if not api_key:
        print("Error: No API key provided. Use --key or set HUGGINGFACE_API_KEY environment variable")
        return 1
    
    # Test the API
    result = test_huggingface_api(api_key, args.image, args.caption, args.output)
    
    return 0 if result else 1

if __name__ == "__main__":
    exit(main()) 