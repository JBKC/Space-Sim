// controlsVR.js - Centralized VR control system for flight, movement and input processing
// Basically bundles movement and inputControls together

import * as THREE from 'three';

// Configuration constants
const FORWARD_SPEED = 1000;
const ROTATION_SPEED = 0.012;
const ROLL_SPEED_MULTIPLIER = 3.0; // Makes roll faster than pitch/yaw
const BOOST_MULTIPLIER = 5; // Speed multiplier when boost is active
const HYPERSPACE_MULTIPLIER = 20; // Speed multiplier when hyperspace is active

// Track controller inputs and state
let leftController = null;
let rightController = null;
let cameraRig = null; // Container for camera to separate head movement from position
let isBoostActive = false; // Track boost state
let isHyperspaceActive = false; // Track hyperspace state
let isControlsPopupVisible = false; // Track controls popup visibility
let controlsPopupMesh = null; // Reference to the controls popup mesh
let lastXButtonState = false; // Track X button state for toggle

let gamepadIndices = {
    button: {
        thumbstick: 3, // Thumbstick button
        trigger: 0,
        grip: 1,        // Grip/squeeze button (for hyperspace)
        xButton: 4,     // X button on left controller
        yButton: 5,     // Y button on left controller 
        aButton: 4,     // A button on right controller
        bButton: 5      // B button on right controller
    },
    axes: {
        thumbstickX: 2, // Horizontal thumbstick axis
        thumbstickY: 3  // Vertical thumbstick axis
    }
};

// Rotation axes for proper spacecraft movement
const rotationAxes = {
    pitchAxis: new THREE.Vector3(1, 0, 0),
    rollAxis: new THREE.Vector3(0, 0, 1),
    yawAxis: new THREE.Vector3(0, 1, 0)
};

// Rotation quaternions for each axis
const rotation = {
    pitch: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    pitchAxis: rotationAxes.pitchAxis,
    rollAxis: rotationAxes.rollAxis,
    yawAxis: rotationAxes.yawAxis
};

/**
 * Initialize VR controllers for movement
 * @param {THREE.WebGLRenderer} renderer - The Three.js renderer with WebXR enabled
 */
