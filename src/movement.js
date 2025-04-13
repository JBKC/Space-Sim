// Contains all movement variables and movement-based state updates

import * as THREE from 'three';
import { 
    spacecraft, 
    scene as spaceScene,
    EARTH_RADIUS,
    EARTH_POSITION,
    rotation
} from './spaceEnvs/setup.js';
import { keys, resetKeyStates } from './inputControls.js';

// Create a raycaster for collision detection
const raycaster = new THREE.Raycaster();

///// Movement Variables /////

// Space scene
export const baseSpeed = 5;
export const boostSpeed = baseSpeed * 5;
export const slowSpeed = baseSpeed * 0.5; // Half of base speed for slow mode
export let currentSpeed = baseSpeed;
export const hyperspaceSpeed = baseSpeed * 50;

export const baseTurnSpeed = 0.02;     // Regular turn speed
export const boostTurnSpeed = 0.015;   // Less sensitive turning when boosting
export const slowTurnSpeed = 0.025;     // More precise turning when moving slowly
export let currentTurnSpeed = baseTurnSpeed; // Current active turn speed


// Moon scene
export const moonBaseSpeed = 20;
export const moonBoostSpeed = moonBaseSpeed * 5;
export const moonSlowSpeed = moonBaseSpeed * 0.5; // Half of base speed for slow mode
export let moonCurrentSpeed = moonBaseSpeed;

export const moonBaseTurnSpeed = 0.02;     // Regular turn speed
export const moonBoostTurnSpeed = 0.015;   // Less sensitive turning when boosting
export const moonSlowTurnSpeed = 0.025;     // More precise turning when moving slowly
export let moonCurrentTurnSpeed = moonBaseTurnSpeed; // Current active turn speed

// Moon terrain parameters
export const HOVER_HEIGHT = 30; // Standard hover height above moon terrain
export const MAX_SLOPE_ANGLE = 30; // Maximum slope angle before terrain avoidance kicks in


// San Francisco scene
export const sanFranBaseSpeed = 1.5;
export const sanFranBoostSpeed = sanFranBaseSpeed * 3;
export const sanFranSlowSpeed = sanFranBaseSpeed * 0.5; // Half of base speed
export let sanFranCurrentSpeed = sanFranBaseSpeed;

export const sanFranBaseTurnSpeed = 0.025;     // Regular turn speed
export const sanFranBoostTurnSpeed = 0.02;   // Much less sensitive turning when boosting (stability at high speed)
export const sanFranSlowTurnSpeed = 0.03;     // More sensitive turning when moving slowly (urban precision)
export let sanFranCurrentTurnSpeed = sanFranBaseTurnSpeed; // Current active turn speed


// Washington (mountains) scene
export const washingtonBaseSpeed = 5;
export const washingtonBoostSpeed = washingtonBaseSpeed * 5;
export const washingtonSlowSpeed = washingtonBaseSpeed * 0.5; // Half of base speed
export let washingtonCurrentSpeed = washingtonBaseSpeed;

export const washingtonBaseTurnSpeed = 0.03;     // Regular turn speed
export const washingtonBoostTurnSpeed = 0.025;   // Much less sensitive turning when boosting (stability at high speed)
export const washingtonSlowTurnSpeed = 0.03;     // More sensitive turning when moving slowly (urban precision)
export let washingtonCurrentTurnSpeed = washingtonBaseTurnSpeed; // Current active turn speed


// General (constant across all environments)
export const pitchSensitivity = 0.6; // Lower value = less sensitive
export const rollSensitivity = 1;  // Lower value = less sensitive
export const yawSensitivity = 0.5;   // Lower value = less sensitive
export let wingsOpen = true;
export let wingAnimation = 0;
export const wingTransitionFrames = 30;


let lastValidPosition = new THREE.Vector3();
let lastValidQuaternion = new THREE.Quaternion();

// Track game mode
let gameMode = null;

// Export the surfaceCameraOffset for backward compatibility
export const surfaceCameraOffset = new THREE.Vector3(0, 0, 0);


// Function to reset movement inputs
export function resetMovementInputs() {
    // Reset key states using the function from inputControls.js
    resetKeyStates();
    
    // Reset wing animation to default open state after hyperspace
    if (!wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }
}


/**
 * CORE BOILERPLATE MOVEMENT FUNCTION
 * Handles basic spacecraft movement including pitch, roll, yaw, speed adjustments
 * 
 * @param {boolean} isBoosting - Whether boost is active
 * @param {string} environment - The current environment ('space', 'moon', 'sanFran', 'washington')
 * @returns {Object|null} - The movement vectors or null if spacecraft not initialized
 */
