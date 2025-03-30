require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// API Keys from .env file
const API_KEY = process.env.TRELLIS_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const API_URL = 'https://api.piapi.ai/api/v1/task';

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Add new constants for TripoSG API
const TRIPO_API_KEY = 'tsk_Sy8htFdQ_SMtPTnDz6q7IaB6k7MjylouluEISz-THAC';
const TRIPO_API_URL = 'https://api-inference.huggingface.co/models/VAST-AI/TripoSG';

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
        const prompt = req.body.prompt || "Remove the background and shadows from this object. Create a clean isolated image with a transparent background.";
        console.log('Using prompt for Gemini processing:', prompt);
        
        try {
            // Process the image with Gemini API
            const result = await processImageWithGemini(req.file.buffer, prompt);
            
            // Return the processed image along with any analysis
            res.json({
                success: true,
                processedImage: result.image,
                analysis: result.analysis
            });
        } catch (error) {
            console.error('Error with image processing:', error);
            // Return the original image if Gemini processing fails
            res.json({
                success: true,
                processedImage: req.file.buffer.toString('base64'),
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

// Create a new endpoint that serves as a model selector
app.post('/api/generate-model', upload.single('image'), async (req, res) => {
    console.log('Received request to generate 3D model');
    
    // Get the selected model from the request
    const selectedModel = req.body.model || 'trellis'; // Default to trellis if not specified
    console.log(`Selected model: ${selectedModel}`);
    
    if (selectedModel === 'trellis') {
        // Use the existing Trellis endpoint logic
        return handleTrellisModelGeneration(req, res);
    } else if (selectedModel === 'tripo') {
        // Use the new TripoSG endpoint logic
        return handleTripoModelGeneration(req, res);
    } else {
        console.error(`Unknown model selected: ${selectedModel}`);
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid model selection',
            details: { selectedModel }
        });
    }
});

// Keep the original endpoint for backward compatibility
app.post('/api/generate', upload.single('image'), async (req, res) => {
    console.log('Legacy endpoint called - using Trellis model');
    return handleTrellisModelGeneration(req, res);
});

// Function to handle Trellis model generation (extracted from existing code)
async function handleTrellisModelGeneration(req, res) {
    try {
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log(`File received: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Read file data
        const fileData = fs.readFileSync(req.file.path);
        
        // Create API request to Trellis
        const response = await axios.post(API_URL, 
            fileData, // Send raw file data in the request body
            {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'x-api-key': API_KEY,
                }
            }
        );
        
        // Log response details for debugging
        console.log('Trellis API Response Status:', response.status);
        console.log('Trellis API Response Headers:', response.headers);
        console.log('Trellis API Response Type:', typeof response.data);
        
        // For debugging: Log a preview of the response data, handling both string and object
        if (typeof response.data === 'string') {
            console.log('Trellis API Response Data (first 100 chars):', response.data.substring(0, 100));
        } else {
            console.log('Trellis API Response Data:', JSON.stringify(response.data).substring(0, 100) + '...');
        }
        
        // Check if the response contains a task_id
        let taskId;
        if (typeof response.data === 'string') {
            try {
                // Try to parse the response as JSON in case it's a string
                const parsedData = JSON.parse(response.data);
                
                // Check if there's a nested structure where the task_id might be
                if (parsedData.code === 200 && parsedData.data && parsedData.data.task_id) {
                    taskId = parsedData.data.task_id;
                    console.log('Found task_id in nested response data:', taskId);
                } else if (parsedData.task_id) {
                    taskId = parsedData.task_id;
                    console.log('Found task_id in parsed response data:', taskId);
                } else {
                    console.error('No task_id found in parsed response data:', parsedData);
                }
                
                // Send back the full data structure with proper formatting
                return res.json(parsedData);
                
            } catch (parseError) {
                console.error('Failed to parse response data as JSON:', parseError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to parse API response',
                    details: { message: parseError.message }
                });
            }
        } else {
            // Assume it's already an object
            if (response.data.code === 200 && response.data.data && response.data.data.task_id) {
                taskId = response.data.data.task_id;
                console.log('Found task_id in nested response data object:', taskId);
            } else if (response.data.task_id) {
                taskId = response.data.task_id;
                console.log('Found task_id in response data object:', taskId);
            } else {
                console.error('No task_id found in response data object:', response.data);
            }
            
            // Send back the original object
            return res.json(response.data);
        }
        
    } catch (error) {
        console.error('Error generating 3D model with Trellis:', error);
        
        // Create a structured error response
        const errorResponse = {
            success: false,
            error: 'API Error',
            details: {
                message: error.message,
                code: error.code || 'UNKNOWN',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
        
        // If there's a response with error details, include them
        if (error.response) {
            errorResponse.details.statusCode = error.response.status;
            errorResponse.details.statusText = error.response.statusText;
            errorResponse.details.data = error.response.data;
        }
        
        res.status(500).json(errorResponse);
    }
}

// New function to handle TripoSG model generation
async function handleTripoModelGeneration(req, res) {
    console.log('Processing request for TripoSG model generation');
    
    try {
        if (!req.file) {
            console.error('No file uploaded for TripoSG model');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        console.log(`File received for TripoSG: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Create a random task_id for TripoSG (since it doesn't have polling)
        const taskId = `tripo-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        console.log('Generated task_id for TripoSG:', taskId);
        
        // Store the task info for status polling
        tripoTasks[taskId] = {
            status: 'processing',
            file: req.file.path,
            startTime: new Date().toISOString(),
            modelType: 'tripo'
        };
        
        // Start the generation process asynchronously
        processTripoModelGeneration(taskId, req.file.path)
            .then(() => {
                console.log(`TripoSG model generation completed for task ${taskId}`);
            })
            .catch(error => {
                console.error(`TripoSG model generation failed for task ${taskId}:`, error);
                tripoTasks[taskId].status = 'failed';
                tripoTasks[taskId].error = error.message;
            });
        
        // Return immediately with the task_id
        return res.json({
            success: true,
            task_id: taskId,
            model: 'tripo'
        });
        
    } catch (error) {
        console.error('Error initiating TripoSG model generation:', error);
        
        // Create a structured error response
        const errorResponse = {
            success: false,
            error: 'API Error',
            details: {
                message: error.message,
                code: error.code || 'UNKNOWN',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
        
        res.status(500).json(errorResponse);
    }
}

// Store TripoSG tasks for status checks
const tripoTasks = {};

// Function to process TripoSG model generation in the background
async function processTripoModelGeneration(taskId, filePath) {
    console.log(`Starting TripoSG processing for task ${taskId} with file ${filePath}`);
    
    try {
        // Read the file as base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = fileBuffer.toString('base64');
        
        // Create the request to the TripoSG API
        console.log('Preparing request to TripoSG API');
        
        // First step: Run segmentation
        console.log('Step 1: Running image segmentation');
        const segmentationResponse = await axios.post(
            TRIPO_API_URL + '/run_segmentation',
            {
                image: {
                    url: `data:image/jpeg;base64,${base64Image}`
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${TRIPO_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Segmentation response received:', JSON.stringify(segmentationResponse.data).substring(0, 100) + '...');
        
        if (!segmentationResponse.data || !segmentationResponse.data.path) {
            throw new Error('Failed to get valid segmentation result');
        }
        
        // Second step: Generate 3D model from segmented image
        console.log('Step 2: Generating 3D model from segmented image');
        const modelResponse = await axios.post(
            TRIPO_API_URL + '/image_to_3d',
            {
                image: {
                    url: segmentationResponse.data.url || segmentationResponse.data.path
                },
                seed: 0,
                num_inference_steps: 50,
                guidance_scale: 7,
                simplify: true,
                target_face_num: 100000
            },
            {
                headers: {
                    'Authorization': `Bearer ${TRIPO_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Model generation response received');
        
        if (!modelResponse.data) {
            throw new Error('Failed to get valid model generation result');
        }
        
        // Store the model URL
        const modelUrl = modelResponse.data;
        console.log('Generated model URL:', modelUrl);
        
        // Download the model file to our server
        console.log('Downloading model file');
        const modelFilePath = `./tmp/tripo-${taskId}.glb`;
        const modelFileResponse = await axios({
            method: 'get',
            url: modelUrl,
            responseType: 'stream'
        });
        
        // Ensure the tmp directory exists
        if (!fs.existsSync('./tmp')) {
            fs.mkdirSync('./tmp', { recursive: true });
        }
        
        // Save the file
        const modelFileWriter = fs.createWriteStream(modelFilePath);
        modelFileResponse.data.pipe(modelFileWriter);
        
        await new Promise((resolve, reject) => {
            modelFileWriter.on('finish', resolve);
            modelFileWriter.on('error', reject);
        });
        
        console.log('Model file downloaded to', modelFilePath);
        
        // Update the task status
        tripoTasks[taskId].status = 'completed';
        tripoTasks[taskId].output = {
            model_file: `/tmp/tripo-${taskId}.glb`, // Relative URL for our own server
            local_path: modelFilePath // Actual file path
        };
        
        console.log(`TripoSG task ${taskId} completed successfully`);
        
    } catch (error) {
        console.error(`Error processing TripoSG model for task ${taskId}:`, error);
        tripoTasks[taskId].status = 'failed';
        tripoTasks[taskId].error = error.message;
        throw error; // Re-throw to be caught by the caller
    }
}

// Update the status endpoint to handle both Trellis and TripoSG models
app.get('/api/status/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    console.log(`Checking status for task: ${taskId}`);
    
    // Check if this is a TripoSG task
    if (taskId.startsWith('tripo-') && tripoTasks[taskId]) {
        const taskInfo = tripoTasks[taskId];
        console.log(`Found TripoSG task: ${JSON.stringify(taskInfo)}`);
        
        // Return the status of the TripoSG task
        return res.json({
            status: taskInfo.status,
            output: taskInfo.output,
            task_id: taskId,
            model: 'tripo',
            error: taskInfo.error
        });
    }
    
    // Proceed with Trellis status check
    try {
        console.log(`Checking Trellis status for task: ${taskId}`);
        
        // Call the Trellis API to check the status
        const response = await axios.get(`${API_URL}/${taskId}`, {
            headers: {
                'x-api-key': API_KEY,
            }
        });
        
        // Log response for debugging
        console.log('Trellis Status Response:', response.status);
        console.log('Trellis Status Response Type:', typeof response.data);
        
        // For debugging: Log a preview of the response data
        if (typeof response.data === 'string') {
            console.log('Trellis Status Response Data (first 100 chars):', response.data.substring(0, 100));
            
            try {
                // Parse the response if it's a string
                const parsedData = JSON.parse(response.data);
                
                // If the server didn't process the nested structure correctly, do it here
                if (parsedData.code === 200 && parsedData.data) {
                    console.log('Found nested response structure in status check');
                    const responseToSend = {
                        status: parsedData.data.status,
                        output: parsedData.data.output,
                        task_id: taskId,
                        originalResponse: parsedData
                    };
                    
                    console.log('Sending processed status response to client:', responseToSend);
                    return res.json(responseToSend);
                }
                
                // If it's already in the right format, send it directly
                console.log('Sending parsed status response to client:', parsedData);
                return res.json(parsedData);
                
            } catch (parseError) {
                console.error('Error parsing status response:', parseError);
                return res.status(500).json({ error: 'Failed to parse status response', details: parseError.message });
            }
        } else {
            // Assume it's already an object
            
            // Check if we need to extract from a nested structure
            if (response.data.code === 200 && response.data.data) {
                console.log('Found nested response structure in status check');
                const responseToSend = {
                    status: response.data.data.status,
                    output: response.data.data.output,
                    task_id: taskId,
                    originalResponse: response.data
                };
                
                console.log('Sending processed status response to client:', responseToSend);
                return res.json(responseToSend);
            }
            
            console.log('Sending status response to client:', response.data);
            return res.json(response.data);
        }
        
    } catch (error) {
        console.error('Error checking task status:', error);
        
        // Create a structured error response
        const errorResponse = {
            error: 'API Error',
            status: 'error',
            details: {
                message: error.message,
                code: error.code || 'UNKNOWN'
            }
        };
        
        // If there's a response with error details, include them
        if (error.response) {
            errorResponse.details.statusCode = error.response.status;
            errorResponse.details.statusText = error.response.statusText;
            errorResponse.details.data = error.response.data;
        }
        
        res.status(500).json(errorResponse);
    }
});

// Add a new endpoint to serve the temporary files
app.get('/tmp/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'tmp', filename);
    
    console.log(`Serving file: ${filePath}`);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Serve the file
    res.sendFile(filePath);
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