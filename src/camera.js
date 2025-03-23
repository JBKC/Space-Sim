import * as THREE from 'three';

// CAMERA OFFSET CONFIGURATIONS
// ===========================

// Space view camera offsets
export const spaceCamera = {
    base: new THREE.Vector3(0, 2, 30),         // Normal camera position (behind spacecraft)
    boost: new THREE.Vector3(0, 2, 200),        // Further back during boost
    slow: new THREE.Vector3(0, 2, 12),       // Closer camera during slow mode
    hyperspace: new THREE.Vector3(0, 2, -4),   // Close camera during hyperspace
};

// San Francisco camera offsets
export const sanFranCamera = {
    base: new THREE.Vector3(0, 30, -50),         // Normal camera position (behind spacecraft)
    boost: new THREE.Vector3(0, 20, 100),        // Further back during boost
    slow: new THREE.Vector3(0, 30, -30),       // Closer camera during slow mode
    collision: new THREE.Vector3(0, 5, -20),
};

// // Earth surface camera offsets
// export const earthCamera = {
//     base: new THREE.Vector3(0, 2, -10),
//     boost: new THREE.Vector3(0, 3, -20),
//     slow: new THREE.Vector3(0, 1.5, -7),
// };

// // Moon surface camera offsets
// export const moonCamera = {
//     base: new THREE.Vector3(0, 2, -10),
//     boost: new THREE.Vector3(0, 3, -20),
//     slow: new THREE.Vector3(0, 1.5, -7),
// };

// // Washington DC camera offsets
// export const washingtonCamera = {
//     base: new THREE.Vector3(0, 2, -10),
//     boost: new THREE.Vector3(0, 3, -20),
//     slow: new THREE.Vector3(0, 1.5, -7),
//     collision: new THREE.Vector3(0, 5, -20),
// };



// CINEMATIC CAMERA PARAMETERS
// ==========================

export const cinematicEffects = {
    // Maximum rotation offsets for cinematic effect
    MAX_PITCH_OFFSET: 0.1,  // Maximum pitch offset in radians (about 5.7 degrees)
    MAX_YAW_OFFSET: 0.15,   // Maximum yaw offset in radians (about 8.6 degrees)
    CAMERA_LAG_FACTOR: 0.1, // How quickly the camera catches up (0.1 = slow, 0.5 = fast)
    
    // Local rotation parameters for enhanced cinematic feel
    MAX_LOCAL_PITCH_ROTATION: 0.06, // Maximum rotation around local X axis (about 3.4 degrees)
    MAX_LOCAL_YAW_ROTATION: 0.08,   // Maximum rotation around local Y axis (about 4.6 degrees)
    LOCAL_ROTATION_SPEED: 0.08,     // How quickly local rotations are applied
    
    // Camera transition speed
    transitionSpeed: 0.15, // Lower = slower, smoother transitions
};

// UTILITY FUNCTIONS
// ================

// Returns the appropriate camera offsets based on the current scene
export function getCameraOffsets(scene) {
    switch (scene) {
        case 'space':
            return spaceCamera;
        case 'earth':
            return earthCamera;
        case 'moon':
            return moonCamera;
        case 'washington':
            return washingtonCamera;
        case 'sanFran':
            return sanFranCamera;
        default:
            console.warn(`Unknown scene '${scene}', defaulting to space camera`);
            return spaceCamera;
    }
}

// Creates a rotation quaternion that rotates from one direction to another
export function rotationBetweenDirections(dir1, dir2) {
    const rotation = new THREE.Quaternion();
    const a = new THREE.Vector3().crossVectors(dir1, dir2);
    rotation.x = a.x;
    rotation.y = a.y;
    rotation.z = a.z;
    rotation.w = 1 + dir1.clone().dot(dir2);
    rotation.normalize();
    return rotation;
}

// Helper function to create a forward-facing rotation (180 degrees around Y axis)
export function createForwardRotation() {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
}

// Create a camera state object that can be used to track camera state in each scene
export function createCameraState(scene) {
    const offsets = getCameraOffsets(scene);
    
    return {
        // Current camera offsets that will be interpolated
        currentOffset: offsets.base.clone(),
        targetOffset: offsets.base.clone(),
        
        // Rotational offsets for cinematic effect
        currentPitchOffset: 0,
        currentYawOffset: 0,
        targetPitchOffset: 0,
        targetYawOffset: 0,
        
        // Local rotation angles for enhanced cinematic effect
        currentLocalPitchRotation: 0,
        currentLocalYawRotation: 0,
        targetLocalPitchRotation: 0,
        targetLocalYawRotation: 0,
    };
}

