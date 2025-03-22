import * as THREE from 'three';

/**
 * Configuration for the reticle
 * @type {Object}
 * @property {number} size - Overall size of the reticle
 * @property {number} color - Color of the reticle in hex format
 * @property {number} opacity - Opacity of the reticle (0-1)
 * @property {number} distance - Distance from spacecraft in local Z direction
 * @property {number} yOffset - Vertical offset from spacecraft center
 * @property {number} lineThickness - Thickness of lines in the reticle
 * @property {number} crosshairSize - Size of the central crosshair
 * @property {number} ringRadius - Radius of the outer ring
 * @property {number} ringThickness - Thickness of the outer ring
 * @property {number} scale - Normal scale value when not boosting
 * @property {number} boostScale - Reduced scale value when boosting
 * @property {number} transitionSpeed - Speed of transition between scaling states (0-1)
 */
const config = {
    size: 0.3,             // Increased size for better visibility
    color: 0xe42747,       // Sci fi color
    opacity: 1.0,          // Fully opaque
    distance: -500,          // Distance from spacecraft in local Z direction
    yOffset: 0,            // No vertical offset
    lineThickness: 3,      // Thicker lines
    crosshairSize: 0.05,   // Larger crosshair
    ringRadius: 0.1,       // Larger ring
    ringThickness: 0.015,  // Thicker ring
    scale: 150,            // Normal scale
    boostScale: 100,        // Smaller scale when boosting
    transitionSpeed: 0.1   // Speed of transition between normal and boost scale (0-1)
};

// Reticle object to be attached to the spacecraft
let reticle;
let reticleObject;
let currentScale = config.scale; // Track current scale
let targetScale = config.scale;  // Target scale to transition to
let lastBoostState = false;      // Track the last boost state to detect changes

/**
 * Handles window resize events to ensure the reticle stays properly scaled
 */
