import * as THREE from 'three';

/**
 * Configuration for the reticle using javascript config object
 * @type {Object}
 * @property {number} size - Overall size of the reticle
 * @property {number} color - Color of the reticle in hex format
 * @property {number} opacity - Opacity of the reticle (0-1)
 * @property {number} distance - Distance from spacecraft in local Z direction
 * @property {number} yOffset - Vertical offset from spacecraft center
 * @property {number} lineThickness - Thickness of lines in the reticle
 * @property {number} crosshairSize - Size of the central crosshair (+)
 * @property {number} triangleSize - Size of the triangle surrounding the crosshair
 * @property {number} triangleThickness - Thickness of the triangle
 * @property {number} scale - Normal scale value when not boosting
 * @property {number} boostScale - Reduced scale value when boosting
 * @property {number} slowScale - Larger scale value when in slow mode
 * @property {number} transitionSpeed - Speed of transition between scaling states (0-1)
 * @property {number} glowIntensity - Intensity of the glow effect
 * @property {number} glowSize - Size of the glow effect
 */
const config = {
    size: 0.3,             // Increased size for better visibility
    color: 0xFF5349,       // Orange-red color
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
};

// Map spacecraft instance to its reticle object
const reticleMap = new Map();
export { reticleMap }; // Export the map for external cleanup access

let currentScale = config.scale; // Track current scale for *a* reticle (needs rethinking if multiple scales needed)

/**
 * Handles window resize events to ensure the reticle stays properly scaled
 */
