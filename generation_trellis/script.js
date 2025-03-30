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

// Global variables
let uploadedImage = null;
let processedImage = null; // New: store the processed image
let scene, camera, renderer, controls, model;
let taskId = null;
let statusCheckInterval = null;
let currentModelUrl = null; // Store the model URL for download 
let isProcessingImage = false; // Flag to prevent multiple processing requests
let statusCheckErrorCount = 0;

// Server API endpoints
const SERVER_URL = 'http://localhost:3001';
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
        } else {
            statusMessage.textContent = 'Please upload an image file.';
        }
    }
}

function validateAndProcessImage(file) {
    // Clear any existing previews
    preview.innerHTML = '';
    
    // Display loading message
    statusMessage.textContent = 'Processing image...';
    
    // Display initial preview
    displayPreview(file);
    
    // Store the uploaded image
    uploadedImage = file;
    
    // Process with Gemini
    processWithGemini(file);
}

function displayPreview(file) {
    // Create an initial preview
    const img = document.createElement('img');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        img.src = e.target.result;
    }
    
    preview.appendChild(img);
    reader.readAsDataURL(file);
}

async function generateModel() {
    if (!processedImage) {
        statusMessage.textContent = 'Please upload and process an image first.';
        return;
    }
    
    // Update UI state
    statusMessage.textContent = 'Generating 3D model...';
    generateBtn.disabled = true;
    loadingSpinner.style.display = 'flex';
    
    // Show the model viewer status overlay
    modelViewerStatus.style.display = 'flex';
    document.getElementById('processingText').innerText = 'Model generation started...';
    
    try {
        // Create a FormData object
        const formData = new FormData();
        
        // Make sure we're sending a proper file, not a base64 string
        if (typeof processedImage === 'string') {
            // If it's a base64 string, convert to file first
            processedImage = base64ToFile(processedImage, 'processed_image.png');
        }
        
        formData.append('image', processedImage);
        
        console.log('Sending image for 3D model generation, type:', processedImage.type, 'size:', processedImage.size);
        
        // Make the API call with retry logic
        let response;
        let retries = 0;
        const maxRetries = 2;
        
        while (retries <= maxRetries) {
            try {
                console.log(`Attempt ${retries + 1} to generate model...`);
                response = await fetch(`${SERVER_URL}${GENERATE_ENDPOINT}`, {
                    method: 'POST',
                    body: formData,
                    // Add a longer timeout for large image uploads
                    timeout: 60000 // 60 seconds
                });
                
                // Exit retry loop if successful
                break;
            } catch (err) {
                retries++;
                console.error(`Attempt ${retries} failed:`, err);
                
                if (retries > maxRetries) {
                    throw err; // Give up after max retries
                }
                
                // Update status for retry
                document.getElementById('processingText').innerText = `Retrying (${retries}/${maxRetries})...`;
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
        
        // Handle the response
        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg;
            
            try {
                // Try to parse as JSON for structured error
                const errorData = JSON.parse(errorText);
                errorMsg = errorData.error || errorData.details || `Server error: ${response.status}`;
            } catch (e) {
                // If can't parse as JSON, use text
                errorMsg = `Server responded with ${response.status}: ${errorText.substring(0, 100)}`;
            }
            
            throw new Error(errorMsg);
        }
        
        // Parse JSON response
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`Invalid response format: ${e.message}`);
        }
        
        if (data.success) {
            // Store the task ID for status polling
            taskId = data.task_id;
            console.log('Model generation task started. Task ID:', taskId);
            
            // Start polling for status updates
            startStatusPolling();
        } else {
            throw new Error(data.error || 'Failed to start model generation.');
        }
    } catch (error) {
        console.error('Error generating model:', error);
        statusMessage.textContent = `Error: ${error.message}`;
        loadingSpinner.style.display = 'none';
        generateBtn.disabled = false;
        
        // Update the model viewer status with the error
        displayUserFriendlyError(error);
    }
}

