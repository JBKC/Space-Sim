// src/movement.js
import { scene, isEarthSurfaceActive, earthSurfaceScene } from './setup.js';
import { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, PLANET_RADIUS, PLANET_POSITION, planet, updateEngineEffects } from './setup.js';
import { challengeComplete } from './gameLogic.js';

// Movement and boost variables
export const baseSpeed = 2;
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

// Camera offsets
const baseCameraOffset = new THREE.Vector3(0, 2, 10);
const boostCameraOffset = new THREE.Vector3(0, 3, 70);
const hyperspaceCameraOffset = new THREE.Vector3(0, 2, 1346);
// Surface camera offset - adjust these values to change the camera position on Earth's surface
export const surfaceCameraOffset = new THREE.Vector3(0, 2, 10);
let currentCameraOffset = baseCameraOffset.clone();
const smoothFactor = 0.1;

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
    if (!gameMode || challengeComplete) return;
    
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
    if (challengeComplete) return;
    
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

// Third-person camera setup
export const cameraTarget = new THREE.Object3D();
spacecraft.add(cameraTarget);
cameraTarget.position.set(0, 0, 0);

export const cameraRig = new THREE.Object3D();
scene.add(cameraRig);

export function updateCamera(camera, isHyperspace) {
    const targetPosition = new THREE.Vector3();
    spacecraft.getWorldPosition(targetPosition);

    // If in Earth surface mode, use a different camera setup
    if (isEarthSurfaceActive) {
        // Get the spacecraft from the Earth surface scene
        const earthSpacecraft = earthSurfaceScene.children.find(obj => 
            obj.type === 'Group' && obj.name === "EarthSurfaceSpacecraft"
        );
        
        if (earthSpacecraft) {
            // Use the dedicated surface camera offset
            const surfaceCameraPosition = surfaceCameraOffset.clone().applyMatrix4(earthSpacecraft.matrixWorld);
            
            camera.position.lerp(surfaceCameraPosition, smoothFactor);
            camera.quaternion.copy(earthSpacecraft.quaternion);
            
            const adjustment = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, Math.PI, 0)
            );
            camera.quaternion.multiply(adjustment);
            return;
        }
    }

    // Original space camera behavior
    const localOffset = isHyperspace ? hyperspaceCameraOffset.clone() : (keys.up ? boostCameraOffset.clone() : currentCameraOffset.clone());
    
    const cameraPosition = localOffset.applyMatrix4(spacecraft.matrixWorld);

    camera.position.lerp(cameraPosition, smoothFactor);
    camera.quaternion.copy(spacecraft.quaternion);

    const adjustment = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, Math.PI, 0)
    );
    camera.quaternion.multiply(adjustment);
}

