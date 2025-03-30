require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 8000;

// API Key from .env file
const API_KEY = process.env.TRIPO_API_KEY;
const TRIPO_API_URL = 'https://api.tripo3d.ai/v2/openapi/task';

console.log('-------------------------------------------');
console.log('TRIPO3D MODEL GENERATOR SERVER (v2 API)');
console.log('-------------------------------------------');
console.log(`API Key loaded: ${API_KEY ? 'YES' : 'NO'}`);
console.log(`API Endpoint: ${TRIPO_API_URL}`);
console.log(`Server Port: ${port}`);
console.log('-------------------------------------------');

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit as per API docs
});

// Static file serving - IMPORTANT: This must come after other middleware
// Explicitly serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Root route handler - explicitly serve index.html 
app.get('/', (req, res) => {
    console.log('📄 Serving index.html from:', path.join(__dirname, 'index.html'));
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function to convert a file to base64
function fileToBase64(filePath) {
    return fs.readFileSync(filePath).toString('base64');
}

// API routes
app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log(`📤 TRIPO GENERATION: File received: ${req.file.originalname} (${req.file.size} bytes)`);
        
        try {
            // Prepare the image URL - you can either encode as base64 or use a data URL
            // Since we're using direct file upload in a single request, let's convert to base64
            const imageData = fileToBase64(req.file.path);
            const imageBase64 = `data:${req.file.mimetype};base64,${imageData}`;
            
            // Log masking some of the API key for security
            const maskedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND';
            console.log(`📤 TRIPO GENERATION: Using Tripo3D API key: ${maskedKey}`);
            
            // Create the request payload according to Tripo3D v2 API docs
            const payload = {
                type: "image_to_model",
                model_version: "v2.5-20250123", // Latest version
                file: {
                    type: req.file.mimetype,
                    url: imageBase64
                },
                texture: true,
                pbr: true,
                auto_size: true
            };
            
            console.log(`📤 TRIPO GENERATION: Sending request to Tripo3D API v2: ${TRIPO_API_URL}`);
            console.log(`📤 TRIPO GENERATION: Request type: ${payload.type}, model_version: ${payload.model_version}`);
            
            // Send the request with Bearer token authentication
            const response = await axios.post(TRIPO_API_URL, 
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    timeout: 60000 // 60 second timeout
                }
            );
            
            // Log response details for debugging
            console.log(`📥 TRIPO RESPONSE: Status: ${response.status}`);
            
            if (response.status === 200) {
                // Success! Get the task ID from the response
                const data = response.data;
                console.log(`📥 TRIPO RESPONSE: Data: ${JSON.stringify(data, null, 2)}`);
                
                // Extract task ID from response according to v2 API
                if (data.code === 0 && data.data && data.data.task_id) {
                    const taskId = data.data.task_id;
                    console.log(`📥 TRIPO RESPONSE: Task ID: ${taskId}`);
                    
                    res.json({ 
                        success: true, 
                        message: 'Model generation started', 
                        taskId: taskId 
                    });
                } else {
                    console.error('📥 TRIPO RESPONSE ERROR: No task ID found in response or error code:', data.code);
                    res.status(500).json({ 
                        success: false, 
                        error: data.message || 'No task ID found in response', 
                        details: data 
                    });
                }
            } else {
                console.error(`📥 TRIPO RESPONSE ERROR: API request failed: ${response.status}, ${response.statusText}`);
                res.status(response.status).json({ 
                    success: false, 
                    error: 'API request failed', 
                    details: response.data 
                });
            }
        } catch (error) {
            console.error('📥 TRIPO RESPONSE ERROR: Error calling Tripo3D API:', error);
            let errorMessage = error.message;
            let errorDetails = {};
            
            // Handle axios specific error responses
            if (error.response) {
                // The server responded with a status code outside of 2xx
                console.error(`📥 TRIPO RESPONSE ERROR: API Error Response: ${error.response.status}`, error.response.data);
                errorMessage = `API Error: ${error.response.status}`;
                errorDetails = error.response.data;
            } else if (error.request) {
                // The request was made but no response was received
                console.error('📥 TRIPO RESPONSE ERROR: No response received from API');
                errorMessage = 'No response from Tripo3D API';
            }
            
            res.status(500).json({ 
                success: false, 
                error: errorMessage, 
                details: errorDetails
            });
        }
    } catch (error) {
        console.error('Error in generate endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process request', 
            details: error.message 
        });
    }
});

