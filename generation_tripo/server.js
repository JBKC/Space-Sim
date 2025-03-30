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
const TRIPO_API_URL = 'https://platform.tripo3d.ai/api/v1/generation';

console.log('-------------------------------------------');
console.log('TRIPO3D MODEL GENERATOR SERVER');
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Static file serving - IMPORTANT: This must come after other middleware
app.use(express.static(__dirname));

// API routes
app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log(`📤 TRIPO GENERATION: File received: ${req.file.originalname} (${req.file.size} bytes)`);
        
        try {
            // Read file data and convert to base64
            const fileData = fs.readFileSync(req.file.path);
            const base64Image = fileData.toString('base64');
            console.log(`📤 TRIPO GENERATION: Converted image to base64 (${base64Image.length} chars)`);
            
            // Log the API key (first few characters only)
            const maskedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND';
            console.log(`📤 TRIPO GENERATION: Using Tripo3D API key: ${maskedKey}`);
            
            // Create proper JSON payload according to Tripo3D API docs
            const payload = {
                image: base64Image,
                remove_background: true // Optional - remove background from image
            };
            
            console.log(`📤 TRIPO GENERATION: Sending request directly to Tripo3D API: ${TRIPO_API_URL}`);
            console.log(`📤 TRIPO GENERATION: Payload includes image of ${base64Image.length} chars and remove_background=${payload.remove_background}`);
            
            // Send the request with JSON payload
            const response = await axios.post(TRIPO_API_URL, 
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY
                    },
                    timeout: 60000 // 60 second timeout
                }
            );
            
            // Log response details for debugging
            console.log(`📥 TRIPO RESPONSE: Status: ${response.status}`);
            
            if (response.status === 200 || response.status === 201 || response.status === 202) {
                // Success! Get the task ID from the response
                const data = response.data;
                console.log(`📥 TRIPO RESPONSE: Data: ${JSON.stringify(data, null, 2)}`);
                
                // Extract task ID or job ID from response
                const taskId = data.task_id || data.job_id || data.id;
                
                if (taskId) {
                    console.log(`📥 TRIPO RESPONSE: Task ID: ${taskId}`);
                    res.json({ 
                        success: true, 
                        message: 'Model generation started', 
                        taskId: taskId 
                    });
                } else {
                    console.error('📥 TRIPO RESPONSE ERROR: No task ID found in response');
                    res.status(500).json({ 
                        success: false, 
                        error: 'No task ID found in response', 
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

// Status check endpoint
app.get('/api/status/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        
        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required' });
        }
        
        console.log(`📊 TRIPO STATUS CHECK: Checking status for task: ${taskId}`);
        
        // Call Tripo3D API to check status
        const response = await axios.get(`${TRIPO_API_URL}/status/${taskId}`, {
            headers: {
                'x-api-key': API_KEY
            }
        });
        
        console.log(`📊 TRIPO STATUS CHECK: Response status: ${response.status}`);
        console.log(`📊 TRIPO STATUS CHECK: Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        // Parse response based on documented API structure
        const data = response.data;
        let status = data.status || 'unknown';
        let modelUrl = null;
        let message = data.message || '';
        
        // Check if model is done and extract model URL
        if (status === 'completed' || status === 'done' || status === 'success') {
            modelUrl = data.model_url || data.url || null;
            
            if (!modelUrl && data.result) {
                modelUrl = data.result.model_url || data.result.url || null;
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
        else if (status === 'failed' || status === 'error') {
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
            return res.json({
                success: true,
                status: status,
                message: message || 'Processing'
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

// Catch-all route to serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    // Log API key status
    if (API_KEY) {
        console.log('✅ API Key: Found in environment variables');
    } else {
        console.log('⚠️ WARNING: Tripo3D API Key not found! Set TRIPO_API_KEY in your .env file');
    }
    
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log('Try accessing:');
    console.log(`  - Homepage: http://localhost:${port}/`);
    console.log(`  - Health check: http://localhost:${port}/health`);
}); 