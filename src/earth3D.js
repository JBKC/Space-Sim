import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from '/node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { createSpacecraft } from './spacecraft.js'; // Import the spacecraft function

let earthCamera, earthControls, earthScene, earthRenderer, tiles, earthCameraTarget;
let earthInitialized = false;

export { 
    earthScene, 
    earthCamera, 
    earthRenderer, 
    tiles, 
    earthCameraTarget 
};

const baseCameraOffset = new THREE.Vector3(0, 2, 10);
const boostCameraOffset = new THREE.Vector3(0, 3, 70);
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

const apiKey = localStorage.getItem('ionApiKey') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2NmMGU2Mi0zNDYxLTRhOTQtYmRiNi05Mzk0NTg4OTdjZDkiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MTI4Nzh9.ciqVryFsYbzdwKxd_nEANC8pHgU9ytlfylfpfy9Q56U';

const params = {
    ionAssetId: '75343',
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;
const baseSpeed = 2;
const boostSpeed = baseSpeed * 5;
let currentSpeed = baseSpeed;
const turnSpeed = 0.03;
let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

function initSpacecraft() {
    const spacecraftComponents = createSpacecraft(earthScene); // Pass the scene to add the spacecraft
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;

    // Set initial position
    spacecraft.position.set(0, 0, 0);

    // Setup camera target
    earthCameraTarget = new THREE.Object3D();
    spacecraft.add(earthCameraTarget);
    earthCameraTarget.position.set(0, 0, 0);

    // Assign the updateEngineEffects function from spacecraft.js
    updateEngineEffects = spacecraftComponents.updateEngineEffects;
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

    earthCamera.position.lerp(cameraPosition, smoothFactor);
    earthCamera.quaternion.copy(spacecraft.quaternion);

    const adjustment = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    earthCamera.quaternion.multiply(adjustment);
}

let updateEngineEffects; // This will be assigned in initSpacecraft

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
    earthScene.add(tiles.group);
}

function reinstantiateTiles() {
    if (tiles) {
        earthScene.remove(tiles.group);
        tiles.dispose();
        tiles = null;
    }

    localStorage.setItem('ionApiKey', params.ionAccessToken);

    tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: params.ionAccessToken, assetId: params.ionAssetId }));
    tiles.addEventListener('load-tile-set', () => {
        const sphere = new THREE.Sphere();
        tiles.getBoundingSphere(sphere);
        console.log('Bounding sphere center:', sphere.center);
        console.log('Bounding sphere radius:', sphere.radius);

        const position = sphere.center.clone();
        const distanceToEllipsoidCenter = position.length();

        const surfaceDirection = position.normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

        tiles.group.quaternion.x = rotationToNorthPole.x;
        tiles.group.quaternion.y = rotationToNorthPole.y;
        tiles.group.quaternion.z = rotationToNorthPole.z;
        tiles.group.quaternion.w = rotationToNorthPole.w;

        tiles.group.position.y = -distanceToEllipsoidCenter;
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
    console.log("Earth3D initialization started");
    
    if (earthInitialized) {
        console.log("Earth3D already initialized, skipping");
        return { scene: earthScene, camera: earthCamera, renderer: earthRenderer, tiles: tiles };
    }

    earthScene = new THREE.Scene();

    const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.needsUpdate = true;
    earthScene.environment = env;

    earthRenderer = new THREE.WebGLRenderer({ antialias: true });
    earthRenderer.setClearColor(0x151c1f);
    earthRenderer.setSize(window.innerWidth, window.innerHeight);
    earthRenderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(earthRenderer.domElement);
    earthRenderer.domElement.tabIndex = 1;

    earthCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100000);
    earthCamera.position.set(100, 100, -100);
    earthCamera.lookAt(0, 0, 0);
    
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

    earthInitialized = true;
    console.log("Earth3D initialization complete");
    
    return { 
        scene: earthScene, 
        camera: earthCamera, 
        renderer: earthRenderer, 
        tiles: tiles 
    };
}

export function update() {
    if (!tiles) {
        console.log("Earth tiles not loaded yet");
        return;
    }

    updateMovement();
    updateCamera();

    tiles.setCamera(earthCamera);
    tiles.setResolutionFromRenderer(earthCamera, earthRenderer);

    earthCamera.updateMatrixWorld();
    tiles.update();
}

function onWindowResize() {
    earthCamera.aspect = window.innerWidth / window.innerHeight;
    earthCamera.updateProjectionMatrix();
    earthRenderer.setSize(window.innerWidth, window.innerHeight);
    earthRenderer.setPixelRatio(window.devicePixelRatio);
}