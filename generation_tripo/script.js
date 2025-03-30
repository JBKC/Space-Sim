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
let currentModelUrl = null; 

// Server API endpoints
const SERVER_URL = 'http://localhost:8000';
const GENERATE_ENDPOINT = '/api/generate';
const STATUS_ENDPOINT = '/api/status';

// Check server connectivity on load
checkServerHealth();

// Initialize the 3D viewer
initializeViewer();

// Setup event listeners
setupEventListeners();

// Function to check server health
function checkServerHealth() {
    fetch(`${SERVER_URL}/health`)
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Server not responding');
        })
        .then(data => {
            console.log('Server health:', data);
            statusMessage.textContent = 'Ready - Server connected';
        })
        .catch(error => {
            console.error('Server connection error:', error);
            statusMessage.textContent = 'Error: Cannot connect to server';
        });
}

// Set up UI event listeners
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
    
    // File input label handler
    const fileInputLabel = document.querySelector('.file-input-label');
    if (fileInputLabel) {
        fileInputLabel.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        }, false);
    } else {
        dropArea.addEventListener('click', () => fileInput.click(), false);
    }
    
    generateBtn.addEventListener('click', generateModel, false);
}

// Event handler utilities
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
            validateAndProcessImage(file);
        } else {
            statusMessage.textContent = 'Please upload an image file.';
        }
    }
}

function validateAndProcessImage(file) {
    // Clear any existing previews
    preview.innerHTML = '';
    
    // Display preview of image
    displayPreview(file);
    
    // Store the uploaded image
    uploadedImage = file;
    
    // Enable the generate button
    generateBtn.disabled = false;
    
    // Update status
    statusMessage.textContent = 'Image ready for 3D generation';
}

function displayPreview(file) {
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
    statusMessage.textContent = 'Sending to server...';
    generateBtn.disabled = true;
    loadingSpinner.style.display = 'flex';
    modelViewerStatus.style.display = 'flex';
    document.getElementById('processingText').innerText = 'Starting 3D generation...';
    
    try {
        // Create FormData and append the image
        const formData = new FormData();
        formData.append('image', uploadedImage);
        
        // Call the generation endpoint
        const response = await fetch(`${SERVER_URL}${GENERATE_ENDPOINT}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('Generation initiated:', data);
            
            // Save the task ID and start polling for status
            taskId = data.taskId;
            startStatusPolling(taskId);
            
            // Update status
            statusMessage.textContent = 'Generation started';
            document.getElementById('processingText').innerText = 'Processing...';
        } else {
            throw new Error(data.error || 'Failed to start generation');
        }
    } catch (error) {
        console.error('Error:', error);
        statusMessage.textContent = `Error: ${error.message}`;
        modelViewerStatus.style.display = 'none';
        generateBtn.disabled = false;
        loadingSpinner.style.display = 'none';
    }
}

function startStatusPolling(taskId) {
    // Clear any existing interval
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Poll for status every 3 seconds
    statusCheckInterval = setInterval(() => checkModelStatus(taskId), 3000);
}

async function checkModelStatus(taskId) {
    try {
        const response = await fetch(`${SERVER_URL}${STATUS_ENDPOINT}/${taskId}`);
        const data = await response.json();
        
        console.log('Status update:', data);
        
        // Check if model is completed
        if (data.status === 'completed') {
            clearInterval(statusCheckInterval);
            
            // Load the model if URL is provided
            if (data.modelUrl) {
                currentModelUrl = data.modelUrl;
                loadModel(data.modelUrl);
                
                // Setup download button
                downloadLink.href = data.modelUrl;
                downloadLink.download = '3d_model.glb';
                downloadSection.style.display = 'block';
                
                // Update status
                statusMessage.textContent = '3D model generated successfully!';
                loadingSpinner.style.display = 'none';
                generateBtn.disabled = false;
            } else {
                throw new Error('Model URL not provided');
            }
        }
    } catch (error) {
        console.error('Error checking status:', error);
        // We'll keep polling anyway
    }
}

function loadModel(modelUrl) {
    console.log(`Loading model from: ${modelUrl}`);
    document.getElementById('processingText').innerText = 'Loading 3D model...';
    
    // Remove any existing model
    if (model) {
        scene.remove(model);
        model = null;
    }
    
    // Use GLTF Loader
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        modelUrl,
        function (gltf) {
            model = gltf.scene;
            
            // Center the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            
            model.position.x = -center.x;
            model.position.y = -center.y;
            model.position.z = -center.z;
            
            scene.add(model);
            
            // Adjust camera to fit model
            fitCameraToObject(model, 1.5);
            
            // Hide the loading overlay
            modelViewerStatus.style.display = 'none';
        },
        function (xhr) {
            const percent = xhr.loaded / xhr.total * 100;
            document.getElementById('processingText').innerText = `Loading: ${Math.round(percent)}%`;
        },
        function (error) {
            console.error('Error loading model:', error);
            document.getElementById('processingText').innerText = `Error: ${error.message}`;
            setTimeout(() => {
                modelViewerStatus.style.display = 'none';
            }, 3000);
        }
    );
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
    
    // Add renderer to DOM
    modelViewer.appendChild(renderer.domElement);
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
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
    
    // Update camera position
    camera.position.z = cameraZ;
    camera.updateProjectionMatrix();
    
    // Update controls to center on the object
    controls.target = center;
    controls.update();
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