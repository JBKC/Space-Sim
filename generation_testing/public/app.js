import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// DOM Elements
const uploadForm = document.getElementById('upload-form');
const generateBtn = document.getElementById('generate-btn');
const testConnectionBtn = document.getElementById('test-connection');
const loadDummyBtn = document.getElementById('load-dummy');
const testModeBtn = document.getElementById('test-mode-btn');
const statusElement = document.getElementById('status');
const errorElement = document.getElementById('error');
const connectionStatusElement = document.getElementById('connection-status');
const modelViewerElement = document.getElementById('model-viewer');
const modelStatsElement = document.getElementById('model-stats');

// Progress tracking elements
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const progressStatus = document.getElementById('progress-status');
const logEntriesContainer = document.getElementById('log-entries');
const parametersDisplay = document.getElementById('parameters-display');
const parametersContent = document.getElementById('parameters-content');

// Socket.io connection
const socket = io();

// Three.js variables
let scene, camera, renderer, controls, model;
let isModelLoaded = false;
let currentRequestId = null;
let useTestMode = false; // Flag for test mode

// Initialize socket.io events
initSocketEvents();

// Check server connection on page load
checkServerConnection();

// Initialize the 3D viewer
initViewer();

// Event listeners
uploadForm.addEventListener('submit', handleFormSubmit);
testConnectionBtn.addEventListener('click', checkServerConnection);
loadDummyBtn.addEventListener('click', loadDummyModel);
testModeBtn.addEventListener('click', toggleTestMode);

// Toggle test mode
function toggleTestMode() {
  useTestMode = !useTestMode;
  testModeBtn.textContent = useTestMode 
    ? 'Test Mode: ON (No API Call)' 
    : 'Use Test Mode (No API Call)';
    
  if (useTestMode) {
    testModeBtn.classList.add('active');
    addLogEntry('Test mode activated - API will not be called', 'warning');
  } else {
    testModeBtn.classList.remove('active');
    addLogEntry('Test mode deactivated - API will be called normally', 'info');
  }
}

// Initialize socket events
function initSocketEvents() {
  socket.on('connect', () => {
    console.log('Connected to server');
    addLogEntry('Connected to server', 'success');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addLogEntry('Disconnected from server', 'error');
  });
  
  socket.on('status', (data) => {
    console.log('Status update:', data);
    
    // Only process if it's the current request or a new one
    if (currentRequestId === null || data.requestId === currentRequestId) {
      currentRequestId = data.requestId;
      
      // Update progress UI
      updateProgress(data);
      
      // Add to log
      addLogEntry(data.message, data.status === 'error' ? 'error' : 'info');
      
      // Show parameters if available
      if (data.details) {
        showParameters(data.details);
      }
      
      // Handle completion
      if (data.status === 'complete' && data.data) {
        loadModel(data.data.modelPath);
        if (data.data.stats) {
          displayModelStats(data.data.stats);
        }
      }
      
      // Handle errors
      if (data.status === 'error') {
        showError(data.message);
        
        // Add troubleshooting tips for common errors
        if (data.message.includes('API Error')) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'troubleshooting-tips';
          errorDiv.innerHTML = `
            <h4>Troubleshooting Tips:</h4>
            <ul>
              <li>Try using Test Mode to verify the application works without API calls</li>
              <li>Check if your Huggingface API key is valid and has necessary permissions</li>
              <li>The Hunyuan3D-2 model might be temporarily unavailable</li>
              <li>Try with a smaller or simpler image</li>
              <li>Check your network connection and any firewalls</li>
            </ul>
          `;
          errorElement.appendChild(errorDiv);
        }
      }
    }
  });
}

// Update progress UI
function updateProgress(data) {
  // Show progress container
  progressContainer.style.display = 'block';
  
  // Update progress percentage
  const progress = data.progress || 0;
  progressBar.style.width = `${progress}%`;
  progressPercentage.textContent = `${progress}%`;
  
  // Update status text
  progressStatus.textContent = data.message || 'Processing...';
  
  // Add classes based on status
  progressBar.className = 'progress-bar';
  if (data.status === 'error') {
    progressBar.classList.add('error');
  } else if (data.status === 'complete') {
    progressBar.classList.add('complete');
  } else {
    progressBar.classList.add('processing');
  }
}

