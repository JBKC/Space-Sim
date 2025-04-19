// spaceVR.js - Minimal VR test environment with just a spacebox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { loadTextureFromRegistry, universalScaleFactor } from '../appConfig/loaders.js';
import { initVRControllers, updateVRMovement, getControllerDebugInfo, setupCameraRig } from './movementVR.js';
import { createStars, updateStars } from './starsVR.js';
import { createCockpit } from './cockpitVR.js';

// Core scene elements
let scene, camera, renderer;
let spacebox;
let cameraRig; // Reference to the camera rig
let cockpit; // Reference to the cockpit model

// Star system
let starSystem;

// Track if the scene is initialized
let initialized = false;

// Movement tracking
let lastFrameTime = 0;

// Constants - reduced size to fix potential draw distance issues
const SKYBOX_SIZE = 125000; // Reduced to half the original size

// Initialize the minimal VR scene
export function init() {
    console.log("Initializing minimal VR test environment");
    
    if (initialized) {
        console.log("VR test environment already initialized, skipping");
        return { scene, camera, renderer };
    }
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create perspective camera with improved near/far planes
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150000);
    camera.position.set(0, 0, 0);
    
    // Create renderer with adjusted settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true // Add logarithmic depth buffer to help with draw distance issues
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000); // Ensure clear black background
    
    // Enable XR
    renderer.xr.enabled = true;
    
    // Initialize VR controllers for movement
    initVRControllers(renderer);
    
    // Get space container and append renderer
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }
    
    // Create spacebox (skybox)
    createSpacebox();
    
    // Create stars with dynamic brightness
    starSystem = createStars();
    scene.add(starSystem.stars);
    console.log("Added dynamic star system to VR environment");
    
    // Remove any existing planet labels from DOM
    clearAllUIElements();
    
    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    // Create camera rig for separating head tracking from movement
    cameraRig = setupCameraRig(scene, camera);
    
    // Create and add cockpit model to camera rig
    cockpit = createCockpit();
    cameraRig.add(cockpit);
    console.log("Added cockpit model to VR environment");
    
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
        color: 0xffffff, // Changed to white for better visibility
        fog: false // Ensure no fog affects the skybox
    });
    
    spacebox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    spacebox.position.set(0, 0, 0);
    spacebox.renderOrder = -1000; // Ensure it renders behind everything else
    scene.add(spacebox);
}

// Remove all UI elements
function clearAllUIElements() {
    // Remove any existing planet labels from DOM
    const planetLabels = document.querySelectorAll('.planet-label');
    planetLabels.forEach(label => {
        if (label.parentNode) {
            label.parentNode.removeChild(label);
        }
    });
    
    // Hide any planet info boxes
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
    
    // Find and hide any possible black boxes or unexpected elements
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        // Hide any elements that might be positioned in front of the camera
        if (div.style.zIndex > 1000 && div.id !== 'space-container') {
            div.style.display = 'none';
        }
    });
    
    console.log("Cleared all UI elements");
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop - update movement based on VR controller inputs
export function update(timestamp) {
    // Calculate delta time for smooth movement
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    
    // Apply VR movement and rotation
    if (camera) {
        updateVRMovement(camera, deltaTime);
    }
    
    // Update stars brightness based on camera position
    if (starSystem && starSystem.stars) {
        // Use cameraRig position for star updates to ensure proper movement tracking
        const positionForStars = cameraRig ? cameraRig.position : camera.position;
        updateStars(starSystem.stars, positionForStars);
    }
    
    // Log controller state occasionally (for debugging)
    if (Math.random() < 0.01) { // Only log about 1% of the time to avoid console spam
        const debugInfo = getControllerDebugInfo();
        if (debugInfo.leftController.connected || debugInfo.rightController.connected) {
            console.log("VR Controller State:", debugInfo);
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
    
    // Ensure all UI elements are cleared
    clearAllUIElements();
    
    // Create XR animation loop
    function xrAnimationLoop(timestamp, frame) {
        // Update movement based on controllers
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
        
        // Make sure button is removed from DOM after clicking
        vrButton.addEventListener('click', () => {
            // Remove the button right after clicking
            setTimeout(() => {
                if (vrButton.parentNode) {
                    vrButton.parentNode.removeChild(vrButton);
                }
            }, 100);
        });
        
        vrButton.click();
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
    
    // Clean up cockpit
    if (cockpit) {
        cockpit.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    initialized = false;
    console.log("VR test environment disposed");
} 