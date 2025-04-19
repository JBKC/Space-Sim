// starsVR.js - Handles star generation and updates for VR environment

import * as THREE from 'three';
import { universalScaleFactor } from '../appConfig/loaders.js';

// Star configuration constants
const STAR_COUNT = 200000; // Fewer stars for better VR performance
const STAR_SIZE = 25;
const STAR_RANGE = 250000;

// Create stars
export function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    
    // Create stars with varying distances and initial brightness
    for (let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        
        // Random position in a large sphere around the origin
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = STAR_RANGE * Math.pow(Math.random(), 1/3); // Cube root for even volumetric distribution
        
        starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i3 + 2] = radius * Math.cos(phi);
        
        // Store initial bright white color (will be attenuated based on distance)
        starColors[i3] = 1.0;     // R
        starColors[i3 + 1] = 1.0; // G
        starColors[i3 + 2] = 1.0; // B
        
        // Vary star sizes slightly (between 1 and 3)
        starSizes[i] = 1 + Math.random() * 2;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    
    const starMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff,
        size: STAR_SIZE * universalScaleFactor,
        vertexColors: true, // Use the color attribute
        sizeAttenuation: true, // Make distant stars smaller
        transparent: true,
        opacity: 1.0 // Full opacity
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    console.log(`VR stars created: ${STAR_COUNT} points`);
    
    return {
        stars,
        count: STAR_COUNT,
        range: STAR_RANGE
    };
}

// Update stars brightness based on distance to camera
export function updateStars(stars, cameraPosition) {
    if (!stars || !stars.geometry) return;
    
    const positions = stars.geometry.attributes.position.array;
    const colors = stars.geometry.attributes.color.array;
    
    // Update star brightness based on distance to camera
    for (let i = 0; i < STAR_COUNT * 3; i += 3) {
        // Calculate distance from camera to this star
        const dx = positions[i] - cameraPosition.x;
        const dy = positions[i + 1] - cameraPosition.y;
        const dz = positions[i + 2] - cameraPosition.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Check if star is too far from the camera (beyond view range)
        if (distance > STAR_RANGE * 0.8) {
            // Respawn the star in a new random position in a full sphere around the camera
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = STAR_RANGE * 0.4 * Math.pow(Math.random(), 1/3);
            
            // Position relative to camera
            positions[i] = cameraPosition.x + radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = cameraPosition.y + radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = cameraPosition.z + radius * Math.cos(phi);
        }
        
        // Recalculate distance after possible respawn
        const newDx = positions[i] - cameraPosition.x;
        const newDy = positions[i + 1] - cameraPosition.y;
        const newDz = positions[i + 2] - cameraPosition.z;
        const newDistance = Math.sqrt(newDx*newDx + newDy*newDy + newDz*newDz);
        
        // More extreme interpolation based on distance
        // Stars closer than 8% of range are at full brightness
        // Stars further than 25% of range are at minimum brightness
        const minDistance = STAR_RANGE * 0.08;
        const maxDistance = STAR_RANGE * 0.25;
        let brightness = 1.0;
        
        if (newDistance > minDistance) {
            // More dramatic falloff - distant stars are barely visible (only 5% brightness)
            brightness = 1.0 - Math.min(1.0, (newDistance - minDistance) / (maxDistance - minDistance)) * 0.95;
        }
        
        // Apply brightness to RGB values
        colors[i] = brightness; // R
        colors[i + 1] = brightness; // G
        colors[i + 2] = brightness; // B
    }
    
    // Update the geometry attributes
    stars.geometry.attributes.position.needsUpdate = true;
    stars.geometry.attributes.color.needsUpdate = true;
} 