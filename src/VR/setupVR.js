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

// Global head height - set ONCE after calibration
let headHeight = 0; 

let starSystem;
let initialized = false;
let lastFrameTime = 0;
const COCKPIT_SCALE = 1; // Scale factor for the cockpit model

// --- 1. Initial Renderer Setup ---
export function init() {
    console.log("Initializing VR Renderer and Entry Point");
    
    if (renderer) {
        console.log("Renderer already initialized, skipping");
        return { renderer }; // Only return renderer if already done
    }
    
    // Create renderer with adjusted settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x05182b);                   
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Enable XR
    renderer.xr.enabled = true;
    renderer.xr.setFoveation(0); 

    // Add renderer to DOM
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);

    console.log("Renderer initialized.");

    // Trigger the rest of the process (calibration -> main init)
    startCalibrationSequence();
    
    // Return only the renderer initially
    return { renderer }; 
}

// --- 2. Start Calibration Sequence on VR Entry ---
function startCalibrationSequence() {
    console.log("Setting up VR session start listener for calibration.");

    // Setup session configuration listener
    renderer.xr.addEventListener('sessionstart', function handleSessionStart() {
        console.log("XR session starting - beginning head height polling.");
        const session = renderer.xr.getSession();
        if (session) {
            session.updateRenderState({
                baseLayer: new XRWebGLLayer(session, renderer.getContext(), {
                    framebufferScaleFactor: 1.0,
                    alpha: false,
                    depth: true,
                    stencil: false,
                    antialias: true,
                    multiview: true
                })
            });
            console.log("WebXR session configured for high quality rendering.");
            
            // Start polling for valid head height
            requestAnimationFrame(pollForHeadHeight);

            // Remove this listener after it runs once to avoid multiple polls
            renderer.xr.removeEventListener('sessionstart', handleSessionStart);
        } else {
            console.error("Session started but getSession() returned null!");
        }
    });

    // Auto-start VR (or use VRButton logic)
    // This will trigger the 'sessionstart' listener above
    console.log("Attempting to automatically enter VR...");
    setTimeout(() => {
        const vrButton = VRButton.createButton(renderer);
        document.body.appendChild(vrButton);
        vrButton.addEventListener('click', () => { 
            setTimeout(() => { vrButton.remove(); }, 100); 
        });
        vrButton.click();
    }, 1000);
}

// --- 3. Poll for Head Height ---
let calibrationPollCount = 0;
const MAX_CALIBRATION_POLLS = 300; // Limit polling (e.g., 5 seconds at 60fps)

function pollForHeadHeight() {
    if (initialized) return; // Stop if main initialization already completed

    calibrationPollCount++;
    if (calibrationPollCount > MAX_CALIBRATION_POLLS) {
        console.error("Head height calibration timed out.");
        setDebugInfo('Calibration Status', 'Error: Timeout');
        return;
    }

    if (renderer && renderer.xr?.isPresenting) {
        const xrCamera = renderer.xr.getCamera();
        const currentHeight = xrCamera.position.y;

        if (currentHeight > 0.1) {
            console.log(`Head height calibrated: ${currentHeight.toFixed(3)}m after ${calibrationPollCount} polls.`);
            setDebugInfo('Calibration Status', `Success: ${currentHeight.toFixed(3)}m`);
            completeInitialization(currentHeight); // Pass calibrated height
            return; // Stop polling
        } else {
             setDebugInfo('Calibration Status', `Polling (${calibrationPollCount}) - H: ${currentHeight.toFixed(3)}`);
             requestAnimationFrame(pollForHeadHeight);
        }
    } else {
        // Still waiting for session to be presenting
        setDebugInfo('Calibration Status', `Polling (${calibrationPollCount}) - Waiting for session...`);
        requestAnimationFrame(pollForHeadHeight);
    }
}

// --- 4. Complete Initialization After Calibration ---
function completeInitialization(calibratedHeadHeight) {
    console.log("Completing initialization with calibrated head height.");
    
    if (initialized) {
        console.warn("Initialization sequence called again, skipping.");
        return;
    }

    // Set the global headHeight ONCE
    headHeight = calibratedHeadHeight;
    console.log(`Global headHeight set to: ${headHeight.toFixed(3)}`);
    setDebugInfo('Global HeadHeight', headHeight.toFixed(3));

    ///// Scene Setup /////
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150000);
    camera.position.set(0, 0, 0); // Camera starts at rig origin
    
    // Create stars 
    starSystem = createStars();
    scene.add(starSystem.stars);

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 100, -1);
    scene.add(directionalLight);
    const ambientLight = new THREE.AmbientLight(0x111133, 1);
    scene.add(ambientLight);

    ///// Gameplay Setup /////
    initVRControllers(renderer); // Init controllers
    cameraRig = setupCameraRig(scene, camera); // Create camera rig
    loadCockpitModel(calibratedHeadHeight); // Load cockpit using calibrated height
    createDebugDisplay(); // Create debug display (will attach to cameraRig)

    // Mark initialization as complete
    initialized = true;
    console.log("Main VR environment initialization complete.");

    // Start the main animation loop
    startVRAnimationLoop(); 
}

