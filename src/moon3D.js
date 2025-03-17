import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from '/node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { createSpacecraft } from './spacecraft.js'; // Import the spacecraft function

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
const boostCameraOffset = new THREE.Vector3(0, 3, 300);
let currentCameraOffset = baseCameraOffset.clone();
const smoothFactor = 0.1;

const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

// Your Cesium Ion token; replace with a fresh one if needed
const apiKey = localStorage.getItem('ionApiKey') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NmY0YmQ5ZC01YjAzLTRlMjgtODNjNi03ODk0YzMzMzIwMjUiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MDA4MTV9.UBJTgisQzO6DOlzjlDbP2LC7QX4oclluTwzqhDUSWF0';

// Moon 3D terrain asset ID
const params = {
    ionAssetId: '2684829', // Moon terrain dataset
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

function initSpacecraft() {
    const spacecraftComponents = createSpacecraft(moonScene);
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;

    // Set initial position above Apollo 11 landing site (0.6741° N, 23.4733° E, 1,000m height)
    const apollo11Lat = 0.6741; // Latitude in degrees
    const apollo11Lon = 23.4733; // Longitude in degrees
    const height = 20000; // Starting altitude in meters
    const position = latLonToCartesian(apollo11Lat, apollo11Lon, height);
    spacecraft.position.copy(position);

    // Set initial angle of craft to surface
    // x = yaw, y = pitch, z = roll
    spacecraft.quaternion.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-100), THREE.MathUtils.degToRad(-30), THREE.MathUtils.degToRad(-120), 'XYZ'));

    // Setup camera target
    moonCameraTarget = new THREE.Object3D();
    spacecraft.add(moonCameraTarget);
    moonCameraTarget.position.set(0, 0, 0);

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
}

// Convert latitude, longitude, height to Cartesian coordinates for the Moon
function latLonToCartesian(lat, lon, height) {
    const moonRadius = 1737.4 * 1000; // Moon radius in meters (~1,737.4 km)
    const radius = moonRadius + height;
    const phi = THREE.MathUtils.degToRad(90 - lat); // Colatitude (theta)
    const theta = THREE.MathUtils.degToRad(lon);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

export function updateMovement() {
    currentSpeed = keys.up ? boostSpeed : baseSpeed;
    updateEngineEffects(keys.up);

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

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);

    spacecraft.position.add(forward.multiplyScalar(currentSpeed));

    if (wingAnimation > 0) {
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
    const isBoosting = keys.up;
    const localOffset = isBoosting ? boostCameraOffset.clone() : currentCameraOffset.clone();
    const cameraPosition = localOffset.applyMatrix4(spacecraft.matrixWorld);

    moonCamera.position.lerp(cameraPosition, smoothFactor);
    moonCamera.quaternion.copy(spacecraft.quaternion);

    const adjustment = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    moonCamera.quaternion.multiply(adjustment);
}

let updateEngineEffects;

function rotationBetweenDirections(dir1, dir2) {
    const rotation = new THREE.Quaternion();
    const a = new THREE.Vector3().crossVectors(dir1, dir2);a
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
    moonRenderer.setClearColor(0x000000);           // black background (space)
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(moonRenderer.domElement);
    moonRenderer.domElement.tabIndex = 1;

    moonCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    moonCamera.position.set(100, 100, -100); // Initial position overridden by spacecraft
    moonCamera.lookAt(0, 0, 0);
    
    initSpacecraft();
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    const gui = new GUI();
    gui.width = 300;
    const ionOptions = gui.addFolder('Ion');
    ionOptions.add(params, 'ionAssetId');
    ionOptions.add(params, 'ionAccessToken');
    ionOptions.add(params, 'reload');
    ionOptions.open();
    
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
    if (!tiles) {
        console.log("Moon tiles not loaded yet");
        return;
    }

    updateMovement();
    updateCamera();

    tiles.setCamera(moonCamera);
    tiles.setResolutionFromRenderer(moonCamera, moonRenderer);

    moonCamera.updateMatrixWorld();
    tiles.update();
}

function onWindowResize() {
    moonCamera.aspect = window.innerWidth / window.innerHeight;
    moonCamera.updateProjectionMatrix();
    moonRenderer.setSize(window.innerWidth, window.innerHeight);
    moonRenderer.setPixelRatio(window.devicePixelRatio);
}