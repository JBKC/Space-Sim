// src/movement.js
import { scene } from './setup.js'; // Added import for scene
import { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing } from './setup.js';

// Movement and boost variables
export const baseSpeed = 0.3;
export const boostSpeed = 0.9;
export let currentSpeed = baseSpeed;
export const turnSpeed = 0.015;
export const keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };
export let boostDuration = 0;
export const boostMaxDuration = 120;

// Wing animation variables
export let wingsOpen = true;
export let wingAnimation = 0;
export const wingTransitionFrames = 30;

// Keyboard controls
document.addEventListener('keydown', (event) => {
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
    switch (event.key) {
        case 'w': keys.w = false; break;
        case 's': keys.s = false; break;
        case 'a': keys.a = false; break;
        case 'd': keys.d = false; break;
        case 'ArrowLeft': keys.left = false; break;
        case 'ArrowRight': keys.right = false; break;
        case 'ArrowUp':
            keys.up = false;
            if (!wingsOpen) {
                wingsOpen = true;
                wingAnimation = wingTransitionFrames;
            }
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
const cameraOffset = new THREE.Vector3(0, 2, -7);
let smoothFactor = 0.1;

export const cameraTarget = new THREE.Object3D();
spacecraft.add(cameraTarget);
cameraTarget.position.set(0, 0, 0);

export const cameraRig = new THREE.Object3D();
scene.add(cameraRig); // Line 77 - Now scene is defined

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
    if (boostDuration > 0) {
        currentSpeed = boostSpeed;
        engineGlowMaterial.color.setHex(0xff6600);
        lightMaterial.color.setHex(0xff99ff);
        boostDuration--;
    } else {
        currentSpeed = baseSpeed;
        engineGlowMaterial.color.setHex(0xff3300);
        lightMaterial.color.setHex(0xff66ff);
    }

    spacecraft.translateZ(currentSpeed);

    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed * 2);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed * 2);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed);

    const combinedRotation = new THREE.Quaternion()
        .copy(rotation.roll)
        .multiply(rotation.pitch)
        .multiply(rotation.yaw);

    spacecraft.quaternion.multiply(combinedRotation);

    if (wingAnimation > 0) {
        const targetAngle = wingsOpen ? Math.PI / 8 : 0;
        const angleStep = (Math.PI / 8) / wingTransitionFrames;

        if (wingsOpen) {
            topRightWing.rotation.z = Math.max(topRightWing.rotation.z - angleStep, -Math.PI / 8);
            bottomRightWing.rotation.z = Math.min(bottomRightWing.rotation.z + angleStep, Math.PI / 8); // Should be bottomRightWing
            topLeftWing.rotation.z = Math.min(topLeftWing.rotation.z + angleStep, Math.PI + Math.PI / 8);
            bottomLeftWing.rotation.z = Math.max(customLeftWing.rotation.z - angleStep, Math.PI - Math.PI / 8); // Should be bottomLeftWing
        } else {
            topRightWing.rotation.z = Math.min(topRightWing.rotation.z + angleStep, 0);
            bottomRightWing.rotation.z = Math.max(customRightWing.rotation.z - angleStep, 0); // Should be bottomRightWing
            topLeftWing.rotation.z = Math.max(topLeftWing.rotation.z - angleStep, Math.PI);
            bottomLeftWing.rotation.z = Math.min(customLeftWing.rotation.z + angleStep, Math.PI); // Should be bottomLeftWing
        }
        wingAnimation--;
    }
}