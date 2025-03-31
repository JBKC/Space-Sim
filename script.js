// Global error handler to catch and log errors
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
});

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
const processingText = document.getElementById('processingText');
const webcamButton = document.getElementById('webcamButton');
const webcamModal = document.getElementById('webcamModal');
const webcamVideo = document.getElementById('webcamVideo');
const captureButton = document.getElementById('captureButton');
const closeWebcamButton = document.getElementById('closeWebcamButton');
const webcamCanvas = document.getElementById('webcamCanvas');

// --- Gemini Addition: Add elements for background removal status ---
const uploadStatusText = document.createElement('div'); // Create a new div for upload status
uploadStatusText.id = 'uploadStatusText';
uploadStatusText.style.marginTop = '10px';
uploadStatusText.style.fontSize = '14px';
uploadStatusText.style.color = '#aaa';
uploadStatusText.style.textAlign = 'center';
dropArea.parentNode.insertBefore(uploadStatusText, generateBtn.parentNode); // Insert before generate button container
// --- End Gemini Addition ---

// Global variables
let uploadedImage = null;
let scene, camera, renderer, controls, model;
let taskId = null;
let statusCheckInterval = null;
let currentModelUrl = null; // Store the model URL for download 
let statusCheckErrorCount = 0;
let highProgressStartTime = null;
let isAnimating = false;
let lastRenderLog = 0;
let webcamStream = null;
let imageBlobUrl = null; // Store the blob URL for cleanup

// Server API endpoints
const SERVER_URL = 'http://localhost:8000';
const GENERATE_ENDPOINT = '/api/generate';
const STATUS_ENDPOINT = '/api/status';

// Check server connectivity
checkServerHealth();

// Initialize 3D viewer
initializeViewer();

// Setup event listeners
setupEventListeners();

// Initialize function - no loading message at start
function init() {
    // Initialize 3D scene and renderer
    initializeViewer();
    
    // Setup event listeners for UI
    setupEventListeners();
    
    // Load the default example
    try {
        if (typeof loadExampleImage === 'function') {
            loadExampleImage();
        }
    } catch (error) {
        console.warn('Could not load example image:', error);
    }
}

// Call init when document is loaded
document.addEventListener('DOMContentLoaded', init);

function checkServerHealth() {
    console.log(`Checking server health at ${SERVER_URL}/health...`);
    
    fetch(`${SERVER_URL}/health`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
    })
    .then(data => {
        console.log('Server health check response:', data);
        // Enable UI interactions
        enableInterface();
    })
    .catch(error => {
        console.error('Server connection error:', error);
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
        statusMessage.textContent = 'Error: Cannot connect to server';
        }
        // Add a retry button
        addServerRetryButton();
    });
}

function enableInterface() {
    // If there was a retry button, remove it
    const retryBtn = document.getElementById('retryConnectionBtn');
    if (retryBtn) {
        retryBtn.remove();
    }
    
    // Enable the file upload area
    dropArea.classList.remove('disabled');
    const fileInputLabel = document.querySelector('.file-input-label');
    if (fileInputLabel) {
        fileInputLabel.classList.remove('disabled');
    }
    
    // Enable webcam button
    webcamButton.disabled = false;
    webcamButton.classList.remove('disabled');
}

function addServerRetryButton() {
    // Remove existing button if any
    const existingBtn = document.getElementById('retryConnectionBtn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Disable the file upload area
    dropArea.classList.add('disabled');
    const fileInputLabel = document.querySelector('.file-input-label');
    if (fileInputLabel) {
        fileInputLabel.classList.add('disabled');
    }
    
    // Disable webcam button
    webcamButton.disabled = true;
    webcamButton.classList.add('disabled');
    
    // Create a retry button
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retryConnectionBtn';
    retryBtn.innerText = 'Retry Connection';
    retryBtn.addEventListener('click', checkServerHealth);
    
    // Add button to the status section
    const statusSection = document.getElementById('statusSection');
    statusSection.appendChild(retryBtn);
}

function setupEventListeners() {
    // Drag & drop handling
    const dropArea = document.getElementById('dropArea');
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('dragleave', handleDragLeave);
    dropArea.addEventListener('drop', handleDrop);
    dropArea.addEventListener('click', () => fileInput.click());
    
    // File input change
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Generate button
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.addEventListener('click', generateModel);
    
    // Webcam button
    const webcamButton = document.getElementById('webcamButton');
    webcamButton.addEventListener('click', openWebcamModal);
    
    // Close webcam modal
    const closeWebcamButton = document.getElementById('closeWebcamButton');
    closeWebcamButton.addEventListener('click', closeWebcamModal);
    
    // Capture photo
    const captureButton = document.getElementById('captureButton');
    captureButton.addEventListener('click', captureImage);

    // Display any errors in the console
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', event.error);
    });
    
    // Close modal if user clicks outside content
    window.addEventListener('click', (e) => {
        if (e.target === webcamModal) {
            closeWebcamModal();
        }
    });
}

