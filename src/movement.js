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
    // Use resetKeyStates from inputControls.js
    resetKeyStates();
    
    // Reset wing animation to default open state after hyperspace
    if (!wingsOpen) {
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }
}

// Keyboard controls are now handled in inputControls.js

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





/**
 * Updates spacecraft movement in the San Francisco environment
 * Uses core movement mechanics but adds city-specific features
 */
export function updateSanFranMovement() {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Handle wing animation for boost mode - San Francisco specific handling
    const isInHyperspace = window.isHyperspace || false;
    
    // Use the proper setWingsOpen method instead of manual animation
    if (spacecraft && spacecraft.setWingsOpen) {
        const shouldWingsBeOpen = !keys.up && !isInHyperspace;
        spacecraft.setWingsOpen(shouldWingsBeOpen);
    } 
    // Fallback to manual animation if setWingsOpen is not available
    else if ((keys.up || isInHyperspace) && wingsOpen) {
        console.log(`sanFran: Closing wings due to ${isInHyperspace ? 'hyperspace' : 'boost'} mode`);
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !isInHyperspace && !wingsOpen) {
        console.log('sanFran: Opening wings for normal flight');
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    // Use core movement for basic spacecraft control
    const isBoosting = keys.up;
    const result = updateCoreMovement(isBoosting, 'sanFran');
    
    // If core movement failed, exit early
    if (!result) return;
    
    const originalPosition = spacecraft.position.clone();
    const { forward, nextPosition } = result;
    
    // San Francisco specific terrain handling
    if (tiles && tiles.group && tiles.group.children.length > 0) {
        try {
            const terrainMeshes = [];
            tiles.group.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    terrainMeshes.push(object);
                }
            });
            
            if (terrainMeshes.length > 0) {
                // San Francisco terrain logic here
                // This could include:
                // - Building collision detection
                // - Height restrictions
                // - Traffic system interaction
                // - Special effects for flying between buildings
                
                // Example building collision detection
                const buildingRaycaster = new THREE.Raycaster();
                buildingRaycaster.set(spacecraft.position, forward);
                buildingRaycaster.near = 0;
                buildingRaycaster.far = 50; // Detect buildings ahead
                
                const buildingHits = buildingRaycaster.intersectObjects(terrainMeshes, false);
                if (buildingHits.length > 0) {
                    // Handle building collision
                    console.log("Building collision detected");
                    
                    // Don't move forward into building
                    return;
                }
                
                // Ground distance check for height adjustment
                const downDirection = new THREE.Vector3(0, -1, 0);
                const groundRaycaster = new THREE.Raycaster();
                groundRaycaster.set(spacecraft.position, downDirection);
                groundRaycaster.near = 0;
                groundRaycaster.far = 1000;
                
                const groundHits = groundRaycaster.intersectObjects(terrainMeshes, false);
                if (groundHits.length > 0) {
                    const groundDistance = groundHits[0].distance;
                    const HOVER_HEIGHT = 20; // Hover height for San Francisco (lower than moon)
                    
                    // Hover height adjustment - San Francisco specific
                    if (groundDistance < HOVER_HEIGHT) {
                        spacecraft.position.y += (HOVER_HEIGHT - groundDistance) * 0.2;
                    } else if (groundDistance > HOVER_HEIGHT * 2) {
                        spacecraft.position.y -= (groundDistance - HOVER_HEIGHT) * 0.02;
                    }
                }
            }
        } catch (error) {
            console.error("Error in San Francisco terrain handling:", error);
        }
    }
    
    // Apply forward motion if no collisions
    spacecraft.position.copy(nextPosition);
}

/**
 * Updates spacecraft movement in the Washington mountains environment
 * Uses core movement mechanics but adds mountain-specific features
 */
