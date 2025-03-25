import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js';

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
 * @property {number} triangleSize - Size of the triangle (replacing ringRadius)
 * @property {number} triangleThickness - Thickness of the triangle border
 * @property {number} scale - Normal scale value when not boosting
 * @property {number} boostScale - Reduced scale value when boosting
 * @property {number} slowScale - Larger scale value when in slow mode
 * @property {number} transitionSpeed - Speed of transition between scaling states (0-1)
 * @property {number} glowIntensity - Intensity of the glow effect
 * @property {number} glowSize - Size of the glow effect
 * @property {number} secondaryGlowSize - Size of the secondary glow effect
 * @property {number} secondaryGlowIntensity - Intensity of the secondary glow
 */
const config = {
    size: 0.3,             // Increased size for better visibility
    color: 0xFF5349,       // Sci-fi blue color that matches UI
    opacity: 1.0,          // Fully opaque
    distance: -500,        // Distance from spacecraft in local Z direction
    yOffset: 0,            // No vertical offset
    lineThickness: 4.5,    // Increased thickness for better visibility
    crosshairSize: 0.05,   // Larger crosshair
    triangleSize: 0.12,    // Size of the triangle (replacing ringRadius)
    triangleThickness: 0.02, // Increased thickness of the triangle border
    scale: 150,            // Normal scale
    boostScale: 100,       // Smaller scale when boosting
    slowScale: 180,        // Larger scale when in slow mode
    transitionSpeed: 0.1,  // Speed of transition between normal and boost scale (0-1)
    glowIntensity: 1.5,    // Significantly increased glow intensity
    glowSize: 0.06,        // Significantly increased glow size
    secondaryGlowSize: 0.1, // Size of the secondary glow effect
    secondaryGlowIntensity: 0.8 // Intensity of the secondary glow
};