// Initialize webcam modal
function openWebcamModal(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Show the modal
    webcamModal.style.display = 'block';
    
    initWebcam().catch(error => {
        console.error('Error initializing webcam:', error);
        statusMessage.textContent = 'Could not access camera';
        closeWebcamModal();
    });
}

// Initialize webcam
async function initWebcam() {
    try {
        // Check for existing stream and stop it
        if (webcamStream) {
            stopWebcamStream();
        }
        
        // Prepare video element before getting stream to prevent resize effect
        webcamVideo.style.height = '550px'; // Match the container height
        webcamVideo.style.objectFit = 'cover';
        
        // Get webcam access with better video quality
        const constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'environment' // Use back camera on mobile if available
            },
            audio: false
        };
        
        // Request webcam stream
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = webcamStream;
        
        // Instead of waiting for metadata, set dimensions immediately
        webcamVideo.play();
        
    } catch (error) {
        console.error('Error accessing webcam:', error);
        throw error;
    }
}

// Capture image from webcam
function captureImage() {
    if (!webcamVideo || !webcamStream) {
        console.error('Webcam not initialized');
        return;
    }
    
    const context = webcamCanvas.getContext('2d');
    webcamCanvas.width = webcamVideo.videoWidth;
    webcamCanvas.height = webcamVideo.videoHeight;
    context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);

    // Convert canvas to blob, then to file
    webcamCanvas.toBlob(blob => {
        if (blob) {
            const capturedFile = new File([blob], 'webcam-capture.png', { type: 'image/png' });
            closeWebcamModal(); // Close modal after capture

            // Display the original image immediately
            displayPreviewAndEnableButton(capturedFile);
        } else {
            console.error('Failed to create blob from webcam canvas');
            displayUserFriendlyError('Could not capture photo.', 'uploadStatusText');
        }
    }, 'image/png');
}

// Display the captured image in the preview
function displayCapturedImage(imageSrc) {
    const preview = document.getElementById('preview');
    
    if (!preview) {
        console.warn('Preview element not found');
        return;
    }
    
    // Clear previous content
    preview.innerHTML = '';
    
    // Create and append image
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Captured image';
    preview.appendChild(img);
                
                // Update status
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = 'Image captured successfully.';
            } else {
        console.warn('Status message element not found');
    }
}

// Clear the image preview
function clearImagePreview() {
    preview.innerHTML = '';
    
    // Clean up blob URL if exists
    if (imageBlobUrl) {
        URL.revokeObjectURL(imageBlobUrl);
        imageBlobUrl = null;
    }
    
    uploadedImage = null;
    generateBtn.disabled = true;
}

// Close webcam modal
function closeWebcamModal() {
    stopWebcamStream();
    webcamModal.style.display = 'none';
}

// Stop webcam stream
function stopWebcamStream() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => {
            track.stop();
        });
        webcamStream = null;
    }
    
    if (webcamVideo) {
        webcamVideo.srcObject = null;
    }
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

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('active');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('active');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('active');
    
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length) {
        handleFiles(files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        const file = files[0];
        // Display the original image immediately
        displayPreviewAndEnableButton(file);
    }
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.match('image.*')) {
            // Display the original image immediately
            displayPreviewAndEnableButton(file);
        } else {
            const statusMessage = document.getElementById('statusMessage');
            if (statusMessage) {
                statusMessage.textContent = 'Please upload an image file.';
            } else {
                console.error('Please upload an image file.');
            }
        }
    }
}

function validateAndProcessImage(file) {
    // Clear any existing previews
    preview.innerHTML = '';
    
    // Display initial preview
    displayPreview(file);
    
    // Store the uploaded image
    uploadedImage = file;
    
    // Enable the generate button
    generateBtn.disabled = false;
    
    // Update status message if it exists
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = 'Image ready for processing';
    } else {
        console.log('Image ready for processing');
    }
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

