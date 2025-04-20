// movementVR.js - Handles VR movement controls for the space test environment

import * as THREE from 'three';

// Configuration constants
const FORWARD_SPEED = 1000; // Keeping fast forward speed
const ROTATION_SPEED = 0.012; // Doubled from 0.006 for more sensitive controls
const BOOST_MULTIPLIER = 5; // Speed multiplier when boost is active

// Track controller inputs and state
let leftController = null;
let rightController = null;
let cameraRig = null; // Container for camera to separate head movement from position
let isBoostActive = false; // Track boost state
let gamepadIndices = {
    button: {
        thumbstick: 3, // Thumbstick button
        trigger: 1     // Left trigger button (typically index 1)
    },
    axes: {
        thumbstickX: 2, // Horizontal thumbstick axis
        thumbstickY: 3  // Vertical thumbstick axis
    }
};

// Define rotation axes in local space
const localAxes = {
    pitch: new THREE.Vector3(1, 0, 0), // Local X axis for pitch
    roll: new THREE.Vector3(0, 0, 1),  // Local Z axis for roll
    yaw: new THREE.Vector3(0, 1, 0)    // Local Y axis for yaw
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

// Setup a camera rig system to separate head tracking from position movement
export function setupCameraRig(scene, camera) {
    // Create a container for the camera
    cameraRig = new THREE.Group();
    scene.add(cameraRig);
    
    // Take the camera out of the scene and put it in the rig
    if (camera.parent) {
        camera.parent.remove(camera);
    }
    cameraRig.add(camera);
    
    // Reset camera's local position (head tracking will still work)
    camera.position.set(0, 0, 0);
    
    console.log("Camera rig system created for VR movement separation");
    
    return cameraRig;
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
                thumbstick: 3, // Thumbstick press
                trigger: 1     // Trigger (index finger)
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
                thumbstick: 3, // Thumbstick press
                trigger: 1     // Trigger (index finger)
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
                thumbstick: 2, // Touchpad press (Vive doesn't have thumbsticks)
                trigger: 1     // Trigger (index finger)
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

// Update movement based on VR controller inputs
export function updateVRMovement(camera, deltaTime = 0.016) {
    // If we don't have a camera rig yet and we have a camera, try to set one up
    if (!cameraRig && camera && camera.parent) {
        setupCameraRig(camera.parent, camera);
    }
    
    // Check for boost activation (left trigger)
    updateBoostState();
    
    // Calculate the current speed based on boost state
    const currentSpeed = isBoostActive ? 
        FORWARD_SPEED * BOOST_MULTIPLIER : 
        FORWARD_SPEED;
    
    // If we have a rig, move the rig instead of the camera directly
    // This preserves head tracking while allowing controller-based movement
    if (cameraRig) {
        // Get controller inputs
        let pitchAngle = 0;
        let rollAngle = 0;
        let yawAngle = 0;
        
        // Process left controller input (pitch and roll)
        if (leftController && leftController.gamepad) {
            const xAxis = applyDeadzone(leftController.gamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
            const yAxis = applyDeadzone(leftController.gamepad.axes[gamepadIndices.axes.thumbstickY] || 0, 0.1);
            
            // Roll (left stick horizontal)
            if (Math.abs(xAxis) > 0) {
                rollAngle = -xAxis * ROTATION_SPEED;
            }
            
            // Pitch (left stick vertical)
            if (Math.abs(yAxis) > 0) {
                // Inverted pitch (yAxis instead of -yAxis)
                pitchAngle = yAxis * ROTATION_SPEED;
            }
        }
        
        // Process right controller input (yaw)
        if (rightController && rightController.gamepad) {
            const xAxis = applyDeadzone(rightController.gamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
            
            // Yaw (right stick horizontal)
            if (Math.abs(xAxis) > 0) {
                yawAngle = -xAxis * ROTATION_SPEED;
            }
        }
        
        // Apply rotations to the rig in the proper order for intuitive spacecraft control
        if (rollAngle !== 0) {
            // Convert world space axis to object local axis
            const localRollAxis = new THREE.Vector3().copy(localAxes.roll);
            // Transform the local Z axis to the current rotation frame
            localRollAxis.applyQuaternion(cameraRig.quaternion);
            // Apply rotation around this rotated axis
            cameraRig.quaternion.multiply(
                new THREE.Quaternion().setFromAxisAngle(localRollAxis.normalize(), rollAngle)
            );
        }
        
        if (pitchAngle !== 0) {
            // Convert world space axis to object local axis 
            const localPitchAxis = new THREE.Vector3().copy(localAxes.pitch);
            // Transform the local X axis to the current rotation frame
            localPitchAxis.applyQuaternion(cameraRig.quaternion);
            // Apply rotation around this rotated axis
            cameraRig.quaternion.multiply(
                new THREE.Quaternion().setFromAxisAngle(localPitchAxis.normalize(), pitchAngle)
            );
        }
        
        if (yawAngle !== 0) {
            // Convert world space axis to object local axis
            const localYawAxis = new THREE.Vector3().copy(localAxes.yaw);
            // Transform the local Y axis to the current rotation frame
            localYawAxis.applyQuaternion(cameraRig.quaternion);
            // Apply rotation around this rotated axis
            cameraRig.quaternion.multiply(
                new THREE.Quaternion().setFromAxisAngle(localYawAxis.normalize(), yawAngle)
            );
        }
        
        // Move forward in the direction we're facing
        moveForward(cameraRig, currentSpeed * deltaTime);
    } else {
        console.warn("No camera rig available for VR movement - headset may override movement");
        
        // Legacy fallback when no rig is available
        moveForward(camera, currentSpeed * deltaTime);
    }
}

// Check and update the boost state based on left trigger
function updateBoostState() {
    if (!leftController || !leftController.gamepad) return;
    
    const triggerButton = leftController.gamepad.buttons[gamepadIndices.button.trigger];
    
    if (triggerButton) {
        // Most gamepads report trigger state with a value property between 0 and 1
        const isTriggerPressed = triggerButton.value > 0.5 || triggerButton.pressed;
        
        // Update boost state
        if (isTriggerPressed && !isBoostActive) {
            console.log("Speed boost activated!");
            isBoostActive = true;
        } else if (!isTriggerPressed && isBoostActive) {
            console.log("Speed boost deactivated");
            isBoostActive = false;
        }
    }
}

// Move the object forward in its current direction
function moveForward(object, distance) {
    // Create a vector pointing forward (negative Z in Three.js)
    const forwardVector = new THREE.Vector3(0, 0, -1);
    
    // Transform this vector based on the object's rotation
    forwardVector.applyQuaternion(object.quaternion);
    
    // Scale the vector by the desired distance
    forwardVector.multiplyScalar(distance);
    
    // Move the object
    object.position.add(forwardVector);
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
                    leftController.gamepad.buttons.map(b => b.pressed) : [],
            boostActive: isBoostActive
        },
        rightController: {
            connected: rightController !== null,
            axes: rightController && rightController.gamepad ? 
                  rightController.gamepad.axes.slice(0, 4) : [],
            buttons: rightController && rightController.gamepad ? 
                    rightController.gamepad.buttons.map(b => b.pressed) : []
        },
        cameraRig: cameraRig ? {
            position: cameraRig.position.toArray(),
            quaternion: cameraRig.quaternion.toArray()
        } : null
    };
    
    return info;
} 