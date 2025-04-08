import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createSpacecraft } from '../spacecraft.js';
import { 
    washingtonCamera,
    washingtonCockpitCamera,
    createCameraState,
    updateTargetOffsets,
    updateCameraOffsets,
    createForwardRotation,
} from '../camera.js';
// Import Cesium rate limiting utilities
import { configureCesiumRequestScheduler, optimizeTerrainLoading } from '../cesiumRateLimit.js';
// Import the config
import config from '../config.js';
// Import loading managers at the top of the file
import { loadingManager, textureLoadingManager } from '../loaders.js';

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
let referenceSphere; // Reference sphere object

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
 referenceSphere, // Export reference sphere for other modules
};

// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;

// Movement settings
const baseSpeed = 5;
const boostSpeed = baseSpeed * 5;
const slowSpeed = baseSpeed * 0.5; // Half of base speed
let currentSpeed = baseSpeed;

// Turn speed variables for Washington mountains environment
const baseTurnSpeed = 0.03;     // Regular turn speed
const slowTurnSpeed = 0.03;     // More sensitive turning when moving slowly (urban precision)
const boostTurnSpeed = 0.025;   // Much less sensitive turning when boosting (stability at high speed)
let currentTurnSpeed = baseTurnSpeed; // Current active turn speed

// Add sensitivity multipliers for each rotation axis
const pitchSensitivity = 0.6; // Lower value = less sensitive
const rollSensitivity = 1;  // Lower value = less sensitive
const yawSensitivity = 0.5;   // Lower value = less sensitive
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false, down: false, space: false };

// Camera settings are now imported from camera.js

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Sun objects and materials
let washingtonSun, sunGroup, sunMesh, sunHalo, sunFlare;
let playerSun, playerSunTarget; // Add new variables for player sun
let textureLoader = new THREE.TextureLoader(textureLoadingManager);

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

// Distant Earth image configuration
const sphereConfig = {
    distance: 200000,         // Distance in front of player
    radius: 80000,            // Size in radius
    rotation: {              // Rotation angles in degrees
        x: 0,
        y: 0,
        z: 180
    },
    polar: {                 // Polar coordinates around player
        angle: 0,            // Horizontal angle in degrees (0 = directly in front)
        pitch: 20             // Vertical angle in degrees (0 = same height as player)
    },
    visible: true            // Whether the sphere is visible
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

// Load environment variables
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  const dotenv = await import('dotenv');
  dotenv.config();
}

// Pull CESIUM API key from environment variables or localStorage
let apiKey = localStorage.getItem('ionApiKey') || process.env.CESIUM_ACCESS_TOKEN || 'YOUR_CESIUM_TOKEN_HERE';

// Fallback for local development if no .env variable is found
if (!apiKey) {
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
}