function startStatusPolling() {
    // Set a polling interval - check status every 2 seconds
    statusCheckInterval = setInterval(checkTaskStatus, 2000);
}

function checkTaskStatus() {
    console.log(`Checking status for task: ${taskId}`);
    
    fetch(`${SERVER_URL}/api/status?task_id=${taskId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Status check failed with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Client received status response:', data);
            
            // Debug logging to see exactly what's in the response
            if (data.status) {
                console.log(`Status value: "${data.status}"`);
            }
            if (data.model_url) {
                console.log(`Model URL value: "${data.model_url}"`);
            }
            
            if (data.status === 'completed' && data.model_url) {
                // Task completed successfully with a model URL
                console.log(`Model generation completed! URL: ${data.model_url}`);
                statusMessage.textContent = 'Model generation completed!';
                
                // Store model URL for later use
                currentModelUrl = data.model_url;
                
                // Update the download link
                downloadLink.href = data.model_url;
                downloadLink.download = 'generated_model.glb';
                
                // Show the download section
                downloadSection.style.display = 'block';
                
                // Call the loadModel function with the URL
                console.log(`Loading model from URL: ${data.model_url}`);
                loadModel(data.model_url);
                
                // Update UI
                document.getElementById('processingText').innerText = 'Loading model...';
                
                // Stop the status check interval
                if (statusCheckInterval) {
                    console.log('Stopping status check interval');
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                }
                
                // Re-enable the generate button
                generateBtn.disabled = false;
            } else if (data.status === 'failed') {
                // Task failed
                console.error('Model generation failed:', data.error || 'Unknown error');
                statusMessage.textContent = `Model generation failed: ${data.error || 'Unknown error'}`;
                document.getElementById('processingText').innerText = 'Generation failed';
                document.getElementById('spinner').style.display = 'none';
                
                // Display a user-friendly error message
                displayUserFriendlyError({
                    message: data.error || 'Model generation failed. Please try again with a different image.'
                });
                
                // Stop the status check interval
                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                }
                
                // Re-enable the generate button
                generateBtn.disabled = false;
            } else {
                // Task is still processing
                console.log(`Model generation status: ${data.status}`);
                statusMessage.textContent = `Model generation in progress (${data.status})...`;
                
                // Update the processing text if needed
                let processingText = document.getElementById('processingText');
                const currentDots = (processingText.innerText.match(/\./g) || []).length;
                const newDots = (currentDots + 1) % 4;
                processingText.innerText = `Processing${'.'.repeat(newDots)}`;
            }
        })
        .catch(error => {
            console.error('Error checking task status:', error);
            statusMessage.textContent = `Error checking status: ${error.message}`;
            
            // If there are repeated errors, stop checking after 5 failures
            statusCheckErrorCount++;
            if (statusCheckErrorCount >= 5) {
                console.log('Too many status check errors, stopping checks');
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
                
                displayUserFriendlyError({
                    message: 'Lost connection to the server. Please try refreshing the page.'
                });
                
                // Re-enable the generate button
                generateBtn.disabled = false;
            }
        });
}

function initializeViewer() {
    // Create scene, camera, renderer, etc.
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Dark background color

    // Create camera
    const width = modelViewer.clientWidth;
    const height = modelViewer.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Append renderer to the container
    if (modelViewer.firstChild) {
        modelViewer.insertBefore(renderer.domElement, modelViewer.firstChild);
    } else {
        modelViewer.appendChild(renderer.domElement);
    }
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.target.set(0, 0, 0);
    
    // Add ambient light for basic illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    // Add directional light for sunlight effect
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(10, 10, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);
    
    // Add fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);
    
    // Add rim light for edge highlighting
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(5, 0, -10);
    scene.add(rimLight);
    
    // Add a ground plane with shadow
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        metalness: 0, 
        roughness: 0.8,
        transparent: true,
        opacity: 0.5
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Initialize an empty group to hold the model
    model = new THREE.Group();
    scene.add(model);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
}

function loadModel(modelUrl, originalUrl) {
    // Clear any existing model
    model.clear();
    
    // Update the viewer status
    document.getElementById('processingText').innerText = 'Loading model...';
    
    console.log('Loading model from URL:', modelUrl);
    
    // Check if this is an external URL that might have CORS issues
    if (modelUrl.startsWith('http') && !modelUrl.includes(window.location.hostname)) {
        console.log('External URL detected, may need CORS handling');
        
        // Use a CORS proxy for external URLs if needed
        if (modelUrl.includes('img.theapi.app') || modelUrl.includes('piapi.ai')) {
            console.log('Using Image proxy for Trellis API URL');
            // Add a custom header to ensure the image loads correctly
            const loader = new THREE.GLTFLoader();
            
            // Create a manager with custom headers
            const manager = new THREE.LoadingManager();
            manager.addHandler(/\.glb$/, loader);
            
            // Load the model with direct URL - most model servers allow this
            loader.load(
                modelUrl,
                onModelLoaded,
                onProgress,
                onError
            );
        } else {
            // For other external URLs, try direct loading first
            const loader = new THREE.GLTFLoader();
            loader.load(
                modelUrl,
                onModelLoaded,
                onProgress,
                onError
            );
        }
    } else {
        // For local URLs, load directly
        const loader = new THREE.GLTFLoader();
        loader.load(
            modelUrl,
            onModelLoaded,
            onProgress,
            onError
        );
    }
    
    // Function to handle the loaded model
    function onModelLoaded(gltf) {
        console.log('Model loaded successfully', gltf);
        
        // Hide the status overlay
        modelViewerStatus.style.display = 'none';
        
        // Process the loaded model
        const loadedModel = gltf.scene;
        
        // Apply material enhancements
        loadedModel.traverse(function(child) {
            if (child.isMesh) {
                // Make sure materials work correctly
                if (child.material) {
                    enhanceMaterial(child.material);
                } else if (Array.isArray(child.materials)) {
                    child.materials.forEach(enhanceMaterial);
                }
                
                // Ensure shadows are enabled
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Apply post-processing to the model
        applyModelPostProcessing(loadedModel);
        
        // Add to the scene
        model.add(loadedModel);
        
        // Set camera position based on model size
        fitCameraToObject(loadedModel);
        
        // Update status
        statusMessage.textContent = 'Model loaded successfully!';
        
        // Show download section with proper URL
        downloadSection.style.display = 'block';
        downloadLink.href = modelUrl;
        downloadLink.download = 'generated_model.glb';
    }
    
    // Progress callback
    function onProgress(xhr) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        document.getElementById('processingText').innerText = `Loading model: ${percent}%`;
        console.log(`Model loading: ${percent}%`);
    }
    
    // Error callback
    function onError(error) {
        console.error('Error loading model:', error);
        statusMessage.textContent = `Error loading model: ${error.message}`;
        displayUserFriendlyError(error);
        
        // If direct loading fails, try through a proxy
        if (!modelUrl.includes('proxy')) {
            console.log('Direct loading failed, attempting through proxy...');
            const proxyUrl = `${SERVER_URL}/api/proxy-model?url=${encodeURIComponent(modelUrl)}`;
            loadModel(proxyUrl);
        }
    }
    
    // Function to fit camera to the model
    function fitCameraToObject(object, offset = 1.5) {
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        
        // Set controls target to center of the object
        controls.target.copy(center);
        
        // Calculate the max dimension and required distance
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * offset;
        
        // Position camera
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, controls.target).normalize();
        direction.multiplyScalar(cameraDistance);
        camera.position.copy(controls.target).add(direction);
        
        // Update controls and camera
        camera.near = cameraDistance / 100;
        camera.far = cameraDistance * 100;
        camera.updateProjectionMatrix();
        controls.update();
    }
}

function enhanceMaterial(material) {
    if (!material) return;
    
    // Enhance material properties for better realism
    material.needsUpdate = true;
    
    // Set appropriate roughness and metalness values if not specified
    if (material.roughness === undefined || material.roughness === 0) {
        material.roughness = 0.4;
    }
    
    if (material.metalness === undefined) {
        material.metalness = 0.2;
    }
    
    // Ensure shadow casting is enabled
    material.shadowSide = THREE.FrontSide;
    
    // Make sure textures use correct encoding
    if (material.map) {
        material.map.encoding = THREE.sRGBEncoding;
        material.map.anisotropy = 16;
    }
    
    if (material.emissiveMap) {
        material.emissiveMap.encoding = THREE.sRGBEncoding;
    }
    
    if (material.specularMap) {
        material.specularMap.encoding = THREE.sRGBEncoding;
    }
    
    // Set physical material properties
    material.side = THREE.DoubleSide; // Render both sides in case of non-manifold geometry
}

function applyModelPostProcessing(model) {
    // Center the model at the origin
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    // Scale the model to a reasonable size
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 5) {
        const scale = 3 / maxDim;
        model.scale.multiplyScalar(scale);
    }
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

// Display a more detailed and helpful error message
function displayUserFriendlyError(error, location = 'processingText') {
    console.error('Error in application:', error);
    
    // Get the error display element
    const errorDisplay = document.getElementById(location);
    if (!errorDisplay) return;
    
    // Create a user-friendly error message
    let friendlyMessage = 'Sorry, something went wrong.';
    
    // Check for specific error types and customize the message
    if (error.message) {
        if (error.message.includes('Failed to initiate model generation')) {
            friendlyMessage = 'The 3D model generation service failed to process your request. This might be due to an issue with the API key or the server is currently unavailable. Please try again later or contact support.';
        }
        else if (error.message.includes('API Error')) {
            friendlyMessage = 'The 3D generation API returned an error. The server might be experiencing issues. Please try again later.';
        }
        else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
            friendlyMessage = 'There was a network error. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
            friendlyMessage = 'The server took too long to respond. Please try again later.';
        } else if (error.message.includes('404')) {
            friendlyMessage = 'The requested resource was not found. Please try again with a different image.';
        } else if (error.message.includes('server') || error.message.includes('500')) {
            friendlyMessage = 'There was a server error. Our team has been notified. Please try again later.';
        } else if (error.message.includes('format') || error.message.includes('parse')) {
            friendlyMessage = 'There was an error processing the response. Please try again with a different image.';
        } else if (error.message.includes('permission') || error.message.includes('403')) {
            friendlyMessage = 'You do not have permission to access this resource. Please contact support.';
        } else {
            // For other error messages, include them but truncate if too long
            const truncatedMessage = error.message.length > 100 ? 
                error.message.substring(0, 100) + '...' : error.message;
            friendlyMessage = `Error: ${truncatedMessage}`;
        }
    }
    
    // Display the error message
    errorDisplay.innerHTML = friendlyMessage;
    
    // Also update the status message
    if (location !== 'statusMessage' && statusMessage) {
        statusMessage.textContent = 'An error occurred.';
    }
    
    // Hide loading elements
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    
    // Show status overlay with error
    if (modelViewerStatus) {
        modelViewerStatus.style.display = 'flex';
    }
}

async function processWithGemini(file, autoGenerateModel = false) {
    // Prevent multiple processing requests
    if (isProcessingImage) {
        console.log('Already processing an image, please wait');
        return;
    }
    
    isProcessingImage = true;
    
    // Update status
    statusMessage.textContent = 'Processing image with Gemini...';
    
    try {
        // Create a FormData object with the image
        const formData = new FormData();
        formData.append('image', file);
        
        // Optional: Add a custom prompt
        const customPrompt = "Remove background and shadows from this object. Create a clean isolated image with a transparent background.";
        formData.append('prompt', customPrompt);
        
        // Send the request to the backend
        const response = await fetch(`${SERVER_URL}${PROCESS_IMAGE_ENDPOINT}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Image processed successfully with Gemini');
            
            // Convert base64 to file
            processedImage = base64ToFile(data.processedImage, 'processed_image.png');
            
            // Display the processed image
            displayProcessedImage(data.processedImage);
            
            // Display the analysis text if provided
            if (data.analysis) {
                console.log('Image analysis:', data.analysis);
            }
            
            // Update status message
            statusMessage.textContent = 'Image processed. Ready to generate model.';
            
            // Enable the generate button
            generateBtn.disabled = false;
            
            // Automatically generate model if requested
            if (autoGenerateModel) {
                console.log('Auto-generating model...');
                generateModel();
            }
            
        } else {
            throw new Error(data.error || 'Failed to process image with Gemini');
        }
    } catch (error) {
        console.error('Error processing image with Gemini:', error);
        
        // Display the error
        statusMessage.textContent = `Error: ${error.message}`;
        
        // If Gemini processing fails, use the original image
        processedImage = file;
        displayDirectlyInPreview(file);
        
        // Still enable generate button using original image
        generateBtn.disabled = false;
    } finally {
        isProcessingImage = false;
    }
}