export function updateWashingtonMovement() {
    // Check if spacecraft is initialized
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet");
        return;
    }

    // Handle wing animation for boost mode - Washington specific handling
    const isInHyperspace = window.isHyperspace || false;
    
    // Use the proper setWingsOpen method instead of manual animation
    if (spacecraft && spacecraft.setWingsOpen) {
        const shouldWingsBeOpen = !keys.up && !isInHyperspace;
        spacecraft.setWingsOpen(shouldWingsBeOpen);
    } 
    // Fallback to manual animation if setWingsOpen is not available
    else if ((keys.up || isInHyperspace) && wingsOpen) {
        console.log(`washington: Closing wings due to ${isInHyperspace ? 'hyperspace' : 'boost'} mode`);
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!keys.up && !isInHyperspace && !wingsOpen) {
        console.log('washington: Opening wings for normal flight');
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    }

    // Use core movement for basic spacecraft control
    const isBoosting = keys.up;
    const result = updateCoreMovement(isBoosting, 'washington');
    
    // If core movement failed, exit early
    if (!result) return;
    
    const originalPosition = spacecraft.position.clone();
    const { forward, nextPosition } = result;
    
    // Washington mountains specific terrain handling
    if (tiles && tiles.group && tiles.group.children.length > 0) {
        try {
            const terrainMeshes = [];
            tiles.group.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    terrainMeshes.push(object);
                }
            });
            
            if (terrainMeshes.length > 0) {
                // Mountain terrain checks
                const HOVER_HEIGHT = 35; // Higher hover height for mountains
                const MAX_SLOPE_ANGLE = 35; // Steeper slope tolerance for mountain flying
                
                // Forward terrain check (mountain ahead)
                const forwardRaycaster = new THREE.Raycaster();
                forwardRaycaster.set(spacecraft.position, forward);
                forwardRaycaster.near = 0;
                forwardRaycaster.far = 100; // Longer distance to detect mountains ahead
                
                const mountainHits = forwardRaycaster.intersectObjects(terrainMeshes, false);
                if (mountainHits.length > 0) {
                    // Handle mountain collision - automatically gain altitude when approaching mountains
                    const mountainDistance = mountainHits[0].distance;
                    const mountainNormal = mountainHits[0].normal;
                    
                    if (mountainDistance < 60) {
                        // Go up slightly when approaching mountains
                        spacecraft.position.y += (60 - mountainDistance) * 0.05;
                        
                        if (mountainDistance < 30) {
                            // Try to align with mountain slope when very close
                            if (mountainNormal) {
                                const upVector = new THREE.Vector3(0, 1, 0);
                                const slopeAngle = Math.acos(mountainNormal.dot(upVector)) * (180 / Math.PI);
                                
                                if (slopeAngle > MAX_SLOPE_ANGLE) {
                                    // Adjust movement direction to follow mountain contour
                                    const rightVector = new THREE.Vector3().crossVectors(forward, upVector).normalize();
                                    const adjustedForward = new THREE.Vector3().crossVectors(rightVector, mountainNormal).normalize();
                                    forward.lerp(adjustedForward, 0.3); // Lighter adjustment for mountains
                                }
                            }
                        }
                    }
                }
                
                // Ground distance check for height adjustment
                const downDirection = new THREE.Vector3(0, -1, 0);
                const groundRaycaster = new THREE.Raycaster();
                groundRaycaster.set(spacecraft.position, downDirection);
                groundRaycaster.near = 0;
                groundRaycaster.far = 1000;
                
                const groundHits = groundRaycaster.intersectObjects(terrainMeshes, false);
                if (groundHits.length > 0) {
                    const groundDistance = groundHits[0].distance;
                    
                    // Washington-specific hover height adjustment
                    if (groundDistance < HOVER_HEIGHT) {
                        spacecraft.position.y += (HOVER_HEIGHT - groundDistance) * 0.15;
                    } else if (groundDistance > HOVER_HEIGHT * 2) {
                        // Slower descent in mountains for safer flying
                        spacecraft.position.y -= (groundDistance - HOVER_HEIGHT) * 0.01;
                    }
                }
            }
        } catch (error) {
            console.error("Error in Washington mountains terrain handling:", error);
        }
    }
    
    // Apply forward motion adjusted by terrain interaction above
    spacecraft.position.copy(nextPosition);
}