// Parameters for Washington mountains 3D tileset
const params = {
    ionAssetId: '57590', // Washington mountains tileset ID
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

const HOVER_HEIGHT = 60; // Increased from 40 to 60
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

// Create camera state for Washington scene
const cameraState = createCameraState('washington');
const smoothFactor = 0.1;

// Export the initialized flag and a function to reset it
export function resetWashingtonInitialized() {
  washingtonInitialized = false;
  console.log('Reset Washington surface initialization state');
}

// Export the initialized state
export function isWashingtonInitialized() {
  return washingtonInitialized;
}

// Function to reset all key states to prevent stuck movement
export function resetKeys() {
  // Reset all keys to prevent stuck movement patterns
  keys.w = false;
  keys.s = false;
  keys.a = false;
  keys.d = false;
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  keys.space = false;
  console.log('Washington: Reset all key states');
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
    
    // Add the setWingsOpen function for boost wing animation
    spacecraft.setWingsOpen = spacecraftComponents.setWingsOpen;
    
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
}

/**
 * Resets the spacecraft to its initial position over Washington mountains
 */
export function resetPosition() {
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
    spacecraftBoundingSphere.radius = keys.up ? 5.0 : 3.5; // Larger radius when boosting

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
            new THREE.Vector3(0, -1, 0),    // Down
            new THREE.Vector3(0, 0, 1),     // Forward
            new THREE.Vector3(1, 0, 0),     // Right
            new THREE.Vector3(-1, 0, 0),    // Left
            new THREE.Vector3(0, 0, -1),    // Back
            new THREE.Vector3(0, -1, 1).normalize(),  // Down-Forward
            new THREE.Vector3(0, -1, -1).normalize(), // Down-Back
            new THREE.Vector3(1, -1, 0).normalize(),  // Down-Right
            new THREE.Vector3(-1, -1, 0).normalize(), // Down-Left
            new THREE.Vector3(0, -0.5, 0).normalize() // Slight down
        ];
        
        // Add more direction checks when boosting for better detection
        if (keys.up) {
            directions.push(
                new THREE.Vector3(1, 0, 1).normalize(),   // Forward-Right
                new THREE.Vector3(-1, 0, 1).normalize(),  // Forward-Left
                new THREE.Vector3(0.5, -0.5, 1).normalize() // Down-Forward-Slight Right
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
                    
                    const pushFactor = keys.up ? 2.0 : 1.5; // Stronger push when boosting
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

    console.log("Resetting spacecraft 2000m above crash point with original orientation");
    
    // Default up vector if normal not available
    const upVector = collisionNormal || new THREE.Vector3(0, 1, 0);
    
    // Set position 2000m above the collision point
    const resetPosition = collisionPoint.clone().add(upVector.normalize().multiplyScalar(2000));
    spacecraft.position.copy(resetPosition);

    // Reset to the original orientation (same as at initialization)
    spacecraft.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(-20),
        THREE.MathUtils.degToRad(75),
        THREE.MathUtils.degToRad(150),
        'XYZ'
    ));
    
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

export function updateMovement() {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Set speed based on movement mode
    if (keys.up) {
        currentSpeed = boostSpeed;
        currentTurnSpeed = boostTurnSpeed; // Less sensitive turning at high speed for stability
    } else if (keys.down) {
        currentSpeed = slowSpeed;
        currentTurnSpeed = slowTurnSpeed; // More sensitive turning at low speed for urban precision
    } else {
        currentSpeed = baseSpeed;
        currentTurnSpeed = baseTurnSpeed; // Normal turn sensitivity
    }
    
    // Update engine effects based on movement mode
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(keys.up, keys.down);
    }

    // Handle wing animation for boost mode and potential hyperspace
    // Check for isHyperspace in the global window object as a fallback
    const isInHyperspace = window.isHyperspace || false;
    
    // Use the proper setWingsOpen method instead of manual animation
    if (spacecraft && spacecraft.setWingsOpen) {
        const shouldWingsBeOpen = !keys.up && !isInHyperspace;
        
        // The setWingsOpen function has smooth animations built-in
        spacecraft.setWingsOpen(shouldWingsBeOpen);
    } 
    // Fallback to manual animation if setWingsOpen is not available
    else if ((keys.up || isInHyperspace) && wingsOpen) {
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

    // Use currentTurnSpeed for pitch and yaw, but always use slowTurnSpeed for roll
    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, currentTurnSpeed * pitchSensitivity);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -currentTurnSpeed * pitchSensitivity);
    // Roll always uses slowTurnSpeed for more precise control regardless of movement mode
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -slowTurnSpeed * rollSensitivity);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, slowTurnSpeed * rollSensitivity);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, currentTurnSpeed * yawSensitivity);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -currentTurnSpeed * yawSensitivity);

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
                        spacecraft.position.y += (HOVER_HEIGHT - groundDistance) * 0.2; // Increased from 0.1 to 0.2 for faster response
                    } else if (groundDistance > HOVER_HEIGHT * 1.5) { // Changed from HOVER_HEIGHT * 2 to HOVER_HEIGHT * 1.5
                        spacecraft.position.y -= (groundDistance - HOVER_HEIGHT) * 0.015; // Adjusted from 0.01 to 0.015
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
                // Handle collision by using the appropriate camera offset
                const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? 
                    spacecraft.isFirstPersonView() : false;
                const viewMode = isFirstPerson ? 'washingtonCockpit' : 'washington';
                
                // Force the camera state to use collision offsets
                cameraState.targetOffset = isFirstPerson ? 
                    washingtonCockpitCamera.collision.clone() : 
                    washingtonCamera.collision.clone();
                
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, reverting to original position");
                    spacecraft.position.copy(originalPosition);
                }
            }
            // Camera offset updates are now handled by updateCamera() using camera.js
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

    // Update target offsets based on keys - use appropriate view mode
    const viewMode = isFirstPerson ? 'washingtonCockpit' : 'washington';
    updateTargetOffsets(cameraState, keys, viewMode);
    
    // Update current offsets by interpolating toward targets
    updateCameraOffsets(cameraState, rotation);
    
    // For washington3D we'll use a simpler camera approach without all the cinematic effects
    // This maintains compatibility with the existing code while using the new camera module
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
    
    // Configure Cesium's request scheduler for optimal tile loading performance
    const requestController = configureCesiumRequestScheduler({
        maximumRequestsPerServer: 6,  // Slightly lower limit for Washington mountains's more detailed tileset
        throttleRequestsByServer: true,
        perServerRequestLimit: 10,     // Additional limit for newer Cesium versions
        requestQueueSize: 120          // Increased queue size for Washington mountains's complex tileset
    });
    
    // Store the controller for potential later use
    tiles.userData = tiles.userData || {};
    tiles.userData.requestController = requestController;
    
    // Log the current status of the request scheduler
    console.log('Cesium RequestScheduler configured for Washington mountains:', requestController.getStatus());
    
    // Temporarily boost tile request limits during initial load
    requestController.temporaryBoost(10000); // 10-second boost for initial loading of DC's complex tileset
    
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
        console.log("Loaded Washington mountains model with shadow settings");
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
  
    // Adjusted for Washington mountains
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
        console.log('Washington mountains bounding sphere center:', sphere.center);
        console.log('Washington mountains bounding sphere radius:', sphere.radius);
        console.log('Washington mountains tileset loaded successfully');
        
        // Call alignGridToTerrain immediately without timeout
        alignGridToTerrain();
    });
    tiles.addEventListener('error', (error) => {
        console.error('Tileset loading error:', error);
    });

    setupTiles();
}

