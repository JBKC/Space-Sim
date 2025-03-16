import * as THREE from 'three';
import { EnvironmentControls } from '3d-tiles-renderer/src/three/controls/EnvironmentControls.js';
import { TilesRenderer } from '3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

let camera, controls, scene, renderer, tiles, cameraTarget;

// Camera setup
const baseCameraOffset = new THREE.Vector3(0, 2, 10);
const boostCameraOffset = new THREE.Vector3(0, 3, 70);
let currentCameraOffset = baseCameraOffset.clone();
const smoothFactor = 0.1;

// Rotation setup
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

// Spacecraft and flight variables
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
    // Create spacecraft group
    spacecraft = new THREE.Group();
    scene.add(spacecraft);
    
    // Create spacecraft body (simple placeholder - replace with your model)
    const bodyGeometry = new THREE.ConeGeometry(1, 5, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    spacecraft.add(body);
    
    // Create wings (simple placeholder - replace with your model)
    const wingGeometry = new THREE.BoxGeometry(3, 0.2, 1);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    
    topRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topRightWing.position.set(1.5, 0, -1);
    topRightWing.rotation.z = -Math.PI / 8;
    spacecraft.add(topRightWing);
    
    bottomRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomRightWing.position.set(1.5, 0, 1);
    bottomRightWing.rotation.z = Math.PI / 8;
    spacecraft.add(bottomRightWing);
    
    topLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topLeftWing.position.set(-1.5, 0, -1);
    topLeftWing.rotation.z = Math.PI + Math.PI / 8;
    spacecraft.add(topLeftWing);
    
    bottomLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomLeftWing.position.set(-1.5, 0, 1);
    bottomLeftWing.rotation.z = Math.PI - Math.PI / 8;
    spacecraft.add(bottomLeftWing);
    
    // Create engine glow
    engineGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
    const engineGlow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), engineGlowMaterial);
    engineGlow.position.z = -2.5;
    spacecraft.add(engineGlow);
    
    // Set initial position
    spacecraft.position.set(0, 0, 0);
    
    // Setup camera target
    cameraTarget = new THREE.Object3D();
    spacecraft.add(cameraTarget);
    cameraTarget.position.set(0, 0, 0);
}

init();
animate();


function updateMovement() {
    // Update speed based on boost state
    currentSpeed = keys.up ? boostSpeed : baseSpeed;
    
    // Update engine glow
    updateEngineEffects(keys.up);
    
    // Handle wing animation based on boost state
    if (keys.up && wingsOpen) {
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }
    
    // Reset rotation quaternions
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();
    
    // Apply rotations based on key input
    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed / 2);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed / 2);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed / 2);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed / 2);
    
    // Combine all rotations
    const combinedRotation = new THREE.Quaternion()
        .copy(rotation.roll)
        .multiply(rotation.pitch)
        .multiply(rotation.yaw);
    
    // Apply rotation to spacecraft
    spacecraft.quaternion.multiply(combinedRotation);
    
    // Get current forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);
    
    // Move spacecraft forward
    spacecraft.position.add(forward.multiplyScalar(currentSpeed));
    
    // Update wing animation if active
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

function updateCamera() {
    // Get boost status
    const isBoosting = keys.up;
    
    // Choose appropriate camera offset
    const localOffset = isBoosting ? boostCameraOffset.clone() : currentCameraOffset.clone();
    
    // Apply spacecraft's transformation to the offset
    const cameraPosition = localOffset.applyMatrix4(spacecraft.matrixWorld);
    
    // Smoothly move camera to new position
    camera.position.lerp(cameraPosition, smoothFactor);
    
    // Copy spacecraft orientation to camera
    camera.quaternion.copy(spacecraft.quaternion);
    
    // Adjust camera to look from behind
    const adjustment = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, Math.PI, 0)
    );
    camera.quaternion.multiply(adjustment);
}

function updateEngineEffects(isBoosting) {
    if (engineGlowMaterial) {
        engineGlowMaterial.opacity = isBoosting ? 0.8 : 0.5;
        engineGlowMaterial.color.setHex(isBoosting ? 0xff5500 : 0x00ffff);
    }
}

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

function init() {
    scene = new THREE.Scene();

    // Environment setup (keep this)
    const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.needsUpdate = true;
    scene.environment = env;

    // Renderer setup (keep this)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0x151c1f);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;

    // Camera setup (keep this)
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        1,
        100000
    );
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);

    // REMOVE the EnvironmentControls
    // controls = new EnvironmentControls(scene, camera, renderer.domElement);
    
    // Instead, create your spacecraft and camera rig
    initSpacecraft();

    // Load the tiles
    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    // Setup GUI (keep this)
    const gui = new GUI();
    gui.width = 300;
    const ionOptions = gui.addFolder('Ion');
    ionOptions.add(params, 'ionAssetId');
    ionOptions.add(params, 'ionAccessToken');
    ionOptions.add(params, 'reload');
    ionOptions.open();
    
    // Initialize keyboard controls
    initControls();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

function animate() {
    requestAnimationFrame(animate);

    if (!tiles) return;

    // Update spacecraft movement
    updateMovement();
    
    // Update camera position relative to spacecraft
    updateCamera();

    // Update tiles with camera
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);

    // Update world matrices
    camera.updateMatrixWorld();
    tiles.update();

    // Render scene
    renderer.render(scene, camera);
}