// IMPORTS
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { loadingManager, textureLoadingManager } from '../loaders.js';

import { configureCesiumRequestScheduler, optimizeTerrainLoading } from '../cesiumRateLimit.js';
import config from '../config.js';

import { updateCoreMovement, resetMovementInputs } from '../movement.js';
import { createSpacecraft } from '../spacecraft.js';
import { updateControlsDropdown } from '../ui.js';
import { 
    moonCamera,
    moonCockpitCamera,
    createCameraState,
    updateTargetOffsets,
    updateCameraOffsets,
    createForwardRotation,
} from '../camera.js';
import { 
    keys,
    initControls, 
    getBoostState, 
    getViewToggleRequested,
    updatePreviousKeyStates 
} from '../inputControls.js';
import {
    getEarthSurfaceActive,
    getMoonSurfaceActive,
    setEarthSurfaceActive,
    setMoonSurfaceActive,
    getSpaceInitialized,
    setSpaceInitialized,
    setEarthInitialized,
    setMoonInitialized,
    getEarthTransition,
    getMoonTransition,
    setEarthTransition,
    setMoonTransition
} from '../stateEnv.js';


///////////////////// GENERAL INITIALIZATION /////////////////////

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const textureLoader = new THREE.TextureLoader(textureLoadingManager);
// const loader = new GLTFLoader();
renderer.setSize(window.innerWidth, window.innerHeight);
// document.getElementById('space-container').appendChild(renderer.domElement);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);
const cameraState = createCameraState('space');
const smoothFactor = 0.1;
// Rotation configuration for camera
const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};
// Camera update function
function updateCamera(camera, isHyperspace) {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Create a fixed pivot at the center of the spacecraft
    const spacecraftCenter = new THREE.Object3D();
    spacecraft.add(spacecraftCenter);
    spacecraftCenter.updateMatrixWorld();

    // Check if we're in first-person view
    const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? spacecraft.isFirstPersonView() : false;
    
    // Update target offsets based on keys, hyperspace state and view mode
    const viewMode = isFirstPerson ? 'cockpit' : 'space';
    updateTargetOffsets(cameraState, keys, viewMode, isHyperspace);
    
    // Update current offsets by interpolating toward targets
    updateCameraOffsets(cameraState, rotation);
    
    // Get the world position of the spacecraft's center
    const pivotPosition = new THREE.Vector3();
    spacecraftCenter.getWorldPosition(pivotPosition);
    
    // Calculate camera offset based on state
    let offset = new THREE.Vector3();
    
    if (keys.up) {
        if (!isFirstPerson) {
            offset.copy(moonCamera.boost);
        } else {
            offset.copy(moonCockpitCamera.boost);
        }
    } else if (keys.down) {
        if (!isFirstPerson) {
            offset.copy(moonCamera.slow);
        } else {
            offset.copy(moonCockpitCamera.slow);
        }
    } else {
        if (!isFirstPerson) {
            offset.copy(moonCamera.base);
        } else {
            offset.copy(moonCockpitCamera.base);
        }
    }
    
    // Apply spacecraft's rotation to the offset
    const quaternion = spacecraft.quaternion.clone();
    offset.applyQuaternion(quaternion);
    
    // Calculate final camera position by adding offset to pivot
    const finalPosition = new THREE.Vector3().addVectors(pivotPosition, offset);
    
    // Update camera position with smooth interpolation
    camera.position.lerp(finalPosition, smoothFactor);
    
    // Make camera look at the spacecraft's forward direction
    camera.quaternion.copy(spacecraft.quaternion);
    
    // Apply the 180-degree rotation to look forward
    const adjustment = createForwardRotation();
    camera.quaternion.multiply(adjustment);
    
    // Apply FOV changes from camera state
    camera.fov = cameraState.currentFOV;
    camera.updateProjectionMatrix();
    
    // Remove the temporary pivot (to avoid cluttering the scene)
    spacecraft.remove(spacecraftCenter);
}

// Export key objects
export { 
    renderer, 
    scene, 
    camera, 
    rotation,
    cameraState
};


///////////////////// MOON-SPECIFIC INITIALIZATION /////////////////////

// TO TRIM DOWN THIS WHOLE SECTION //

let localOrigin; // Local origin point for coordinate system
let referenceSphere; // Reference sphere object

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Lighting elements
let playerSun, playerSunTarget; // Main directional light and its target


// SET PARAMETERS
const SPACECRAFT_INITIAL_LAT = 0.6741;
const SPACECRAFT_INITIAL_LON = 23.4733;
const SPACECRAFT_INITIAL_HEIGHT = 20000;
const SPACECRAFT_INITIAL_ROTATION = new THREE.Euler(
    THREE.MathUtils.degToRad(-100),
    THREE.MathUtils.degToRad(-20),
    THREE.MathUtils.degToRad(-120),
    'XYZ'
);

// Distant Earth image configuration
const sphereConfig = {
    distance: 300000,         // Distance in front of player
    radius: 100000,            // Size in radius
    rotation: {              // Rotation angles in degrees
        x: 0,
        y: 0,
        z: 180
    },
    polar: {                 // Polar coordinates around player
        angle: 0,            // Horizontal angle in degrees (0 = directly in front)
        pitch: 40             // Vertical angle in degrees (0 = same height as player)
    },
    visible: true            // Whether the sphere is visible
};

