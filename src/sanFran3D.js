import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { createSpacecraft } from './spacecraft.js';

let moonCamera, moonScene, moonRenderer, tiles, moonCameraTarget;
let moonInitialized = false;

// DEFINE local coordinate system (align to the 3D tile rendering)
const coordConfig = {
    scale: 2,
    position: {
        lat: 37.7749,
        lon: -122.4194,
        height: 0
    },
    orientation: {
        pitch: 50,
        yaw: -22,
        roll: 0
    },
    arrowLength: 200,
    arrowThickness: 5,
    labelSize: 100
};
let coordinateSystem;

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
const baseSpeed = 2;
const boostSpeed = baseSpeed * 3;
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

// Camera settings
const baseCameraOffset = new THREE.Vector3(0, 2, -10);
const boostCameraOffset = new THREE.Vector3(0, 3, -20);
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

// Parameters for San Francisco 3D tileset only
const params = {
    ionAssetId: '1415196',
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

    spacecraft.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    // Set initial position above San Francisco
    const sfLat = 37.7749;
    const sfLon = -122.4194;
    const initialHeight = 1000;
    const position = latLonHeightToEcef(sfLat, sfLon, initialHeight);
    spacecraft.position.copy(position);

    spacecraft.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(-20),
        THREE.MathUtils.degToRad(90),
        THREE.MathUtils.degToRad(150),
        'XYZ'
    ));

    moonCameraTarget = new THREE.Object3D();
    spacecraft.add(moonCameraTarget);
    moonCameraTarget.position.set(0, 0, 0);

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
}

// Helper function to create text sprites
function createTextSprite(text, color) {
    const canvas = document.createElement('canvas');
    const size = 256; // Texture size
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0, 0, 0, 0)'; // Transparent background
    context.fillRect(0, 0, size, size);
    context.font = 'Bold 100px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, size / 2, size / 2);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(coordConfig.labelSize, coordConfig.labelSize, 1);
    return sprite;
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
    const xLabel = createTextSprite('X', '#ff0000');
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
    const yLabel = createTextSprite('Y', '#00ff00');
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
    const zLabel = createTextSprite('Z', '#0000ff');
    zLabel.position.set(0, 0, coordConfig.arrowLength + coordConfig.labelSize / 2);

    coordinateSystem.add(xArrow, yArrow, zArrow, xLabel, yLabel, zLabel);
    
    const coordPos = latLonHeightToEcef(
        coordConfig.position.lat,
        coordConfig.position.lon,
        coordConfig.position.height
    );
    coordinateSystem.position.copy(coordPos);
    
    coordinateSystem.scale.setScalar(coordConfig.scale);
    coordinateSystem.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(coordConfig.orientation.pitch),
        THREE.MathUtils.degToRad(coordConfig.orientation.yaw),
        THREE.MathUtils.degToRad(coordConfig.orientation.roll),
        'XYZ'
    ));

    moonScene.add(coordinateSystem);
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

    if (keys.up) {
        targetCameraOffset = boostCameraOffset.clone();
    } else {
        targetCameraOffset = baseCameraOffset.clone();
    }
    
    if (keys.w) {
        targetPitchOffset = -MAX_PITCH_OFFSET;
        targetLocalPitchRotation = -MAX_LOCAL_PITCH_ROTATION;
    } else if (keys.s) {
        targetPitchOffset = MAX_PITCH_OFFSET;
        targetLocalPitchRotation = MAX_LOCAL_PITCH_ROTATION;
    } else {
        targetPitchOffset = 0;
        targetLocalPitchRotation = 0;
    }
    
    if (keys.left) {
        targetYawOffset = MAX_YAW_OFFSET;
        targetLocalYawRotation = -MAX_LOCAL_YAW_ROTATION;
    } else if (keys.right) {
        targetYawOffset = -MAX_YAW_OFFSET;
        targetLocalYawRotation = MAX_LOCAL_YAW_ROTATION;
    } else {
        targetYawOffset = 0;
        targetLocalYawRotation = 0;
    }
    
    currentCameraOffset.lerp(targetCameraOffset, cameraTransitionSpeed);
    currentPitchOffset += (targetPitchOffset - currentPitchOffset) * CAMERA_LAG_FACTOR;
    currentYawOffset += (targetYawOffset - currentYawOffset) * CAMERA_LAG_FACTOR;
    currentLocalPitchRotation += (targetLocalPitchRotation - currentLocalPitchRotation) * LOCAL_ROTATION_SPEED;
    currentLocalYawRotation += (targetLocalYawRotation - currentLocalYawRotation) * LOCAL_ROTATION_SPEED;
    
    const position = new THREE.Vector3().copy(currentCameraOffset);
    spacecraft.updateMatrixWorld();
    const worldMatrix = spacecraft.matrixWorld.clone();
    
    const localPitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), currentLocalPitchRotation);
    const localYawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentLocalYawRotation);
    
    position.applyQuaternion(localPitchRotation);
    position.applyQuaternion(localYawRotation);
    position.applyMatrix4(worldMatrix);
    
    moonCamera.position.copy(position);
    
    const baseQuaternion = spacecraft.getWorldQuaternion(new THREE.Quaternion());
    const pitchOffset = new THREE.Quaternion().setFromAxisAngle(rotation.pitchAxis, currentPitchOffset);
    const yawOffset = new THREE.Quaternion().setFromAxisAngle(rotation.yawAxis, currentYawOffset);
    
    moonCamera.quaternion.copy(baseQuaternion)
        .multiply(pitchOffset)
        .multiply(yawOffset)
        .multiply(localPitchRotation)
        .multiply(localYawRotation);
    
    const forwardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    moonCamera.quaternion.multiply(forwardRotation);
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
        console.log('San Francisco bounding sphere center:', sphere.center);
        console.log('San Francisco bounding sphere radius:', sphere.radius);
        console.log('San Francisco tileset loaded successfully');
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

