import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { loadingManager, textureLoadingManager } from '../appConfig/loaders.js';
import { configureCesiumRequestScheduler, optimizeTerrainLoading } from '../appConfig/cesiumRateLimit.js';
import config from '../appConfig/config.js';

import { updateSanFranMovement, resetMovementInputs } from '../movement.js';
import { createSpacecraft } from '../spacecraft.js';
import { reticleMap } from '../reticle.js';
import { exitEarthSurface } from '../spaceEnvs/setup.js';
import { 
    sanFranCamera,
    sanFranCockpitCamera,
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
    updatePreviousKeyStates,
    getResetPositionRequested,
    getExitSurfaceRequested
} from '../inputControls.js';
import {
    getEarthSurfaceActive,
    getMoonSurfaceActive,
    setEarthSurfaceActive,
    getEarthInitialized,
    setEarthInitialized,
    setEarthTransition
} from '../stateEnv.js';

///////////////////// GENERAL INITIALIZATION /////////////////////

const scene = new THREE.Scene();
let tiles;
const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(0), 64, 64);
env.mapping = THREE.EquirectangularReflectionMapping;
env.needsUpdate = true;
scene.environment = env;
const textureLoader = new THREE.TextureLoader(textureLoadingManager);

// Renderer setuo
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    precision: 'highp',
    powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;
document.body.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 1;

