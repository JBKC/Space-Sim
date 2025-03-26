import * as THREE from './assets/lib/three.module.js';

// Scene-specific laser configurations
const LASER_CONFIG = {
    // Space scene configuration
    space: {
        color: 0xFF5349,       // Bright red in space
        speed: 5000,           // Fast in vacuum
        boostSpeed: 5000,      // 5x faster when boosting
        slowSpeed: 1000,        // Half speed in slow mode
        length: 1000,          // Long beam in space
        thickness: 0.2,        // Standard thickness
        duration: 3000,        // Longer visible time in space
        cooldown: 50,          // Fast firing rate in space
        offset: 0,             // No offset - lasers start directly at turrets
        boostOffset: 0,        // No offset when boosting
        slowOffset: 0          // No offset when in slow mode
    },
    
    // Earth/San Francisco scene configuration
    sanFran: {
        color: 0xFF5349,       // Orange-red tint for atmosphere
        speed: 1000,            // Slower in atmosphere
        boostSpeed: 3000,      // Boost speed in atmosphere
        slowSpeed: 1000,        // Half speed in slow mode
        length: 1000,          // Shorter due to atmospheric visibility
        thickness: 0.2,        // Thicker for better visibility in atmosphere
        duration: 1500,        // Shorter duration due to atmospheric interference
        cooldown: 80,          // Slower firing rate due to atmospheric resistance
        offset: 0,             // No offset - lasers start directly at turrets
        boostOffset: 0,        // No offset when boosting
        slowOffset: 0          // No offset when in slow mode
    },
    
    // Moon scene configuration
    moon: {
        color: 0xFF5349,       // Orange-red tint for atmosphere
        speed: 1000,            // Slower in atmosphere
        boostSpeed: 3000,      // Boost speed in atmosphere
        slowSpeed: 500,        // Half speed in slow mode
        length: 1000,          // Shorter due to atmospheric visibility
        thickness: 0.2,        // Thicker for better visibility in atmosphere
        duration: 1500,        // Shorter duration due to atmospheric interference
        cooldown: 80,          // Slower firing rate due to atmospheric resistance
        offset: 0,             // No offset - lasers start directly at turrets
        boostOffset: 0,        // No offset when boosting
        slowOffset: 0          // No offset when in slow mode
    },
};

// Keep track of all active lasers
const activeLasers = [];
let lastFireTime = 0;

// Wing tip positions relative to their parent wing groups
const WING_TIP_RELATIVE_POSITION = new THREE.Vector3(2.5, 0, 0);

/**
 * Creates a new laser beam from one of the spacecraft's wingtips
 * @param {THREE.Object3D} wing - The wing object from which to fire the laser
 * @param {THREE.Scene} scene - The scene to add the laser to
 * @param {Object} config - The laser configuration
 * @param {number} laserSpeed - The speed of the laser
 * @param {boolean} isBoosting - Whether the spacecraft is boosting
 * @param {boolean} isSlowing - Whether the spacecraft is in slow mode
 * @param {number} now - Current timestamp 
 * @returns {Object} The created laser object
 */
function createWingtipLaser(wing, scene, config, laserSpeed, isBoosting, isSlowing, now) {
    // Create laser geometry and material
    const geometry = new THREE.CylinderGeometry(
        config.thickness, 
        config.thickness, 
        config.length, 
        8
    );
    
    // Rotate cylinder to point forward (along z-axis)
    geometry.rotateX(Math.PI / 2);
    
    // Create glowing material for the laser
    const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.8,
        emissive: config.color,
        emissiveIntensity: 1.5
    });
    
    // Create mesh
    const laserMesh = new THREE.Mesh(geometry, material);
    
    // Find the wingtip position in world space
    wing.updateMatrixWorld(true); // Ensure matrix is updated
    
    // Create a position at the wing tip (which is at 2.5, 0, 0 relative to the wing)
    // Then add an offset forward in the wing's local z-direction based on config
    const tipPosition = WING_TIP_RELATIVE_POSITION.clone();
    
    // Determine which offset to use based on movement state
    let offsetToUse;
    if (isBoosting && config.boostOffset !== undefined) {
        offsetToUse = config.boostOffset;
    } else if (isSlowing && config.slowOffset !== undefined) {
        offsetToUse = config.slowOffset;
    } else {
        offsetToUse = config.offset;
    }
    
    // Get spacecraft's forward direction for the laser direction
    const spacecraft = wing.parent;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.quaternion);
    
    // Apply the wing's world matrix to get the world position of the wingtip
    const position = tipPosition.clone();
    position.applyMatrix4(wing.matrixWorld);
    
    // Add the offset in the direction the spacecraft is facing
    position.add(forward.clone().multiplyScalar(offsetToUse));
    
    // Set the laser mesh position
    laserMesh.position.copy(position);
    
    // Orient the laser in the same direction the spacecraft is facing
    laserMesh.quaternion.copy(spacecraft.quaternion);
    
    // Store velocity based on spacecraft's forward direction
    const velocity = forward.multiplyScalar(laserSpeed);
    
    // Add to scene
    scene.add(laserMesh);
    
    // Create laser object with metadata
    const laser = {
        mesh: laserMesh,
        velocity: velocity,
        createdAt: now,
        duration: config.duration
    };
    
    // Add to active lasers
    activeLasers.push(laser);
    
    return laser;
}

