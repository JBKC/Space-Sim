import * as THREE from 'three'; // Updated import for module system
import { scene, isMoonSurfaceActive } from './setup.js';
import { createSpacecraft } from './spacecraft.js';

// Laser properties
const laserLength = 20; // Length of the laser bolt
const laserRadius = 0.2; // Radius for a cylindrical look
const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9
});
const laserGeometry = new THREE.CylinderGeometry(laserRadius, laserRadius, laserLength, 32);

let activeLasers = [];

// Initialize spacecraft and use its wingtip objects
const spacecraftComponents = createSpacecraft(scene);
export const spacecraft = spacecraftComponents.spacecraft; // Export for external use if needed
const wingtipObjects = spacecraftComponents.wingtipObjects; // Use predefined wingtip objects

// Earth surface wingtip objects will be created when needed
let earthWingtipObjects = [];

function createLaser(startPosition, direction) {
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.position.copy(startPosition);

    // Align the laser with the spacecraft's forward direction
    laser.quaternion.copy(spacecraft.quaternion);
    
    // Rotate the cylinder to align its length with the Z-axis (forward direction)
    laser.rotateX(Math.PI / 2); // CylinderGeometry is aligned along Y-axis by default, rotate to Z

    // Store laser data
    laser.userData = {
        direction: direction.clone(),
        speed: 750, // Increased speed 5x from 150 to 750
        lifetime: 2000, // 2 seconds lifetime (can adjust if needed)
        startTime: performance.now()
    };

    return laser;
}

export function fireLasers() {
    // Determine which scene and spacecraft to use
    const currentScene = isMoonSurfaceActive ? earthSurfaceScene : scene;
    const targetSpacecraft = isMoonSurfaceActive ? 
        earthSurfaceScene.children.find(obj => obj.name === "EarthSurfaceSpacecraft") : 
        spacecraft;
    
    if (!targetSpacecraft) return;
    
    const forward = new THREE.Vector3(0, 0, 1); // Forward direction in local space
    forward.applyQuaternion(targetSpacecraft.quaternion); // Transform to world space

    // If we're on Earth's surface but don't have wingtips yet, create them
    if (isMoonSurfaceActive && earthWingtipObjects.length === 0) {
        // Create new wingtip objects for Earth spacecraft
        const wingtipOffsets = [
            new THREE.Vector3(3.0, 0, 0.2),  // Right top
            new THREE.Vector3(3.0, 0, -0.2), // Right bottom
            new THREE.Vector3(-3.0, 0, 0.2), // Left top
            new THREE.Vector3(-3.0, 0, -0.2) // Left bottom
        ];
        for (let i = 0; i < 4; i++) {
            const obj = new THREE.Object3D();
            obj.position.copy(wingtipOffsets[i]); // Use the same offsets as in spacecraft.js
            targetSpacecraft.add(obj);
            earthWingtipObjects.push(obj);
        }
    }
    
    // Use the appropriate wingtip objects
    const currentWingtips = isMoonSurfaceActive ? earthWingtipObjects : wingtipObjects;
    
    currentWingtips.forEach(wingtip => {
        if (!wingtip.parent) return; // Skip if not attached to anything
        
        const worldPos = new THREE.Vector3();
        wingtip.getWorldPosition(worldPos);

        const laser = createLaser(worldPos, forward);
        currentScene.add(laser);
        activeLasers.push(laser);
    });
}

export function startFiring() {
    // Controlled in main.js with animation loop
}

export function stopFiring() {
    // Controlled in main.js with animation loop
}

export function updateLasers() {
    const currentTime = performance.now();
    
    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const laser = activeLasers[i];
        // Move laser in the direction it was fired (forward)
        laser.position.add(laser.userData.direction.clone().multiplyScalar(laser.userData.speed * (1 / 60))); // Assuming 60 FPS
        
        // Remove laser after lifetime
        if (currentTime - laser.userData.startTime > laser.userData.lifetime) {
            if (laser.parent) {
                laser.parent.remove(laser);
            } else {
                // If no parent, determine which scene it's in
                const currentScene = isMoonSurfaceActive ? earthSurfaceScene : scene;
                currentScene.remove(laser);
            }
            activeLasers.splice(i, 1);
        }
    }
}