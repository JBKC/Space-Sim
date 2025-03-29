// DOM Elements
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const generateBtn = document.getElementById('generateBtn');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const modelViewer = document.getElementById('modelViewer');
const downloadSection = document.getElementById('downloadSection');
const downloadLink = document.getElementById('downloadLink');
const loadingSpinner = document.getElementById('loadingSpinner');
const modelViewerStatus = document.getElementById('modelViewerStatus');

// Webcam related DOM elements
const webcamButton = document.getElementById('webcamButton');
const webcamModal = document.getElementById('webcamModal');
const webcamVideo = document.getElementById('webcamVideo');
const webcamCanvas = document.getElementById('webcamCanvas');
const captureButton = document.getElementById('captureButton');
const closeWebcamButton = document.querySelector('.close-webcam');

// Global variables
let uploadedImage = null;
let processedImage = null; // New: store the processed image
let scene, camera, renderer, controls, model;
let taskId = null;
let statusCheckInterval = null;
let currentModelUrl = null; // Store the model URL for download 
let stream = null; // Store the webcam stream
let isProcessingImage = false; // Flag to prevent multiple processing requests

// Server API endpoints
const SERVER_URL = 'http://localhost:3000';
const GENERATE_ENDPOINT = '/api/generate';
const STATUS_ENDPOINT = '/api/status';
const PROCESS_IMAGE_ENDPOINT = '/api/process-image'; // New endpoint for image processing

// Initialize 3D viewer
initializeViewer();

// Setup event listeners
setupEventListeners();

function setupEventListeners() {
    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);
    
    // Fix: Add preventDefault to stop the page from reloading when clicking the label 
    // and separate the file input click handler from the dropArea click handler
    const fileInputLabel = document.querySelector('.file-input-label');
    if (fileInputLabel) {
        fileInputLabel.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        }, false);
    } else {
        // Fallback to the old method if label not found
        dropArea.addEventListener('click', () => fileInput.click(), false);
    }
    
    generateBtn.addEventListener('click', generateModel, false);

    // Setup webcam related event listeners
    webcamButton.addEventListener('click', openWebcam, false);
    closeWebcamButton.addEventListener('click', closeWebcam, false);
    captureButton.addEventListener('click', captureAndUsePhoto, false);

    // Close modal when clicking outside the modal content
    webcamModal.addEventListener('click', (e) => {
        if (e.target === webcamModal) {
            closeWebcam();
        }
    });

    // Display any errors in the console
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', event.error);
        statusMessage.textContent = `Error: ${event.error.message}`;
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropArea.classList.add('active');
}

function unhighlight() {
    dropArea.classList.remove('active');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.match('image.*')) {
            // Add image validation
            validateAndProcessImage(file);
            // Don't enable generate button immediately
            // Instead, process with Gemini API first
            processWithGemini(file);
        } else {
            alert('Please upload an image file.');
        }
    }
}

// New function to validate and process images
function validateAndProcessImage(file) {
    uploadedImage = file;
    
    // Check file size
    if (file.size > 5 * 1024 * 1024) {
        console.warn('Large image detected (>5MB). This may cause API issues.');
        document.getElementById('processingText').textContent = 'Warning: Large image may cause issues';
    } else if (file.size < 10 * 1024) {
        console.warn('Small image detected (<10KB). This may not provide enough detail.');
        document.getElementById('processingText').textContent = 'Warning: Image may be too small';
    }
    
    // Check if this is a webcam capture
    if (file.name.startsWith('webcam-capture-')) {
        console.log('Processing webcam capture');
    }
    
    // Display preview
    displayPreview(file);
    
    // Log details about the image
    console.log(`Processing image: ${file.name}, Size: ${(file.size / 1024).toFixed(2)}KB, Type: ${file.type}`);
}

