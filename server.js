require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const fsPromises = require('fs').promises; // Use promises version of fs

const app = express();
const port = process.env.PORT || 8000;

// API endpoints
let TRIPO_API_URL = 'https://api.tripo3d.ai/v2/openapi/task';
let TRIPO_UPLOAD_URL = 'https://api.tripo3d.ai/v2/openapi/upload';
let TRIPO_STATUS_URL = 'https://api.tripo3d.ai/v2/openapi/task';
const API_KEY = process.env.TRIPO_API_KEY;

// Validate API Key
if (!API_KEY) {
    console.error('❌ TRIPO_API_KEY environment variable is not set.');
    process.exit(1);
} else {
    console.log(`🔑 Using Tripo3D API key starting with: ${API_KEY.substring(0, 8)}...`);
    // Add check for key format
    if (API_KEY.startsWith('tsk_')) {
        console.warn('⚠️ WARNING: API Key starts with \'tsk_\', which is usually a v1 format key. The v2 endpoint may require a different key format.');
    }
}

// Initialize Google Generative AI Client (place after dotenv config)
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
    console.warn("⚠️ WARNING: GOOGLE_API_KEY not found in .env file. Background removal will default to returning the original image.");
} else {
    console.log(`🔑 Using Google API key starting with: ${googleApiKey.substring(0, 4)}...${googleApiKey.substring(googleApiKey.length - 4)}`);
}
const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;
// Use the specific experimental model alias or a known stable one
// Using gemini-1.5-flash-latest for text tasks and gemini-2.0-flash-exp-image-generation for image editing
const geminiModelName = "gemini-1.5-flash-latest";
const geminiImageModelName = "gemini-2.0-flash-exp-image-generation";
console.log(`✨ Using Gemini Text Model: ${geminiModelName}`);
console.log(`✨ Using Gemini Image Model: ${geminiImageModelName}`);

console.log('-------------------------------------------');
console.log('TRIPO3D MODEL GENERATOR SERVER (v2 API via /openapi/task)');
console.log('-------------------------------------------');
console.log(`API Key loaded: ${API_KEY ? 'YES' : 'NO'}`);
console.log(`🔑 API Generation URL: ${TRIPO_API_URL}`);
console.log(`🔑 API Status URL base: ${TRIPO_STATUS_URL}`);
console.log(`Server Port: ${port}`);
console.log('-------------------------------------------');

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    console.log(`📂 Creating upload directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir, { recursive: true });
} else {
    console.log(`📂 Upload directory exists: ${uploadDir}`);
}

// Enable detailed request logging
app.use((req, res, next) => {
    console.log(`📝 Request received: ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log(`📝 Content type: ${req.headers['content-type']}`);
        console.log(`📝 Content length: ${req.headers['content-length']} bytes`);
        console.log(`📝 Request body keys: ${req.body ? Object.keys(req.body) : 'none'}`);
    }
    next();
});

// Set up file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(`📤 File upload - destination handler called for file: ${file.originalname}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const newFilename = Date.now() + '-' + file.originalname;
        console.log(`📤 File upload - filename handler called: ${newFilename}`);
        cb(null, newFilename);
    }
});

// Add custom file filter for debugging
const fileFilter = (req, file, cb) => {
    console.log(`📤 File upload - filter called for file: ${file.originalname} (${file.mimetype})`);
    if (file.mimetype.startsWith('image/')) {
        console.log(`📤 File upload - accepted image file: ${file.originalname}`);
        cb(null, true);
    } else {
        console.error(`❌ File upload - rejected non-image file: ${file.originalname} (${file.mimetype})`);
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Configure multer for background removal endpoint
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            console.log(`📤 File upload - destination handler called for file: ${file.originalname}`);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const newFilename = `gemini-${Date.now()}-${file.originalname}`;
            console.log(`📤 File upload - filename handler called: ${newFilename}`);
            cb(null, newFilename);
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
        files: 1
    }
});

// Configure multer for Tripo3D model generation
const tripoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            console.log(`📤 Tripo3D upload - destination handler called for file: ${file.originalname}`);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const newFilename = `tripo-${Date.now()}-${file.originalname}`;
            console.log(`📤 Tripo3D upload - filename handler called: ${newFilename}`);
            cb(null, newFilename);
        }
    }),
    fileFilter: fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
        files: 1
    }
}).single('image'); // Use 'image' as field name for Tripo3D uploads