// Add player sun configuration options
const playerSunConfig = {
    // Position the sun using lat/lon/height in global coordinates instead of relative height
    position: {
        lat: 0.6741,
        lon: 23.4733,
        height: 50000  // Very high altitude for sun
    },
    intensity: 10,     
    color: 0xffffff,
    fixedPosition: true,  // Whether the sun stays in a fixed position or follows the player
    targetOffset: {
        x: 0,
        y: 0,
        z: 0
    }
};


// Load environment variables
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  const dotenv = await import('dotenv');
  dotenv.config();
}

// Pull CESIUM API key from environment variables or localStorage
let apiKey = localStorage.getItem('ionApiKey') || import.meta.env.VITE_CESIUM_ACCESS_TOKEN || 'YOUR_CESIUM_TOKEN_HERE';

// Fallback for local development if no .env variable is found
if (!apiKey && typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
      // Only attempt to import fs in a Node.js environment
      const fs = await import('fs/promises').catch(() => {
          console.warn('fs/promises module not available');
          return { readFile: () => Promise.reject(new Error('fs not available')) };
      });
      
      const configData = await fs.readFile('./config.json', 'utf8');
      const config = JSON.parse(configData);
      apiKey = config.cesiumAccessToken || apiKey;
  } catch (error) {
      console.warn('Failed to load config.json, using localStorage or default token:', error);
  }
}

const params = {
    ionAssetId: '2684829', // moon
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

const HOVER_HEIGHT = 60; // Increased from 40 to 60
const MAX_SLOPE_ANGLE = 45;



///////////////////// SCENE SETUP /////////////////////

// Spacecraft setup
let spacecraft, cockpit, reticle, updateReticle, isFirstPersonView, updateEngineEffects;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;
export { spacecraft, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, wingsOpen, wingAnimation, updateEngineEffects };


// RENDER SCENE
export function renderScene() {
    // only render when on moon surface
    if (getMoonSurfaceActive()) {
        return { scene, camera };
    } else {
        return null;
    }
}


// Initialize spacecraft in the scene
function initSpacecraft() {

    // Create a spacecraft object to pull all the attributes and methods from the createSpacecraft function
    const spacecraftComponents = createSpacecraft(scene);

    // Expose attributes from the spacecraftComponents object
    spacecraft = spacecraftComponents.spacecraft;
    cockpit = spacecraftComponents.cockpit;
    reticle = spacecraftComponents.reticle;
    updateReticle = spacecraftComponents.updateReticle;

    // Expose methods from the spacecraftComponents object
    spacecraft.toggleView = spacecraftComponents.toggleView;
    spacecraft.updateAnimations = spacecraftComponents.updateAnimations;
    spacecraft.setWingsOpen = spacecraftComponents.setWingsOpen;
    spacecraft.toggleWings = spacecraftComponents.toggleWings;
    spacecraft.setWingsPosition = spacecraftComponents.setWingsPosition;
    updateEngineEffects = spacecraftComponents.updateEngineEffects;
    
    // Store the isFirstPersonView state for camera logic
    spacecraft.isFirstPersonView = function() {
        // Add a direct reference to the spacecraftComponents object
        return this._spacecraftComponents ? this._spacecraftComponents.isFirstPersonView : false;
    };

    // Store a direct reference to the spacecraftComponents
    spacecraft._spacecraftComponents = spacecraftComponents;

    // Make sure wings are open by default (set timeout to ensure model is loaded)
    setTimeout(() => {
        if (spacecraft && spacecraft.setWingsOpen) {
            // console.log("Setting wings to OPEN position in setup.js");
            spacecraft.setWingsOpen(true);
        }
    }, 1000); // 1 second delay to ensure model is fully loaded and processed

    // Verify reticle creation
    if (spacecraftComponents.reticle) {
        console.log("Reticle was successfully created with spacecraft in setup.js");
    } else {
        console.warn("Reticle not found in spacecraft components");
    }

    // Set the initial position and orientation of the spacecraft
    const position = latLonToCartesian(SPACECRAFT_INITIAL_LAT, SPACECRAFT_INITIAL_LON, SPACECRAFT_INITIAL_HEIGHT);
    spacecraft.position.copy(position);
    spacecraft.quaternion.setFromEuler(SPACECRAFT_INITIAL_ROTATION);

    cameraTarget = new THREE.Object3D();
    spacecraft.add(cameraTarget);
    cameraTarget.position.set(0, 0, 0);

    spacecraft.name = 'spacecraft';
    scene.add(spacecraft);

    console.log("Spacecraft initialized in moonCesium.js");
}

/// CORE INITIALIZATION FUNCTION ///
export function init() {

    console.log("Moon initialization started");

    scene = new THREE.Scene();
    const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(0), 64, 64);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.needsUpdate = true;
    scene.environment = env;
 
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        precision: 'highp',
        powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000); // Set background to black
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8; // Reduced from 1.2 for darker space
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.gammaFactor = 2.2;
 
    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;
    textureLoader = new THREE.TextureLoader(textureLoadingManager);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);
 
    initSpacecraft();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    initControls(getEarthSurfaceActive(), getMoonSurfaceActive());

    setupmoonLighting();
    
    // Initialize player sun position after spacecraft is created
    if (spacecraft && playerSun) {
        updatemoonLighting();
    }
    
    // Create Earth sphere after spacecraft is initialized
    createReferenceSphere();
    
    reinstantiateTiles();

    console.log("Moon initialization complete");
    
    return { 
        scene, 
        camera, 
        renderer, 
        tiles 
    };
}

