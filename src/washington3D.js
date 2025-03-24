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
 deathStar,     // Export the Death Star
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
let textureLoader = new THREE.TextureLoader();

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

// Death Star variables
let deathStar;
const DEATH_STAR_DISTANCE = 10000; // Distance in front of spacecraft
const DEATH_STAR_SIZE = 5000; // Width in units
let deathStarLoaded = false;

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
 const initialHeight = 10000;
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
    const initialHeight = 10000;
    const position = latLonHeightToEcef(mtRainierLat, mtRainierLon, initialHeight);
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
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);
 
    washingtonSun = new THREE.DirectionalLight(0xffffff, 10);
 
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
 
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sideLight.position.set(-1, -1, 1).normalize(); // Keep as directional for now
    scene.add(sideLight);
    
    const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.2);
    fillLight.position.set(0, -1, 0); // Keep as directional for now
    scene.add(fillLight);
    
    console.log("Lighting setup for Washington DC scene");
}

export function init() {
    console.log("Washington DC 3D initialization started");
 
    if (washingtonInitialized) {
        console.log("Already initialized, skipping");
        return { scene: scene, camera: camera, renderer: renderer, tiles: tiles };
    }

    scene = new THREE.Scene();
    const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
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
    
    // Simple lighting for the Death Star
    // No special handling needed
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

