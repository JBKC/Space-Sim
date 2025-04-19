// spaceVR.js - Minimal VR test environment with just a spacebox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { loadTextureFromRegistry, universalScaleFactor } from '../appConfig/loaders.js';

// Core scene elements
let scene, camera, renderer;
let spacebox;
let vrTestMessage;

// Track if the scene is initialized
let initialized = false;

// Constants
const SKYBOX_SIZE = 250000;

// Initialize the minimal VR scene
export function init() {
    console.log("Initializing minimal VR test environment");
    
    if (initialized) {
        console.log("VR test environment already initialized, skipping");
        return { scene, camera, renderer };
    }
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create perspective camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
    camera.position.set(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    
    // Enable XR
    renderer.xr.enabled = true;
    
    // Get space container and append renderer
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }
    
    // Create spacebox (skybox)
    createSpacebox();
    
    // Create a floating VR test mode message
    createVRTestMessage();
    
    // Remove any existing planet labels from DOM
    clearPlanetLabels();
    
    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    // Mark as initialized
    initialized = true;
    console.log("VR test environment initialized");
    
    return { scene, camera, renderer };
}

// Create spacebox (skybox)
function createSpacebox() {
    // Use the same skybox texture loading approach as the main environment
    const skyboxTexture = loadTextureFromRegistry('skybox', 'galaxy');
    const skyboxGeometry = new THREE.BoxGeometry(
        SKYBOX_SIZE * universalScaleFactor,
        SKYBOX_SIZE * universalScaleFactor,
        SKYBOX_SIZE * universalScaleFactor
    );
    const skyboxMaterial = new THREE.MeshBasicMaterial({
        map: skyboxTexture,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        color: 0x555555
    });
    
    spacebox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    spacebox.position.set(0, 0, 0);
    scene.add(spacebox);
}

// Remove any existing planet labels
function clearPlanetLabels() {
    // Remove any existing planet labels from DOM
    const planetLabels = document.querySelectorAll('.planet-label');
    planetLabels.forEach(label => {
        if (label.parentNode) {
            label.parentNode.removeChild(label);
        }
    });
    
    // Also hide any planet info boxes
    const planetInfoBox = document.querySelector('.planet-info-box');
    if (planetInfoBox) {
        planetInfoBox.style.display = 'none';
    }
    
    // Hide any distance indicators
    const distanceIndicators = document.querySelectorAll('.distance-indicator');
    distanceIndicators.forEach(indicator => {
        indicator.style.display = 'none';
    });
    
    // Hide exploration counter if it exists
    const explorationCounter = document.querySelector('.exploration-counter');
    if (explorationCounter) {
        explorationCounter.style.display = 'none';
    }
    
    // Hide hyperspace progress container
    const progressContainer = document.getElementById('hyperspace-progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    console.log("Cleared all planet labels and related UI elements");
}

// Create a floating message in the VR environment
function createVRTestMessage() {
    // Create a canvas texture for the message
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;
    
    // Set background color
    context.fillStyle = 'rgba(0, 0, 40, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    context.strokeStyle = '#4fc3f7';
    context.lineWidth = 8;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Set text style
    context.font = 'bold 36px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw header
    context.fillStyle = '#4fc3f7';
    context.fillText('VR TEST MODE', canvas.width / 2, 60);
    
    // Draw description
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.fillText('You are in a minimal VR test environment', canvas.width / 2, 120);
    context.fillText('with only the space skybox.', canvas.width / 2, 160);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create a plane with the texture
    const geometry = new THREE.PlaneGeometry(2, 1);
    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true,
        side: THREE.DoubleSide
    });
    
    vrTestMessage = new THREE.Mesh(geometry, material);
    
    // Position the message in front of the camera
    vrTestMessage.position.set(0, 0, -5);
    
    // Add the message to the scene
    scene.add(vrTestMessage);
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop - update the message position to always face the user
export function update(timestamp) {
    if (vrTestMessage) {
        // Ensure the message stays in front of the camera
        if (camera.position && camera.quaternion) {
            // Calculate position 5 units in front of camera
            const distance = 5;
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(camera.quaternion);
            
            vrTestMessage.position.copy(camera.position);
            vrTestMessage.position.addScaledVector(cameraDirection, distance);
            
            // Make message face the camera
            vrTestMessage.quaternion.copy(camera.quaternion);
        }
    }
}

// Render function
export function renderScene() {
    return { scene, camera };
}

// Start VR animation loop
export function startVRMode() {
    console.log("Starting VR mode animation loop");
    
    // Ensure all planet labels and UI elements are cleared
    clearPlanetLabels();
    
    // Create XR animation loop
    function xrAnimationLoop(timestamp, frame) {
        // Update message position to face the user
        update(timestamp);
        
        // Render the scene
        renderer.render(scene, camera);
    }
    
    // Set the animation loop
    renderer.setAnimationLoop(xrAnimationLoop);
    console.log("VR animation loop set");
    
    // Automatically enter VR after a short delay
    setTimeout(() => {
        // Create and click a VR button
        const vrButton = VRButton.createButton(renderer);
        document.body.appendChild(vrButton);
        vrButton.click();
        
        // Remove the button after clicking
        setTimeout(() => {
            if (vrButton.parentNode) {
                vrButton.parentNode.removeChild(vrButton);
            }
        }, 1000);
    }, 1000);
}

// Clean up
export function dispose() {
    renderer.setAnimationLoop(null);
    
    // Remove window resize listener
    window.removeEventListener('resize', onWindowResize);
    
    // Remove renderer from DOM
    if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    
    // Dispose geometries and materials
    if (spacebox) {
        if (spacebox.geometry) spacebox.geometry.dispose();
        if (spacebox.material) {
            if (spacebox.material.map) spacebox.material.map.dispose();
            spacebox.material.dispose();
        }
    }
    
    if (vrTestMessage) {
        if (vrTestMessage.geometry) vrTestMessage.geometry.dispose();
        if (vrTestMessage.material) {
            if (vrTestMessage.material.map) vrTestMessage.material.map.dispose();
            vrTestMessage.material.dispose();
        }
    }
    
    initialized = false;
    console.log("VR test environment disposed");
} 