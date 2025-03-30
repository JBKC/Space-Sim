require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3000;

// API Keys from .env file
const API_KEY = process.env.TRELLIS_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const TRELLIS_BASE_URL = 'https://api.piapi.ai/api/v1';

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

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
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Function to process image with Google Gemini API
async function processImageWithGemini(imageBuffer, customPrompt) {
    try {
        console.log('Processing image with Google Gemini API for image generation');
        
        // Create a base64 representation of the image
        const base64Image = imageBuffer.toString('base64');
        
        // Initialize the Gemini model specifically for image generation
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp-image-generation" // Using the image generation model
        });
        
        // Default prompt for background removal if none provided
        const prompt = customPrompt || "Remove the background and shadows from this object. Create a clean isolated image with a transparent background.";
        
        console.log('Using prompt for Gemini image processing:', prompt);
        
        // Configure generation to specifically request image output
        const generationConfig = {
            temperature: 0.4,
            topK: 32,
            topP: 0.95,
            responseModalities: ["Text", "Image"] // Explicitly request image output
        };
        
        // Create proper content structure with image
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            }],
            generationConfig: generationConfig
        });
        
        console.log('Gemini image generation response received');
        
        // Check for image in response parts
        let processedImageBase64 = null;
        let analysisText = "Image processed successfully";
        
        if (result.response && result.response.candidates && 
            result.response.candidates.length > 0 && 
            result.response.candidates[0].content) {
            
            const parts = result.response.candidates[0].content.parts;
            
            for (const part of parts) {
                // Extract text analysis if available
                if (part.text) {
                    // Clean up any mentions of Gemini or AI in the response
                    let cleanText = part.text;
                    cleanText = cleanText.replace(/gemini|google ai|ai model|ai assistant/gi, "The system");
                    analysisText = cleanText;
                    console.log('Analysis text received');
                }
                
                // Extract image data if available
                if (part.inlineData && part.inlineData.data) {
                    processedImageBase64 = part.inlineData.data;
                    console.log('Found processed image data!');
                }
            }
        }
        
        // If we have a processed image, return it along with any analysis
        if (processedImageBase64) {
            return {
                image: processedImageBase64,
                analysis: analysisText
            };
        } else {
            console.log('No image data found in response, falling back to original image');
            // Fall back to original image with analysis text
            return {
                image: base64Image,
                analysis: "Image processing complete. Using original image."
            };
        }
    } catch (error) {
        console.error('Error processing image with Gemini:', error);
        throw error;
    }
}

// New endpoint to process image with Google Gemini
app.post('/api/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        console.log('Received image file for Gemini processing:', req.file.originalname);
        
        // Get custom prompt if provided, or use default
        const prompt = req.body.prompt || "Remove background and shadows from this object. Create a clean isolated image with a transparent background.";
        console.log('Using prompt for Gemini processing:', prompt);
        
        try {
            // Check if Google API key is valid
            if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your-google-api-key-here') {
                console.warn('Valid Google API key not found, skipping Gemini processing');
                // Skip Gemini processing and return the original image
                const imageBuffer = fs.readFileSync(req.file.path);
                return res.json({
                    success: true,
                    processedImage: imageBuffer.toString('base64'),
                    analysis: "Gemini processing skipped due to missing API key. Using original image."
                });
            }
            
            // Process the image with Gemini API
            const imageBuffer = fs.readFileSync(req.file.path);
            const result = await processImageWithGemini(imageBuffer, prompt);
            
            // Return the processed image along with any analysis
            res.json({
                success: true,
                processedImage: result.image,
                analysis: result.analysis
            });
        } catch (error) {
            console.error('Error with image processing:', error);
            // Return the original image if Gemini processing fails
            const imageBuffer = fs.readFileSync(req.file.path);
            res.json({
                success: true,
                processedImage: imageBuffer.toString('base64'),
                analysis: "Image processing failed. Using original image.",
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error in process-image endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to process image', 
            details: error.message 
        });
    }
});

