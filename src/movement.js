// movement.js

// Called by various setup files

import * as THREE from 'three';
import { 
    spacecraft, 
    engineGlowMaterial, 
    lightMaterial, 
    topRightWing, 
    bottomRightWing, 
    topLeftWing, 
    bottomLeftWing, 
    updateEngineEffects,
    scene as spaceScene,
    PLANET_RADIUS,
    PLANET_POSITION
} from './setup.js';

// Movement and boost variables
export const baseSpeed = 5;
export const boostSpeed = baseSpeed * 5;
export const surfaceBoostSpeed = baseSpeed * 2; // Surface boost is 2x base speed
export let currentSpeed = baseSpeed;
export const turnSpeed = 0.03;
export let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

// Wing animation variables
export let wingsOpen = true;
export let wingAnimation = 0;
export const wingTransitionFrames = 30;

// Collision and bounce variables
const BOUNCE_FACTOR = 0.5;
const COLLISION_THRESHOLD = 20;
const COLLISION_PUSHBACK = 30;
let lastValidPosition = new THREE.Vector3();
let lastValidQuaternion = new THREE.Quaternion();

// Track game mode
let gameMode = null;

// Camera offsets - using negative Z to position behind the spacecraft
const baseCameraOffset = new THREE.Vector3(0, 2, -8); // Camera sits behind the spacecraft
const boostCameraOffset = new THREE.Vector3(0, 3, -20); // Further back during boost
const hyperspaceCameraOffset = new THREE.Vector3(0, 2, -5); // Even further back during hyperspace
export const surfaceCameraOffset = new THREE.Vector3(0, 2, -10);
// Current camera offset that will be interpolated
let currentCameraOffset = baseCameraOffset.clone();
// Target offset that we're interpolating towards
let targetCameraOffset = baseCameraOffset.clone();

// Camera transition parameters (between different speed states)
const cameraTransitionSpeed = 0.2; // Lower = slower transition, Higher = faster transition

// Camera smoothing and look ahead parameters
const smoothFactor = 0.1; // 0.1 = very laggy, 0.99 = almost no lag
const lookAheadDistance = 20; // How far ahead of the spacecraft to look (in local units)

// Camera position tracking for smooth interpolation
let lastCameraPosition = new THREE.Vector3();
let cameraInitialized = false;

// Initialize camera-related objects lazily
let cameraTarget = null;
let cameraRig = null;

// Function to set game mode
export function setGameMode(mode) {
    gameMode = mode;
}

// Function to reset movement inputs
export function resetMovementInputs() {
    keys.w = false;
    keys.s = false;
    keys.a = false;
    keys.d = false;
    keys.left = false;
    keys.right = false;
    keys.up = false;
    console.log('Movement inputs reset:', keys);
    // Reset wing animation to default open state after hyperspace
    if (!wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }
}

// Keyboard controls
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

// Rotation setup
export const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

export function updateCamera(camera, isHyperspace) {
    /**
     * Fixed Local-Space Camera System with Smooth State Transitions
     * ------------------------------------------------------------
     * This camera system attaches the camera directly to the spacecraft's
     * local coordinate system, while smoothly transitioning between states:
     * 
     * 1. The camera is always at a fixed position relative to the spacecraft
     * 2. The pivot point is exactly at the center of the spacecraft
     * 3. Camera movement is perfectly synchronized with spacecraft movement
     * 4. Smooth transitions between normal, boost, and hyperspace states
     */
    
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Determine the target camera offset based on the current mode
    if (isHyperspace) {
        targetCameraOffset = hyperspaceCameraOffset.clone();
    } else if (keys.up) {
        targetCameraOffset = boostCameraOffset.clone();
    } else {
        targetCameraOffset = baseCameraOffset.clone();
    }
    
    // Smooth interpolation between current offset and target offset
    currentCameraOffset.lerp(targetCameraOffset, cameraTransitionSpeed);
    
    // Get spacecraft's world matrix
    spacecraft.updateMatrixWorld();
    const worldMatrix = spacecraft.matrixWorld.clone();
    
    // Create a position vector from the interpolated offset
    const position = new THREE.Vector3();
    position.copy(currentCameraOffset);
    
    // Transform the local position to world space
    position.applyMatrix4(worldMatrix);
    
    // Set camera position directly
    camera.position.copy(position);
    
    // Set camera rotation to match spacecraft orientation (but looking forward)
    // We need to apply a 180-degree rotation to make the camera look forward
    const quaternion = spacecraft.getWorldQuaternion(new THREE.Quaternion());
    camera.quaternion.copy(quaternion);
    
    // Apply a 180-degree rotation around the Y axis to look forward
    const forwardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    camera.quaternion.multiply(forwardRotation);
    
    // Debug information if needed
    // console.log(`Camera offset: ${currentCameraOffset.x.toFixed(2)}, ${currentCameraOffset.y.toFixed(2)}, ${currentCameraOffset.z.toFixed(2)}`);
    // console.log(`Target offset: ${targetCameraOffset.x.toFixed(2)}, ${targetCameraOffset.y.toFixed(2)}, ${targetCameraOffset.z.toFixed(2)}`);
}

export function updateMovement(isBoosting, isHyperspace) {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateMovement");
        return;
    }

    // Original space movement behavior
    if (isHyperspace) {
        currentSpeed = baseSpeed * 50;
    } else if (isBoosting) {
        currentSpeed = boostSpeed;
    } else {
        currentSpeed = baseSpeed;
    }

    // Update engine effects
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(isBoosting);
        // Debug to confirm function call
        console.log(`Engine effects updated - Boosting: ${isBoosting}`);
    }

    // Trigger wing animation based on hyperspace and boost state
    if (isHyperspace && wingsOpen) {
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!isHyperspace && !isBoosting && !wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    } else if (isBoosting && wingsOpen) {
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    }

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Apply rotations with very low sensitivity, only if not in hyperspace
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (!isHyperspace) {
        if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed / 2);
        if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed / 2);
        if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed);
        if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed);
        if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed / 2);
        if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed / 2);
    }

    const combinedRotation = new THREE.Quaternion()
        .copy(rotation.roll)
        .multiply(rotation.pitch)
        .multiply(rotation.yaw);

    spacecraft.quaternion.multiply(combinedRotation);

    // Get current forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);

    // Calculate next position
    const nextPosition = spacecraft.position.clone().add(
        forward.multiplyScalar(currentSpeed)
    );

    // Check distance to planet for next position
    const distanceToPlanet = nextPosition.distanceTo(PLANET_POSITION);
    const minDistance = PLANET_RADIUS + COLLISION_THRESHOLD;

    if (distanceToPlanet < minDistance) {
        const toSpacecraft = new THREE.Vector3().subVectors(spacecraft.position, PLANET_POSITION).normalize();
        spacecraft.position.copy(PLANET_POSITION).add(
            toSpacecraft.multiplyScalar(minDistance + COLLISION_PUSHBACK)
        );
        const normal = toSpacecraft;
        const incidentDir = forward.normalize();
        const reflectDir = new THREE.Vector3();
        reflectDir.copy(incidentDir).reflect(normal);
        const bounceQuaternion = new THREE.Quaternion();
        bounceQuaternion.setFromUnitVectors(forward, reflectDir);
        spacecraft.quaternion.premultiply(bounceQuaternion);
        currentSpeed *= BOUNCE_FACTOR;
    } else {
        spacecraft.position.copy(nextPosition);
    }

    // Update wing animation if active
    if (wingAnimation > 0) {
        const targetAngle = wingsOpen ? Math.PI / 8 : 0;
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