// Updates the target offsets based on current input
export function updateTargetOffsets(cameraState, keys, scene) {
    const offsets = getCameraOffsets(scene);
    
    // Update positional offset based on movement mode
    if (keys.up) {
        cameraState.targetOffset = offsets.boost.clone();
    } else if (keys.down) {
        cameraState.targetOffset = offsets.slow.clone();
    } else {
        cameraState.targetOffset = offsets.base.clone();
    }
    
    // Update rotational offsets for cinematic effect
    if (keys.w) {
        cameraState.targetPitchOffset = -cinematicEffects.MAX_PITCH_OFFSET;
        cameraState.targetLocalPitchRotation = -cinematicEffects.MAX_LOCAL_PITCH_ROTATION;
    } else if (keys.s) {
        cameraState.targetPitchOffset = cinematicEffects.MAX_PITCH_OFFSET;
        cameraState.targetLocalPitchRotation = cinematicEffects.MAX_LOCAL_PITCH_ROTATION;
    } else {
        cameraState.targetPitchOffset = 0;
        cameraState.targetLocalPitchRotation = 0;
    }
    
    if (keys.left) {
        cameraState.targetYawOffset = cinematicEffects.MAX_YAW_OFFSET;
        cameraState.targetLocalYawRotation = -cinematicEffects.MAX_LOCAL_YAW_ROTATION;
    } else if (keys.right) {
        cameraState.targetYawOffset = -cinematicEffects.MAX_YAW_OFFSET;
        cameraState.targetLocalYawRotation = cinematicEffects.MAX_LOCAL_YAW_ROTATION;
    } else {
        cameraState.targetYawOffset = 0;
        cameraState.targetLocalYawRotation = 0;
    }
    
    return cameraState;
}

// Updates the current camera offsets by interpolating toward target values
export function updateCameraOffsets(cameraState, rotation) {
    // Interpolate position
    cameraState.currentOffset.lerp(
        cameraState.targetOffset, 
        cinematicEffects.transitionSpeed
    );
    
    // Interpolate rotational offsets
    cameraState.currentPitchOffset += (
        cameraState.targetPitchOffset - cameraState.currentPitchOffset
    ) * cinematicEffects.CAMERA_LAG_FACTOR;
    
    cameraState.currentYawOffset += (
        cameraState.targetYawOffset - cameraState.currentYawOffset
    ) * cinematicEffects.CAMERA_LAG_FACTOR;
    
    // Interpolate local rotations
    cameraState.currentLocalPitchRotation += (
        cameraState.targetLocalPitchRotation - cameraState.currentLocalPitchRotation
    ) * cinematicEffects.LOCAL_ROTATION_SPEED;
    
    cameraState.currentLocalYawRotation += (
        cameraState.targetLocalYawRotation - cameraState.currentLocalYawRotation
    ) * cinematicEffects.LOCAL_ROTATION_SPEED;
    
    return cameraState;
}

// Apply the camera state to a camera
export function applyCameraState(camera, cameraState, spacecraft, rotation) {
    // Create position vector from the offset
    const position = new THREE.Vector3().copy(cameraState.currentOffset);
    
    // Apply local rotations to position before transforming
    const localPitchRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0), 
        cameraState.currentLocalPitchRotation
    );
    
    const localYawRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), 
        cameraState.currentLocalYawRotation
    );
    
    position.applyQuaternion(localPitchRotation);
    position.applyQuaternion(localYawRotation);
    
    // Transform to world space
    spacecraft.updateMatrixWorld();
    position.applyMatrix4(spacecraft.matrixWorld);
    
    // Set camera position
    camera.position.copy(position);
    
    // Get spacecraft orientation
    const baseQuaternion = spacecraft.getWorldQuaternion(new THREE.Quaternion());
    
    // Create rotational offsets
    const pitchOffset = new THREE.Quaternion().setFromAxisAngle(
        rotation.pitchAxis, 
        cameraState.currentPitchOffset
    );
    
    const yawOffset = new THREE.Quaternion().setFromAxisAngle(
        rotation.yawAxis, 
        cameraState.currentYawOffset
    );
    
    // Combine all rotations
    camera.quaternion.copy(baseQuaternion);
    camera.quaternion.multiply(pitchOffset);
    camera.quaternion.multiply(yawOffset);
    camera.quaternion.multiply(localPitchRotation);
    camera.quaternion.multiply(localYawRotation);
    
    // Apply the 180-degree rotation to look forward
    const forwardRotation = createForwardRotation();
    camera.quaternion.multiply(forwardRotation);
} 