// Add entry to log
function addLogEntry(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  
  logEntriesContainer.appendChild(entry);
  logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
}

// Show parameters
function showParameters(details) {
  parametersDisplay.style.display = 'block';
  
  let html = '<ul class="parameters-list">';
  for (const [key, value] of Object.entries(details)) {
    html += `<li><strong>${key}:</strong> ${value}</li>`;
  }
  html += '</ul>';
  
  parametersContent.innerHTML = html;
}

// Reset progress and logs
function resetProgressAndLogs() {
  // Reset progress
  progressBar.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressStatus.textContent = 'Waiting to start...';
  
  // Clear logs
  logEntriesContainer.innerHTML = '';
  
  // Hide parameters
  parametersDisplay.style.display = 'none';
  parametersContent.innerHTML = '';
  
  // Reset current request ID
  currentRequestId = null;
}

// Check server connection
async function checkServerConnection() {
  connectionStatusElement.className = '';
  connectionStatusElement.textContent = 'Checking server connection...';
  
  try {
    const response = await fetch('/api/test');
    if (response.ok) {
      const data = await response.json();
      connectionStatusElement.textContent = 'Server connected';
      connectionStatusElement.className = 'connected';
      addLogEntry('Server connection test successful', 'success');
      return true;
    } else {
      throw new Error('Server responded with an error');
    }
  } catch (error) {
    connectionStatusElement.textContent = 'Server disconnected';
    connectionStatusElement.className = 'disconnected';
    console.error('Server connection error:', error);
    addLogEntry('Server connection test failed', 'error');
    return false;
  }
}

// Load a dummy model for testing
async function loadDummyModel() {
  try {
    showStatus('Loading sample model...');
    addLogEntry('Loading sample model', 'info');
    
    const response = await fetch('/api/dummy-model');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'No sample models available');
    }
    
    const data = await response.json();
    
    // Load the generated model
    if (data.modelPath) {
      loadModel(data.modelPath);
      
      // Display model stats
      if (data.stats) {
        displayModelStats(data.stats);
      }
      
      showStatus('Sample model loaded successfully!');
      addLogEntry('Sample model loaded successfully', 'success');
    } else {
      throw new Error('No model path returned');
    }
  } catch (error) {
    console.error('Error loading sample model:', error);
    showError(`Error: ${error.message}`);
    addLogEntry(`Error loading sample model: ${error.message}`, 'error');
  }
}

// Initialize the 3D viewer
function initViewer() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    modelViewerElement.clientWidth / modelViewerElement.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(modelViewerElement.clientWidth, modelViewerElement.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Set output color space (compatible with all THREE.js versions)
  if (THREE.ColorManagement) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // Add renderer to DOM
  modelViewerElement.innerHTML = ''; // Clear any previous content
  modelViewerElement.appendChild(renderer.domElement);

  // Add orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Add a grid helper for reference
  const gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
  
  addLogEntry('3D viewer initialized', 'info');
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
  if (!modelViewerElement) return;
  
  camera.aspect = modelViewerElement.clientWidth / modelViewerElement.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(modelViewerElement.clientWidth, modelViewerElement.clientHeight);
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  
  // Check server connection first
  if (!await checkServerConnection()) {
    showError('Cannot connect to server. Please check if the server is running.');
    addLogEntry('Cannot connect to server', 'error');
    return;
  }
  
  // Reset progress tracking
  resetProgressAndLogs();
  
  const formData = new FormData(uploadForm);
  const imageFile = formData.get('image');
  
  if (!imageFile) {
    showError('Please select an image file');
    addLogEntry('No image file selected', 'error');
    return;
  }
  
  // Log file details
  addLogEntry(`Selected file: ${imageFile.name} (${(imageFile.size / 1024).toFixed(2)} KB)`, 'info');
  
  // Disable the button and show status
  generateBtn.disabled = true;
  loadDummyBtn.disabled = true;
  
  // Choose endpoint based on test mode
  const endpoint = useTestMode ? '/api/generate-test' : '/api/generate';
  
  // Show message about mode
  if (useTestMode) {
    showStatus('Test mode: Generating model without API call...');
    addLogEntry('Using test mode - API will not be called', 'warning');
  } else {
    showStatus('Uploading image and generating 3D model. This may take a while...');
    addLogEntry('Using normal mode - API will be called', 'info');
  }
  
  try {
    // Make API request
    addLogEntry(`Sending request to server (${useTestMode ? 'test mode' : 'normal mode'})`, 'info');
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      // Handle error response
      let errorMessage = `Server returned status ${response.status}: ${response.statusText}`;
      
      try {
        // Try to parse error as JSON
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // If we can't parse as JSON, leave the default error message
        console.error('Failed to parse error response as JSON:', e);
      }
      
      throw new Error(errorMessage);
    }
    
    // Only try to parse the response as JSON if we expect it to be JSON
    // The socket.io system will handle the real-time updates
    addLogEntry('Server processing started successfully', 'success');
  } catch (error) {
    console.error('Error:', error);
    showError(`Error: ${error.message}`);
    addLogEntry(`Error: ${error.message}`, 'error');
    
    // Update progress with error
    updateProgress({
      progress: 0,
      status: 'error',
      message: error.message
    });
  } finally {
    generateBtn.disabled = false;
    loadDummyBtn.disabled = false;
  }
}