// Static file serving - IMPORTANT: This must come after other middleware
// Explicitly serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Root route handler - explicitly serve index.html 
app.get('/', (req, res) => {
    console.log('📄 Serving index.html from:', path.join(__dirname, 'index.html'));
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy endpoint to avoid CORS issues with loading GLB models
app.get('/api/proxy/:url(*)', async (req, res) => {
    try {
        // Get the exact URL from the request
        const encodedUrl = req.params.url;
        const url = decodeURIComponent(encodedUrl);
        
        console.log(`🔄 Proxying request to: ${url}`);
        console.log(`🔍 URL decoded length: ${url.length}`);
        
        // Special handling for Tripo3D URLs which have complex signatures
        // Make sure to preserve all special characters
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            timeout: 60000, // Increase timeout to 60 seconds
            maxContentLength: 100 * 1024 * 1024, // Allow up to 100MB for model files
            headers: {
                'Accept': '*/*',
                'User-Agent': 'ModelViewerProxy/1.0',
                'Origin': 'http://localhost:8000',
                'Referer': 'http://localhost:8000/'
            },
            // Don't parse query string - very important for AWS signed URLs
            paramsSerializer: params => {
                return params;
            }
        });
        
        // Extract the file extension from the path part (before query params)
        const urlPath = url.split('?')[0];
        const fileExt = urlPath.split('.').pop().toLowerCase();
        
        // Map of file extensions to MIME types
        const mimeTypes = {
            'glb': 'model/gltf-binary',
            'gltf': 'model/gltf+json',
            'fbx': 'application/octet-stream',
            'obj': 'text/plain',
            'mtl': 'text/plain',
            'stl': 'application/sla'
        };
        
        const contentType = mimeTypes[fileExt] || 'application/octet-stream';
        
        // Set appropriate headers for the response
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', response.data.length);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for one day
        
        // Log response headers for debugging
        console.log(`✅ Response from upstream server:`, {
            status: response.status,
            contentType: response.headers['content-type'],
            contentLength: response.headers['content-length'],
            dataLength: response.data.length
        });
        
        // Send the model data directly
        res.send(response.data);
        
        console.log(`✅ Successfully proxied ${fileExt.toUpperCase()} file (${response.data.length} bytes)`);
    } catch (error) {
        console.error(`❌ Proxy error:`);
        
        // More detailed error logging
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response headers:`, error.response.headers);
            
            // Send the actual error response from the upstream server
            res.status(error.response.status).json({
                error: `Upstream server returned ${error.response.status}`,
                message: error.message,
                url: req.params.url
            });
        } else if (error.request) {
            console.error(`No response received from target server`);
            console.error(error.message);
            
            res.status(500).json({
                error: 'No response from target server',
                message: error.message,
                url: req.params.url
            });
        } else {
            console.error(`Error setting up request: ${error.message}`);
            
            res.status(500).json({
                error: 'Error setting up request',
                message: error.message,
                url: req.params.url
            });
        }
    }
});

// Helper function to convert a file to base64
function fileToBase64(filePath) {
    return fs.readFileSync(filePath).toString('base64');
}

// Create a function to test a POST request to the endpoint
async function testPostRequest() {
    try {
        console.log('🧪 Testing POST request to API endpoint...');
        
        // Create a minimal test payload
        const testPayload = {
            type: "text_to_model",  // Changed from "text_to_3d" to "text_to_model"
            prompt: "test cube",
        };
        
        console.log(`🧪 Test payload: ${JSON.stringify(testPayload)}`);
        
        const response = await axios.post(TRIPO_API_URL, 
            testPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                validateStatus: () => true // Don't throw on any status code
            }
        );
        
        console.log(`🧪 Test response status: ${response.status} ${response.statusText}`);
        console.log(`🧪 Test response headers: ${JSON.stringify(response.headers)}`);
        console.log(`🧪 Test response data: ${JSON.stringify(response.data)}`);
        
        return response.status === 200;
    } catch (error) {
        console.error('🧪 Test POST request failed:', error.message);
        return false;
    }
}

// Run the test after the server starts
setTimeout(async () => {
    try {
        console.log('🧪 Running API endpoint tests...');
        await testPostRequest();
    } catch (error) {
        console.error('🧪 Error running tests:', error.message);
    }
}, 5000);

// Add a function to test multiple API endpoints if the primary one fails
async function testApiEndpoints() {
    // Place the /v2/openapi/task endpoint first since we know it exists
    const testEndpoints = [
        'https://api.tripo3d.ai/v2/openapi/task',
        'https://api.tripo3d.ai/v2/task'
    ];
    
    console.log('🔍 Testing Tripo3D API endpoints for availability with POST...');
    
    // Create a minimal test payload
    const testPayload = {
        type: "image_to_model",  // v1 API format
        prompt: "test cube"
    };
    
    for (const endpoint of testEndpoints) {
        try {
            console.log(`🔍 Testing endpoint ${endpoint} with POST request`);
            
            const response = await axios.post(endpoint, 
                testPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    validateStatus: () => true // Don't throw on any status code
                }
            );
            
            console.log(`🔍 Endpoint ${endpoint} POST response: Status ${response.status}`);
            
            // 200 means the endpoint accepted our request
            if (response.status === 200) {
                console.log(`✅ Found valid endpoint: ${endpoint} (POST request accepted)`);
                return endpoint;
            }
        } catch (error) {
            console.log(`❌ Endpoint ${endpoint} POST error: ${error.message}`);
        }
    }
    
    console.log('⚠️ No valid endpoints found with POST. Using default endpoint.');
    return TRIPO_API_URL; // Return the default if no valid endpoints are found
}

// Try another common API URL pattern for v2
async function tryAlternativeAPI() {
    try {
        console.log('🔄 Trying alternative API structure...');
        
        // Some APIs use a structure where you create a task first, then upload separately
        const taskCreationPayload = {
            type: "image_to_model"  // v1 API format
        };
        
        // Try the create task endpoint
        const createTaskUrl = 'https://api.tripo3d.ai/v2/tasks';
        console.log(`🔄 Testing task creation at: ${createTaskUrl}`);
        
        const response = await axios.post(createTaskUrl, 
            taskCreationPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                validateStatus: () => true
            }
        );
        
        console.log(`🔄 Task creation response: ${response.status} ${response.statusText}`);
        console.log(`🔄 Task creation data: ${JSON.stringify(response.data)}`);
        
        if (response.status === 200 || response.status === 201) {
            console.log('✅ Found alternative API pattern!');
            return createTaskUrl;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error trying alternative API:', error.message);
        return null;
    }
}

// Run the alternative API test after the server starts
setTimeout(async () => {
    try {
        console.log('🔄 Testing alternative API structures...');
        const alternativeUrl = await tryAlternativeAPI();
        if (alternativeUrl) {
            console.log(`🔄 Updating to alternative API URL: ${alternativeUrl}`);
            TRIPO_API_URL = alternativeUrl;
        }
    } catch (error) {
        console.error('🔄 Error testing alternative API:', error.message);
    }
}, 8000);

// Try multiple payload formats against the API
async function tryMultiplePayloadFormats() {
    // Different companies format their APIs in different ways, let's try several common patterns
    const payloadFormats = [
        // Format 1: Just type and prompt (v1 API format)
        {
            type: "image_to_model",
            prompt: "test cube"
        },
        // Format 2: With both type and task_type fields (hybrid approach)
        {
            type: "image_to_model",
            task_type: "image_to_model",
            prompt: "test cube"
        },
        // Format 3: Nested data structure
        {
            task: {
                type: "image_to_model",
                prompt: "test cube"
            }
        },
        // Format 4: With source field (some v1 APIs require this)
        {
            type: "image_to_model",
            source: "api",
            prompt: "test cube"
        }
    ];
    
    console.log('🔄 Testing multiple payload formats against API endpoint...');
    
    for (const payload of payloadFormats) {
        try {
            console.log(`🔄 Trying payload format: ${JSON.stringify(payload)}`);
            
            const response = await axios.post(TRIPO_API_URL, 
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    validateStatus: () => true
                }
            );
            
            console.log(`🔄 Response status: ${response.status} ${response.statusText}`);
            if (response.data) {
                console.log(`🔄 Response data: ${JSON.stringify(response.data)}`);
            }
            
            // Check if this payload format worked
            if (response.status === 200 || response.status === 201 || response.status === 202) {
                console.log('✅ Found working payload format!');
                return { success: true, payload };
            }
        } catch (error) {
            console.error(`❌ Error with payload format: ${JSON.stringify(payload)}`, error.message);
        }
    }
    
    console.log('⚠️ No working payload format found.');
    return { success: false };
}

// Run the payload format test after the server starts
setTimeout(async () => {
    try {
        console.log('🔄 Testing API payload formats...');
        const result = await tryMultiplePayloadFormats();
        if (result.success) {
            console.log(`🔄 Found working payload format: ${JSON.stringify(result.payload)}`);
        }
    } catch (error) {
        console.error('🔄 Error testing payload formats:', error.message);
    }
}, 10000);

// Test if we have a valid API key
async function validateApiKey() {
    try {
        console.log('🔑 Validating API key...');
        
        // Let's try a simple endpoint to test auth - often APIs have a user/me or health endpoint
        const authEndpoints = [
            'https://api.tripo3d.ai/v2/user',
            'https://api.tripo3d.ai/v2/me',
            'https://api.tripo3d.ai/v2/auth/validate',
            'https://api.tripo3d.ai/health'
        ];
        
        for (const endpoint of authEndpoints) {
            try {
                console.log(`🔑 Testing auth at: ${endpoint}`);
                
                const response = await axios.get(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    validateStatus: () => true
                });
                
                console.log(`🔑 Auth response: ${response.status} ${response.statusText}`);
                
                // 401 means the API key is not valid
                if (response.status === 401) {
                    console.error('❌ API key validation failed: 401 Unauthorized');
                    return false;
                }
                
                // Any response other than 404 means we found an endpoint to test against
                if (response.status !== 404) {
                    if (response.status === 200) {
                        console.log('✅ API key validation successful!');
                    } else {
                        console.log(`⚠️ API key validation unclear: Status ${response.status}`);
                    }
                    return response.status === 200;
                }
            } catch (error) {
                console.error(`❌ Error testing auth endpoint ${endpoint}:`, error.message);
            }
        }
        
        console.log('⚠️ Could not verify API key - all auth endpoints returned 404');
        return null; // Couldn't determine
    } catch (error) {
        console.error('❌ Error validating API key:', error.message);
        return null;
    }
}

// Run the API key validation after the server starts
setTimeout(async () => {
    try {
        console.log('🔑 Validating API key format and access...');
        const isValid = await validateApiKey();
        
        if (isValid === false) {
            console.error('--------------------------------------------------');
            console.error('❌ API KEY VALIDATION FAILED: 401 UNAUTHORIZED');
            console.error('❌ Your API key appears to be invalid or expired.');
            console.error('❌ Please check your .env file and update the TRIPO_API_KEY.');
            console.error('--------------------------------------------------');
        } else if (isValid === true) {
            console.log('--------------------------------------------------');
            console.log('✅ API KEY VALIDATION SUCCESSFUL');
            console.log('✅ Your API key was accepted by the Tripo3D API.');
            console.log('--------------------------------------------------');
        } else {
            console.log('--------------------------------------------------');
            console.log('⚠️ API KEY VALIDATION INCONCLUSIVE');
            console.log('⚠️ Could not determine if your API key is valid.');
            console.log('--------------------------------------------------');
        }
    } catch (error) {
        console.error('🔑 Error during API key validation:', error.message);
    }
}, 12000);

// Helper function to convert file buffer to Gemini Part object
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// Helper function to call Gemini Vision API
async function callGeminiVision(imagePath, prompt) {
  if (!genAI) {
    throw new Error('Gemini not configured (no API key?)');
  }

  // Use image generation model for transformations
  console.log(`📡 Using Gemini model: ${geminiImageModelName} for image processing`);
  
  const model = genAI.getGenerativeModel({ model: geminiImageModelName });
  const imageBuffer = await fsPromises.readFile(imagePath);
  const imagePart = fileToGenerativePart(imageBuffer, 'image/png');

  const generationConfig = {
    temperature: 0.4,
    topP: 1.0,
    topK: 32,
    maxOutputTokens: 4096,
    responseModalities: ['Text', 'Image'] // Explicitly request image output
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
    generationConfig,
    safetySettings
  });

  const response = result.response;
  
  if (!response || !response.candidates || response.candidates.length === 0) {
    throw new Error("Invalid or empty response received from Gemini API");
  }

  const candidate = response.candidates[0];
  if (candidate.finishReason === 'SAFETY' || (candidate.safetyRatings && candidate.safetyRatings.some(r => r.blocked))) {
    throw new Error("Image processing blocked by safety filters");
  }

  return response;
}

// --- Gemini Addition: NEW Background Removal Endpoint ---
// Place this *before* the '/api/generate' route
app.post('/api/remove-background', upload.single('image'), async (req, res) => {
  try {
    console.log('✨ Processing new image pipeline request');
    
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const imagePath = req.file.path;
    console.log(`📤 File received: ${req.file.originalname} (${req.file.size} bytes) at ${imagePath}`);

    // Step 1: Determine if main focus is person or object
    console.log('🔍 Step 1: Analyzing image content...');
    const classificationPrompt = "i want you to focus on the MAIN FOCUS of the picture - there might be people AND objects - but i want you to focus on what is the MOST PROMINENT / MAIN FOCUS OF THE IMAGE. please answer whether you see a person or object, in one word only.";
    
    // For classification, we can use a different model
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const classificationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    // Prepare image for classification
    const imageBuffer = await fsPromises.readFile(imagePath);
    const imagePart = fileToGenerativePart(imageBuffer, 'image/png');
    
    const classificationResult = await classificationModel.generateContent({
      contents: [{ role: "user", parts: [imagePart, { text: classificationPrompt }] }],
      generationConfig: { temperature: 0.2 }
    });
    
    const classificationResponse = classificationResult.response;
    const mainFocus = classificationResponse.candidates[0].content.parts[0].text.trim().toLowerCase();
    console.log(`📝 Gemini Classification Response: "${mainFocus}"`);

    // Step 2: Apply appropriate transformation based on classification
    console.log(`🎨 Step 2: Applying ${mainFocus}-specific transformation...`);
    let transformationPrompt;
    
    if (mainFocus === 'person') {
      transformationPrompt = "Remove background";
      console.log('👤 Using person-specific background removal prompt');
    } else if (mainFocus === 'object') {
      transformationPrompt = "Remove background from this object. Make it a minimalist 3D illustration, soft shadows, smooth plastic textures, soft lighting. Isometric view, with subtle perspective. Cute and friendly style, modern digital render.";
      console.log('🎯 Using object-specific creative transformation prompt');
    } else {
      console.log(`⚠️ Unexpected classification "${mainFocus}" - defaulting to simple background removal`);
      transformationPrompt = "Remove background";
    }

    console.log('📞 Calling Gemini API for transformation...');
    const transformationResponse = await callGeminiVision(imagePath, transformationPrompt);
    console.log('🔍 Gemini Transformation Raw Response:', JSON.stringify(transformationResponse, null, 2));

    // Look for image data in the response
    let processedImageData = null;
    const candidate = transformationResponse.candidates[0];
    
    if (candidate && candidate.content && candidate.content.parts) {
      console.log(`📦 Response contains ${candidate.content.parts.length} parts`);
      
      // Look through all parts for image data
      for (const part of candidate.content.parts) {
        console.log(`📦 Examining part type: ${part.inlineData ? 'inlineData' : (part.text ? 'text' : 'unknown')}`);
        
        if (part.inlineData && part.inlineData.data) {
          console.log('✅ Found inline image data!');
          processedImageData = part.inlineData.data;
          // Set content type from inline data if available
          const mimeType = part.inlineData.mimeType || 'image/png';
          console.log(`✅ Using MIME type: ${mimeType}`);
          break;
        } else if (part.text) {
          console.log(`📝 Text part content: "${part.text.substring(0, 100)}..."`);
          // Try to extract URL from text as fallback
          const urlMatch = part.text.match(/(?:!\[.*?\]\()?https?:\/\/[^\s\)]+\.(?:png|jpe?g|gif|webp|bmp)(?:\)?)/i);
          if (urlMatch) {
            console.log('🔗 Found image URL in text, attempting to fetch...');
            const imageUrl = urlMatch[0].replace(/[!\[\]()]/g, '');
            try {
              const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
              processedImageData = Buffer.from(imageResponse.data).toString('base64');
              console.log('✅ Successfully fetched and processed image from URL');
              break;
            } catch (fetchError) {
              console.error('❌ Failed to fetch image from URL:', fetchError.message);
            }
          }
        }
      }
    }

    if (!processedImageData) {
      throw new Error('Could not find image data in Gemini response');
    }

    // Send processed image back to client as binary data
    const processedImageBuffer = Buffer.from(processedImageData, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(processedImageBuffer);

  } catch (error) {
    console.error('❌ Error in image pipeline:', error.message);
    // Send original image as fallback
    console.log('-> Attempting to send original image due to error');
    const originalImageBuffer = fs.readFileSync(req.file.path);
    res.set('Content-Type', req.file.mimetype || 'image/png');
    res.send(originalImageBuffer);
  } finally {
    // Cleanup
    if (req.file) {
      console.log(`🧹 Cleaned up temp file: ${req.file.path}`);
      fs.unlinkSync(req.file.path);
    }
  }
});
// --- End Gemini Addition ---

// Custom file upload handler with error logging
app.post('/api/generate', (req, res, next) => {
    console.log('📤 Processing file upload request for Tripo3D');
    console.log('📤 Request headers:', req.headers);
    
    // Log when the upload starts processing
    console.log('📤 About to process Tripo multer upload...');
    
    tripoUpload(req, res, function (err) {
        console.log('📤 Tripo Multer processing completed');
        
        if (err) {
            console.error('⚠️ Tripo File upload error:', err);
            
            // Handle multer errors specifically
            if (err instanceof multer.MulterError) {
                console.error(`⚠️ Multer error type: ${err.code}`);
                
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'File is too large (max 20MB)' 
                    });
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Unexpected field name. Must use "image" as the field name' 
                    });
                }
                
                return res.status(400).json({ 
                    success: false, 
                    error: `Multer error: ${err.code}`,
                    details: err.message
                });
            }
            
            // Handle other errors
            return res.status(500).json({ 
                success: false, 
                error: 'File upload failed', 
                details: err.message 
            });
        }
        
        console.log('📤 File upload processed by multer');
        
        // Debug the incoming request
        console.log('📤 Request body fields:', Object.keys(req.body || {}));
        console.log('📤 Request files:', req.file ? 'File present' : 'No file');
        
        if (!req.file) {
            console.error('⚠️ No file uploaded or file field name is not "image"');
            
            // Check if there are any files in the request at all
            if (req.files) {
                console.log('📤 Files were uploaded but with wrong field names:', Object.keys(req.files));
            }
            
            console.log('📤 Form data fields received:', req.body ? Object.keys(req.body) : 'none');
            
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded. Make sure you\'re using field name "image" in your FormData' 
            });
        }
        
        // Process the file upload as before
        console.log(`📤 TRIPO GENERATION: File received: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`📤 TRIPO GENERATION: File saved at: ${req.file.path}`);
        console.log(`📤 TRIPO GENERATION: File mimetype: ${req.file.mimetype}`);
        
        // Continue with the rest of the handler
        handleImage(req, res);
    });
});

