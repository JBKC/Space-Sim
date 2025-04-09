// Contains all movement variables and movement-based state updates

import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { 
    spacecraft, 
    updateEngineEffects,
    scene as spaceScene,
    EARTH_RADIUS,
    EARTH_POSITION,
    rotation
} from './setup.js';


///// Movement Variables /////

// Space scene
export const baseSpeed = 5;
export const boostSpeed = baseSpeed * 5;
export const slowSpeed = baseSpeed * 0.5; // Half of base speed for slow mode
export const hyperspaceSpeed = baseSpeed * 50;
export let currentSpeed = baseSpeed;

export const baseTurnSpeed = 0.02;     // Regular turn speed
export const slowTurnSpeed = 0.025;     // More precise turning when moving slowly
export const boostTurnSpeed = 0.015;   // Less sensitive turning when boosting
export let currentTurnSpeed = baseTurnSpeed; // Current active turn speed


// Moon scene
export const moonBaseSpeed = 20;
export const moonBoostSpeed = moonBaseSpeed * 5;
export const moonSlowSpeed = moonBaseSpeed * 0.5; // Half of base speed for slow mode
export let moonCurrentSpeed = moonBaseSpeed;

export const moonBaseTurnSpeed = 0.02;     // Regular turn speed
export const moonSlowTurnSpeed = 0.025;     // More precise turning when moving slowly
export const moonBoostTurnSpeed = 0.015;   // Less sensitive turning when boosting
export let moonCurrentTurnSpeed = moonBaseTurnSpeed; // Current active turn speed


// General
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



/**
 * Core movement function to reuse across all scenes
 * Handles basic spacecraft movement including pitch, roll, yaw, speed adjustments
 * 
 * @param {boolean} isBoosting - Whether boost is active
 * @returns {Object|null} - The movement vectors or null if spacecraft not initialized
 */

export function updateCoreMovement(isBoosting) {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCoreMovement");
        return null;
    }
    
    // Determine current speed based on movement state
    if (isBoosting || keys.up) {
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
    }

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Reset rotations
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    // Apply rotations with normal sensitivity
        // Use currentTurnSpeed for pitch and yaw, but always use slowTurnSpeed for roll
        if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, currentTurnSpeed * pitchSensitivity);
        if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -currentTurnSpeed * pitchSensitivity);
        // Roll always uses slowTurnSpeed for more precise control regardless of movement mode
        if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -slowTurnSpeed * rollSensitivity);
        if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, slowTurnSpeed * rollSensitivity);
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

    return { forward, nextPosition };
}


///// SCENE-SPECIFIC MOVEMENT FUNCTIONS /////

/**
 * Updates spacecraft movement in the space environment
 * Combines core movement with space-specific features like hyperspace and planet collisions
 * 
 * @param {boolean} isBoosting - Whether boost is active
 * @param {boolean} isHyperspace - Whether hyperspace is active
 */
export function updateSpaceMovement(isBoosting, isHyperspace) {
    // Handle hyperspace-specific speed settings first (space-specific feature)
    if (isHyperspace) {
        currentSpeed = hyperspaceSpeed;
        currentTurnSpeed = boostTurnSpeed; // Use boost turn speed during hyperspace
        
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
    
    // For normal space movement, apply the core movement
    const result = updateCoreMovement(isBoosting);
    
    // If core movement failed (e.g. spacecraft not initialized), exit early
    if (!result) return;
    
    const { forward, nextPosition } = result;
    
    // Space-specific logic: Check for planet collision
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


/**
 * Updates spacecraft movement in the moon environment
 * Uses core movement mechanics but adds moon-specific terrain features
 */
export function updateMoonMovement() {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Handle wing animation for boost mode - moon specific handling
    const isInHyperspace = window.isHyperspace || false;
    
    // Use the proper setWingsOpen method instead of manual animation
    if (spacecraft && spacecraft.setWingsOpen) {
        const shouldWingsBeOpen = !keys.up && !isInHyperspace;
        spacecraft.setWingsOpen(shouldWingsBeOpen);
    } 
    // Fallback to manual animation if setWingsOpen is not available
    else if ((keys.up || isInHyperspace) && wingsOpen) {
        console.log(`moon: Closing wings due to ${isInHyperspace ? 'hyperspace' : 'boost'} mode`);
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !isInHyperspace && !wingsOpen) {
        console.log('moon: Opening wings for normal flight');
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    // Use core movement for basic spacecraft control
    const isBoosting = keys.up;
    const result = updateCoreMovement(isBoosting);
    
    // If core movement failed, exit early
    if (!result) return;
    
    const originalPosition = spacecraft.position.clone();
    const { forward } = result;
    
    // Moon-specific terrain handling
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
                    
                    // Hover height adjustment - moon specific
                    if (groundDistance < HOVER_HEIGHT) {
                        spacecraft.position.y += (HOVER_HEIGHT - groundDistance) * 0.2;
                    } else if (groundDistance > HOVER_HEIGHT * 1.5) {
                        spacecraft.position.y -= (groundDistance - HOVER_HEIGHT) * 0.015;
                    }
                }
            }
        } catch (error) {
            console.error("Error in hover adjustment:", error);
        }
    }
    
    // Apply forward motion - adjusted by terrain interaction above
    spacecraft.position.add(forward.multiplyScalar(currentSpeed));

    // Moon-specific collision detection
    try {
        if (tiles && tiles.group && tiles.group.children.length > 0) {
            if (checkTerrainCollision()) {
                console.log("Collision detected and resolved");
                // Handle collision by using the appropriate camera offset
                const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? 
                    spacecraft.isFirstPersonView() : false;
                const viewMode = isFirstPerson ? 'moonCockpit' : 'moon';
                
                // Force the camera state to use collision offsets
                cameraState.targetOffset = isFirstPerson ? 
                    moonCockpitCamera.collision.clone() : 
                    moonCamera.collision.clone();
                
                if (checkTerrainCollision()) {
                    console.log("Multiple collisions detected, reverting to original position");
                    spacecraft.position.copy(originalPosition);
                }
            }
        }
    } catch (error) {
        console.error("Error during collision detection:", error);
        spacecraft.position.copy(originalPosition);
    }

}