// Reticle object to be attached to the spacecraft
let reticle;
let reticleObject;
let currentScale = config.scale; // Track current scale
let targetScale = config.scale;  // Target scale to transition to
let lastBoostState = false;      // Track the last boost state to detect changes
let lastSlowState = false;       // Track the last slow state to detect changes

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
    
    // Create a triangular reticle instead of a ring
    const triangleShape = new THREE.Shape();
    const size = config.triangleSize;
    triangleShape.moveTo(0, size);
    triangleShape.lineTo(-size * 0.866, -size * 0.5); // Bottom left point
    triangleShape.lineTo(size * 0.866, -size * 0.5);  // Bottom right point
    triangleShape.lineTo(0, size);                    // Back to top point
    
    // Create inner triangle for hollow effect
    const innerSize = size - config.triangleThickness;
    const holeShape = new THREE.Shape();
    holeShape.moveTo(0, innerSize);
    holeShape.lineTo(-innerSize * 0.866, -innerSize * 0.5); // Bottom left point
    holeShape.lineTo(innerSize * 0.866, -innerSize * 0.5);  // Bottom right point
    holeShape.lineTo(0, innerSize);                         // Back to top point
    triangleShape.holes.push(holeShape);
    
    const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
    const triangleMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        opacity: config.opacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
    });
    const triangle = new THREE.Mesh(triangleGeometry, triangleMaterial);
    
    // Create primary glow effect with improved shader
    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.color) },
            intensity: { value: config.glowIntensity },
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float intensity;
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(vUv, center);
                
                // Create a sharper edge with smoother falloff
                float glow = 1.0 - smoothstep(0.0, 0.5, dist);
                
                // Add a slight pulsing effect
                float pulse = 0.05 * sin(time * 2.0) + 1.0;
                
                // Add some subtle noise to the glow
                float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) * 43758.5453) * pulse);
                glow = glow * (1.0 + noise * 0.1);
                
                // Make the glow brighter in the center
                glow = pow(glow, 1.5) * intensity;
                
                // Output the final color with high intensity in the center
                gl_FragColor = vec4(color, glow * intensity);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
    
    // Create slightly larger triangle shape for the primary glow
    const glowSize = size + config.glowSize;
    const glowShape = new THREE.Shape();
    glowShape.moveTo(0, glowSize);
    glowShape.lineTo(-glowSize * 0.866, -glowSize * 0.5);
    glowShape.lineTo(glowSize * 0.866, -glowSize * 0.5);
    glowShape.lineTo(0, glowSize);
    
    const glowGeometry = new THREE.ShapeGeometry(glowShape);
    const primaryGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    primaryGlow.position.z = -0.01; // Position slightly behind the triangle
    
    // Create secondary, larger glow for more dramatic effect
    const secondaryGlowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.color) },
            intensity: { value: config.secondaryGlowIntensity },
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float intensity;
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(vUv, center);
                
                // Softer falloff for the outer glow
                float glow = 1.0 - smoothstep(0.0, 0.7, dist);
                
                // Add a very subtle opposite-phase pulsing
                float pulse = 0.05 * sin(time * 2.0 + 3.14) + 1.0;
                glow = glow * pulse;
                
                // Make outer glow more ethereal
                gl_FragColor = vec4(color, glow * intensity * (1.0 - dist));
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
    
    // Create even larger triangle for secondary glow
    const secondaryGlowSize = size + config.secondaryGlowSize;
    const secondaryGlowShape = new THREE.Shape();
    secondaryGlowShape.moveTo(0, secondaryGlowSize);
    secondaryGlowShape.lineTo(-secondaryGlowSize * 0.866, -secondaryGlowSize * 0.5);
    secondaryGlowShape.lineTo(secondaryGlowSize * 0.866, -secondaryGlowSize * 0.5);
    secondaryGlowShape.lineTo(0, secondaryGlowSize);
    
    const secondaryGlowGeometry = new THREE.ShapeGeometry(secondaryGlowShape);
    const secondaryGlow = new THREE.Mesh(secondaryGlowGeometry, secondaryGlowMaterial);
    secondaryGlow.position.z = -0.02; // Position behind the primary glow
    
    // Create the corner brackets
    const bracketGeometry = new THREE.BufferGeometry();
    const bracketSize = config.triangleSize * 1.3;
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
    reticleObject.add(secondaryGlow); // Add secondary glow first (furthest back)
    reticleObject.add(primaryGlow);   // Add primary glow
    reticleObject.add(triangle);      // Add triangle
    reticleObject.add(crosshair);     // Add crosshair
    reticleObject.add(brackets);      // Add brackets
    
    // Scale the entire reticle
    reticleObject.scale.set(config.scale, config.scale, config.scale);
    
    // Add the reticle to the scene
    scene.add(reticleObject);
    
    // Create a target position for the reticle
    const reticleOffset = new THREE.Vector3(0, config.yOffset, -config.distance);
    
    // Function to update the reticle position
    function updateReticle(isBoosting, isSlowing) {
        if (!spacecraft) {
            console.warn("Cannot update reticle: spacecraft not available");
            return;
        }
        
        // Check if we need to update the scale based on movement state
        // Try to determine states from passed parameters or from spacecraft's userData
        const boosting = isBoosting !== undefined ? isBoosting : 
                        (spacecraft.userData && spacecraft.userData.isBoosting) || 
                        (window.keys && window.keys.up);
        
        const slowing = isSlowing !== undefined ? isSlowing :
                       (spacecraft.userData && spacecraft.userData.isSlowing) ||
                       (window.keys && window.keys.down);
        
        // Track if the states have changed
        const boostStateChanged = boosting !== lastBoostState;
        const slowStateChanged = slowing !== lastSlowState;
        lastBoostState = boosting;
        lastSlowState = slowing;
        
        // Update the target scale based on movement state
        if (boosting) {
            targetScale = config.boostScale;
        } else if (slowing) {
            targetScale = config.slowScale;
        } else {
            targetScale = config.scale;
        }
        
        // Smoothly transition the current scale towards the target scale
        // If we need to ensure it reaches exactly the target, add additional logic
        if (Math.abs(currentScale - targetScale) > 0.1) {
            currentScale += (targetScale - currentScale) * config.transitionSpeed;
        } else {
            // Make sure we snap to exact values when close enough
            currentScale = targetScale;
        }
        
        // Only update the scale if there's a noticeable difference or if states changed
        if (Math.abs(reticleObject.scale.x - (window.innerHeight / 1080) * currentScale) > 0.1 || 
            boostStateChanged || slowStateChanged) {
            // Apply the new scale with window size adjustment
            const viewportHeight = window.innerHeight;
            const scaleFactor = (viewportHeight / 1080) * currentScale;
            reticleObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
        
        // Animate the glow effect
        const time = performance.now() * 0.001; // Convert to seconds
        reticleObject.children.forEach(child => {
            if (child.material && child.material.uniforms) {
                if (child.material.uniforms.intensity) {
                    const pulseFactor = Math.sin(time * 2.0) * 0.2 + 0.8; // More noticeable pulsing
                    child.material.uniforms.intensity.value = 
                        child === secondaryGlow 
                            ? config.secondaryGlowIntensity * pulseFactor * 0.9
                            : config.glowIntensity * pulseFactor;
                }
                if (child.material.uniforms.time) {
                    child.material.uniforms.time.value = time;
                }
            }
        });
        
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
    updateReticle(false, false);
    
    // Return the reticle object and update function
    return {
        reticle: reticleObject,
        update: updateReticle
    };
}

/**
 * Updates the reticle's position
 * @param {boolean} isBoosting - Whether the spacecraft is boosting
 * @param {boolean} isSlowing - Whether the spacecraft is in slow mode
 */
export function updateReticle(isBoosting, isSlowing) {
    if (reticle && typeof reticle.update === 'function') {
        reticle.update(isBoosting, isSlowing);
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
                if (child.material.color) {
                    child.material.color.set(color);
                }
                if (child.material.uniforms && child.material.uniforms.color) {
                    child.material.uniforms.color.value.set(color);
                }
            }
        });
    }
}

/**
 * Ensures the reticle color is consistent across all environments
 * This should be called when switching between environments to maintain the appearance
 */
export function ensureReticleConsistency() {
    // Reset to the config color
    setReticleColor(config.color);
    
    // Make sure the reticle is visible
    if (reticleObject) {
        reticleObject.visible = true;
    }
    
    // Ensure the glow effect is active
    reticleObject.children.forEach(child => {
        if (child.material && child.material.uniforms && child.material.uniforms.intensity) {
            child.material.uniforms.intensity.value = config.glowIntensity;
        }
    });
    
    console.log("Reticle consistency ensured - color reset to default blue");
} 