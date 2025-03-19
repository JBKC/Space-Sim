import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { createSpacecraft } from './spacecraft.js';

let moonCamera, moonScene, moonRenderer, tiles, moonCameraTarget;
let moonInitialized = false;

export { 
    moonScene, 
    moonCamera, 
    moonRenderer, 
    tiles, 
    moonCameraTarget 
};

// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;

// Movement settings
const baseSpeed = 50;
const boostSpeed = baseSpeed * 5;
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

// Camera settings
const baseCameraOffset = new THREE.Vector3(0, 2, -10); // Camera sits behind the spacecraft
const boostCameraOffset = new THREE.Vector3(0, 3, -20); // Further back during boost
const collisionCameraOffset = new THREE.Vector3(0, 5, -20); // Shifted upward but keeps Z distances
// Current camera offset that will be interpolated
let currentCameraOffset = baseCameraOffset.clone();
// Target offset that we're interpolating towards
let targetCameraOffset = baseCameraOffset.clone();

// Camera transition parameters
const cameraTransitionSpeed = 0.2; // Lower = slower transition, Higher = faster transition

// Cinematic camera effect parameters
const MAX_PITCH_OFFSET = 0.1; // Maximum pitch offset in radians (about 5.7 degrees)
const MAX_YAW_OFFSET = 0.15; // Maximum yaw offset in radians (about 8.6 degrees)
const CAMERA_LAG_FACTOR = 0.1; // How quickly the camera catches up (0.1 = slow, 0.5 = fast)
// Current rotational offsets that will be smoothly interpolated
let currentPitchOffset = 0;
let currentYawOffset = 0;
// Target rotational offsets based on input
let targetPitchOffset = 0;
let targetYawOffset = 0;

// Local rotation parameters (new)
const MAX_LOCAL_PITCH_ROTATION = 0.06; // Maximum rotation around local X axis (about 3.4 degrees)
const MAX_LOCAL_YAW_ROTATION = 0.08; // Maximum rotation around local Y axis (about 4.6 degrees)
const LOCAL_ROTATION_SPEED = 0.08; // How quickly local rotations are applied
// Current local rotation angles (new)
let currentLocalPitchRotation = 0;
let currentLocalYawRotation = 0;
// Target local rotation angles (new)
let targetLocalPitchRotation = 0;
let targetLocalYawRotation = 0;

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Sun objects and materials
let moonSun, sunGroup, sunMesh, sunHalo, sunFlare;
let textureLoader = new THREE.TextureLoader();

const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

const apiKey = localStorage.getItem('ionApiKey') ?? 'YOUR_CESIUM_TOKEN_HERE';

const params = {
    ionAssetId: '2684829',
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

const HOVER_HEIGHT = 40;
const MAX_SLOPE_ANGLE = 45;

function initSpacecraft() {
    const spacecraftComponents = createSpacecraft(moonScene);
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;

    // Make spacecraft cast and receive shadows
    spacecraft.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    const apollo11Lat = 0.6741;
    const apollo11Lon = 23.4733;
    const height = 20000;
    const position = latLonToCartesian(apollo11Lat, apollo11Lon, height);
    spacecraft.position.copy(position);

    spacecraft.quaternion.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-100), THREE.MathUtils.degToRad(-30), THREE.MathUtils.degToRad(-120), 'XYZ'));

    moonCameraTarget = new THREE.Object3D();
    spacecraft.add(moonCameraTarget);
    moonCameraTarget.position.set(0, 0, 0);

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
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
    spacecraftBoundingSphere.radius = 50;

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

    currentSpeed = keys.up ? boostSpeed : baseSpeed;
    
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(keys.up);
    }

    if (keys.up && wingsOpen) {
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed / 2);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed / 2);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed / 2);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed / 2);

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
        if (tiles && tiles.group && tiles.group.children.length > 0) {
            if (checkTerrainCollision()) {
                console.log("Collision detected and resolved");
                // Set collision camera offset as target
                targetCameraOffset = collisionCameraOffset.clone();
                
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, reverting to original position");
                    spacecraft.position.copy(originalPosition);
                }
            } else {
                // Return to normal target offset when no collision
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
        const angleStep = (Math.PI / 8) / wingTransitionFrames;
        if (wingsOpen) {
            topRightWing.rotation.z = Math.max(topRightWing.rotation.z - angleStep, -Math.PI / 8);
            bottomRightWing.rotation.z = Math.min(bottomRightWing.rotation.z + angleStep, Math.PI / 8);
            topLeftWing.rotation.z = Math.min(topLeftWing.rotation.z + angleStep, Math.PI + Math.PI / 8);
            bottomLeftWing.rotation.z = Math.max(bottomLeftWing.rotation.z - angleStep, Math.PI - Math.PI / 8);
        } else {
            topRightWing.rotation.z = Math.min(topRightWing.rotation.z + angleStep, 0);
            bottomRightWing.rotation.z = Math.max(bottomRightWing.rotation.z - angleStep, 0);
            topLeftWing.rotation.z = Math.max(topLeftWing.rotation.z - angleStep, Math.PI);
            bottomLeftWing.rotation.z = Math.min(bottomLeftWing.rotation.z + angleStep, Math.PI);
        }
        wingAnimation--;
    }
}

