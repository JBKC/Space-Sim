import { scene, spacecraft } from './setup.js';
import { challengeComplete } from './gameLogic.js';

const laserMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
    emissive: 0xff0000,
    emissiveIntensity: 1,
    shininess: 100
});

// Make lasers longer and thinner
const laserGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 8);
const lasers = [];
const LASER_SPEED = 20; // Increased speed
const FIRE_RATE = 150; // Slightly slower fire rate for better visibility
let lastFireTime = 0;

export function createLaser() {
    if (challengeComplete) return; // Don't allow firing if challenge is complete
    
    const now = Date.now();
    if (now - lastFireTime < FIRE_RATE) return;
    lastFireTime = now;

    // Position lasers at wing cannons
    const offsets = [
        { x: 0.8, y: 0.1, z: 0.5 },  // Right top
        { x: -0.8, y: 0.1, z: 0.5 }, // Left top
        { x: 0.8, y: -0.1, z: 0.5 },  // Right bottom
        { x: -0.8, y: -0.1, z: 0.5 }  // Left bottom
    ];
    
    offsets.forEach(offset => {
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        
        // Create a temporary group to handle positioning
        const temp = new THREE.Group();
        spacecraft.add(temp);
        temp.position.set(offset.x, offset.y, offset.z);
        
        // Get the world position and orientation
        const worldPos = new THREE.Vector3();
        temp.getWorldPosition(worldPos);
        spacecraft.remove(temp);
        
        // Position laser
        laser.position.copy(worldPos);
        
        // Orient laser to match spacecraft direction
        laser.quaternion.copy(spacecraft.quaternion);
        
        // Rotate to align with forward direction
        laser.rotateX(Math.PI / 2);
        
        // Set velocity in shooting direction
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(spacecraft.quaternion);
        laser.velocity = direction.multiplyScalar(LASER_SPEED);
        
        scene.add(laser);
        lasers.push(laser);
    });
}

export function updateLasers() {
    // Handle firing
    if (window.isSpacePressed) {
        createLaser();
    }
    
    // Update laser positions
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        laser.position.add(laser.velocity);
        
        // Remove lasers that have traveled too far
        if (laser.position.length() > 2000) {  // Increased range
            scene.remove(laser);
            lasers.splice(i, 1);
        }
    }
} 