function setupMoonLighting() {
    if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
    }
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    moonScene.add(ambientLight);
    
    moonSun = new THREE.DirectionalLight(0xffffff, 1.5);
    moonSun.position.set(0, 100000, 0);
    moonSun.castShadow = true;
    
    moonSun.shadow.mapSize.width = 4096;
    moonSun.shadow.mapSize.height = 4096;
    moonSun.shadow.camera.near = 1000;
    moonSun.shadow.camera.far = 200000;
    const shadowSize = 20000;
    moonSun.shadow.camera.left = -shadowSize;
    moonSun.shadow.camera.right = shadowSize;
    moonSun.shadow.camera.top = shadowSize;
    moonSun.shadow.camera.bottom = -shadowSize;
    moonSun.shadow.bias = -0.00002;
    moonSun.shadow.normalBias = 0.005;
    
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    moonScene.add(target);
    moonSun.target = target;
    
    moonScene.add(moonSun);
    
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sideLight.position.set(-1, -1, 1).normalize();
    moonScene.add(sideLight);
    
    const fillLight = new THREE.DirectionalLight(0xaaaaff, 0.2);
    fillLight.position.set(0, -1, 0);
    moonScene.add(fillLight);
    
    console.log("Lighting setup for San Francisco scene");
}

export function init() {
    console.log("San Francisco 3D initialization started");
    
    if (moonInitialized) {
        console.log("Already initialized, skipping");
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
    moonRenderer.shadowMap.enabled = true;
    moonRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    moonRenderer.physicallyCorrectLights = true;
    moonRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    moonRenderer.toneMappingExposure = 1.2;
    moonRenderer.outputEncoding = THREE.sRGBEncoding;
    moonRenderer.gammaFactor = 2.2;
    
    document.body.appendChild(moonRenderer.domElement);
    moonRenderer.domElement.tabIndex = 1;

    moonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    moonCamera.position.set(100, 100, -100);
    moonCamera.lookAt(0, 0, 0);
    
    textureLoader = new THREE.TextureLoader();
    setupMoonLighting();
    initSpacecraft();
    createCoordinateSystem();
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
    initControls();

    moonInitialized = true;
    console.log("San Francisco 3D initialization complete");
    
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
            console.log("Not initialized yet");
            return false;
        }

        if (!tiles) {
            return false;
        }

        updateMovement();
        updateCamera();
        
        if (tiles.group) {
            tiles.group.traverse((node) => {
                if (node.isMesh && node.receiveShadow === undefined) {
                    node.receiveShadow = true;
                }
            });
        }
        
        updateMoonLighting();

        if (!moonCamera) {
            console.warn("Camera not initialized");
            return false;
        }

        tiles.setCamera(moonCamera);
        tiles.setResolutionFromRenderer(moonCamera, moonRenderer);
        moonCamera.updateMatrixWorld();
        tiles.update();
        
        return true;
    } catch (error) {
        console.error("Error in update:", error);
        return false;
    }
}

function updateMoonLighting() {
    if (!moonSun || !spacecraft) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    moonSun.position.set(
        spacecraftPosition.x,
        spacecraftPosition.y + 100000,
        spacecraftPosition.z
    );
    
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