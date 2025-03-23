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
    PLANET_POSITION,
    rotation
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
        // console.log(`Engine effects updated - Boosting: ${isBoosting || keys.up}, Slowing: ${keys.down}`);
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

    // Reset rotations
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    // Apply rotations with very low sensitivity, only if not in hyperspace
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