// Create endpoint for 3D model generation
app.post('/api/generate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log(`File received: ${req.file.originalname} (${req.file.size} bytes)`);
        
        try {
            // Read file data and convert to base64
            const fileData = fs.readFileSync(req.file.path);
            const base64Image = fileData.toString('base64');
            console.log(`Converted image to base64: ${base64Image.substring(0, 50)}... (${base64Image.length} chars)`);
            
            // Log the API key (first few characters only)
            const maskedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND';
            console.log(`Using Trellis API key: ${maskedKey}`);
            
            // Create proper JSON payload according to Trellis API docs
            const payload = {
                model: "Qubico/trellis",
                task_type: "image-to-model",
                input: {
                    image: base64Image
                }
            };
            
            console.log(`Sending request to Trellis API: ${TRELLIS_BASE_URL}/task`);
            console.log('Payload structure:', JSON.stringify({
                model: payload.model,
                task_type: payload.task_type,
                input: { image: '[BASE64_STRING_TRUNCATED]' }
            }));
            
            // Send the request with JSON payload
            const response = await axios.post(`${TRELLIS_BASE_URL}/task`, 
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY
                    },
                    timeout: 30000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );
            
            // Log response details for debugging
            console.log('Trellis API Response Status:', response.status);
            console.log('Response headers:', JSON.stringify(response.headers));
            console.log('Response data:', typeof response.data === 'string' ? 
                response.data.substring(0, 100) : 
                JSON.stringify(response.data).substring(0, 100));
            
            // Check if the response contains a task_id
            let taskId;
            if (typeof response.data === 'string') {
                try {
                    // Try to parse the response as JSON in case it's a string
                    const parsed = JSON.parse(response.data);
                    taskId = parsed.task_id || parsed.data?.task_id;
                    console.log('Parsed task ID from string response:', taskId);
                } catch (error) {
                    console.error('Error parsing response as JSON:', error);
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Failed to parse API response', 
                        details: error.message 
                    });
                }
            } else {
                // If it's already an object, extract the task_id
                taskId = response.data.task_id || response.data.data?.task_id;
                console.log('Extracted task ID from object response:', taskId);
            }
            
            if (!taskId) {
                console.error('No task_id found in the response');
                return res.status(500).json({ 
                    success: false, 
                    error: 'No task ID in API response',
                    responseData: typeof response.data === 'string' ? 
                        response.data.substring(0, 100) : 
                        JSON.stringify(response.data).substring(0, 100)
                });
            }
            
            console.log('Task ID from Trellis API:', taskId);
            
            // Return the task ID to the client
            return res.json({
                success: true,
                task_id: taskId,
                message: 'Model generation initiated'
            });

        } catch (error) {
            console.error('Error in model generation:', error);
            
            // Detailed error logging
            if (error.response) {
                // The server responded with a status code outside the 2xx range
                console.error('API response error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers,
                    data: error.response.data
                });
                
                return res.status(500).json({
                    success: false,
                    error: 'API Error',
                    details: `${error.response.status}: ${error.response.statusText}`,
                    message: typeof error.response.data === 'string' ? 
                        error.response.data.substring(0, 100) : 
                        JSON.stringify(error.response.data).substring(0, 100)
                });
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response from API server:', error.request);
                return res.status(500).json({
                    success: false,
                    error: 'API Connection Error',
                    details: 'No response from API server'
                });
            } else {
                // Something happened in setting up the request
                console.error('Request setup error:', error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Request Error',
                    details: error.message
                });
            }
        }
    } catch (error) {
        console.error('Unexpected error in generate endpoint:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Unexpected server error', 
            details: error.message 
        });
    }
});