export function updateCoreMovement(isBoosting, environment = 'space') {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCoreMovement");
        return null;
    }
    
    // Determine which set of movement parameters to use based on environment
    let envSpeed, envBoostSpeed, envSlowSpeed, envBaseTurnSpeed, envBoostTurnSpeed, envSlowTurnSpeed;
    
    // Select parameters based on environment
    switch (environment) {
        case 'moon':
            envSpeed = moonBaseSpeed;
            envBoostSpeed = moonBoostSpeed;
            envSlowSpeed = moonSlowSpeed;
            envBaseTurnSpeed = moonBaseTurnSpeed;
            envBoostTurnSpeed = moonBoostTurnSpeed;
            envSlowTurnSpeed = moonSlowTurnSpeed;
            break;
        case 'sanFran':
            envSpeed = sanFranBaseSpeed;
            envBoostSpeed = sanFranBoostSpeed;
            envSlowSpeed = sanFranSlowSpeed;
            envBaseTurnSpeed = sanFranBaseTurnSpeed;
            envBoostTurnSpeed = sanFranBoostTurnSpeed;
            envSlowTurnSpeed = sanFranSlowTurnSpeed;
            break;
        case 'washington':
            envSpeed = washingtonBaseSpeed;
            envBoostSpeed = washingtonBoostSpeed;
            envSlowSpeed = washingtonSlowSpeed;
            envBaseTurnSpeed = washingtonBaseTurnSpeed;
            envBoostTurnSpeed = washingtonBoostTurnSpeed;
            envSlowTurnSpeed = washingtonSlowTurnSpeed;
            break;
        case 'space':
        default:
            envSpeed = baseSpeed;
            envBoostSpeed = boostSpeed;
            envSlowSpeed = slowSpeed;
            envBaseTurnSpeed = baseTurnSpeed;
            envBoostTurnSpeed = boostTurnSpeed;
            envSlowTurnSpeed = slowTurnSpeed;
            break;
    }
    
    // Determine current speed based on movement state
    if (isBoosting || keys.up) {
        currentSpeed = envBoostSpeed;
        currentTurnSpeed = envBoostTurnSpeed; // Less sensitive turns at high speed
    } else if (keys.down) {
        currentSpeed = envSlowSpeed;
        currentTurnSpeed = envSlowTurnSpeed; // More precise turns at low speed
    } else {
        currentSpeed = envSpeed;
        currentTurnSpeed = envBaseTurnSpeed; // Normal turn sensitivity
    }

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Reset rotations
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    // Apply rotations with environment-specific sensitivity
    // Use currentTurnSpeed for pitch and yaw, but always use slowTurnSpeed for roll
    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, currentTurnSpeed * pitchSensitivity);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -currentTurnSpeed * pitchSensitivity);
    // Roll always uses slowTurnSpeed for more precise control regardless of movement mode
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -envSlowTurnSpeed * rollSensitivity);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, envSlowTurnSpeed * rollSensitivity);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, currentTurnSpeed * yawSensitivity);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -currentTurnSpeed * yawSensitivity);

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

    return { forward, nextPosition, environment };
}


///// SCENE-SPECIFIC MOVEMENT FUNCTIONS /////


// MOVEMENT UPDATE FUNCTION //
export function updateSpaceMovement(isBoosting, isHyperspace) {

    // Collision and bounce variables
    const BOUNCE_FACTOR = 0.5;
    const COLLISION_THRESHOLD = 20;
    const COLLISION_PUSHBACK = 30;

    // First determine if hyperspace is active
    if (isHyperspace) {
        currentSpeed = hyperspaceSpeed;
        
        // Apply core movement without rotation in hyperspace
        // Store current state
        lastValidPosition.copy(spacecraft.position);
        lastValidQuaternion.copy(spacecraft.quaternion);
        
        // Get current forward direction
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(spacecraft.quaternion);
        
        // Calculate next position with hyperspace speed
        const nextPosition = spacecraft.position.clone().add(
            forward.multiplyScalar(currentSpeed)
        );
        
        // Move spacecraft forward in hyperspace
        spacecraft.position.copy(nextPosition);
        return;
    }
    
    // Apply default movement parameters (space env)
    // Note - this is where the boost effects live since it carries across all environments
    const result = updateCoreMovement(isBoosting, 'space');
    
    // If core movement failed (e.g. spacecraft not initialized), exit early
    if (!result) return;
    
    const { forward, nextPosition } = result;
    
    // Check for planet collision
    const distanceToPlanet = nextPosition.distanceTo(EARTH_POSITION);
    const minDistance = EARTH_RADIUS + COLLISION_THRESHOLD;

    if (distanceToPlanet < minDistance) {
        // Handle planet collision with bounce
        const toSpacecraft = new THREE.Vector3().subVectors(spacecraft.position, EARTH_POSITION).normalize();
        spacecraft.position.copy(EARTH_POSITION).add(
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
        // No collision, apply the calculated next position
        spacecraft.position.copy(nextPosition);
    }
} 



