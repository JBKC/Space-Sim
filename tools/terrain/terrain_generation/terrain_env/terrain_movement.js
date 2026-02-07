// movement.js

import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
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
    rotation
} from './terrain_setup.js';

// Movement and boost variables
export const baseSpeed = 5;
export const boostSpeed = baseSpeed * 5;
export const slowSpeed = baseSpeed * 0.5; // Half of base speed for slow mode
export let currentSpeed = baseSpeed;

// Turn speed variables for space environment
export const baseTurnSpeed = 0.02;     // Regular turn speed
export const slowTurnSpeed = 0.025;     // More precise turning when moving slowly
export const boostTurnSpeed = 0.015;   // Less sensitive turning when boosting
export let currentTurnSpeed = baseTurnSpeed; // Current active turn speed

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

// Export the surfaceCameraOffset for backward compatibility
export const surfaceCameraOffset = new THREE.Vector3(0, 0, 0);

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

export function updateMovement(isBoosting, isHyperspace) {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateMovement");
            return;
    }
    
    // Original space movement behavior
    if (isHyperspace) {
        currentSpeed = baseSpeed * 50;
        currentTurnSpeed = boostTurnSpeed; // Use boost turn speed during hyperspace
    } else if (isBoosting || keys.up) {
        currentSpeed = boostSpeed;
        currentTurnSpeed = boostTurnSpeed; // Less sensitive turns at high speed
    } else if (keys.down) {
        currentSpeed = slowSpeed;
        currentTurnSpeed = slowTurnSpeed; // More precise turns at low speed
    } else {
        currentSpeed = baseSpeed;
        currentTurnSpeed = baseTurnSpeed; // Normal turn sensitivity
    }

    // Update engine effects
    if (typeof updateEngineEffects === 'function') {
        updateEngineEffects(isBoosting || keys.up, keys.down);
        // Debug to confirm function call
        // console.log(`Engine effects updated - Boosting: ${isBoosting || keys.up}, Slowing: ${keys.down}`);
    }

    // NOTE: The wing animation logic has been moved to the spacecraft.js animation system
    // and is controlled via the setWingsOpen function. It responds to the same conditions,
    // but uses the built-in glTF animations instead of manual rotations.

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Reset rotations
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    // Apply rotations with very low sensitivity, only if not in hyperspace
    if (!isHyperspace) {
        // Use currentTurnSpeed for pitch and yaw, but always use slowTurnSpeed for roll
        if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, currentTurnSpeed * pitchSensitivity);
        if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -currentTurnSpeed * pitchSensitivity);
        // Roll always uses slowTurnSpeed for more precise control regardless of movement mode
        if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -slowTurnSpeed * rollSensitivity);
        if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, slowTurnSpeed * rollSensitivity);
        if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, currentTurnSpeed * yawSensitivity);
        if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -currentTurnSpeed * yawSensitivity);
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

    // The manual wing animation code has been removed as it's now handled
    // by the Three.js animation system in spacecraft.js
}