// Display preview with error handling
function displayPreview(file) {
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.file = file;
    preview.appendChild(img);

    const reader = new FileReader();
    
    // Add error handling
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        preview.innerHTML = '<p style="color: red;">Error loading preview</p>';
    };
    
    reader.onload = (e) => { 
        img.src = e.target.result; 
        
        // Verify the image loaded properly
        img.onload = function() {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                console.error('Invalid image file');
                preview.innerHTML = '<p style="color: red;">Invalid image file</p>';
                uploadedImage = null;
                generateBtn.disabled = true;
            }
        };
        
        img.onerror = function() {
            console.error('Error displaying image');
            preview.innerHTML = '<p style="color: red;">Error displaying image</p>';
            uploadedImage = null;
            generateBtn.disabled = true;
        };
    };
    
    reader.readAsDataURL(file);
}

async function generateModel() {
    if (!uploadedImage) {
        alert('Please upload an image first.');
        return;
    }

    // Update UI for processing state
    generateBtn.disabled = true;
    
    // Show processing status over the model viewer with spinner
    modelViewerStatus.style.display = 'flex';
    document.getElementById('processingText').textContent = 'Model generating...';

    try {
        // Create form data to send the image
        const formData = new FormData();
        formData.append('image', uploadedImage);
        
        console.log('Sending image to server...');
        
        // Send the image to the server endpoint
        const response = await fetch(`${SERVER_URL}${GENERATE_ENDPOINT}`, {
            method: 'POST',
            body: formData
        });

        // Get the text response first to examine it
        const responseText = await response.text();
        console.log('Server response text:', responseText);
        
        // Try to parse as JSON
        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log('Successfully parsed server response as JSON:', responseData);
        } catch (e) {
            console.error('Error parsing response as JSON:', e);
            throw new Error(`Invalid response format from server: ${responseText.substring(0, 100)}...`);
        }

        if (!response.ok) {
            console.error('Server returned error status:', response.status);
            throw new Error(`Server error: ${responseData.error || response.status}. Details: ${JSON.stringify(responseData.details || {})}`);
        }
        
        console.log('Full parsed response data:', responseData);
        
        // Verify we received a valid task_id
        if (!responseData.task_id) {
            console.error('No task_id in response:', responseData);
            // Check if there's a nested structure that wasn't properly processed by the server
            if (responseData.code === 200 && responseData.data && responseData.data.task_id) {
                // Extract task_id directly from the nested structure
                console.log('Found nested task_id in response that server missed');
                taskId = responseData.data.task_id;
            } else {
                statusMessage.textContent = 'Error: No task ID found in response';
                throw new Error(`No task ID returned from server. Full response: ${JSON.stringify(responseData)}`);
            }
        } else {
            // Use the task_id provided by the server
            taskId = responseData.task_id;
        }
        
        console.log('Using task_id:', taskId);
        statusMessage.textContent = 'Processing...';
        
        // Start polling for status
        startStatusPolling();
    } catch (error) {
        console.error('Error generating model:', error);
        displayUserFriendlyError(error, 'processingText');
        modelViewerStatus.style.display = 'flex';
        // Always ensure the download button remains hidden on error
        downloadSection.style.display = 'none';
    }
}

function startStatusPolling() {
    // Clear any existing interval
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Set a new interval to check status every 5 seconds
    statusCheckInterval = setInterval(checkTaskStatus, 5000);
}

