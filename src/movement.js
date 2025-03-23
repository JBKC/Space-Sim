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
export const slowSpeed = baseSpeed * 0.5; // Half of base speed for slow mode
export let currentSpeed = baseSpeed;
export const turnSpeed = 0.03;
// Add sensitivity multipliers for each rotation axis
export const pitchSensitivity = 0.6; // Lower value = less sensitive
export const rollSensitivity = 1;  // Lower value = less sensitive
export const yawSensitivity = 0.5;   // Lower value = less sensitive
export let keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false, down: false, space: false };

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
const slowCameraOffset = new THREE.Vector3(0, 2, -6); // Closer camera for slow mode
const hyperspaceCameraOffset = new THREE.Vector3(0, 2, -4); 
export const surfaceCameraOffset = new THREE.Vector3(0, 2, -10);
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

// Local rotation parameters (new)
const MAX_LOCAL_PITCH_ROTATION = 0.06; // Maximum rotation around local X axis (about 3.4 degrees)
const MAX_LOCAL_YAW_ROTATION = 0.08; // Maximum rotation around local Y axis (about 4.6 degrees)
const LOCAL_ROTATION_SPEED = 0.08; // How quickly local rotations are applied

// Current rotational offsets that will be smoothly interpolated
let currentPitchOffset = 0;
let currentYawOffset = 0;
// Target rotational offsets based on input
let targetPitchOffset = 0;
let targetYawOffset = 0;

// Current local rotation angles (new)
let currentLocalPitchRotation = 0;
let currentLocalYawRotation = 0;
// Target local rotation angles (new)
let targetLocalPitchRotation = 0;
let targetLocalYawRotation = 0;

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
    keys.down = false;
    keys.space = false;
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
        case 'ArrowDown': keys.down = true; break;
        case ' ': case 'Space': // Handle both space character and 'Space' string
            keys.space = true; 
            break;
    }
    
    // Also check event.code for Space
    if (event.code === 'Space') {
        keys.space = true;
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
        case ' ': case 'Space': // Handle both space character and 'Space' string
            keys.space = false; 
            break;
    }
    
    // Also check event.code for Space
    if (event.code === 'Space') {
        keys.space = false;
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

export function updateCamera(camera, isHyperspace, isSlowing) {
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
    if (isHyperspace) {
        targetCameraOffset = hyperspaceCameraOffset.clone();
    } else if (keys.up) {
        targetCameraOffset = boostCameraOffset.clone();
    } else if (isSlowing || keys.down) { // Check both passed parameter and keys state
        targetCameraOffset = slowCameraOffset.clone();
    } else {
        targetCameraOffset = baseCameraOffset.clone();
    }
    
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
    camera.position.copy(position);
    
    // Get the base spacecraft orientation
    const baseQuaternion = spacecraft.getWorldQuaternion(new THREE.Quaternion());
    
    // Create the global rotational offsets
    const pitchOffset = new THREE.Quaternion().setFromAxisAngle(rotation.pitchAxis, currentPitchOffset);
    const yawOffset = new THREE.Quaternion().setFromAxisAngle(rotation.yawAxis, currentYawOffset);
    
    // Combine the orientations: base orientation + global offsets + local rotations
    camera.quaternion.copy(baseQuaternion);
    camera.quaternion.multiply(pitchOffset);
    camera.quaternion.multiply(yawOffset);
    camera.quaternion.multiply(localPitchRotation);
    camera.quaternion.multiply(localYawRotation);
    
    // Apply the 180-degree rotation to look forward
    const forwardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    camera.quaternion.multiply(forwardRotation);
    
    // Debug information
    // console.log(`Camera local rotations - Pitch: ${(currentLocalPitchRotation * 180/Math.PI).toFixed(2)}°, Yaw: ${(currentLocalYawRotation * 180/Math.PI).toFixed(2)}°`);
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
    } else if (isBoosting || keys.up) {
        currentSpeed = boostSpeed;
    } else if (keys.down) {
        currentSpeed = slowSpeed;
    } else {
        currentSpeed = baseSpeed;
    }

    // Update engine effects
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(isBoosting || keys.up, keys.down);
        // Debug to confirm function call
        console.log(`Engine effects updated - Boosting: ${isBoosting || keys.up}, Slowing: ${keys.down}`);
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
        if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed * pitchSensitivity);
        if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed * pitchSensitivity);
        if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed * rollSensitivity);
        if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed * rollSensitivity);
        if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed * yawSensitivity);
        if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed * yawSensitivity);
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