/**
 * Creates a new laser beam from one of the spacecraft's turrets
 * @param {THREE.Object3D} turret - The turret object from which to fire the laser
 * @param {THREE.Scene} scene - The scene to add the laser to
 * @param {Object} config - The laser configuration
 * @param {number} laserSpeed - The speed of the laser
 * @param {boolean} isBoosting - Whether the spacecraft is boosting
 * @param {boolean} isSlowing - Whether the spacecraft is in slow mode
 * @param {number} now - Current timestamp 
 * @returns {Object} The created laser object
 */
function createTurretLaser(turret, scene, config, laserSpeed, isBoosting, isSlowing, now) {
    // DEBUGGING: Log turret information
    console.log(`Creating laser from turret: ${turret.name}`);
    
    // Create laser geometry and material
    const geometry = new THREE.CylinderGeometry(
        config.thickness, 
        config.thickness, 
        config.length, 
        8
    );
    
    // Rotate cylinder to point forward (along z-axis)
    geometry.rotateX(Math.PI / 2);
    
    // Create glowing material for the laser
    const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.8,
        emissive: config.color,
        emissiveIntensity: 1.5
    });
    
    // Create mesh
    const laserMesh = new THREE.Mesh(geometry, material);
    
    // Find the turret position in world space
    turret.updateMatrixWorld(true); // Ensure matrix is updated
    
    // Get spacecraft's forward direction for the laser direction
    let spacecraft = turret.parent;
    while (spacecraft && spacecraft.name !== 'spacecraft') {
        spacecraft = spacecraft.parent;
    }
    
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.quaternion);
    
    // Get the world position of the turret
    const position = new THREE.Vector3();
    turret.getWorldPosition(position);
    
    // DEBUGGING: Log turret position
    console.log(`Turret position: x=${position.x.toFixed(2)}, y=${position.y.toFixed(2)}, z=${position.z.toFixed(2)}`);
    
    // No offset - lasers start directly at the turret positions
    // position.add(forward.clone().multiplyScalar(offsetToUse * 0.1)); // Removed offset
    
    // Set the laser mesh position
    laserMesh.position.copy(position);
    
    // Orient the laser in the same direction the spacecraft is facing
    laserMesh.quaternion.copy(spacecraft.quaternion);
    
    // Store velocity based on spacecraft's forward direction
    const velocity = forward.multiplyScalar(laserSpeed);
    
    // Add to scene
    scene.add(laserMesh);
    
    // Create laser object with metadata
    const laser = {
        mesh: laserMesh,
        velocity: velocity,
        createdAt: now,
        duration: config.duration
    };
    
    // Add to active lasers
    activeLasers.push(laser);
    
    return laser;
}

/**
 * Creates new laser beams from all four turrets of the spacecraft
 * @param {THREE.Object3D} spacecraft - The spacecraft from which to fire the lasers
 * @param {THREE.Scene} scene - The scene to add the lasers to
 * @param {string} sceneType - The current scene type ('space', 'sanFran', or 'moon')
 * @param {boolean} isBoosting - Whether the spacecraft is currently boosting
 * @param {boolean} isSlowing - Whether the spacecraft is in slow mode
 * @returns {Array} The created laser objects
 */
