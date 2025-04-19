// movementVR.js - Handles VR movement controls for the space test environment

import * as THREE from 'three';

// Configuration constants
const FORWARD_SPEED = 1000; // Increased by 10x (was 100)
const ROTATION_SPEED = 0.3; // Increased by 10x (was 0.03)

// Track controller inputs and state
let leftController = null;
let rightController = null;
let gamepadIndices = {
    button: {
        thumbstick: 3 // Thumbstick button
    },
    axes: {
        thumbstickX: 2, // Horizontal thumbstick axis
        thumbstickY: 3  // Vertical thumbstick axis
    }
};

// Initialize VR controllers for movement
export function initVRControllers(renderer) {
    if (!renderer || !renderer.xr) {
        console.error("Cannot initialize VR controllers: renderer or renderer.xr is undefined");
        return;
    }
    
    console.log("Initializing VR controllers for movement");
    
    // Function to handle when a controller connects
    function onConnected(event) {
        const controller = event.target;
        const gamepad = event.data.gamepad;
        
        if (gamepad) {
            // Determine if this is left or right controller
            // Most VR systems indicate handedness in the gamepad ID
            const isLeft = (
                gamepad.id.includes('Left') || 
                gamepad.id.includes('left') || 
                event.data.handedness === 'left'
            );
            
            console.log(`${isLeft ? 'Left' : 'Right'} controller connected:`, gamepad.id);
            
            if (isLeft) {
                leftController = controller;
                leftController.gamepad = gamepad;
            } else {
                rightController = controller;
                rightController.gamepad = gamepad;
            }
            
            // Attempt to detect the correct button indices for this controller model
            detectGamepadLayout(gamepad);
        }
    }
    
    // Setup controller event listeners for both hands
    renderer.xr.getController(0).addEventListener('connected', onConnected);
    renderer.xr.getController(1).addEventListener('connected', onConnected);
    
    console.log("VR controller listeners initialized");
}

// Detect the gamepad layout to ensure correct button mapping
function detectGamepadLayout(gamepad) {
    if (!gamepad) return;
    
    // Log gamepad details for debugging
    console.log("Gamepad detected:", gamepad.id);
    console.log("Buttons:", gamepad.buttons.length);
    console.log("Axes:", gamepad.axes.length);
    
    // Oculus Touch controller detection
    if (gamepad.id.includes('Oculus Touch') || gamepad.id.includes('Quest')) {
        gamepadIndices = {
            button: {
                thumbstick: 3 // Thumbstick press
            },
            axes: {
                thumbstickX: 2, // Horizontal thumbstick axis
                thumbstickY: 3  // Vertical thumbstick axis
            }
        };
        console.log("Detected Oculus Touch controller layout");
    }
    // Valve Index controller detection
    else if (gamepad.id.includes('Index') || gamepad.id.includes('Valve')) {
        gamepadIndices = {
            button: {
                thumbstick: 3 // Thumbstick press
            },
            axes: {
                thumbstickX: 0, // Horizontal thumbstick axis
                thumbstickY: 1  // Vertical thumbstick axis
            }
        };
        console.log("Detected Valve Index controller layout");
    }
    // HTC Vive controller detection
    else if (gamepad.id.includes('Vive') || gamepad.id.includes('HTC')) {
        gamepadIndices = {
            button: {
                thumbstick: 2 // Touchpad press (Vive doesn't have thumbsticks)
            },
            axes: {
                thumbstickX: 0, // Touchpad X axis
                thumbstickY: 1  // Touchpad Y axis
            }
        };
        console.log("Detected HTC Vive controller layout");
    }
    
    console.log("Using gamepad indices:", gamepadIndices);
}

// Update camera movement based on VR controller inputs
export function updateVRMovement(camera, deltaTime = 0.016) {
    if (!camera) return;
    
    // Apply constant forward movement
    moveForward(camera, FORWARD_SPEED * deltaTime);
    
    // Apply rotation from controller inputs
    if (leftController && leftController.gamepad) {
        applyLeftControllerRotation(camera, leftController.gamepad);
    }
    
    if (rightController && rightController.gamepad) {
        applyRightControllerRotation(camera, rightController.gamepad);
    }
}

// Move the camera forward in its current direction
function moveForward(camera, distance) {
    // Create a vector pointing forward (negative Z in Three.js)
    const forwardVector = new THREE.Vector3(0, 0, -1);
    
    // Transform this vector based on the camera's rotation
    forwardVector.applyQuaternion(camera.quaternion);
    
    // Scale the vector by the desired distance
    forwardVector.multiplyScalar(distance);
    
    // Move the camera
    camera.position.add(forwardVector);
}

// Apply rotation from left controller (pitch and roll)
function applyLeftControllerRotation(camera, gamepad) {
    if (!gamepad || !gamepad.axes) return;
    
    // Get thumbstick X and Y values, apply deadzone to prevent drift
    const xAxis = applyDeadzone(gamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
    const yAxis = applyDeadzone(gamepad.axes[gamepadIndices.axes.thumbstickY] || 0, 0.1);
    
    if (Math.abs(xAxis) > 0 || Math.abs(yAxis) > 0) {
        // Roll (left stick horizontal = rotation around Z axis)
        const rollAngle = -xAxis * ROTATION_SPEED;
        const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), 
            rollAngle
        );
        
        // Pitch (left stick vertical = rotation around X axis)
        const pitchAngle = -yAxis * ROTATION_SPEED;
        const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            pitchAngle
        );
        
        // Combine the rotations and apply to camera
        const combinedQuaternion = new THREE.Quaternion()
            .multiplyQuaternions(rollQuaternion, pitchQuaternion);
            
        camera.quaternion.premultiply(combinedQuaternion);
    }
}

// Apply rotation from right controller (yaw)
function applyRightControllerRotation(camera, gamepad) {
    if (!gamepad || !gamepad.axes) return;
    
    // Get thumbstick X value, apply deadzone to prevent drift
    const xAxis = applyDeadzone(gamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
    
    if (Math.abs(xAxis) > 0) {
        // Yaw (right stick horizontal = rotation around Y axis)
        const yawAngle = -xAxis * ROTATION_SPEED;
        const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            yawAngle
        );
        
        // Apply to camera
        camera.quaternion.premultiply(yawQuaternion);
    }
}

// Apply a deadzone to prevent small controller movements from affecting rotation
function applyDeadzone(value, deadzone) {
    return Math.abs(value) < deadzone ? 0 : value;
}

// For debugging: get the current controller state
export function getControllerDebugInfo() {
    const info = {
        leftController: {
            connected: leftController !== null,
            axes: leftController && leftController.gamepad ? 
                  leftController.gamepad.axes.slice(0, 4) : [],
            buttons: leftController && leftController.gamepad ? 
                    leftController.gamepad.buttons.map(b => b.pressed) : []
        },
        rightController: {
            connected: rightController !== null,
            axes: rightController && rightController.gamepad ? 
                  rightController.gamepad.axes.slice(0, 4) : [],
            buttons: rightController && rightController.gamepad ? 
                    rightController.gamepad.buttons.map(b => b.pressed) : []
        }
    };
    
    return info;
} 