function initControls() {
    document.addEventListener('keyPress', (event) => {
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

    document.addEventListener('keyRelease', (event) => {
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
        textureLoader = new THREE.TextureLoader(textureLoadingManager);
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
    console.log("Washington mountains 3D initialization started");
 
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
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.gammaFactor = 2.2;
 
    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);
 
    textureLoader = new THREE.TextureLoader(textureLoadingManager);
    setupWashingtonLighting();
    initSpacecraft();
    
    // Create reference sphere after spacecraft is initialized
    createReferenceSphere();
    
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
    initControls();

    washingtonInitialized = true;
    console.log("Washington mountains 3D initialization complete");
    
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
            // LASER FIRING DISABLED
        }
 
        // Update all active lasers
 
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

        // Apply terrain optimization if needed based on performance
        if (camera.userData && camera.userData.performanceMetrics && 
           camera.userData.performanceMetrics.fps < 25 && 
           tiles.userData && tiles.userData.terrainController) {
            // If framerate drops below threshold, reduce terrain detail temporarily
            tiles.userData.terrainController.decreaseDetail();
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
    const planeCollisionThreshold = 4; // Increased from 2 to 4 for stronger base plane collision

    // --- Plane Collision (prevent passing through the base plane) ---
    const raycasterPlane = new THREE.Raycaster();
    raycasterPlane.set(spacecraftWorldPosition, planeNormal.clone().negate()); // Ray downward
    const planeIntersects = raycasterPlane.intersectObject(basePlane);

    if (planeIntersects.length > 0 && planeIntersects[0].distance < planeCollisionThreshold) {
        const pushDistance = planeCollisionThreshold - planeIntersects[0].distance;
        const pushDirection = planeNormal.clone(); // Push upward
        spacecraft.position.add(pushDirection.multiplyScalar(pushDistance));
        
        // Reduce velocity on collision to prevent momentum carrying through the base plane
        currentSpeed *= 0.5; // Reduce speed by 50% on collision
        
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
 * Creates a reference sphere at a fixed position in space
 */
function createReferenceSphere() {
  if (!spacecraft) {
    console.warn("Cannot create reference sphere: spacecraft not initialized");
    return;
  }

  // Create geometry and material with Earth texture
  const geometry = new THREE.SphereGeometry(sphereConfig.radius, 32, 32);
  
  // Load Earth texture from skybox folder
  const earthTexture = textureLoader.load(`${config.textures.path}/2k_neptune.jpg`, (texture) => {

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
  
  // Add atmosphere effect with gradient haze at the bottom
  material.onBeforeCompile = (shader) => {
    // Add shader code for atmospheric effect
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      
      // Calculate position-based factors for atmospheric effects
      float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
      edgeFactor = smoothstep(0.3, 1.0, edgeFactor) * 0.3; // Edge atmosphere (subtle blue)
      
      // Calculate bottom haze effect - strongest at the bottom of the planet
      float bottomFactor = smoothstep(0.0, 0.7, -vNormal.y);
      bottomFactor *= 0.7; // Control intensity
      
      // Apply blue rim glow (lighter at edges)
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.5, 0.7, 1.0), edgeFactor);
      
      // Apply white-green atmospheric haze at the bottom
      vec3 hazeColor = mix(vec3(0.9, 1.0, 0.9), vec3(0.7, 0.95, 0.7), bottomFactor * 0.5);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor, bottomFactor);
      
      // Add slight bloom/glow effect
      float glowIntensity = bottomFactor * 0.3;
      gl_FragColor.rgb += hazeColor * glowIntensity;
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
  
  // Get the initial spacecraft position 
  const mtRainierLat = 46.8529;
  const mtRainierLon = -121.7604;
  const initialHeight = 5000;
  const initialPosition = latLonHeightToEcef(mtRainierLat, mtRainierLon, initialHeight);
  
  // Create a direction vector pointing forward from spacecraft's initial orientation
  const initialRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(-20),
    THREE.MathUtils.degToRad(75),
    THREE.MathUtils.degToRad(150),
    'XYZ'
  );
  const forward = new THREE.Vector3(0, 0, 1);
  forward.applyEuler(initialRotation);
  
  // Create side and up vectors for orientation
  const up = new THREE.Vector3(0, 1, 0);
  up.applyEuler(initialRotation);
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