export function fireLaser(spacecraft, scene, sceneType = 'space', isBoosting = false, isSlowing = false) {
    try {
        // Get the appropriate configuration
        const config = LASER_CONFIG[sceneType] || LASER_CONFIG.space;
        
        // Check cooldown
        const now = Date.now();
        if (now - lastFireTime < config.cooldown) {
            return null;
        }
        lastFireTime = now;
        
        // DEBUGGING: Log firing attempt
        console.log(`==== FIRING LASER in ${sceneType} scene ====`);
        console.log(`Spacecraft:`, spacecraft?.name);
        
        // Determine speed based on movement state
        let laserSpeed;
        if (isBoosting) {
            laserSpeed = config.boostSpeed;
        } else if (isSlowing) {
            laserSpeed = config.slowSpeed;
        } else {
            laserSpeed = config.speed;
        }
        
        const lasers = [];
        
        // Find the turrets in the model
        // First, look in the model's userData where they should be stored
        let turrets = [];
        let xWingModel = null;
        
        // Find the xWingModel
        spacecraft.traverse(child => {
            if (child.name === 'xWingModel') {
                xWingModel = child;
                console.log('FOUND xWingModel:', child.name);
            }
        });
        
        // DEBUGGING: Log xWingModel search result
        console.log('xWingModel found:', xWingModel ? 'YES' : 'NO');
        
        // If we found the xWingModel, try to get the turrets from userData
        if (xWingModel && xWingModel.userData && xWingModel.userData.exhaustAndTurret) {
            // Get all turrets
            const turretObjects = xWingModel.userData.exhaustAndTurret;
            
            // DEBUGGING: Log turret object search
            console.log('exhaustAndTurret data:', 
                Object.keys(turretObjects).filter(k => k.startsWith('turret_')).map(k => 
                    `${k}: ${turretObjects[k] ? 'FOUND ✓' : 'MISSING ✗'}`
                ).join(', ')
            );
            
            if (turretObjects.turret_LB) turrets.push(turretObjects.turret_LB);
            if (turretObjects.turret_LT) turrets.push(turretObjects.turret_LT);
            if (turretObjects.turret_RB) turrets.push(turretObjects.turret_RB);
            if (turretObjects.turret_RT) turrets.push(turretObjects.turret_RT);
            
            // DEBUGGING: Log turrets found
            console.log(`Found ${turrets.length} turrets to fire from`);
        } else {
            // DEBUGGING: Log why turrets weren't found
            if (!xWingModel) {
                console.warn('xWingModel not found in spacecraft hierarchy');
            } else if (!xWingModel.userData) {
                console.warn('xWingModel does not have userData property');
            } else if (!xWingModel.userData.exhaustAndTurret) {
                console.warn('xWingModel userData missing exhaustAndTurret data');
                console.log('Available userData keys:', Object.keys(xWingModel.userData).join(', '));
            }
        }
        
        // If we found at least one turret, fire from them
        if (turrets.length > 0) {
            // Fire from each turret
            for (const turret of turrets) {
                try {
                    lasers.push(createTurretLaser(turret, scene, config, laserSpeed, isBoosting, isSlowing, now));
                } catch (e) {
                    console.error("Error creating turret laser:", e);
                }
            }
            
            // Play sound only once for all lasers
            if (lasers.length > 0) {
                playLaserSound();
                return lasers;
            }
        }
        
        // If no turrets were found or lasers couldn't be created, fall back to the original method
        return createSingleLaser(spacecraft, scene, config, laserSpeed, isBoosting, isSlowing, now);
    } catch (error) {
        // If anything goes wrong, just return without firing
        console.error("Error firing laser:", error);
        return null;
    }
}

/**
 * Creates a single laser beam from the front of the spacecraft (fallback method)
 */
