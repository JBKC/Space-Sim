import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
// import { GUI } from '/node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
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
const baseSpeed = 10;
const boostSpeed = baseSpeed * 5;
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

// Camera settings
const baseCameraOffset = new THREE.Vector3(0, 2, 90);
const boostCameraOffset = new THREE.Vector3(0, 3, 450);
const collisionCameraOffset = new THREE.Vector3(0, 100, 90); // Shifted upward but keeps Z distances
let currentCameraOffset = baseCameraOffset.clone();
const smoothFactor = 0.1;

// Collision detection
const spacecraftBoundingSphere = new THREE.Sphere();
const raycaster = new THREE.Raycaster();
const collisionOffset = new THREE.Vector3();

const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

const apiKey = localStorage.getItem('ionApiKey') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NmY0YmQ5ZC01YjAzLTRlMjgtODNjNi03ODk0YzMzMzIwMjUiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MDA4MTV9.UBJTgisQzO6DOlzjlDbP2LC7QX4oclluTwzqhDUSWF0';

const params = {
    ionAssetId: '2684829',
    ionAccessToken: apiKey,
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
                // Shift camera upward during collision
                currentCameraOffset.lerp(collisionCameraOffset, smoothFactor);
                
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, reverting to original position");
                    spacecraft.position.copy(originalPosition);
                }
            } else {
                // Return to normal offset when no collision
                const targetOffset = keys.up ? boostCameraOffset : baseCameraOffset;
                currentCameraOffset.lerp(targetOffset, smoothFactor);
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
    const localOffset = currentCameraOffset.clone();
    const cameraPosition = localOffset.applyMatrix4(spacecraft.matrixWorld);

    moonCamera.position.lerp(cameraPosition, smoothFactor);
    moonCamera.quaternion.copy(spacecraft.quaternion);

    const adjustment = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    moonCamera.quaternion.multiply(adjustment);
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

    moonRenderer = new THREE.WebGLRenderer({ antialias: true });
    moonRenderer.setClearColor(0x000000);
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(moonRenderer.domElement);
    moonRenderer.domElement.tabIndex = 1;

    moonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    moonCamera.position.set(100, 100, -100);
    moonCamera.lookAt(0, 0, 0);
    
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

function onWindowResize() {
    moonCamera.aspect = window.innerWidth / window.innerHeight;
    moonCamera.updateProjectionMatrix();
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
}