export function initVRControllers(renderer) {
    if (!renderer || !renderer.xr) {
        console.error("Cannot initialize VR controllers: renderer or renderer.xr is undefined");
        return;
    }
    
    console.log("Initializing VR controllers for movement");
    
    // Reset rotation quaternions
    rotation.pitch.identity();
    rotation.roll.identity();
    rotation.yaw.identity();
    
    // Function to handle when a controller connects
    function onConnected(event) {
        const controller = event.target;
        const gamepad = event.data.gamepad;
        
        if (gamepad) {
            // Determine if this is left or right controller
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

/**
 * Setup a camera rig system to separate head tracking from position movement
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.Camera} camera - The camera for VR view
 * @returns {THREE.Group} - The camera rig object
 */
export function setupCameraRig(scene, camera) {
    // Create a container for the camera
    cameraRig = new THREE.Group();
    scene.add(cameraRig);
    
    // Take the camera out of the scene and put it in the rig
    if (camera.parent) {
        camera.parent.remove(camera);
    }
    cameraRig.add(camera);
    
    // Reset camera's local position
    camera.position.set(0, 0, 0);
    
    console.log("Camera rig system created for VR movement separation");
    
    return cameraRig;
}

/**
 * Detect the gamepad layout to ensure correct button mapping
 * @param {Gamepad} gamepad - The gamepad object to analyze
 */
function detectGamepadLayout(gamepad) {
    if (!gamepad) return;
    
    // Log gamepad details for debugging
    console.log("Gamepad detected:", gamepad.id);
    console.log("Buttons:", gamepad.buttons.length);
    console.log("Axes:", gamepad.axes.length);
    
    // Oculus Touch / Meta Quest controller detection
    if (gamepad.id.includes('Oculus Touch') || gamepad.id.includes('Quest')) {
        gamepadIndices = {
            button: {
                thumbstick: 3, // Thumbstick press
                trigger: 0,    // Trigger (index finger)
                grip: 1,       // Grip/squeeze button (for hyperspace)
                xButton: 4,    // X button on left controller
                yButton: 5,    // Y button on left controller
                aButton: 4,    // A button on right controller
                bButton: 5     // B button on right controller
            },
            axes: {
                thumbstickX: 2, // Horizontal thumbstick axis
                thumbstickY: 3  // Vertical thumbstick axis
            }
        };
        console.log("Detected Oculus Touch / Meta Quest controller layout");
    }
    // Valve Index controller detection
    else if (gamepad.id.includes('Index') || gamepad.id.includes('Valve')) {
        gamepadIndices = {
            button: {
                thumbstick: 3, // Thumbstick press
                trigger: 0,    // Trigger (index finger)
                grip: 1,       // Grip/squeeze button (for hyperspace)
                xButton: 2,    // Map to different button on Index
                yButton: 3,    // Map to different button on Index
                aButton: 2,    // Map to different button on Index
                bButton: 3     // Map to different button on Index
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
                trigger: 0,    // Trigger (index finger)
                grip: 1,       // Grip/squeeze button (for hyperspace)
                xButton: 3,    // Map to available button on Vive
                yButton: 4,    // Map to available button on Vive
                aButton: 3,    // Map to available button on Vive
                bButton: 4     // Map to available button on Vive
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

/**
 * Update movement based on VR controller inputs - FLIGHT CONTROL SYSTEM
 * @param {THREE.Camera} camera - The VR camera
 * @param {number} deltaTime - Time elapsed since last frame
 */
export function updateVRMovement(camera, deltaTime = 0.016) {
    // If we don't have a camera rig yet and we have a camera, try to set one up
    if (!cameraRig && camera && camera.parent) {
        setupCameraRig(camera.parent, camera);
    }
    
    // Check for boost and hyperspace activation
    updateBoostState();
    updateHyperspaceState();
    
    // Check for controls popup toggle
    updateControlsPopupState();
    
    // Calculate the current speed based on boost and hyperspace state
    let currentSpeed = FORWARD_SPEED;
    
    if (isHyperspaceActive) {
        currentSpeed *= HYPERSPACE_MULTIPLIER;
    } else if (isBoostActive) {
        currentSpeed *= BOOST_MULTIPLIER;
    }
    
    // If we have a rig, move the rig instead of the camera directly
    // This preserves head tracking while allowing controller-based movement
    if (cameraRig) {
        // Reset rotation quaternions
        rotation.pitch.identity();
        rotation.yaw.identity();
        rotation.roll.identity();
        
        // Get controller inputs
        let leftGamepad = null;
        let rightGamepad = null;
        
        if (leftController && leftController.gamepad) {
            leftGamepad = leftController.gamepad;
        }
        
        if (rightController && rightController.gamepad) {
            rightGamepad = rightController.gamepad;
        }
        
        // Process left controller input (pitch and roll)
        if (leftGamepad) {
            const xAxis = applyDeadzone(leftGamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
            const yAxis = applyDeadzone(leftGamepad.axes[gamepadIndices.axes.thumbstickY] || 0, 0.1);
            
            if (Math.abs(xAxis) > 0) {
                // Roll (left stick horizontal = rotation around Z axis)
                rotation.roll.setFromAxisAngle(rotation.rollAxis, -xAxis * ROTATION_SPEED * ROLL_SPEED_MULTIPLIER);
            }
            
            if (Math.abs(yAxis) > 0) {
                // Pitch (left stick vertical = rotation around X axis)
                // Inverted pitch control (yAxis instead of -yAxis)
                rotation.pitch.setFromAxisAngle(rotation.pitchAxis, yAxis * ROTATION_SPEED);
            }
        }
        
        // Process right controller input (yaw)
        if (rightGamepad) {
            const xAxis = applyDeadzone(rightGamepad.axes[gamepadIndices.axes.thumbstickX] || 0, 0.1);
            
            if (Math.abs(xAxis) > 0) {
                // Yaw (right stick horizontal = rotation around Y axis)
                rotation.yaw.setFromAxisAngle(rotation.yawAxis, -xAxis * ROTATION_SPEED);
            }
        }
        
        // Combine all rotations
        const combinedRotation = new THREE.Quaternion()
            .copy(rotation.roll)
            .multiply(rotation.pitch)
            .multiply(rotation.yaw);
            
        // Apply combined rotation to camera rig
        cameraRig.quaternion.multiply(combinedRotation);
        
        // Move forward in the direction we're facing
        moveForward(cameraRig, currentSpeed * deltaTime);
    } else {
        console.warn("No camera rig available for VR movement - headset may override movement");
        
        // Legacy fallback when no rig is available
        moveForward(camera, currentSpeed * deltaTime);
    }
}

/**
 * Check and update the boost state based on left trigger
 */
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

/**
 * Check and update the hyperspace state based on left grip/squeeze button
 */
function updateHyperspaceState() {
    if (!leftController || !leftController.gamepad) return;
    
    const gripButton = leftController.gamepad.buttons[gamepadIndices.button.grip];
    
    if (gripButton) {
        // Most gamepads report button state with a value property between 0 and 1
        const isGripPressed = gripButton.value > 0.5 || gripButton.pressed;
        
        // Update hyperspace state
        if (isGripPressed && !isHyperspaceActive) {
            console.log("HYPERSPACE ACTIVATED!");
            isHyperspaceActive = true;
            
            // If hyperspace is active, trigger any hyperspace effects
            if (window.startHyperspace && typeof window.startHyperspace === 'function') {
                window.startHyperspace();
            }
        } else if (!isGripPressed && isHyperspaceActive) {
            console.log("Hyperspace deactivated");
            isHyperspaceActive = false;
        }
    }
}

/**
 * Check and update the controls popup state based on X button press
 */
function updateControlsPopupState() {
    if (!leftController || !leftController.gamepad) return;
    
    const xButton = leftController.gamepad.buttons[gamepadIndices.button.xButton];
    
    if (xButton) {
        const isXButtonPressed = xButton.pressed;
        
        // Toggle on button press (not hold)
        if (isXButtonPressed && !lastXButtonState) {
            isControlsPopupVisible = !isControlsPopupVisible;
            
            if (isControlsPopupVisible) {
                // Get current head height from renderer if available
                let currentHeadHeight = 0;
                if (window.renderer && window.renderer.xr) {
                    currentHeadHeight = window.renderer.xr.getCamera()?.position.y || 0;
                }
                showControlsPopup(currentHeadHeight);
            } else {
                hideControlsPopup();
            }
        }
        
        // Update button state for next frame
        lastXButtonState = isXButtonPressed;
    }
}

/**
 * Create and show the controls popup
 * @param {number} headHeight - Optional head height for positioning the popup
 */
export function showControlsPopup(headHeight) {
    if (!cameraRig) return;
    
    console.log("Showing VR controls popup");
    
    // Create the popup if it doesn't exist
    if (!controlsPopupMesh) {
        createControlsPopup();
    }
    
    // Make sure it's in the camera rig
    if (controlsPopupMesh.parent !== cameraRig) {
        cameraRig.add(controlsPopupMesh);
    }
    
    // Position in front of the user at head height if provided
    // The popup should be positioned slightly to the left to avoid blocking the view
    // and angled slightly toward the user for better readability
    const yPosition = headHeight ? headHeight : 0;
    
    // Position it to the left and slightly forward for better visibility
    controlsPopupMesh.position.set(-0.5, yPosition, -0.9);
    
    // Angle it toward the user (rotate around Y axis) and add a slight tilt (rotate around Z axis)
    controlsPopupMesh.rotation.set(0, 0.3, 0.1);
    
    // Set a good size for the popup - slightly wider than tall for better readability
    controlsPopupMesh.scale.set(0.75, 0.65, 1);
    
    controlsPopupMesh.visible = true;
}

/**
 * Hide the controls popup
 */
function hideControlsPopup() {
    if (controlsPopupMesh) {
        console.log("Hiding VR controls popup");
        controlsPopupMesh.visible = false;
    }
}

/**
 * Create the controls popup plane with text
 */
function createControlsPopup() {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    // Reduce height to eliminate empty space at the bottom
    canvas.width = 1024;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    
    // Clear the canvas with a semi-transparent dark background (matching original game)
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border (blue border like original)
    context.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    context.lineWidth = 4;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Add outer glow effect
    const glowSize = 20;
    const glowColor = 'rgba(79, 195, 247, 0.3)';
    context.shadowBlur = glowSize;
    context.shadowColor = glowColor;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    context.shadowBlur = 0;
    
    // Title styling like the original
    const titleFont = "'Orbitron', Arial, sans-serif";
    const titleSize = 54;
    const titleColor = '#4fc3f7';
    
    context.font = `bold ${titleSize}px ${titleFont}`;
    context.fillStyle = titleColor;
    context.textAlign = 'center';
    context.fillText('VR CONTROLS', canvas.width / 2, 80);
    
    // Set up styles for headings like original
    const headingFont = "'Orbitron', Arial, sans-serif";
    const headingSize = 40;
    const headingColor = '#4fc3f7';
    
    // Set up styles for text like original
    const textFont = "'Orbitron', Arial, sans-serif";
    const textSize = 32;
    const textColor = '#b3e5fc';
    
    context.textAlign = 'left';
    let y = 140;
    const sectionPadding = 15;
    
    // MOVEMENT section
    context.font = `bold ${headingSize}px ${headingFont}`;
    context.fillStyle = headingColor;
    context.fillText('MOVEMENT', 40, y);
    
    // Draw section heading underline
    context.beginPath();
    context.moveTo(40, y + 10);
    context.lineTo(canvas.width - 40, y + 10);
    context.strokeStyle = 'rgba(79, 195, 247, 0.3)';
    context.lineWidth = 2;
    context.stroke();
    
    y += 50; // Space after heading
    context.font = `${textSize}px ${textFont}`;
    context.fillStyle = textColor;
    
    context.fillText('Left Analog Left/Right: Roll', 50, y); y += 45;
    context.fillText('Left Analog Up/Down: Pitch', 50, y); y += 45;
    context.fillText('Right Analog Left/Right: Yaw', 50, y); y += 45 + sectionPadding;
    
    // SPEED section
    context.font = `bold ${headingSize}px ${headingFont}`;
    context.fillStyle = headingColor;
    context.fillText('SPEED', 40, y);
    
    // Draw section heading underline
    context.beginPath();
    context.moveTo(40, y + 10);
    context.lineTo(canvas.width - 40, y + 10);
    context.strokeStyle = 'rgba(79, 195, 247, 0.3)';
    context.lineWidth = 2;
    context.stroke();
    
    y += 50;
    context.font = `${textSize}px ${textFont}`;
    context.fillStyle = textColor;
    
    context.fillText('Left Trigger: Boost (5x)', 50, y); y += 45;
    context.fillText('Left Grip: Hyperspace (20x)', 50, y); y += 45 + sectionPadding;
    
    // ACTIONS section
    context.font = `bold ${headingSize}px ${headingFont}`;
    context.fillStyle = headingColor;
    context.fillText('ACTIONS', 40, y);
    
    // Draw section heading underline
    context.beginPath();
    context.moveTo(40, y + 10);
    context.lineTo(canvas.width - 40, y + 10);
    context.strokeStyle = 'rgba(79, 195, 247, 0.3)';
    context.lineWidth = 2;
    context.stroke();
    
    y += 50;
    context.font = `${textSize}px ${textFont}`;
    context.fillStyle = textColor;
    
    context.fillText('X Button: Toggle this panel', 50, y);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create material using the canvas texture
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    // Create plane for popup with correct aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const width = 0.8;
    const height = width / aspectRatio;
    const geometry = new THREE.PlaneGeometry(width, height);
    
    controlsPopupMesh = new THREE.Mesh(geometry, material);
    controlsPopupMesh.renderOrder = 1002; // Render after cockpit
    controlsPopupMesh.visible = false;
    
    console.log("Created controls popup with original game styling");
    
    return controlsPopupMesh;
}

/**
 * Move the object forward in its current direction
 * @param {THREE.Object3D} object - The object to move
 * @param {number} distance - How far to move
 */
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

/**
 * Apply a deadzone to prevent small controller movements from affecting rotation
 * @param {number} value - The input value to check
 * @param {number} deadzone - The deadzone threshold
 * @returns {number} 0 if within deadzone, original value otherwise
 */
function applyDeadzone(value, deadzone) {
    return Math.abs(value) < deadzone ? 0 : value;
}

/**
 * Get debug information about the current controller state
 * 
 * @param {XRFrame} xrFrame - The current XR frame
 * @returns {Object} An object with debug information about controllers
 */
export function getControllerDebugInfo(xrFrame) {
    // Default debug info with controller status and rotation
    const info = {
        leftController: {
            connected: leftController !== null,
            axes: leftController && leftController.gamepad ? 
                  leftController.gamepad.axes.slice(0, 4) : [],
            buttons: leftController && leftController.gamepad ? 
                    leftController.gamepad.buttons.map(b => b.pressed) : [],
            boostActive: isBoostActive,
            hyperspaceActive: isHyperspaceActive
        },
        rightController: {
            connected: rightController !== null,
            axes: rightController && rightController.gamepad ? 
                  rightController.gamepad.axes.slice(0, 4) : [],
            buttons: rightController && rightController.gamepad ? 
                    rightController.gamepad.buttons.map(b => b.pressed) : []
        },
        rotation: {
            pitch: rotation.pitch.toArray(),
            roll: rotation.roll.toArray(),
            yaw: rotation.yaw.toArray()
        }
    };
    
    // If an XR frame was provided, add additional debug info
    if (xrFrame && xrFrame.session && xrFrame.session.inputSources) {
        info.controllerCount = xrFrame.session.inputSources.length;
        
        // Add information about each controller from the frame
        xrFrame.session.inputSources.forEach((source, index) => {
            if (source.gamepad) {
                info[`inputSource${index}`] = {
                    handedness: source.handedness,
                    buttonCount: source.gamepad.buttons.length,
                    axesCount: source.gamepad.axes.length,
                    // First few axes values for debugging
                    axes: source.gamepad.axes.slice(0, 2).map(v => v.toFixed(2))
                };
            }
        });
    }
    
    return info;
} 