function displayDirectlyInPreview(base64Image) {
    // Clear preview
    preview.innerHTML = '';

    // Create img element
    const img = document.createElement('img');
    
    // If it's already a base64 string
    if (typeof base64Image === 'string') {
        img.src = `data:image/png;base64,${base64Image}`;
    } 
    // If it's a File object
    else if (base64Image instanceof File) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        }
        reader.readAsDataURL(base64Image);
    }
    
    // Append to preview
    preview.appendChild(img);
}

function displayImageWithAnalysis(base64Image, analysisText) {
    // Implementation details if needed
}

function base64ToFile(base64String, filename) {
    // Ensure base64String is a string
    if (typeof base64String !== 'string') {
        console.warn('base64ToFile received a non-string value:', typeof base64String);
        if (base64String instanceof File) return base64String;
        throw new Error('Invalid base64 string');
    }
    
    try {
        // Check if the string already includes the data URL prefix
        if (base64String.startsWith('data:')) {
            // Extract the actual base64 part
            const parts = base64String.split(',');
            if (parts.length === 2) {
                base64String = parts[1];
            }
        }
        
        // Convert base64 to Blob
        const byteString = atob(base64String);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        // Determine the content type from the base64 string if possible
        let contentType = 'image/png';
        if (base64String.startsWith('/9j/')) {
            contentType = 'image/jpeg';
        } else if (base64String.startsWith('iVBOR')) {
            contentType = 'image/png';
        } else if (base64String.startsWith('R0lGOD')) {
            contentType = 'image/gif';
        } else if (base64String.startsWith('UklGR')) {
            contentType = 'image/webp';
        }
        
        // Create Blob and File
        const blob = new Blob([ab], { type: contentType });
        
        // Create a File from the Blob
        return new File([blob], filename, { type: contentType });
    } catch (error) {
        console.error('Error in base64ToFile:', error);
        throw error;
    }
}

function displayProcessedImage(base64Image) {
    // Clear preview
    preview.innerHTML = '';
    
    // Create a new image container
    const container = document.createElement('div');
    container.className = 'processed-image-container';
    
    // Create image element
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${base64Image}`;
    img.className = 'processed-image';
    
    // Add a label
    const label = document.createElement('div');
    label.className = 'processed-image-label';
    label.textContent = 'Processed image'; // Can make dynamic if needed
    
    // Add to container
    container.appendChild(img);
    container.appendChild(label);
    
    // Add to preview
    preview.appendChild(container);
} 