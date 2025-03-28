import express from 'express';
import fileUpload from 'express-fileupload';
import { client } from '@gradio/client';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fetch from 'node-fetch';

// Create a global implementation of fetch for Node.js environments
global.fetch = fetch;

// Create a polyfill for window object for gradio client
global.window = {
  location: {
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost'
  },
  navigator: {
    userAgent: 'Node.js'
  }
};

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Verify API key is present
if (!process.env.HUGGINGFACE_API_KEY) {
  console.error('ERROR: HUGGINGFACE_API_KEY is not set in .env file');
  process.exit(1);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
const io = new Server(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'models')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Simple test endpoint to check if server is running
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test mode endpoint - simulates the generation process without calling the API
app.post('/api/generate-test', async (req, res) => {
  const requestId = Date.now().toString();
  console.log(`[${requestId}] 📤 Received test generate request`);
  io.emit('status', { requestId, status: 'received', message: 'Test request received' });
  
  try {
    // Validate request has files
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log(`[${requestId}] ❌ No files uploaded`);
      io.emit('status', { requestId, status: 'error', message: 'No files were uploaded' });
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const image = req.files.image;
    const caption = req.body.caption || '';
    
    // Log file details
    console.log(`[${requestId}] 📁 File details:`, {
      name: image.name,
      size: (image.size / 1024).toFixed(2) + ' KB',
      mimetype: image.mimetype
    });
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: `Processing image: ${image.name} (${(image.size / 1024).toFixed(2)} KB)`,
      progress: 10
    });
    
    // Save the uploaded image
    const uploadPath = path.join(uploadsDir, image.name);
    await image.mv(uploadPath);
    
    console.log(`[${requestId}] 💾 Image saved at: ${uploadPath}`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: 'Image saved successfully',
      progress: 20 
    });
    
    // Simulate API connection
    console.log(`[${requestId}] 🔌 [TEST MODE] Connecting to Hunyuan3D-2 API...`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: '[TEST MODE] Connecting to Hunyuan3D API...',
      progress: 30
    });
    
    // Simulate API connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[${requestId}] ✅ [TEST MODE] Connected to API successfully`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: '[TEST MODE] Connected to API successfully',
      progress: 40
    });
    
    // Simulate model generation
    console.log(`[${requestId}] 🚀 [TEST MODE] Starting 3D model generation...`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: '[TEST MODE] Starting 3D model generation...',
      progress: 50
    });
    
    // Simulate parameters
    console.log(`[${requestId}] 📨 [TEST MODE] Sending request to API...`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: '[TEST MODE] Sending request to API with parameters:',
      details: {
        caption,
        steps: 20,
        guidance_scale: 5,
        octree_resolution: 128,
        check_box_rembg: true,
        num_chunks: 4000,
        randomize_seed: true
      },
      progress: 60
    });
    
    // Simulate model generation delay (3-5 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    
    // Find a sample model in models directory
    const sampleModels = fs.readdirSync(modelsDir);
    let modelFileName;
    
    if (sampleModels.length > 0) {
      // Use an existing model
      modelFileName = sampleModels[0];
      console.log(`[${requestId}] ✅ [TEST MODE] Using existing model: ${modelFileName}`);
    } else {
      // No sample models available
      console.log(`[${requestId}] ❌ [TEST MODE] No sample models available`);
      throw new Error('No sample models available for test mode');
    }
    
    console.log(`[${requestId}] ✅ [TEST MODE] Model generation completed`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: `[TEST MODE] Model generation completed`,
      progress: 80
    });
    
    // Simulate model stats
    const stats = {
      vertices: Math.floor(10000 + Math.random() * 5000),
      faces: Math.floor(5000 + Math.random() * 3000),
      materials: Math.floor(1 + Math.random() * 5),
      textures: Math.floor(1 + Math.random() * 3)
    };
    
    console.log(`[${requestId}] 📊 [TEST MODE] Model stats:`, stats);
    io.emit('status', { 
      requestId, 
      status: 'complete', 
      message: '[TEST MODE] Model generation complete!',
      progress: 100,
      data: {
        modelPath: `/models/${modelFileName}`,
        stats: stats
      }
    });
    
    // Ensure content type is set to application/json
    res.setHeader('Content-Type', 'application/json');
    
    // Return the paths to the frontend as JSON
    return res.json({
      modelPath: `/models/${modelFileName}`,
      stats: stats
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ [TEST MODE] Error:`, error);
    io.emit('status', { 
      requestId, 
      status: 'error', 
      message: `[TEST MODE] Error: ${error.message}`,
      progress: 0
    });
    
    // Ensure content type is set to application/json
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(500).json({ 
      error: 'Test mode error', 
      details: error.message 
    });
  }
});

// For testing: serve a dummy model
app.get('/api/dummy-model', (req, res) => {
  // Return a path to a demo model (if one exists)
  const demoModels = fs.readdirSync(modelsDir);
  if (demoModels.length > 0) {
    res.json({ modelPath: `/models/${demoModels[0]}`, stats: { vertices: 1000, faces: 500 } });
  } else {
    res.status(404).json({ error: 'No dummy models available' });
  }
});

// Route to handle file upload and 3D model generation
app.post('/api/generate', async (req, res) => {
  const requestId = Date.now().toString();
  console.log(`[${requestId}] 📤 Received generate request`);
  io.emit('status', { requestId, status: 'received', message: 'Request received' });
  
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log(`[${requestId}] ❌ No files uploaded`);
      io.emit('status', { requestId, status: 'error', message: 'No files were uploaded' });
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const image = req.files.image;
    const caption = req.body.caption || '';
    
    // Log file details
    console.log(`[${requestId}] 📁 File details:`, {
      name: image.name,
      size: (image.size / 1024).toFixed(2) + ' KB',
      mimetype: image.mimetype
    });
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: `Processing image: ${image.name} (${(image.size / 1024).toFixed(2)} KB)`,
      progress: 10
    });
    
    // Save the uploaded image
    const uploadPath = path.join(uploadsDir, image.name);
    await image.mv(uploadPath);
    
    console.log(`[${requestId}] 💾 Image saved at: ${uploadPath}`);
    io.emit('status', { 
      requestId, 
      status: 'processing', 
      message: 'Image saved successfully',
      progress: 20 
    });
    
    try {
      // Connect to the Hunyuan3D-2 API
      console.log(`[${requestId}] 🔌 Connecting to Hunyuan3D-2 API...`);
      io.emit('status', { 
        requestId, 
        status: 'processing', 
        message: 'Connecting to Hunyuan3D API...',
        progress: 30
      });
      
      // Using client from gradio (lowercase)
      console.log(`[${requestId}] 🔑 Using API key:`, process.env.HUGGINGFACE_API_KEY.substring(0, 5) + '...');
      const gradioClient = await client("tencent/Hunyuan3D-2", {
        hf_token: process.env.HUGGINGFACE_API_KEY,
        timeout_seconds: 120, // Increase timeout to 2 minutes
        max_workers: 1 // Limit number of concurrent workers
      });
      
      console.log(`[${requestId}] ✅ Connected to API successfully`);
      io.emit('status', { 
        requestId, 
        status: 'processing', 
        message: 'Connected to API successfully',
        progress: 40
      });
      
      // Call the API with the image file
      console.log(`[${requestId}] 🚀 Starting 3D model generation...`);
      io.emit('status', { 
        requestId, 
        status: 'processing', 
        message: 'Starting 3D model generation...',
        progress: 50
      });
      
      // Create a file object for the API
      const fileData = fs.readFileSync(uploadPath);
      console.log(`[${requestId}] 📊 File loaded into memory: ${(fileData.length / 1024).toFixed(2)} KB`);
      
      // Create simplified parameters with fewer options
      console.log(`[${requestId}] 📨 Sending request to API...`);
      io.emit('status', { 
        requestId, 
        status: 'processing', 
        message: 'Sending request to API with parameters:',
        details: {
          caption,
          steps: 20,
          guidance_scale: 5,
          octree_resolution: 128,
          check_box_rembg: true,
          num_chunks: 4000,
          randomize_seed: true
        },
        progress: 60
      });
      
      // Start time for tracking
      const startTime = Date.now();
      
      try {
        // Add retry mechanism
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`[${requestId}] 🔄 API call attempt ${retryCount + 1} of ${maxRetries}`);
            io.emit('status', { 
              requestId, 
              status: 'processing', 
              message: `API call attempt ${retryCount + 1} of ${maxRetries}...`,
              progress: 60 + (retryCount * 5)
            });
            
            result = await gradioClient.predict("/generation_all", {
              caption: caption,
              image: new File([fileData], image.name, { type: image.mimetype }),
              mv_image_front: new File([fileData], image.name, { type: image.mimetype }),
              mv_image_back: new File([fileData], image.name, { type: image.mimetype }),
              mv_image_left: new File([fileData], image.name, { type: image.mimetype }),
              mv_image_right: new File([fileData], image.name, { type: image.mimetype }),
              steps: 20, // Reduced for faster processing
              guidance_scale: 5,
              seed: Math.floor(Math.random() * 1000000),
              octree_resolution: 128, // Lower resolution for faster processing
              check_box_rembg: true,
              num_chunks: 4000, // Reduced for faster processing
              randomize_seed: true
            });
            
            // If we get here, the call succeeded
            break;
          } catch (retryError) {
            retryCount++;
            console.error(`[${requestId}] ⚠️ API call attempt ${retryCount} failed:`, retryError.message);
            
            if (retryCount >= maxRetries) {
              // We've exhausted our retries
              throw new Error(`API failed after ${maxRetries} attempts: ${retryError.message}`);
            }
            
            // Wait before retrying (exponential backoff: 2s, 4s, 8s...)
            const delay = 2000 * Math.pow(2, retryCount - 1);
            console.log(`[${requestId}] 🕒 Waiting ${delay/1000}s before retry ${retryCount + 1}...`);
            io.emit('status', { 
              requestId, 
              status: 'processing', 
              message: `API call failed. Retrying in ${delay/1000}s (attempt ${retryCount + 1} of ${maxRetries})`,
              progress: 60 + (retryCount * 5)
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      
        // Calculate processing time
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[${requestId}] ✅ Model generation completed in ${processingTime} seconds`);
        io.emit('status', { 
          requestId, 
          status: 'processing', 
          message: `Model generation completed in ${processingTime}s`,
          progress: 80
        });
      
        // Save the generated model
        const modelData = result.data[0]; // GLB file
        const statsData = result.data[3]; // Model stats
      
        if (!modelData) {
          throw new Error('No model data returned from API');
        }
        
        // Generate a unique filename
        const timestamp = Date.now();
        const modelFileName = `model_${timestamp}.glb`;
        const modelPath = path.join(modelsDir, modelFileName);
        
        // Save the model to disk
        const modelBuffer = Buffer.from(await modelData.arrayBuffer());
        fs.writeFileSync(modelPath, modelBuffer);
        console.log(`[${requestId}] 💾 Model saved to ${modelPath} (${(modelBuffer.length / 1024).toFixed(2)} KB)`);
        io.emit('status', { 
          requestId, 
          status: 'processing', 
          message: `Model saved (${(modelBuffer.length / 1024).toFixed(2)} KB)`,
          progress: 90
        });
        
        // Model statistics
        if (statsData) {
          console.log(`[${requestId}] 📊 Model stats:`, statsData);
        }
        
        // Notify client of success
        io.emit('status', { 
          requestId, 
          status: 'complete', 
          message: 'Model generation complete!',
          progress: 100,
          data: {
            modelPath: `/models/${modelFileName}`,
            stats: statsData
          }
        });
        
        // Return the paths to the frontend
        res.json({
          modelPath: `/models/${modelFileName}`,
          stats: statsData
        });
      } catch (innerApiError) {
        console.error(`[${requestId}] ❌ API Error Details:`, innerApiError);
        console.error(`[${requestId}] ❌ API Error Stack:`, innerApiError.stack);
        throw innerApiError;
      }
    } catch (apiError) {
      console.error(`[${requestId}] ❌ API Error:`, apiError);
      io.emit('status', { 
        requestId, 
        status: 'error', 
        message: `API Error: ${apiError.message || 'Unknown error'}`,
        progress: 0
      });
      res.status(500).json({ 
        error: 'Failed to generate 3D model from API', 
        details: apiError.message || 'Unknown error' 
      });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Server Error:`, error);
    io.emit('status', { 
      requestId, 
      status: 'error', 
      message: `Server Error: ${error.message}`,
      progress: 0
    });
    res.status(500).json({ 
      error: 'Server error processing request', 
      details: error.message 
    });
  }
});

// File class polyfill for Node.js
if (typeof global.File === 'undefined') {
  class File {
    constructor(bits, filename, options = {}) {
      this.bits = bits;
      this.name = filename;
      this.type = options.type || '';
      this.size = bits.reduce((acc, bit) => acc + bit.length, 0);
      this.lastModified = options.lastModified || Date.now();
    }
    
    async arrayBuffer() {
      return Buffer.concat(this.bits).buffer;
    }
    
    async text() {
      return Buffer.concat(this.bits).toString('utf-8');
    }
  }
  
  global.File = File;
}

// Default route to serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
server.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`🔑 HF API Key configured: ${process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No'}`);
});