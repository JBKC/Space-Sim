// src/groundTexture.js
import * as THREE from 'three';

export function createGroundTexture(scene, tilesBoundingSphere) {
    // Define the ground plane size based on the tileset's bounding sphere
    const radius = tilesBoundingSphere.radius;
    const width = radius * 2;  // Diameter of the bounding sphere
    const height = radius * 2;

    // Create the ground plane geometry
    const groundGeometry = new THREE.PlaneGeometry(width, height);

    // Load a static texture (replace with your NYC image path)
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('path/to/nyc_ground_texture.jpg'); // Placeholder path
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(1, 1); // Adjust if texture needs tiling

    // Create material with the texture
    const groundMaterial = new THREE.MeshBasicMaterial({
        map: groundTexture,
        side: THREE.DoubleSide, // Visible from both sides
    });

    // Create the ground plane mesh
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2; // Rotate to lie flat on XZ plane
    groundPlane.position.copy(tilesBoundingSphere.center); // Center at tileset’s center
    groundPlane.position.y = -tilesBoundingSphere.radius; // Place at the base of the tileset

    // Add to the scene
    scene.add(groundPlane);

    return groundPlane;
}