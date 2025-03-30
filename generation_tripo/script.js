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
let scene, camera, renderer, controls, model;
let taskId = null;
let statusCheckInterval = null;
let currentModelUrl = null; // Store the model URL for download 
let statusCheckErrorCount = 0;

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

function checkServerHealth() {
    console.log(`Checking server health at ${SERVER_URL}/health...`);
    statusMessage.textContent = 'Connecting to server...';
    
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
        statusMessage.textContent = 'Ready - Server connected';
        // Enable UI interactions
        enableInterface();
    })
    .catch(error => {
        console.error('Server connection error:', error);
        statusMessage.textContent = 'Error: Cannot connect to server';
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
    
    // File input label click handler
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
            // Process the image
            validateAndProcessImage(file);
        } else {
            statusMessage.textContent = 'Please upload an image file.';
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
    
    // Update status
    statusMessage.textContent = 'Image ready for 3D generation';
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
    if (!uploadedImage) {
        statusMessage.textContent = 'Please upload an image first.';
        return;
    }
    
    // Update UI state
    statusMessage.textContent = 'Sending to Tripo3D API...';
    generateBtn.disabled = true;
    loadingSpinner.style.display = 'flex';
    
    // Show the model viewer status overlay
    modelViewerStatus.style.display = 'flex';
    document.getElementById('processingText').innerText = 'Starting Tripo3D generation...';
    
    try {
        // Create a FormData object
        const formData = new FormData();
        formData.append('image', uploadedImage);
        
        console.log('Sending image directly to Tripo3D via server, type:', uploadedImage.type, 'size:', uploadedImage.size);
        
        // Make the API call with retry logic
        let response;
        let retries = 0;
        const maxRetries = 2;
        
        while (retries <= maxRetries) {
            try {
                console.log(`Attempt ${retries + 1} to send to Tripo3D...`);
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
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retries - 1)));
            }
        }
        
        // Process the response
        if (response && response.ok) {
            const data = await response.json();
            console.log('Tripo3D generation initiated:', data);
            
            if (data.success && data.taskId) {
                taskId = data.taskId;
                
                // Start checking status
                startStatusPolling(taskId);
                
                // Update status
                document.getElementById('processingText').innerText = 'Tripo3D processing in progress...';
                statusMessage.textContent = 'Tripo3D generation started';
            } else {
                throw new Error(data.error || 'Failed to start Tripo3D generation');
            }
        } else {
            // Handle HTTP errors
            if (response) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            } else {
                throw new Error('No response from server');
            }
        }
    } catch (error) {
        // Handle errors in a user-friendly way
        console.error('Error generating model with Tripo3D:', error);
        displayUserFriendlyError(error);
        
        // Re-enable the button
        generateBtn.disabled = false;
        loadingSpinner.style.display = 'none';
    }
}

function startStatusPolling(modelTaskId) {
    // Clear any existing interval
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Reset error count
    statusCheckErrorCount = 0;
    
    // Start polling
    statusCheckInterval = setInterval(() => checkTaskStatus(modelTaskId), 5000);
}

