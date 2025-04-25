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
import { initVRControllers, updateVRMovement, getControllerDebugInfo, setupCameraRig, showControlsPopup, initControlsPopup } from './controlsVR.js';
import {
    spaceGradientSphere,
    nebula,
    nebulaeClouds,
    particleSystem,
    spaceDustParticles,
    directionalLightCone,
    galaxyBackdrop,
    createStars,
    updateStars,
    SPACE_RADIUS
} from './spaceEnvVR.js';


/////////////// SCENE INITIALIZATION ///////////////

// Core scene elements
let scene, camera, renderer;
let cameraRig; // Reference to the camera rig
let cockpit; // X-Wing cockpit model

// Debug elements
let debugTextMesh;
let debugInfo = {};

// UI elements
let coordinatesDisplay; // Coordinates display mesh

// Height tracking for cockpit
let headHeight = 0;
let headHeightCalibration = false;

let starSystem;
let initialized = false;
let lastFrameTime = 0;
const COCKPIT_SCALE = 1; // Scale factor for the cockpit model

// Create scene
scene = new THREE.Scene();


// Calibration / preprep
export function calibrateVR() {

    console.log("Initializing space VR environment");
    
    if (initialized) {
        console.log("VR environment already initialized, skipping");
        return { scene, camera, renderer };
    }

    
    // Create perspective camera with improved near/far planes
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150000);
    camera.position.set(0, 0, 0);

    // Create camera rig for separating head tracking from movement
    cameraRig = setupCameraRig(scene, camera);
    
    // Position the camera rig at starting position looking at center of solar system
    if (cameraRig) {
        
        cameraRig.position.set(50000, 50000, 50000);
        const centerPoint = new THREE.Vector3(0, 0, 10000);
        const direction = new THREE.Vector3().subVectors(centerPoint, cameraRig.position).normalize();
        const lookAtPoint = new THREE.Vector3().copy(cameraRig.position).add(direction.multiplyScalar(1000));
        cameraRig.lookAt(lookAtPoint);
        // Rotate the rig 180 degrees to face toward the center instead of away
        cameraRig.rotateY(Math.PI);
        
    }
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true // Add logarithmic depth buffer to help with draw distance issues
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    // renderer.setClearColor(0x000000);                   // Pure black space
    renderer.setClearColor(0x01030a);                   
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Make renderer globally available for other modules
    window.renderer = renderer;
    
    // Enable XR
    renderer.xr.enabled = true;
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
            setDebugInfo('SESSON STARTED at ${Date.now()}');
        }
    });

}

export function init() {

    // Get space container and append renderer
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    // Create stars with dynamic brightness
    starSystem = createStars();
    scene.add(starSystem.stars);
    console.log("Added dynamic star system to VR environment");

    // Add all celestial bodies to scene
    initSolarSystem();

    // Lighting

    // Create a point light at the origin to simulate sun-like lighting
    // Because the space radius is so large, we need a huge light source. Found through trial and error
    const sunLight = new THREE.PointLight(0xffffff, SPACE_RADIUS * 40000, SPACE_RADIUS * 2);
    sunLight.position.set(0, 0, 0); // At the origin
    scene.add(sunLight);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    ///// Gameplay Setup /////

    // Initialize VR controllers for movement
    initVRControllers(renderer);

    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    // Mark as initialized
    initialized = true;
    console.log("VR test environment initialized");
    
    return { scene, camera, renderer };
}