async function checkTaskStatus() {
    try {
        if (!taskId) {
            console.error('No task ID available for status check');
            document.getElementById('processingText').textContent = 'Error';
            clearInterval(statusCheckInterval);
            generateBtn.disabled = false;
            return;
        }
        
        console.log('Checking status for task:', taskId);
        
        // Call the server endpoint with the taskId
        const response = await fetch(`${SERVER_URL}${STATUS_ENDPOINT}/${taskId}`);

        // Get the text response first to examine it
        const responseText = await response.text();
        console.log('Status response text:', responseText);
        
        // Try to parse as JSON
        let statusData;
        try {
            statusData = JSON.parse(responseText);
            console.log('Successfully parsed status response as JSON:', statusData);
        } catch (e) {
            console.error('Error parsing status response as JSON:', e);
            throw new Error(`Invalid status response format from server: ${responseText.substring(0, 100)}...`);
        }

        if (!response.ok) {
            console.error('Status check returned error:', response.status);
            throw new Error(`Server error: ${statusData.error || response.status}. Details: ${JSON.stringify(statusData.details || {})}`);
        }
        
        console.log('Full parsed status data:', statusData);
        
        // If the server didn't process the nested structure correctly, do it here
        let status, output;
        if (statusData.code === 200 && statusData.data) {
            console.log('Found nested structure in status response that server missed');
            status = statusData.data.status;
            output = statusData.data.output;
        } else {
            // Use the data from the server
            status = statusData.status;
            output = statusData.output;
        }
        
        // Log the output object details
        console.log('Model output details:', output);
        
        // Update progress based on status
        if (status === 'succeeded' || status === 'completed') {
            clearInterval(statusCheckInterval);
            
            // Load the 3D model
            if (output && output.model_file) {
                console.log('Original model URL:', output.model_file);
                // Use the proxy endpoint for the model viewer to avoid CORS issues
                const proxiedModelUrl = `${SERVER_URL}/api/proxy-model?url=${encodeURIComponent(output.model_file)}`;
                console.log('Loading model using proxy URL:', proxiedModelUrl);
                
                // Use original URL for direct download link - browsers handle CORS differently for downloads
                currentModelUrl = output.model_file; 
                loadModel(proxiedModelUrl, output.model_file);
            } else {
                console.error('No model file URL found in output:', output);
                document.getElementById('processingText').textContent = 'Error: No model file';
                throw new Error('No model file in the response');
            }
            
            generateBtn.disabled = false;
        } else if (status === 'failed' || status === 'error') {
            clearInterval(statusCheckInterval);
            document.getElementById('processingText').textContent = 'Generation failed';
            generateBtn.disabled = false;
            // Add additional error feedback to help the user
            if (status.includes('failed')) {
                let failureMessage = 'Model generation failed. Try a different image with:';
                failureMessage += '<ul style="text-align:left; margin-top:10px;">';
                failureMessage += '<li>Clear object boundaries</li>';
                failureMessage += '<li>Good lighting</li>';
                failureMessage += '<li>Simple background</li>';
                failureMessage += '<li>Single object focus</li>';
                failureMessage += '</ul>';
                document.getElementById('processingText').innerHTML = failureMessage;
            }
        } else {
            // Still processing
            document.getElementById('processingText').textContent = 'Model generating...';
        }
    } catch (error) {
        console.error('Error checking task status:', error);
        displayUserFriendlyError(error, 'processingText');
        clearInterval(statusCheckInterval);
        generateBtn.disabled = false;
    }
}