renderer.setClearColor(0x87ceeb); // Set background to sky blue
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // Reduced from 1.2 for darker space
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.gammaFactor = 2.2;

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);
const cameraState = createCameraState('sanFran');
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
            offset.copy(sanFranCamera.boost);
        } else {
            offset.copy(sanFranCockpitCamera.boost);
        }
    } else if (keys.down) {
        if (!isFirstPerson) {
            offset.copy(sanFranCamera.slow);
        } else {
            offset.copy(sanFranCockpitCamera.slow);
        }
    } else {
        if (!isFirstPerson) {
            offset.copy(sanFranCamera.base);
        } else {
            offset.copy(sanFranCockpitCamera.base);
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


///////////////////// SANFRAN-SPECIFIC INITIALIZATION /////////////////////

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Sun objects and materials
let earthSun, sunGroup, sunMesh, sunHalo, sunFlare;
let earthSunTarget; // Add variables for player sun

// Add player sun configuration options
const earthSunConfig = {
    // Position the sun using lat/lon/height in global coordinates
    position: {
        lat: 37.7749,  // San Francisco latitude
        lon: -122.4194, // San Francisco longitude
        height: 500000  // Very high altitude for sun
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

// Create the baseplane
let gridHelper;
let basePlane;

// Add global variables to control the base plane position and rotation
const basePlaneConfig = {
  position: { x: 400, y: 1000, z: -10 },
  rotation: { x: 0, y: 0, z: 30 }
};

const HOVER_HEIGHT = 40;
const MAX_SLOPE_ANGLE = 45;


// CESIUM INITIALIZATION //

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

console.log("Using API Key:", apiKey ? '✅ Loaded' : '❌ Not Found');


// Parameters for San Francisco 3D tileset only
const params = {
    ionAssetId: '1415196',
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

///////////////////// SCENE CORE FUNCTIONALITY /////////////////////

// Spacecraft setup
let spacecraft, cockpit, reticle, updateReticle, isFirstPersonView, updateEngineEffects;
export { spacecraft, updateEngineEffects };

// RENDER SCENE
export function renderScene() {
    if (getEarthSurfaceActive()) {
        
        return { scene, camera };
    } else {
        return null;
    }
}

/// RESOURCE CLEANUP ///
// ensures no residuals from previous visits to surface
function cleanupEarthResources() {
    console.log("🧹 Cleaning up previous Earth resources...");

    // Remove spacecraft and its reticle
    if (spacecraft) {
        console.log(`   - Removing spacecraft: ${spacecraft.name}`);
        scene.remove(spacecraft);
        
        // Clean up reticle associated with this spacecraft from the map
        if (reticleMap && reticleMap.has(spacecraft)) {
            const reticleData = reticleMap.get(spacecraft);
            if (reticleData && reticleData.object && reticleData.scene === scene) {
                console.log(`   - Removing reticle: ${reticleData.object.name}`);
                scene.remove(reticleData.object);
                // TODO: Dispose reticle geometry/materials if necessary
            }
            reticleMap.delete(spacecraft);
        }
        
        // Dispose spacecraft geometry/materials if necessary
        spacecraft = null; 
    }

    // Remove lighting
    if (earthSun) {
        console.log("   - Removing earthSun light");
        scene.remove(earthSun);
        earthSun.dispose(); // Dispose light resources
        earthSun = null;
    }
    if (earthSunTarget) {
        console.log("   - Removing earthSunTarget");
        scene.remove(earthSunTarget);
        earthSunTarget = null;
    }
    // Remove other lights if any were added dynamically
    const lightsToRemove = scene.children.filter(child => child.isLight);
    lightsToRemove.forEach(light => {
        console.log(`   - Removing other light: ${light.type}`);
        scene.remove(light);
        if(light.dispose) light.dispose();
    });

    // Dispose tileset
    if (tiles) {
        console.log("   - Disposing tileset");
        scene.remove(tiles.group); // Ensure group is removed
        tiles.dispose();
        tiles = null;
    }

    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }

    console.log("✅ San Francisco resource cleanup complete.");
}

// Initialize spacecraft in the scene
function initSpacecraft() {

    // Create a spacecraft object to pull all the attributes and methods from the createSpacecraft function
    const spacecraftComponents = createSpacecraft(scene);

    // Log successful object creation
    console.log("San Francisco spacecraft components created:", 
                spacecraftComponents ? "Success" : "Failed",
                "Object structure:", Object.keys(spacecraftComponents || {}));

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

     // Set initial position of craft above San Francisco
    const sfLat = 37.7749;
    const sfLon = -122.4194;
    const initialHeight = 1000;
    const position = latLonHeightToEcef(sfLat, sfLon, initialHeight);
        spacecraft.position.copy(position);

    spacecraft.quaternion.setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(-20),
    THREE.MathUtils.degToRad(75),
    THREE.MathUtils.degToRad(150),
    'XYZ'
    ));

    spacecraft.name = 'spacecraft';
    scene.add(spacecraft);
}

export function init() {

    // --- Run cleanup BEFORE any initialization --- 
    cleanupEarthResources();

    console.log("--- Starting Earth Initialization --- ");

    if (getEarthInitialized()) {
        console.warn("Earth already marked as initialized, but running init() again after cleanup. This might indicate a state mismatch.");
        // Force reset flag just in case
        setEarthInitialized(false); 
    }
    
    initSpacecraft();
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

    // Initialize scene elements
    initControls(getEarthSurfaceActive(), getMoonSurfaceActive());
    setupEarthLighting(); // Add lighting to the scene
    reinstantiateTiles(); // Creates new tileset

    console.log("--- Earth Initialization Complete --- ");

    return { 
        scene, 
        camera, 
        renderer, 
        tiles 
    };
}

/// CORE STATE UPDATE FUNCTION ///
export function update(isBoosting, deltaTime = 0.016) {
    try {
        // Follow similar boilerplate from setup.js
        if (!getEarthInitialized()) {
            console.log("Earth not initialized yet");
            return false;
        }

        if (!tiles) {
            return false;
        }

        // Get boosting state from inputControls
        const isBoostingFromControls = getBoostState();
        const boostState = isBoostingFromControls || isBoosting || keys.up;

        //// CHECK FOR KEY TOGGLES ////
        // Check for view toggle request (C key)
        if (getViewToggleRequested() && spacecraft && spacecraft.toggleView) {
            console.log('===== TOGGLE COCKPIT VIEW =====');
            spacecraft.toggleView(camera, (isFirstPerson) => {
                console.log(`Resetting Earth camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                // Reset camera state with new view mode if needed
                camera.position.copy(camera.position);
                camera.quaternion.copy(camera.quaternion);
            });
        }
        // Check for position reset request (R key)
        if (getResetPositionRequested() && spacecraft) {
            console.log('===== RESET POSITION REQUESTED =====');
            resetPosition();
        }
        // Check for exit surface request (ESC key)
        if (getExitSurfaceRequested()) {
            console.log('===== EXIT Earth SURFACE REQUESTED =====');
            if (typeof exitEarthSurface === 'function') {
                exitEarthSurface();
            } else {
                console.warn('exitEarthSurface function not available');
                // Fallback to just setting the state
                setEarthSurfaceActive(false);
                setEarthTransition(true);
            }
            return true; // Return early after exit request
        }

        // Update spacecraft effects (if boosting)
        if (updateEngineEffects) {
            updateEngineEffects(boostState || keys.up, keys.down);
        } else {
            console.warn("updateEngineEffects function is not available:", updateEngineEffects);
        }

        // Update environment elements
        updateEarthLighting();

        // Wing position control - check if conditions changed
        if (spacecraft && spacecraft.setWingsOpen) {
            const shouldWingsBeOpen = !boostState;
            
            spacecraft.setWingsOpen(shouldWingsBeOpen);
        }

        // Update reticle position
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            // Pass both boost and slow states to the reticle update function
            spacecraft.userData.updateReticle(keys.up, keys.down);
        } else {
            if (!window.reticleWarningLogged) {
                console.warn("Reticle update function not found on spacecraft userData", spacecraft);
                window.reticleWarningLogged = true;
            }
        }

        // Update spacecraft movement and camera
        updateSanFranMovement(spacecraft, rotation, boostState);
        // FOR CAMERA - update spacecraft matrix world before camera calculations
        if (spacecraft) {
            spacecraft.updateMatrixWorld(true);
        }
        // Pass the camera object to the updateCamera function
        updateCamera(camera);

        // CESIUM TILE UPDATES //
        if (tiles.group) {
            tiles.group.traverse((node) => {
                if (node.isMesh && node.receiveShadow === undefined) {
                    node.receiveShadow = true;
                }
            });
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
        
        // Update previous key states at the end of the frame
        updatePreviousKeyStates();
        
        return true;
    } catch (error) {
        console.error("Error in update:", error);
        return false;
    }
}

export function resetPosition() {

    if (!spacecraft) {
        console.warn("Cannot reset position: spacecraft not initialized");
        return;
    }

    console.log("Resetting spacecraft position to San Francisco starting point");
    
    // Set initial position of craft above San Francisco (same coordinates as in initialization)
    const sfLat = 37.7749;
    const sfLon = -122.4194;
    const initialHeight = 1000;
    const position = latLonHeightToEcef(sfLat, sfLon, initialHeight);
    spacecraft.position.copy(position);

    // Reset orientation
    spacecraft.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(-20),
        THREE.MathUtils.degToRad(75),
        THREE.MathUtils.degToRad(150),
        'XYZ'
    ));
    
    // Reset any velocity
    if (spacecraft.userData && spacecraft.userData.velocity) {
        spacecraft.userData.velocity.set(0, 0, 0);
    }
}

///////////////////// MORE SPECIFIC INITIALIZATION PART 2 /////////////////////

// Convert lat/lon/height to ECEF (Earth-Centered, Earth-Fixed) coordinates
function latLonHeightToEcef(lat, lon, height) {
    const a = 6378137.0; // WGS84 semi-major axis in meters
    const f = 1 / 298.257223563; // WGS84 flattening
    const e2 = f * (2 - f);
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
    const x = (N + height) * Math.cos(latRad) * Math.cos(lonRad);
    const y = (N + height) * Math.cos(latRad) * Math.sin(lonRad);
    const z = (N * (1 - e2) + height) * Math.sin(latRad);
    return new THREE.Vector3(x, y, z);
}



function setupTiles() {
    tiles.fetchOptions.mode = 'cors';
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath(config.DRACO_PATH)
    }));
    
    // Configure Cesium's request scheduler for optimal tile loading performance
    const requestController = configureCesiumRequestScheduler({
        maximumRequestsPerServer: 8,  // Limit concurrent requests to prevent server overload
        throttleRequestsByServer: true,
        perServerRequestLimit: 12,     // Additional limit for newer Cesium versions
        requestQueueSize: 100          // Size of the request queue
    });
    
    // Store the controller for potential later use
    tiles.userData = tiles.userData || {};
    tiles.userData.requestController = requestController;
    
    // Log the current status of the request scheduler
    console.log('Cesium RequestScheduler configured:', requestController.getStatus());
    
    // Temporarily boost tile request limits during initial load
    requestController.temporaryBoost(8000); // 8-second boost for initial loading
    
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
        console.log("Loaded San Francisco model with shadow settings");
    };
    
    scene.add(tiles.group);
}

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
 console.log('San Francisco bounding sphere center:', sphere.center);
 console.log('San Francisco bounding sphere radius:', sphere.radius);
 console.log('San Francisco tileset loaded successfully');
 
 // Call alignGridToTerrain immediately without timeout
 alignGridToTerrain();
    });
    tiles.addEventListener('error', (error) => {
        console.error('Tileset loading error:', error);
    });

    setupTiles();
}

export { tiles };



///////////////////// SCENE LIGHTING /////////////////////

function setupEarthLighting() {
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader(textureLoadingManager);
    }
    
    // Create a stronger ambient light for more even lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased for more even illumination
    scene.add(ambientLight);
 
    // Create a more focused and less intense directional light for the sun
    earthSun = new THREE.DirectionalLight(0xffffff, 3); // Reduced for better balance
 
    // Define the light source position using lat, lon, and height
    const sunLat = 37.7749; // San Francisco latitude
    const sunLon = -122.4194; // San Francisco longitude
    const sunHeight = 100000; // High altitude to simulate sunlight from above
    const sunPosition = latLonHeightToEcef(sunLat, sunLon, sunHeight);
    earthSun.position.copy(sunPosition);
 
    earthSun.castShadow = true;
 
    earthSun.shadow.mapSize.width = 4096;
    earthSun.shadow.mapSize.height = 4096;
    earthSun.shadow.camera.near = 1000;
    earthSun.shadow.camera.far = 200000;
    const shadowSize = 20000;
    earthSun.shadow.camera.left = -shadowSize;
    earthSun.shadow.camera.right = shadowSize;
    earthSun.shadow.camera.top = shadowSize;
    earthSun.shadow.camera.bottom = -shadowSize;
    earthSun.shadow.bias = -0.00002;
    earthSun.shadow.normalBias = 0.005;
 
    // Set the target at San Francisco's ground level
    const targetLat = 37.7749;
    const targetLon = -122.4194;
    const targetHeight = 0; // Ground level
    const targetPosition = latLonHeightToEcef(targetLat, targetLon, targetHeight);
    const target = new THREE.Object3D();
    target.position.copy(targetPosition);
    scene.add(target);
    earthSun.target = target;
 
    scene.add(earthSun);
 
    // Reduce intensity of additional lights or remove them for space environment
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.2); // Reduced from 0.5 to 0.2
    sideLight.position.set(-1, -1, 1).normalize();
    scene.add(sideLight);
    
    // Use a very dim blue fill light for space ambience
    const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.1); // Reduced from 0.2 to 0.1
    fillLight.position.set(0, -1, 0);
    scene.add(fillLight);
    
    // Add a hemisphere light for more even illumination from above
    const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,  // Sky color - white light from above
        0x444444,  // Ground color - darker light from below
        0.4        // Intensity
    );
    scene.add(hemisphereLight);
    
    // Add a main directional sun positioned using lat/lon coordinates
    earthSun = new THREE.DirectionalLight(earthSunConfig.color, earthSunConfig.intensity);
    earthSun.castShadow = true;
    
    // Configure shadows for better quality
    earthSun.shadow.mapSize.width = 2048;
    earthSun.shadow.mapSize.height = 2048;
    earthSun.shadow.camera.near = 0.5;
    earthSun.shadow.camera.far = 50000;
    earthSun.shadow.camera.left = -3000;
    earthSun.shadow.camera.right = 3000;
    earthSun.shadow.camera.top = 3000;
    earthSun.shadow.camera.bottom = -3000;
    earthSun.shadow.bias = -0.0001;
    
    // Position the sun using global coordinates
    const earthSunPosition = latLonHeightToEcef(
        earthSunConfig.position.lat,
        earthSunConfig.position.lon,
        earthSunConfig.position.height
    );
    earthSun.position.copy(earthSunPosition);
    
    // Create a target object for the player sun
    earthSunTarget = new THREE.Object3D();
    scene.add(earthSunTarget);
    earthSun.target = earthSunTarget;
    
    // Add the player sun to the scene
    scene.add(earthSun);
    
    console.log(`Sun initialized at global coordinates: lat ${earthSunConfig.position.lat}, lon ${earthSunConfig.position.lon}, height ${earthSunConfig.position.height}`);
}

function updateEarthLighting() {
    if (!earthSun || !spacecraft) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    earthSun.position.set(
        spacecraftPosition.x,
        spacecraftPosition.y + 100000,
        spacecraftPosition.z
    );
    
    if (earthSun.target) {
        earthSun.target.position.copy(spacecraftPosition);
        earthSun.target.updateMatrixWorld();
    }
    
    // Update the player sun based on config
    if (earthSun && earthSunTarget) {
        if (earthSunConfig.fixedPosition) {
            // For fixed position, use the global lat/lon coordinates to position the sun
            // Only update if we need to maintain the position in global space
            const earthSunPosition = latLonHeightToEcef(
                earthSunConfig.position.lat,
                earthSunConfig.position.lon,
                earthSunConfig.position.height
            );
            earthSun.position.copy(earthSunPosition);
            
            // Point the sun at the player's position
            earthSunTarget.position.copy(spacecraftPosition);
            earthSunTarget.position.add(new THREE.Vector3(
                earthSunConfig.targetOffset.x,
                earthSunConfig.targetOffset.y,
                earthSunConfig.targetOffset.z
            ));
        } else {
            // If following player, position the sun above the player's local up direction
            const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion);
            playerUp.normalize().multiplyScalar(earthSunConfig.position.height);
            
            // Set the sun position relative to the player
            earthSun.position.copy(spacecraftPosition).add(playerUp);
            
            // Set the target to the player's position
            earthSunTarget.position.copy(spacecraftPosition);
        }
        
        earthSunTarget.updateMatrixWorld();
        earthSun.target = earthSunTarget;
        earthSun.updateMatrixWorld(true);
    }
}


///////////////////// BASE PLANE THAT LIES UNDER CESIUM TERRAIN /////////////////////


// Helper function to create text sprites
function createTextSprite(text, color, size = 1) {
 const canvas = document.createElement('canvas');
 const canvasSize = 256; // Texture size
 canvas.width = canvasSize;
 canvas.height = canvasSize;
 const context = canvas.getContext('2d');
 context.fillStyle = 'rgba(0, 0, 0, 0)'; // Transparent background
 context.fillRect(0, 0, canvasSize, canvasSize);
 context.font = 'Bold 100px Arial';
 context.fillStyle = color;
 context.textAlign = 'center';
 context.textBaseline = 'middle';
 context.fillText(text, canvasSize / 2, canvasSize / 2);

 const texture = new THREE.Texture(canvas);
 texture.needsUpdate = true;

 const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
 const sprite = new THREE.Sprite(spriteMaterial);
 sprite.scale.set(size, size, 1);
 return sprite;
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

function createCoordinateSystem() {
 coordinateSystem = new THREE.Group();
 
 // X axis (red)
 const xGeometry = new THREE.CylinderGeometry(
 coordConfig.arrowThickness,
 coordConfig.arrowThickness,
 coordConfig.arrowLength,
 8
 );
 const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
 const xArrow = new THREE.Mesh(xGeometry, xMaterial);
 xArrow.rotation.z = Math.PI / 2;
 xArrow.position.x = coordConfig.arrowLength / 2;
 const xLabel = createTextSprite('X', '#ff0000', coordConfig.labelSize);
 xLabel.position.set(coordConfig.arrowLength + coordConfig.labelSize / 2, 0, 0);
 
 // Y axis (green)
 const yGeometry = new THREE.CylinderGeometry(
 coordConfig.arrowThickness,
 coordConfig.arrowThickness,
 coordConfig.arrowLength,
 8
 );
 const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
 const yArrow = new THREE.Mesh(yGeometry, yMaterial);
 yArrow.position.y = coordConfig.arrowLength / 2;
 const yLabel = createTextSprite('Y', '#00ff00', coordConfig.labelSize);
 yLabel.position.set(0, coordConfig.arrowLength + coordConfig.labelSize / 2, 0);
 
 // Z axis (blue)
 const zGeometry = new THREE.CylinderGeometry(
 coordConfig.arrowThickness,
 coordConfig.arrowThickness,
 coordConfig.arrowLength,
 8
 );
 const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
 const zArrow = new THREE.Mesh(zGeometry, zMaterial);
 zArrow.rotation.x = Math.PI / 2;
 zArrow.position.z = coordConfig.arrowLength / 2;
 const zLabel = createTextSprite('Z', '#0000ff', coordConfig.labelSize);
 zLabel.position.set(0, 0, coordConfig.arrowLength + coordConfig.labelSize / 2);

 // Remove the ground plane with solid color
 
 // Add all components to coordinate system
 coordinateSystem.add(xArrow, yArrow, zArrow, xLabel, yLabel, zLabel);
 
 // Set position and orientation
 const coordPos = latLonHeightToEcef(
 coordConfig.position.lat,
 coordConfig.position.lon,
 coordConfig.position.height
 );
 coordinateSystem.position.copy(coordPos);
 
 // Store this position as our local origin point
 localOrigin = coordPos.clone();
 
 // Make the coordinate system very small to effectively hide it
 coordConfig.arrowLength = 1; // Tiny arrows
 coordConfig.arrowThickness = 0.1; // Very thin
 coordConfig.labelSize = 0.1; // Tiny labels
 
 coordinateSystem.scale.setScalar(coordConfig.scale);
 coordinateSystem.quaternion.setFromEuler(new THREE.Euler(
 THREE.MathUtils.degToRad(coordConfig.orientation.pitch),
 THREE.MathUtils.degToRad(coordConfig.orientation.yaw),
 THREE.MathUtils.degToRad(coordConfig.orientation.roll),
 'XYZ'
 ));

 // Hide the coordinate system entirely
 coordinateSystem.visible = false;
 scene.add(coordinateSystem);
 
 // Create a hidden grid helper (needed for structure but won't be visible)
 gridHelper = new THREE.GridHelper(10000, 100, 0x888888, 0x444444);
 gridHelper.position.copy(coordPos);
 gridHelper.rotation.x = Math.PI / 2; // Initial rotation to lie on X-Y plane (Z-up)
 gridHelper.visible = false; // Hide the grid helper
 scene.add(gridHelper);
 
 console.log("Local coordinate system initialized but hidden from view");
}



function checkCollisionInDirection(direction, terrainMeshes) {
    if (!spacecraft || !terrainMeshes || terrainMeshes.length === 0) return null;
    
    const rayDirection = direction.clone().normalize();
    raycaster.set(spacecraft.position, rayDirection);
    raycaster.near = 0;
    raycaster.far = 0.5; // Increased from 0.1 to 0.5 to better detect building collisions
    
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
    spacecraftBoundingSphere.radius = 0.5; // Slightly larger radius to detect buildings better

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

    // Create a helper function to check if we're colliding with the base plane
    // to avoid confusing building collisions with base plane collisions
    const isBasePlaneCollision = (object) => {
        return object === basePlane || (object.name && object.name === "basePlane");
    };

    try {
        // Check multiple directions to better detect collisions
        const directions = [
            new THREE.Vector3(0, 0, 1),   // Forward
            new THREE.Vector3(0, 0, -1),  // Backward
            new THREE.Vector3(1, 0, 0),   // Right
            new THREE.Vector3(-1, 0, 0),  // Left
            new THREE.Vector3(0, -1, 0),  // Down
        ];
        
        directions.forEach(dir => dir.applyQuaternion(spacecraft.quaternion));
        
        let collisionDetected = false;
        
        for (const direction of directions) {
            const intersection = checkCollisionInDirection(direction, terrainMeshes);
            if (intersection && intersection.distance) {
                const distanceToSurface = intersection.distance;
                
                // Make sure we're not colliding with the base plane
                if (intersection.object && isBasePlaneCollision(intersection.object)) {
                    continue; // Skip base plane collisions
                }
                
                // Debug output
                console.log(`Terrain collision check: distance=${distanceToSurface.toFixed(3)}, direction=${direction.toArray().map(v => v.toFixed(2))}, object=${intersection.object.uuid.substring(0,8)}`);
                
                if (distanceToSurface < 0.1) { // Slightly larger threshold for building detection
                    let normal = intersection.normal || 
                        (intersection.point ? new THREE.Vector3().subVectors(intersection.point, new THREE.Vector3(0, 0, 0)).normalize() : 
                        direction.clone().negate().normalize());
                    
                    const pushFactor = 1; 
                    collisionOffset.copy(normal).multiplyScalar(0.2 * pushFactor);
                    spacecraft.position.add(collisionOffset);
                    
                    // Show collision warning message but don't reset position
                    showCollisionWarning("BUILDING COLLISION");
                    
                    console.log("Building collision detected, showing warning but not resetting position");
                    collisionDetected = true;
                    break; // Exit after first collision is handled
                }
            }
        }
        
        return collisionDetected;
    } catch (error) {
        console.error("Error in terrain collision detection:", error);
        return false;
    }
}






// Add a new function to create fixed coordinate system - values found empirically / trial and error
function createBasePlane() {
    console.log("Creating fixed coordinate system");
  
    if (window.gridCoordinateSystem) {
      scene.remove(window.gridCoordinateSystem);
    }
  
    const gridPlaneSystem = new THREE.Group();
    window.gridCoordinateSystem = gridPlaneSystem;
  
    const fixedPosition = new THREE.Vector3(-2704597.993, -4260866.335, 3886911.844);
    gridPlaneSystem.position.copy(fixedPosition);
    const fixedQuaternion = new THREE.Quaternion(0.6390, 0.6326, 0.4253, -0.1034);
    gridPlaneSystem.quaternion.copy(fixedQuaternion);
  
    // Axes setup (unchanged, remains invisible)
    const axesSize = 500;
    const axesHelper = new THREE.Group();
    axesHelper.visible = false;
    const xGeometry = new THREE.CylinderGeometry(20, 20, axesSize, 8);
    const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false });
    const xAxis = new THREE.Mesh(xGeometry, xMaterial);
    xAxis.rotation.z = -Math.PI / 2;
    xAxis.position.x = axesSize / 2;
    const xConeGeometry = new THREE.ConeGeometry(40, 100, 8);
    const xCone = new THREE.Mesh(xConeGeometry, xMaterial);
    xCone.rotation.z = -Math.PI / 2;
    xCone.position.x = axesSize + 50;
    const yGeometry = new THREE.CylinderGeometry(20, 20, axesSize, 8);
    const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, visible: false });
    const yAxis = new THREE.Mesh(yGeometry, yMaterial);
    yAxis.position.y = axesSize / 2;
    const yConeGeometry = new THREE.ConeGeometry(40, 100, 8);
    const yCone = new THREE.Mesh(yConeGeometry, yMaterial);
    yCone.position.y = axesSize + 50;
    const zGeometry = new THREE.CylinderGeometry(20, 20, axesSize, 8);
    const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, visible: false });
    const zAxis = new THREE.Mesh(zGeometry, zMaterial);
    zAxis.rotation.x = Math.PI / 2;
    zAxis.position.z = axesSize / 2;
    const zConeGeometry = new THREE.ConeGeometry(40, 100, 8);
    const zCone = new THREE.Mesh(zConeGeometry, zMaterial);
    zCone.rotation.x = Math.PI / 2;
    zCone.position.z = axesSize + 50;
    const labelSize = 100;
    const xLabel = createTextSprite('X', '#ff0000', labelSize / 500);
    xLabel.position.set(axesSize + 150, 0, 0);
    xLabel.visible = false;
    const yLabel = createTextSprite('Y', '#00ff00', labelSize / 500);
    yLabel.position.set(0, axesSize + 150, 0);
    yLabel.visible = false;
    const zLabel = createTextSprite('Z', '#0000ff', labelSize / 500);
    zLabel.position.set(0, 0, axesSize + 150);
    zLabel.visible = false;
    const originGeometry = new THREE.SphereGeometry(40, 16, 16);
    const originMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false });
    const origin = new THREE.Mesh(originGeometry, originMaterial);
    axesHelper.add(xAxis, xCone, yAxis, yCone, zAxis, zCone, xLabel, yLabel, zLabel, origin);
    gridPlaneSystem.add(axesHelper);
  
    // BASE PLANE SETUP
    const planeWidth = 8000;
    const planeHeight = 8000;
    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x507062, 
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0
    });
    basePlane = new THREE.Mesh(planeGeometry, planeMaterial);
    basePlane.position.set(
      basePlaneConfig.position.x,
      basePlaneConfig.position.y,
      basePlaneConfig.position.z
    );
    basePlane.rotation.set(
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.x),
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.y),
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.z)
    );
    basePlane.name = "basePlane";
    gridPlaneSystem.add(basePlane);
  
    // Apply LinearFog to the scene
    scene.fog = new THREE.Fog(0x87ceeb, 2000, 4000);
  
    scene.add(gridPlaneSystem);
  
    console.log("Fixed coordinate system created with plane and fog at position:", basePlaneConfig.position, "and rotation:", basePlaneConfig.rotation);
  }
  
  // Assuming createTextSprite and basePlaneConfig are defined elsewhere

// Add a function to update the base plane position and rotation
export function updateBasePlane(position, rotation) {
  // Update the configuration
  if (position) {
    basePlaneConfig.position.x = position.x !== undefined ? position.x : basePlaneConfig.position.x;
    basePlaneConfig.position.y = position.y !== undefined ? position.y : basePlaneConfig.position.y;
    basePlaneConfig.position.z = position.z !== undefined ? position.z : basePlaneConfig.position.z;
  }
  
  if (rotation) {
    basePlaneConfig.rotation.x = rotation.x !== undefined ? rotation.x : basePlaneConfig.rotation.x;
    basePlaneConfig.rotation.y = rotation.y !== undefined ? rotation.y : basePlaneConfig.rotation.y;
    basePlaneConfig.rotation.z = rotation.z !== undefined ? rotation.z : basePlaneConfig.rotation.z;
  }
  
  // If the plane already exists, update its position and rotation
  if (basePlane) {
    basePlane.position.set(
      basePlaneConfig.position.x,
      basePlaneConfig.position.y,
      basePlaneConfig.position.z
    );
    
    basePlane.rotation.set(
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.x),
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.y),
      THREE.MathUtils.degToRad(basePlaneConfig.rotation.z)
    );
    
    // Update walls if they exist
    if (basePlane.userData.walls) {
      const wallsContainer = basePlane.userData.wallsContainer;
      if (wallsContainer) {
        // Update the position and rotation of the walls container to match the base plane
        wallsContainer.position.copy(basePlane.position);
        wallsContainer.rotation.copy(basePlane.rotation);
      }
    }
    
    console.log("Updated base plane position:", basePlaneConfig.position, "and rotation:", basePlaneConfig.rotation);
  } else {
    // If the plane doesn't exist yet, recreate it
    createBasePlane();
  }
}

// Replace the dynamic alignGridToTerrain function with our fixed implementation
function alignGridToTerrain() {
  createBasePlane();
}







function onWindowResize() {
 camera.aspect = window.innerWidth / window.innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(window.innerWidth, window.innerHeight);
 renderer.setPixelRatio(window.devicePixelRatio);
}

// Add a function to check collision with base plane
function checkBasePlaneCollision() {
  // Extra safety: Always skip collision detection during initial entry period
  if (isInitialEarthEntry || Date.now() - initializationTime < COLLISION_SAFETY_PERIOD) {
    return false;
  }

  if (!spacecraft || !basePlane || !window.gridCoordinateSystem) return false;

  // Get the world position of the spacecraft
  const spacecraftWorldPosition = spacecraft.getWorldPosition(new THREE.Vector3());
  
  // Get the spacecraft's forward vector and velocity
  const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.quaternion);
  const velocity = forwardVector.clone().multiplyScalar(currentSpeed);
  
  // Create an expanded detection zone in front of the spacecraft for high-speed collisions
  // Use a much smaller look-ahead to ensure only direct collisions are detected
  const lookAheadDistance = currentSpeed * 0.5; // Reduced from 3 to 0.5 for much tighter collision detection
  const futurePosition = spacecraftWorldPosition.clone().add(velocity.clone().normalize().multiplyScalar(lookAheadDistance));

  // Get the plane's world position and quaternion
  const planeWorldPosition = new THREE.Vector3();
  basePlane.getWorldPosition(planeWorldPosition);
  const planeQuaternion = window.gridCoordinateSystem.quaternion;

  // Get the plane's normal (Z-axis of the grid system, pointing "up" in local space)
  const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQuaternion);

  // Define collision thresholds - minimal values for direct contact
  const planeCollisionThreshold = 0.5; // Drastically reduced from 10 to 0.5
  const highSpeedThreshold = 4; // Keep this the same for high-speed detection

  // --- Check for z-coordinate violation (going below the plane's z-level) ---
  // Convert spacecraft world position to local coordinate system
  const gridWorldMatrix = window.gridCoordinateSystem.matrixWorld;
  const gridWorldMatrixInverse = new THREE.Matrix4().copy(gridWorldMatrix).invert();
  const spacecraftLocalPosition = spacecraftWorldPosition.clone().applyMatrix4(gridWorldMatrixInverse);
  
  // Check if the spacecraft is below the plane's z-coordinate (basePlaneConfig.position.z)
  const belowPlaneZLevel = spacecraftLocalPosition.z > basePlaneConfig.position.z;
  
  if (belowPlaneZLevel) {
    console.log("Spacecraft went below the plane's z-level:", spacecraftLocalPosition.z, "plane z:", basePlaneConfig.position.z);
    
    // Trigger position reset (simulating 'R' key press)
    resetPosition();
    
    // Show collision warning message
    showCollisionWarning("WASTED");
    
    return true;
  }

  // --- Plane Collision (prevent passing through the base plane) ---
  // Create a raycaster from the current position
  const raycasterPlane = new THREE.Raycaster();
  raycasterPlane.set(spacecraftWorldPosition, planeNormal.clone().negate()); // Ray downward
  const planeIntersects = raycasterPlane.intersectObject(basePlane);
  
  // Create a second raycaster from the predicted future position
  const raycasterFuture = new THREE.Raycaster();
  raycasterFuture.set(futurePosition, planeNormal.clone().negate());
  const futureIntersects = raycasterFuture.intersectObject(basePlane);

  // Check for either immediate collision or predicted collision
  if ((planeIntersects.length > 0 && planeIntersects[0].distance < planeCollisionThreshold) ||
      (futureIntersects.length > 0 && futureIntersects[0].distance < planeCollisionThreshold && currentSpeed > highSpeedThreshold)) {
    
    // If collision detected, push the spacecraft upward (minimal push)
    const pushDistance = 0; // Reduced from planeCollisionThreshold * 1.5 to a smaller fixed value
    const pushDirection = planeNormal.clone(); // Push upward
    spacecraft.position.add(pushDirection.multiplyScalar(pushDistance));
    console.log("Collision detected with base plane, pushing upward. Speed:", currentSpeed);

    // Trigger position reset (simulating 'R' key press) for base plane only
    resetPosition();
    
    // Show collision warning message with specific plane text
    showCollisionWarning("WASTED");
    
    return true;
  }

  return false;
}

// Function to display a temporary collision warning message
function showCollisionWarning(message = "COLLISION") {
  // Safety check: Don't show warnings during initialization safety period
  if (Date.now() - initializationTime < COLLISION_SAFETY_PERIOD) {
    console.log(`Suppressing "${message}" warning during safety period. Remaining time:`, 
                Math.round((COLLISION_SAFETY_PERIOD - (Date.now() - initializationTime))/1000) + "s");
    return; // Exit without showing warning
  }
  
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
      // Remove warning after flashing
      setTimeout(() => {
        if (warningElement.parentNode) {
          warningElement.style.opacity = '0';
          setTimeout(() => {
            if (warningElement.parentNode) {
              document.body.removeChild(warningElement);
            }
          }, 500);
        }
      }, 200);
      return;
    }
    
    warningElement.style.opacity = warningElement.style.opacity === '1' ? '0.3' : '1';
    flashCount++;
    setTimeout(flashWarning, 200);
  };
  
  // Start flashing
  flashWarning();
}

// Add these functions to export so they can be called from other files or the console

/**
 * Set the position of the player sun using lat/lon coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} height - Height above sea level in meters (optional)
 */
export function setearthSunPosition(lat, lon, height = null) {
    earthSunConfig.position.lat = lat;
    earthSunConfig.position.lon = lon;
    
    if (height !== null && height > 0) {
        earthSunConfig.position.height = height;
    }
    
    console.log(`Player sun position set to lat: ${lat}, lon: ${lon}, height: ${earthSunConfig.position.height}`);
    
    // Update the sun position immediately if it exists
    if (earthSun) {
        const earthSunPosition = latLonHeightToEcef(
            earthSunConfig.position.lat,
            earthSunConfig.position.lon,
            earthSunConfig.position.height
        );
        earthSun.position.copy(earthSunPosition);
        earthSun.updateMatrixWorld(true);
    }
}

/**
 * Set the height of the player sun above sea level
 * @param {number} height - Height in meters above sea level
 */
export function setearthSunHeight(height) {
    if (height > 0) {
        earthSunConfig.position.height = height;
        console.log(`Player sun height set to ${height} meters`);
        
        // Update the sun position immediately if it exists
        if (earthSun) {
            const earthSunPosition = latLonHeightToEcef(
                earthSunConfig.position.lat,
                earthSunConfig.position.lon,
                earthSunConfig.position.height
            );
            earthSun.position.copy(earthSunPosition);
            earthSun.updateMatrixWorld(true);
        }
    } else {
        console.warn("Player sun height must be greater than 0");
    }
}

/**
 * Set the intensity of the player sun
 * @param {number} intensity - Light intensity (recommended range: 0-20)
 */
export function setearthSunIntensity(intensity) {
    if (intensity >= 0) {
        earthSunConfig.intensity = intensity;
        if (earthSun) {
            earthSun.intensity = intensity;
        }
        console.log(`Player sun intensity set to ${intensity}`);
    } else {
        console.warn("Player sun intensity must be non-negative");
    }
}

/**
 * Set the color of the player sun
 * @param {number} color - Color in hex format (e.g., 0xffffcc for warm sunlight)
 */
export function setearthSunColor(color) {
    earthSunConfig.color = color;
    if (earthSun) {
        earthSun.color.set(color);
    }
    console.log(`Player sun color set to 0x${color.toString(16)}`);
}

/**
 * Get the current player sun configuration
 * @returns {Object} The current player sun configuration
 */
export function getearthSunConfig() {
    return { ...earthSunConfig };
}

/**
 * Set whether the sun should be fixed in world space or follow the player
 * @param {boolean} fixed - Whether the sun stays in a fixed position (true) or follows the player (false)
 */
export function setearthSunFixed(fixed) {
    earthSunConfig.fixedPosition = fixed;
    
    // Update the sun position immediately if it exists
    if (earthSun && spacecraft) {
        if (fixed) {
            // When switching to fixed, update the global position
            const earthSunPosition = latLonHeightToEcef(
                earthSunConfig.position.lat,
                earthSunConfig.position.lon,
                earthSunConfig.position.height
            );
            earthSun.position.copy(earthSunPosition);
        } else {
            // When switching to player-relative, update the local position
            const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion);
            playerUp.normalize().multiplyScalar(earthSunConfig.position.height);
            earthSun.position.copy(spacecraft.position).add(playerUp);
        }
        earthSun.updateMatrixWorld(true);
    }
    
    console.log(`Sun position set to ${fixed ? 'fixed in global coordinates' : 'follow player orientation'}`);
}

/**
 * Set the target offset for the player sun
 * This allows adjusting where the sun points relative to the player
 * @param {number} x - X offset
 * @param {number} y - Y offset
 * @param {number} z - Z offset
 */
export function setearthSunTargetOffset(x = 0, y = 0, z = 0) {
    earthSunConfig.targetOffset.x = x;
    earthSunConfig.targetOffset.y = y;
    earthSunConfig.targetOffset.z = z;
    
    console.log(`Player sun target offset set to (${x}, ${y}, ${z})`);
}