// --- 5. Load Cockpit Model (Modified) ---
function loadCockpitModel(initialHeadHeight) { // Accepts calibrated height
    console.log(`Loading cockpit model, initial head height: ${initialHeadHeight.toFixed(3)}`);
    cockpit = new THREE.Group();
    
    loadModelFromRegistry(
        'spacecraft',
        'xwingCockpit',
        (gltf) => {
            const model = gltf.scene;
            model.scale.set(COCKPIT_SCALE, COCKPIT_SCALE, COCKPIT_SCALE);
            cockpit.add(model);
            cockpit.name = 'cockpitModel';
            cockpit.rotation.y = Math.PI;
            
            if (cameraRig) {
                cameraRig.add(cockpit);
                
                // Position cockpit based on the INITIAL head height passed in
                const cockpitYOffset = -initialHeadHeight;
                cockpit.position.set(0, cockpitYOffset, 0); // Set position ONCE
                console.log(`Cockpit initial position set to Y: ${cockpitYOffset.toFixed(3)}`);
                setDebugInfo('Cockpit Y Offset', cockpitYOffset.toFixed(3));

                cockpit.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.metalness = 0.3;
                        child.material.roughness = 0.7;
                        child.renderOrder = 1000;
                    }
                });
                console.log("X-Wing cockpit model loaded and positioned in camera rig");
            } else {
                console.error("Camera rig not available when loading cockpit");
            }
        },
        (xhr) => { console.log(`Cockpit: ${((xhr.loaded / xhr.total) * 100).toFixed(0)}% loaded`); },
        (error) => { console.error('Error loading cockpit model:', error); }
    );
}


/////////////// ANIMATION LOOP ///////////////

// Start VR animation loop (Renamed from startVRMode)
function startVRAnimationLoop() {
    console.log("Starting VR animation loop");
    clearAllUIElements(); // Ensure UI elements are cleared
    
    renderer.setAnimationLoop(function xrAnimationLoop(timestamp, frame) {
        if (!initialized) return; // Don't run update if init not complete
        update(timestamp, frame);
        renderer.render(scene, camera);
    });
    console.log("VR animation loop set");
}

// Animation loop - update movement based on VR controller inputs
function update(timestamp, frame) {
    // Calculate delta time
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    
    // Update debug info for headHeight in update loop (reading the global var)
    setDebugInfo('Global HeadHeight (Update)', typeof headHeight === 'number' ? headHeight.toFixed(3) : 'N/A');
    setDebugInfo('Live Head Y (Update)', typeof renderer?.xr?.getCamera()?.position?.y === 'number' ? renderer.xr.getCamera().position.y.toFixed(3) : 'N/A');

    // Update VR movement
    updateVRMovement(deltaTime, cameraRig, cockpit);
    
    // Update stars
    if (starSystem) {
        updateStars(starSystem, timestamp);
    }

    // Update debug display
    updateDebugDisplay(timestamp);
}


/////////////// DISPOSAL & UTILITIES ///////////////

export function dispose() {
    console.log("Disposing VR resources");
    initialized = false;
    headHeight = 0; // Reset head height
    calibrationPollCount = 0;

    // Stop animation loop
    if (renderer) {
        renderer.setAnimationLoop(null);
    }

    // Remove listeners, dispose geometries, materials, textures
    window.removeEventListener('resize', onWindowResize);
    // ... extensive disposal logic for scene objects, controllers, etc. ...

    if (scene) {
        // Remove and dispose all children
        while(scene.children.length > 0){ 
            const object = scene.children[0];
            // Custom disposal logic for specific types if needed
            if (object.geometry) object.geometry.dispose();
            if (object.material) { 
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
            scene.remove(object); 
        }
    }

    // Dispose cockpit if loaded
    if (cockpit) {
        // ... dispose cockpit resources ...
        cockpit = null;
    }
    if (cameraRig) {
         // ... dispose camera rig resources ...
        cameraRig = null;
    }
    
    // Dispose renderer and remove from DOM
    if (renderer && renderer.domElement) {
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer.dispose();
        renderer = null;
    }

    // Clear debug info
    debugInfo = {};
    if (debugTextMesh) {
        // dispose debug text resources
        debugTextMesh = null;
    }

    console.log("VR resources disposed");
}

function clearAllUIElements() {
    // ... (implementation as before) ...
    console.log("Cleared UI elements");
}

// Create debug display (will attach to cameraRig when it's ready)
function createDebugDisplay() {
    // ... (implementation mostly as before) ...
    // Modify attachment logic:
    if (cameraRig) {
        debugTextMesh.position.set(0, 1.0, -0.8); // Adjust position if needed
        cameraRig.add(debugTextMesh);
        console.log("Debug display created and attached to camera rig.");
    } else {
        console.error("Cannot attach debug display: cameraRig not available.");
    }
}

// Update the debug display with current information
function updateDebugDisplay(timestamp) {
    // ... (implementation mostly as before, using debugInfo object) ...
    if (!debugTextMesh || !renderer || !renderer.xr?.getSession()) return;
    
    if (timestamp - debugTextMesh.userData.lastUpdate < debugTextMesh.userData.updateInterval) {
        return;
    }
    
    const canvas = debugTextMesh.userData.canvas;
    const context = debugTextMesh.userData.context;
    
    // Clear canvas
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set text properties
    const fontSize = 28;
    context.font = `${fontSize}px Arial`;
    context.fillStyle = '#ffff00';
    context.textAlign = 'left';
    
    // Draw border
    context.strokeStyle = '#ffff00';
    context.lineWidth = 2;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Draw all debug info
    let yPos = 40;
    const lineHeight = fontSize + 8;

    for (const [key, value] of Object.entries(debugInfo)) {
        context.fillText(`${key}: ${value}`, 20, yPos);
        yPos += lineHeight;
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
    if (!camera || !renderer) return; // Check if camera/renderer exist
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