function initializeViewer() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6e6cf); // Light beige background matching the UI

    // Create camera
    camera = new THREE.PerspectiveCamera(75, modelViewer.clientWidth / modelViewer.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create renderer with enhanced quality settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,              // Enable anti-aliasing
        preserveDrawingBuffer: true,  // Needed for taking screenshots
        alpha: true,                  // Allow transparency
        powerPreference: 'high-performance', // Request high performance GPU
        precision: 'highp'           // Use high precision for better visuals
    });
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Use device pixel ratio for sharper display
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
    
    // For THREE.js r129 and newer, use these settings
    try {
        // For newer versions of THREE.js
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.5; // Reduced exposure for less shine
        renderer.logarithmicDepthBuffer = true; // Better handling of near/far objects
    } catch (e) {
        // Fallback for older versions
        try {
            renderer.physicallyCorrectLights = true;
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMappingExposure = 1.5;
            renderer.gammaOutput = true;
            renderer.gammaFactor = 2.2;
        } catch (err) {
            console.warn('Could not set advanced renderer properties:', err);
        }
    }
    modelViewer.appendChild(renderer.domElement);

    // Add environment map for realistic reflections
    try {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        // Create a simple environment map
        const environmentTexture = createEnvironmentTexture();
        const envMap = pmremGenerator.fromEquirectangular(environmentTexture).texture;
        
        scene.environment = envMap;
        scene.background = new THREE.Color(0xf6e6cf); // Keep the light beige background
        
        // Store the environment map for later use
        window.envMap = envMap;
        
        environmentTexture.dispose();
        pmremGenerator.dispose();
    } catch (e) {
        console.warn('Could not set up environment mapping:', e);
    }
    
    // Set up softer lighting for light mode
    // Ambient light (overall scene illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // Softer ambient for light mode
    scene.add(ambientLight);

    // Main directional light (sun-like)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8); // Softer main light
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    
    // Configure shadow properties
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.0001;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);

    // Add fill lights
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.4); // Softer fill light
    fillLight1.position.set(-5, 5, -5);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4); // Softer fill light
    fillLight2.position.set(5, -5, -5);
    scene.add(fillLight2);
    
    // Add a gentle rim light for subtle definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 0, -5);
    scene.add(rimLight);

    // Add controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 0.2; // Allow even closer zoom
    controls.maxDistance = 10;
    controls.autoRotate = true; // Enable auto-rotation by default
    controls.autoRotateSpeed = 1.0;

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Empty scene - no cube anymore
    
    // Animate the scene
    animate();
}

// Create a simple procedural environment texture with lighter colors
function createEnvironmentTexture() {
    const size = 512;
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const idx = (i * size + j) * 4;
            
            // Simple gradient for light mode
            const phi = Math.PI * i / size;
            const theta = 2 * Math.PI * j / size;
            
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);
            
            // Sky (soft gradient to match the theme)
            if (y > 0) {
                const intensity = 0.95 + 0.05 * y; // Subtle gradient
                // Convert #f6e6cf to RGB
                data[idx] = Math.floor(246 * intensity); // R
                data[idx + 1] = Math.floor(230 * intensity); // G
                data[idx + 2] = Math.floor(207 * intensity); // B
                data[idx + 3] = 255; // A
            } 
            // Ground (slightly darker tone)
            else {
                const intensity = 0.9 + 0.1 * (-y); // Subtle gradient
                // Slightly darker than the main color
                data[idx] = Math.floor(226 * intensity); // R
                data[idx + 1] = Math.floor(210 * intensity); // G
                data[idx + 2] = Math.floor(187 * intensity); // B
                data[idx + 3] = 255; // A
            }
        }
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    
    return texture;
}

