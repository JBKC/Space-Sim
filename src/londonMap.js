// src/londonMap.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// London center coordinates
const LONDON_CENTER = { lat: 51.5074, lng: -0.1278 };

// Global variables
let map;
let scene, camera, renderer, controls;
let overlay;

// Initialize when the page loads
window.initMap = function() {
    // Hide loading screen
    document.getElementById('loading').style.display = 'none';
    
    // Initialize the map
    map = new google.maps.Map(document.getElementById('map'), {
        center: LONDON_CENTER,
        zoom: 15,
        mapTypeId: 'satellite',
        heading: 0,
        tilt: 45
    });
    
    // Initialize Three.js scene
    scene = new THREE.Scene();
    
    // Create the overlay
    overlay = new ThreeJSOverlayView({
        map,
        scene,
        anchor: { lat: LONDON_CENTER.lat, lng: LONDON_CENTER.lng, altitude: 0 },
        THREE
    });
    
    // Add some 3D objects to the scene
    addBuildings();
    
    console.log('London Map initialized successfully');
};

// Function to add 3D buildings to the scene
function addBuildings() {
    // Example building - replace with actual London buildings
    const buildingGeometry = new THREE.BoxGeometry(10, 30, 10);
    const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0x0066cc });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    
    // Position the building at London's coordinates
    overlay.latLngAltitudeToVector3(
        { lat: LONDON_CENTER.lat, lng: LONDON_CENTER.lng, altitude: 15 },
        building.position
    );
    
    // Add the building to the scene
    scene.add(building);
} 