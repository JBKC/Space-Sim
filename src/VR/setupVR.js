// setupVR.js - Creates endless VR space sandbox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { 
    loadTextureFromRegistry, 
    loadModelFromRegistry, 
    loadingManager,
    textureLoadingManager,
    universalScaleFactor 
} from '../appConfig/loaders.js';
import { initVRControllers, updateVRMovement, getControllerDebugInfo, setupCameraRig } from './movementVR.js';
import {
    spaceGradientSphere,
    nebula,
    nebulaeClouds,
    particleSystem,
    spaceDustParticles,
    directionalLightCone,
    galaxyBackdrop,
    createStars,
    updateStars
} from './spaceEnvVR.js';


/////////////// SCENE INITIALIZATION ///////////////

// Core scene elements
let scene, camera, renderer;
let cameraRig; // Reference to the camera rig
let cockpit; // X-Wing cockpit model

// Debug elements
let debugTextMesh;
let debugInfo = {};

// Height tracking for cockpit
let headHeight = 0; // This will be set ONCE during calibration

let starSystem;
let initialized = false;
let lastFrameTime = 0;
const COCKPIT_SCALE = 1; // Scale factor for the cockpit model


// Function to poll for head height and then trigger scene setup
function calibrateAndProceed() {
    // Stop if already calibrated (headHeight is set)
    if (headHeight > 0) return;

    // Stop polling if XR session ended before calibration
    if (!renderer || !renderer.xr?.isPresenting) {
        console.log("XR session not presenting, waiting...");
        setDebugInfo('Calibration Status', 'Waiting for XR session');
        requestAnimationFrame(calibrateAndProceed); // Keep trying
        return;
    }

    // Session is presenting, try to get camera height
    const xrCamera = renderer.xr.getCamera();
    if (!xrCamera) {
        console.log("XR Camera not available yet, waiting...");
        setDebugInfo('Calibration Status', 'Waiting for XR Camera');
        requestAnimationFrame(calibrateAndProceed);
        return;
    }

    const currentHeadHeight = xrCamera.position.y;

    // Check if height is valid (e.g., > 0.1m)
    if (currentHeadHeight > 0.1) {
        headHeight = currentHeadHeight;
        console.log(`>>> Head height calibrated: ${headHeight.toFixed(3)} <<<`);
        setDebugInfo('Calibration Status', `Calibrated: ${headHeight.toFixed(3)}`);
        
        // --- Calibration Complete: Proceed with scene setup! ---
        setupSceneAndLoadAssets(); 
        // --- Stop Polling --- (by not calling requestAnimationFrame again)
        return; 
    } else {
        // Still waiting for valid height
        setDebugInfo('Calibration Status', `Waiting for valid height (${currentHeadHeight.toFixed(3)})`);
        requestAnimationFrame(calibrateAndProceed);
    }
}


// Initialize VR - Phase 1: Setup Renderer and start calibration
export function init() {
    console.log("Initializing VR (Phase 1: Renderer Setup & Calibration Start)");
    
    // Only run phase 1 once
    if (renderer) {
        console.log("Phase 1 already done.");
        return;
    }

    // Create renderer with adjusted settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true // Add logarithmic depth buffer
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x05182b); // Main space background color
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Enable XR
    renderer.xr.enabled = true;
    renderer.xr.setFoveation(0); // Disable foveated rendering

    // Listen for session start to begin calibration
    renderer.xr.addEventListener('sessionstart', function sessionStartHandler() {
        console.log("XR session started - beginning head height calibration polling.");
        setDebugInfo('Calibration Status', 'Session started, polling...');
        requestAnimationFrame(calibrateAndProceed);
        // Remove listener after first fire if needed, though polling check handles redundancy
        // renderer.xr.removeEventListener('sessionstart', sessionStartHandler);
    });

    // Add renderer to DOM
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    console.log("Phase 1 Complete: Renderer ready, waiting for session start to calibrate.");
    // Note: Scene, camera, assets are NOT loaded yet.
}