function loadModel(modelUrl, originalUrl) {
    try {
        // Store the URL for the download button
        if (originalUrl) {
            downloadLink.href = originalUrl;
        } else {
            downloadLink.href = modelUrl;
        }
        downloadLink.download = 'model.glb'; // Suggest a filename
        
        // Clear existing model
        if (model) {
            scene.remove(model);
        }

        // Log that we're attempting to load the model
        console.log('Attempting to load 3D model from:', modelUrl);
        
        // Create a loader with a manager to track progress and errors
        const manager = new THREE.LoadingManager();
        manager.onProgress = function(item, loaded, total) {
            const percent = Math.round((loaded / total) * 100);
            document.getElementById('processingText').textContent = `Model generating...`;
            console.log(`Loading progress: ${loaded}/${total} (${percent}%)`);
        };
        
        manager.onError = function(url) {
            console.error('Error loading resource:', url);
            document.getElementById('processingText').textContent = 'Error loading model';
        };
        
        const loader = new THREE.GLTFLoader(manager);
        
        // Add a crossOrigin header if needed (for cross-domain requests)
        THREE.Cache.enabled = true;
        
        // Load the model with error handling
        loader.load(
            modelUrl,
            function (gltf) {
                console.log('Model loaded successfully:', gltf);
                model = gltf.scene;
                
                // Enable shadows and enhance materials for the whole model and its children
                model.traverse(function(node) {
                    if (node.isMesh) {
                        // Enable shadows
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        // Apply high-quality material enhancements
                        if (node.material) {
                            if (Array.isArray(node.material)) {
                                node.material.forEach(mat => enhanceMaterial(mat));
                            } else {
                                enhanceMaterial(node.material);
                            }
                        }
                    }
                });
                
                // Apply post-processing for the entire model
                applyModelPostProcessing(model);
                
                // Center the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Get model size to adjust camera
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                
                // Add the model to the scene
                scene.add(model);
                
                // Adjust camera position based on model size for better fit in smaller viewer
                const distance = maxDim * 0.5; // More zoomed out for better fit in smaller viewer
                camera.position.set(distance, distance, distance);
                camera.lookAt(0, 0, 0);
                
                // Reset controls target to model center
                controls.target.set(0, 0, 0);
                controls.update();
                
                // Fine-tune the controls for the smaller viewer
                controls.minDistance = 0.2;
                controls.maxDistance = maxDim * 3.0;
                controls.autoRotate = true; // Enable auto-rotation
                controls.autoRotateSpeed = 0.8; // Slightly slower rotation
                
                // Hide the status overlay once model is loaded
                modelViewerStatus.style.display = 'none';
                
                // Show download section
                downloadSection.style.display = 'block';
            },
            function (xhr) {
                // Progress
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                document.getElementById('processingText').textContent = `Model generating...`;
                console.log(`Loading progress: ${percent}%`);
            },
            function (error) {
                console.error('Error loading model:', error);
                document.getElementById('processingText').textContent = 'Error loading model';
                
                // Make sure the download button is visible even if the model fails to load
                downloadSection.style.display = 'block';
            }
        );
    } catch (error) {
        console.error('Exception in loadModel:', error);
        document.getElementById('processingText').textContent = 'Error loading model';
        
        // Always ensure download button is visible
        downloadSection.style.display = 'block';
    }
}

// Enhanced material processing with more matte finish
function enhanceMaterial(material) {
    if (!material) return;
    
    // Store original properties
    const origColor = material.color ? material.color.clone() : null;
    const origMap = material.map;
    
    // For standard materials, adjust properties for less shiny surface
    if (material.isMeshStandardMaterial) {
        // Set higher roughness for more matte appearance
        material.roughness = Math.max(material.roughness, 0.8); // Much higher roughness for matte look
        material.metalness = Math.min(material.metalness, 0.1); // Much lower metalness for less shine
        
        // Reduce environment map reflections for a more matte finish
        if (window.envMap) {
            material.envMap = window.envMap;
            material.envMapIntensity = 0.5; // Reduced for less reflections
        }
        
        // Keep normal map detail but tone down the effect
        if (material.normalMap) {
            material.normalScale.set(1.0, 1.0); // Normal scale for surface detail
        }
        
        // Keep anisotropy for texture quality
        if (material.map) {
            material.map.anisotropy = 16;
        }
    }
    
    // Handle basic materials by converting to standard with matte finish
    else if (material.isMeshBasicMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial) {
        console.log('Converting basic/lambert/phong material to standard with matte finish');
        const newMat = new THREE.MeshStandardMaterial({
            color: origColor || new THREE.Color(0xcccccc),
            map: origMap,
            roughness: 0.8,  // Higher for matte finish
            metalness: 0.1   // Lower for less shine
        });
        
        // Copy any other useful properties
        if (material.transparent) newMat.transparent = true;
        if (material.opacity !== undefined) newMat.opacity = material.opacity;
        if (material.alphaTest !== undefined) newMat.alphaTest = material.alphaTest;
        if (material.side !== undefined) newMat.side = material.side;
        
        // Apply environment map with reduced intensity
        if (window.envMap) {
            newMat.envMap = window.envMap;
            newMat.envMapIntensity = 0.5; // Reduced for less reflection
        }
        
        // Keep anisotropy for texture quality
        if (newMat.map) {
            newMat.map.anisotropy = 16;
        }
        
        // Replace the original material
        try {
            Object.assign(material, newMat);
        } catch (e) {
            console.warn('Could not fully convert material:', e);
        }
    }
    
    // Force material update
    material.needsUpdate = true;
}

