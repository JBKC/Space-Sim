// src/lasers.js
import { scene, spacecraft, earthSurfaceScene, isEarthSurfaceActive } from './setup.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js';

const laserLength = 20; // Length of the laser bolt
const laserRadius = 0.2; // Radius for a cylindrical look
const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9
});

const laserGeometry = new THREE.CylinderGeometry(laserRadius, laserRadius, laserLength, 32);

let activeLasers = [];

// Create virtual objects to track wingtips
const wingtipObjects = [
    new THREE.Object3D(), // Right top
    new THREE.Object3D(), // Right bottom
    new THREE.Object3D(), // Left top
    new THREE.Object3D()  // Left bottom
];

// Attach these objects as children to the spacecraft, so they move with it
// Adjusted Z value to position wingtips at the front tips of the wings
const wingtipOffsets = [
    new THREE.Vector3(2.5, 0.6, 10),  // Right top (moved further forward)
    new THREE.Vector3(2.5, -0.6, 10), // Right bottom (moved further forward)
    new THREE.Vector3(-2.5, 0.6, 10), // Left top (moved further forward)
    new THREE.Vector3(-2.5, -0.6, 10) // Left bottom (moved further forward)
];

wingtipObjects.forEach((obj, index) => {
    obj.position.copy(wingtipOffsets[index]);
    spacecraft.add(obj); // Parent wingtips to the spacecraft
});

// Earth surface wingtip objects will be created when needed
let earthWingtipObjects = [];

function createLaser(startPosition, direction) {
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.position.copy(startPosition);

    // Get the appropriate spacecraft
    const targetSpacecraft = isEarthSurfaceActive ? 
        earthSurfaceScene.children.find(obj => obj.name === "EarthSurfaceSpacecraft") : 
        spacecraft;
    
    if (targetSpacecraft) {
        // Align the laser with the spacecraft's forward direction
        laser.quaternion.copy(targetSpacecraft.quaternion);
    }
    
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
    const currentScene = isEarthSurfaceActive ? earthSurfaceScene : scene;
    const targetSpacecraft = isEarthSurfaceActive ? 
        earthSurfaceScene.children.find(obj => obj.name === "EarthSurfaceSpacecraft") : 
        spacecraft;
    
    if (!targetSpacecraft) return;
    
    const forward = new THREE.Vector3(0, 0, 1); // Forward direction in local space
    forward.applyQuaternion(targetSpacecraft.quaternion); // Transform to world space

    // If we're on Earth's surface but don't have wingtips yet, create them
    if (isEarthSurfaceActive && earthWingtipObjects.length === 0) {
        // Create new wingtip objects for Earth spacecraft
        for (let i = 0; i < 4; i++) {
            const obj = new THREE.Object3D();
            obj.position.copy(wingtipOffsets[i]);
            targetSpacecraft.add(obj);
            earthWingtipObjects.push(obj);
        }
    }
    
    // Use the appropriate wingtip objects
    const currentWingtips = isEarthSurfaceActive ? earthWingtipObjects : wingtipObjects;
    
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
                const currentScene = isEarthSurfaceActive ? earthSurfaceScene : scene;
                currentScene.remove(laser);
            }
            activeLasers.splice(i, 1);
        }
    }
}