import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { Water } from '/node_modules/three/examples/jsm/objects/Water.js'; // Correct import for ocean
import { createSpacecraft } from './spacecraft.js';
import { fireLaser, updateLasers } from './laser.js';
import { 
    createForwardRotation,
    cinematicEffects
} from './camera.js';

// Define Washington camera offsets locally
const washingtonCamera = {
    base: new THREE.Vector3(0, 2, -10),
    boost: new THREE.Vector3(0, 3, -20),
    slow: new THREE.Vector3(0, 1.5, -7),
    collision: new THREE.Vector3(0, 5, -20),
};

// Washington cockpit camera offsets
const washingtonCockpitCamera = {
    base: new THREE.Vector3(0, 0, 13.35),
    boost: new THREE.Vector3(0, 0, 40.1),
    slow: new THREE.Vector3(0, 0, 6.7),
    collision: new THREE.Vector3(0, 2, -1),
};

let camera, scene, renderer, tiles, cameraTarget;
let washingtonInitialized = false;

// DEFINE local coordinate system (align to the 3D tile rendering)
const coordConfig = {
 scale: 2,
 position: {
 lat: 38.8895,
 lon: -77.0352,
 height: -100
 },
 orientation: {
 pitch: 50,
 yaw: -23,
 roll: 0
 },
 // make tiny to hide from screen
 arrowLength: 1,
 arrowThickness: 1,
 labelSize: 1
};
let coordinateSystem;
let localOrigin; // Local origin point for coordinate system

export { 
 scene, 
 camera, 
 renderer, 
 tiles, 
 cameraTarget,
 spacecraft,
 localOrigin,  // Export local origin for other modules to use
 worldToLocal,  // Export conversion functions
 localToWorld,
};

// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;

// Movement settings
const baseSpeed = 1.5;
const boostSpeed = baseSpeed * 3;
const slowSpeed = baseSpeed * 0.5; // Half of base speed
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
// Add sensitivity multipliers for each rotation axis
const pitchSensitivity = 0.6; // Lower value = less sensitive
const rollSensitivity = 1;  // Lower value = less sensitive
const yawSensitivity = 0.5;   // Lower value = less sensitive
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false, down: false, space: false };

// Camera settings
const baseCameraOffset = new THREE.Vector3(0, 2, -10);
const boostCameraOffset = new THREE.Vector3(0, 3, -20);
const slowCameraOffset = new THREE.Vector3(0, 1.5, -7); // Closer camera for slow mode
const collisionCameraOffset = new THREE.Vector3(0, 5, -20);
let currentCameraOffset = baseCameraOffset.clone();
let targetCameraOffset = baseCameraOffset.clone();
const cameraTransitionSpeed = 0.2;
const MAX_PITCH_OFFSET = 0.1;
const MAX_YAW_OFFSET = 0.15;
const CAMERA_LAG_FACTOR = 0.1;
let currentPitchOffset = 0;
let currentYawOffset = 0;
let targetPitchOffset = 0;
let targetYawOffset = 0;
const MAX_LOCAL_PITCH_ROTATION = 0.06;
const MAX_LOCAL_YAW_ROTATION = 0.08;
const LOCAL_ROTATION_SPEED = 0.08;
let currentLocalPitchRotation = 0;
let currentLocalYawRotation = 0;
let targetLocalPitchRotation = 0;
let targetLocalYawRotation = 0;

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Sun objects and materials
let washingtonSun, sunGroup, sunMesh, sunHalo, sunFlare;
let playerSun, playerSunTarget; // Add new variables for player sun
let textureLoader = new THREE.TextureLoader();