// Load the 3D model
function loadModel(modelPath) {
  // Add cache-busting query parameter
  const cacheBusterUrl = `${modelPath}?t=${Date.now()}`;
  
  // Remove any existing model
  if (model) {
    scene.remove(model);
    model = null;
  }
  
  // Show loading status
  showStatus('Loading model...');
  addLogEntry(`Loading model from: ${modelPath}`, 'info');
  
  // Create GLTFLoader
  const loader = new GLTFLoader();
  
  // Load the model with better error handling
  loader.load(
    cacheBusterUrl,
    (gltf) => {
      try {
        model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Log model details for debugging
        console.log('Model loaded:', {
          size: size,
          center: center
        });
        addLogEntry(`Model dimensions: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`, 'info');
        
        // Normalize model size
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 0) {
          const scale = 2 / maxDimension;
          model.scale.set(scale, scale, scale);
          addLogEntry(`Model scaled by factor: ${scale.toFixed(4)}`, 'info');
        }
        
        // Reset position
        model.position.set(-center.x, -center.y, -center.z);
        
        // Add to scene
        scene.add(model);
        
        // Position camera to view model
        const distance = Math.max(size.length() * 1.5, 2);
        camera.position.set(distance, distance, distance);
        controls.target.set(0, 0, 0);
        controls.update();
        
        // Update status
        showStatus('Model loaded successfully. Use mouse to rotate, scroll to zoom.');
        addLogEntry('Model loaded successfully', 'success');
        isModelLoaded = true;
      } catch (error) {
        console.error('Error processing loaded model:', error);
        showError(`Failed to process model: ${error.message}`);
        addLogEntry(`Error processing model: ${error.message}`, 'error');
      }
    },
    (xhr) => {
      const percentComplete = (xhr.loaded / xhr.total) * 100;
      showStatus(`Loading model... ${Math.round(percentComplete)}%`);
      if (percentComplete % 25 < 1) { // Log approximately every 25%
        addLogEntry(`Loading model: ${Math.round(percentComplete)}%`, 'info');
      }
    },
    (error) => {
      console.error('Error loading model:', error);
      showError(`Failed to load model: ${error.message}`);
      addLogEntry(`Error loading model: ${error.message}`, 'error');
    }
  );
}

// Display model statistics
function displayModelStats(stats) {
  if (!stats) {
    modelStatsElement.innerHTML = '';
    return;
  }
  
  // Format the stats
  let statsHtml = '<h3>Model Statistics</h3>';
  statsHtml += '<ul>';
  
  for (const [key, value] of Object.entries(stats)) {
    statsHtml += `<li><strong>${formatKey(key)}:</strong> ${formatValue(value)}</li>`;
  }
  
  statsHtml += '</ul>';
  modelStatsElement.innerHTML = statsHtml;
  
  // Log stats
  addLogEntry('Model statistics loaded', 'info');
}

// Format key for display
function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Format value for display
function formatValue(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value.toFixed(2);
  }
  return value;
}

// Show status message
function showStatus(message) {
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  errorElement.style.display = 'none';
}

// Show error message
function showError(message) {
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  statusElement.style.display = 'none';
}