// Apply post-processing to the entire model
function applyModelPostProcessing(model) {
    if (!model) return;
    
    // Check if we need to normalize the model's scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // If the model is too small or too large, normalize its size
    if (maxDim < 0.1 || maxDim > 10) {
        const scale = 1.0 / maxDim;
        model.scale.set(scale, scale, scale);
        console.log(`Normalized model scale from ${maxDim} to 1.0`);
    }
    
    // Ensure model gets environment lighting
    model.castShadow = true;
    model.receiveShadow = true;
}

function onWindowResize() {
    camera.aspect = modelViewer.clientWidth / modelViewer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Function to display a friendly error message
function displayUserFriendlyError(error, location = 'processingText') {
    console.error('Error:', error);
    
    // Default error message
    let userMessage = 'An error occurred. Please try again.';
    
    // Check if this is an API error with details
    if (error.message && error.message.includes('API Error')) {
        userMessage = 'The 3D generation service could not process your image. Try a different image with better lighting and clear subject boundaries.';
    }
    
    // Check if this is a network error
    if (error.message && error.message.includes('NetworkError')) {
        userMessage = 'Connection error. Please check your internet connection and try again.';
    }
    
    // Server error
    if (error.message && error.message.includes('Server error')) {
        userMessage = 'The server encountered an error. Please try again later.';
    }
    
    // Update the appropriate element
    if (location === 'statusMessage') {
        statusMessage.textContent = userMessage;
    } else {
        document.getElementById('processingText').innerHTML = userMessage;
    }
    
    // Re-enable the generate button
    generateBtn.disabled = false;
}

// Webcam related functions
async function openWebcam() {
    webcamModal.style.display = 'block';
    captureButton.style.display = 'block';
    webcamVideo.style.display = 'block';
    webcamCanvas.style.display = 'none';
    
    try {
        // Request access to the webcam
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamVideo.srcObject = stream;
    } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Unable to access webcam. Please check your permissions and try again.');
        closeWebcam();
    }
}

function closeWebcam() {
    webcamModal.style.display = 'none';
    
    // Stop the webcam stream if it exists
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// Modified function to handle files
function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.match('image.*')) {
            // Add image validation
            validateAndProcessImage(file);
            // Don't enable generate button immediately
            // Instead, process with Gemini API first
            processWithGemini(file);
        } else {
            alert('Please upload an image file.');
        }
    }
}

