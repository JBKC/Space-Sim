import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { createSpacecraft } from './spacecraft.js';
import { fireLaser, updateLasers } from './laser.js';
import { keys } from './movement.js';
import { 
    moonCamera as moonCameraConfig, 
    createCameraState, 
    updateTargetOffsets, 
    updateCameraOffsets, 
    applyCameraState, 
    createForwardRotation, 
    rotationBetweenDirections 
} from './camera.js';
import { configureCesiumRequestScheduler, optimizeTerrainLoading } from './cesiumRateLimit.js';

let camera, scene, renderer, tiles, cameraTarget;
let moonInitialized = false;

export { 
    scene, 
    camera, 
    renderer, 
    tiles, 
    cameraTarget,
    spacecraft
};

// Add a debug flag at the top to easily toggle console logging
const DEBUG = false; // Set to false in production

// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;
let lastMoonLaserFireTime = 0; // Add a moon-specific laser fire time tracker

// Movement settings
const baseSpeed = 2;
const boostSpeed = baseSpeed * 3;
const slowSpeed = baseSpeed * 0.5; // Half of base speed for slow mode
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
// Add sensitivity multipliers for each rotation axis
const pitchSensitivity = 0.6; // Lower value = less sensitive
const rollSensitivity = 1;  // Lower value = less sensitive
const yawSensitivity = 0.5;   // Lower value = less sensitive

// Create camera state for moon scene
const cameraState = createCameraState('moon');
const smoothFactor = 0.1;

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

// Sun objects and materials
let moonSun, sunGroup, sunMesh, sunHalo, sunFlare;
let textureLoader = new THREE.TextureLoader();

// Rotation configuration
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


const params = {
    ionAssetId: '2684829',
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

const HOVER_HEIGHT = 40;
const MAX_SLOPE_ANGLE = 45;

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

    cameraTarget = new THREE.Object3D();
    spacecraft.add(cameraTarget);
    cameraTarget.position.set(0, 0, 0);

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
        if (DEBUG) console.log("Tiles or tiles.group not available yet");
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
                } else if (keys.down) {
                    targetCameraOffset = slowCameraOffset.clone();
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
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Update target offsets based on keys
    updateTargetOffsets(cameraState, keys, 'moon');
    
    // Update current offsets by interpolating toward targets
    updateCameraOffsets(cameraState, rotation);
    
    // For moon3D we'll use a simpler camera approach without all the cinematic effects
    // This maintains compatibility with the existing code while using the new camera module
    const localOffset = keys.up ? moonCameraConfig.boost.clone() : cameraState.currentOffset.clone();
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
        maximumRequestsPerServer: 5,  // Lower limit for moon surface to prioritize quality over speed
        throttleRequestsByServer: true,
        perServerRequestLimit: 8,     // Additional limit for newer Cesium versions
        requestQueueSize: 80          // Smaller queue for moon surface to manage memory better
    });
    
    // Store the controller for potential later use
    tiles.userData = tiles.userData || {};
    tiles.userData.requestController = requestController;
    
    // Log the current status of the request scheduler
    console.log('Cesium RequestScheduler configured for Moon surface:', requestController.getStatus());
    
    // Temporarily boost tile request limits during initial load
    requestController.temporaryBoost(6000); // 6-second boost for initial loading
    
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
        console.log('Moon bounding sphere center:', sphere.center);
        console.log('Moon bounding sphere radius:', sphere.radius);
        console.log('Tileset loaded successfully');
    });
    tiles.addEventListener('error', (error) => {
        console.error('Tileset loading error:', error);
    });

    setupTiles();
}

// Setup lighting for the moon scene
function setupMoonLighting() {
    // Create a textureLoader if it doesn't exist
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    // Add ambient light similar to space scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);
    
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
    scene.add(target);
    moonSun.target = target;
    
    scene.add(moonSun);
    
    // Add side light similar to space scene
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sideLight.position.set(-1, -1, 1).normalize();
    scene.add(sideLight);
    
    // Add a subtle fill light from below to prevent completely black shadows
    const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.2);
    fillLight.position.set(0, -1, 0);
    scene.add(fillLight);
    
    console.log("Moon lighting setup updated with local coordinate lighting");
}

export function init() {
    console.log("Moon3D initialization started");
    
    if (moonInitialized) {
        console.log("Moon3D already initialized, skipping");
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
    renderer.setClearColor(0x000000);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable shadows on the renderer with high quality settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Slightly increased exposure for better visibility
    
    // Additional renderer settings for quality
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.gammaFactor = 2.2;
    
    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);
    
    // Initialize the texture loader
    textureLoader = new THREE.TextureLoader();
    
    // Add lighting to the moon scene
    setupMoonLighting();
    
    initSpacecraft();
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    moonInitialized = true;
    console.log("Moon3D initialization complete");
    
    return { 
        scene: scene, 
        camera: camera, 
        renderer: renderer, 
        tiles: tiles 
    };
}

export function update(deltaTime = 0.016) {
    try {
        if (!moonInitialized) {
            if (DEBUG) console.log("Moon3D not initialized yet");
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
            // fireLaser(spacecraft, scene, 'moon', keys.up, keys.down);
        }
        
        // Update all active lasers
        updateLasers(deltaTime);
        
        // Update moon lighting system
        updateMoonLighting();
        
        // Check for good camera state
        if (!camera) {
            console.warn("Camera not initialized");
            return false;
        }
        
        // Apply terrain optimization if needed based on performance
        if (camera.userData && camera.userData.performanceMetrics && 
           camera.userData.performanceMetrics.fps < 30 && 
           tiles.userData && tiles.userData.terrainController) {
            // If framerate drops below threshold, reduce terrain detail temporarily
            tiles.userData.terrainController.decreaseDetail();
        }
        
        // Update tiles with camera information
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
        console.error("Error in Moon3D update:", error);
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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// Update the event listeners to include down arrow key
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