// Separated function to handle the image after upload
async function handleImage(req, res) {
    try {
        const imagePath = req.file.path;
        const originalFilename = req.file.originalname;
        const fileExtension = path.extname(originalFilename).slice(1).toLowerCase(); // Get file extension (e.g., 'png')
        console.log(`📤 TRIPO UPLOAD: Processing uploaded file: ${originalFilename} (type: ${fileExtension}) at ${imagePath}`);
        
        // Log masking some of the API key for security
        const maskedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND';
        console.log(`📤 TRIPO UPLOAD: Using API Key: ${maskedKey}`);
        
        // ---- STEP 1: Upload Image File ----
        console.log('\n-- STEP 1: Uploading Image File --');
        let fileToken;
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(imagePath), originalFilename);
            
            console.log(`📤 TRIPO UPLOAD: POST to ${TRIPO_UPLOAD_URL}`);
            console.log(`📤 TRIPO UPLOAD: Headers will include Content-Type: ${formData.getHeaders()['content-type']}`);
            console.log(`📤 TRIPO UPLOAD: Authorization: Bearer ${maskedKey}`);

            const uploadResponse = await axios.post(TRIPO_UPLOAD_URL, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${API_KEY}`
                },
                timeout: 90000, 
                validateStatus: () => true
            });

            console.log('📥 TRIPO UPLOAD: RESPONSE RECEIVED');
            console.log(`- Status: ${uploadResponse.status} ${uploadResponse.statusText}`);
            console.log(`- Headers: ${JSON.stringify(uploadResponse.headers, null, 2)}`);
            console.log(`- Body: ${JSON.stringify(uploadResponse.data, null, 2)}`);

            // IMPORTANT: Check for image_token as returned by the API
            if (uploadResponse.status === 200 && uploadResponse.data && uploadResponse.data.code === 0 && uploadResponse.data.data && uploadResponse.data.data.image_token) {
                // Store the received token value (which was under the key image_token)
                fileToken = uploadResponse.data.data.image_token; 
                console.log(`✅ TRIPO UPLOAD: Success! Received image_token (using it as file_token): ${fileToken}`);
            } else {
                console.error(`❌ TRIPO UPLOAD: Failed or expected token (image_token) not found. Status: ${uploadResponse.status}`);
                const errorDetails = uploadResponse.data || { message: `Upload failed with status ${uploadResponse.status}` };
                 if (uploadResponse.status === 404) {
                    console.error(`❌ TRIPO UPLOAD: Upload endpoint ${TRIPO_UPLOAD_URL} not found (404).`);
                    errorDetails.message = `Upload endpoint not found: ${TRIPO_UPLOAD_URL}.`;
                }
                 if (uploadResponse.status === 401) {
                    console.error(`❌ TRIPO UPLOAD: Authentication failed (401). Check API Key.`);
                    errorDetails.message = `Authentication failed for upload. Check API Key.`;
                }
                return res.status(uploadResponse.status >= 400 ? uploadResponse.status : 500).json({ 
                    success: false, 
                    error: 'Image upload to Tripo3D failed',
                    step: 'upload',
                    details: errorDetails
                });
            }
        } catch (uploadError) {
            console.error('❌ TRIPO UPLOAD: Exception during upload request:', uploadError.message);
            if (uploadError.response) {
                console.error(`- Response Status: ${uploadError.response.status}`);
                console.error(`- Response Data: ${JSON.stringify(uploadError.response.data)}`);
            } else if (uploadError.request) {
                console.error('- No response received from upload server.');
            }
            return res.status(500).json({ 
                success: false, 
                error: 'Image upload request failed',
                step: 'upload',
                details: uploadError.message
            });
        }
        
        // Clean up the temporary uploaded file 
        fs.unlink(imagePath, (err) => {
            if (err) console.warn(`⚠️ Failed to delete temporary file: ${imagePath}`, err);
            else console.log(`🗑️ Deleted temporary file: ${imagePath}`);
        });

        // ---- STEP 2: Create Generation Task ----
        console.log('\n-- STEP 2: Creating Generation Task (Using received token) --');
        // Construct payload exactly as per user example, using the token value received
        const taskPayload = {
            type: "image_to_model", 
            file: {
                type: fileExtension, 
                file_token: fileToken // Use the key file_token, but with the value from image_token
            }
        };
        
        // Check if style parameter is provided and add it to payload
        if (req.body && req.body.style && req.body.style.trim() !== '') {
            taskPayload.style = req.body.style.trim();
            console.log(`📤 TRIPO GENERATION: Adding style parameter: "${taskPayload.style}"`);
        }
        
        console.log(`📤 TRIPO GENERATION: POST to ${TRIPO_API_URL}`);
        console.log(`📤 TRIPO GENERATION: Payload Structure (using received token): ${JSON.stringify(taskPayload, null, 2)}`);
        console.log(`📤 TRIPO GENERATION: Authorization: Bearer ${maskedKey}`);
        
        try {
            const generationResponse = await axios.post(TRIPO_API_URL, 
                taskPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`
                    },
                    timeout: 60000, 
                    validateStatus: () => true 
                }
            );

            console.log('📥 TRIPO GENERATION: RESPONSE RECEIVED');
            console.log(`- Status: ${generationResponse.status} ${generationResponse.statusText}`);
            console.log(`- Headers: ${JSON.stringify(generationResponse.headers, null, 2)}`);
            console.log(`- Body: ${JSON.stringify(generationResponse.data, null, 2)}`);

            // Check for success and task_id (standard v2 format)
            if (generationResponse.status === 200 && generationResponse.data && generationResponse.data.code === 0 && generationResponse.data.data && generationResponse.data.data.task_id) {
                const taskId = generationResponse.data.data.task_id;
                console.log(`✅ TRIPO GENERATION: Success! task_id = ${taskId}`);
                return res.json({ 
                    success: true, 
                    message: 'Model generation task started',
                    taskId: taskId
                });
            } else {
                console.error(`❌ TRIPO GENERATION: Failed or task_id not found. Status: ${generationResponse.status}`);
                 const errorDetails = generationResponse.data || { message: `Generation request failed with status ${generationResponse.status}` };
                 console.error('❌❌❌ ERROR DETAILS ❌❌❌');
                 console.error(`❌ Status: ${generationResponse.status} ${generationResponse.statusText}`);
                 console.error(`❌ Error Code: ${errorDetails.code || 'N/A'}`);
                 console.error(`❌ Error Message: ${errorDetails.message || 'N/A'}`);
                 console.error(`❌ Suggestion: ${errorDetails.suggestion || 'N/A'}`);
                 console.error('❌❌❌ END ERROR DETAILS ❌❌❌\n');
                  if (generationResponse.status === 401) {
                     console.error(`❌ TRIPO GENERATION: Authentication failed (401). Check API Key.`);
                     errorDetails.message = `Authentication failed for task creation. Check API Key.`;
                 }
                 
                 return res.status(generationResponse.status >= 400 ? generationResponse.status : 500).json({ 
                    success: false, 
                    error: 'Generation task creation failed',
                    step: 'generation',
                    details: errorDetails,
                    errorString: JSON.stringify(errorDetails)
                });
            }
        } catch (generationError) {
            console.error('❌ TRIPO GENERATION: Exception during generation task request:', generationError.message);
            if (generationError.response) {
                console.error(`- Response Status: ${generationError.response.status}`);
                console.error(`- Response Data: ${JSON.stringify(generationError.response.data)}`);
            } else if (generationError.request) {
                console.error('- No response received from generation server.');
            }
            return res.status(500).json({ 
                success: false, 
                error: 'Generation task request failed',
                step: 'generation',
                details: generationError.message
            });
        }

    } catch (error) {
        console.error('❌ Unexpected error in handleImage:', error);
        // Attempt cleanup on unexpected error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => { /* Ignore cleanup error */ });
        }
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process image request',
            details: error.message
        });
    }
}