async function checkTaskStatus(modelTaskId) {
    try {
        const response = await fetch(`${SERVER_URL}${STATUS_ENDPOINT}/${modelTaskId}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Status update:', data);
            
            // Update the progress bar if there's a progress percentage
            if (data.progress) {
                const progressPercent = parseFloat(data.progress);
                if (!isNaN(progressPercent)) {
                    progressBar.style.width = `${progressPercent}%`;
                }
            }
            
            // Check status - matches the v2 API status values
            if (data.status === 'completed' || data.status === 'succeed') {
                // Success! Stop polling and display the model
                clearInterval(statusCheckInterval);
                
                if (data.modelUrl) {
                    // Store the model URL for download
                    currentModelUrl = data.modelUrl;
                    
                    // Load the model into the viewer
                    loadModel(data.modelUrl);
                    
                    // Setup download button
                    downloadLink.href = data.modelUrl;
                    
                    // Determine file format from URL for download filename
                    let fileExtension = 'glb';
                    if (data.modelUrl.endsWith('.fbx')) {
                        fileExtension = 'fbx';
                    } else if (data.modelUrl.endsWith('.obj')) {
                        fileExtension = 'obj';
                    }
                    downloadLink.download = `tripo_3d_model.${fileExtension}`;
                    
                    downloadSection.style.display = 'block';
                    
                    // Update status
                    statusMessage.textContent = 'Model generated successfully!';
                    loadingSpinner.style.display = 'none';
                    
                    // Re-enable generate button
                    generateBtn.disabled = false;
                } else {
                    throw new Error('Model completed but no URL returned');
                }
            } 
            else if (data.status === 'failed' || data.status === 'error') {
                // Failure
                clearInterval(statusCheckInterval);
                throw new Error(data.error || 'Model generation failed');
            }
            else {
                // Still processing - could be 'running', 'pending', etc. in v2 API
                const message = data.message || 'Processing...';
                document.getElementById('processingText').innerText = message;
                
                // Update progress display
                if (data.progress) {
                    const percent = Math.round(parseFloat(data.progress));
                    document.getElementById('processingText').innerText = 
                        `${message} (${percent}% complete)`;
                }
            }
            
            // Reset error count on successful status check
            statusCheckErrorCount = 0;
        } else {
            // Handle HTTP errors
            const errorData = await response.json();
            console.error('Status check error:', errorData);
            
            // Keep track of consecutive errors
            statusCheckErrorCount++;
            
            // If we've had too many errors, stop checking
            if (statusCheckErrorCount >= 5) {
                clearInterval(statusCheckInterval);
                throw new Error('Too many status check errors. Please try again.');
            }
        }
    } catch (error) {
        console.error('Error checking status:', error);
        
        // Keep track of consecutive errors
        statusCheckErrorCount++;
        
        // If we've had too many errors, stop checking
        if (statusCheckErrorCount >= 5) {
            clearInterval(statusCheckInterval);
            displayUserFriendlyError(error);
        }
    }
}

function initializeViewer() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, modelViewer.clientWidth / modelViewer.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    
    // Add renderer to DOM
    modelViewer.appendChild(renderer.domElement);
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
}

function loadModel(modelUrl, originalUrl) {
    console.log(`Loading model from: ${modelUrl}`);
    modelViewerStatus.style.display = 'flex';
    document.getElementById('processingText').innerText = 'Loading 3D model...';
    
    // Remove any existing model
    if (model) {
        scene.remove(model);
        model = null;
    }
    
    // Use GLTF Loader
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        // URL
        modelUrl,
        // onLoad callback
        function (gltf) {
            onModelLoaded(gltf);
        },
        // onProgress callback
        function (xhr) {
            onProgress(xhr);
        },
        // onError callback
        function (error) {
            onError(error, modelUrl, originalUrl);
        }
    );
}

function onModelLoaded(gltf) {
    console.log('Model loaded successfully:', gltf);
    
    try {
        // Store the model
        model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        
        // Move model to center position
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        
        // Add model to scene
        scene.add(model);
        
        // Enhance materials
        model.traverse(function(child) {
            if (child.isMesh) {
                enhanceMaterial(child.material);
            }
        });
        
        // Apply any additional post-processing
        applyModelPostProcessing(model);
        
        // Adjust camera to fit model in view
        fitCameraToObject(model);
        
        // Hide the loading overlay
        modelViewerStatus.style.display = 'none';
        
    } catch (error) {
        console.error('Error processing loaded model:', error);
        document.getElementById('processingText').innerText = `Error displaying model: ${error.message}`;
    }
}

function onProgress(xhr) {
    if (xhr.lengthComputable) {
        const percentComplete = xhr.loaded / xhr.total * 100;
        document.getElementById('processingText').innerText = `Loading: ${Math.round(percentComplete)}%`;
    }
}

function onError(error, modelUrl, originalUrl) {
    console.error('Error loading model:', error);
    
    // Display error message
    document.getElementById('processingText').innerText = `Error loading model: ${error.message}`;
    
    // Hide overlay after delay
    setTimeout(() => {
        modelViewerStatus.style.display = 'none';
    }, 3000);
}

function fitCameraToObject(object, offset = 1.5) {
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(object);
    
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Get the max side of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
    
    // Apply the offset
    cameraZ *= offset;
    
    // Update camera position and focus on center
    camera.position.z = cameraZ;
    
    const minZ = boundingBox.min.z;
    const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;
    
    camera.far = cameraToFarEdge * 3;
    camera.updateProjectionMatrix();
    
    // Update controls to center on the object
    controls.target = center;
    controls.update();
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
    // Add shadow casting for meshes
    model.traverse(function(node) {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    
    // Add a turntable animation if desired
    // This is optional and can be enabled by uncommenting:
    // addTurntableAnimation(model);
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
    
    // Clean up the message (remove technical details)
    const cleanMessage = message
        .replace(/Error:/gi, '')
        .replace(/\bat\b.*$/gm, '')
        .replace(/\{.*\}/g, '')
        .replace(/\[.*\]/g, '')
        .trim();
        
    // Update the appropriate element with the error message
    if (location === 'statusMessage') {
        statusMessage.textContent = cleanMessage;
    } else {
        document.getElementById('processingText').innerText = cleanMessage;
        
        // Make sure the error message is visible
        modelViewerStatus.style.display = 'flex';
        
        // Hide the error after a delay (for model viewer errors)
        setTimeout(() => {
            modelViewerStatus.style.display = 'none';
        }, 5000);
    }
    
    // Stop any loading indicators
    loadingSpinner.style.display = 'none';
} 