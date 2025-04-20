// setupVR.js - Creates endless VR space sandbox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadTextureFromRegistry, universalScaleFactor } from '../appConfig/loaders.js';
import { initVRControllers, updateVRMovement, getControllerDebugInfo, setupCameraRig } from './movementVR.js';
import { createStars, updateStars } from './starsVR.js';
import { createCinematicSpaceEnvironment } from './spaceEnvVR.js';

// Core scene elements
let scene, camera, renderer;
let cameraRig; // Reference to the camera rig
let cockpit; // X-Wing cockpit model

// Advanced space environment elements
let spaceDustParticles = [];
let nebulaeClouds = [];
let galaxyBackdrop;
let directionalLightCone;
let spaceGradientSphere;

// Star system
let starSystem;

// Track if the scene is initialized
let initialized = false;

// Movement tracking
let lastFrameTime = 0;

// Constants
const COCKPIT_SCALE = 0.5; // Scale factor for the cockpit model

// Advanced space environment colors

// Initialize the minimal VR scene
export function init() {
    console.log("Initializing space VR environment");
    
    if (initialized) {
        console.log("VR environment already initialized, skipping");
        return { scene, camera, renderer };
    }
    
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.00001); // Very subtle exponential fog
    
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
    renderer.setClearColor(0x000011); // Very dark navy blue
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
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
    
    // Create advanced space environment elements
    createCinematicSpaceEnvironment();
    
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
    
    // Load X-Wing cockpit model
    // loadCockpitModel();
    
    // Add subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x111133, 0.5);
    scene.add(ambientLight);
    
    // Add directional light for cockpit illumination
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, -1);
    scene.add(directionalLight);
    
    // Mark as initialized
    initialized = true;
    console.log("VR test environment initialized");
    
    return { scene, camera, renderer };
}

// Load X-Wing cockpit model
function loadCockpitModel() {
    const loader = new GLTFLoader();
    
    loader.load(
        // Path to the model
        '/src/assets/models/x-wing_cockpit_lowres.glb',
        
        // Called when the model is loaded
        function(gltf) {
            cockpit = gltf.scene;
            
            // Scale and position the cockpit around the camera
            cockpit.scale.set(COCKPIT_SCALE, COCKPIT_SCALE, COCKPIT_SCALE);
            
            // Adjust position slightly to position the pilot's seat correctly
            cockpit.position.set(0, -0.4, 0);
            
            // Add the cockpit to the camera rig
            if (cameraRig) {
                // Add cockpit to the rig so it moves with the player
                cameraRig.add(cockpit);
                
                // Position it just in front of the camera
                cockpit.position.z = -0.2;
                
                // Ensure cockpit renders with proper materials
                cockpit.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.metalness = 0.3;
                        child.material.roughness = 0.7;
                        
                        // Set renderOrder to ensure cockpit renders after everything else
                        child.renderOrder = 1000;
                    }
                });
                
                console.log("X-Wing cockpit model loaded and added to camera rig");
            } else {
                console.error("Camera rig not available, cockpit not attached");
            }
        },
        
        // Called while loading is in progress
        function(xhr) {
            const percent = (xhr.loaded / xhr.total) * 100;
            console.log('Loading cockpit model: ' + percent.toFixed(0) + '%');
        },
        
        // Called if there's an error
        function(error) {
            console.error('Error loading cockpit model:', error);
        }
    );
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
    
    // Update the time uniform for shaders
    if (directionalLightCone && directionalLightCone.material && directionalLightCone.material.uniforms) {
        directionalLightCone.material.uniforms.time.value = timestamp * 0.001;
    }
    
    // Slowly rotate nebula clouds
    nebulaeClouds.forEach(nebula => {
        nebula.mesh.rotation.x += nebula.rotationSpeed.x;
        nebula.mesh.rotation.y += nebula.rotationSpeed.y;
        nebula.mesh.rotation.z += nebula.rotationSpeed.z;
    });
    
    // Animate space dust particles with gentle drift
    spaceDustParticles.forEach(particleSystem => {
        const positions = particleSystem.system.geometry.attributes.position.array;
        const initialPositions = particleSystem.initialPositions;
        
        for (let i = 0; i < positions.length; i += 3) {
            // Apply a sine wave drift to each particle
            const time = timestamp * particleSystem.driftSpeed;
            const offset = Math.sin(time + i * 0.01) * 200;
            
            positions[i] = initialPositions[i] + offset;
            positions[i + 1] = initialPositions[i + 1] + Math.sin(time * 0.7 + i * 0.02) * 200;
            positions[i + 2] = initialPositions[i + 2] + Math.sin(time * 0.5 + i * 0.03) * 200;
        }
        
        particleSystem.system.geometry.attributes.position.needsUpdate = true;
    });
    
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
    
    // Update galaxy backdrop to slowly rotate
    if (galaxyBackdrop) {
        galaxyBackdrop.rotation.z += 0.0001;
    }
    
    // Update gradient sphere to follow camera
    if (spaceGradientSphere && cameraRig) {
        spaceGradientSphere.position.copy(cameraRig.position);
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
    
    // Dispose all geometries and materials
    
    // Clean up space gradient sphere
    if (spaceGradientSphere) {
        if (spaceGradientSphere.geometry) spaceGradientSphere.geometry.dispose();
        if (spaceGradientSphere.material) spaceGradientSphere.material.dispose();
        scene.remove(spaceGradientSphere);
    }
    
    // Clean up nebulae
    nebulaeClouds.forEach(nebula => {
        if (nebula.mesh.geometry) nebula.mesh.geometry.dispose();
        if (nebula.mesh.material) {
            if (nebula.mesh.material.map) nebula.mesh.material.map.dispose();
            nebula.mesh.material.dispose();
        }
        scene.remove(nebula.mesh);
    });
    
    // Clean up space dust particles
    spaceDustParticles.forEach(particleSystem => {
        if (particleSystem.system.geometry) particleSystem.system.geometry.dispose();
        if (particleSystem.system.material) {
            if (particleSystem.system.material.map) particleSystem.system.material.map.dispose();
            particleSystem.system.material.dispose();
        }
        scene.remove(particleSystem.system);
    });
    
    // Clean up directional light cone
    if (directionalLightCone) {
        if (directionalLightCone.geometry) directionalLightCone.geometry.dispose();
        if (directionalLightCone.material) directionalLightCone.material.dispose();
        scene.remove(directionalLightCone);
    }
    
    // Clean up galaxy backdrop
    if (galaxyBackdrop) {
        if (galaxyBackdrop.geometry) galaxyBackdrop.geometry.dispose();
        if (galaxyBackdrop.material) {
            if (galaxyBackdrop.material.map) galaxyBackdrop.material.map.dispose();
            galaxyBackdrop.material.dispose();
        }
        scene.remove(galaxyBackdrop);
    }
    
    // Clean up cockpit model
    if (cockpit) {
        cockpit.traverse(function(child) {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
        scene.remove(cockpit);
    }
    
    // Reset arrays
    nebulaeClouds = [];
    spaceDustParticles = [];
    
    initialized = false;
    console.log("VR test environment disposed");
} 