export function updateCamera() {
    /**
     * Enhanced Cinematic Camera System with Local Rotations
     * ------------------------------------------------------------
     * This camera system creates a dynamic cinematic effect by:
     * 
     * 1. Maintaining a fixed local-space position relative to the spacecraft
     * 2. Adding both positional and rotational offsets during turning
     * 3. Rotating the camera around the spacecraft's local axes during maneuvers
     * 4. Creating a "lag" effect that follows the spacecraft's movements
     */
    
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Determine the target camera offset based on the current mode
    if (keys.up) {
        targetCameraOffset = boostCameraOffset.clone();
    } else {
        targetCameraOffset = baseCameraOffset.clone();
    }
    
    // Add collision detection here if needed
    // if (collisionDetected) {
    //     targetCameraOffset = collisionCameraOffset.clone();
    // }
    
    // Determine rotational offsets based on input
    // For pitch (up/down), INVERTED so camera moves opposite to pitch direction
    if (keys.w) {
        targetPitchOffset = -MAX_PITCH_OFFSET; // Look up when pitching up
        targetLocalPitchRotation = -MAX_LOCAL_PITCH_ROTATION; // INVERTED: Move toward bottom when pitching up
    } else if (keys.s) {
        targetPitchOffset = MAX_PITCH_OFFSET; // Look down when pitching down
        targetLocalPitchRotation = MAX_LOCAL_PITCH_ROTATION; // INVERTED: Move toward top when pitching down
    } else {
        targetPitchOffset = 0; // Return to neutral when no input
        targetLocalPitchRotation = 0; // Return local rotation to neutral
    }
    
    // For yaw (left/right), the camera should rotate counter to the spacecraft motion
    if (keys.left) {
        targetYawOffset = MAX_YAW_OFFSET; // Look right when turning left
        targetLocalYawRotation = -MAX_LOCAL_YAW_ROTATION; // Rotate around local Y axis
    } else if (keys.right) {
        targetYawOffset = -MAX_YAW_OFFSET; // Look left when turning right
        targetLocalYawRotation = MAX_LOCAL_YAW_ROTATION; // Rotate around local Y axis in opposite direction
    } else {
        targetYawOffset = 0; // Return to neutral when no input
        targetLocalYawRotation = 0; // Return local rotation to neutral
    }
    
    // Smooth interpolation for position, global rotational offsets, and local rotations
    currentCameraOffset.lerp(targetCameraOffset, cameraTransitionSpeed);
    currentPitchOffset += (targetPitchOffset - currentPitchOffset) * CAMERA_LAG_FACTOR;
    currentYawOffset += (targetYawOffset - currentYawOffset) * CAMERA_LAG_FACTOR;
    
    // Apply smooth interpolation to local rotational values
    currentLocalPitchRotation += (targetLocalPitchRotation - currentLocalPitchRotation) * LOCAL_ROTATION_SPEED;
    currentLocalYawRotation += (targetLocalYawRotation - currentLocalYawRotation) * LOCAL_ROTATION_SPEED;
    
    // Create a position vector from the interpolated offset
    const position = new THREE.Vector3();
    position.copy(currentCameraOffset);
    
    // Get spacecraft's world matrix and apply it to the position
    spacecraft.updateMatrixWorld();
    const worldMatrix = spacecraft.matrixWorld.clone();
    
    // Apply local rotations to the camera position before transforming to world space
    // Create rotation quaternions for local rotations
    const localPitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), currentLocalPitchRotation);
    const localYawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentLocalYawRotation);
    
    // Apply local rotations to the position
    position.applyQuaternion(localPitchRotation);
    position.applyQuaternion(localYawRotation);
    
    // Now transform to world space
    position.applyMatrix4(worldMatrix);
    
    // Set camera position
    moonCamera.position.copy(position);
    
    // Get the base spacecraft orientation
    const baseQuaternion = spacecraft.getWorldQuaternion(new THREE.Quaternion());
    
    // Create the global rotational offsets
    const pitchOffset = new THREE.Quaternion().setFromAxisAngle(rotation.pitchAxis, currentPitchOffset);
    const yawOffset = new THREE.Quaternion().setFromAxisAngle(rotation.yawAxis, currentYawOffset);
    
    // Combine the orientations: base orientation + global offsets + local rotations
    moonCamera.quaternion.copy(baseQuaternion);
    moonCamera.quaternion.multiply(pitchOffset);
    moonCamera.quaternion.multiply(yawOffset);
    moonCamera.quaternion.multiply(localPitchRotation);
    moonCamera.quaternion.multiply(localYawRotation);
    
    // Apply the 180-degree rotation to look forward
    const forwardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    moonCamera.quaternion.multiply(forwardRotation);
    
    // Debug information
    // console.log(`Camera local rotations - Pitch: ${(currentLocalPitchRotation * 180/Math.PI).toFixed(2)}°, Yaw: ${(currentLocalYawRotation * 180/Math.PI).toFixed(2)}°`);
}