// Add player sun configuration options
const playerSunConfig = {
    // Position the sun using lat/lon/height in global coordinates instead of relative height
    position: {
        lat: 46.8529,  // Mount Rainier latitude
        lon: -121.7604, // Mount Rainier longitude
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

/**
 * Configuration for the background sphere that appears in the Washington scene
 * @type {Object}
 * @property {number} radius - Radius of the background sphere
 * @property {number} distance - Distance from the player at spawn
 * @property {Object} rotation - Rotation of the sphere in radians
 * @property {number} rotation.x - X-axis rotation
 * @property {number} rotation.y - Y-axis rotation
 * @property {number} rotation.z - Z-axis rotation
 * @property {number} elevationAngle - Angle above/below horizon in degrees (90 = directly above, -90 = directly below)
 * @property {number} azimuthAngle - Angle around horizon in degrees (0 = behind player, 180 = in front of player)
 * @property {Object} offset - Additional position offset in local coordinates
 * @property {number} offset.x - X offset (left/right)
 * @property {number} offset.y - Y offset (up/down)
 * @property {number} offset.z - Z offset (forward/backward)
 */
const backgroundSphereConfig = {
  radius: 50000,            // Default radius of the sphere
  distance: 100000,         // Default distance from player
  color: 0x000000,          // Default black color
  rotation: {
      x: 0,                 // No rotation on X-axis
      y: 0,                 // No rotation on Y-axis
      z: 0                  // No rotation on Z-axis
  },
  elevationAngle: 30,       // Default elevation - 30 degrees above horizon
  azimuthAngle: 0,          // Default azimuth - directly behind player
  offset: {
      x: 0,                 // No horizontal offset
      y: 0,                 // No vertical offset
      z: 0                  // No depth offset
  }
};

// Orientation widget variables
let orientationScene, orientationCamera, orientationRenderer;
let orientationAxes;

const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

// Pull API key from config.json or localStorage
let apiKey = localStorage.getItem('ionApiKey') ?? 'YOUR_CESIUM_TOKEN_HERE';
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const fs = await import('fs/promises');
    try {
        const configData = await fs.readFile('./config.json', 'utf8');
        const config = JSON.parse(configData);
 apiKey = config.cesiumAccessToken || apiKey;
    } catch (error) {
        console.warn('Failed to load config.json, using localStorage or default token:', error);
    }
}

// Parameters for Washington DC 3D tileset
const params = {
    ionAssetId: '57590', // Washington DC tileset ID
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

const HOVER_HEIGHT = 40;
const MAX_SLOPE_ANGLE = 45;

// Add the declaration at the top of the file, near other global variables
let gridHelper; // Declare gridHelper as a global variable

// Add a global variable to reference the base plane for collision detection
let basePlane;

// Add global variables to control the base plane position and rotation
const basePlaneConfig = {
  position: { x: 400, y: 1000, z: -10 },
  rotation: { x: 0, y: 0, z: 30 }
};

// Define a local camera state instead of using createCameraState
// since washingtonCamera is not exported from camera.js
const cameraState = {
  currentOffset: washingtonCamera.base.clone(),
  targetOffset: washingtonCamera.base.clone(),
  currentPitchOffset: 0,
  currentYawOffset: 0,
  targetPitchOffset: 0,
  targetYawOffset: 0,
  currentLocalPitchRotation: 0,
  currentLocalYawRotation: 0,
  targetLocalPitchRotation: 0,
  targetLocalYawRotation: 0,
  currentFOV: 75, // Default FOV
  targetFOV: 75
};
const smoothFactor = 0.1;

/**
 * Simple configuration for the planet that appears in the scene
 */
const planetConfig = {
    // Basic parameters
    radius: 50000,            // Size of the planet
    distance: 100000,         // Distance from player's starting point
    
    // Position in space (polar coordinates)
    elevation: 30,            // Degrees above horizon (90 = directly above, -90 = directly below)
    azimuth: 0,               // Degrees around horizon (0 = behind, 90 = right, 180 = in front, 270 = left)
    
    // Planet's self-rotation (in radians)
    rotation: {
        x: 0,                 // Rotation around x-axis
        y: 0,                 // Rotation around y-axis
        z: 0                  // Rotation around z-axis
    },
    
    // Visual effect - blue haze at bottom of planet
    hazeColor: 0xa7d5e7,      // Color of the blue haze
    hazeIntensity: 2,         // Strength of the haze effect (higher = more intense)
    hazeStart: 0.2,           // Where the haze begins (0.0 to 1.0, from top to bottom)
    hazeEnd: 1.0              // Where the haze is fully opaque
};

// Add a variable to store the planet
let planet;

/**
 * Creates a large background sphere fixed in space behind the player spawn point
 * @param {THREE.Scene} scene - The scene to add the sphere to
 * @param {THREE.Vector3} spawnPosition - The spawn position of the player
 * @param {THREE.Quaternion} spawnRotation - The spawn rotation of the player
 * @param {Object} options - Optional parameters to override default config
 * @returns {THREE.Mesh} - The created sphere
 */
function createBackgroundSphere(scene, spawnPosition, spawnRotation, options = {}) {
    // Apply any custom options, falling back to defaults if not provided
    const config = {
        radius: options.radius || backgroundSphereConfig.radius,
        distance: options.distance || backgroundSphereConfig.distance,
        color: options.color || backgroundSphereConfig.color,
        rotation: {
            x: options.rotation?.x !== undefined ? options.rotation.x : backgroundSphereConfig.rotation.x,
            y: options.rotation?.y !== undefined ? options.rotation.y : backgroundSphereConfig.rotation.y,
            z: options.rotation?.z !== undefined ? options.rotation.z : backgroundSphereConfig.rotation.z
        },
        elevationAngle: options.elevationAngle || backgroundSphereConfig.elevationAngle,
        azimuthAngle: options.azimuthAngle || backgroundSphereConfig.azimuthAngle,
        offset: options.offset || backgroundSphereConfig.offset
    };
    
    // Create a sphere geometry with configured radius
    const sphereGeometry = new THREE.SphereGeometry(config.radius, 32, 32);
    
    // Load the planet texture from the skybox directory
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    // Create a custom shader material for the atmosphere effect
    // This will create a blue haze effect at the bottom of the sphere
    const sphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            planetTexture: { value: null },
            hazeColor: { value: new THREE.Color(0xa7d5e7) }, // Sky blue for the haze
            hazeIntensity: { value: 2 },                    // Intensity of the haze
            hazeStart: { value: 0.2 },                        // Where the haze begins (0.0 to 1.0, from top to bottom)
            hazeEnd: { value: 1 }                           // Where the haze ends (fully hazed)
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D planetTexture;
            uniform vec3 hazeColor;
            uniform float hazeIntensity;
            uniform float hazeStart;
            uniform float hazeEnd;
            
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vec4 texColor = texture2D(planetTexture, vUv);
                
                // Calculate the normalized height (y-coordinate) for the haze gradient
                // Convert from [-1, 1] to [0, 1] range
                float normalizedY = vPosition.y / length(vPosition);
                normalizedY = (normalizedY + 1.0) / 2.0;
                
                // Calculate haze factor (0 = no haze, 1 = full haze)
                float hazeFactor = 0.0;
                if (normalizedY < hazeEnd) {
                    if (normalizedY < hazeStart) {
                        hazeFactor = hazeIntensity;
                    } else {
                        // Smooth transition from hazeStart to hazeEnd
                        hazeFactor = hazeIntensity * (1.0 - (normalizedY - hazeStart) / (hazeEnd - hazeStart));
                    }
                }
                
                // Mix the texture color with the haze color based on the haze factor
                gl_FragColor = mix(texColor, vec4(hazeColor, texColor.a), hazeFactor);
            }
        `,
        side: THREE.BackSide,
        transparent: true
    });
    
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.name = "backgroundSphere"; // Add a name for easier identification
    
    // Make the sphere ignore lighting
    sphere.receiveShadow = false;
    sphere.castShadow = false;
    
    // Calculate position using polar coordinates
    // Convert elevation and azimuth angles from degrees to radians
    const elevationRad = THREE.MathUtils.degToRad(config.elevationAngle);
    const azimuthRad = THREE.MathUtils.degToRad(config.azimuthAngle);
    
    // Calculate direction vector from polar coordinates
    // Using spherical coordinates: x = r * cos(elevation) * sin(azimuth)
    //                             y = r * sin(elevation)
    //                             z = r * cos(elevation) * cos(azimuth)
    // Note: In our coordinate system, z is forward, y is up, x is right
    const directionVector = new THREE.Vector3(
        config.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
        config.distance * Math.sin(elevationRad),
        config.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    
    // Apply the player's rotation to the direction vector
    directionVector.applyQuaternion(spawnRotation);
    
    // Set the sphere position relative to spawn position plus direction vector
    sphere.position.copy(spawnPosition).add(directionVector);
    
    // Apply additional offset in local space
    if (config.offset.x !== 0 || config.offset.y !== 0 || config.offset.z !== 0) {
        const offsetVector = new THREE.Vector3(config.offset.x, config.offset.y, config.offset.z);
        offsetVector.applyQuaternion(spawnRotation);
        sphere.position.add(offsetVector);
    }
    
    // Apply rotation relative to the spacecraft orientation
    const rotationEuler = new THREE.Euler(config.rotation.x, config.rotation.y, config.rotation.z, 'XYZ');
    const rotationQuaternion = new THREE.Quaternion().setFromEuler(rotationEuler);
    
    // Apply spacecraft's base orientation, then apply the relative rotation
    sphere.quaternion.copy(spawnRotation).multiply(rotationQuaternion);
    
    // Store the polar coordinate settings in userData for later retrieval
    sphere.userData.distance = config.distance;
    sphere.userData.rotation = { ...config.rotation };
    sphere.userData.elevationAngle = config.elevationAngle;
    sphere.userData.azimuthAngle = config.azimuthAngle;
    sphere.userData.offset = { ...config.offset };
    
    // Load the texture after adding the sphere to the scene
    textureLoader.load(
        'skybox/2k_neptune.jpg', // Use relative path without leading slash
        function(texture) {
            // When the texture is loaded, set it to the shader material's uniform
            sphere.material.uniforms.planetTexture.value = texture;
            sphere.material.needsUpdate = true;
            console.log('Planet texture applied to background sphere with atmospheric haze effect');
        },
        undefined, // onProgress callback not needed
        function(err) {
            // Error callback
            console.error('Error loading planet texture:', err);
            // Try alternative path if the first one fails
            textureLoader.load(
                './skybox/planet1.webp',
                function(texture) {
                    // Set the texture to the shader material's uniform
                    sphere.material.uniforms.planetTexture.value = texture;
                    sphere.material.needsUpdate = true;
                    console.log('Planet texture applied using alternative path with atmospheric haze effect');
                },
                undefined,
                function(err2) {
                    console.error('Error loading planet texture with alternative path:', err2);
                }
            );
        }
    );
    
    console.log(`Added backgroundSphere behind the player at position: (${
        sphere.position.x.toFixed(2)}, ${
        sphere.position.y.toFixed(2)}, ${
        sphere.position.z.toFixed(2)}) with radius: ${config.radius} and rotation: (${
        config.rotation.x.toFixed(2)}, ${
        config.rotation.y.toFixed(2)}, ${
        config.rotation.z.toFixed(2)})`
    );
    
    // Add the sphere to the scene
    scene.add(sphere);
    
    return sphere;
}

/**
 * Updates the size and properties of the background sphere
 * @param {Object} options - Options to update (radius, distance, color, rotation)
 */
export function updateBackgroundSphere(options = {}) {
    if (!backgroundSphere) {
        console.warn("Cannot update backgroundSphere: sphere not created yet");
        return;
    }
    
    // Update radius if provided
    if (options.radius !== undefined && options.radius > 0) {
        // Create a new geometry with the updated radius
        const newGeometry = new THREE.SphereGeometry(options.radius, 32, 32);
        backgroundSphere.geometry.dispose(); // Clean up old geometry
        backgroundSphere.geometry = newGeometry;
        console.log(`Updated backgroundSphere radius to: ${options.radius}`);
    }
    
    // Update haze properties if provided
    if (options.hazeColor !== undefined && backgroundSphere.material.uniforms) {
        backgroundSphere.material.uniforms.hazeColor.value.set(options.hazeColor);
        console.log(`Updated backgroundSphere haze color to: 0x${options.hazeColor.toString(16)}`);
    }
    
    if (options.hazeIntensity !== undefined && backgroundSphere.material.uniforms) {
        backgroundSphere.material.uniforms.hazeIntensity.value = options.hazeIntensity;
        console.log(`Updated backgroundSphere haze intensity to: ${options.hazeIntensity}`);
    }
    
    if (options.hazeStart !== undefined && backgroundSphere.material.uniforms) {
        backgroundSphere.material.uniforms.hazeStart.value = options.hazeStart;
        console.log(`Updated backgroundSphere haze start to: ${options.hazeStart}`);
    }
    
    if (options.hazeEnd !== undefined && backgroundSphere.material.uniforms) {
        backgroundSphere.material.uniforms.hazeEnd.value = options.hazeEnd;
        console.log(`Updated backgroundSphere haze end to: ${options.hazeEnd}`);
    }
    
    // Extract current properties to preserve them if not being updated
    const currentRotation = backgroundSphere.userData.rotation || backgroundSphereConfig.rotation;
    
    // Check if we need to update rotation
    let rotationChanged = false;
    let newRotation = { ...currentRotation };
    
    if (options.rotation) {
        if (options.rotation.x !== undefined) {
            newRotation.x = options.rotation.x;
            rotationChanged = true;
        }
        if (options.rotation.y !== undefined) {
            newRotation.y = options.rotation.y;
            rotationChanged = true;
        }
        if (options.rotation.z !== undefined) {
            newRotation.z = options.rotation.z;
            rotationChanged = true;
        }
    }
    
    // Store the rotation in userData for later retrieval
    backgroundSphere.userData.rotation = newRotation;
    
    // If distance or rotation is being updated, we need to recreate the sphere
    if (options.distance !== undefined || rotationChanged) {
        console.log(`Updating backgroundSphere distance or rotation`);
        
        // Save the current texture if it exists
        const currentTexture = backgroundSphere.material && backgroundSphere.material.uniforms && 
                              backgroundSphere.material.uniforms.planetTexture ? 
                              backgroundSphere.material.uniforms.planetTexture.value : null;
        
        // Save other current shader properties
        const hazeColor = backgroundSphere.material.uniforms.hazeColor.value.clone();
        const hazeIntensity = backgroundSphere.material.uniforms.hazeIntensity.value;
        const hazeStart = backgroundSphere.material.uniforms.hazeStart.value;
        const hazeEnd = backgroundSphere.material.uniforms.hazeEnd.value;
        
        // Remove the current sphere
        scene.remove(backgroundSphere);
        
        // Create a new sphere with updated distance
        const spawnPosition = spacecraft.position.clone();
        const spawnRotation = spacecraft.quaternion.clone();
        
        // Combine existing sphere properties with new options
        const newOptions = {
            radius: options.radius || (backgroundSphere.geometry.parameters ? 
                     backgroundSphere.geometry.parameters.radius : backgroundSphereConfig.radius),
            distance: options.distance !== undefined ? options.distance : 
                      (backgroundSphere.userData.distance || backgroundSphereConfig.distance),
            rotation: newRotation,
            elevationAngle: config.elevationAngle,
            azimuthAngle: config.azimuthAngle,
            offset: config.offset
        };
        
        // Store the distance for later reference
        if (options.distance !== undefined) {
            backgroundSphere.userData.distance = options.distance;
        }
        
        // Create the new sphere
        backgroundSphere = createBackgroundSphere(scene, spawnPosition, spawnRotation, newOptions);
        
        // Store the distance and rotation in userData for later retrieval
        backgroundSphere.userData.distance = newOptions.distance;
        backgroundSphere.userData.rotation = newOptions.rotation;
        
        // Apply the saved texture and shader properties if they exist
        if (currentTexture && backgroundSphere.material.uniforms) {
            backgroundSphere.material.uniforms.planetTexture.value = currentTexture;
            backgroundSphere.material.uniforms.hazeColor.value.copy(hazeColor);
            backgroundSphere.material.uniforms.hazeIntensity.value = hazeIntensity;
            backgroundSphere.material.uniforms.hazeStart.value = hazeStart;
            backgroundSphere.material.uniforms.hazeEnd.value = hazeEnd;
            backgroundSphere.material.needsUpdate = true;
            console.log('Reapplied texture and haze settings to recreated background sphere');
        }
    }
}

// Add this function to get current background sphere config
export function getBackgroundSphereConfig() {
    return {
        radius: backgroundSphere && backgroundSphere.geometry.parameters ? 
                backgroundSphere.geometry.parameters.radius : backgroundSphereConfig.radius,
        distance: backgroundSphere && backgroundSphere.userData.distance ? 
                backgroundSphere.userData.distance : backgroundSphereConfig.distance,
        rotation: backgroundSphere && backgroundSphere.userData.rotation ?
                backgroundSphere.userData.rotation : backgroundSphereConfig.rotation,
        elevationAngle: backgroundSphere && backgroundSphere.userData.elevationAngle ?
                backgroundSphere.userData.elevationAngle : backgroundSphereConfig.elevationAngle,
        azimuthAngle: backgroundSphere && backgroundSphere.userData.azimuthAngle ?
                backgroundSphere.userData.azimuthAngle : backgroundSphereConfig.azimuthAngle,
        offset: backgroundSphere && backgroundSphere.userData.offset ?
                backgroundSphere.userData.offset : backgroundSphereConfig.offset,
        // Add haze properties
        hazeColor: backgroundSphere && backgroundSphere.material.uniforms ? 
                backgroundSphere.material.uniforms.hazeColor.value.getHex() : 0x87CEEB,
        hazeIntensity: backgroundSphere && backgroundSphere.material.uniforms ? 
                backgroundSphere.material.uniforms.hazeIntensity.value : 0.7,
        hazeStart: backgroundSphere && backgroundSphere.material.uniforms ? 
                backgroundSphere.material.uniforms.hazeStart.value : 0.2,
        hazeEnd: backgroundSphere && backgroundSphere.material.uniforms ? 
                backgroundSphere.material.uniforms.hazeEnd.value : 0.8
    };
}

/**
 * Rotate the background sphere by the specified amounts (in radians)
 * @param {number} x - Rotation amount around X axis
 * @param {number} y - Rotation amount around Y axis
 * @param {number} z - Rotation amount around Z axis
 */
export function rotateBackgroundSphere(x = 0, y = 0, z = 0) {
    if (!backgroundSphere) {
        console.warn("Cannot rotate backgroundSphere: sphere not created yet");
        return;
    }
    
    // Get current rotation
    const currentRotation = backgroundSphere.userData.rotation || backgroundSphereConfig.rotation;
    
    // Calculate new rotation by adding the provided values
    const newRotation = {
        x: currentRotation.x + x,
        y: currentRotation.y + y,
        z: currentRotation.z + z
    };
    
    // Update the sphere with the new rotation
    updateBackgroundSphere({ rotation: newRotation });
    
    console.log(`Rotated backgroundSphere to: (${
        newRotation.x.toFixed(2)}, ${
        newRotation.y.toFixed(2)}, ${
        newRotation.z.toFixed(2)})`
    );
}

function initSpacecraft() {
 const spacecraftComponents = createSpacecraft(scene);
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;
    
    // Expose the toggleView function for cockpit view
    spacecraft.toggleView = spacecraftComponents.toggleView;
    
    // Store the isFirstPersonView state for camera logic
    spacecraft.isFirstPersonView = function() {
        // Add a direct reference to the spacecraftComponents object
        return this._spacecraftComponents ? this._spacecraftComponents.isFirstPersonView : false;
    };
    
    // Store a direct reference to the spacecraftComponents
    spacecraft._spacecraftComponents = spacecraftComponents;

    spacecraft.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

 // Verify reticle creation
 if (spacecraftComponents.reticle) {
   console.log("Reticle was successfully created with spacecraft in washington3D.js");
 } else {
   console.warn("Reticle not found in spacecraft components");
 }

 // Set initial position of craft above Mount Rainier
 const mtRainierLat = 46.8529;
 const mtRainierLon = -121.7604;
 const initialHeight = 5000;
 const position = latLonHeightToEcef(mtRainierLat, mtRainierLon, initialHeight);
    spacecraft.position.copy(position);

 spacecraft.quaternion.setFromEuler(new THREE.Euler(
 THREE.MathUtils.degToRad(-20),
 THREE.MathUtils.degToRad(75),
 THREE.MathUtils.degToRad(150),
 'XYZ'
 ));

 cameraTarget = new THREE.Object3D();
 spacecraft.add(cameraTarget);
 cameraTarget.position.set(0, 0, 0);

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
    
    // Create the planet at the initial spacecraft position
    planet = createPlanet(scene, spacecraft.position.clone(), spacecraft.quaternion.clone());
    console.log("Created planet for Washington scene");
}

/**
 * Resets the spacecraft to its initial position over Washington DC
 */
export function resetWashingtonPosition() {
    if (!spacecraft) {
        console.warn("Cannot reset position: spacecraft not initialized");
        return;
    }

    console.log("Resetting spacecraft position to Mount Rainier starting point");
    
    // Set initial position of craft above Mount Rainier
    const mtRainierLat = 46.8529;
    const mtRainierLon = -121.7604;
    const initialHeight = 5000;
    const position = latLonHeightToEcef(mtRainierLat, mtRainierLon, initialHeight);
    spacecraft.position.copy(position);

    // Reset orientation
    spacecraft.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(-20),
        THREE.MathUtils.degToRad(75),
        THREE.MathUtils.degToRad(150),
        'XYZ'
    ));
    
    // Remove previous planet if it exists
    if (planet && scene) {
        scene.remove(planet);
    }
    
    // Create a new planet at the reset position
    planet = createPlanet(scene, spacecraft.position.clone(), spacecraft.quaternion.clone());
    console.log("Recreated planet after position reset");
}

/**
 * Generic reset position function - calls the Washington-specific function
 * This allows for consistent naming across different scene files
 */
export function resetPosition() {
    resetWashingtonPosition();
}

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

// Convert lat/lon/height to ECEF coordinates for Earth
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

function checkCollisionInDirection(direction, terrainMeshes) {
    if (!spacecraft || !terrainMeshes || terrainMeshes.length === 0) return null;
    
    const rayDirection = direction.clone().normalize();
    raycaster.set(spacecraft.position, rayDirection);
    raycaster.near = 0;
    raycaster.far = spacecraftBoundingSphere.radius * 2;
    
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
    spacecraftBoundingSphere.radius = 2;

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
        const directions = [
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ];
        
        directions.forEach(dir => dir.applyQuaternion(spacecraft.quaternion));
        
        for (const direction of directions) {
            const intersection = checkCollisionInDirection(direction, terrainMeshes);
            if (intersection && intersection.distance) {
                const distanceToSurface = intersection.distance;
                
                if (distanceToSurface < spacecraftBoundingSphere.radius) {
                    let normal = intersection.normal || 
                        (intersection.point ? new THREE.Vector3().subVectors(intersection.point, new THREE.Vector3(0, 0, 0)).normalize() : 
                        direction.clone().negate().normalize());
                    
                    const pushFactor = 1.1;
                    collisionOffset.copy(normal).multiplyScalar((spacecraftBoundingSphere.radius - distanceToSurface) * pushFactor);
                    spacecraft.position.add(collisionOffset);
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

export function updateMovement() {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Set speed based on movement mode
    if (keys.up) {
        currentSpeed = boostSpeed;
    } else if (keys.down) {
        currentSpeed = slowSpeed;
    } else {
        currentSpeed = baseSpeed;
    }
    
    // Update engine effects based on movement mode
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(keys.up, keys.down);
    }

    // Handle wing animation for boost mode and potential hyperspace
    // Check for isHyperspace in the global window object as a fallback
    const isInHyperspace = window.isHyperspace || false;
    
    if ((keys.up || isInHyperspace) && wingsOpen) {
        console.log(`Washington: Closing wings due to ${isInHyperspace ? 'hyperspace' : 'boost'} mode`);
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !isInHyperspace && !wingsOpen) {
        console.log('Washington: Opening wings for normal flight');
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed * pitchSensitivity);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed * pitchSensitivity);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed * rollSensitivity);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed * rollSensitivity);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed * yawSensitivity);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed * yawSensitivity);

    const combinedRotation = new THREE.Quaternion()
        .copy(rotation.roll)
        .multiply(rotation.pitch)
        .multiply(rotation.yaw);

    spacecraft.quaternion.multiply(combinedRotation);

    const originalPosition = spacecraft.position.clone();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.quaternion);

    if (tiles && tiles.group && tiles.group.children.length > 0) {
        try {
            const terrainMeshes = [];
            tiles.group.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    terrainMeshes.push(object);
                }
            });
            
            if (terrainMeshes.length > 0) {
                const downDirection = new THREE.Vector3(0, -1, 0);
                raycaster.set(spacecraft.position, downDirection);
                raycaster.near = 0;
                raycaster.far = 1000;
                
                const groundHits = raycaster.intersectObjects(terrainMeshes, false);
                if (groundHits.length > 0) {
                    const groundDistance = groundHits[0].distance;
                    let groundNormal = groundHits[0].normal || 
                        (groundHits[0].point ? new THREE.Vector3().subVectors(groundHits[0].point, new THREE.Vector3(0, 0, 0)).normalize() : null);
                    
                    if (groundNormal) {
                        const upVector = new THREE.Vector3(0, 1, 0);
                        const slopeAngle = Math.acos(groundNormal.dot(upVector)) * (180 / Math.PI);
                        if (slopeAngle > MAX_SLOPE_ANGLE) {
                            const rightVector = new THREE.Vector3().crossVectors(forward, upVector).normalize();
                            const adjustedForward = new THREE.Vector3().crossVectors(rightVector, groundNormal).normalize();
                            forward.lerp(adjustedForward, 0.5);
                        }
                    }
                    
                    if (groundDistance < HOVER_HEIGHT) {
                        spacecraft.position.y += (HOVER_HEIGHT - groundDistance) * 0.1;
                    } else if (groundDistance > HOVER_HEIGHT * 2) {
                        spacecraft.position.y -= (groundDistance - HOVER_HEIGHT) * 0.01;
                    }
                }
            }
        } catch (error) {
            console.error("Error in hover adjustment:", error);
        }
    }
    
    spacecraft.position.add(forward.multiplyScalar(currentSpeed));

    try {
        // Check for collisions with the base plane
        if (checkBasePlaneCollision()) {
            console.log("Collision with base plane detected and resolved");
        }
        
        // Check for collisions with terrain
        if (tiles && tiles.group && tiles.group.children.length > 0) {
            if (checkTerrainCollision()) {
                console.log("Collision detected and resolved");
                targetCameraOffset = collisionCameraOffset.clone();
                
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, reverting to original position");
                    spacecraft.position.copy(originalPosition);
                }
            } else {
                if (keys.up) {
                    targetCameraOffset = boostCameraOffset.clone();
                } else {
                    targetCameraOffset = baseCameraOffset.clone();
                }
            }
        }
    } catch (error) {
        console.error("Error during collision detection:", error);
        spacecraft.position.copy(originalPosition);
    }

    if (wingAnimation > 0 && topRightWing && bottomRightWing && topLeftWing && bottomLeftWing) {
        // Calculate progress percentage for animation smoothing (1.0 = start, 0.0 = end)
        const progress = wingAnimation / wingTransitionFrames;
        
        // Use easing function for smoother animation (ease in/out)
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        
        // Log animation progress occasionally
        if (wingAnimation % 10 === 0) {
            console.log(`Washington wing animation: ${Math.round(progress * 100)}% complete, ${wingsOpen ? 'opening' : 'closing'}`);
        }
        
        // Define the angles for open and closed positions
        const openAngle = Math.PI / 8;
        const closedAngle = 0;
        
        if (wingsOpen) {
            // Animating to open position (X shape)
            // Right wings
            topRightWing.rotation.z = THREE.MathUtils.lerp(closedAngle, -openAngle, easedProgress);
            bottomRightWing.rotation.z = THREE.MathUtils.lerp(closedAngle, openAngle, easedProgress);
            
            // Left wings
            topLeftWing.rotation.z = THREE.MathUtils.lerp(Math.PI, Math.PI + openAngle, easedProgress);
            bottomLeftWing.rotation.z = THREE.MathUtils.lerp(Math.PI, Math.PI - openAngle, easedProgress);
        } else {
            // Animating to closed position (flat)
            // Right wings
            topRightWing.rotation.z = THREE.MathUtils.lerp(-openAngle, closedAngle, easedProgress);
            bottomRightWing.rotation.z = THREE.MathUtils.lerp(openAngle, closedAngle, easedProgress);
            
            // Left wings
            topLeftWing.rotation.z = THREE.MathUtils.lerp(Math.PI + openAngle, Math.PI, easedProgress);
            bottomLeftWing.rotation.z = THREE.MathUtils.lerp(Math.PI - openAngle, Math.PI, easedProgress);
        }
        
        wingAnimation--;
    }
}

export function updateCamera() {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Check if we're in first-person view
    const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? spacecraft.isFirstPersonView() : false;

    // For washington3D we'll use a simpler camera approach without the updateTargetOffsets
    // since the washingtonCamera isn't exported from camera.js
    let localOffset;
    
    if (keys.up) {
        localOffset = isFirstPerson ? washingtonCockpitCamera.boost.clone() : washingtonCamera.boost.clone();
    } else if (keys.down) {
        localOffset = isFirstPerson ? washingtonCockpitCamera.slow.clone() : washingtonCamera.slow.clone();
    } else {
        localOffset = isFirstPerson ? washingtonCockpitCamera.base.clone() : washingtonCamera.base.clone();
    }
    
    const cameraPosition = localOffset.applyMatrix4(spacecraft.matrixWorld);

    camera.position.lerp(cameraPosition, smoothFactor);
    camera.quaternion.copy(spacecraft.quaternion);

    // Apply 180-degree rotation to look forward
    const adjustment = createForwardRotation();
    camera.quaternion.multiply(adjustment);
}

let updateEngineEffects;

function setupTiles() {
    tiles.fetchOptions.mode = 'cors';
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath('./draco/')
    }));
    
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
        console.log("Loaded Washington DC model with shadow settings");
    };
    
    scene.add(tiles.group);
}

// Add a new function to create fixed coordinate system - values found empirically / trial and error
function createBasePlane() {
    console.log("Creating fixed coordinate system for Washington");
  
    if (window.gridCoordinateSystem) {
      scene.remove(window.gridCoordinateSystem);
    }
  
    const gridPlaneSystem = new THREE.Group();
    window.gridCoordinateSystem = gridPlaneSystem;
  
    // Adjusted for Washington DC
    const fixedPosition = new THREE.Vector3(-1282726.44, -4870561.48, 3855700.32);
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
    
    // No mountain border in Washington version
  
    scene.add(gridPlaneSystem);
  
    console.log("Fixed coordinate system created with plane at position:", basePlaneConfig.position, "and rotation:", basePlaneConfig.rotation);
}

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
        console.log('Washington DC bounding sphere center:', sphere.center);
        console.log('Washington DC bounding sphere radius:', sphere.radius);
        console.log('Washington DC tileset loaded successfully');
        
        // Call alignGridToTerrain immediately without timeout
        alignGridToTerrain();
    });
    tiles.addEventListener('error', (error) => {
        console.error('Tileset loading error:', error);
    });

    setupTiles();
}

function initControls() {
    document.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'w': keys.w = true; break;
            case 's': keys.s = true; break;
            case 'a': keys.a = true; break;
            case 'd': keys.d = true; break;
            case 'ArrowLeft': keys.left = true; break;
            case 'ArrowRight': keys.right = true; break;
            case 'ArrowUp': keys.up = true; break;
            case 'ArrowDown': keys.down = true; break;
            case ' ': keys.space = true; break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.key) {
            case 'w': keys.w = false; break;
            case 's': keys.s = false; break;
            case 'a': keys.a = false; break;
            case 'd': keys.d = false; break;
            case 'ArrowLeft': keys.left = false; break;
            case 'ArrowRight': keys.right = false; break;
            case 'ArrowUp': keys.up = false; break;
            case 'ArrowDown': keys.down = false; break;
            case ' ': keys.space = false; break;
        }
    });
}

function setupWashingtonLighting() {
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    // Create a stronger ambient light for more even lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased for more even illumination
    scene.add(ambientLight);
 
    // Create a more focused and less intense directional light for the sun
    washingtonSun = new THREE.DirectionalLight(0xffffff, 3); // Reduced for better balance
 
    // Define the light source position using lat, lon, and height
    const sunLat = 46.8529; // Mount Rainier latitude
    const sunLon = -121.7604; // Mount Rainier longitude
    const sunHeight = 100000; // High altitude to simulate sunlight from above
    const sunPosition = latLonHeightToEcef(sunLat, sunLon, sunHeight);
    washingtonSun.position.copy(sunPosition);
 
    washingtonSun.castShadow = true;
 
    washingtonSun.shadow.mapSize.width = 4096;
    washingtonSun.shadow.mapSize.height = 4096;
    washingtonSun.shadow.camera.near = 1000;
    washingtonSun.shadow.camera.far = 200000;
    const shadowSize = 20000;
    washingtonSun.shadow.camera.left = -shadowSize;
    washingtonSun.shadow.camera.right = shadowSize;
    washingtonSun.shadow.camera.top = shadowSize;
    washingtonSun.shadow.camera.bottom = -shadowSize;
    washingtonSun.shadow.bias = -0.00002;
    washingtonSun.shadow.normalBias = 0.005;
 
    // Set the target at Washington's ground level
    const targetLat = 38.8895;
    const targetLon = -77.0352;
    const targetHeight = 0; // Ground level
    const targetPosition = latLonHeightToEcef(targetLat, targetLon, targetHeight);
    const target = new THREE.Object3D();
    target.position.copy(targetPosition);
    scene.add(target);
    washingtonSun.target = target;
 
    scene.add(washingtonSun);
 
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
    playerSun = new THREE.DirectionalLight(playerSunConfig.color, playerSunConfig.intensity);
    playerSun.castShadow = true;
    
    // Configure shadows for better quality
    playerSun.shadow.mapSize.width = 2048;
    playerSun.shadow.mapSize.height = 2048;
    playerSun.shadow.camera.near = 0.5;
    playerSun.shadow.camera.far = 50000;
    playerSun.shadow.camera.left = -3000;
    playerSun.shadow.camera.right = 3000;
    playerSun.shadow.camera.top = 3000;
    playerSun.shadow.camera.bottom = -3000;
    playerSun.shadow.bias = -0.0001;
    
    // Position the sun using global coordinates
    const playerSunPosition = latLonHeightToEcef(
        playerSunConfig.position.lat,
        playerSunConfig.position.lon,
        playerSunConfig.position.height
    );
    playerSun.position.copy(playerSunPosition);
    
    // Create a target object for the player sun
    playerSunTarget = new THREE.Object3D();
    scene.add(playerSunTarget);
    playerSun.target = playerSunTarget;
    
    // Add the player sun to the scene
    scene.add(playerSun);
    
    console.log(`Sun initialized at global coordinates: lat ${playerSunConfig.position.lat}, lon ${playerSunConfig.position.lon}, height ${playerSunConfig.position.height}`);
}

export function init() {
    console.log("Washington DC 3D initialization started");
 
    if (washingtonInitialized) {
        console.log("Already initialized, skipping");
        return { scene: scene, camera: camera, renderer: renderer, tiles: tiles };
    }

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
    renderer.setClearColor(0x87ceeb); // Set background to blue
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8; // Reduced from 1.2 for darker space
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.gammaFactor = 2.2;
 
    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);
 
    textureLoader = new THREE.TextureLoader();
    setupWashingtonLighting();
    initSpacecraft();
    
    reinstantiateTiles();


    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
    initControls();

    washingtonInitialized = true;
    console.log("Washington DC 3D initialization complete");
    
    return { 
        scene: scene, 
        camera: camera, 
        renderer: renderer, 
        tiles: tiles 
    };
}

export function update(deltaTime = 0.016) {
    try {
        if (!washingtonInitialized) {
            console.log("Not initialized yet");
            return false;
        }

        if (!tiles) {
            return false;
        }

        updateMovement();
        updateCamera();
        
        // Handle laser firing with spacebar
        if (keys.space && spacecraft) {
            fireLaser(spacecraft, scene, 'washington', keys.up, keys.down);
        }
 
        // Update all active lasers
        updateLasers(deltaTime);
 
        // Update reticle position if available
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            // Pass both boost and slow states to the reticle update function
            spacecraft.userData.updateReticle(keys.up, keys.down);
        } else {
            // Only log this warning once to avoid console spam
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
        
        updateWashingtonLighting();

        // Death Star is completely fixed in space
 
        if (!camera) {
            console.warn("Camera not initialized");
            return false;
        }

        tiles.setCamera(camera);
        tiles.setResolutionFromRenderer(camera, renderer);
        camera.updateMatrixWorld();
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

function updateWashingtonLighting() {
    if (!washingtonSun || !spacecraft) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    washingtonSun.position.set(
        spacecraftPosition.x,
        spacecraftPosition.y + 100000,
        spacecraftPosition.z
    );
    
    if (washingtonSun.target) {
        washingtonSun.target.position.copy(spacecraftPosition);
        washingtonSun.target.updateMatrixWorld();
    }
    
    // Update the player sun based on config
    if (playerSun && playerSunTarget) {
        if (playerSunConfig.fixedPosition) {
            // For fixed position, use the global lat/lon coordinates to position the sun
            // Only update if we need to maintain the position in global space
            const playerSunPosition = latLonHeightToEcef(
                playerSunConfig.position.lat,
                playerSunConfig.position.lon,
                playerSunConfig.position.height
            );
            playerSun.position.copy(playerSunPosition);
            
            // Point the sun at the player's position
            playerSunTarget.position.copy(spacecraftPosition);
            playerSunTarget.position.add(new THREE.Vector3(
                playerSunConfig.targetOffset.x,
                playerSunConfig.targetOffset.y,
                playerSunConfig.targetOffset.z
            ));
        } else {
            // If following player, position the sun above the player's local up direction
            const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion);
            playerUp.normalize().multiplyScalar(playerSunConfig.position.height);
            
            // Set the sun position relative to the player
            playerSun.position.copy(spacecraftPosition).add(playerUp);
            
            // Set the target to the player's position
            playerSunTarget.position.copy(spacecraftPosition);
        }
        
        playerSunTarget.updateMatrixWorld();
        playerSun.target = playerSunTarget;
        playerSun.updateMatrixWorld(true);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// Add a function to check collision with base plane
function checkBasePlaneCollision() {
    if (!spacecraft || !basePlane || !window.gridCoordinateSystem) return false;

    // Get the world position of the spacecraft
    const spacecraftWorldPosition = spacecraft.getWorldPosition(new THREE.Vector3());

    // Get the plane's world position and quaternion
    const planeWorldPosition = new THREE.Vector3();
    basePlane.getWorldPosition(planeWorldPosition);
    const planeQuaternion = window.gridCoordinateSystem.quaternion;

    // Get the plane's normal (Z-axis of the grid system, pointing "up" in local space)
    const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQuaternion);

    // Define collision thresholds
    const planeCollisionThreshold = 2;

    // --- Plane Collision (prevent passing through the base plane) ---
    const raycasterPlane = new THREE.Raycaster();
    raycasterPlane.set(spacecraftWorldPosition, planeNormal.clone().negate()); // Ray downward
    const planeIntersects = raycasterPlane.intersectObject(basePlane);

    if (planeIntersects.length > 0 && planeIntersects[0].distance < planeCollisionThreshold) {
        const pushDistance = planeCollisionThreshold - planeIntersects[0].distance;
        const pushDirection = planeNormal.clone(); // Push upward
        spacecraft.position.add(pushDirection.multiplyScalar(pushDistance));
        console.log("Collision detected with base plane, pushing upward");
        return true;
    }

    return false;
}

// Add these functions to export so they can be called from other files or the console

/**
 * Set the position of the player sun using lat/lon coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} height - Height above sea level in meters (optional)
 */
export function setPlayerSunPosition(lat, lon, height = null) {
    playerSunConfig.position.lat = lat;
    playerSunConfig.position.lon = lon;
    
    if (height !== null && height > 0) {
        playerSunConfig.position.height = height;
    }
    
    console.log(`Player sun position set to lat: ${lat}, lon: ${lon}, height: ${playerSunConfig.position.height}`);
    
    // Update the sun position immediately if it exists
    if (playerSun) {
        const playerSunPosition = latLonHeightToEcef(
            playerSunConfig.position.lat,
            playerSunConfig.position.lon,
            playerSunConfig.position.height
        );
        playerSun.position.copy(playerSunPosition);
        playerSun.updateMatrixWorld(true);
    }
}

/**
 * Set the height of the player sun above sea level
 * @param {number} height - Height in meters above sea level
 */
export function setPlayerSunHeight(height) {
    if (height > 0) {
        playerSunConfig.position.height = height;
        console.log(`Player sun height set to ${height} meters`);
        
        // Update the sun position immediately if it exists
        if (playerSun) {
            const playerSunPosition = latLonHeightToEcef(
                playerSunConfig.position.lat,
                playerSunConfig.position.lon,
                playerSunConfig.position.height
            );
            playerSun.position.copy(playerSunPosition);
            playerSun.updateMatrixWorld(true);
        }
    } else {
        console.warn("Player sun height must be greater than 0");
    }
}

/**
 * Set the intensity of the player sun
 * @param {number} intensity - Light intensity (recommended range: 0-20)
 */
export function setPlayerSunIntensity(intensity) {
    if (intensity >= 0) {
        playerSunConfig.intensity = intensity;
        if (playerSun) {
            playerSun.intensity = intensity;
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
export function setPlayerSunColor(color) {
    playerSunConfig.color = color;
    if (playerSun) {
        playerSun.color.set(color);
    }
    console.log(`Player sun color set to 0x${color.toString(16)}`);
}

/**
 * Get the current player sun configuration
 * @returns {Object} The current player sun configuration
 */
export function getPlayerSunConfig() {
    return { ...playerSunConfig };
}

/**
 * Set whether the sun should be fixed in world space or follow the player
 * @param {boolean} fixed - Whether the sun stays in a fixed position (true) or follows the player (false)
 */
export function setPlayerSunFixed(fixed) {
    playerSunConfig.fixedPosition = fixed;
    
    // Update the sun position immediately if it exists
    if (playerSun && spacecraft) {
        if (fixed) {
            // When switching to fixed, update the global position
            const playerSunPosition = latLonHeightToEcef(
                playerSunConfig.position.lat,
                playerSunConfig.position.lon,
                playerSunConfig.position.height
            );
            playerSun.position.copy(playerSunPosition);
        } else {
            // When switching to player-relative, update the local position
            const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.quaternion);
            playerUp.normalize().multiplyScalar(playerSunConfig.position.height);
            playerSun.position.copy(spacecraft.position).add(playerUp);
        }
        playerSun.updateMatrixWorld(true);
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
export function setPlayerSunTargetOffset(x = 0, y = 0, z = 0) {
    playerSunConfig.targetOffset.x = x;
    playerSunConfig.targetOffset.y = y;
    playerSunConfig.targetOffset.z = z;
    
    console.log(`Player sun target offset set to (${x}, ${y}, ${z})`);
}

/**
 * Update the haze effect on the background sphere
 * @param {Object} options - Haze properties to update
 * @param {number} options.hazeColor - Color of the haze in hex format (e.g., 0x87CEEB for sky blue)
 * @param {number} options.hazeIntensity - Intensity of the haze effect (0.0 to 1.0)
 * @param {number} options.hazeStart - Where the haze begins from top to bottom (0.0 to 1.0)
 * @param {number} options.hazeEnd - Where the haze is fully opaque (0.0 to 1.0)
 */
export function updateBackgroundHaze(options = {}) {
    if (!backgroundSphere || !backgroundSphere.material || !backgroundSphere.material.uniforms) {
        console.warn("Cannot update background haze: sphere not created or doesn't have shader material");
        return;
    }
    
    if (options.hazeColor !== undefined) {
        backgroundSphere.material.uniforms.hazeColor.value.set(options.hazeColor);
        console.log(`Updated background haze color to: 0x${options.hazeColor.toString(16)}`);
    }
    
    if (options.hazeIntensity !== undefined) {
        backgroundSphere.material.uniforms.hazeIntensity.value = options.hazeIntensity;
        console.log(`Updated background haze intensity to: ${options.hazeIntensity}`);
    }
    
    if (options.hazeStart !== undefined) {
        backgroundSphere.material.uniforms.hazeStart.value = options.hazeStart;
        console.log(`Updated background haze start position to: ${options.hazeStart}`);
    }
    
    if (options.hazeEnd !== undefined) {
        backgroundSphere.material.uniforms.hazeEnd.value = options.hazeEnd;
        console.log(`Updated background haze end position to: ${options.hazeEnd}`);
    }
    
    backgroundSphere.material.needsUpdate = true;
}

/**
 * Update the position of the background sphere using polar coordinates
 * @param {Object} options - Position options to update
 * @param {number} options.elevationAngle - Elevation angle above/below horizon in degrees
 * @param {number} options.azimuthAngle - Azimuth angle around horizon in degrees
 * @param {number} options.distance - Distance from player's starting point
 */
export function updateBackgroundPosition(options = {}) {
    if (!backgroundSphere) {
        console.warn("Cannot update background position: sphere not created yet");
        return;
    }
    
    let needsUpdate = false;
    
    // Store current values to check if they need updating
    const currentValues = {
        elevationAngle: backgroundSphere.userData.elevationAngle,
        azimuthAngle: backgroundSphere.userData.azimuthAngle,
        distance: backgroundSphere.userData.distance
    };
    
    // Check if any values have changed
    if (options.elevationAngle !== undefined && options.elevationAngle !== currentValues.elevationAngle) {
        currentValues.elevationAngle = options.elevationAngle;
        backgroundSphere.userData.elevationAngle = options.elevationAngle;
        needsUpdate = true;
    }
    
    if (options.azimuthAngle !== undefined && options.azimuthAngle !== currentValues.azimuthAngle) {
        currentValues.azimuthAngle = options.azimuthAngle;
        backgroundSphere.userData.azimuthAngle = options.azimuthAngle;
        needsUpdate = true;
    }
    
    if (options.distance !== undefined && options.distance !== currentValues.distance) {
        currentValues.distance = options.distance;
        backgroundSphere.userData.distance = options.distance;
        needsUpdate = true;
    }
    
    // If any values have changed, recreate the sphere with the new position
    if (needsUpdate) {
        console.log(`Updating background sphere position: elevation=${currentValues.elevationAngle}°, azimuth=${currentValues.azimuthAngle}°, distance=${currentValues.distance}`);
        
        // Use the updateBackgroundSphere function to update the position
        updateBackgroundSphere({
            elevationAngle: currentValues.elevationAngle,
            azimuthAngle: currentValues.azimuthAngle,
            distance: currentValues.distance
        });
    }
}

/**
 * Set the background sphere's offset from its calculated position
 * @param {number} x - X offset (left/right)
 * @param {number} y - Y offset (up/down)
 * @param {number} z - Z offset (forward/backward)
 */
export function setBackgroundOffset(x = 0, y = 0, z = 0) {
    if (!backgroundSphere) {
        console.warn("Cannot update background offset: sphere not created yet");
        return;
    }
    
    const currentOffset = backgroundSphere.userData.offset || { x: 0, y: 0, z: 0 };
    const newOffset = {
        x: x !== undefined ? x : currentOffset.x,
        y: y !== undefined ? y : currentOffset.y,
        z: z !== undefined ? z : currentOffset.z
    };
    
    // Check if offset has changed
    if (newOffset.x !== currentOffset.x || newOffset.y !== currentOffset.y || newOffset.z !== currentOffset.z) {
        backgroundSphere.userData.offset = newOffset;
        console.log(`Updated background sphere offset to (${newOffset.x}, ${newOffset.y}, ${newOffset.z})`);
        
        // Recreate the sphere with the new offset
        updateBackgroundSphere({ offset: newOffset });
    }
}

/**
 * Creates a planet in the scene using the planetConfig settings
 * @param {THREE.Scene} scene - The scene to add the planet to
 * @param {THREE.Vector3} playerPosition - The position of the player
 * @param {THREE.Quaternion} playerRotation - The rotation of the player
 * @returns {THREE.Mesh} The created planet mesh
 */
function createPlanet(scene, playerPosition, playerRotation) {
    // Create the sphere geometry
    const geometry = new THREE.SphereGeometry(planetConfig.radius, 32, 32);
    
    // Create shader material for haze effect at bottom of planet
    const material = new THREE.ShaderMaterial({
        uniforms: {
            planetTexture: { value: null },
            hazeColor: { value: new THREE.Color(planetConfig.hazeColor) },
            hazeIntensity: { value: planetConfig.hazeIntensity },
            hazeStart: { value: planetConfig.hazeStart },
            hazeEnd: { value: planetConfig.hazeEnd }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D planetTexture;
            uniform vec3 hazeColor;
            uniform float hazeIntensity;
            uniform float hazeStart;
            uniform float hazeEnd;
            
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vec4 texColor = texture2D(planetTexture, vUv);
                
                // Calculate normalized height for haze gradient
                float normalizedY = vPosition.y / length(vPosition);
                normalizedY = (normalizedY + 1.0) / 2.0;
                
                // Calculate haze factor
                float hazeFactor = 0.0;
                if (normalizedY < hazeEnd) {
                    if (normalizedY < hazeStart) {
                        hazeFactor = hazeIntensity;
                    } else {
                        hazeFactor = hazeIntensity * (1.0 - (normalizedY - hazeStart) / (hazeEnd - hazeStart));
                    }
                }
                
                // Mix texture with haze
                gl_FragColor = mix(texColor, vec4(hazeColor, texColor.a), hazeFactor);
            }
        `,
        side: THREE.BackSide,
        transparent: true
    });
    
    // Create the planet mesh
    const planetMesh = new THREE.Mesh(geometry, material);
    planetMesh.name = "planet";
    planetMesh.receiveShadow = false;
    planetMesh.castShadow = false;
    
    // Calculate position using polar coordinates
    const elevationRad = THREE.MathUtils.degToRad(planetConfig.elevation);
    const azimuthRad = THREE.MathUtils.degToRad(planetConfig.azimuth);
    
    // Convert polar to cartesian
    const directionVector = new THREE.Vector3(
        planetConfig.distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
        planetConfig.distance * Math.sin(elevationRad),
        planetConfig.distance * Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    
    // Apply player rotation to direction vector
    directionVector.applyQuaternion(playerRotation);
    
    // Set position relative to player
    planetMesh.position.copy(playerPosition).add(directionVector);
    
    // Apply planet's self-rotation
    const rotationEuler = new THREE.Euler(
        planetConfig.rotation.x,
        planetConfig.rotation.y,
        planetConfig.rotation.z,
        'XYZ'
    );
    planetMesh.setRotationFromEuler(rotationEuler);
    
    // Add to scene
    scene.add(planetMesh);
    
    // Load texture
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    textureLoader.load(
        'skybox/2k_neptune.jpg',
        function(texture) {
            // Apply texture when loaded
            planetMesh.material.uniforms.planetTexture.value = texture;
            planetMesh.material.needsUpdate = true;
            console.log('Planet texture applied with blue haze effect');
        },
        undefined,
        function(err) {
            console.error('Error loading planet texture:', err);
            // Fallback to alternative texture
            textureLoader.load(
                './skybox/planet1.webp',
                function(texture) {
                    planetMesh.material.uniforms.planetTexture.value = texture;
                    planetMesh.material.needsUpdate = true;
                    console.log('Alternative planet texture applied with blue haze effect');
                },
                undefined,
                function(err2) {
                    console.error('Error loading alternative planet texture:', err2);
                }
            );
        }
    );
    
    console.log(`Created planet with radius=${planetConfig.radius}, distance=${planetConfig.distance}, elevation=${planetConfig.elevation}°, azimuth=${planetConfig.azimuth}°`);
    
    return planetMesh;
}

