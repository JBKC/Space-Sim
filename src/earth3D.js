import * as THREE from 'three';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/src/three/TilesRenderer.js';
import { CesiumIonAuthPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/CesiumIonAuthPlugin.js';
import { GLTFExtensionsPlugin } from '/node_modules/3d-tiles-renderer/src/plugins/three/GLTFExtensionsPlugin.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from '/node_modules/three/examples/jsm/libs/lil-gui.module.min.js';

let scene, camera, controls, renderer, tiles, cameraTarget;

// Earth surface environment
export const earthSurfaceScene = new THREE.Scene();
let setupModule;

// Flag to track which scene is active
export let isEarthSurfaceActive = false;
// Flag to track if transition is in progress
export let isTransitionInProgress = false;

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
    earthSurfaceScene.add(spacecraft);
    
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

renderScene();


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
    earthSurfaceScene.add(tiles.group);
}

function reinstantiateTiles() {
    if (tiles) {
        earthSurfaceScene.remove(tiles.group);
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


export function renderScene() {
    if (!setupModule) return; // Wait until setup module is available
    
    if (isEarthSurfaceActive) {
        // render the planet surface with 3D tiles

        // Environment setup (keep this)
        const env = new THREE.DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
        env.mapping = THREE.EquirectangularReflectionMapping;
        env.needsUpdate = true;
        earthSurfaceScene.environment = env;
    
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
    
        // create your spacecraft and camera rig
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

        setupModule.renderer.render(earthSurfaceScene, setupModule.camera);
    } else {
        // render the space scene
        setupModule.renderer.render(setupModule.scene, setupModule.camera);
    }
}

export function initializeEarthTerrain(setup) {
    setupModule = setup;
}

// Function to check if spacecraft is near Earth
export function checkEarthProximity() {
    if (!setupModule) return; // Wait until setup module is available
    
    // Calculate distance between spacecraft and Earth
    const earthPosition = setupModule.earthGroup.position.clone();
    const spacecraftPosition = setupModule.spacecraft.position.clone();
    const distance = earthPosition.distanceTo(spacecraftPosition);
    
    // Start transition when within detection zone but before actual transition
    if (distance < setupModule.planetRadius + 800 && !isEarthSurfaceActive && !isTransitionInProgress) {
        // Start the pre-transition effect while still in space
        startAtmosphereTransition();
    }
    
    // Actual transition to surface happens at a closer distance
    if (distance < setupModule.planetRadius + 500 && !isEarthSurfaceActive && isTransitionInProgress) {
        // Only transition to surface after the mist has built up
        const overlay = document.getElementById('transition-overlay');
        if (overlay && parseFloat(getComputedStyle(overlay).opacity) > 0.3) {
            transitionToEarthSurface();
        }
    }
}

// Function to start the atmosphere transition effect while still in space
function startAtmosphereTransition() {
    console.log("Approaching Earth's atmosphere...");
    isTransitionInProgress = true;
    
    // Create a transition overlay element with initial transparency
    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(135, 206, 250, 0)'; // Start transparent
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none'; // Don't block user interaction
    overlay.style.zIndex = '999';
    document.body.appendChild(overlay);
    
    // Gradually increase the mist over 0.75 seconds (reduced from 1 second)
    const transitionDuration = 1000;
    const startTime = performance.now();
    
    function animatePreTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        
        // Gradually increase overlay opacity
        overlay.style.opacity = (0.6 * progress).toString();
        
        if (progress < 1 && !isEarthSurfaceActive) {
            requestAnimationFrame(animatePreTransition);
        }
    }
    
    // Start the animation
    animatePreTransition();
}

// Function to transition to Earth surface environment
export function transitionToEarthSurface() {
    if (!setupModule) return; // Wait until setup module is available
    
    console.log("Entering Earth's atmosphere!");
    isEarthSurfaceActive = true;
    
    // Clear any existing spacecraft from the Earth surface scene
    earthSurfaceScene.children.forEach(child => {
        if (child.type === 'Group' && child !== earthSurface) {
            earthSurfaceScene.remove(child);
        }
    });
    
    // Create a new spacecraft for the Earth surface scene
    const earthSpacecraft = new THREE.Group();
    earthSpacecraft.name = "EarthSurfaceSpacecraft";
    
    // Copy the original spacecraft's children
    setupModule.spacecraft.children.forEach(child => {
        const childClone = child.clone();
        // Preserve the original name if it exists
        if (child.name) {
            childClone.name = child.name;
        }
        earthSpacecraft.add(childClone);
    });
    
    // Position the spacecraft at the top of the screen with a steep downward angle
    // Higher Y position and negative Z position (coming from top of screen)
    earthSpacecraft.position.set(0, 4000, -2000); // High altitude and behind (negative Z)
    
    // Set rotation to point downward at approximately 45 degrees
    const pitchAngle = -Math.PI * 0.25; // Negative angle for downward pitch from top of screen
    earthSpacecraft.rotation.set(pitchAngle, 0, 0);
    
    // Add to scene
    earthSurfaceScene.add(earthSpacecraft);
    
    // Get the existing overlay from the pre-transition
    const existingOverlay = document.getElementById('transition-overlay');
    
    // Create a more gradual transition effect with fog
    const transitionDuration = 1000; // 0.75 seconds to clear the fog (reduced from 1 second)
    const startTime = performance.now();
    
    // Store original fog density for restoration after effect
    const originalFogDensity = 0.0003;
    
    // Create initial fog with higher density
    earthSurfaceScene.fog = new THREE.FogExp2(0x87CEFA, 0.02);
    
    // Store original camera position for animation
    const originalCameraPosition = new THREE.Vector3(0, 0, 10); // Default camera position
    
    // Animate the transition - fog clearing phase only
    function animateTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        
        // Gradually decrease fog density back to original
        const currentFogDensity = 0.02 - (0.02 - originalFogDensity) * progress;
        earthSurfaceScene.fog.density = currentFogDensity;
        
        // Gradually decrease overlay opacity
        if (existingOverlay) {
            existingOverlay.style.opacity = (0.6 * (1 - progress)).toString();
        }
        
        // Animate spacecraft descending from the top
        if (earthSpacecraft) {
            // Calculate new position - gradually descending and moving forward
            const newY = 4000 - (4000 - 1500) * progress; // From 4000 to 1500
            const newZ = -2000 + (2000 + 500) * progress; // From -2000 to 500 (coming from top/back to front)
            
            // Update spacecraft position
            earthSpacecraft.position.set(0, newY, newZ);
            
            // Gradually level out the spacecraft as it descends
            const newPitch = -Math.PI * 0.25 + (Math.PI * 0.45) * progress; // From -45° to +20°
            earthSpacecraft.rotation.set(newPitch, 0, 0);
            
            // Move camera closer to spacecraft during transition
            if (setupModule.camera) {
                // Calculate camera offset - start further away, move closer
                const cameraDistance = 10 - 5 * progress; // Move camera from 10 units to 5 units away
                
                // Update camera position relative to spacecraft
                // We don't directly set camera position here as it's managed by the camera controls
                // Instead we'll use this value in the movement.js file
            }
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateTransition);
        } else {
            // Transition complete, remove overlay
            if (existingOverlay) {
                document.body.removeChild(existingOverlay);
            }
            
            // Ensure fog is back to original settings
            earthSurfaceScene.fog.density = originalFogDensity;
            
            // Reset transition flag
            isTransitionInProgress = false;
            
            // Display the persistent message
            displayEarthSurfaceMessage();
        }
    }
    
    // Start the animation
    animateTransition();
}