// New function to process image with Google Gemini API
async function processWithGemini(file) {
    if (isProcessingImage) return; // Prevent multiple processing
    isProcessingImage = true;
    
    // Disable generate button during processing
    generateBtn.disabled = true;
    
    try {
        // Show processing status
        modelViewerStatus.style.display = 'flex';
        document.getElementById('processingText').textContent = 'Removing background and shadows...';
        
        // Create form data for the image
        const formData = new FormData();
        formData.append('image', file);
        
        // Add a custom prompt - this can be changed to anything
        const geminiPrompt = "Remove background and shadows from this object";
        formData.append('prompt', geminiPrompt);
        
        // Call the server endpoint
        const response = await fetch(`${SERVER_URL}${PROCESS_IMAGE_ENDPOINT}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.processedImage) {
            throw new Error('Failed to process image');
        }
        
        // Convert base64 to a Blob
        const imageBlob = base64ToBlob(result.processedImage, 'image/png');
        
        // Convert Blob to File
        const fileName = file.name.replace(/\.[^/.]+$/, '') + '_processed.png';
        processedImage = new File([imageBlob], fileName, { type: 'image/png' });
        
        // Create a dedicated element to display the processed image in the bottom left
        displayProcessedImageBottomLeft(result.processedImage);
        
        // Update status message
        document.getElementById('processingText').textContent = 'Starting 3D model generation...';
        
        // Automatically trigger model generation after a short delay
        // to give users a chance to see the processed image
        setTimeout(() => {
            uploadedImage = processedImage; // Use the processed image for generation
            generateModel();
        }, 1500); // 1.5 second delay to allow time to see the processed image
        
    } catch (error) {
        console.error('Error processing with Gemini:', error);
        document.getElementById('processingText').textContent = 'Error processing image. Proceeding with original.';
        
        // Fall back to the original image
        setTimeout(() => {
            uploadedImage = file; // Use the original image for generation
            generateModel();
        }, 1500);
    } finally {
        isProcessingImage = false;
    }
}

// Helper function to convert base64 to Blob
function base64ToBlob(base64, mimeType) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeType });
}

// New function to display the processed image in the bottom left corner of the UI
function displayProcessedImageBottomLeft(base64Image) {
    // First check if there's already a processed image section and remove it
    let existingSection = document.getElementById('processedImageSection');
    if (existingSection) {
        existingSection.remove();
    }
    
    // Create a new section for the processed image
    const processedSection = document.createElement('div');
    processedSection.id = 'processedImageSection';
    processedSection.className = 'processed-image-section';
    
    // Create image element
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${base64Image}`;
    img.alt = 'Processed Image';
    img.className = 'processed-image';
    
    // Add label
    const label = document.createElement('div');
    label.className = 'processed-image-title';
    label.textContent = 'AI-Processed Image';
    
    // Add elements to the section
    processedSection.appendChild(label);
    processedSection.appendChild(img);
    
    // Add the section to the page in the bottom left
    const leftPanel = document.querySelector('.left-panel');
    leftPanel.appendChild(processedSection);
    
    // Also update the preview area as before
    displayProcessedImage(base64Image);
}

// Modified webcam capture function
function captureAndUsePhoto() {
    const context = webcamCanvas.getContext('2d');
    
    // Set canvas dimensions to match the video
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    
    // Draw the current video frame on the canvas
    context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
    
    // Process the captured photo immediately
    processWebcamCapture();
}

// Modified to process with Gemini after webcam capture
function processWebcamCapture() {
    try {
        webcamCanvas.toBlob((blob) => {
            if (!blob) {
                throw new Error('Failed to create image from webcam');
            }
            
            // Create a File object from the Blob
            const currentDate = new Date();
            const fileName = `webcam-capture-${currentDate.getTime()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Process the file as if it was uploaded
            uploadedImage = file;
            displayPreview(file);
            
            // Close the webcam modal
            closeWebcam();
            
            // Process with Gemini (which will trigger model generation)
            processWithGemini(file);
            
        }, 'image/png', 0.95); // Add quality parameter for better images
    } catch (error) {
        console.error('Error processing webcam photo:', error);
        alert('Failed to process webcam photo. Please try again.');
        closeWebcam();
    }
}

// Display the processed image in the preview area
function displayProcessedImage(base64Image) {
    // Create a separate container for the processed image
    const processedContainer = document.createElement('div');
    processedContainer.className = 'processed-image-container';
    
    // Create image element
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${base64Image}`;
    img.alt = 'Processed Image';
    
    // Add label
    const label = document.createElement('p');
    label.textContent = 'AI-Processed'; // More generic text that doesn't specifically mention background removal
    label.className = 'processed-image-label';
    
    // Add to preview
    processedContainer.appendChild(img);
    processedContainer.appendChild(label);
    
    // Clear previous preview and add new container
    preview.innerHTML = '';
    preview.appendChild(processedContainer);
} 