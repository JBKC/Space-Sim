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

// Global variables
let uploadedImage = null;
let scene, camera, renderer, controls, model;
let taskId = null;
let statusCheckInterval = null;
let currentModelUrl = null; // Store the model URL for download 

// Server API endpoints
const SERVER_URL = 'http://localhost:3000';
const GENERATE_ENDPOINT = '/api/generate';
const STATUS_ENDPOINT = '/api/status';

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
    dropArea.addEventListener('click', () => fileInput.click(), false);
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
            uploadedImage = file;
            displayPreview(file);
            generateBtn.disabled = false;
        } else {
            alert('Please upload an image file.');
        }
    }
}

function displayPreview(file) {
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.file = file;
    preview.appendChild(img);

    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.readAsDataURL(file);
}

async function generateModel() {
    if (!uploadedImage) {
        alert('Please upload an image first.');
        return;
    }

    // Update UI for processing state
    generateBtn.disabled = true;
    statusMessage.textContent = 'Uploading image...';
    progressBar.style.width = '10%';

    try {
        // Create form data to send the image
        const formData = new FormData();
        formData.append('image', uploadedImage);
        
        console.log('Sending image to server...');
        statusMessage.textContent = 'Sending image to server...';
        
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
        statusMessage.textContent = 'Processing image (this may take a few minutes)...';
        progressBar.style.width = '30%';
        
        // Start polling for status
        startStatusPolling();
    } catch (error) {
        console.error('Error generating model:', error);
        statusMessage.textContent = `Error: ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}`;
        generateBtn.disabled = false;
        progressBar.style.width = '0%';
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
            statusMessage.textContent = 'Error: No task ID to check status';
            clearInterval(statusCheckInterval);
            generateBtn.disabled = false;
            return;
        }
        
        console.log('Checking status for task:', taskId);
        statusMessage.textContent = `Checking status for task: ${taskId}...`;
        
        // Call the server endpoint with the taskId - use the new URL format
        // NOTE: Changed from query parameter format to path parameter format
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
            statusMessage.textContent = 'Model generated successfully!';
            progressBar.style.width = '100%';
            
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
                throw new Error('No model file in the response');
            }
            
            generateBtn.disabled = false;
        } else if (status === 'failed' || status === 'error') {
            clearInterval(statusCheckInterval);
            statusMessage.textContent = 'Model generation failed.';
            progressBar.style.width = '0%';
            generateBtn.disabled = false;
        } else {
            // Still processing
            statusMessage.textContent = `Processing: ${status || 'in progress'}`;
            progressBar.style.width = '50%';
        }
    } catch (error) {
        console.error('Error checking task status:', error);
        statusMessage.textContent = `Error checking status: ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}`;
        clearInterval(statusCheckInterval);
        generateBtn.disabled = false;
    }
}

function initializeViewer() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, modelViewer.clientWidth / modelViewer.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create renderer with better settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        preserveDrawingBuffer: true,  // Needed for taking screenshots
        alpha: true                   // Allow transparency
    });
    renderer.setSize(modelViewer.clientWidth, modelViewer.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
    
    // For THREE.js r129 and newer, use these settings
    try {
        // For newer versions of THREE.js
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
    } catch (e) {
        // Fallback for older versions
        try {
            renderer.physicallyCorrectLights = true;
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMappingExposure = 1.0;
        } catch (err) {
            console.warn('Could not set advanced renderer properties:', err);
        }
    }
    modelViewer.appendChild(renderer.domElement);

    // Set up comprehensive lighting system
    // Ambient light (overall scene illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Brighter ambient
    scene.add(ambientLight);

    // Main directional light (sun-like with shadows)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 10, 10);
    mainLight.castShadow = true;
    
    // Configure shadow properties for better quality
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    // Add fill lights to prevent harsh shadows
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight1.position.set(-5, 5, -5);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight2.position.set(5, -5, -5);
    scene.add(fillLight2);

    // Add controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.autoRotate = false; // Can be enabled for automatic rotation
    controls.autoRotateSpeed = 1.0;

    // Add a small ground plane with shadow receiving
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xeeeeee,
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    ground.visible = false; // Hidden by default, will enable when model loads
    scene.add(ground);
    
    // Store the ground for later reference
    window.ground = ground;

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Add initial cube to show the viewer is working
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x3498db,
        roughness: 0.5,
        metalness: 0.2
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    
    // Animate the scene
    animate();
}