export function updateMovement(isBoosting, isHyperspace) {
    if (challengeComplete) {
        return;
    }
    
    // If in Earth surface mode, handle surface movement
    if (isEarthSurfaceActive) {
        // Get the spacecraft from the Earth surface scene
        const earthSpacecraft = earthSurfaceScene.children.find(obj => 
            obj.type === 'Group' && obj.name === "EarthSurfaceSpacecraft"
        );
        
        if (earthSpacecraft) {
            // Use the same movement mechanics as in space
            // Update speed based on boost state (no hyperspace in surface mode)
            let surfaceSpeed = baseSpeed;
            const isSurfaceBoosting = keys.up;
            if (isSurfaceBoosting) {
                surfaceSpeed = surfaceBoostSpeed; // Use surface-specific boost speed
            }
            
            // Update engine effects for surface spacecraft
            updateEngineEffects(isSurfaceBoosting);
            
            // Handle wing configuration based on boost state
            // This ensures wings match the space behavior (X when normal, straight when boosting)
            if (isSurfaceBoosting && wingsOpen) {
                // Fold wings when boosting
                wingsOpen = false;
                wingAnimation = wingTransitionFrames;
            } else if (!isSurfaceBoosting && !wingsOpen) {
                // Open wings when not boosting
                wingsOpen = true;
                wingAnimation = wingTransitionFrames;
            }
            
            // Apply rotations with the same sensitivity as in space
            rotation.pitch.identity();
            rotation.yaw.identity();
            rotation.roll.identity();
            
            // Use the same rotation controls as in space
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
            
            earthSpacecraft.quaternion.multiply(combinedRotation);
            
            // Get current forward direction
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(earthSpacecraft.quaternion);
            
            // Allow full 3D movement like in space
            earthSpacecraft.position.add(forward.multiplyScalar(surfaceSpeed));
            
            // Calculate the nose position (front of spacecraft)
            const noseOffset = new THREE.Vector3(0, 0, 2.5); // Approximate length from center to nose
            const nosePosition = noseOffset.clone().applyQuaternion(earthSpacecraft.quaternion);
            const noseWorldPosition = nosePosition.add(earthSpacecraft.position);
            
            // Ensure minimum height for the spacecraft's center, but allow the nose to get closer
            // this is the minimum height for the spacecraft's center, but allow the nose to get closer
            const minHeight = 0;
            
            // If the center of the spacecraft is below minimum height, adjust it
            if (earthSpacecraft.position.y < minHeight) {
                earthSpacecraft.position.y = minHeight;
            }
            
            // Allow the nose to touch the ground (y=0) but prevent going below
            if (noseWorldPosition.y < 0) {
                // Calculate how much to move the spacecraft up to keep nose at ground level
                const adjustment = -noseWorldPosition.y;
                earthSpacecraft.position.y += adjustment;
            }
            
            // Update wing animation for the Earth surface spacecraft
            if (wingAnimation > 0) {
                // Find the wing components in the Earth surface spacecraft
                const surfaceWings = {
                    topRight: earthSpacecraft.children.find(child => child.name === "topRightWing"),
                    bottomRight: earthSpacecraft.children.find(child => child.name === "bottomRightWing"),
                    topLeft: earthSpacecraft.children.find(child => child.name === "topLeftWing"),
                    bottomLeft: earthSpacecraft.children.find(child => child.name === "bottomLeftWing")
                };
                
                const targetAngle = wingsOpen ? Math.PI / 8 : 0;
                const angleStep = (Math.PI / 8) / wingTransitionFrames;
                
                // Apply wing animation to surface spacecraft wings if they exist
                if (surfaceWings.topRight && surfaceWings.bottomRight && 
                    surfaceWings.topLeft && surfaceWings.bottomLeft) {
                    
                    if (wingsOpen) {
                        surfaceWings.topRight.rotation.z = Math.max(surfaceWings.topRight.rotation.z - angleStep, -Math.PI / 8);
                        surfaceWings.bottomRight.rotation.z = Math.min(surfaceWings.bottomRight.rotation.z + angleStep, Math.PI / 8);
                        surfaceWings.topLeft.rotation.z = Math.min(surfaceWings.topLeft.rotation.z + angleStep, Math.PI + Math.PI / 8);
                        surfaceWings.bottomLeft.rotation.z = Math.max(surfaceWings.bottomLeft.rotation.z - angleStep, Math.PI - Math.PI / 8);
                    } else {
                        surfaceWings.topRight.rotation.z = Math.min(surfaceWings.topRight.rotation.z + angleStep, 0);
                        surfaceWings.bottomRight.rotation.z = Math.max(surfaceWings.bottomRight.rotation.z - angleStep, 0);
                        surfaceWings.topLeft.rotation.z = Math.max(surfaceWings.topLeft.rotation.z - angleStep, Math.PI);
                        surfaceWings.bottomLeft.rotation.z = Math.min(surfaceWings.bottomLeft.rotation.z + angleStep, Math.PI);
                    }
                }
                
                wingAnimation--;
            }
            
            return;
        }
    }
    
    // Original space movement behavior
    // Update speed based on boost and hyperspace state
    if (isHyperspace) {
        currentSpeed = 150;
    } else if (isBoosting) {
        currentSpeed = boostSpeed;
    } else {
        currentSpeed = baseSpeed;
    }

    // Update engine effects
    updateEngineEffects(keys.up);

    // Trigger wing animation based on hyperspace and boost state
    if (isHyperspace && wingsOpen) {
        // Fold wings when entering hyperspace
        wingsOpen = false;
        wingAnimation = wingTransitionFrames;
    } else if (!isHyperspace && !isBoosting && !wingsOpen) {
        // Open wings when not in hyperspace and not boosting
        wingsOpen = true;
        wingAnimation = wingTransitionFrames;
    } else if (isBoosting && wingsOpen) {
        // Fold wings when boosting (outside hyperspace)
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