#!/usr/bin/env python3
"""
Test script for the Hunyuan3D direct API server.
This script sends a test image to the server and retrieves a 3D model.
"""

import argparse
import base64
import json
import os
import requests
import time
from PIL import Image
from io import BytesIO

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

def encode_image(image_path, max_size=1024):
    """Load image, resize if needed, and encode to base64"""
    try:
        # Resize image if needed
        img = resize_image(image_path, max_size)
        if not img:
            raise Exception("Failed to resize image")
        
        # Convert to bytes
        buffer = BytesIO()
        img.save(buffer, format=img.format or "JPEG")
        img_bytes = buffer.getvalue()
        
        # Encode to base64
        base64_encoded = base64.b64encode(img_bytes).decode('utf-8')
        print(f"Image encoded successfully: {len(base64_encoded) / 1024:.2f} KB")
        
        return base64_encoded
    except Exception as e:
        print(f"Error encoding image: {e}")
        return None

def test_sync_api(server_url, image_path, caption=""):
    """Test the synchronous API endpoint"""
    try:
        print("\n=== Testing Synchronous API ===")
        print(f"Server URL: {server_url}")
        print(f"Image path: {image_path}")
        
        # Encode the image
        base64_image = encode_image(image_path)
        if not base64_image:
            return False
        
        # Prepare request data
        request_data = {
            "image": base64_image,
            "caption": caption,
            "num_inference_steps": 20,
            "guidance_scale": 5.0,
            "octree_resolution": 128,
            "type": "glb"
        }
        
        # Send request
        print("Sending request to /generate endpoint...")
        start_time = time.time()
        response = requests.post(
            f"{server_url}/generate",
            json=request_data,
            headers={"Content-Type": "application/json"},
            stream=True  # Stream the response to handle large files
        )
        
        # Check response
        if not response.ok:
            print(f"Error: {response.status_code} - {response.text}")
            return False
        
        # Save the model
        output_path = "test_model_sync.glb"
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        elapsed_time = time.time() - start_time
        file_size = os.path.getsize(output_path) / 1024
        print(f"Model saved to {output_path} ({file_size:.2f} KB)")
        print(f"Request completed in {elapsed_time:.2f} seconds")
        
        return True
    except Exception as e:
        print(f"Error testing synchronous API: {e}")
        return False

def test_async_api(server_url, image_path, caption=""):
    """Test the asynchronous API endpoints"""
    try:
        print("\n=== Testing Asynchronous API ===")
        print(f"Server URL: {server_url}")
        print(f"Image path: {image_path}")
        
        # Encode the image
        base64_image = encode_image(image_path)
        if not base64_image:
            return False
        
        # Prepare request data
        request_data = {
            "image": base64_image,
            "caption": caption,
            "num_inference_steps": 20,
            "guidance_scale": 5.0,
            "octree_resolution": 128,
            "type": "glb"
        }
        
        # Send job
        print("Sending job to /send endpoint...")
        start_time = time.time()
        response = requests.post(
            f"{server_url}/send",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Check response
        if not response.ok:
            print(f"Error: {response.status_code} - {response.text}")
            return False
        
        # Get job ID
        job_data = response.json()
        job_id = job_data["uid"]
        print(f"Job submitted successfully. Job ID: {job_id}")
        
        # Poll for status
        print("Polling for job status...")
        attempts = 0
        max_attempts = 60  # 5 minutes max (5s per poll)
        
        while attempts < max_attempts:
            attempts += 1
            status_response = requests.get(f"{server_url}/status/{job_id}")
            
            if not status_response.ok:
                print(f"Error checking status: {status_response.status_code} - {status_response.text}")
                time.sleep(5)
                continue
            
            status_data = status_response.json()
            status = status_data["status"]
            progress = status_data.get("progress", 0)
            message = status_data.get("message", "")
            
            print(f"Status: {status} - Progress: {progress}% - {message}")
            
            if status == "completed":
                # Job completed successfully
                model_base64 = status_data.get("model_base64")
                if not model_base64:
                    print("Error: Model data not found in response")
                    return False
                
                # Decode and save the model
                output_path = "test_model_async.glb"
                with open(output_path, "wb") as f:
                    f.write(base64.b64decode(model_base64))
                
                elapsed_time = time.time() - start_time
                file_size = os.path.getsize(output_path) / 1024
                print(f"Model saved to {output_path} ({file_size:.2f} KB)")
                print(f"Job completed in {elapsed_time:.2f} seconds")
                
                return True
                
            elif status == "failed":
                # Job failed
                error = status_data.get("error", "Unknown error")
                print(f"Job failed: {error}")
                return False
                
            # Still processing, wait and check again
            time.sleep(5)
            
        print(f"Timeout after {max_attempts} attempts")
        return False
    except Exception as e:
        print(f"Error testing asynchronous API: {e}")
        return False

def test_health(server_url):
    """Test the health check endpoint"""
    try:
        print("\n=== Testing Health Check ===")
        print(f"Server URL: {server_url}")
        
        response = requests.get(f"{server_url}/health")
        
        if not response.ok:
            print(f"Error: {response.status_code} - {response.text}")
            return False
        
        health_data = response.json()
        print(f"Health check successful: {json.dumps(health_data, indent=2)}")
        
        return True
    except Exception as e:
        print(f"Error testing health check: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Test the Hunyuan3D direct API server")
    parser.add_argument("--url", type=str, default="http://localhost:8000", help="Server URL")
    parser.add_argument("--image", type=str, required=True, help="Path to the image file")
    parser.add_argument("--caption", type=str, default="", help="Optional caption for the image")
    parser.add_argument("--mode", type=str, default="both", choices=["sync", "async", "both", "health"], 
                       help="Test mode: sync, async, both, or health")
    
    args = parser.parse_args()
    
    # Check if the image file exists
    if not os.path.isfile(args.image):
        print(f"Error: Image file '{args.image}' not found")
        return 1
    
    # Test based on the selected mode
    if args.mode == "sync" or args.mode == "both":
        test_sync_api(args.url, args.image, args.caption)
        
    if args.mode == "async" or args.mode == "both":
        test_async_api(args.url, args.image, args.caption)
        
    if args.mode == "health" or args.mode == "both":
        test_health(args.url)
    
    return 0

if __name__ == "__main__":
    exit(main()) 