// Status check endpoint
app.get('/api/status', async (req, res) => {
    try {
        const { task_id } = req.query;
        
        if (!task_id) {
            return res.status(400).json({ 
                error: 'Missing task_id parameter' 
            });
        }
        
        console.log(`Checking status for task ID: ${task_id}`);
        
        const response = await axios.get(
            `${TRELLIS_BASE_URL}/task/${task_id}`,
            {
                headers: {
                    'x-api-key': API_KEY
                }
            }
        );
        
        // Log the raw response for debugging
        console.log("Status response received:", JSON.stringify(response.data).substring(0, 200) + "...");
        
        // Normalize response data
        let responseData;
        
        if (typeof response.data === 'string') {
            try {
                responseData = JSON.parse(response.data);
            } catch (e) {
                responseData = { status: 'error', error: 'Invalid response format' };
            }
        } else {
            responseData = response.data;
        }
        
        // Extract status and model URL from response
        let status, modelUrl, errorMessage;
        
        // First check root level
        if (responseData.status) {
            status = responseData.status;
            console.log(`Found status at root level: ${status}`);
        }
        
        if (responseData.model_url) {
            modelUrl = responseData.model_url;
            console.log(`Found model URL at root level: ${modelUrl}`);
        }
        
        // Then check nested data object (Trellis API format)
        if (responseData.data) {
            if (responseData.data.status) {
                status = responseData.data.status;
                console.log(`Found status in nested data object: ${status}`);
            }
            
            if (responseData.data.output && responseData.data.output.glb_url) {
                modelUrl = responseData.data.output.glb_url;
                console.log(`Found model URL in nested data: ${modelUrl}`);
            }
            
            // Additional check for error information
            if (responseData.data.error) {
                errorMessage = responseData.data.error;
                console.log(`Found error in nested data: ${errorMessage}`);
            }
        }
        
        // Map Trellis API status values to our status values
        let normalizedStatus;
        if (status === 'succeeded') {
            normalizedStatus = 'completed';
        } else if (status === 'failed') {
            normalizedStatus = 'failed';
        } else {
            normalizedStatus = 'processing';
        }
        
        // Prepare response object
        const statusResponse = {
            status: normalizedStatus,
            original_status: status
        };
        
        if (modelUrl) {
            statusResponse.model_url = modelUrl;
        }
        
        if (errorMessage) {
            statusResponse.error = errorMessage;
        }
        
        console.log("Sending status response to client:", JSON.stringify(statusResponse));
        return res.json(statusResponse);
        
    } catch (error) {
        console.error('Error checking task status:', error);
        
        // Detailed error response
        if (error.response) {
            return res.status(error.response.status).json({
                status: 'error',
                error: `Status check failed with code ${error.response.status}`,
                details: error.message
            });
        } else {
            return res.status(500).json({
                status: 'error',
                error: 'Status check failed',
                details: error.message
            });
        }
    }
});

// Create proxy endpoint for fetching models from external URLs
app.get('/api/proxy-model', async (req, res) => {
    try {
        const modelUrl = req.query.url;
        
        if (!modelUrl) {
            return res.status(400).json({ error: 'No model URL provided' });
        }
        
        console.log(`Proxying model request to: ${modelUrl}`);
        
        const response = await axios.get(modelUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'application/octet-stream',
                'User-Agent': 'Model-Viewer/1.0'
            },
            timeout: 30000
        });
        
        // Set appropriate headers for the response
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Disposition', 'attachment; filename="model.glb"');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send the model data
        res.send(response.data);
        
    } catch (error) {
        console.error('Error proxying model:', error);
        
        // Detailed error response
        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error fetching model from external source',
                details: error.message,
                statusCode: error.response.status
            });
        } else {
            return res.status(500).json({
                error: 'Error fetching model',
                details: error.message
            });
        }
    }
});

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
const tmpDir = path.join(__dirname, 'tmp');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}

// Check API keys and provide feedback
if (API_KEY) {
    console.log('API Key: Found in environment variables');
} else {
    console.warn('WARNING: Trellis API Key not found in environment variables');
}

if (GOOGLE_API_KEY) {
    console.log('Google API Key: Found in environment variables');
} else {
    console.warn('WARNING: Google Gemini API Key not found in environment variables');
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 