function initializeViewer() {
    console.log("Initializing Three.js viewer...");
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Pure black background
    
    // Add stronger lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add another light from a different angle for better visibility
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-5, 5, -5);
    directionalLight2.castShadow = true;
    scene.add(directionalLight2);
    
    // Add one more light from below for better visibility of model bottom
    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight3.position.set(0, -5, 0);
    scene.add(directionalLight3);
    
    // Get container dimensions
    const width = modelViewer.clientWidth;
    const height = modelViewer.clientHeight;
    console.log("Container dimensions:", width, height);
    
    // Camera setup - positioned to clearly see objects at origin
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 5;
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000); // Pure black
    
    // Use compatible rendering settings for Three.js 
    renderer.outputEncoding = THREE.sRGBEncoding || THREE.LinearEncoding;
    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Clear any existing content
    while (modelViewer.firstChild) {
        modelViewer.removeChild(modelViewer.firstChild);
    }
    
    // Add renderer to DOM
    modelViewer.appendChild(renderer.domElement);
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    
    // Set initial controls target at origin
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Start animation loop
    isAnimating = true;
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function loadModel(modelUrl, originalUrl) {
    // Safety check - don't try to load if no URL
    if (!modelUrl) {
        console.error('No model URL provided to loadModel');
        return;
    }
    
    console.log(`Loading model from: ${modelUrl}`);
    
    // Always ensure the loading overlay is visible with consistent message
    setModelViewerStatus(true, 'Model generating...');
    
    // Make sure the loader overlay is visible
    modelViewerStatus.style.display = 'flex';
    modelViewerStatus.style.zIndex = '20'; // Ensure high z-index
    
    // Update text with null check
    const processingEl = document.getElementById('processingText');
    if (processingEl) {
        processingEl.innerText = 'Loading 3D model...';
        processingEl.style.fontSize = '24px'; // Make text larger
    }
    
    // Make spinner more visible
    const spinnerEl = modelViewerStatus.querySelector('.spinner');
    if (spinnerEl) {
        spinnerEl.style.width = '80px';
        spinnerEl.style.height = '80px';
        spinnerEl.style.borderWidth = '8px';
    }
    
    // Remove any existing models from the scene
    if (model) {
        scene.remove(model);
        model = null;
    }
    
    // Clear the scene of any other objects with userData
    scene.traverse(object => {
        if (object.userData && object.userData.type) {
            console.log(`Removing existing object from scene: ${object.userData.type}`);
            scene.remove(object);
        }
    });
    
    // Try to extract the model filename from the URL
    const modelFilename = extractFilenameFromUrl(originalUrl || modelUrl);
    console.log(`Model filename: ${modelFilename}`);
    
    // Use GLTF Loader
    const loader = new THREE.GLTFLoader();
    
    // Add more comprehensive loading manager
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = function(url, loaded, total) {
        const percent = Math.round((loaded / total) * 100);
        if (processingEl) {
            processingEl.innerText = `Loading 3D model... ${percent}%`;
        }
        console.log(`Loading progress: ${percent}%`);
    };
    
    loadingManager.onError = function(url) {
        console.error('Error loading resource:', url);
    };
    
    loader.manager = loadingManager;
    
    console.log(`Starting to load model with GLTFLoader: ${modelUrl}`);
    
    // Function to try loading the model
    function tryLoadModel(url) {
        if (!url) {
            console.error('Empty URL provided to tryLoadModel');
            return;
        }
        
        console.log(`Loading model from: ${url}`);
        
        // Create a loader for this attempt 
        const attemptLoader = new THREE.GLTFLoader(loadingManager);
        
        // Add draco decoder if available
        if (THREE.DRACOLoader) {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/js/libs/draco/');
            attemptLoader.setDRACOLoader(dracoLoader);
        }
        
        attemptLoader.load(
        // URL
            url,
        // onLoad callback
        function (gltf) {
                console.log('GLTF loaded successfully, processing...', gltf);
            onModelLoaded(gltf);
        },
        // onProgress callback
        function (xhr) {
            onProgress(xhr);
        },
        // onError callback
        function (error) {
                console.error(`Error loading model with GLTFLoader:`, error);
                
                // If failed to load local model, try direct URL if provided
                if (originalUrl && url !== originalUrl) {
                    console.log('Trying direct URL as fallback...');
                    setTimeout(() => tryLoadModel(originalUrl), 1000);
                } else {
                    onError(error, url, originalUrl);
                }
            }
        );
    }
    
    // Start the loading process
    try {
        // Simple space replacement if needed
        const urlToUse = modelUrl.replace(/\s/g, '%20');
        tryLoadModel(urlToUse);
    } catch (error) {
        console.error('Error preparing model URL for loading:', error);
        onError(error, modelUrl, originalUrl);
    }
}