// Load X-Wing cockpit model
function loadCockpitModel(headHeight) {
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
                    cockpit.position.set(0, headHeight, -0.2);
                    
                    // Add listener for XR session start
                    if (renderer && renderer.xr) {
                        renderer.xr.addEventListener('sessionstart', () => {
                            console.log("XR session started - Cockpit height calibration will occur in the first valid update() frame.");
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


/////////////// ANIMATION LOOP ///////////////

// Start VR animation loop - called from main.js
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
// Called from startVRMode()
function update(timestamp) {
    // Calculate delta time for smooth movement
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    
    // Periodically check for when headHeight is calibrated in update loop
    // Once criteria met, Load Cockpit Model and break out of loop
    headHeight = renderer.xr.getCamera()?.position.y;

    if (!cockpit) {

        // Create a loading popup if it doesn't exist yet
        if (!window.cockpitLoadingPopup) {
            // Create a loading message popup
            const canvas = document.createElement('canvas');
            canvas.width = 600; // Reduced width
            canvas.height = 150; // Increased height for two lines
            const context = canvas.getContext('2d');
            
            // Clear canvas with translucent white background with rounded corners
            context.fillStyle = 'rgba(255, 255, 255, 0.3)';
            
            // Create rounded rectangle
            const radius = 10;
            const width = canvas.width - 10;
            const height = canvas.height - 10;
            const x = 5;
            const y = 5;
            
            context.beginPath();
            context.moveTo(x + radius, y);
            context.lineTo(x + width - radius, y);
            context.quadraticCurveTo(x + width, y, x + width, y + radius);
            context.lineTo(x + width, y + height - radius);
            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            context.lineTo(x + radius, y + height);
            context.quadraticCurveTo(x, y + height, x, y + height - radius);
            context.lineTo(x, y + radius);
            context.quadraticCurveTo(x, y, x + radius, y);
            context.closePath();
            context.fill();
            
            // No border - removed
            
            // Style for text
            const font = "'Orbitron', Arial, sans-serif";
            
            // Just the instructions text in white
            context.font = `24px ${font}`; // Smaller font
            context.fillStyle = '#ffffff'; // White text
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // First line - Go to this page in browser
            context.fillText('Go to this page in browser on VR headset', canvas.width / 2, canvas.height / 2 - 15);
            
            // Second line - Press X for controls
            context.fillText('Press X (Meta Quest) for controls', canvas.width / 2, canvas.height / 2 + 15);
            
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            // Create material using the canvas texture
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // Create plane for popup with smaller size
            const geometry = new THREE.PlaneGeometry(0.4, 0.1); // Adjusted height for aspect ratio
            const loadingPopup = new THREE.Mesh(geometry, material);
            loadingPopup.renderOrder = 1001; // Render in front
            
            // Position it in front of the user, slightly lower
            if (cameraRig) {
                cameraRig.add(loadingPopup);
                loadingPopup.position.set(0, -0.1, -0.5);
                loadingPopup.rotation.set(0, 0, 0);
            }
            
            // Store reference
            window.cockpitLoadingPopup = loadingPopup;
        }

        if (!headHeightCalibration && headHeight != 0) {
            setDebugInfo('headHeight in update loop', headHeight.toFixed(3));
            loadCockpitModel(headHeight);
            setDebugInfo('headHeight post-cockpit', headHeight.toFixed(3));
            console.log("Cockpit loaded");
            
            // Initialize coordinates display
            if (!coordinatesDisplay) {
                coordinatesDisplay = createCoordinatesDisplay();
                if (cameraRig) {
                    cameraRig.add(coordinatesDisplay);
                    // Position at the bottom of the view, slightly to the right
                    coordinatesDisplay.position.set(0.3, headHeight-0.2, -0.35);
                    coordinatesDisplay.rotation.set(0, -0.8, -0.1);
                }
            }
            
            // Initialize controls popup at proper head height after cockpit loads
            // but don't show it automatically - it will be toggled with X button
            if (typeof initControlsPopup === 'undefined') {
                // Import the function dynamically if it's not available
                import('./controlsVR.js').then(module => {
                    if (module.initControlsPopup) {
                        module.initControlsPopup(headHeight);
                    }
                });
            } else {
                // If the function is already available, call it directly
                initControlsPopup(headHeight);
            }
            
            headHeightCalibration = true;
            
            // Remove cockpit loading popup if it exists
            if (window.cockpitLoadingPopup) {
                if (window.cockpitLoadingPopup.parent) {
                    window.cockpitLoadingPopup.parent.remove(window.cockpitLoadingPopup);
                }
                
                // Clean up resources
                if (window.cockpitLoadingPopup.material) {
                    if (window.cockpitLoadingPopup.material.map) {
                        window.cockpitLoadingPopup.material.map.dispose();
                    }
                    window.cockpitLoadingPopup.material.dispose();
                }
                if (window.cockpitLoadingPopup.geometry) {
                    window.cockpitLoadingPopup.geometry.dispose();
                }
                
                window.cockpitLoadingPopup = null;
            }
        }
    }

    // Update the coordinates display
    if (coordinatesDisplay) {
        updateCoordinatesDisplay();
    }

    // Update celestial body animations
    updateCelestialAnimations(deltaTime);

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
    
    // Apply VR movement and rotation based on controller inputs
    if (camera) {
        updateVRMovement(camera, deltaTime);
    }
    
    // Update stars brightness based on camera position
    if (starSystem && starSystem.stars) {
        // Use cameraRig position for star updates to ensure proper movement tracking
        const positionForStars = cameraRig ? cameraRig.position : camera.position;
        
        // Debug stars position at intervals
        if (timestamp % 3000 < 20) {  // Log every 3 seconds to reduce spam
            console.log("Adjusting star visibility based on camera at:", 
                positionForStars.x.toFixed(0), 
                positionForStars.y.toFixed(0), 
                positionForStars.z.toFixed(0), 
                "- Stars within 30,000 units are visible"
            );
        }
        
        updateStars(starSystem, positionForStars);
    }
    
    // Update ring opacity based on camera distance to prevent being too bright from a distance
    if (saturnGroup && cameraRig) {
        // Find Saturn rings in saturnGroup
        saturnGroup.traverse(child => {
            if (child instanceof THREE.Points && child.material) {
                // Calculate distance from camera to Saturn
                const distanceToSaturn = saturnGroup.position.distanceTo(cameraRig.position);
                
                // Define distance thresholds (adjust as needed)
                const maxVisibleDistance = 100000 * universalScaleFactor;
                const normalOpacity = 0.2; // Base opacity when close
                
                // Reduce opacity as distance increases
                if (distanceToSaturn > maxVisibleDistance * 0.2) {
                    // Linear fade from normal opacity to very transparent based on distance
                    const fadeRatio = Math.max(0, 1 - (distanceToSaturn - maxVisibleDistance * 0.2) / (maxVisibleDistance * 0.8));
                    child.material.opacity = normalOpacity * fadeRatio;
                } else {
                    // Reset to normal opacity when close
                    child.material.opacity = normalOpacity;
                }
            }
        });
    }
    
    // Same for Uranus rings
    if (uranusGroup && cameraRig) {
        uranusGroup.traverse(child => {
            if (child instanceof THREE.Points && child.material) {
                const distanceToUranus = uranusGroup.position.distanceTo(cameraRig.position);
                const maxVisibleDistance = 100000 * universalScaleFactor;
                const normalOpacity = 0.15; // Base opacity when close
                
                if (distanceToUranus > maxVisibleDistance * 0.2) {
                    const fadeRatio = Math.max(0, 1 - (distanceToUranus - maxVisibleDistance * 0.2) / (maxVisibleDistance * 0.8));
                    child.material.opacity = normalOpacity * fadeRatio;
                } else {
                    child.material.opacity = normalOpacity;
                }
            }
        });
    }
    
    // Update galaxy backdrop to slowly rotate
    if (galaxyBackdrop) {
        galaxyBackdrop.rotation.z += 0.0001;
    }
    
    // Update gradient sphere to follow camera
    if (spaceGradientSphere && cameraRig) {
        spaceGradientSphere.position.copy(cameraRig.position);
    }
}



/////////////// UI ELEMENTS ///////////////


// Clean up
export function dispose() {
    // We no longer need to cancel animation frames since we're not using requestAnimationFrame
    // for celestial animations anymore
    
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
    
    // Clean up coordinates display
    if (coordinatesDisplay) {
        if (coordinatesDisplay.geometry) coordinatesDisplay.geometry.dispose();
        if (coordinatesDisplay.material) {
            if (coordinatesDisplay.material.map) coordinatesDisplay.material.map.dispose();
            coordinatesDisplay.material.dispose();
        }
        if (coordinatesDisplay.parent) coordinatesDisplay.parent.remove(coordinatesDisplay);
        coordinatesDisplay = null;
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
    
    // Clean up cockpit loading popup if it exists
    if (window.cockpitLoadingPopup) {
        if (window.cockpitLoadingPopup.parent) {
            window.cockpitLoadingPopup.parent.remove(window.cockpitLoadingPopup);
        }
        if (window.cockpitLoadingPopup.material) {
            if (window.cockpitLoadingPopup.material.map) {
                window.cockpitLoadingPopup.material.map.dispose();
            }
            window.cockpitLoadingPopup.material.dispose();
        }
        if (window.cockpitLoadingPopup.geometry) {
            window.cockpitLoadingPopup.geometry.dispose();
        }
        window.cockpitLoadingPopup = null;
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

/**
 * Create a coordinates display that shows the player's position in VR
 */
function createCoordinatesDisplay() {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create material using the canvas texture
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9, // Make it slightly translucent to match controls popup
        side: THREE.DoubleSide
    });
    
    // Create plane for coordinates display - smaller than controls popup
    const geometry = new THREE.PlaneGeometry(0.4, 0.1);
    coordinatesDisplay = new THREE.Mesh(geometry, material);
    coordinatesDisplay.renderOrder = 1001; // Render after cockpit but before controls popup
    
    // Store canvas and context for updates
    coordinatesDisplay.userData = {
        canvas,
        context,
        texture
    };
    
    return coordinatesDisplay;
}

/**
 * Update the coordinates display with current camera rig position
 */
function updateCoordinatesDisplay() {
    if (!coordinatesDisplay || !cameraRig) return;
    
    const canvas = coordinatesDisplay.userData.canvas;
    const context = coordinatesDisplay.userData.context;
    
    // Get current position and round to integers for cleaner display
    const position = cameraRig.position;
    const x = Math.round(position.x);
    const y = Math.round(position.y);
    const z = Math.round(position.z);
    
    // Clear canvas with a semi-transparent dark background (matching controls-dropdown)
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border (matching controls-dropdown)
    context.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    context.lineWidth = 2;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    
    // Add outer glow effect (matching controls-dropdown)
    const glowSize = 10;
    const glowColor = 'rgba(79, 195, 247, 0.3)';
    context.shadowBlur = glowSize;
    context.shadowColor = glowColor;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.shadowBlur = 0;
    
    // Title
    const titleFont = "'Orbitron', Arial, sans-serif";
    context.font = `bold 28px ${titleFont}`;
    context.fillStyle = '#4fc3f7'; // Exact color from controls-dropdown h3
    context.textAlign = 'center';
    context.fillText('COORDINATES', canvas.width / 2, 30);
    
    // Add title underline like controls-dropdown h3
    context.beginPath();
    context.moveTo(canvas.width * 0.15, 35);
    context.lineTo(canvas.width * 0.85, 35);
    context.strokeStyle = 'rgba(79, 195, 247, 0.3)';
    context.lineWidth = 1;
    context.stroke();
    
    // Coordinates text
    context.font = `24px ${titleFont}`;
    context.fillStyle = '#b3e5fc'; // Exact color from controls-dropdown p
    context.textAlign = 'center';
    context.fillText(`X: ${x}   Y: ${y}   Z: ${z}`, canvas.width / 2, 80);
    
    // Update texture
    coordinatesDisplay.userData.texture.needsUpdate = true;
}



///////////////////// Solar System Setup /////////////////////

import { sunGroup, blazingMaterial, blazingEffect } from '../spaceEnvs/solarSystemEnv.js';
import { mercuryGroup, mercuryCollisionSphere } from '../spaceEnvs/solarSystemEnv.js';
import { venusGroup, venusCollisionSphere, venusCloudMesh } from '../spaceEnvs/solarSystemEnv.js';
import { earthGroup, earthCollisionSphere, earthCloudMesh } from '../spaceEnvs/solarSystemEnv.js';
import { moonGroup } from '../spaceEnvs/solarSystemEnv.js';
import { marsGroup, marsCollisionSphere, marsCloudMesh } from '../spaceEnvs/solarSystemEnv.js';
import { jupiterGroup, jupiterCollisionSphere } from '../spaceEnvs/solarSystemEnv.js';
import { saturnGroup, saturnCollisionSphere } from '../spaceEnvs/solarSystemEnv.js';
import { uranusGroup, uranusCollisionSphere } from '../spaceEnvs/solarSystemEnv.js';
import { neptuneGroup, neptuneCollisionSphere } from '../spaceEnvs/solarSystemEnv.js';
// import { starDestroyerGroup, collisionBox1, collisionBox2 } from '../spaceEnvs/solarSystemEnv.js';
// import { lucrehulkGroup, lucrehulkCollisionBox } from '../spaceEnvs/solarSystemEnv.js';
// import { deathStarGroup, deathStarCollisionSphere } from './solarSystemEnv.js';

// Celestial body animation variables
let sunTime = 0;

function initSolarSystem() {
    scene.add(sunGroup);
    scene.add(mercuryGroup);
    scene.add(venusGroup);
    scene.add(earthGroup);
    scene.add(moonGroup);
    scene.add(marsGroup);
    scene.add(jupiterGroup);
    scene.add(saturnGroup);
    scene.add(uranusGroup);
    scene.add(neptuneGroup);
    scene.add(asteroidBeltGroup);

    console.log("Solar system initialized in VR environment");
}

// Update celestial body animations from main update loop
function updateCelestialAnimations(deltaTime) {
    // Update sun animation
    if (blazingMaterial && blazingMaterial.uniforms) {
        sunTime += deltaTime * 2; 
        blazingMaterial.uniforms.time.value = sunTime;
        
        if (blazingEffect) {
            blazingEffect.scale.setScalar(0.9 + Math.sin(sunTime * 1.0) * 0.05);
        }
    }
    
    if (venusCloudMesh) {
        venusCloudMesh.rotation.y += 0.002;
    }
    
    if (earthCloudMesh) {
        earthCloudMesh.rotation.y += 0.002;
    }
    
    if (marsCloudMesh) {
        marsCloudMesh.rotation.y += 0.002;
    }
    
}

// Different asteroid setup for VR (simpler, lower res)

// Asteroid belt properties
const ASTEROID_BELT_RADIUS = 55000;
const ASTEROID_BASE_SCALE = 200;
const ASTEROID_COUNT = 100;
const ASTEROID_HEIGHT_VARIATION = 5000;

export const asteroidBeltGroup = new THREE.Group();
asteroidBeltGroup.name = "asteroidBelt";

// Collision box removed for now

// Asteroid properties
const asteroidCount = ASTEROID_COUNT;
const radius = ASTEROID_BELT_RADIUS * universalScaleFactor;           // Radius of the belt
const asteroidScale = ASTEROID_BASE_SCALE * universalScaleFactor;
asteroidBeltGroup.position.set(0, 0, 0);

// Load asteroid models
console.log('Loading asteroids from registry');

// Use the model registry for asteroid loading
loadModelFromRegistry(
    'environment',
    'asteroidPackVR',
    (gltf) => {
        console.log('Asteroid pack loaded successfully from registry');
        const asteroidModel = gltf.scene;

        // Apply random orientation to give impression of dense belt
        const tiltX = (Math.random() * Math.PI * 2) - Math.PI;
        const tiltZ = (Math.random() * Math.PI * 2) - Math.PI;

        for (let i = 0; i < asteroidCount; i++) {

            // Positon in a ring with slight random variation around a defined radius
            const angle = (i / asteroidCount) * Math.PI * 2;
            const randomRadius = radius * (0.9 + Math.random() * 0.2);

            const xFlat = Math.cos(angle) * randomRadius;
            const zFlat = Math.sin(angle) * randomRadius;
            const yFlat = (Math.random() - 0.5) * ASTEROID_HEIGHT_VARIATION * universalScaleFactor;

            // Apply tilt around X
            const yTiltX = yFlat * Math.cos(tiltX) - zFlat * Math.sin(tiltX);
            const zTiltX = yFlat * Math.sin(tiltX) + zFlat * Math.cos(tiltX);

            // Then tilt around Z
            const xTilt = xFlat * Math.cos(tiltZ) - yTiltX * Math.sin(tiltZ);
            const yTilt = xFlat * Math.sin(tiltZ) + yTiltX * Math.cos(tiltZ);
            const zTilt = zTiltX;

            const asteroid = asteroidModel.clone();
            const scale = asteroidScale * (0.5 + Math.random());

            asteroid.scale.set(scale, scale, scale);
            asteroid.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            asteroid.position.set(xTilt, yTilt, zTilt);
            asteroidBeltGroup.add(asteroid);
        }
    },
    // (xhr) => {
    //     console.log(`Loading asteroids: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
    // },
    // (error) => {
    //     console.error('Error loading asteroid model from registry:', error);
    // }
);