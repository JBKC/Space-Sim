// coordinateUtils.js - Utilities for mapping between geographic coordinates and 3D plane coordinates

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js';

// New York center coordinates
export const LONDON_CENTER = { lat: 40.7128, lng: -74.0060 };

// Plane dimensions (should match the values in setup.js)
export const PLANE_WIDTH = 10000;
export const PLANE_HEIGHT = 10000;

// Function to convert lat/lng to 3D plane coordinates
export function latLngToPlane(lat, lng) {
    // If the iframe's CoordinateMapper is available, use it
    if (window.frames[0] && window.frames[0].CoordinateMapper) {
        return window.frames[0].CoordinateMapper.latLngToPlane(lat, lng);
    }
    
    // Fallback implementation if iframe mapper is not available
    // This is a simplified version that assumes a linear mapping
    // centered on New York
    
    // Earth's circumference at the equator (in meters)
    const EARTH_CIRCUMFERENCE = 40075000;
    
    // Calculate meters per degree at this latitude
    const metersPerDegreeLat = EARTH_CIRCUMFERENCE / 360;
    const metersPerDegreeLng = EARTH_CIRCUMFERENCE * Math.cos(LONDON_CENTER.lat * Math.PI / 180) / 360;
    
    // Calculate distance in meters
    const latDiff = lat - LONDON_CENTER.lat;
    const lngDiff = lng - LONDON_CENTER.lng;
    const northSouth = latDiff * metersPerDegreeLat;
    const eastWest = lngDiff * metersPerDegreeLng;
    
    // Scale to our plane size (assuming 10km = 10000 units covers about 0.1 degrees)
    // This scaling factor should be adjusted based on your desired scale
    const scaleFactor = PLANE_WIDTH / (0.1 * metersPerDegreeLng);
    
    // Convert to plane coordinates (x = east/west, z = north/south)
    // Note: In THREE.js, positive Z is south in our convention
    return {
        x: eastWest * scaleFactor,
        z: -northSouth * scaleFactor  // Negative because positive Z is south
    };
}

// Function to convert 3D plane coordinates to lat/lng
export function planeToLatLng(x, z) {
    // If the iframe's CoordinateMapper is available, use it
    if (window.frames[0] && window.frames[0].CoordinateMapper) {
        return window.frames[0].CoordinateMapper.planeToLatLng(x, z);
    }
    
    // Fallback implementation if iframe mapper is not available
    
    // Earth's circumference at the equator (in meters)
    const EARTH_CIRCUMFERENCE = 40075000;
    
    // Calculate meters per degree at this latitude
    const metersPerDegreeLat = EARTH_CIRCUMFERENCE / 360;
    const metersPerDegreeLng = EARTH_CIRCUMFERENCE * Math.cos(LONDON_CENTER.lat * Math.PI / 180) / 360;
    
    // Scale factor (same as in latLngToPlane)
    const scaleFactor = PLANE_WIDTH / (0.1 * metersPerDegreeLng);
    
    // Convert plane coordinates to distances in meters
    const eastWest = x / scaleFactor;
    const northSouth = -z / scaleFactor;  // Negative because positive Z is south
    
    // Convert to lat/lng differences
    const latDiff = northSouth / metersPerDegreeLat;
    const lngDiff = eastWest / metersPerDegreeLng;
    
    // Add to New York center coordinates
    return {
        lat: LONDON_CENTER.lat + latDiff,
        lng: LONDON_CENTER.lng + lngDiff
    };
}

// Function to place a 3D marker at specific geographic coordinates
export function place3DMarkerAtLatLng(scene, lat, lng, height = 100, color = 0xff0000) {
    const planeCoords = latLngToPlane(lat, lng);
    
    // Create a simple marker (cylinder + sphere)
    const markerGroup = new THREE.Group();
    
    // Base (cylinder)
    const baseGeometry = new THREE.CylinderGeometry(5, 5, height, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: color });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = height / 2;  // Position at half height
    markerGroup.add(base);
    
    // Top (sphere)
    const topGeometry = new THREE.SphereGeometry(10, 16, 16);
    const topMaterial = new THREE.MeshStandardMaterial({ color: color });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = height;  // Position at top of cylinder
    markerGroup.add(top);
    
    // Position the marker group at the calculated plane coordinates
    markerGroup.position.set(planeCoords.x, 0, planeCoords.z);
    
    // Add to scene
    scene.add(markerGroup);
    
    // Return the marker group for future reference
    return markerGroup;
}

// Function to create a helper grid that shows the coordinate system
export function createCoordinateGrid(scene, size = 10000, divisions = 20, centerColor = 0xff0000) {
    // Create a grid helper
    const gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0x444444);
    gridHelper.rotation.x = Math.PI / 2;  // Rotate to be horizontal (XZ plane)
    scene.add(gridHelper);
    
    // Create axes to show the coordinate system
    const axesHelper = new THREE.AxesHelper(size / 2);
    scene.add(axesHelper);
    
    // Create a marker at the center (0,0,0)
    const centerMarker = new THREE.Mesh(
        new THREE.SphereGeometry(20, 16, 16),
        new THREE.MeshBasicMaterial({ color: centerColor })
    );
    centerMarker.position.y = 20;
    scene.add(centerMarker);
    
    // Return the helpers for future reference
    return { gridHelper, axesHelper, centerMarker };
}

// Function to create a text label for a 3D position
export function create3DTextLabel(scene, text, position, color = 0xffffff, size = 20) {
    // This is a placeholder - implementing 3D text requires additional libraries
    // like THREE.TextGeometry which needs typeface.js fonts
    
    // For now, we'll create a simple marker with a console log
    const markerGeometry = new THREE.SphereGeometry(5, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    scene.add(marker);
    
    console.log(`Label at (${position.x}, ${position.y}, ${position.z}): ${text}`);
    
    return marker;
}

// Function to test the coordinate mapping with some landmarks
export function testCoordinateMapping(scene) {
    // Define some New York landmarks with their coordinates
    const landmarks = [
        { name: "Empire State Building", lat: 40.7484, lng: -73.9857, color: 0xff0000 },
        { name: "Statue of Liberty", lat: 40.6892, lng: -74.0445, color: 0x00ff00 },
        { name: "One World Trade Center", lat: 40.7127, lng: -74.0134, color: 0x0000ff },
        { name: "Times Square", lat: 40.7580, lng: -73.9855, color: 0xffff00 },
        { name: "Brooklyn Bridge", lat: 40.7061, lng: -73.9969, color: 0xff00ff }
    ];
    
    // Place 3D markers for each landmark
    landmarks.forEach(landmark => {
        const marker = place3DMarkerAtLatLng(
            scene,
            landmark.lat,
            landmark.lng,
            200,  // Height
            landmark.color
        );
        
        // Log the conversion results
        const planeCoords = latLngToPlane(landmark.lat, landmark.lng);
        console.log(`${landmark.name}: Geographic (${landmark.lat}, ${landmark.lng}) -> Plane (${planeCoords.x.toFixed(2)}, ${planeCoords.z.toFixed(2)})`);
        
        // Create a text label
        const labelPosition = new THREE.Vector3(planeCoords.x, 220, planeCoords.z);
        create3DTextLabel(scene, landmark.name, labelPosition, landmark.color);
    });
    
    // Create a coordinate grid
    createCoordinateGrid(scene);
    
    return "Coordinate mapping test complete. Check console for details.";
} 