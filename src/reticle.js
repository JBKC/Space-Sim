import * as THREE from 'three'; // Added module-friendly import
import { spaceScene as scene,
     isMoonSurfaceActive } from './setup.js';
import { createSpacecraft } from './spacecraft.js';

// Initialize spacecraft
const spacecraftComponents = createSpacecraft(scene);
const spacecraft = spacecraftComponents.spacecraft; // Use the spacecraft from createSpacecraft

// Create reticle group
const reticleGroup = new THREE.Group();
scene.add(reticleGroup);

// Adjusted reticle size (1/3rd smaller)
const reticleSize = 1.7;    // Was 5, now much smaller
const lineLength = 0.6;     // Adjusted corner length

// Thicker material using LineBasicMaterial
const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 1000,  // Much thicker lines (note: linewidth > 1 may not work in all WebGL contexts)
    transparent: true,
    opacity: 1.0
});

// Helper function to create a corner line
function createCornerLine(startX, startY, endX, endY) {
    const points = [
        new THREE.Vector3(startX, startY, -2),  // Closer to camera
        new THREE.Vector3(endX, endY, -2)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    reticleGroup.add(line);
}

// Define new smaller reticle corner lines
createCornerLine(-reticleSize, -reticleSize, -reticleSize + lineLength, -reticleSize); // Bottom left
createCornerLine(-reticleSize, -reticleSize, -reticleSize, -reticleSize + lineLength);

createCornerLine(reticleSize, -reticleSize, reticleSize - lineLength, -reticleSize); // Bottom right
createCornerLine(reticleSize, -reticleSize, reticleSize, -reticleSize + lineLength);

createCornerLine(-reticleSize, reticleSize, -reticleSize + lineLength, reticleSize); // Top left
createCornerLine(-reticleSize, reticleSize, -reticleSize, reticleSize - lineLength);

createCornerLine(reticleSize, reticleSize, reticleSize - lineLength, reticleSize); // Top right
createCornerLine(reticleSize, reticleSize, reticleSize, reticleSize - lineLength);

// Function to update reticle position with vertical offset
export function updateReticle() {
    let targetSpacecraft = spacecraft;

    // Optionally handle Earth surface mode
    if (isMoonSurfaceActive) {
        // Assuming earthSurfaceScene is available; replace with actual import if needed
        targetSpacecraft = earthSurfaceScene?.children.find(obj => obj.name === "EarthSurfaceSpacecraft") || spacecraft;
    }

    // Show reticle
    reticleGroup.visible = true;
    
    // Get spacecraft position
    const spacecraftPosition = new THREE.Vector3();
    targetSpacecraft.getWorldPosition(spacecraftPosition);
    
    // Get forward direction of spacecraft
    const forward = new THREE.Vector3(0, 0, 1); // Z+ is forward
    forward.applyQuaternion(targetSpacecraft.quaternion);
    
    // Position reticle 50 units in front of the spacecraft
    const position = spacecraftPosition.clone().add(forward.multiplyScalar(50));
    
    // Add a vertical offset to move the reticle up
    position.y += 2; // Adjust this value as needed
    
    reticleGroup.position.copy(position);
    
    // Ensure the reticle faces the same direction as the spacecraft
    reticleGroup.rotation.copy(targetSpacecraft.rotation);
}