// Text-to-3D generation endpoint
app.post('/api/generateText', async (req, res) => {
    try {
        // Extract input data
        const { prompt, resolution } = req.body;
        
        if (!prompt) {
            console.error('No prompt provided');
            return res.status(400).json({ success: false, error: 'No prompt provided' });
        }
        
        console.log(`📤 TRIPO TEXT GENERATION: Received request with prompt: "${prompt}"`);
        console.log(`📤 TRIPO TEXT GENERATION: Resolution: ${resolution || 'normal'}`);
        
        try {
            // Prepare payload for v2 API (Using text_to_model)
            const payload = {
                task_type: "text_to_model",  // Reverted back to text_to_model
                model_version: "v2.5-20250123", 
                prompt: prompt
            };
            
            // Log the exact task type we're sending
            console.log(`📤 TRIPO TEXT GENERATION: Using task_type="${payload.task_type}"`);
            console.log(`📤 TRIPO TEXT GENERATION: Using model_version="${payload.model_version}"`);
            
            // Log the EXACT structure of the request for debugging
            console.log(`📤 TRIPO TEXT GENERATION: EXACT REQUEST PAYLOAD STRUCTURE:`);
            console.log(JSON.stringify(payload, null, 2));
            
            // Add extremely explicit field-by-field logging
            console.log('\n==== EXACT FIELDS BEING SENT TO TRIPO3D API (TEXT) ====');
            console.log(`FIELD: task_type = "${payload.task_type}"`); // Using text_to_model
            console.log(`FIELD: model_version = "${payload.model_version}"`);
            console.log(`FIELD: prompt = "${payload.prompt}"`);
            console.log('=================================================\n');
            
            // Log API info
            console.log(`📤 TRIPO TEXT GENERATION: Using v2 API at ${TRIPO_API_URL}`);
            
            console.log(`📤 TRIPO TEXT GENERATION: Request URL: ${TRIPO_API_URL}`);
            console.log(`📤 TRIPO TEXT GENERATION: Request headers: Content-Type: application/json, Authorization: Bearer ${API_KEY.substring(0, 8)}...`);
            console.log(`📤 TRIPO TEXT GENERATION: Request payload: ${JSON.stringify(payload)}`);
            
            try {
                console.log('\n🔍 MAKING ACTUAL TEXT-TO-3D API REQUEST WITH AXIOS:');
                console.log(`🔍 URL: ${TRIPO_API_URL}`);
                console.log(`🔍 METHOD: POST`);
                console.log(`🔍 HEADERS: ${JSON.stringify({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY.substring(0, 10)}...`
                }, null, 2)}`);
                console.log(`🔍 PAYLOAD FIELDS: ${Object.keys(payload).join(', ')}`);
                console.log(`🔍 TASK_TYPE: "${payload.task_type}"`);
                console.log(`🔍 MODEL_VERSION: "${payload.model_version}"`);
                console.log(`🔍 PROMPT: "${payload.prompt}"`);
                
                // Log the actual JSON that will be sent
                const jsonForLogging = JSON.stringify(payload, null, 2);
                console.log(`🔍 ACTUAL JSON PAYLOAD:\n${jsonForLogging}`);
                
                const response = await axios.post(TRIPO_API_URL, 
                    payload,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${API_KEY}`
                        },
                        timeout: 60000, // 60 second timeout
                        validateStatus: () => true // Don't throw on any status code to handle it manually
                    }
                );
                
                console.log('📥 TRIPO TEXT GENERATION: Response received');
                console.log(`📥 TRIPO TEXT GENERATION: Status: ${response.status} ${response.statusText}`);
                console.log(`📥 TRIPO TEXT GENERATION: Response headers: ${JSON.stringify(response.headers)}`);
                console.log(`📥 TRIPO TEXT GENERATION: Data: ${JSON.stringify(response.data).substring(0, 200)}...`);
                
                if (response.status === 404) {
                    console.error('❌ TRIPO TEXT GENERATION: API endpoint not found (404). Trying alternative endpoint...');
                    
                    // Try the alternative endpoints using POST instead of GET
                    const newEndpoint = await testApiEndpoints();
                    if (newEndpoint !== TRIPO_API_URL) {
                        console.log(`🔄 Using alternative endpoint: ${newEndpoint}`);
                        TRIPO_API_URL = newEndpoint;
                        
                        // Retry with the new endpoint
                        console.log('🔄 Retrying request with new endpoint');
                        return res.redirect(307, req.originalUrl);
                    }
                    
                    return res.status(404).json({
                        success: false,
                        error: 'API endpoint not found',
                        details: 'The Tripo3D API endpoint could not be reached. Please check your API configuration.'
                    });
                }
                
                if (response.status === 200) {
                    const data = response.data;
                    console.log(`📥 TRIPO TEXT RESPONSE: Data: ${JSON.stringify(data, null, 2)}`);
                    
                    // Extract task ID from response according to API version
                    let taskId;
                    
                    if (data.code === 0 && data.data && data.data.task_id) {
                        taskId = data.data.task_id;
                    }
                    
                    if (taskId) {
                        console.log(`📥 TRIPO TEXT RESPONSE: Task ID: ${taskId}`);
                        
                        res.json({ 
                            success: true, 
                            message: 'Model generation started', 
                            taskId: taskId 
                        });
                    } else {
                        console.error('📥 TRIPO TEXT RESPONSE ERROR: No task ID found in response');
                        res.status(500).json({ 
                            success: false, 
                            error: 'No task ID found in response', 
                            details: data 
                        });
                    }
                } else {
                    console.error(`📥 TRIPO TEXT RESPONSE ERROR: API request failed: ${response.status}, ${response.statusText}`);
                    res.status(response.status).json({ 
                        success: false, 
                        error: 'API request failed', 
                        details: response.data 
                    });
                }
            } catch (error) {
                console.error('❌ TRIPO TEXT GENERATION: Error generating model', error.message);
                
                // Add detailed error diagnostics
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.error(`❌ TRIPO TEXT GENERATION: Response status: ${error.response.status}`);
                    console.error(`❌ TRIPO TEXT GENERATION: Response data: ${JSON.stringify(error.response.data)}`);
                    console.error(`❌ TRIPO TEXT GENERATION: Response headers: ${JSON.stringify(error.response.headers)}`);
                    
                    if (error.response.status === 401) {
                        console.error('❌ TRIPO TEXT GENERATION: Authentication failed. Please check your API key format and value.');
                    }
                } else if (error.request) {
                    // The request was made but no response was received
                    console.error('❌ TRIPO TEXT GENERATION: No response received from server');
                } else {
                    // Something happened in setting up the request that triggered an Error
                    console.error('❌ TRIPO TEXT GENERATION: Error setting up request:', error.message);
                }
                
                res.status(500).json({ error: 'Failed to generate model', details: error.message });
            }
        } catch (error) {
            console.error('Error in generateText endpoint:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to process request', 
                details: error.message 
            });
        }
    } catch (error) {
        console.error('Error in generateText endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process request', 
            details: error.message 
        });
    }
});

