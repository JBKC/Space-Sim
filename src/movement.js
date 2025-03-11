// src/movement.js
import { scene } from './setup.js';
import { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, PLANET_RADIUS, PLANET_POSITION, planet, updateEngineEffects } from './setup.js';
import { challengeComplete } from './gameLogic.js';

// Movement and boost variables
export const baseSpeed = 1.0;
export const boostSpeed = 3.0;
export let currentSpeed = baseSpeed;
export const turnSpeed = 0.03;
export const keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };

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
const baseCameraOffset = new THREE.Vector3(0, 2, -2); // Normal offset
const boostCameraOffset = new THREE.Vector3(0, 3, 5); // Boost offset: farther back and higher
let currentCameraOffset = baseCameraOffset.clone(); // Dynamic offset
const smoothFactor = 0.1; // Smoothing factor

// Function to set game mode
export function setGameMode(mode) {
    gameMode = mode;
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
        case 'ArrowUp':
            keys.up = true; // Set boosting to true
            break;
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
        case 'ArrowUp': 
            keys.up = false; // Stop boosting when the Up Arrow key is released
            break;
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

export function updateCamera(camera) {
    const targetPosition = new THREE.Vector3();
    spacecraft.getWorldPosition(targetPosition);

    const localOffset = currentCameraOffset.clone(); // Use dynamic offset
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
        return;
    }
    
    // Update speed based on boost state
    if (keys.up) {
        currentSpeed = boostSpeed; // Set speed to boost speed while the Up Arrow is pressed
    } else {
        currentSpeed = baseSpeed; // Reset to base speed when not boosting
    }

    // Update engine effects
    updateEngineEffects(keys.up);

    // Store current state
    lastValidPosition.copy(spacecraft.position);
    lastValidQuaternion.copy(spacecraft.quaternion);

    // Apply rotations with very low sensitivity
    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

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