let updateEngineEffects;

function rotationBetweenDirections(dir1, dir2) {
    const rotation = new THREE.Quaternion();
    const a = new THREE.Vector3().crossVectors(dir1, dir2);
    rotation.x = a.x;
    rotation.y = a.y;
    rotation.z = a.z;
    rotation.w = 1 + dir1.clone().dot(dir2);
    rotation.normalize();
    return rotation;
}

function setupTiles() {
    tiles.fetchOptions.mode = 'cors';
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath('./draco/')
    }));
    
    // Make tiles receive shadows with improved configuration
    tiles.onLoadModel = (model) => {
        model.traverse((node) => {
            if (node.isMesh) {
                node.receiveShadow = true;
                // Enhance material for better light response
                if (node.material) {
                    // Ensure materials can show shadows properly
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
        console.log("Loaded model with enhanced shadow settings");
    };
    
    moonScene.add(tiles.group);
}

function reinstantiateTiles() {
    if (tiles) {
        moonScene.remove(tiles.group);
        tiles.dispose();
        tiles = null;
    }

    localStorage.setItem('ionApiKey', params.ionAccessToken);

    tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: params.ionAccessToken, assetId: params.ionAssetId }));
    tiles.addEventListener('load-tile-set', () => {
        const sphere = new THREE.Sphere();
        tiles.getBoundingSphere(sphere);
        console.log('Moon bounding sphere center:', sphere.center);
        console.log('Moon bounding sphere radius:', sphere.radius);
        console.log('Tileset loaded successfully');
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
        }
    });
}

// Setup lighting for the moon scene
function setupMoonLighting() {
    // Create a textureLoader if it doesn't exist
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    // Add ambient light similar to space scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    moonScene.add(ambientLight);
    
    // Create a main directional light positioned in local moon coordinates
    // This will create a sun-like effect with harsh shadows
    moonSun = new THREE.DirectionalLight(0xffffff, 1.5);
    // Position the light at a specific height above the moon surface
    // Rather than using normalized vectors, use absolute coordinates
    moonSun.position.set(0, 100000, 0);
    moonSun.castShadow = true;
    
    // Configure shadow properties for high-quality shadows
    moonSun.shadow.mapSize.width = 4096;
    moonSun.shadow.mapSize.height = 4096;
    moonSun.shadow.camera.near = 1000;
    moonSun.shadow.camera.far = 200000;
    
    // Expand the shadow camera's view to cover more of the scene
    const shadowSize = 20000;
    moonSun.shadow.camera.left = -shadowSize;
    moonSun.shadow.camera.right = shadowSize;
    moonSun.shadow.camera.top = shadowSize;
    moonSun.shadow.camera.bottom = -shadowSize;
    
    // Adjust shadow bias for sharper shadows
    moonSun.shadow.bias = -0.00002;
    moonSun.shadow.normalBias = 0.005;
    
    // Create a target for the light to aim at
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    moonScene.add(target);
    moonSun.target = target;
    
    moonScene.add(moonSun);
    
    // Add side light similar to space scene
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sideLight.position.set(-1, -1, 1).normalize();
    moonScene.add(sideLight);
    
    // Add a subtle fill light from below to prevent completely black shadows
    const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.2);
    fillLight.position.set(0, -1, 0);
    moonScene.add(fillLight);
    
    console.log("Moon lighting setup updated with local coordinate lighting");
}