function loadModel(modelUrl, originalUrl) {
    try {
        // Store the original URL for the download button (direct from source)
        if (originalUrl) {
            downloadLink.href = originalUrl;
        } else {
            downloadLink.href = modelUrl;
        }
        downloadLink.download = 'trellis_model.glb'; // Suggest a filename
        downloadSection.style.display = 'block';
        
        // Automatically trigger download as a fallback
        triggerModelDownload(originalUrl || modelUrl);
        
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
            statusMessage.textContent = `Loading model: ${percent}%`;
            console.log(`Loading progress: ${loaded}/${total} (${percent}%)`);
        };
        
        manager.onError = function(url) {
            console.error('Error loading resource:', url);
            statusMessage.textContent = 'Error loading model. Downloadable version available below.';
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
                
                // Enable shadows for the whole model and its children
                model.traverse(function(node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        // Enhance materials if they exist
                        if (node.material) {
                            if (Array.isArray(node.material)) {
                                node.material.forEach(mat => enhanceMaterial(mat));
                            } else {
                                enhanceMaterial(node.material);
                            }
                        }
                    }
                });
                
                // Center the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Get model size to adjust ground plane and camera
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                
                // Show and resize ground plane based on model size
                if (window.ground) {
                    window.ground.visible = true;
                    window.ground.position.y = -size.y/2 - 0.01; // Position it just below the model
                    window.ground.scale.set(maxDim * 3, maxDim * 3, 1); // Scale it based on model size
                }
                
                // Add the model to the scene
                scene.add(model);
                
                // Adjust camera to fit the model
                const distance = maxDim * 2.5; // Provide more space around the model
                camera.position.set(distance, distance, distance);
                camera.lookAt(0, 0, 0);
                
                // Reset controls target to model center
                controls.target.set(0, 0, 0);
                controls.update();
                
                // Enable auto-rotation for better viewing
                controls.autoRotate = true;
                
                // Remove initial cube if model loads successfully
                scene.children.forEach(child => {
                    if (child.type === 'Mesh' && child.geometry.type === 'BoxGeometry') {
                        scene.remove(child);
                    }
                });
                
                // Update status
                statusMessage.textContent = 'Model loaded successfully!';
            },
            function (xhr) {
                // Progress
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                statusMessage.textContent = `Loading model: ${percent}%`;
                console.log(`Loading progress: ${percent}%`);
            },
            function (error) {
                console.error('Error loading model:', error);
                statusMessage.textContent = 'Error loading model. Model has been automatically downloaded.';
                
                // Make sure the download button is visible even if the model fails to load
                downloadSection.style.display = 'block';
            }
        );
    } catch (error) {
        console.error('Exception in loadModel:', error);
        statusMessage.textContent = 'Error loading model. Model has been automatically downloaded.';
        
        // Make sure the download button is visible even if there's an error
        downloadSection.style.display = 'block';
    }
}

// Helper function to enhance materials
function enhanceMaterial(material) {
    if (!material) return;
    
    // For standard materials, adjust properties
    if (material.isMeshStandardMaterial) {
        material.roughness = Math.min(material.roughness, 0.7); // Reduce roughness if it's too high
        material.metalness = Math.max(material.metalness, 0.2); // Increase metalness if it's too low
        material.envMapIntensity = 1.0; // Enhance environment reflections
    }
    
    // For basic materials, convert to standard material
    if (material.isMeshBasicMaterial) {
        const newMat = new THREE.MeshStandardMaterial({
            color: material.color,
            map: material.map,
            roughness: 0.5,
            metalness: 0.2
        });
        material.copy(newMat);
    }
}

// Function to trigger an automatic download of the model
function triggerModelDownload(url) {
    // Create a hidden link and trigger a click
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = url;
    tempLink.download = 'trellis_model.glb';
    tempLink.setAttribute('target', '_blank');
    document.body.appendChild(tempLink);
    
    // Use setTimeout to ensure the UI updates before the download starts
    setTimeout(() => {
        console.log('Auto-downloading model from:', url);
        try {
            tempLink.click();
            // Show a message about the download
            const downloadMessage = document.createElement('div');
            downloadMessage.className = 'download-notification';
            downloadMessage.textContent = 'Model download has started automatically';
            document.body.appendChild(downloadMessage);
            
            // Remove the message after 5 seconds
            setTimeout(() => {
                if (downloadMessage.parentNode) {
                    document.body.removeChild(downloadMessage);
                }
            }, 5000);
        } catch (e) {
            console.error('Failed to auto-download:', e);
        }
        
        // Clean up
        document.body.removeChild(tempLink);
    }, 1000);
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