// MOVEMENT UPDATE FUNCTION //
function updateMoonMovement(isBoosting) {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Handle wing animation for boost mode - moon specific handling
    const isInHyperspace = window.isHyperspace || false;
    
    // Use the proper setWingsOpen method instead of manual animation
    if (spacecraft && spacecraft.setWingsOpen) {
        const shouldWingsBeOpen = !keys.up && !isInHyperspace;
        spacecraft.setWingsOpen(shouldWingsBeOpen);
    } 
    // Fallback to manual animation if setWingsOpen is not available
    else if ((keys.up || isInHyperspace) && wingsOpen) {
        // console.log(`moon: Closing wings due to ${isInHyperspace ? 'hyperspace' : 'boost'} mode`);
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !isInHyperspace && !wingsOpen) {
        // console.log('moon: Opening wings for normal flight');
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    // COLLISION DETECTION ON THE MOON
    const result = updateCoreMovement(isBoosting, 'moon');
    
    // If core movement failed, exit early
    if (!result) return;
    
    const originalPosition = spacecraft.position.clone();
    const { forward } = result;
    
    // Moon-specific terrain handling
    if (tiles && tiles.group && tiles.group.children.length > 0) {
        try {
            const terrainMeshes = [];
            tiles.group.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    terrainMeshes.push(object);
                }
            });
            
            if (terrainMeshes.length > 0) {

                // RAY CASTING FOR COLLISION DETECTION
                
                // Get forward direction for collision response
                const downDirection = new THREE.Vector3(0, -1, 0);
                raycaster.set(spacecraft.position, downDirection);
                raycaster.near = 0;
                raycaster.far = 1000;
                
                const groundHits = raycaster.intersectObjects(terrainMeshes, false);
                if (groundHits.length > 0) {
                    let groundNormal = groundHits[0].normal || 
                        (groundHits[0].point ? new THREE.Vector3().subVectors(groundHits[0].point, new THREE.Vector3(0, 0, 0)).normalize() : null);
                    
                    // Keep slope avoidance for preventing collisions with mountains
                    if (groundNormal) {
                        const upVector = new THREE.Vector3(0, 1, 0);
                        const slopeAngle = Math.acos(groundNormal.dot(upVector)) * (180 / Math.PI);
                        if (slopeAngle > MAX_SLOPE_ANGLE) {
                            const rightVector = new THREE.Vector3().crossVectors(forward, upVector).normalize();
                            const adjustedForward = new THREE.Vector3().crossVectors(rightVector, groundNormal).normalize();
                            forward.lerp(adjustedForward, 0.5);
                        }
                    }
                    
                }
            }
        } catch (error) {
            console.error("Error in terrain handling:", error);
        }
    }

    // Moon-specific collision detection - keep this part
    try {
        if (tiles && tiles.group && tiles.group.children.length > 0) {
            if (checkTerrainCollision()) {
                console.log("Collision detected and resolved");
                
                // Show "WASTED" message (or similar) here if desired
                // You might want to add a UI element for this
                
                // Keep camera adjustment on collision
                const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? 
                    spacecraft.isFirstPersonView() : false;
                
                // Force the camera state to use collision offsets
                cameraState.targetOffset = isFirstPerson ? 
                    moonCockpitCamera.collision.clone() : 
                    moonCamera.collision.clone();
                
                // If still colliding, reset position (keep this functionality)
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, resetting spacecraft position");
                    
                    // Reset to original position as immediate fallback
                    spacecraft.position.copy(originalPosition);
                    
                    // Optionally, call the full reset function after a delay
                    setTimeout(() => {
                        resetPosition();
                    }, 1000); // Reset after 1 second delay
                }
            }
        }
    } catch (error) {
        console.error("Error during collision detection:", error);
        spacecraft.position.copy(originalPosition);
    }
}