function createSingleLaser(spacecraft, scene, config, laserSpeed, isBoosting, isSlowing, now) {
    // Create laser geometry and material
    const geometry = new THREE.CylinderGeometry(
        config.thickness, 
        config.thickness, 
        config.length, 
        8
    );
    
    // Rotate cylinder to point forward (along z-axis)
    geometry.rotateX(Math.PI / 2);
    
    // Create glowing material for the laser
    const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.8,
        emissive: config.color,
        emissiveIntensity: 1.5
    });
    
    // Create mesh
    const laserMesh = new THREE.Mesh(geometry, material);
    
    // Position the laser in front of the spacecraft
    spacecraft.updateMatrixWorld(true); // Ensure matrix is updated
    
    // Calculate position at the front center of the spacecraft (without offset)
    const position = new THREE.Vector3(0, 0, 0); // Start at spacecraft's origin
    position.applyMatrix4(spacecraft.matrixWorld);
    laserMesh.position.copy(position);
    
    // Orient the laser in the same direction the spacecraft is facing
    const quaternion = spacecraft.quaternion.clone();
    laserMesh.quaternion.copy(quaternion);
    
    // Store velocity based on spacecraft's forward direction
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.quaternion);
    const velocity = forward.multiplyScalar(laserSpeed);
    
    // Add to scene
    scene.add(laserMesh);
    
    // Create laser object with metadata
    const laser = {
        mesh: laserMesh,
        velocity: velocity,
        createdAt: now,
        duration: config.duration
    };
    
    // Add to active lasers
    activeLasers.push(laser);
    
    return laser;
}

/**
 * Updates all active lasers, moving them forward and removing those that have expired
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updateLasers(deltaTime) {
    try {
        const now = Date.now();
        const lasersToRemove = [];
        
        // Safety check for reasonable deltaTime values
        const safeDeltaTime = Math.min(deltaTime, 0.1); // Cap at 100ms to prevent huge jumps
        
        // Update positions and find expired lasers
        activeLasers.forEach((laser, index) => {
            try {
                // Move laser forward
                laser.mesh.position.add(laser.velocity.clone().multiplyScalar(safeDeltaTime));
                
                // Check if laser has expired
                if (now - laser.createdAt > laser.duration) {
                    lasersToRemove.push(index);
                }
            } catch (error) {
                // If there's an error with a specific laser, mark it for removal
                console.error("Error updating laser:", error);
                lasersToRemove.push(index);
            }
        });
        
        // Remove expired lasers (in reverse order to avoid index issues)
        for (let i = lasersToRemove.length - 1; i >= 0; i--) {
            try {
                const index = lasersToRemove[i];
                const laser = activeLasers[index];
                
                // Remove from scene safely
                if (laser && laser.mesh && laser.mesh.parent) {
                    laser.mesh.parent.remove(laser.mesh);
                }
                
                // Dispose of resources safely
                if (laser && laser.mesh) {
                    if (laser.mesh.geometry) laser.mesh.geometry.dispose();
                    if (laser.mesh.material) laser.mesh.material.dispose();
                }
                
                // Remove from array
                activeLasers.splice(index, 1);
            } catch (error) {
                console.error("Error removing laser:", error);
                // Just continue to the next laser
            }
        }
        
        // If we have an unreasonable number of active lasers, clear them all
        if (activeLasers.length > 1000) {
            console.warn("Too many active lasers detected, clearing all");
            clearAllLasers();
        }
    } catch (error) {
        console.error("Error in updateLasers:", error);
        // In case of critical failure, clear all lasers
        clearAllLasers();
    }
}

/**
 * Plays the laser sound effect
 */
function playLaserSound() {
    try {
        // Check if Audio API is available
        if (typeof Audio !== 'undefined') {
            const sound = new Audio('laser-sound.mp3');
            sound.volume = 0.3; // Lower volume
            sound.play().catch(e => console.log('Could not play laser sound:', e));
        }
    } catch (e) {
        console.log('Sound playback error:', e);
    }
}

/**
 * Checks if a laser has hit anything in the scene
 * @param {THREE.Scene} scene - The scene to check for collisions
 * @param {Function} onHit - Callback function when a hit is detected
 */
export function checkLaserCollisions(scene, onHit) {
    // Implement collision detection here if needed
    // This could use raycasting or bounding box intersections
}

/**
 * Removes all active lasers from the scene
 */
export function clearAllLasers() {
    try {
        activeLasers.forEach(laser => {
            try {
                if (laser && laser.mesh) {
                    if (laser.mesh.parent) {
                        laser.mesh.parent.remove(laser.mesh);
                    }
                    if (laser.mesh.geometry) laser.mesh.geometry.dispose();
                    if (laser.mesh.material) laser.mesh.material.dispose();
                }
            } catch (e) {
                // Silently fail for individual lasers
            }
        });
        
        // Clear the array
        activeLasers.length = 0;
    } catch (error) {
        console.error("Error in clearAllLasers:", error);
        // Last resort - force clear the array
        activeLasers.length = 0;
    }
} 