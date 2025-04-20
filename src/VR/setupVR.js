// setupVR.js - Creates endless VR space sandbox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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


// Core scene elements
let scene, camera, renderer;
let cameraRig; // Reference to the camera rig
let cockpit; // X-Wing cockpit model

// Debug elements
let debugTextMesh;
let debugInfo = {};

// Height tracking for cockpit
let desiredCockpitHeight = null;
let heightCalibrationComplete = false;

let starSystem;
let initialized = false;
let lastFrameTime = 0;
const COCKPIT_SCALE = 1; // Scale factor for the cockpit model

// Initialize the VR scene
export function init() {
    console.log("Initializing space VR environment");
    
    if (initialized) {
        console.log("VR environment already initialized, skipping");
        return { scene, camera, renderer };
    }
    
    // Create scene
    scene = new THREE.Scene();
    // scene.fog = new THREE.FogExp2(0x000011, 0.00001); // Very subtle exponential fog
    
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
    renderer.setClearColor(0x05182b);                   // Main space background color
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Enable XR
    renderer.xr.enabled = true;
    
    // Configure WebXR for high quality rendering across the entire field of view
    renderer.xr.setFoveation(0); // Disable foveated rendering (0 = no foveation, 1 = maximum foveation)
    
    // Set up session initialization event listener to configure XR session when it starts
    renderer.xr.addEventListener('sessionstart', function() {
        const session = renderer.xr.getSession();
        
        if (session) {
            // Configure render layers for highest quality
            session.updateRenderState({
                baseLayer: new XRWebGLLayer(session, renderer.getContext(), {
                    framebufferScaleFactor: 1.0, // Set to 1.0 for highest quality
                    alpha: false,
                    depth: true,
                    stencil: false,
                    antialias: true,
                    multiview: true // Use multiview when available for better performance
                })
            });
            
            console.log("WebXR session configured for high quality rendering");
        }
    });
    
    // Initialize VR controllers for movement
    initVRControllers(renderer);
    
    // Get space container and append renderer
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }
    
    // Add advanced space environment elements
    // scene.add(spaceGradientSphere);
    scene.add(nebula);
    scene.add(particleSystem);
    scene.add(directionalLightCone);
    scene.add(galaxyBackdrop);
    
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
    
    // Create debug text display for VR
    createDebugDisplay();
    
    // Load X-Wing cockpit model
    loadCockpitModel();
    
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
    if (!debugTextMesh) return;
    
    // Only update a few times per second to avoid performance impact
    if (timestamp - debugTextMesh.userData.lastUpdate < debugTextMesh.userData.updateInterval) {
        return;
    }
    
    const canvas = debugTextMesh.userData.canvas;
    const context = debugTextMesh.userData.context;
    
    // Clear canvas
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set text properties
    context.font = '20px Arial';
    context.fillStyle = '#33ff33';
    context.textAlign = 'left';
    
    // Add heading
    context.fillText('VR DEBUG INFORMATION', 20, 30);
    
    // Draw border
    context.strokeStyle = '#33ff33';
    context.lineWidth = 2;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Add debug information
    let y = 60;
    const lineHeight = 25;
    
    // Camera rig position
    if (cameraRig) {
        context.fillText(`Position: X:${cameraRig.position.x.toFixed(2)} Y:${cameraRig.position.y.toFixed(2)} Z:${cameraRig.position.z.toFixed(2)}`, 20, y);
        y += lineHeight;
    }
    
    // Controller status
    const controllerInfo = getControllerDebugInfo();
    context.fillText(`Left Controller: ${controllerInfo.leftController.connected ? 'Connected' : 'Disconnected'}`, 20, y);
    y += lineHeight;
    
    context.fillText(`Right Controller: ${controllerInfo.rightController.connected ? 'Connected' : 'Disconnected'}`, 20, y);
    y += lineHeight;
    
    // Show boost status
    context.fillText(`Boost: ${controllerInfo.leftController.boostActive ? 'ACTIVE' : 'Off'}`, 20, y);
    y += lineHeight;
    
    // XR Camera raw head height (if available)
    if (renderer && renderer.xr && renderer.xr.isPresenting) {
        const xrCamera = renderer.xr.getCamera();
        if (xrCamera) {
            context.fillStyle = '#ffff00'; // Highlight this in yellow for emphasis
            context.fillText(`RAW XR HEAD HEIGHT: ${xrCamera.position.y.toFixed(4)}`, 20, y);
            context.fillStyle = '#33ff33'; // Back to normal color
            y += lineHeight;
        }
    }
    
    // Cockpit information
    if (cockpit) {
        context.fillText(`Cockpit Y offset: ${cockpit.position.y.toFixed(4)}`, 20, y);
        y += lineHeight;
    }
    
    // Add any custom debug information that was set
    for (const [key, value] of Object.entries(debugInfo)) {
        context.fillText(`${key}: ${value}`, 20, y);
        y += lineHeight;
    }
    
    // Update texture
    debugTextMesh.material.map.needsUpdate = true;
    debugTextMesh.userData.lastUpdate = timestamp;
}

// Set debug information to display in VR
export function setDebugInfo(key, value) {
    debugInfo[key] = value;
}

