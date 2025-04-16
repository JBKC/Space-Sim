import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import {
    textureLoadingManager, 
    loadingManager, 
    createEnhancedTextureLoader,
    loadTexture
} from '../appConfig/loaders.js';
import { configureCesiumRequestScheduler, optimizeTerrainLoading } from '../appConfig/cesiumRateLimit.js';
import config from '../appConfig/config.js';

import { updateMoonMovement, resetMovementInputs } from '../movement.js';
import { createSpacecraft } from '../spacecraft.js';
import { reticleMap } from '../reticle.js';
import { exitMoonSurface } from '../spaceEnvs/setup.js';
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
    updatePreviousKeyStates,
    getResetPositionRequested,
    getExitSurfaceRequested
} from '../inputControls.js';
import {
    getEarthSurfaceActive,
    getMoonSurfaceActive,
    setMoonSurfaceActive,
    getMoonInitialized,
    setMoonInitialized,
    setMoonTransition
} from '../stateEnv.js';


///////////////////// GENERAL INITIALIZATION /////////////////////

const scene = new THREE.Scene();
let tiles;
const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(0), 64, 64);
env.mapping = THREE.EquirectangularReflectionMapping;
env.needsUpdate = true;
scene.environment = env;
const textureLoader = createEnhancedTextureLoader(config);

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

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);
const cameraState = createCameraState('moon');
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

let moonSun, moonSunTarget; // Main directional light and its target
let planetSphere; // This is the Earth seen from the moon

// Spacecraft initial position
const SPACECRAFT_INITIAL_LAT = 0.6741;
const SPACECRAFT_INITIAL_LON = 23.4733;
const SPACECRAFT_INITIAL_HEIGHT = 20000;
const SPACECRAFT_INITIAL_ROTATION = new THREE.Euler(
    THREE.MathUtils.degToRad(-100),
    THREE.MathUtils.degToRad(-20),
    THREE.MathUtils.degToRad(-120),
    'XYZ'
);