// Initialize VR - Phase 2: Setup scene, camera, assets AFTER calibration
function setupSceneAndLoadAssets() {
    console.log("Initializing VR (Phase 2: Scene Setup & Asset Loading - HeadHeight: " + headHeight.toFixed(3) + ")");

    // Ensure this only runs once
    if (scene) { // Use scene existence as a flag for phase 2 completion
        console.log("Phase 2 already done.");
        return;
    }

    ///// Scene Setup /////

    // Create scene
    scene = new THREE.Scene();
    
    // Create perspective camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150000);
    camera.position.set(0, 0, 0); // Camera starts at rig origin
    
    // REMOVED: Renderer is created in init()
    // renderer = new THREE.WebGLRenderer(...);
    
    // REMOVED: XR setup is done in init()
    // renderer.xr.enabled = true;
    // renderer.xr.addEventListener(...);

    // Set up render quality specifics (can stay here or move to init)
    const session = renderer.xr.getSession();
    if (session) {
        session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, renderer.getContext(), {
                framebufferScaleFactor: 1.0,
                alpha: false, depth: true, stencil: false, antialias: true, multiview: true
            })
        });
        console.log("WebXR render state configured for high quality.");
    }

    // Create stars 
    starSystem = createStars();
    scene.add(starSystem.stars);
    console.log("Added dynamic star system.");

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 100, -1);
    scene.add(directionalLight);
    const ambientLight = new THREE.AmbientLight(0x111133, 1);
    scene.add(ambientLight);

    ///// Gameplay Setup /////

    // Initialize VR controllers
    initVRControllers(renderer);
    
    // Create camera rig 
    // IMPORTANT: Must happen AFTER camera created, BEFORE cockpit loaded
    cameraRig = setupCameraRig(scene, camera);
    console.log("Camera rig created.");
    
    // Load X-Wing cockpit model (uses global headHeight now)
    loadCockpitModel(); 

    // Create debug text display 
    // IMPORTANT: Must happen AFTER cameraRig is created
    createDebugDisplay();
    console.log("Debug display created.");

    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    console.log("Phase 2 Complete: Scene and assets loaded.");
}