export function onWindowResize() {
    if (reticleObject) {
        // Scale reticle based on viewport size to maintain consistent visual size
        const viewportHeight = window.innerHeight;
        const scaleFactor = (viewportHeight / 1080) * currentScale; // Base scale on a 1080p reference
        reticleObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
}

/**
 * Creates a reticle that stays fixed in front of the spacecraft
 * @param {THREE.Scene} scene - The scene to add the reticle to
 * @param {THREE.Object3D} spacecraft - The spacecraft object to attach the reticle to
 * @param {THREE.Camera} camera - The camera used for rendering (optional)
 * @returns {Object} - Object containing the reticle and update function
 */
export function createReticle(scene, spacecraft, camera) {
    console.log("Creating reticle for spacecraft:", spacecraft ? spacecraft.name || "unnamed" : "null");
    
    // Create a parent object to hold the reticle components
    reticleObject = new THREE.Object3D();
    reticleObject.name = "reticle";
    
    // Create reticle material - basic material with high visibility
    const material = new THREE.LineBasicMaterial({
        color: config.color,
        opacity: config.opacity,
        transparent: true,
        linewidth: config.lineThickness,
        depthTest: false,  // Don't test against depth buffer - always visible
        depthWrite: false, // Don't write to depth buffer
    });
    
    // Create the main crosshair
    const crosshairGeometry = new THREE.BufferGeometry();
    const crosshairPoints = [
        // Top vertical line
        new THREE.Vector3(0, config.crosshairSize, 0),
        new THREE.Vector3(0, config.crosshairSize * 0.25, 0),
        // Right horizontal line
        new THREE.Vector3(config.crosshairSize, 0, 0),
        new THREE.Vector3(config.crosshairSize * 0.25, 0, 0),
        // Bottom vertical line
        new THREE.Vector3(0, -config.crosshairSize, 0),
        new THREE.Vector3(0, -config.crosshairSize * 0.25, 0),
        // Left horizontal line
        new THREE.Vector3(-config.crosshairSize, 0, 0),
        new THREE.Vector3(-config.crosshairSize * 0.25, 0, 0),
    ];
    crosshairGeometry.setFromPoints(crosshairPoints);
    const crosshair = new THREE.LineSegments(crosshairGeometry, material);
    
    // Create the outer ring
    const ringGeometry = new THREE.RingGeometry(
        config.ringRadius - config.ringThickness / 2,
        config.ringRadius + config.ringThickness / 2,
        32
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        opacity: config.opacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Create the corner brackets
    const bracketGeometry = new THREE.BufferGeometry();
    const bracketSize = config.ringRadius * 1.3;
    const bracketWidth = bracketSize * 0.2;
    const bracketPoints = [
        // Top-right bracket
        new THREE.Vector3(bracketSize, bracketSize - bracketWidth, 0),
        new THREE.Vector3(bracketSize, bracketSize, 0),
        new THREE.Vector3(bracketSize, bracketSize, 0),
        new THREE.Vector3(bracketSize - bracketWidth, bracketSize, 0),
        
        // Top-left bracket
        new THREE.Vector3(-bracketSize, bracketSize - bracketWidth, 0),
        new THREE.Vector3(-bracketSize, bracketSize, 0),
        new THREE.Vector3(-bracketSize, bracketSize, 0),
        new THREE.Vector3(-bracketSize + bracketWidth, bracketSize, 0),
        
        // Bottom-right bracket
        new THREE.Vector3(bracketSize, -bracketSize + bracketWidth, 0),
        new THREE.Vector3(bracketSize, -bracketSize, 0),
        new THREE.Vector3(bracketSize, -bracketSize, 0),
        new THREE.Vector3(bracketSize - bracketWidth, -bracketSize, 0),
        
        // Bottom-left bracket
        new THREE.Vector3(-bracketSize, -bracketSize + bracketWidth, 0),
        new THREE.Vector3(-bracketSize, -bracketSize, 0),
        new THREE.Vector3(-bracketSize, -bracketSize, 0),
        new THREE.Vector3(-bracketSize + bracketWidth, -bracketSize, 0),
    ];
    bracketGeometry.setFromPoints(bracketPoints);
    const brackets = new THREE.LineSegments(bracketGeometry, material);
    
    // Add all components to the reticle object
    reticleObject.add(crosshair);
    reticleObject.add(ring);
    reticleObject.add(brackets);
    
    // Scale the entire reticle
    reticleObject.scale.set(config.scale, config.scale, config.scale);
    
    // Add the reticle to the scene
    scene.add(reticleObject);
    
    // Create a target position for the reticle
    const reticleOffset = new THREE.Vector3(0, config.yOffset, -config.distance);
    
    // Function to update the reticle position
    function updateReticle(isBoosting) {
        if (!spacecraft) {
            console.warn("Cannot update reticle: spacecraft not available");
            return;
        }
        
        // Check if we need to update the scale based on boost state
        // Try to determine if we're boosting from the spacecraft's userData or passed parameter
        const boosting = isBoosting !== undefined ? isBoosting : 
                        (spacecraft.userData && spacecraft.userData.isBoosting) || 
                        (window.keys && window.keys.up);
        
        // Track if the boost state has changed
        const boostStateChanged = boosting !== lastBoostState;
        lastBoostState = boosting;
        
        // Update the target scale based on boost state
        targetScale = boosting ? config.boostScale : config.scale;
        
        // Smoothly transition the current scale towards the target scale
        // If we need to ensure it reaches exactly the target, add additional logic
        if (Math.abs(currentScale - targetScale) > 0.1) {
            currentScale += (targetScale - currentScale) * config.transitionSpeed;
        } else {
            // Make sure we snap to exact values when close enough
            currentScale = targetScale;
        }
        
        // Only update the scale if there's a noticeable difference or if boost state changed
        if (Math.abs(reticleObject.scale.x - (window.innerHeight / 1080) * currentScale) > 0.1 || boostStateChanged) {
            // Apply the new scale with window size adjustment
            const viewportHeight = window.innerHeight;
            const scaleFactor = (viewportHeight / 1080) * currentScale;
            reticleObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
        
        // Option 1: Fixed offset from spacecraft (always follows spacecraft movement)
        spacecraft.updateMatrixWorld();
        
        // Get spacecraft world position
        const spacecraftPosition = new THREE.Vector3();
        spacecraft.getWorldPosition(spacecraftPosition);
        
        // Get the forward direction
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyQuaternion(spacecraft.quaternion);
        
        // Position the reticle at a fixed distance in front of the spacecraft
        const targetPosition = spacecraftPosition.clone().add(
            forwardVector.clone().multiplyScalar(config.distance)
        );
        
        // Set reticle position
        reticleObject.position.copy(targetPosition);
        
        // Make the reticle face the same direction as the spacecraft
        reticleObject.quaternion.copy(spacecraft.quaternion);
        
        // Debug logging (commented out to avoid console spam)
        // console.log("Reticle updated - Position:", reticleObject.position.toArray().map(v => v.toFixed(2)).join(", "));
    }
    
    // Initial update
    updateReticle(false);
    
    // Return the reticle object and update function
    return {
        reticle: reticleObject,
        update: updateReticle
    };
}

/**
 * Updates the reticle's position
 * @param {boolean} isBoosting - Whether the spacecraft is boosting
 */
export function updateReticle(isBoosting) {
    if (reticle && typeof reticle.update === 'function') {
        reticle.update(isBoosting);
    }
}

/**
 * Initializes the reticle and attaches it to the spacecraft
 * @param {THREE.Scene} scene - The scene to add the reticle to
 * @param {THREE.Object3D} spacecraft - The spacecraft object to attach the reticle to
 * @param {THREE.Camera} camera - The camera used for rendering (optional)
 */
export function initReticle(scene, spacecraft, camera) {
    if (!scene || !spacecraft) {
        console.warn("Cannot initialize reticle: scene or spacecraft not provided");
        return;
    }
    
    console.log("Initializing reticle with scene and spacecraft:", spacecraft.name || "unnamed");
    
    // Create the reticle
    reticle = createReticle(scene, spacecraft, camera);
    
    // Set up window resize listener
    window.addEventListener('resize', onWindowResize);
    
    // Initial size adjustment
    onWindowResize();
    
    console.log("Reticle initialized and attached to spacecraft");
    return reticle;
}

/**
 * Sets the reticle visibility
 * @param {boolean} visible - Whether the reticle should be visible
 */
export function setReticleVisibility(visible) {
    if (reticleObject) {
        reticleObject.visible = visible;
        console.log("Reticle visibility set to:", visible);
    }
}

/**
 * Sets the reticle color
 * @param {number} color - The color to set the reticle to (THREE.js color format)
 */
export function setReticleColor(color) {
    if (reticleObject) {
        reticleObject.traverse((child) => {
            if (child.material) {
                child.material.color.set(color);
            }
        });
    }
} 