// Function to display the Earth surface message (extracted from transitionToEarthSurface)
function displayEarthSurfaceMessage() {
    // Display a message to the user
    const message = document.createElement('div');
    message.id = 'earth-surface-message';
    message.style.position = 'absolute';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.color = 'white';
    message.style.fontFamily = 'Orbitron, sans-serif';
    message.style.fontSize = '18px';
    message.style.textAlign = 'center';
    message.style.padding = '8px 15px';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    message.style.borderRadius = '5px';
    message.style.zIndex = '1000';
    message.textContent = 'Press ESC to leave Earth\'s atmosphere';
    document.body.appendChild(message);
}

// Function to exit Earth surface environment and return to space
export function exitEarthSurface() {
    if (!setupModule) return; // Wait until setup module is available
    
    console.log("Exiting Earth's atmosphere!");
    isEarthSurfaceActive = false;
    isTransitionInProgress = false;
    
    // Remove the persistent Earth surface message if it exists
    const persistentMessage = document.getElementById('earth-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Position spacecraft away from Earth to avoid immediate re-entry
    // Calculate a position that's 3x the planet radius + 1000 units away from Earth
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    setupModule.spacecraft.position.set(
        setupModule.earthGroup.position.x + directionVector.x * (setupModule.planetRadius * 3 + 1000),
        setupModule.earthGroup.position.y + directionVector.y * (setupModule.planetRadius * 3 + 1000),
        setupModule.earthGroup.position.z + directionVector.z * (setupModule.planetRadius * 3 + 1000)
    );
    
    // Reset spacecraft rotation to look toward the center of the solar system
    setupModule.spacecraft.lookAt(new THREE.Vector3(0, 0, 0));
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

export function animate() {
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