// Load X-Wing cockpit model (now uses global headHeight)
function loadCockpitModel() { // REMOVED headHeight parameter
    // Create an empty group to hold the cockpit model
    cockpit = new THREE.Group();
    
    const loadCockpitPromise = new Promise((resolve, reject) => {
        loadModelFromRegistry(
            'spacecraft',
            'xwingCockpit',
            (gltf) => {
                const model = gltf.scene;
                
                // Scale the model properly
                model.scale.set(COCKPIT_SCALE, COCKPIT_SCALE, COCKPIT_SCALE);
                
                // Add model to our cockpit group
                cockpit.add(model);
                cockpit.name = 'cockpitModel';
                
                // Rotate cockpit 180 degrees around Y-axis to face forward
                cockpit.rotation.y = Math.PI; // This is a 180-degree rotation in radians
                
                // Add cockpit to the rig
                if (cameraRig) {
                    cameraRig.add(cockpit);
                    
                    // --- Set Cockpit Position using calibrated headHeight --- 
                    if (headHeight > 0) {
                        const cockpitYOffset = -headHeight; // Adjust so floor is near feet
                        cockpit.position.y = cockpitYOffset;
                        console.log(`Cockpit position set using calibrated headHeight: ${headHeight.toFixed(3)}, Y: ${cockpitYOffset.toFixed(3)}`);
                        setDebugInfo('Cockpit Y Pos', cockpitYOffset.toFixed(3));
                    } else {
                        // Should not happen if called after calibration, but log if it does
                        console.error("Cockpit loaded but headHeight is not calibrated! Setting Y to 0.");
                        cockpit.position.y = 0;
                        setDebugInfo('Cockpit Y Pos', 'Error - headHeight 0');
                    }
                    // ---------------------------------------------------------

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
                
                resolve(cockpit);
            },
            (xhr) => {
                // Progress callback
                const percent = (xhr.loaded / xhr.total) * 100;
                console.log(`Cockpit: ${percent.toFixed(0)}% loaded`);
            },
            (error) => {
                // Error callback
                console.error('Error loading cockpit model from registry:', error);
                reject(error);
            }
        );
    });
    
    // Return the promise for future use if needed
    return loadCockpitPromise;
}


/////////////// ANIMATION LOOP ///////////////

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

// Animation loop - update movement based on VR controller inputs
function update(timestamp) {
    // Calculate delta time for smooth movement
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    // Set debug info for headHeight in update loop
    setDebugInfo('HeadHeight in Update', typeof headHeight === 'number' ? headHeight.toFixed(3) : 'N/A');

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
    
    // Update debug display
    updateDebugDisplay(timestamp);
}



////////////////////////////////////////////////////////////


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
    
    // Clean up debug display
    if (debugTextMesh) {
        if (debugTextMesh.material) {
            if (debugTextMesh.material.map) debugTextMesh.material.map.dispose();
            debugTextMesh.material.dispose();
        }
        if (debugTextMesh.geometry) debugTextMesh.geometry.dispose();
        if (debugTextMesh.parent) debugTextMesh.parent.remove(debugTextMesh);
    }
    
    // Reset arrays
    nebulaeClouds = [];
    spaceDustParticles = [];
    
    initialized = false;
    console.log("VR test environment disposed");
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

// Create a debug display that's visible in VR
function createDebugDisplay() {
    // Create debug display canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // Clear with transparent background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create material using the canvas texture
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    // Create plane for debug display
    const geometry = new THREE.PlaneGeometry(1, 0.5);
    debugTextMesh = new THREE.Mesh(geometry, material);
    debugTextMesh.renderOrder = 1001; // Render after cockpit
    
    // Store canvas and context for updates
    debugTextMesh.userData = {
        canvas,
        context,
        updateInterval: 200,
        lastUpdate: 0
    };
    
    // Don't add to scene yet - will add to camera rig after it's created
    if (cameraRig) {
        // Position the debug display in front of the user
        debugTextMesh.position.set(0, 1.0, -0.8);
        cameraRig.add(debugTextMesh);
    }
}

// Update the debug display with current information
function updateDebugDisplay(timestamp) {
    if (!debugTextMesh || !renderer || !renderer.xr?.getSession()) return; // Added check for active XR session
    
    // Only update a few times per second to avoid performance impact
    if (timestamp - debugTextMesh.userData.lastUpdate < debugTextMesh.userData.updateInterval) {
        return;
    }
    
    const canvas = debugTextMesh.userData.canvas;
    const context = debugTextMesh.userData.context;

    // Get live head Y position safely
    const liveHeadY = renderer.xr.getCamera()?.position.y;
    setDebugInfo('Live Head Y', typeof liveHeadY === 'number' ? liveHeadY.toFixed(3) : 'N/A');
    
    // Clear canvas
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set text properties
    const fontSize = 28; // Slightly smaller font
    context.font = `${fontSize}px Arial`;
    context.fillStyle = '#ffff00';
    context.textAlign = 'left';
    
    // Draw border
    context.strokeStyle = '#ffff00';
    context.lineWidth = 2;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Draw all debug info
    let yPos = 40; // Starting Y position
    const lineHeight = fontSize + 8; // Line height based on font size

    for (const [key, value] of Object.entries(debugInfo)) {
        context.fillText(`${key}: ${value}`, 20, yPos);
        yPos += lineHeight;
        // Stop if we run out of space on the canvas
        if (yPos > canvas.height - 20) break; 
    }
    
    // Update texture
    debugTextMesh.material.map.needsUpdate = true;
    debugTextMesh.userData.lastUpdate = timestamp;
}

// Set debug information to display in VR
export function setDebugInfo(key, value) {
    debugInfo[key] = value;
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