function onModelLoaded(gltf) {
    console.log('Model loaded successfully', gltf);
    
    // Remove any existing model first
    if (model) {
        scene.remove(model);
        model = null;
    }
    
    // Set up the new model
    model = gltf.scene || gltf.scenes[0];
    
    if (!model) {
        console.error('No valid scene in GLTF data');
        return;
    }
    
    // Apply initial 6.4x scale (2x larger than previous 3.2x)
    model.scale.set(6.4, 6.4, 6.4);
    
    // Check if model is empty
    let hasVisibleObjects = false;
    model.traverse(function(node) {
        if (node.isMesh) {
            hasVisibleObjects = true;
        
        // Enhance materials
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(enhanceMaterial);
                } else {
                    enhanceMaterial(node.material);
                }
            }
            
            // Enable shadows
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    
    if (!hasVisibleObjects) {
        console.error('Model has no visible meshes');
        return;
    }
    
    // Set model userData to identify it as the main model
    model.userData = {
        type: 'importedModel',
        source: 'gltf'
    };
    
    // Add model to scene
    scene.add(model);
    
    // Apply post-processing
    applyModelPostProcessing(model);
    
    // Update model viewer status
    modelViewerStatus.style.display = 'none';
        
    // Start animation loop if not already running
    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

function onProgress(xhr) {
    if (xhr.lengthComputable) {
        const percentComplete = xhr.loaded / xhr.total * 100;
        
        // Log progress every 10% (useful for debugging in console)
        if (Math.floor(percentComplete) % 10 === 0) {
            console.log(`Model loading progress: ${Math.round(percentComplete)}%`);
        }
        
        // Maintain consistent message regardless of progress
        const processingTextEl = document.getElementById('processingText');
        if (processingTextEl) {
            processingTextEl.innerText = 'Model generating...';
        }
    } else {
        console.log('Model loading in progress, but progress percentage not available');
    }
}

function onError(error, modelUrl, originalUrl) {
    console.error('Error loading model:', error);
    
    // Create a more detailed error message
    let errorMsg = 'Error loading model';
    if (error.message) {
        errorMsg += `: ${error.message}`;
    }
    
    // Add URL information for debugging
    if (modelUrl) {
        console.error(`Failed URL: ${modelUrl}`);
    }
    
    // Display error message
    const processingTextEl = document.getElementById('processingText');
    if (processingTextEl) {
        processingTextEl.innerText = errorMsg;
    }
    
    // Hide overlay after delay
    setTimeout(() => {
        modelViewerStatus.style.display = 'none';
    }, 5000);
}

function fitCameraToObject(object, offset = 1.0) {
    if (!object) {
        console.error('No object provided to fit camera to');
        return;
    }
    
    // Create a temporary box to measure object dimensions
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // Check if bounding box is valid
    if (boundingBox.isEmpty()) {
        console.warn('Empty bounding box when trying to fit camera to object');
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
    }
    
    // Get the size of the bounding box
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());
    
    // Calculate the object's maximum dimension and add the offset
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Check for valid dimensions before adjusting camera
    if (isNaN(maxDim) || maxDim === 0) {
        console.warn('Invalid object dimensions:', size);
        camera.position.set(0, 0, 5);
        controls.target.set(0, 0, 0);
        controls.update();
        return;
    }
    
    // Special handling for imported models - center at origin
    if (object.userData && object.userData.type === 'importedModel') {
        // Ensure the model is centered
        const centerOffset = center.clone();
        object.position.sub(centerOffset);
        
        // Recalculate center after positioning
        boundingBox.setFromObject(object);
        boundingBox.getCenter(center);
    }
    
    // Calculate camera position based on the bounding box size
    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.abs(maxDim / Math.sin(fov / 2)) * offset;
    
    // Position camera to look at the object
    camera.position.set(center.x, center.y, center.z + distance);
    controls.target.set(center.x, center.y, center.z);
    controls.update();
    
    console.log('Camera adjusted to fit model', {
        objectSize: size,
        objectCenter: center,
        cameraDistance: distance,
        cameraPosition: camera.position.clone()
    });
}

function enhanceMaterial(material) {
    if (!material) return;
    
    // Handle array of materials
    if (Array.isArray(material)) {
        material.forEach(m => enhanceMaterial(m));
        return;
    }
    
    // Skip if material has already been enhanced
    if (material._enhanced) return;
    
    // Common enhancements for better rendering
    material.roughness = material.roughness || 0.7;
    material.metalness = material.metalness || 0.2;
    
    // Improve transparent materials if any
    if (material.transparent) {
        material.opacity = Math.max(0.8, material.opacity);
        material.alphaTest = 0.01;
    }
    
    // Mark as enhanced to prevent reprocessing
    material._enhanced = true;
}

function applyModelPostProcessing(model) {
    if (!model) {
        console.error('No model provided for post-processing');
        return;
    }
    
    // Create a temporary box to measure object dimensions
    const boundingBox = new THREE.Box3().setFromObject(model);
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Check if the model is unusually small or large
    if (maxDim > 0) {
        if (maxDim > 10) {
            // Model is too large, scale it down but maintain 6.4x size effect
            const scaleFactor = 6.4 / maxDim;
            model.scale.multiplyScalar(scaleFactor);
            console.log(`Model scaled down by factor of ${scaleFactor}`);
        } else if (maxDim < 0.1) {
            // Model is too small, scale it up but maintain 6.4x size effect
            const scaleFactor = 6.4 / maxDim;
            model.scale.multiplyScalar(scaleFactor);
            console.log(`Model scaled up by factor of ${scaleFactor}`);
        } else {
            // Model has reasonable dimensions, but ensure it's at 6.4x scale
            // We already set scale in onModelLoaded, so no need to change here
            console.log('Model has good dimensions, maintaining 6.4x scale');
        }
    }
    
    // Recalculate the bounding box after potential scaling
    boundingBox.setFromObject(model);
    const center = boundingBox.getCenter(new THREE.Vector3());
    
    // Center the model at origin
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    // Add a bit of rotation for a better viewing angle
    model.rotation.y = Math.PI / 8; // Rotate slightly for better viewing
    
    // Adjust camera to fit the model
    fitCameraToObject(model);
    
    console.log('Model post-processing complete');
}

function onWindowResize() {
    camera.aspect = modelViewer.clientWidth / modelViewer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
}

function animate() {
    if (!isAnimating) return;
    
    requestAnimationFrame(animate);
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // Add slow rotation to the loaded model (half as fast)
    if (model) {
        model.rotation.y += 0.0025; // Reduced from 0.005 to 0.0025 (half speed)
    }
    
    // Render the scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        
        // Log rendering state for debugging (but limit frequency)
        const now = Date.now();
        if (now - lastRenderLog > 1000) { // Log once per second at most
            lastRenderLog = now;
            
            // Identify what type of model we're rendering
            let modelType = 'none';
            let modelStatus = 'missing';
            
            if (model) {
                modelStatus = model.type || 'unknown';
                
                if (model.userData && model.userData.type) {
                    if (model.userData.type === 'importedModel') {
                        modelType = 'imported';
                    }
                } else if (model.isGroup) {
                    modelType = 'group';
                } else if (model.isMesh) {
                    modelType = 'mesh';
                }
            }
            
            // console.log('Rendering frame', { model: modelType, modelType: modelStatus, camera: camera });
        }
    }
}

