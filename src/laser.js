import * as THREE from 'three';

// Scene-specific laser configurations
const LASER_CONFIG = {
    // Space scene configuration
    space: {
        color: 0xe42747,       // Bright red in space
        speed: 1000,           // Fast in vacuum
        boostSpeed: 5000,      // 5x faster when boosting
        length: 1000,          // Long beam in space
        thickness: 0.2,        // Standard thickness
        duration: 3000,        // Longer visible time in space
        cooldown: 50,          // Fast firing rate in space
        offset: 490,           // Forward offset in space - creates lasers ahead of wingtips
        boostOffset: 450       // Forward offset when boosting in space - even further ahead
    },
    
    // Earth/San Francisco scene configuration
    sanFran: {
        color: 0xe42747,       // Orange-red tint for atmosphere
        speed: 1000,            // Slower in atmosphere
        boostSpeed: 3000,      // Boost speed in atmosphere
        length: 1000,          // Shorter due to atmospheric visibility
        thickness: 0.2,        // Thicker for better visibility in atmosphere
        duration: 1500,        // Shorter duration due to atmospheric interference
        cooldown: 80,          // Slower firing rate due to atmospheric resistance
        offset: 492,             // No offset - lasers start right at wingtips
        boostOffset: 480       // Forward offset when boosting in atmosphere
    },
    
    // Moon scene configuration
    moon: {
        color: 0xe42747,       // Orange-red tint for atmosphere
        speed: 1000,            // Slower in atmosphere
        boostSpeed: 3000,      // Boost speed in atmosphere
        length: 1000,          // Shorter due to atmospheric visibility
        thickness: 0.2,        // Thicker for better visibility in atmosphere
        duration: 1500,        // Shorter duration due to atmospheric interference
        cooldown: 80,          // Slower firing rate due to atmospheric resistance
        offset: 1000,             // No offset - lasers start right at wingtips
        boostOffset: 480       // Forward offset when boosting in atmosphere
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
 * @param {number} now - Current timestamp 
 * @returns {Object} The created laser object
 */
function createWingtipLaser(wing, scene, config, laserSpeed, isBoosting, now) {
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
    
    // Determine which offset to use based on boost state
    const offsetToUse = isBoosting && config.boostOffset !== undefined ? 
                        config.boostOffset : config.offset;
    
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
 * Creates new laser beams from all four wingtips of the spacecraft
 * @param {THREE.Object3D} spacecraft - The spacecraft from which to fire the lasers
 * @param {THREE.Scene} scene - The scene to add the lasers to
 * @param {string} sceneType - The current scene type ('space', 'sanFran', or 'moon')
 * @param {boolean} isBoosting - Whether the spacecraft is currently boosting
 * @returns {Array} The created laser objects
 */
export function fireLaser(spacecraft, scene, sceneType = 'space', isBoosting = false) {
    // Get the appropriate configuration
    const config = LASER_CONFIG[sceneType] || LASER_CONFIG.space;
    
    // Check cooldown
    const now = Date.now();
    if (now - lastFireTime < config.cooldown) {
        return null;
    }
    lastFireTime = now;
    
    // Determine speed based on boost state
    const laserSpeed = isBoosting ? config.boostSpeed : config.speed;
    
    const lasers = [];
    
    // Find all wing objects
    let topRightWing = null;
    let bottomRightWing = null;
    let topLeftWing = null;
    let bottomLeftWing = null;
    
    // First, try to find wings by their names
    spacecraft.traverse(child => {
        if (child.name === "topRightWing") topRightWing = child;
        if (child.name === "bottomRightWing") bottomRightWing = child;
        if (child.name === "topLeftWing") topLeftWing = child;
        if (child.name === "bottomLeftWing") bottomLeftWing = child;
    });
    
    // If wings are found, create lasers from each wingtip
    if (topRightWing) {
        lasers.push(createWingtipLaser(topRightWing, scene, config, laserSpeed, isBoosting, now));
    }
    
    if (bottomRightWing) {
        lasers.push(createWingtipLaser(bottomRightWing, scene, config, laserSpeed, isBoosting, now));
    }
    
    if (topLeftWing) {
        lasers.push(createWingtipLaser(topLeftWing, scene, config, laserSpeed, isBoosting, now));
    }
    
    if (bottomLeftWing) {
        lasers.push(createWingtipLaser(bottomLeftWing, scene, config, laserSpeed, isBoosting, now));
    }
    
    // Optional: Play sound only once for all four lasers
    if (lasers.length > 0) {
        playLaserSound();
    } else {
        console.warn("No wings found on spacecraft - falling back to single laser");
        // Fallback to original laser if wings aren't found
        return createSingleLaser(spacecraft, scene, config, laserSpeed, isBoosting, now);
    }
    
    return lasers;
}

/**
 * Creates a single laser beam from the front of the spacecraft (fallback method)
 */
function createSingleLaser(spacecraft, scene, config, laserSpeed, isBoosting, now) {
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
    
    // Determine which offset to use based on boost state
    const offsetToUse = isBoosting && config.boostOffset !== undefined ? 
                        config.boostOffset : config.offset;
    
    // Calculate position in front of the spacecraft (along its local z-axis)
    const position = new THREE.Vector3(0, 0, offsetToUse);
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
    const now = Date.now();
    const lasersToRemove = [];
    
    // Update positions and find expired lasers
    activeLasers.forEach((laser, index) => {
        // Move laser forward
        laser.mesh.position.add(laser.velocity.clone().multiplyScalar(deltaTime));
        
        // Check if laser has expired
        if (now - laser.createdAt > laser.duration) {
            lasersToRemove.push(index);
        }
    });
    
    // Remove expired lasers (in reverse order to avoid index issues)
    for (let i = lasersToRemove.length - 1; i >= 0; i--) {
        const index = lasersToRemove[i];
        const laser = activeLasers[index];
        
        // Remove from scene
        if (laser.mesh.parent) {
            laser.mesh.parent.remove(laser.mesh);
        }
        
        // Dispose of resources
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
        
        // Remove from array
        activeLasers.splice(index, 1);
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
    activeLasers.forEach(laser => {
        if (laser.mesh.parent) {
            laser.mesh.parent.remove(laser.mesh);
        }
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
    });
    
    activeLasers.length = 0;
} 