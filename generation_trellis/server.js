require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// API Key from .env file
const API_KEY = process.env.TRELLIS_API_KEY;
const API_URL = 'https://api.piapi.ai/api/v1/task';

// CORS middleware with more specific configuration
app.use(cors({
    origin: '*', // Allow any origin
    methods: ['GET', 'POST', 'OPTIONS'], // Allow these methods
    allowedHeaders: ['Content-Type', 'x-api-key', 'Origin', 'Accept'], // Allow these headers
    exposedHeaders: ['Content-Disposition'] // Expose these headers for downloads
}));

// Other middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Set up multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Routes
app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        console.log('Received image file:', req.file.originalname);
        
        // Convert image to base64
        const base64Image = req.file.buffer.toString('base64');
        console.log('Image converted to base64');

        // Call the Trellis API
        console.log('Sending request to Trellis API...');
        console.log('Using API key:', API_KEY ? 'Key found' : 'Key not found');
        
        const requestBody = {
            model: 'Qubico/trellis',
            task_type: 'image-to-3d',
            input: {
                image: base64Image
            }
        };
        
        console.log('Request structure:', JSON.stringify({
            ...requestBody,
            input: { image: '[BASE64_IMAGE_DATA]' } // Log structure without actual image data
        }));
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            return res.status(response.status).json({ 
                error: `API Error: ${response.status}`,
                details: errorText
            });
        }

        const rawResponse = await response.text();
        console.log('Trellis API Raw Response (text):', rawResponse);
        
        // Parse the response as JSON
        let rawData;
        try {
            rawData = JSON.parse(rawResponse);
            console.log('Trellis API Raw Response (parsed):', JSON.stringify(rawData, null, 2));
        } catch (error) {
            console.error('Error parsing API response as JSON:', error);
            return res.status(500).json({
                error: 'Failed to parse API response',
                details: error.message,
                rawResponse: rawResponse
            });
        }
        
        // Extract data from the nested structure according to the specific format we're seeing
        let result = {};
        
        // Direct support for the structure we're seeing: {"code":200,"data":{...},"message":"success"}
        if (rawData.code === 200 && rawData.data) {
            console.log('Found nested response structure with code:200 and data property');
            
            // Extract task_id from the nested structure
            if (rawData.data.task_id) {
                result.task_id = rawData.data.task_id;
                console.log('Extracted task_id from nested data:', result.task_id);
            } else if (rawData.data.id) {
                result.task_id = rawData.data.id;
                console.log('Using id as task_id from nested data:', result.task_id);
            } else {
                console.error('No task_id or id found in nested data structure:', rawData);
                return res.status(400).json({
                    error: 'API response missing task_id',
                    details: 'The API response does not contain a task_id or id field in the expected nested structure',
                    rawResponse: rawData
                });
            }
            
            // Copy other relevant fields
            if (rawData.data.status) result.status = rawData.data.status;
            if (rawData.data.output) result.output = rawData.data.output;
            
        } else {
            // Use the raw data as is (fallback for other structures)
            console.log('Using non-nested response structure');
            result = rawData;
            
            // Check if task_id is present
            if (!result.task_id && result.id) {
                result.task_id = result.id;
                console.log('Using id as task_id:', result.task_id);
            }
        }
        
        // Double-check that we have a task_id
        if (!result.task_id) {
            console.error('No task_id found in any field of the response:', rawData);
            
            // Return the raw response for debugging
            return res.status(400).json({ 
                error: 'No task ID found in response',
                details: 'The API response does not contain a task_id field in the expected structure',
                rawResponse: rawData,
                // Also send the original structure in case the client wants to process it differently
                originalResponse: rawData
            });
        }
        
        console.log('Sending final response to client:', result);
        res.json(result);
    } catch (error) {
        console.error('Error generating model:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.get('/api/status/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        
        if (!taskId) {
            return res.status(400).json({ error: 'No task ID provided' });
        }

        console.log('Checking status for task:', taskId);
        
        // The API URL format appears to be different for status checks
        // Let's try the correct URL format by appending the task_id to the path
        const statusUrl = `${API_URL}/${taskId}`;
        console.log('Status check URL:', statusUrl);
        
        const response = await fetch(statusUrl, {
            method: 'GET',
            headers: {
                'x-api-key': API_KEY
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Status check API Error:', response.status, errorText);
            return res.status(response.status).json({ 
                error: `API Error: ${response.status}`,
                details: errorText
            });
        }

        const rawResponse = await response.text();
        console.log('Status raw response (text):', rawResponse);
        
        // Parse the response
        let rawData;
        try {
            rawData = JSON.parse(rawResponse);
            console.log('Status raw response (parsed):', JSON.stringify(rawData, null, 2));
        } catch (error) {
            console.error('Error parsing status response as JSON:', error);
            return res.status(500).json({
                error: 'Failed to parse status API response',
                details: error.message,
                rawResponse: rawResponse
            });
        }
        
        // Extract data from the nested structure
        let result = {};
        
        // Check for the nested structure pattern shown in the error
        if (rawData.code === 200 && rawData.data) {
            console.log('Found nested response structure in status check');
            
            // Copy relevant fields from the nested structure
            if (rawData.data.status) result.status = rawData.data.status;
            if (rawData.data.output) result.output = rawData.data.output;
            if (rawData.data.task_id) result.task_id = rawData.data.task_id;
        } else {
            // Use the raw data as is
            console.log('Using non-nested status response structure');
            result = rawData;
        }
        
        // Pass along the original response for potential client-side processing
        result.originalResponse = rawData;
        
        console.log('Sending processed status response to client:', result);
        res.json(result);
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// For backwards compatibility, keep the old query parameter endpoint too
app.get('/api/status', async (req, res) => {
    try {
        const taskId = req.query.taskId;
        
        if (!taskId) {
            return res.status(400).json({ error: 'No task ID provided' });
        }
        
        console.log('Using deprecated query parameter endpoint for task:', taskId);
        // Redirect to the new endpoint format
        res.redirect(`/api/status/${taskId}`);
    } catch (error) {
        console.error('Error in deprecated status endpoint:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Proxy endpoint to fetch model files - this prevents CORS issues
app.get('/api/proxy-model', async (req, res) => {
    try {
        const modelUrl = req.query.url;
        
        if (!modelUrl) {
            return res.status(400).json({ error: 'No model URL provided' });
        }

        console.log('Proxying model file from:', modelUrl);
        
        // Fetch the model file
        const response = await fetch(modelUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            console.error('Error fetching model file:', response.status);
            return res.status(response.status).json({ 
                error: 'Error fetching model file',
                details: `Status code: ${response.status}`
            });
        }

        // Get the file as an array buffer (binary data)
        const modelBuffer = await response.arrayBuffer();
        
        // Set the appropriate content type for GLB files
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Disposition', 'attachment; filename="model.glb"');
        
        // Send the binary data
        res.send(Buffer.from(modelBuffer));
    } catch (error) {
        console.error('Error proxying model file:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Catch-all route for API endpoints to prevent returning HTML for 404s
app.all('/api/*', (req, res) => {
    console.log('Unhandled API route:', req.path);
    res.status(404).json({ 
        error: 'Not Found', 
        details: `The requested endpoint ${req.path} does not exist`,
        note: 'For status checks, use /api/status/{taskId} (path parameter)'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API Key: ${API_KEY ? 'Found' : 'Not found'} in environment variables`);
}); 