// Helper function to manage loading UI state
function loadingUI(isLoading) {
    if (isLoading) {
        generateBtn.disabled = true;
        loadingSpinner.style.display = 'flex';
        modelViewerStatus.style.display = 'flex';
        downloadSection.style.display = 'none';
    } else {
        generateBtn.disabled = false;
        loadingSpinner.style.display = 'none';
        modelViewerStatus.style.display = 'none';
        // Don't automatically show the download section here
        // It should only be shown when a model is successfully generated
    }
}

function displayUserFriendlyError(error, location = 'processingText') {
    console.error('Error:', error);
    
    // Default error message
    let message = 'An error occurred. Please try again.';
    
    // Get more specific error message if available
    if (error) {
        if (typeof error === 'string') {
            message = error;
        } else if (error.message) {
            message = error.message;
        }
    }
    
    // Check for "API Error" format where we've already formatted the error nicely
    if (message.includes('API Error')) {
        // Already in a good format, keep it
    }
    // Check for JSON objects in the error message (common with API responses)
    else if (message.match(/(\{.*\})/)) {
        let jsonMatch = message.match(/(\{.*\})/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const jsonPart = jsonMatch[1];
                const errorObj = JSON.parse(jsonPart);
                // Extract useful fields from the error object
                if (errorObj.message) {
                    message = message.replace(jsonPart, errorObj.message);
                }
                if (errorObj.code) {
                    message += ` (Error code: ${errorObj.code})`;
                }
            } catch (e) {
                // If parsing fails, continue with original message
                console.log('Could not parse JSON in error message', e);
            }
        }
    }
    
    // Clean up the message (remove technical details)
    const cleanMessage = message
        .replace(/Error:/gi, '')
        .replace(/\bat\b.*$/gm, '')
        .replace(/\{.*\}/g, '')
        .replace(/\[.*\]/g, '')
        .replace(/undefined/g, '')
        .replace(/\s+/g, ' ')
        .trim();
        
    // Update the appropriate element with the error message
    if (location === 'uploadStatusText') {
        uploadStatusText.textContent = cleanMessage;
        // Optionally hide after a delay
        // setTimeout(() => { uploadStatusText.textContent = ''; }, 5000);
    } else if (location === 'statusMessage') {
        statusMessage.textContent = cleanMessage;
    } else {
        const processingTextEl = document.getElementById('processingText');
        if (processingTextEl) {
            processingTextEl.innerText = cleanMessage;
        
        // Make sure the error message is visible
        modelViewerStatus.style.display = 'flex';
        
        // Add a class to style error messages differently
            processingTextEl.classList.add('error-message');
        
        // Hide the error after a delay (for model viewer errors)
        setTimeout(() => {
            modelViewerStatus.style.display = 'none';
                if (processingTextEl) {
                    processingTextEl.classList.remove('error-message');
                }
        }, 10000); // Show for 10 seconds to give user time to read
        }
    }
    
    // Ensure we reenable the button and hide loading spinner
    loadingUI(false);
} 

// Function to format model URL for proxy
function createProxyUrl(originalUrl) {
    try {
        if (!originalUrl) return null;
        
        // Build the proxy URL with proper encoding
        const proxyUrl = `${SERVER_URL}/api/proxy/${encodeURIComponent(originalUrl)}`;
        console.log(`📤 Model URL for proxy: ${originalUrl.substring(0, 50)}...`);
        console.log(`📤 Using proxy URL: ${proxyUrl.substring(0, 50)}...`);
        
        return proxyUrl;
    } catch (error) {
        console.error('Error creating proxy URL:', error);
        return originalUrl; // Fallback to original URL
    }
}