// Qualities of lighting
const moonSunConfig = {
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

// Configure the distant Earth seen from moon
const planetConfig = {
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

// Convert Cesium coordinates to Cartesian (local) coordinates
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

///// SCENE LIGHTING /////

// Define the lighting params
function setupMoonLighting() {
    // Create basic ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    // Add hemisphere light for more natural illumination
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    scene.add(hemisphereLight);
    
    // Setup player sun directional light
    moonSun = new THREE.DirectionalLight(
        moonSunConfig.color, 
        moonSunConfig.intensity
    );
    
    // Configure shadows
    moonSun.castShadow = true;
    moonSun.shadow.mapSize.width = 2048;
    moonSun.shadow.mapSize.height = 2048;
    moonSun.shadow.camera.near = 0.5;
    moonSun.shadow.camera.far = 50000;
    moonSun.shadow.camera.left = -3000;
    moonSun.shadow.camera.right = 3000;
    moonSun.shadow.camera.top = 3000;
    moonSun.shadow.camera.bottom = -3000;
    moonSun.shadow.bias = -0.0001;
    
    // Setup target for the sun to point at
    moonSunTarget = new THREE.Object3D();
    scene.add(moonSunTarget);
    moonSun.target = moonSunTarget;
    
    // Add sun to scene
    scene.add(moonSun);
    
    // Initial update of light positions will happen in the first updatemoonLighting call
}

// Ensure the light always follows the spacecraft
function updatemoonLighting() {
    if (!spacecraft || !moonSun || !moonSunTarget) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    
    // Position the sun based on mode (fixed = fixed in space but still points at the spacecraft)
    if (moonSunConfig.fixedPosition) {
        // Use global coordinates for fixed position
        moonSun.position.copy(latLonToCartesian(
            moonSunConfig.position.lat,
            moonSunConfig.position.lon,
            moonSunConfig.position.height
        ));
    } else {
        // Use player-relative position
        const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion).normalize();
        moonSun.position.copy(spacecraftPosition).add(playerUp.multiplyScalar(moonSunConfig.position.height));
    }
    
    // Always point at the player with optional offset
    moonSunTarget.position.copy(spacecraftPosition).add(
        new THREE.Vector3(moonSunConfig.targetOffset.x, moonSunConfig.targetOffset.y, moonSunConfig.targetOffset.z)
    );
    
    // Update matrices
    moonSunTarget.updateMatrixWorld();
    moonSun.target = moonSunTarget;
    moonSun.updateMatrixWorld(true);
}


///// CREATE EARTH VISIBLE FROM MOON SURFACE /////

function createplanetSphere() {
  if (!spacecraft) {
    console.warn("Cannot create reference sphere: spacecraft not initialized");
    return;
  }

  // --- Calculate placement parameters directly --- 
  // Get the initial spacecraft position and orientation
  const initialPosition = latLonToCartesian(
    SPACECRAFT_INITIAL_LAT, 
    SPACECRAFT_INITIAL_LON, 
    SPACECRAFT_INITIAL_HEIGHT
  );
  
  // Create a direction vector pointing forward from spacecraft's initial orientation
  const forward = new THREE.Vector3(0, 0, 1);
  forward.applyEuler(SPACECRAFT_INITIAL_ROTATION);
  
  // Create side and up vectors for initial orientation
  const up = new THREE.Vector3(0, 1, 0);
  up.applyEuler(SPACECRAFT_INITIAL_ROTATION);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  
  // Apply polar coordinates from config
  let targetPosition = new THREE.Vector3();
  const angleRad = THREE.MathUtils.degToRad(planetConfig.polar.angle);
  const pitchRad = THREE.MathUtils.degToRad(planetConfig.polar.pitch);
  
  // Calculate direction with polar coordinates relative to initial forward
  targetPosition.copy(forward);
  targetPosition.applyAxisAngle(up, angleRad); // Apply horizontal angle
  targetPosition.applyAxisAngle(right, pitchRad); // Apply vertical pitch
  
  // Scale to distance and add to initial spacecraft position
  targetPosition.multiplyScalar(planetConfig.distance);
  targetPosition.add(initialPosition);

  // Calculate rotation from config
  const sphereRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(planetConfig.rotation.x),
    THREE.MathUtils.degToRad(planetConfig.rotation.y),
    THREE.MathUtils.degToRad(planetConfig.rotation.z)
  );
  // --- End placement calculation --- 

  // Create geometry and material with Earth texture
  const geometry = new THREE.SphereGeometry(planetConfig.radius, 32, 32);
  
  // Load Earth texture using the texture registry
  const earthTexture = loadTexture('planets', 'earth', (texture) => {
    if (planetSphere && planetSphere.material) {
      planetSphere.material.needsUpdate = true;
    }
  });
  
  // Create atmosphere material around sphere
  const material = new THREE.MeshPhongMaterial({ 
    map: earthTexture,
    shininess: 0,           // No shininess for a more matte appearance
    specular: 0x000000,     // No specular highlights
    reflectivity: 0,        // No reflections
    emissive: 0x000000,     // No emission
    emissiveIntensity: 0,   // No emission intensity
    opacity: 1.0,           // Fully opaque
    color: 0x606060
  });
  
  // Add a slight blue rim glow by adjusting material properties
  material.onBeforeCompile = (shader) => {
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
  planetSphere = new THREE.Mesh(geometry, material);
  
  // --- Apply calculated placement --- 
  planetSphere.position.copy(targetPosition);
  planetSphere.rotation.copy(sphereRotation);
  planetSphere.visible = planetConfig.visible;
  // --- End applying placement --- 
  
  // Enable shadows on the Earth sphere
  planetSphere.castShadow = true;
  planetSphere.receiveShadow = true;
    
  // Add to scene
  scene.add(planetSphere);
  
  console.log(`Reference sphere created at [${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}] relative to initial position, distance: ${planetConfig.distance}`);
}


///// CESIUM TILES INITIALIZATION /////

// Pull CESIUM API key from environment variables or localStorage
let apiKey = localStorage.getItem('ionApiKey') || import.meta.env.VITE_CESIUM_ACCESS_TOKEN || 'YOUR_CESIUM_TOKEN_HERE';

// No need to attempt Node.js file loading in browser context - this causes build issues
console.log('Using Cesium API Key for Moon scene:', apiKey ? 'Key available' : 'No key available');

const params = {
    ionAssetId: '2684829', // moon
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};


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

export { tiles };


///////////////////// SCENE CORE FUNCTIONALITY /////////////////////

// Spacecraft setup
let spacecraft, cockpit, reticle, updateReticle, isFirstPersonView, updateEngineEffects;
export { spacecraft, updateEngineEffects };


// RENDER SCENE
export function renderScene() {
    // only render when on moon surface
    if (getMoonSurfaceActive()) {
        // console.log("RENDERING: MOON SCENE", "Scene has", scene.children.length, "objects");
        
        return { scene, camera };
    } else {
        return null;
    }
}


/// RESOURCE CLEANUP ///
// ensures no residuals from previous visits to moon surface
function cleanupMoonResources() {
    console.log("🧹 Cleaning up previous Moon resources...");

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

    // Remove reference sphere (Earth model)
    if (planetSphere) {
        console.log("   - Removing reference sphere");
        scene.remove(planetSphere);
        if (planetSphere.geometry) planetSphere.geometry.dispose();
        if (planetSphere.material) {
             if (Array.isArray(planetSphere.material)) {
                 planetSphere.material.forEach(mat => mat.dispose());
             } else {
                 planetSphere.material.dispose();
             }
        }
        planetSphere = null;
    }

    // Remove lighting
    if (moonSun) {
        console.log("   - Removing moonSun light");
        scene.remove(moonSun);
        moonSun.dispose(); // Dispose light resources
        moonSun = null;
    }
    if (moonSunTarget) {
        console.log("   - Removing moonSunTarget");
        scene.remove(moonSunTarget);
        moonSunTarget = null;
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

    console.log("✅ Moon resource cleanup complete.");
}

// Initialize spacecraft in the scene
function initSpacecraft() {

    // Create a spacecraft object to pull all the attributes and methods from the createSpacecraft function
    const spacecraftComponents = createSpacecraft(scene);

    // Log successful object creation
    console.log("Moon spacecraft components created:", 
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


    const position = latLonToCartesian(SPACECRAFT_INITIAL_LAT, SPACECRAFT_INITIAL_LON, SPACECRAFT_INITIAL_HEIGHT);
    spacecraft.position.copy(position);
    spacecraft.quaternion.setFromEuler(SPACECRAFT_INITIAL_ROTATION);

    spacecraft.name = 'spacecraft';
    scene.add(spacecraft);
}

/// CORE INITIALIZATION FUNCTION ///
export function init() {
    
    // --- Run cleanup BEFORE any initialization --- 
    cleanupMoonResources();

    console.log("--- Starting Moon Initialization --- ");

    // The getMoonInitialized() check might now be redundant if cleanup runs every time,
    // but keep it for safety or if cleanup logic changes.
    if (getMoonInitialized()) {
        console.warn("Moon already marked as initialized, but running init() again after cleanup. This might indicate a state mismatch.");
        // Force reset flag just in case
        setMoonInitialized(false); 
    }
 
    console.log("   Running initSpacecraft...");
    initSpacecraft(); // Creates new spacecraft, reticle
    console.log("   Running onWindowResize...");
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

    // Initialize scene elements
    initControls(getEarthSurfaceActive(), getMoonSurfaceActive()); // Re-init or check if already initialized?
    setupMoonLighting(); // Add lighting to the scene
    createplanetSphere(); // Creates Earth seen from moon
    reinstantiateTiles(); // Creates new tileset

    console.log("--- Moon Initialization Complete --- ");
    
    // Return the newly created objects
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
        if (!getMoonInitialized()) {
            console.log("Moon not initialized yet");
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
                console.log(`Resetting moon camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
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
            console.log('===== EXIT MOON SURFACE REQUESTED =====');
            if (typeof exitMoonSurface === 'function') {
                exitMoonSurface();
            } else {
                console.warn('exitMoonSurface function not available');
                // Fallback to just setting the state
                setMoonSurfaceActive(false);
                setMoonTransition(true);
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
        updatemoonLighting();

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
        updateMoonMovement(spacecraft, rotation, boostState);
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

// Resets the spacecraft to its initial position on surface
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



function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}