export function onWindowResize() {
    // Resize ALL active reticles
    reticleMap.forEach((reticleData) => {
        if (reticleData.object) {
            const viewportHeight = window.innerHeight;
            // Use the scale associated with *this* reticle instance if needed, or a global one
            const scaleFactor = (viewportHeight / 1080) * reticleData.currentScale; 
            reticleData.object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
    });
}

/**
 * Creates a reticle that stays fixed in front of the spacecraft
 * @param {THREE.Scene} scene - The scene to add the reticle to
 * @param {THREE.Object3D} spacecraft - The spacecraft object to attach the reticle to
 * @param {THREE.Camera} camera - The camera used for rendering (optional)
 * @returns {Object|null} - Object containing the reticle instance and update function, or null if error
 */
export function createReticle(scene, spacecraft, camera) {
    if (!scene || !spacecraft) {
        console.error("Cannot create reticle: scene or spacecraft not provided");
        return null;
    }
    console.log("Creating reticle for spacecraft:", spacecraft.name || "unnamed");
    
    // Create a NEW parent object for this specific reticle instance
    const newReticleObject = new THREE.Object3D();
    newReticleObject.name = "reticle-" + spacecraft.uuid; // Unique name
    
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
    
    // Create a triangular reticle
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
    
    // Add all components to the new reticle object
    newReticleObject.add(primaryGlow);
    newReticleObject.add(triangle);
    newReticleObject.add(crosshair);
    newReticleObject.add(brackets);
    
    // Scale the entire reticle
    newReticleObject.scale.set(config.scale, config.scale, config.scale);
    
    // Add the reticle to the provided scene
    scene.add(newReticleObject);

    // Store this reticle instance and its data in the map
    const reticleData = {
        object: newReticleObject,
        scene: scene,
        currentScale: config.scale, // Initialize scale for this instance
        targetScale: config.scale,
        lastBoostState: false,
        lastSlowState: false
    };
    reticleMap.set(spacecraft, reticleData);
    
    // Function to update THIS specific reticle instance
    function updateSpecificReticle(specificSpacecraft, isBoosting, isSlowing) {
        const currentReticleData = reticleMap.get(specificSpacecraft);
        if (!currentReticleData || !currentReticleData.object) {
            // console.warn("Reticle data not found for spacecraft:", specificSpacecraft?.uuid);
            return; 
        }
        
        const reticleObj = currentReticleData.object;
        
        // Use instance-specific state for scale transitions
        const boosting = isBoosting !== undefined ? isBoosting : (keys && keys.up);
        const slowing = isSlowing !== undefined ? isSlowing : (keys && keys.down);
        
        const boostStateChanged = boosting !== currentReticleData.lastBoostState;
        const slowStateChanged = slowing !== currentReticleData.lastSlowState;
        currentReticleData.lastBoostState = boosting;
        currentReticleData.lastSlowState = slowing;
        
        if (boosting) {
            currentReticleData.targetScale = config.boostScale;
        } else if (slowing) {
            currentReticleData.targetScale = config.slowScale;
        } else {
            currentReticleData.targetScale = config.scale;
        }
        
        if (Math.abs(currentReticleData.currentScale - currentReticleData.targetScale) > 0.01) {
            currentReticleData.currentScale += (currentReticleData.targetScale - currentReticleData.currentScale) * config.transitionSpeed;
        } else {
            currentReticleData.currentScale = currentReticleData.targetScale;
        }
        
        // Apply scale if changed significantly or state changed
        const viewportHeight = window.innerHeight;
        const scaleFactor = (viewportHeight / 1080) * currentReticleData.currentScale;
        if (Math.abs(reticleObj.scale.x - scaleFactor) > 0.01 || boostStateChanged || slowStateChanged) {
            reticleObj.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
        
        // Animate glow
        const time = performance.now() * 0.001;
        reticleObj.children.forEach(child => {
             if (child.material && child.material.uniforms) {
                if (child.material.uniforms.intensity) {
                    const pulseFactor = Math.sin(time * 2.0) * 0.2 + 0.8;
                    child.material.uniforms.intensity.value = 
                        child === primaryGlow 
                            ? config.glowIntensity * pulseFactor * 0.9
                            : config.glowIntensity * pulseFactor;
                }
                if (child.material.uniforms.time) {
                    child.material.uniforms.time.value = time;
                }
            }
        });

        // Position update logic (remains the same, uses specificSpacecraft)
        specificSpacecraft.updateMatrixWorld();
        const spacecraftPosition = new THREE.Vector3();
        specificSpacecraft.getWorldPosition(spacecraftPosition);
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyQuaternion(specificSpacecraft.quaternion);
        const targetPosition = spacecraftPosition.clone().add(
            forwardVector.clone().multiplyScalar(config.distance)
        );
        reticleObj.position.copy(targetPosition);
        reticleObj.quaternion.copy(specificSpacecraft.quaternion);
    }
    
    // Initial update for this specific reticle
    updateSpecificReticle(spacecraft, false, false);
    
    // Return the specific reticle object and its specific update function
    return {
        reticle: newReticleObject,
        // The update function stored in spacecraft.userData will call updateSpecificReticle
        update: (isBoosting, isSlowing) => updateSpecificReticle(spacecraft, isBoosting, isSlowing) 
    };
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
        return null;
    }
    
    console.log("Initializing reticle via initReticle for spacecraft:", spacecraft.name || "unnamed");
    
    // If a reticle already exists for this spacecraft, maybe remove the old one first?
    if (reticleMap.has(spacecraft)) {
        const oldData = reticleMap.get(spacecraft);
        if (oldData.object && oldData.scene) {
            oldData.scene.remove(oldData.object);
        }
        reticleMap.delete(spacecraft);
    }

    // Create the reticle using the refactored function
    const reticleComponent = createReticle(scene, spacecraft, camera);
    
    if (!reticleComponent) {
        console.error("Reticle creation failed in initReticle");
        return null;
    }

    // Set up window resize listener (only need to do this once globally)
    // Consider moving this listener setup outside this function if called multiple times.
    window.removeEventListener('resize', onWindowResize); // Remove previous listener if any
    window.addEventListener('resize', onWindowResize);
    
    // Initial size adjustment
    onWindowResize();
    
    console.log("Reticle initialized successfully via initReticle");
    // Return the component containing the reticle object and its specific update function
    return reticleComponent; 
}

/**
 * Sets the reticle visibility
 * @param {boolean} visible - Whether the reticle should be visible
 */
export function setReticleVisibility(visible) {
    if (reticleMap.size > 0) {
        reticleMap.forEach((reticleData) => {
            if (reticleData.object) {
                reticleData.object.visible = visible;
                console.log("Reticle visibility set to:", visible);
            }
        });
    }
}

/**
 * Sets the reticle color
 * @param {number} color - The color to set the reticle to (THREE.js color format)
 */
export function setReticleColor(color) {
    if (reticleMap.size > 0) {
        reticleMap.forEach((reticleData) => {
            if (reticleData.object) {
                reticleData.object.traverse((child) => {
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
    if (reticleMap.size > 0) {
        reticleMap.forEach((reticleData) => {
            if (reticleData.object) {
                reticleData.object.visible = true;
            }
        });
    }
    
    // Ensure the glow effect is active
    if (reticleMap.size > 0) {
        reticleMap.forEach((reticleData) => {
            if (reticleData.object) {
                reticleData.object.children.forEach(child => {
                    if (child.material && child.material.uniforms && child.material.uniforms.intensity) {
                        child.material.uniforms.intensity.value = config.glowIntensity;
                    }
                });
            }
        });
    }
    
    console.log("Reticle consistency ensured - color reset to default blue");
} 