/**
 * Extract filename from URL, handling query parameters
 * @param {string} url - The URL to extract the filename from
 * @returns {string} - The extracted filename
 */
function extractFilenameFromUrl(url) {
    try {
        if (!url) return 'model.glb';
        
        // First, split by query parameters and take the first part (the path)
        const urlPath = url.split('?')[0];
        // Then extract the filename from the path
        return urlPath.split('/').pop();
    } catch (error) {
        console.error('Error extracting filename from URL:', error);
        return 'model.glb'; // Default filename
    }
}

/**
 * Extract the model URL from an API response
 * Handles different API response structures
 * @param {Object} data - API response data
 * @returns {string|null} - Model URL or null if not found
 */
function extractModelUrlFromResponse(data) {
    console.log('Extracting model URL from response data:', data);
    
    // Try the direct modelUrl field first
    if (data.modelUrl) {
        console.log('Found model URL in direct modelUrl field:', data.modelUrl);
        return data.modelUrl;
    }
    
    // Check for the standard API output structure
    if (data.output) {
        console.log('Found output object in response:', data.output);
        
        // Try each known model URL field in order of preference
        if (data.output.pbr_model) {
            console.log('Found PBR model URL:', data.output.pbr_model);
            return data.output.pbr_model;
        }
        
        if (data.output.model) {
            console.log('Found model URL:', data.output.model);
            return data.output.model;
        }
        
        if (data.output.base_model) {
            console.log('Found base model URL:', data.output.base_model);
            return data.output.base_model;
        }
    }
    
    // Check for API response nested inside a 'data' field
    if (data.data) {
        console.log('Found nested data object, checking for model URLs');
        
        // Check output object in data
        if (data.data.output) {
            if (data.data.output.pbr_model) {
                console.log('Found PBR model URL in nested data:', data.data.output.pbr_model);
                return data.data.output.pbr_model;
            }
            
            if (data.data.output.model) {
                console.log('Found model URL in nested data:', data.data.output.model);
                return data.data.output.model;
            }
            
            if (data.data.output.base_model) {
                console.log('Found base model URL in nested data:', data.data.output.base_model);
                return data.data.output.base_model;
            }
        }
        
        // Direct model URL in data
        if (data.data.modelUrl) {
            console.log('Found model URL in nested data.modelUrl:', data.data.modelUrl);
            return data.data.modelUrl;
        }
    }
    
    // Try details object as a last resort
    if (data.details && typeof data.details === 'object') {
        // Look for any property that might contain a model URL
        for (const key in data.details) {
            const value = data.details[key];
            if (typeof value === 'string' && 
                (value.endsWith('.glb') || value.includes('.glb?')) && 
                (value.startsWith('http') || value.startsWith('https'))) {
                console.log(`Found potential model URL in details.${key}:`, value);
                return value;
            }
        }
    }
    
    console.warn('No model URL found in response data');
    return null;
}

// Show/hide model viewer status
function setModelViewerStatus(isVisible, message = '') {
    const overlay = document.getElementById('modelViewerStatus');
    
    // Check if element exists before using it
    if (!overlay) {
        console.warn('modelViewerStatus element not found in the DOM');
        return;
    }
    
    // Force overlay to be visible and higher in z-index
    if (isVisible) {
        overlay.style.display = 'flex';
        overlay.style.zIndex = '1000'; // Extremely high z-index
        
        const text = document.getElementById('processingText');
        if (text && message) {
            text.textContent = message;
            text.style.fontSize = '24px'; // Larger text
        }
        
        // Ensure spinner is visible and prominent
        const spinner = overlay.querySelector('.spinner');
        if (spinner) {
            spinner.style.width = '80px';
            spinner.style.height = '80px';
            spinner.style.borderWidth = '8px';
            spinner.style.borderLeftColor = '#2196F3'; // Bright blue
        }
    } else if (overlay) {
        overlay.style.display = 'none';
    }
}