/// CORE STATE UPDATE FUNCTION ///
export function update(isBoosting, deltaTime = 0.016) {
    try {

        // Follow similar boilerplate from setup.js

        if (!tiles) {
            return false;
        }

        // Get boosting state from inputControls
        const isBoostingFromControls = getBoostState();
        const boostState = isBoostingFromControls || keys.up;

        // Check for view toggle request (C key)
        if (getViewToggleRequested() && spacecraft && spacecraft.toggleView) {
            console.log('===== TOGGLE COCKPIT VIEW =====');
            spacecraft.toggleView(camera, (isFirstPerson) => {
                console.log(`Resetting space camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                // Reset camera state with new view mode if needed
                camera.position.copy(camera.position);
                camera.quaternion.copy(camera.quaternion);
            });
        }

        // Update spacecraft movement first
        updateMoonMovement(boostState);
        
        // CAMERA UPDATE - update spacecraft matrix world before camera calculations
        if (spacecraft) {
            spacecraft.updateMatrixWorld(true);
        }
        updateCamera();
        

        // Update reticle position if available
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            // Pass both boost and slow states to the reticle update function
            spacecraft.userData.updateReticle(keys.up, keys.down);
        } else {
            if (!window.reticleWarningLogged) {
                console.warn("Reticle update function not found on spacecraft userData", spacecraft);
                window.reticleWarningLogged = true;
            }
        }
 
        if (tiles.group) {
            tiles.group.traverse((node) => {
                if (node.isMesh && node.receiveShadow === undefined) {
                    node.receiveShadow = true;
                }
            });
        }
        
        updatemoonLighting();
 
        if (!camera) {
            console.warn("Camera not initialized");
            return false;
        }

        // Apply terrain optimization if needed based on performance
        if (camera.userData && camera.userData.performanceMetrics && 
           camera.userData.performanceMetrics.fps < 25 && 
           tiles.userData && tiles.userData.terrainController) {
            // If framerate drops below threshold, reduce terrain detail temporarily
            tiles.userData.terrainController.decreaseDetail();
        }

        // Ensure camera matrices are updated before Cesium tile updates
        camera.updateMatrixWorld(true);
        
        tiles.setCamera(camera);
        tiles.setResolutionFromRenderer(camera, renderer);
        tiles.update();
        
        // Update cockpit elements if in first-person view
        if (spacecraft && spacecraft.updateCockpit) {
            spacecraft.updateCockpit(deltaTime);
        }
        
        return true;
    } catch (error) {
        console.error("Error in update:", error);
        return false;
    }
}



/////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Resets the spacecraft to its initial position over moon
 */
export function resetPosition() {
    if (!spacecraft) {
        console.warn("Cannot reset position: spacecraft not initialized");
        return;
    }

    console.log("Resetting spacecraft position to moon starting point");
    
    // Set initial position of craft using the same constants
    const position = latLonToCartesian(SPACECRAFT_INITIAL_LAT, SPACECRAFT_INITIAL_LON, SPACECRAFT_INITIAL_HEIGHT);
    spacecraft.position.copy(position);

    // Use the same rotation constant
    spacecraft.quaternion.setFromEuler(SPACECRAFT_INITIAL_ROTATION);
}


// Convert world coordinates to local coordinates
function worldToLocal(worldPos) {
  if (!localOrigin) return worldPos.clone();
  const localPos = worldPos.clone().sub(localOrigin);
  return localPos;
}

// Convert local coordinates to world coordinates
function localToWorld(localPos) {
  if (!localOrigin) return localPos.clone();
  const worldPos = localPos.clone().add(localOrigin);
  return worldPos;
}



function latLonToCartesian(lat, lon, height) {
    const moonRadius = 1737.4 * 1000;
    const radius = moonRadius + height;
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

// Convert lat/lon/height to ECEF coordinates for Moon's surface instead of Earth
// THIS CONVERTS THE EARTH'S CAMERA MOVEMENT TO THE MOON'S SURFACE
function latLonHeightToEcef(lat, lon, height) {
    // Moon-specific parameters - Moon has a more spherical shape than Earth
    const moonRadius = 1737400.0; // Moon radius in meters (vs Earth's 6378137.0)
    // Moon has negligible flattening compared to Earth, so we use a more spherical model
    const moonFlattening = 0.0012; // Much less flattened than Earth's 1/298.257223563
    
    const e2 = moonFlattening * (2 - moonFlattening);
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);
    
    // For Moon, use simpler spherical model with slight adjustments for its small ellipticity
    const N = moonRadius / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
    const x = (N + height) * Math.cos(latRad) * Math.cos(lonRad);
    const y = (N + height) * Math.cos(latRad) * Math.sin(lonRad);
    const z = (N * (1 - e2) + height) * Math.sin(latRad);
    
    return new THREE.Vector3(x, y, z);
}

function checkCollisionInDirection(direction, terrainMeshes) {
    if (!spacecraft || !terrainMeshes || terrainMeshes.length === 0) return null;
    
    const rayDirection = direction.clone().normalize();
    raycaster.set(spacecraft.position, rayDirection);
    raycaster.near = 0;
    raycaster.far = spacecraftBoundingSphere.radius * 3; // Increased from 2 to 3 for better collision detection
    
    const intersects = raycaster.intersectObjects(terrainMeshes, false);
    if (intersects.length > 0) {
        return intersects[0];
    }
    
    return null;
}

function checkTerrainCollision() {
    if (!tiles || !tiles.group) {
        console.log("Tiles or tiles.group not available yet");
        return false;
    }

    spacecraftBoundingSphere.center.copy(spacecraft.position);
    // Increase collision radius when boosting for better detection at high speeds
    spacecraftBoundingSphere.radius = keys.up ? 7.0 : 5.0; // Larger radius when boosting

    const terrainMeshes = [];
    tiles.group.traverse((object) => {
        if (object.isMesh && object.geometry) {
            object.updateWorldMatrix(true, false);
            if (!object.geometry.boundingSphere) {
                try {
                    object.geometry.computeBoundingSphere();
                    if (!object.geometry.boundingSphere) return;
                } catch (e) {
                    console.error("Error computing bounding sphere:", e);
                    return;
                }
            }
            const meshSphere = new THREE.Sphere();
            meshSphere.copy(object.geometry.boundingSphere).applyMatrix4(object.matrixWorld);
            if (spacecraftBoundingSphere.intersectsSphere(meshSphere)) {
                terrainMeshes.push(object);
            }
        }
    });

    if (terrainMeshes.length === 0) {
        return false;
    }

    try {
        // Enhanced array of directions for more thorough collision checking
        const directions = [
            new THREE.Vector3(0, -1, 0),     // Down
            new THREE.Vector3(0, 0, 1),      // Forward
            new THREE.Vector3(1, 0, 0),      // Right
            new THREE.Vector3(-1, 0, 0),     // Left
            new THREE.Vector3(0, 0, -1),     // Back
            new THREE.Vector3(0, -1, 1).normalize(),     // Down-Forward
            new THREE.Vector3(0, -1, -1).normalize(),    // Down-Back
            new THREE.Vector3(1, -1, 0).normalize(),     // Down-Right
            new THREE.Vector3(-1, -1, 0).normalize(),    // Down-Left
            new THREE.Vector3(0, -0.5, 0).normalize(),   // Slight down
            new THREE.Vector3(0.5, -0.5, 0.5).normalize(), // Down-Forward-Right diagonal
            new THREE.Vector3(-0.5, -0.5, 0.5).normalize(), // Down-Forward-Left diagonal
            new THREE.Vector3(0.5, -0.5, -0.5).normalize(), // Down-Back-Right diagonal
            new THREE.Vector3(-0.5, -0.5, -0.5).normalize() // Down-Back-Left diagonal
        ];
        
        // Add more direction checks when boosting for better detection
        if (keys.up) {
            directions.push(
                new THREE.Vector3(1, 0, 1).normalize(),   // Forward-Right
                new THREE.Vector3(-1, 0, 1).normalize(),  // Forward-Left
                new THREE.Vector3(0.5, -0.5, 1).normalize(), // Down-Forward-Slight Right
                new THREE.Vector3(0, 0.5, 1).normalize()  // Slightly up and forward
            );
        }
        
        directions.forEach(dir => dir.applyQuaternion(spacecraft.quaternion));
        
        let collisionDetected = false;
        let collisionPoint = null;
        let collisionNormal = null;
        
        for (const direction of directions) {
            const intersection = checkCollisionInDirection(direction, terrainMeshes);
            if (intersection && intersection.distance) {
                const distanceToSurface = intersection.distance;
                
                if (distanceToSurface < spacecraftBoundingSphere.radius) {
                    let normal = intersection.normal || 
                        (intersection.point ? new THREE.Vector3().subVectors(intersection.point, new THREE.Vector3(0, 0, 0)).normalize() : 
                        direction.clone().negate().normalize());
                    
                    const pushFactor = keys.up ? 3.0 : 2.5; // Stronger push when boosting
                    collisionOffset.copy(normal).multiplyScalar((spacecraftBoundingSphere.radius - distanceToSurface) * pushFactor);
                    spacecraft.position.add(collisionOffset);
                    
                    // Store collision information for respawn
                    collisionDetected = true;
                    collisionPoint = intersection.point ? intersection.point.clone() : spacecraft.position.clone();
                    collisionNormal = normal.clone();
                    
                    // Reduce velocity on collision to prevent momentum carrying through surfaces
                    currentSpeed *= 0.5; // Reduce speed by 50% on collision
                    
                    // Show WASTED message
                    showCollisionWarning("WASTED");
                    
                    // Reset position to 2000m above the crash point with original orientation
                    resetToCollisionPoint(collisionPoint, collisionNormal);
                    
                    return true;
                }
            }
        }
    } catch (error) {
        console.error("Error in terrain collision detection:", error);
        return false;
    }

    return false;
}

/**
 * Resets the spacecraft position to 2000m above the point of collision
 * @param {THREE.Vector3} collisionPoint - The point where collision occurred
 * @param {THREE.Vector3} collisionNormal - The normal vector at collision point
 */
function resetToCollisionPoint(collisionPoint, collisionNormal) {
    if (!spacecraft || !collisionPoint) {
        console.warn("Cannot reset position: spacecraft or collision point not available");
        return;
    }

    console.log("Resetting spacecraft 2000m above Moon crash point with original orientation");
    
    // Default up vector if normal not available
    const upVector = collisionNormal || new THREE.Vector3(0, 1, 0);
    
    // Set position 2000m above the collision point
    const resetPosition = collisionPoint.clone().add(upVector.normalize().multiplyScalar(5000));
    spacecraft.position.copy(resetPosition);

    // Reset to the original orientation (same as at initialization)
    spacecraft.quaternion.setFromEuler(SPACECRAFT_INITIAL_ROTATION);
    
    // Reset speed to avoid continuing at high speed
    currentSpeed = baseSpeed;
}

// Function to display a temporary collision warning message
function showCollisionWarning(message = "COLLISION") {
  // Check if a warning message already exists and remove it
  const existingWarning = document.getElementById('collision-warning');
  if (existingWarning) {
    document.body.removeChild(existingWarning);
  }
  
  // Create warning element
  const warningElement = document.createElement('div');
  warningElement.id = 'collision-warning';
  warningElement.textContent = message;
  
  // Style the warning
  warningElement.style.position = 'fixed';
  warningElement.style.top = '40%'; // Moved up from 50% to 40% to appear higher on screen
  warningElement.style.left = '50%';
  warningElement.style.transform = 'translate(-50%, -50%)';
  warningElement.style.color = '#ff0000';
  warningElement.style.fontFamily = 'Orbitron, sans-serif';
  warningElement.style.fontSize = '32px';
  warningElement.style.fontWeight = 'bold';
  warningElement.style.zIndex = '10000';
  warningElement.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.7)';
  warningElement.style.padding = '20px';
  warningElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  warningElement.style.borderRadius = '5px';
  warningElement.style.opacity = '1';
  warningElement.style.transition = 'opacity 0.5s ease-out';
  
  // Add to DOM
  document.body.appendChild(warningElement);
  
  // Flash the warning by changing opacity
  let flashCount = 0;
  const maxFlashes = 3;
  
  const flashWarning = () => {
    if (flashCount >= maxFlashes) {
      // After flashing, fade out and remove
      warningElement.style.opacity = '0';
      // Remove element after fade out completes
      setTimeout(() => {
        if (warningElement.parentNode) {
          warningElement.parentNode.removeChild(warningElement);
        }
      }, 500);
      return;
    }
    
    // Toggle opacity
    warningElement.style.opacity = warningElement.style.opacity === '1' ? '0.3' : '1';
    flashCount++;
    setTimeout(flashWarning, 200);
  };
  
  // Start flashing
  flashWarning();
}


function setupTiles() {
    tiles.fetchOptions.mode = 'cors';
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath(config.DRACO_PATH)
    }));
    
    // Configure Cesium's request scheduler for optimal tile loading performance
    const requestController = configureCesiumRequestScheduler({
        maximumRequestsPerServer: 6,  // Slightly lower limit for moon's more detailed tileset
        throttleRequestsByServer: true,
        perServerRequestLimit: 10,     // Additional limit for newer Cesium versions
        requestQueueSize: 120          // Increased queue size for moon's complex tileset
    });
    
    // Store the controller for potential later use
    tiles.userData = tiles.userData || {};
    tiles.userData.requestController = requestController;
    
    // Log the current status of the request scheduler
    console.log('Cesium RequestScheduler configured for moon:', requestController.getStatus());
    
    // Temporarily boost tile request limits during initial load
    requestController.temporaryBoost(10000); // 10-second boost for initial loading of moon's complex tileset
    
    tiles.onLoadModel = (model) => {
        model.traverse((node) => {
            if (node.isMesh) {
                node.receiveShadow = true;
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => {
                            mat.shadowSide = THREE.FrontSide;
                            mat.needsUpdate = true;
                        });
                    } else {
                        node.material.shadowSide = THREE.FrontSide;
                        node.material.needsUpdate = true;
                    }
                }
            }
        });
        console.log("Loaded moon moon model with shadow settings");
    };
    
    scene.add(tiles.group);
}

// Modify the reinstantiateTiles function to call alignGridToTerrain immediately without the timeout delay
function reinstantiateTiles() {
    if (tiles) {
        scene.remove(tiles.group);
        tiles.dispose();
        tiles = null;
    }

    localStorage.setItem('ionApiKey', params.ionAccessToken);

    tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: params.ionAccessToken, assetId: params.ionAssetId }));
    tiles.addEventListener('load-tile-set', () => {
        const sphere = new THREE.Sphere();
        tiles.getBoundingSphere(sphere);
        console.log('moon bounding sphere center:', sphere.center);
        console.log('moon bounding sphere radius:', sphere.radius);
        console.log('moon tileset loaded successfully');
        
    });
    tiles.addEventListener('error', (error) => {
        console.error('Tileset loading error:', error);
    });

    setupTiles();
}


function setupmoonLighting() {
    // Create basic ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    // Add hemisphere light for more natural illumination
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(hemisphereLight);
    
    // Setup player sun directional light
    playerSun = new THREE.DirectionalLight(
        playerSunConfig.color, 
        playerSunConfig.intensity
    );
    
    // Configure shadows
    playerSun.castShadow = true;
    playerSun.shadow.mapSize.width = 2048;
    playerSun.shadow.mapSize.height = 2048;
    playerSun.shadow.camera.near = 0.5;
    playerSun.shadow.camera.far = 50000;
    playerSun.shadow.camera.left = -3000;
    playerSun.shadow.camera.right = 3000;
    playerSun.shadow.camera.top = 3000;
    playerSun.shadow.camera.bottom = -3000;
    playerSun.shadow.bias = -0.0001;
    
    // Setup target for the sun to point at
    playerSunTarget = new THREE.Object3D();
    scene.add(playerSunTarget);
    playerSun.target = playerSunTarget;
    
    // Add sun to scene
    scene.add(playerSun);
    
    // Initial update of light positions will happen in the first updatemoonLighting call
}



function updatemoonLighting() {
    if (!spacecraft || !playerSun || !playerSunTarget) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    
    // Position the sun based on mode (fixed or following)
    if (playerSunConfig.fixedPosition) {
        // Use global coordinates for fixed position
        playerSun.position.copy(latLonToCartesian(
            playerSunConfig.position.lat,
            playerSunConfig.position.lon,
            playerSunConfig.position.height
        ));
    } else {
        // Use player-relative position
        const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion).normalize();
        playerSun.position.copy(spacecraftPosition).add(playerUp.multiplyScalar(playerSunConfig.position.height));
    }
    
    // Always point at the player with optional offset
    playerSunTarget.position.copy(spacecraftPosition).add(
        new THREE.Vector3(playerSunConfig.targetOffset.x, playerSunConfig.targetOffset.y, playerSunConfig.targetOffset.z)
    );
    
    // Update matrices
    playerSunTarget.updateMatrixWorld();
    playerSun.target = playerSunTarget;
    playerSun.updateMatrixWorld(true);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}


// Add these functions to export so they can be called from other files or the console

/**
 * Updates any aspect of the player sun configuration and applies changes immediately
 * @param {Object} config - Configuration object with any of these optional properties:
 * @param {Object} config.position - Position object with lat, lon, and/or height
 * @param {number} config.intensity - Light intensity (0-20 recommended)
 * @param {number} config.color - Color in hex format (e.g., 0xffffcc)
 * @param {boolean} config.fixedPosition - Whether sun stays fixed in world space
 * @param {Object} config.targetOffset - Target offset with x, y, and/or z
 * @returns {Object} The updated configuration
 */
export function updatePlayerSun(config = {}) {
    // Update position if provided
    if (config.position) {
        if (config.position.lat !== undefined) {
            playerSunConfig.position.lat = config.position.lat;
        }
        if (config.position.lon !== undefined) {
            playerSunConfig.position.lon = config.position.lon;
        }
        if (config.position.height !== undefined && config.position.height > 0) {
            playerSunConfig.position.height = config.position.height;
        }
    }
    
    // Update intensity if provided
    if (config.intensity !== undefined && config.intensity >= 0) {
        playerSunConfig.intensity = config.intensity;
        if (playerSun) {
            playerSun.intensity = config.intensity;
        }
    }
    
    // Update color if provided
    if (config.color !== undefined) {
        playerSunConfig.color = config.color;
        if (playerSun) {
            playerSun.color.set(config.color);
        }
    }
    
    // Update fixed position setting if provided
    if (config.fixedPosition !== undefined) {
        playerSunConfig.fixedPosition = config.fixedPosition;
    }
    
    // Update target offset if provided
    if (config.targetOffset) {
        if (config.targetOffset.x !== undefined) {
            playerSunConfig.targetOffset.x = config.targetOffset.x;
        }
        if (config.targetOffset.y !== undefined) {
            playerSunConfig.targetOffset.y = config.targetOffset.y;
        }
        if (config.targetOffset.z !== undefined) {
            playerSunConfig.targetOffset.z = config.targetOffset.z;
        }
    }
    
    // Update sun position immediately if it exists and spacecraft exists
    if (playerSun && spacecraft) {
        updatemoonLighting();
    }
    
    return { ...playerSunConfig };
}

/**
 * Get the current player sun configuration
 * @returns {Object} The current player sun configuration
 */
export function getPlayerSunConfig() {
    return { ...playerSunConfig };
}

// For backward compatibility, maintain the individual setter functions
// but implement them using our new consolidated function

export function setPlayerSunPosition(lat, lon, height = null) {
    const position = { lat, lon };
    if (height !== null && height > 0) {
        position.height = height;
    }
    updatePlayerSun({ position });
    console.log(`Player sun position set to lat: ${lat}, lon: ${lon}, height: ${playerSunConfig.position.height}`);
}

export function setPlayerSunHeight(height) {
    if (height > 0) {
        updatePlayerSun({ position: { height } });
        console.log(`Player sun height set to ${height} meters`);
    } else {
        console.warn("Player sun height must be greater than 0");
    }
}

export function setPlayerSunIntensity(intensity) {
    if (intensity >= 0) {
        updatePlayerSun({ intensity });
        console.log(`Player sun intensity set to ${intensity}`);
    } else {
        console.warn("Player sun intensity must be non-negative");
    }
}

export function setPlayerSunColor(color) {
    updatePlayerSun({ color });
    console.log(`Player sun color set to 0x${color.toString(16)}`);
}

export function setPlayerSunFixed(fixed) {
    updatePlayerSun({ fixedPosition: fixed });
    console.log(`Sun position set to ${fixed ? 'fixed in global coordinates' : 'follow player orientation'}`);
}

export function setPlayerSunTargetOffset(x = 0, y = 0, z = 0) {
    updatePlayerSun({ targetOffset: { x, y, z } });
    console.log(`Player sun target offset set to (${x}, ${y}, ${z})`);
}

/**
 * Creates a reference sphere in front of the player at scene initialization
 * // the "REFERENCE SPHERE" is the model of the earth that appears in the distance
 */
function createReferenceSphere() {
  if (!spacecraft) {
    console.warn("Cannot create reference sphere: spacecraft not initialized");
    return;
  }

  // Create geometry and material with Earth texture
  const geometry = new THREE.SphereGeometry(sphereConfig.radius, 32, 32);
  
  // Load Earth texture from skybox folder
  const earthTexture = textureLoader.load(`${config.textures.path}/2k_earth_daymap.jpg`, (texture) => {

    // Apply a simple blur effect to the texture to simulate atmosphere
    // texture.minFilter = THREE.LinearFilter;
    // texture.magFilter = THREE.LinearFilter;
    
    // // This line is the key for the blurring effect - reducing anisotropy 
    // // creates a softening/blurring effect on the texture
    // texture.anisotropy = 1; // Minimum anisotropy for a blurred look
    
    if (referenceSphere && referenceSphere.material) {
      referenceSphere.material.needsUpdate = true;
    }
  });
  
  // Create a material that responds to lighting but appears much more subdued
  const material = new THREE.MeshPhongMaterial({ 
    map: earthTexture,
    shininess: 0,           // No shininess for a more matte appearance
    specular: 0x000000,     // No specular highlights
    reflectivity: 0,        // No reflections
    emissive: 0x000000,     // No emission
    emissiveIntensity: 0,   // No emission intensity
    opacity: 1.0,           // Fully opaque
    
    // This is key - reduce ambient and diffuse response to make it appear more shadowy
    // but still visible with the texture
    color: 0x606060
  });
  
  // Add a slight blue rim glow by adjusting material properties
  material.onBeforeCompile = (shader) => {
    // Add simple effect to soften the edge - simulates atmospheric scattering
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      // Simple atmospheric effect - add slight blue tint at the edges
      float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
      edgeFactor = smoothstep(0.3, 1.0, edgeFactor) * 0.3; // Control intensity here (0.3 is subtle)
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.5, 0.7, 1.0), edgeFactor);
      `
    );
  };
  
  // Create mesh
  referenceSphere = new THREE.Mesh(geometry, material);
  
  // Enable shadows on the Earth sphere
  referenceSphere.castShadow = true;
  referenceSphere.receiveShadow = true;
  
  // Position the sphere in front of the spacecraft
  updateReferenceSpherePlacement();
  
  // Add to scene
  scene.add(referenceSphere);
  
  console.log("Reference sphere created with atmospheric effect at distance:", sphereConfig.distance);
}

/**
 * Updates the reference sphere position and rotation based on config
 */
function updateReferenceSpherePlacement() {
  if (!referenceSphere || !spacecraft) return;
  
  // Get the initial spacecraft position and orientation
  const initialPosition = latLonToCartesian(
    SPACECRAFT_INITIAL_LAT, 
    SPACECRAFT_INITIAL_LON, 
    SPACECRAFT_INITIAL_HEIGHT
  );
  
  // Create a direction vector pointing forward from spacecraft
  const forward = new THREE.Vector3(0, 0, 1);
  forward.applyEuler(SPACECRAFT_INITIAL_ROTATION);
  
  // Create side and up vectors for orientation
  const up = new THREE.Vector3(0, 1, 0);
  up.applyEuler(SPACECRAFT_INITIAL_ROTATION);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  
  // Apply polar coordinates
  let targetPosition = new THREE.Vector3();
  
  // Convert polar angles to radians
  const angleRad = THREE.MathUtils.degToRad(sphereConfig.polar.angle);
  const pitchRad = THREE.MathUtils.degToRad(sphereConfig.polar.pitch);
  
  // Calculate direction with polar coordinates
  targetPosition.copy(forward);
  
  // Apply angle (rotation around up axis)
  targetPosition.applyAxisAngle(up, angleRad);
  
  // Apply pitch (rotation around right axis)
  targetPosition.applyAxisAngle(right, pitchRad);
  
  // Scale to distance and add to initial spacecraft position
  targetPosition.multiplyScalar(sphereConfig.distance);
  targetPosition.add(initialPosition);
  
  // Set sphere position
  referenceSphere.position.copy(targetPosition);
  
  // Apply rotation
  referenceSphere.rotation.set(
    THREE.MathUtils.degToRad(sphereConfig.rotation.x),
    THREE.MathUtils.degToRad(sphereConfig.rotation.y),
    THREE.MathUtils.degToRad(sphereConfig.rotation.z)
  );
  
  // Set visibility
  referenceSphere.visible = sphereConfig.visible;
}

/**
 * Set the distance of the reference sphere from the spacecraft
 * @param {number} distance - Distance in units
 */
export function setReferenceSphereDistance(distance) {
  if (distance > 0) {
    sphereConfig.distance = distance;
    updateReferenceSpherePlacement();
    console.log(`Reference sphere distance set to ${distance} units`);
  } else {
    console.warn("Reference sphere distance must be greater than 0");
  }
}

/**
 * Set the radius of the reference sphere
 * @param {number} radius - Radius in units
 */
export function setReferenceSphereRadius(radius) {
  if (radius > 0 && referenceSphere) {
    sphereConfig.radius = radius;
    
    // Create new geometry with updated radius
    const newGeometry = new THREE.SphereGeometry(radius, 32, 32);
    referenceSphere.geometry.dispose(); // Clean up old geometry
    referenceSphere.geometry = newGeometry;
    
    console.log(`Reference sphere radius set to ${radius} units`);
  } else {
    console.warn("Reference sphere radius must be greater than 0");
  }
}

/**
 * Set the rotation of the reference sphere
 * @param {number} x - X rotation in degrees
 * @param {number} y - Y rotation in degrees
 * @param {number} z - Z rotation in degrees
 */
export function setReferenceSphereRotation(x = 0, y = 0, z = 0) {
  sphereConfig.rotation.x = x;
  sphereConfig.rotation.y = y;
  sphereConfig.rotation.z = z;
  
  if (referenceSphere) {
    referenceSphere.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z)
    );
  }
  
  console.log(`Reference sphere rotation set to (${x}°, ${y}°, ${z}°)`);
}

/**
 * Set the polar coordinates of the reference sphere relative to the spacecraft
 * @param {number} angle - Horizontal angle in degrees (0 = directly in front)
 * @param {number} pitch - Vertical angle in degrees (0 = same height as player)
 */
export function setReferenceSpherePolar(angle = 0, pitch = 0) {
  sphereConfig.polar.angle = angle;
  sphereConfig.polar.pitch = pitch;
  
  updateReferenceSpherePlacement();
  
  console.log(`Reference sphere polar coordinates set to angle: ${angle}°, pitch: ${pitch}°`);
}

/**
 * Set the visibility of the reference sphere
 * @param {boolean} visible - Whether the sphere should be visible
 */
export function setReferenceSphereVisibility(visible) {
  sphereConfig.visible = visible;
  
  if (referenceSphere) {
    referenceSphere.visible = visible;
  }
  
  console.log(`Reference sphere visibility set to ${visible}`);
}

/**
 * Get the current reference sphere configuration
 * @returns {Object} The current reference sphere configuration
 */
export function getReferenceSphereConfig() {
  return { ...sphereConfig };
}