export function init() {
    console.log("Moon3D initialization started");
    
    if (moonInitialized) {
        console.log("Moon3D already initialized, skipping");
        return { scene: moonScene, camera: moonCamera, renderer: moonRenderer, tiles: tiles };
    }

    moonScene = new THREE.Scene();

    const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.needsUpdate = true;
    moonScene.environment = env;

    moonRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        precision: 'highp',
        powerPreference: 'high-performance'
    });
    moonRenderer.setClearColor(0x000000);
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable shadows on the renderer with high quality settings
    moonRenderer.shadowMap.enabled = true;
    moonRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    moonRenderer.physicallyCorrectLights = true;
    moonRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    moonRenderer.toneMappingExposure = 1.2; // Slightly increased exposure for better visibility
    
    // Additional renderer settings for quality
    moonRenderer.outputEncoding = THREE.sRGBEncoding;
    moonRenderer.gammaFactor = 2.2;
    
    document.body.appendChild(moonRenderer.domElement);
    moonRenderer.domElement.tabIndex = 1;

    moonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    moonCamera.position.set(100, 100, -100);
    moonCamera.lookAt(0, 0, 0);
    
    // Initialize the texture loader
    textureLoader = new THREE.TextureLoader();
    
    // Add lighting to the moon scene
    setupMoonLighting();
    
    initSpacecraft();
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    initControls();

    moonInitialized = true;
    console.log("Moon3D initialization complete");
    
    return { 
        scene: moonScene, 
        camera: moonCamera, 
        renderer: moonRenderer, 
        tiles: tiles 
    };
}

export function update() {
    try {
        if (!moonInitialized) {
            console.log("Moon3D not initialized yet");
            return false;
        }

        if (!tiles) {
            return false;
        }

        updateMovement();
        updateCamera();
        
        // Ensure tiles receive shadows
        if (tiles.group) {
            tiles.group.traverse((node) => {
                if (node.isMesh && node.receiveShadow === undefined) {
                    node.receiveShadow = true;
                }
            });
        }
        
        // Update lighting relative to spacecraft
        updateMoonLighting();

        if (!moonCamera) {
            console.warn("Moon camera not initialized");
            return false;
        }

        tiles.setCamera(moonCamera);
        tiles.setResolutionFromRenderer(moonCamera, moonRenderer);

        moonCamera.updateMatrixWorld();
        tiles.update();
        
        return true;
    } catch (error) {
        console.error("Error in moon3D update:", error);
        return false;
    }
}

// Update the light position to follow the spacecraft
function updateMoonLighting() {
    if (!moonSun || !spacecraft) return;
    
    // We want the light to be at a fixed position above the current spacecraft position
    // This ensures the lighting is consistent as we move around the moon
    const spacecraftPosition = spacecraft.position.clone();
    
    // Position the light high above the spacecraft
    moonSun.position.set(
        spacecraftPosition.x,
        spacecraftPosition.y + 100000, // 100km above the spacecraft
        spacecraftPosition.z
    );
    
    // Update the shadow camera to look at the spacecraft
    if (moonSun.target) {
        moonSun.target.position.copy(spacecraftPosition);
        moonSun.target.updateMatrixWorld();
    }
}

function onWindowResize() {
    moonCamera.aspect = window.innerWidth / window.innerHeight;
    moonCamera.updateProjectionMatrix();
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
}
