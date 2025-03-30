require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 8000;

// API Key from .env file
const API_KEY = process.env.TRIPO_API_KEY;
// Updated API endpoint based on documentation
const TRIPO_API_URL = 'https://platform.tripo3d.ai/api/v1';

console.log('-------------------------------------------');
console.log('TRIPO3D MODEL GENERATOR SERVER');
console.log('-------------------------------------------');
console.log(`API Key loaded: ${API_KEY ? 'YES' : 'NO'}`);
console.log(`API Endpoint: ${TRIPO_API_URL}`);
console.log(`Server Port: ${port}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Script directory: ${__dirname}`);
console.log('-------------------------------------------');

// CORS middleware with more specific configuration
app.use(cors({
    origin: '*', // Allow any origin
    methods: ['GET', 'POST', 'OPTIONS'], // Allow these methods
    allowedHeaders: ['Content-Type', 'x-api-key', 'Origin', 'Accept'], // Allow these headers
    exposedHeaders: ['Content-Disposition'] // Expose these headers for downloads
}));

// Other middleware
app.use(express.json({ limit: '50mb' }));

// Serve static files from current directory - fix the path issue
const staticDir = path.resolve(__dirname);
console.log(`📂 Serving static files from: ${staticDir}`);
app.use(express.static(staticDir));

// Set up multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Ensure the uploads directory exists
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Root route handler - serve the index.html file with absolute path
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    console.log(`📄 Serving index.html from: ${indexPath}`);
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error(`❌ ERROR: index.html not found at ${indexPath}`);
        res.status(404).send('index.html not found');
    }
});

// Create endpoint for 3D model generation
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
            
            // Create base payload for all attempts
            const payload = {
                image: base64Image,
                remove_background: true
            };
            
            // Array of approaches to try
            const approaches = [
                {
                    endpoint: `${TRIPO_API_URL}/image-to-model`,
                    method: 'post',
                    headers: {
                        'x-api-key': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    data: payload
                },
                {
                    endpoint: `${TRIPO_API_URL}/generation/image-to-model`,
                    method: 'post',
                    headers: {
                        'x-api-key': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    data: payload
                },
                {
                    endpoint: `${TRIPO_API_URL}/models/generate`,
                    method: 'post',
                    headers: {
                        'x-api-key': API_KEY,
                        'Content-Type': 'application/json'
                    },
                    data: payload
                }
            ];
            
            let lastError = null;
            
            // Try each approach in sequence until one works
            for (const approach of approaches) {
                try {
                    console.log(`📤 TRIPO GENERATION: Trying endpoint: ${approach.endpoint}`);
                    
                    const response = await axios({
                        method: approach.method,
                        url: approach.endpoint,
                        headers: approach.headers,
                        data: approach.data,
                        timeout: 60000 // 60 second timeout
                    });
                    
                    // If we get here, the request succeeded
                    console.log(`📥 TRIPO RESPONSE: Status: ${response.status}`);
                    
                    if (response.status === 200 || response.status === 201 || response.status === 202) {
                        // Success! Get the task ID from the response
                        const data = response.data;
                        console.log(`📥 TRIPO RESPONSE: Data: ${JSON.stringify(data, null, 2)}`);
                        
                        // Extract task ID or job ID from response
                        const taskId = data.task_id || data.job_id || data.id || data.requestId;
                        
                        if (taskId) {
                            console.log(`📥 TRIPO RESPONSE: Task ID: ${taskId}`);
                            return res.json({ 
                                success: true, 
                                message: 'Model generation started', 
                                taskId: taskId 
                            });
                        } else {
                            console.error('📥 TRIPO RESPONSE ERROR: No task ID found in response');
                            // Keep trying other approaches
                            lastError = { 
                                error: 'No task ID found in response', 
                                details: data 
                            };
                        }
                    } else {
                        console.error(`📥 TRIPO RESPONSE ERROR: API request failed: ${response.status}, ${response.statusText}`);
                        // Keep trying other approaches
                        lastError = { 
                            error: 'API request failed', 
                            details: response.data 
                        };
                    }
                } catch (error) {
                    // Log error and try next approach
                    console.error(`📥 TRIPO RESPONSE ERROR with endpoint ${approach.endpoint}:`, error.message);
                    
                    if (error.response) {
                        lastError = {
                            error: `API Error: ${error.response.status}`,
                            details: error.response.data || {}
                        };
                    } else {
                        lastError = {
                            error: error.message,
                            details: {}
                        };
                    }
                }
            }
            
            // If we get here, all approaches failed
            console.error('📥 TRIPO RESPONSE ERROR: All API approaches failed');
            res.status(500).json({ 
                success: false, 
                error: lastError?.error || 'All API approaches failed',
                details: lastError?.details || {}
            });
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
        
        // Array of status endpoints to try
        const statusEndpoints = [
            `${TRIPO_API_URL}/image-to-model/status/${taskId}`,
            `${TRIPO_API_URL}/generation/image-to-model/status/${taskId}`,
            `${TRIPO_API_URL}/models/status/${taskId}`
        ];
        
        let lastError = null;
        
        // Try each endpoint in sequence
        for (const endpoint of statusEndpoints) {
            try {
                console.log(`📊 TRIPO STATUS CHECK: Trying endpoint: ${endpoint}`);
                
                const response = await axios.get(endpoint, {
                    headers: {
                        'x-api-key': API_KEY
                    }
                });
                
                console.log(`📊 TRIPO STATUS CHECK: Response status: ${response.status}`);
                
                // Process successful response
                if (response.status === 200) {
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
                            lastError = {
                                status: 'error',
                                error: 'Model URL not found in completed response'
                            };
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
                }
            } catch (error) {
                // Log error and try next endpoint
                console.error(`📊 TRIPO STATUS CHECK ERROR with endpoint ${endpoint}:`, error.message);
                
                if (error.response) {
                    lastError = {
                        status: 'error',
                        error: `API Error: ${error.response.status}`,
                        details: error.response.data
                    };
                } else {
                    lastError = {
                        status: 'error',
                        error: error.message
                    };
                }
            }
        }
        
        // If we get here, all endpoints failed
        console.error('📊 TRIPO STATUS CHECK ERROR: All status endpoints failed');
        
        // Return the last error we got
        return res.status(500).json({
            success: false,
            ...lastError
        });
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

// Start the server
app.listen(port, () => {
    // Log API key status
    if (API_KEY) {
        console.log('✅ API Key: Found in environment variables');
    } else {
        console.log('⚠️ WARNING: Tripo3D API Key not found! Set TRIPO_API_KEY in your .env file');
    }
    
    // List files in the directory to check if everything is in place
    console.log('📁 Files in directory:');
    try {
        const files = fs.readdirSync(__dirname);
        files.forEach(file => {
            const stats = fs.statSync(path.join(__dirname, file));
            if (stats.isFile()) {
                console.log(`📄 ${file}`);
            } else if (stats.isDirectory()) {
                console.log(`📁 ${file}/`);
            }
        });
    } catch (err) {
        console.error('❌ Error listing files:', err);
    }
    
    console.log(`🚀 Server running at http://localhost:${port}`);
}); 