// Generate model function with null checks
async function generateModel() {
    // Get necessary elements
    const generateBtn = document.getElementById('generateBtn');
    const statusMessage = document.getElementById('statusMessage');
    const modelViewerStatus = document.getElementById('modelViewerStatus');
    const processingText = document.getElementById('processingText');
    
    if (!uploadedImage) {
        if (statusMessage) {
            statusMessage.textContent = 'Please upload an image first.';
        }
        return;
    }
    
    // Update UI state
    if (statusMessage) {
        statusMessage.textContent = '';
    }
    
    if (generateBtn) {
        generateBtn.disabled = true;
    }
    
    try {
        // STEP 1: Process the image with Gemini
        console.log('STEP 1: Processing image with Gemini');
        
        // Show "Processing image" with spinner
        setModelViewerStatus(true, 'Processing image...');
        
        // Process the image through Gemini
        const processedImage = await processImageWithGemini(uploadedImage);
        
        // NOTE: No longer displaying the processed image - going straight to 3D generation
        // Instead, we're keeping the original image in the preview
        // But still using the processed image for the 3D generation
        
        // STEP 2: Generate 3D model with the processed image
        console.log('STEP 2: Generating 3D model with processed image');
        
        // Update status message to "Generating 3D model"
        setModelViewerStatus(true, 'Model generating...');
        
        // Continue with 3D model generation
        await generate3DModel(processedImage);
        
    } catch (error) {
        console.error('Error in pipeline:', error);
        
        if (statusMessage) {
            statusMessage.textContent = 'Error: ' + error.message;
        }
        
        if (generateBtn) {
            generateBtn.disabled = false;
        }
        
        try {
            setModelViewerStatus(false);
        } catch (e) {
            console.warn('Could not hide model viewer status:', e);
        }
    }
}

// Process image with Gemini (returns a promise that resolves to the processed file)
async function processImageWithGemini(imageFile) {
    return new Promise((resolve, reject) => {
        if (!imageFile || !imageFile.type.startsWith('image/')) {
            reject(new Error('Invalid file provided for background removal'));
            return;
        }

        console.log(`✨ Starting background removal process for: ${imageFile.name}`);
        
        const formData = new FormData();
        formData.append('image', imageFile, imageFile.name);

        fetch(`${SERVER_URL}/api/remove-background`, {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `Background removal failed: ${response.status}`);
                }).catch(e => {
                    throw new Error(`Background removal failed: ${response.status}`);
                });
            }
            return response.blob();
        })
        .then(processedImageBlob => {
            console.log(`✅ Received processed image blob: ${processedImageBlob.size} bytes`);
            // Create a new File object from the processed blob
            const processedFile = new File([processedImageBlob], imageFile.name, { type: processedImageBlob.type });
            resolve(processedFile);
        })
        .catch(error => {
            console.error('❌ Error during background removal:', error);
            // If there's an error, just use the original image
            resolve(imageFile);
        });
    });
}

// Display processed image in the preview
function displayProcessedImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        console.error('Invalid file format for display');
        return;
    }

    // Clear previous content
    preview.innerHTML = '';
    
    // Create and append image
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Processed image';
    preview.appendChild(img);
    
    // Store the processed file as the uploaded image for 3D generation
    uploadedImage = file;
    console.log('Updated uploadedImage with processed file:', file.name, file.size, 'bytes');
}