// Status check endpoint - for both v1 and v2 API
app.get('/api/status/:taskId', async (req, res) => {
    let responsePayload = {}; // Declare responsePayload at the top level of the try block
    try {
        const taskId = req.params.taskId;

        if (!taskId) {
             responsePayload = { success: false, error: 'Task ID is required' };
            return res.status(400).json(responsePayload);
        }

        console.log(`📝 Request received: GET /api/status/${taskId}`);
        console.log(`📊 TRIPO STATUS CHECK: Checking status for task: ${taskId}`);

        // For /v2/openapi/task endpoint, the status URL is the same as the task endpoint + taskId
        const statusUrl = `${TRIPO_STATUS_URL}/${taskId}`;
        console.log(`📊 TRIPO STATUS CHECK: Using v2 status endpoint: ${statusUrl}`);

        // Check if API_KEY is set
        if (!API_KEY) {
            console.error('❌ API key is not configured on the server.');
             responsePayload = { success: false, error: 'API key is not configured on the server.' };
            return res.status(500).json(responsePayload);
        }
        const maskedKey = API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT FOUND';

        try {
            console.log('\n🔍 MAKING ACTUAL STATUS CHECK REQUEST WITH AXIOS:');
            console.log(`🔍 URL: ${statusUrl}`);
            console.log(`🔍 METHOD: GET`);
            console.log(`🔍 HEADERS: ${JSON.stringify({ 'Authorization': `Bearer ${maskedKey}` }, null, 2)}`);

            const response = await axios.get(statusUrl, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`
                },
                timeout: 30000, // 30 second timeout
                validateStatus: () => true // Don't throw on any status code
            });

            console.log('📥 STATUS CHECK RESPONSE:');
            console.log(`- Status: ${response.status} ${response.statusText}`);
            // console.log(`- Headers: ${JSON.stringify(response.headers, null, 2)}`); // Optional
            console.log(`- Body: ${JSON.stringify(response.data, null, 2)}`); // Log the full body

            // --- Process the response ---
            // Initialize responsePayload defaults here before conditions
             responsePayload = {
                success: false, // Default to false
                status: 'error', // Default status
                message: 'Failed to process status response',
                progress: 0,
                modelUrl: null,
                error: 'Initial status check state',
                details: response.data // Include raw details for debugging
            };

            if (response.status === 200 && response.data && response.data.code === 0 && response.data.data) {
                const taskData = response.data.data;
                let modelUrl = null;
                let progressPercent = taskData.progress || 0; // Use progress if available, default 0
                const status = taskData.status || 'unknown';
                let message = taskData.status_message || status;
                let success = true;
                let errorMsg = null;
                
                // Check progress value - if very close to 100%, treat as complete
                if (progressPercent >= 99.5 && status !== 'success' && status !== 'completed') {
                    console.log(`⚠️ Task at ${progressPercent}% but status is ${status}. Treating as completed.`);
                    // Force success status for tasks that appear to be stuck at high percentage
                    responsePayload.status = 'success';
                    progressPercent = 100;
                } else {
                    responsePayload.status = status; // Update status from taskData
                }

                // Check for completion status
                if (status === 'success' || status === 'completed' || progressPercent >= 99.5) {
                    console.log(`✅ Task ${taskId} completed successfully.`);
                    progressPercent = 100; // Ensure progress is 100

                    // Try to extract the model URL based on latest logs (output.pbr_model)
                    if (taskData.output && typeof taskData.output === 'object') {
                        console.log(`⚙️ Checking 'output' object for model URL...`);
                        // Look for model URLs in order of preference
                        if (typeof taskData.output.pbr_model === 'string' && taskData.output.pbr_model.length > 0) {
                            modelUrl = taskData.output.pbr_model;
                            console.log(`✅ Extracted model URL from output.pbr_model: ${modelUrl}`);
                        } else if (typeof taskData.output.model === 'string' && taskData.output.model.length > 0) { // Fallback 1
                            modelUrl = taskData.output.model;
                            console.log(`✅ Extracted model URL from output.model (fallback): ${modelUrl}`);
                        } else if (typeof taskData.output.base_model === 'string' && taskData.output.base_model.length > 0) { // Fallback 2
                            modelUrl = taskData.output.base_model;
                            console.log(`✅ Extracted model URL from output.base_model (fallback): ${modelUrl}`);
                        } else {
                            // Look for any property that might contain a URL with .glb
                            for (const key in taskData.output) {
                                if (typeof taskData.output[key] === 'string' && 
                                    (taskData.output[key].endsWith('.glb') || 
                                     taskData.output[key].includes('.glb?'))) {
                                    modelUrl = taskData.output[key];
                                    console.log(`✅ Found model URL in output.${key}: ${modelUrl}`);
                                    break;
                                }
                            }
                            
                            if (!modelUrl) {
                                console.warn(`⚠️ Task completed but expected model URL not found in output object.`);
                                console.warn(`-> Received output object: ${JSON.stringify(taskData.output)}`);
                            }
                        }
                    } else {
                        console.warn(`⚠️ Task completed but the 'output' object itself is missing or not an object.`);
                        
                        // Try legacy/direct formats as fallbacks
                        if (taskData.modelUrl) {
                            modelUrl = taskData.modelUrl;
                            console.log(`✅ Found model URL in direct modelUrl field: ${modelUrl}`);
                        } else if (taskData.model_url) {
                            modelUrl = taskData.model_url;
                            console.log(`✅ Found model URL in model_url field: ${modelUrl}`);
                        } else if (taskData.url) {
                            modelUrl = taskData.url;
                            console.log(`✅ Found model URL in url field: ${modelUrl}`);
                        }
                    }

                    // Final check for modelUrl
                    if (modelUrl) {
                        message = 'Model ready';
                        responsePayload.modelUrl = modelUrl;
                    } else {
                         success = false;
                         errorMsg = 'Output model file URL not found in API response structure.';
                         message = errorMsg;
                         responsePayload.status = 'error'; // Override status
                         console.error(`❌ Failed to find model URL in task response. Check logs.`);
                    }
                } else if (status === 'failed' || status === 'error') {
                    // Handle explicit failure status
                    console.error(`❌ Task ${taskId} failed. Status: ${status}`);
                     success = false;
                     errorMsg = taskData.error || 'Task failed with unspecified error.';
                     message = errorMsg;
                     // Keep progress as reported by API if available, else 0
                } else {
                    // Still processing
                     success = true; // Still successfully polling
                     message = `Processing (${parseFloat(progressPercent).toFixed(0)}%)`;
                     console.log(`📊 Task ${taskId} in progress. Status: ${status}, Progress: ${progressPercent}%`);
                }

                // Update final responsePayload fields
                responsePayload.success = success;
                responsePayload.message = message;
                responsePayload.progress = parseFloat(progressPercent);
                responsePayload.error = errorMsg;

            } else {
                // Handle non-200 status or API error code (!== 0) or missing data
                console.error(`📊 TRIPO STATUS CHECK: Received non-success status or API error.`);
                console.error(`- Status: ${response.status}, API Code: ${response.data?.code ?? 'N/A'}`);
                 responsePayload.error = response.data?.message || `Status check failed with HTTP status ${response.status}`;
                 responsePayload.message = responsePayload.error;
                 responsePayload.success = false;
                 responsePayload.status = 'error';
                 // Use HTTP status code from API if it indicates an error
                 if (response.status >= 400) {
                     return res.status(response.status).json(responsePayload);
                 }
            }
            // Send the final response
             res.json(responsePayload);

        } catch (error) {
            // Handle exceptions during the Axios request itself
            console.error('❌ Exception during status check request:', error.message);
             responsePayload = {
                success: false,
                status: 'error',
                error: 'Failed to execute status check request',
                details: error.message
            };
            if (error.response) {
                console.error(`- Response Status: ${error.response.status}`);
                console.error(`- Response Data: ${JSON.stringify(error.response.data)}`);
                 responsePayload.details = error.response.data; // Add more detail
                return res.status(error.response.status).json(responsePayload);
            } else if (error.request) {
                console.error('- No response received from status server.');
                 responsePayload.error = 'No response from status server';
            }
             res.status(500).json(responsePayload);
        }
    } catch (outerError) {
         // Handle unexpected errors in the route handler logic itself
         console.error('❌ Unexpected error in status check route:', outerError);
          responsePayload = {
            success: false,
            status: 'error',
            error: 'Internal server error during status check',
            details: outerError.message
        };
         res.status(500).json(responsePayload);
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
    console.log(`  image-to-model API: http://localhost:${port}/api/generate`);
    console.log(`  Text-to-3D API: http://localhost:${port}/api/generateText`);
    console.log(`  Status API: http://localhost:${port}/api/status/:taskId`);
    console.log('-------------------------------------------');
    console.log('PRESS CTRL+C TO STOP SERVER');
    console.log('-------------------------------------------');
}); 