// Status check endpoint - updated for v2 API
app.get('/api/status/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        
        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required' });
        }
        
        console.log(`📊 TRIPO STATUS CHECK: Checking status for task: ${taskId}`);
        
        // Call Tripo3D API v2 to check status
        const statusUrl = `https://api.tripo3d.ai/v2/openapi/task/${taskId}`;
        const response = await axios.get(statusUrl, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        
        console.log(`📊 TRIPO STATUS CHECK: Response status: ${response.status}`);
        console.log(`📊 TRIPO STATUS CHECK: Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        // Parse response based on v2 API structure
        const apiResponse = response.data;
        
        if (apiResponse.code === 0 && apiResponse.data) {
            const data = apiResponse.data;
            const status = data.status || 'unknown';
            let modelUrl = null;
            const message = data.status_message || '';
            
            // Check if model is done and extract model URL
            if (status === 'succeed') {
                if (data.url && data.url.fbx) {
                    modelUrl = data.url.fbx;
                } else if (data.url && data.url.glb) {
                    modelUrl = data.url.glb;
                } else if (data.urls && data.urls.length > 0) {
                    // Try to find a 3D model URL in the urls array
                    const modelFile = data.urls.find(url => 
                        url.endsWith('.glb') || url.endsWith('.fbx') || url.endsWith('.obj'));
                    if (modelFile) {
                        modelUrl = modelFile;
                    }
                }
                
                if (modelUrl) {
                    console.log(`📊 TRIPO STATUS CHECK: Model completed. URL: ${modelUrl}`);
                    
                    // Return success with model URL
                    return res.json({
                        success: true,
                        status: 'completed',
                        modelUrl: modelUrl
                    });
                } else {
                    console.error('📊 TRIPO STATUS CHECK: Model completed but no URL found in response');
                    return res.json({
                        success: true,
                        status: 'error',
                        error: 'Model URL not found in completed response'
                    });
                }
            } 
            // Check for failure states
            else if (status === 'failed') {
                console.error(`📊 TRIPO STATUS CHECK: Model generation failed: ${message}`);
                return res.json({
                    success: false,
                    status: 'failed',
                    error: message || 'Model generation failed'
                });
            }
            // Still processing
            else {
                console.log(`📊 TRIPO STATUS CHECK: Model generation in progress. Status: ${status}`);
                // Calculate progress if available
                let progress = 0;
                if (data.progress) {
                    progress = parseFloat(data.progress) * 100; // Convert to percentage
                }
                
                return res.json({
                    success: true,
                    status: status,
                    message: message || 'Processing',
                    progress: progress
                });
            }
        } else {
            // API returned an error
            console.error(`📊 TRIPO STATUS CHECK: API returned error code: ${apiResponse.code}`);
            return res.json({
                success: false,
                status: 'error',
                error: apiResponse.message || 'API returned an error'
            });
        }
    } catch (error) {
        console.error('📊 TRIPO STATUS CHECK ERROR:', error.message);
        let errorMessage = error.message;
        let statusCode = 500;
        
        // Handle axios specific errors
        if (error.response) {
            statusCode = error.response.status;
            errorMessage = `API Error: ${statusCode}`;
            console.error('📊 TRIPO STATUS CHECK ERROR: API response error:', error.response.data);
        }
        
        res.status(statusCode).json({
            success: false,
            status: 'error',
            error: errorMessage
        });
    }
});

// Special route to check server health
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Tripo3D server is running' });
});

// Start the server
app.listen(port, () => {
    console.log('-------------------------------------------');
    console.log('TRIPO3D SERVER STARTED SUCCESSFULLY');
    console.log('-------------------------------------------');
    
    // Log API key status
    if (API_KEY) {
        console.log('✅ API Key: Found in environment variables');
    } else {
        console.log('⚠️ WARNING: Tripo3D API Key not found! Set TRIPO_API_KEY in your .env file');
    }
    
    // Log server information
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${path.resolve(__dirname)}`);
    console.log(`📄 Index file: ${path.resolve(__dirname, 'index.html')}`);
    console.log(`🔌 API Endpoint: ${TRIPO_API_URL}`);
    
    // Instructions
    console.log('-------------------------------------------');
    console.log('AVAILABLE ROUTES:');
    console.log(`  Homepage: http://localhost:${port}/`);
    console.log(`  Health check: http://localhost:${port}/health`);
    console.log(`  Generate API: http://localhost:${port}/api/generate`);
    console.log(`  Status API: http://localhost:${port}/api/status/:taskId`);
    console.log('-------------------------------------------');
    console.log('PRESS CTRL+C TO STOP SERVER');
    console.log('-------------------------------------------');
}); 