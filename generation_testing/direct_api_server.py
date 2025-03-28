#!/usr/bin/env python3
# coding=utf-8
# Copyright 2023 Tencent and The HuggingFace Inc. team. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Direct Hunyuan3D API Server based on the official worker code
# This is a FastAPI server that implements the /generate, /send, and /status endpoints

import asyncio
import base64
import io
import json
import logging
import os
import random
import threading
import time
import traceback
import uuid
from threading import Thread
from typing import Dict, List, Optional, Union

import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from huggingface_hub import InferenceClient
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('hunyuan3d_server.log')
    ]
)
logger = logging.getLogger(__name__)

# Configuration
HUGGINGFACE_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")
HUNYUAN3D_MODEL_ENDPOINT = "https://api-inference.huggingface.co/models/Tencent/Hunyuan3D-2"

app = FastAPI(title="Hunyuan3D API Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# In-memory job storage
jobs = {}

class Hunyuan3DClient:
    """Client for interacting with the Hunyuan3D model"""
    
    def __init__(self, api_key=None, model_endpoint=None):
        self.api_key = api_key or HUGGINGFACE_API_KEY
        self.model_endpoint = model_endpoint or HUNYUAN3D_MODEL_ENDPOINT
        self.client = InferenceClient(self.model_endpoint, token=self.api_key)
        logger.info(f"Initialized Hunyuan3D client with endpoint: {self.model_endpoint}")
    
    async def generate_3d_model(self, image_data, caption="", seed=None, 
                               octree_resolution=128, num_inference_steps=20, 
                               guidance_scale=5.0, mc_algo="mc", texture=False, 
                               output_type="glb"):
        """Generate 3D model from image"""
        if not self.api_key:
            raise ValueError("HUGGINGFACE_API_KEY is not set")
        
        try:
            logger.info(f"Starting 3D model generation with params: caption='{caption}', steps={num_inference_steps}")
            
            # Prepare parameters for the API call
            parameters = {
                "caption": caption,
                "steps": num_inference_steps,
                "guidance_scale": guidance_scale,
                "octree_resolution": octree_resolution,
                "check_box_rembg": True,  # Enable background removal
                "num_chunks": 4000,
                "randomize_seed": True if seed is None else False,
            }
            
            if seed is not None:
                parameters["seed"] = seed
            
            # Call the Hunyuan3D API
            logger.info("Calling Hunyuan3D API...")
            response = await run_in_threadpool(
                lambda: self.client.post(
                    data={"data": [image_data, parameters, output_type]},
                    model_kwargs={"wait_for_model": True}
                )
            )
            
            logger.info("Received response from Hunyuan3D API")
            return response
            
        except Exception as e:
            error_msg = f"Error generating 3D model: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            raise Exception(error_msg)

# Create a client instance
hunyuan3d_client = Hunyuan3DClient()

class GenerateRequest(BaseModel):
    image: str  # Base64 encoded image
    caption: Optional[str] = ""
    seed: Optional[int] = None
    octree_resolution: Optional[int] = 128
    num_inference_steps: Optional[int] = 20
    guidance_scale: Optional[float] = 5.0
    mc_algo: Optional[str] = "mc"
    texture: Optional[bool] = False
    type: Optional[str] = "glb"  # glb, obj, ply

class JobStatus(BaseModel):
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    model_base64: Optional[str] = None
    error: Optional[str] = None

# Synchronous generation endpoint
@app.post("/generate")
async def generate_model(request: GenerateRequest):
    """Generate 3D model synchronously"""
    try:
        logger.info("Received synchronous generation request")
        
        # Decode the base64 image
        image_data = base64.b64decode(request.image)
        
        # Generate the 3D model
        model_data = await hunyuan3d_client.generate_3d_model(
            image_data=image_data,
            caption=request.caption,
            seed=request.seed,
            octree_resolution=request.octree_resolution,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            mc_algo=request.mc_algo,
            texture=request.texture,
            output_type=request.type
        )
        
        # Return the model data directly as binary
        logger.info("Returning generated model")
        return Response(content=model_data, media_type="application/octet-stream")
    
    except Exception as e:
        logger.error(f"Error in synchronous generation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Asynchronous generation endpoint - send job
@app.post("/send")
async def send_job(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Start an asynchronous 3D model generation job"""
    try:
        # Generate a unique ID for this job
        job_id = str(uuid.uuid4())
        logger.info(f"Received async generation request - assigned job ID: {job_id}")
        
        # Store initial job status
        jobs[job_id] = {
            "status": "queued",
            "progress": 0,
            "message": "Job queued for processing",
            "created_at": time.time(),
            "request": request.dict()
        }
        
        # Start the generation in a background task
        background_tasks.add_task(process_job, job_id, request)
        
        # Return the job ID
        return {"uid": job_id, "status": "queued"}
    
    except Exception as e:
        logger.error(f"Error sending job: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Background job processing function
async def process_job(job_id: str, request: GenerateRequest):
    """Process a 3D model generation job in the background"""
    try:
        logger.info(f"Starting processing for job {job_id}")
        
        # Update job status to processing
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = 10
        jobs[job_id]["message"] = "Starting model generation"
        
        # Decode the base64 image
        image_data = base64.b64decode(request.image)
        
        # Generate the 3D model
        jobs[job_id]["progress"] = 30
        jobs[job_id]["message"] = "Calling Hunyuan3D API"
        
        model_data = await hunyuan3d_client.generate_3d_model(
            image_data=image_data,
            caption=request.caption,
            seed=request.seed,
            octree_resolution=request.octree_resolution,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            mc_algo=request.mc_algo,
            texture=request.texture,
            output_type=request.type
        )
        
        # Encode the model data as base64
        jobs[job_id]["progress"] = 80
        jobs[job_id]["message"] = "Processing model data"
        
        model_base64 = base64.b64encode(model_data).decode('utf-8')
        
        # Update job status to completed
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["message"] = "Model generation completed"
        jobs[job_id]["model_base64"] = model_base64
        jobs[job_id]["completed_at"] = time.time()
        
        logger.info(f"Completed job {job_id} successfully")
        
    except Exception as e:
        error_msg = f"Error processing job {job_id}: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        
        # Update job status to failed
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["progress"] = 0
        jobs[job_id]["message"] = "Model generation failed"
        jobs[job_id]["error"] = error_msg

# Get job status endpoint
@app.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
    
    job = jobs[job_id]
    
    # Return relevant job information
    return JobStatus(
        status=job["status"],
        progress=job.get("progress"),
        message=job.get("message"),
        model_base64=job.get("model_base64") if job["status"] == "completed" else None,
        error=job.get("error")
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "api_key_configured": bool(HUGGINGFACE_API_KEY)}

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Hunyuan3D Direct API Server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the server on")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    
    args = parser.parse_args()
    
    logger.info(f"Starting Hunyuan3D API Server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port) 