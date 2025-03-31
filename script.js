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
let currentModel = null;

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
    
    try {
        // Set canvas dimensions to match video
        webcamCanvas.width = webcamVideo.videoWidth;
        webcamCanvas.height = webcamVideo.videoHeight;
        
        // Draw the current video frame to the canvas
        const context = webcamCanvas.getContext('2d');
        context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
        
        // Convert canvas to blob
        webcamCanvas.toBlob(blob => {
            // Clean up any previous blob URL
            if (imageBlobUrl) {
                URL.revokeObjectURL(imageBlobUrl);
            }
            
            // Create a new blob URL
            imageBlobUrl = URL.createObjectURL(blob);
            
            // Create a File object from the blob (for API compatibility)
            const filename = `webcam_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
            uploadedImage = new File([blob], filename, { type: 'image/jpeg' });
            
            // Display the captured image
            displayCapturedImage(imageBlobUrl);
            
            // Close webcam modal
            closeWebcamModal();
            
            // Enable generate button
            generateBtn.disabled = false;
            
        }, 'image/jpeg', 0.95); // High quality JPEG
        
    } catch (error) {
        console.error('Error capturing image:', error);
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = 'Failed to capture image';
        }
    }
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
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.match('image.*')) {
            // Process the image
            validateAndProcessImage(file);
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
    
    // Always ensure the loading overlay is visible
    setModelViewerStatus(true, 'Loading 3D model...');
    
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
    try {
        // Clear any loading UI
        setModelViewerStatus(false);
        
        // Remove any existing model
        if (currentModel) {
            scene.remove(currentModel);
            currentModel = null;
        }
        
        // Get the loaded model
        const model = gltf.scene || gltf;
        console.log('Model loaded successfully:', model);
        
        // Apply post-processing
        applyModelPostProcessing(model);
        
        // Store the model
        currentModel = model;
        
        // Add the model to the scene
        scene.add(model);
        
        // Fit camera to object with 2x zoom (use 0.6 instead of default 1.25)
        fitCameraToObject(model, 0.6);
        
        // Create download link if supported
        createDownloadLink(gltf);
        
        // Add slow rotation animation to the model
        model.userData.autoRotate = true;
        model.userData.rotationSpeed = 0.005; // Slow rotation speed
        
        // Ensure the animation loop is running
        if (!isAnimating) {
            isAnimating = true;
            animate();
        }
        
    } catch (error) {
        console.error('Error processing loaded model:', error);
        displayUserFriendlyError(error);
    }
}

function onProgress(xhr) {
    if (xhr.lengthComputable) {
        const percentComplete = xhr.loaded / xhr.total * 100;
        
        // Log progress every 10%
        if (Math.floor(percentComplete) % 10 === 0) {
            console.log(`Model loading progress: ${Math.round(percentComplete)}%`);
        }
        
        const processingTextEl = document.getElementById('processingText');
        if (processingTextEl) {
            processingTextEl.innerText = `Loading: ${Math.round(percentComplete)}%`;
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

function fitCameraToObject(object, offset = 1.25) {
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
    console.log('Applying post-processing to model');
    
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
        console.warn('Model has no visible meshes');
    }
    
    // Set model userData to identify it as the main model
    model.userData = {
        type: 'importedModel',
        source: 'gltf',
        autoRotate: true,
        rotationSpeed: 0.005
    };
    
    // Calculate bounding box of model
    const box = new THREE.Box3().setFromObject(model);
    
    // Reset position to center of the model at (0,0,0)
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center); // Center model at origin
    
    // Add a slight rotation for better initial view
    model.rotation.y = Math.PI / 6;
    
    // Get model size for potential scaling
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Scale model if needed to a reasonable size
    if (maxDim > 5) {
        // Model is too large, scale it down
        const scale = 5 / maxDim;
        model.scale.multiplyScalar(scale);
        console.log(`Model was too large (${maxDim}), scaled down by factor of ${scale}`);
    } else if (maxDim < 1) {
        // Model is too small, scale it up
        const scale = 1 / maxDim;
        model.scale.multiplyScalar(scale);
        console.log(`Model was too small (${maxDim}), scaled up by factor of ${scale}`);
    }
    
    // Fit camera to object
    fitCameraToObject(model, 0.6); // Use 0.6 instead of 1.25 for 2x zoom
}

function onWindowResize() {
    camera.aspect = modelViewer.clientWidth / modelViewer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
}

function animate() {
    if (!isAnimating) return;
    
    requestAnimationFrame(animate);
    
    // Rotate model if it exists and has autoRotate enabled
    if (currentModel && currentModel.userData.autoRotate) {
        currentModel.rotation.y += currentModel.userData.rotationSpeed || 0.005;
    }
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // Render the scene
    renderer.render(scene, camera);
    
    console.log('Rendering frame', {model: currentModel ? 'loaded' : 'none', modelType: currentModel ? currentModel.type : 'missing', camera: camera});
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
    if (location === 'statusMessage') {
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

// Show/hide model viewer status with simplified message
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
        if (text) {
            // Always just show "Generating 3D model..." without percentages
            text.textContent = 'Generating 3D model...';
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
        statusMessage.textContent = 'Processing image...';
    }
    
    if (generateBtn) {
        generateBtn.disabled = true;
    }
    
    // Always show the loading overlay with high visibility
    try {
        setModelViewerStatus(true, 'Generating 3D model...');
    } catch (error) {
        console.warn('Could not update model viewer status:', error);
    }
    
    try {
        // Check if the file is valid
        if (!(uploadedImage instanceof File)) {
            throw new Error('Invalid file object. Please try uploading again.');
        }
        
        // Log the file details for debugging
        console.log('File details:', {
            name: uploadedImage.name,
            type: uploadedImage.type,
            size: uploadedImage.size,
            lastModified: new Date(uploadedImage.lastModified).toISOString()
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
                formData.append('image', uploadedImage);
                
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
                    processingText.textContent = `Retrying (${retries}/${maxRetries})...`;
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
                    processingText.textContent = 'Processing in progress...';
                }
                if (statusMessage) {
                    statusMessage.textContent = 'Generation started';
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
        // Show status update (without percentage)
        setModelViewerStatus(true, 'Generating 3D model...');
        
        const response = await fetch(`${SERVER_URL}/api/status/${modelTaskId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Status check for task ${modelTaskId}:`, data);
        
        if (data.success) {
            const status = data.status.toLowerCase();
            
            // Handle completed model generation
            if (status === 'completed' || status === 'success') {
                setModelViewerStatus(true, 'Loading 3D model...');
                
                // Extract model URL
                const modelUrl = extractModelUrlFromResponse(data);
                if (!modelUrl) {
                    throw new Error('Could not find model URL in response');
                }
                
                // Create a proxy URL to avoid CORS issues
                const proxiedUrl = createProxyUrl(modelUrl);
                
                // Load the model
                loadModel(proxiedUrl, modelUrl);
                
                // Create download link
                if (data.downloadUrl) {
                    createDownloadLink(data.downloadUrl);
                }
                
                // End status polling
                return true;
            }
            // Handle pending model generation (don't show percentage)
            else if (status === 'pending' || status === 'processing' || status === 'running') {
                // Continue polling
                return false;
            }
            // Handle failed model generation
            else if (status === 'failed' || status === 'error') {
                throw new Error(`Model generation failed: ${data.error || 'Unknown error'}`);
            }
        } else {
            throw new Error(data.error || 'Unknown error checking model status');
        }
    } catch (error) {
        console.error(`Error checking status for task ${modelTaskId}:`, error);
        setModelViewerStatus(false);
        
        // Show error to user
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = `Error: ${error.message}`;
        }
        
        return true; // End polling
    }
    
    return false; // Continue polling by default
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