// src/movement.js
import { scene } from './setup.js';
import { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, PLANET_RADIUS, PLANET_POSITION, planet, updateEngineEffects } from './setup.js';
import { challengeComplete } from './gameLogic.js';

// Movement and boost variables with very low sensitivity
export const baseSpeed = 0.4   
export const boostSpeed = 0.8;   // Moderate boost speed
export let currentSpeed = baseSpeed;
export const turnSpeed = 0.03; 
export const keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };
export let boostDuration = 0;
export const boostMaxDuration = 120;

// Wing animation variables
export let wingsOpen = true;
export let wingAnimation = 0;
export const wingTransitionFrames = 30;

// Collision and bounce variables
const BOUNCE_FACTOR = 0.5;
const COLLISION_THRESHOLD = 20; // Increased safety margin
const COLLISION_PUSHBACK = 30; // How far to push back from collision
let lastValidPosition = new THREE.Vector3();
let lastValidQuaternion = new THREE.Quaternion();

// Keyboard controls
document.addEventListener('keydown', (event) => {
    if (challengeComplete) return; // Disable controls if challenge is complete
    
    switch (event.key) {
        case 'w': keys.w = true; break;
        case 's': keys.s = true; break;
        case 'a': keys.a = true; break;
        case 'd': keys.d = true; break;
        case 'ArrowLeft': keys.left = true; break;
        case 'ArrowRight': keys.right = true; break;
        case 'ArrowUp':
            if (!keys.up && boostDuration === 0) {
                keys.up = true;
                boostDuration = boostMaxDuration;
                if (wingsOpen) {
                    wingsOpen = false;
                    wingAnimation = wingTransitionFrames;
                }
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    if (challengeComplete) return; // Disable controls if challenge is complete
    
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
 rollAxis: new THREE.Vector3(0, 0, 1 )
};

// Third-person camera setup
const cameraOffset = new THREE.Vector3(0, 2, -7);
let smoothFactor = 0.1;

export const cameraTarget = new THREE.Object3D();
spacecraft.add(cameraTarget);
cameraTarget.position.set(0, 0, 0);

export const cameraRig = new THREE.Object3D();
scene.add(cameraRig);

export function updateCamera(camera) {
 const targetPosition = new THREE.Vector3();
 spacecraft.getWorldPosition(targetPosition);

 const localOffset = cameraOffset.clone();
 const cameraPosition = localOffset.clone().applyMatrix4(spacecraft.matrixWorld);

 camera.position.lerp(cameraPosition, smoothFactor);
 camera.quaternion.copy(spacecraft.quaternion);

 const adjustment = new THREE.Quaternion().setFromEuler(
 new THREE.Euler(0, Math.PI, 0)
 );
 camera.quaternion.multiply(adjustment);
}

export function updateMovement() {
    if (challengeComplete) {
        // If challenge is complete, only update camera but no movement
        return;
    }
    
    // Update boost state
    const isBoost = boostDuration > 0;
    if (isBoost) {
        currentSpeed = boostSpeed;
        boostDuration--;
    } else {
        currentSpeed = baseSpeed;
    }

    // Update engine effects
    updateEngineEffects(isBoost);

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Apply rotations with very low sensitivity
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed/2);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed/2);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed/2);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed/2);

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
        // We would hit the planet - handle collision

        // Get direction from planet center to spacecraft
        const toSpacecraft = new THREE.Vector3().subVectors(spacecraft.position, PLANET_POSITION).normalize();
        
        // Place spacecraft at safe distance
        spacecraft.position.copy(PLANET_POSITION).add(
            toSpacecraft.multiplyScalar(minDistance + COLLISION_PUSHBACK)
        );

        // Calculate bounce direction
        const normal = toSpacecraft;
        const incidentDir = forward.normalize();
        const reflectDir = new THREE.Vector3();
        reflectDir.copy(incidentDir).reflect(normal);

        // Set new orientation to bounce direction
        const bounceQuaternion = new THREE.Quaternion();
        bounceQuaternion.setFromUnitVectors(forward, reflectDir);
        spacecraft.quaternion.premultiply(bounceQuaternion);

        // Reduce speed
        currentSpeed *= BOUNCE_FACTOR;
    } else {
        // Safe to move
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