/**
 * Updates the planet with new configuration and recreates it if necessary
 * @param {Object} newConfig - New planet configuration options
 */
export function updatePlanet(newConfig = {}) {
    // Update configuration parameters
    if (newConfig.radius !== undefined) planetConfig.radius = newConfig.radius;
    if (newConfig.distance !== undefined) planetConfig.distance = newConfig.distance;
    if (newConfig.elevation !== undefined) planetConfig.elevation = newConfig.elevation;
    if (newConfig.azimuth !== undefined) planetConfig.azimuth = newConfig.azimuth;
    
    // Update rotation
    if (newConfig.rotation) {
        if (newConfig.rotation.x !== undefined) planetConfig.rotation.x = newConfig.rotation.x;
        if (newConfig.rotation.y !== undefined) planetConfig.rotation.y = newConfig.rotation.y;
        if (newConfig.rotation.z !== undefined) planetConfig.rotation.z = newConfig.rotation.z;
    }
    
    // Update haze effect
    if (newConfig.hazeColor !== undefined) planetConfig.hazeColor = newConfig.hazeColor;
    if (newConfig.hazeIntensity !== undefined) planetConfig.hazeIntensity = newConfig.hazeIntensity;
    if (newConfig.hazeStart !== undefined) planetConfig.hazeStart = newConfig.hazeStart;
    if (newConfig.hazeEnd !== undefined) planetConfig.hazeEnd = newConfig.hazeEnd;
    
    // If planet exists, remove it and create a new one
    if (planet && scene) {
        // Save current texture if it exists
        const currentTexture = planet.material && planet.material.uniforms && 
                              planet.material.uniforms.planetTexture ? 
                              planet.material.uniforms.planetTexture.value : null;
        
        // Remove current planet
        scene.remove(planet);
        
        // Create new planet at current spacecraft position
        planet = createPlanet(scene, spacecraft.position.clone(), spacecraft.quaternion.clone());
        
        // Reapply texture if available
        if (currentTexture && planet.material && planet.material.uniforms) {
            planet.material.uniforms.planetTexture.value = currentTexture;
            planet.material.needsUpdate = true;
        }
        
        console.log("Planet updated with new configuration");
    } else {
        console.warn("Cannot update planet: not created yet");
    }
}

/**
 * Rotate the planet around its own axes
 * @param {number} x - Rotation amount (radians) around X axis
 * @param {number} y - Rotation amount (radians) around Y axis
 * @param {number} z - Rotation amount (radians) around Z axis
 */
export function rotatePlanet(x = 0, y = 0, z = 0) {
    // Update rotation in config
    planetConfig.rotation.x += x;
    planetConfig.rotation.y += y;
    planetConfig.rotation.z += z;
    
    // Apply rotation to planet if it exists
    if (planet) {
        planet.rotation.x = planetConfig.rotation.x;
        planet.rotation.y = planetConfig.rotation.y;
        planet.rotation.z = planetConfig.rotation.z;
        console.log(`Planet rotated to (${planetConfig.rotation.x.toFixed(2)}, ${planetConfig.rotation.y.toFixed(2)}, ${planetConfig.rotation.z.toFixed(2)})`);
    } else {
        console.warn("Cannot rotate planet: not created yet");
    }
}

/**
 * Returns a copy of the current planet configuration
 * @returns {Object} The current planet configuration
 */
export function getPlanetConfig() {
    return { ...planetConfig };
}