// Load X-Wing cockpit model
function loadCockpitModel() {
    // Create an empty group to hold the cockpit model
    cockpit = new THREE.Group();
    let cockpitLoaded = false;
    
    // Use loadModelFromRegistry to load the cockpit model
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
                
                // If cameraRig exists, add the cockpit to it
                if (cameraRig) {
                    // Add cockpit to the rig so it moves with the player
                    cameraRig.add(cockpit);
                    
                    // Set initial position - will be adjusted when XR session starts
                    // We'll use a default height but this will be adjusted based on the user's actual height
                    cockpit.position.set(0, 0, -0.1);
                    
                    // Create a variable to track if we've done the initial height calibration
                    let hasInitialHeightCalibration = false;
                    
                    // Add listener for XR session start to adjust cockpit based on user's height
                    if (renderer && renderer.xr) {
                        renderer.xr.addEventListener('sessionstart', () => {
                            console.log("XR session started - will calibrate cockpit height based on user's head position");
                            
                            // Function to measure and adjust cockpit height
                            function adjustCockpitHeight() {
                                const session = renderer.xr.getSession();
                                if (!session) return;
                                
                                // Get current head position from XR camera
                                const xrCamera = renderer.xr.getCamera();
                                
                                // We need at least one frame to get accurate position
                                if (!hasInitialHeightCalibration && xrCamera) {
                                    // Wait a short moment for the XR system to stabilize initial pose
                                    setTimeout(() => {
                                        // Get the head height (y-coordinate of the camera)
                                        const headHeight = xrCamera.position.y;
                                        
                                        // Use the user's actual head height for cockpit positioning
                                        console.log(`Detected user head height: ${headHeight.toFixed(4)}m, adjusting cockpit position`);
                                        
                                        // Set the global desired height so it will be continually enforced
                                        desiredCockpitHeight = headHeight;
                                        
                                        // FORCE the cockpit position to match the head height exactly
                                        cockpit.position.y = desiredCockpitHeight;
                                        
                                        console.log(`SETTING COCKPIT Y POSITION to ${desiredCockpitHeight.toFixed(4)}m`);
                                        
                                        // Double-check that the position was set
                                        console.log(`VERIFY: Cockpit Y position is now: ${cockpit.position.y.toFixed(4)}m`);
                                        
                                        // Update debug info with the detected height in multiple formats for clarity
                                        setDebugInfo("DETECTED RAW HEAD HEIGHT", `${headHeight.toFixed(4)}m`);
                                        setDebugInfo("TARGET COCKPIT HEIGHT", `${desiredCockpitHeight.toFixed(4)}m`);
                                        setDebugInfo("CURRENT COCKPIT HEIGHT", `${cockpit.position.y.toFixed(4)}m`);
                                        
                                        hasInitialHeightCalibration = true;
                                        heightCalibrationComplete = true;
                                        
                                        // Store the calibrated height for later use
                                        setDebugInfo("CALIBRATED HEIGHT", `${desiredCockpitHeight.toFixed(4)}m`);
                                        
                                        // Force position update immediately and add a check
                                        setTimeout(() => {
                                            setDebugInfo("AFTER DELAY Y POS", `${cockpit.position.y.toFixed(4)}m`);
                                            // Force it again for good measure
                                            cockpit.position.y = desiredCockpitHeight;
                                        }, 200);
                                    }, 500); // Small delay to ensure XR pose is stable
                                }
                            }
                            
                            // Initial adjustment
                            adjustCockpitHeight();
                            
                            // Set up a frame-based callback for initial measurements
                            // This ensures we get accurate values after the XR system is fully initialized
                            let calibrationAttempts = 0;
                            const maxCalibrationAttempts = 120; // Try for about 2 seconds at 60fps
                            
                            function calibrationCheck() {
                                if (!hasInitialHeightCalibration && calibrationAttempts < maxCalibrationAttempts) {
                                    adjustCockpitHeight();
                                    calibrationAttempts++;
                                    requestAnimationFrame(calibrationCheck);
                                }
                            }
                            
                            // Start the calibration check
                            calibrationCheck();
                        });
                    }
                    
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
                
                cockpitLoaded = true;
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
    
    // If we have a calibrated cockpit height, make sure it's enforced every frame
    if (heightCalibrationComplete && cockpit && desiredCockpitHeight !== null) {
        // Check if the cockpit height has drifted from our desired value
        if (Math.abs(cockpit.position.y - desiredCockpitHeight) > 0.001) {
            // Reset to desired position
            cockpit.position.y = desiredCockpitHeight;
            console.log(`Re-enforced cockpit Y position to ${desiredCockpitHeight.toFixed(4)}m`);
            
            // Add to debug info
            setDebugInfo("ENFORCED HEIGHT", `${timestamp.toFixed(0)}ms`);
        }
    }
    
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
    
    // Update debug info with controller state occasionally
    if (timestamp % 1000 < 16) { // Approximately once per second
        const debugInfo = getControllerDebugInfo();
        
        // Only update if controllers are connected
        if (debugInfo.leftController.connected || debugInfo.rightController.connected) {
            // Update debug display with controller axes
            if (debugInfo.leftController.connected) {
                setDebugInfo("Left Stick", `X:${debugInfo.leftController.axes[2]?.toFixed(2) || 0} Y:${debugInfo.leftController.axes[3]?.toFixed(2) || 0}`);
            }
            
            if (debugInfo.rightController.connected) {
                setDebugInfo("Right Stick", `X:${debugInfo.rightController.axes[2]?.toFixed(2) || 0} Y:${debugInfo.rightController.axes[3]?.toFixed(2) || 0}`);
            }
        }
        
        // Add current cockpit height
        if (cockpit) {
            setDebugInfo("CURRENT COCKPIT HEIGHT", `${cockpit.position.y.toFixed(4)}m`);
            
            if (desiredCockpitHeight !== null) {
                setDebugInfo("HEIGHT DIFF", `${(cockpit.position.y - desiredCockpitHeight).toFixed(4)}m`);
            }
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