// Function to handle the actual 3D model generation
async function generate3DModel(imageFile) {
    try {
        // Check if the file is valid
        if (!(imageFile instanceof File)) {
            throw new Error('Invalid file object. Please try uploading again.');
        }
        
        // Log the file details for debugging
        console.log('File details for 3D generation:', {
            name: imageFile.name,
            type: imageFile.type,
            size: imageFile.size,
            lastModified: new Date(imageFile.lastModified).toISOString()
        });
        
        // Make the API call with retry logic
        let response;
        let retries = 0;
        const maxRetries = 2;
        
        while (retries <= maxRetries) {
            try {
                console.log(`Attempt ${retries + 1} to send to API...`);
                
                // Create a fresh FormData for each attempt to avoid any potential issues
                const formData = new FormData();
                formData.append('image', imageFile);
                
                // Get the selected style from the dropdown
                const styleDropdown = document.getElementById('styleDropdown');
                if (styleDropdown && styleDropdown.value) {
                    formData.append('style', styleDropdown.value);
                    console.log(`Selected style: ${styleDropdown.value}`);
                }
                
                // This is important - don't set the Content-Type header manually
                // The browser will set it automatically with the correct boundary for multipart/form-data
                response = await fetch(`${SERVER_URL}${GENERATE_ENDPOINT}`, {
                    method: 'POST',
                    body: formData,
                    // Let the browser set the correct Content-Type header with boundary
                    // headers: { 'Content-Type': 'multipart/form-data' } - DO NOT SET THIS
                    timeout: 60000 // 60 seconds
                });
                
                console.log('Response received:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries([...response.headers])
                });
                
                // Exit retry loop if successful
                break;
            } catch (err) {
                retries++;
                console.error(`Attempt ${retries} failed:`, err);
                
                if (retries > maxRetries) {
                    throw err; // Give up after max retries
                }
                
                // Update processing status
                if (processingText) {
                    processingText.textContent = 'Model generating...';
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retries - 1)));
            }
        }
        
        // Process the response
        if (response && response.ok) {
            const data = await response.json();
            console.log('Generation initiated:', data);
            
            if (data.success && data.taskId) {
                taskId = data.taskId;
                
                // Start checking status
                startStatusPolling(taskId);
                
                // Update status
                if (processingText) {
                    processingText.textContent = 'Model generating...';
                }
                if (statusMessage) {
                    statusMessage.textContent = '';
                }
            } else {
                throw new Error(data.error || 'Failed to start generation');
            }
        } else {
            // Handle HTTP errors
            if (response) {
                let errorText = `Server error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error('Error response body:', errorData);
                    errorText = errorData.error || errorText;
                } catch (e) {
                    console.error('Error parsing error response:', e);
                }
                throw new Error(errorText);
            } else {
                throw new Error('No response from server');
            }
        }
    } catch (error) {
        console.error('Error generating model:', error);
        throw error; // Propagate the error to the main handler
    }
}

function startStatusPolling(modelTaskId) {
    // Clear any existing interval
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Reset error count
    statusCheckErrorCount = 0;
    
    // Start polling (changed from 5000ms to 10000ms)
    statusCheckInterval = setInterval(() => checkTaskStatus(modelTaskId), 10000);
}

async function checkTaskStatus(modelTaskId) {
    try {
        const response = await fetch(`${SERVER_URL}${STATUS_ENDPOINT}/${modelTaskId}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Status update:', data);
            
            // Check status
            if (data.status === 'completed' || data.status === 'succeed' || data.status === 'success') {
                // Success! Stop polling and display the model
                clearInterval(statusCheckInterval);
                
                // Extract model URL from the API response structure
                let modelUrl = extractModelUrlFromResponse(data);
                
                if (modelUrl) {
                    // Store the model URL for download
                    currentModelUrl = modelUrl;
                    
                    // Create a proxy URL to avoid CORS issues
                    const modelFilename = extractFilenameFromUrl(modelUrl);
                    console.log(`Model filename: ${modelFilename}`);
                    
                    // For download we'll use the direct URL (which works for downloads)
                    downloadLink.href = modelUrl;
                    downloadLink.download = `3d_model.glb`;
                    
                    // For viewer loading we'll use a local proxy URL through the server API
                    // This expects the server to have a proxy endpoint that can fetch the model
                    const proxyUrl = createProxyUrl(modelUrl);
                    
                    // Load the model through the proxy
                    loadModel(proxyUrl, modelUrl);
                    
                    // Show download button and hide loading spinner
                    downloadSection.style.display = 'flex';
                    
                    // Re-enable generate button
                    generateBtn.disabled = false;
                } else {
                    // No model URL - show error
                    clearInterval(statusCheckInterval);
                    modelViewerStatus.style.display = 'none';
                    statusMessage.textContent = 'Error: No model URL returned';
                    generateBtn.disabled = false;
                }
            } 
            else if (data.status === 'failed' || data.status === 'error') {
                // Failure
                clearInterval(statusCheckInterval);
                modelViewerStatus.style.display = 'none';
                statusMessage.textContent = 'Error: ' + (data.error || 'Model generation failed');
                generateBtn.disabled = false;
            }
            else {
                // Still processing - always show "Generating 3D model" with no progress percentage
                processingText.textContent = "Model generating...";
            }
            
            // Reset error count on successful status check
            statusCheckErrorCount = 0;
        } else {
            // Handle HTTP errors
            console.error('Status check error:', response.status);
            
            // Keep track of consecutive errors
            statusCheckErrorCount++;
            
            // If we've had too many errors, stop checking
            if (statusCheckErrorCount >= 5) {
                clearInterval(statusCheckInterval);
                statusMessage.textContent = 'Error: Too many status check errors';
                modelViewerStatus.style.display = 'none';
                generateBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error checking status:', error);
        
        // Keep track of consecutive errors
        statusCheckErrorCount++;
        
        // If we've had too many errors, stop checking
        if (statusCheckErrorCount >= 5) {
            clearInterval(statusCheckInterval);
            statusMessage.textContent = 'Error: ' + error.message;
            modelViewerStatus.style.display = 'none';
            generateBtn.disabled = false;
        }
    }
}

// Clean up resources on page unload
window.addEventListener('beforeunload', () => {
    stopWebcamStream();
    if (imageBlobUrl) {
        URL.revokeObjectURL(imageBlobUrl);
    }
});

// Load an example image
function loadExampleImage() {
    try {
        // Create a dummy function if not needed
        console.log('Example image loading is not implemented');
    } catch (error) {
        console.error('Error loading example image:', error);
    }
}

// Helper to set status message in the upload area
function setUploadStatus(message) {
    uploadStatusText.textContent = message;
} 

// Display the uploaded image in the preview and enable the generate button
function displayPreviewAndEnableButton(file) {
    if (!file || !file.type.startsWith('image/')) {
        console.error('Invalid file format for display');
        return;
    }

    // Clear previous content
    preview.innerHTML = '';
    
    // Create and append image
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Uploaded image';
    preview.appendChild(img);
    
    // Store the file as the uploaded image
    uploadedImage = file;
    console.log('Updated uploadedImage:', file.name, file.size, 'bytes');
    
    // Enable generate button
    generateBtn.disabled = false;
} 