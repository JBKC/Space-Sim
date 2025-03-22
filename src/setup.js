// src/setup.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js';
import { updateMovement, updateCamera, keys } from './movement.js';
import { createSpacecraft } from './spacecraft.js';
import { fireLaser, updateLasers } from './laser.js';

// General initialization - scene, camera, renderer
// do outside of init function as scene is required by multiple other files
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);

// set up renderer for default space view
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('space-container').appendChild(renderer.domElement);
let spaceInitialized = false;
let isBoosting = false;
let isHyperspace = false;

export { 
    renderer, 
    scene, 
    camera, 
};

// Renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1, 1, -1).normalize();
scene.add(directionalLight);

const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
sideLight.position.set(-1, -1, 1).normalize();
scene.add(sideLight);

scene.background = new THREE.Color(0x000000);

// Flag to track which scene is active
export let isMoonSurfaceActive = false;
export let isEarthSurfaceActive = false;

// Render function that delegates to earth3D.js when in Earth surface mode
// Update the renderScene function to avoid initializing earth3D multiple times
export function renderScene() {
    if (isMoonSurfaceActive) {
        // nothing to do here
        console.log("Moon surface active, deferring rendering");
    } else if (isEarthSurfaceActive) {
        // nothing to do here
        console.log("Earth surface active, deferring rendering");
    } else {
        // Render space scene
        console.log("Rendering space scene");
        renderer.render(scene, camera);
    }
}
// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
let updateEngineEffects;
const wingTransitionFrames = 30;

// Export spacecraft variables for other modules
export { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, wingsOpen, wingAnimation, updateEngineEffects };

// Track if controls have been initialized
let controlsInitialized = false;

// Initialize spacecraft
function initSpacecraft() {
    const spacecraftComponents = createSpacecraft(scene);
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;

    // Verify reticle creation
    if (spacecraftComponents.reticle) {
        console.log("Reticle was successfully created with spacecraft in setup.js");
    } else {
        console.warn("Reticle not found in spacecraft components");
    }

    spacecraft.position.set(40000, 40000, 40000);
    const centerPoint = new THREE.Vector3(0, 0, 10000);
    spacecraft.lookAt(centerPoint);
    spacecraft.name = 'spacecraft'; // Add a name for easier lookup
    scene.add(spacecraft); // Make sure to add it to the scene

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
}

function initControls() {
    // Only set up event listeners once
    if (controlsInitialized) {
        console.log("Controls already initialized, skipping");
        return;
    }
    
    console.log("Initializing controls with keys object:", keys);
    
    document.addEventListener('keydown', (event) => {
        if (!keys) return; // Guard against keys not being defined
        switch (event.key) {
            case 'w': keys.w = true; break;
            case 's': keys.s = true; break;
            case 'a': keys.a = true; break;
            case 'd': keys.d = true; break;
            case 'ArrowLeft': keys.left = true; break;
            case 'ArrowRight': keys.right = true; break;
            case 'ArrowUp': keys.up = true; break;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (!keys) return; // Guard against keys not being defined
        switch (event.key) {
            case 'w': keys.w = false; break;
            case 's': keys.s = false; break;
            case 'a': keys.a = false; break;
            case 'd': keys.d = false; break;
            case 'ArrowLeft': keys.left = false; break;
            case 'ArrowRight': keys.right = false; break;
            case 'ArrowUp': keys.up = false; break;
        }
    });
    
    controlsInitialized = true;
}

/// MASTER FUNCTION called by main.js
export function init() {
    console.log("Space initialization started");
    
    if (spaceInitialized) {
        console.log("Space already initialized, skipping");
        return { scene: scene, camera: camera, renderer: renderer };
    }

    initSpacecraft();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    initControls();

    spaceInitialized = true;
    console.log("Space initialization complete");
    
    return { 
        scene: scene, 
        camera: camera, 
        renderer: renderer, 
    };
}

// Performs the state update for the spacecraft / environment
export function update(isBoosting, isHyperspace, deltaTime = 0.016) {
    try {
        if (!spaceInitialized) {
            console.log("Space not initialized yet");
            return false;
        }

        // Check if spacecraft is near celestial body
        checkPlanetProximity();

        // Handle laser firing if spacebar is pressed
        if (keys.space && spacecraft) {
            fireLaser(spacecraft, scene, 'space', isBoosting);
        }

        // Use the passed isBoosting and isHyperspace parameters
        updateMovement(isBoosting, isHyperspace);
        updateCamera(camera, isHyperspace);
        
        // Handle laser updates
        if (typeof updateLasers === 'function') {
            updateLasers(deltaTime);
        }

        // Update spacecraft effects
        if (updateEngineEffects) {
            updateEngineEffects(isBoosting);
        }
        
        // Update reticle position if available
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            console.log("Updating reticle in setup.js");
            spacecraft.userData.updateReticle(isBoosting);
        } else {
            // Only log this warning once to avoid console spam
            if (!window.setupReticleWarningLogged) {
                console.warn("Reticle update function not found on spacecraft userData in setup.js", spacecraft);
                window.setupReticleWarningLogged = true;
            }
        }

        updateStars();
        updatePlanetLabels();

    } catch (error) {
        console.error("Error in space update:", error);
        return false;
    }
}

// Modify the checkPlanetProximity function
export function checkPlanetProximity() {
    // Skip if spacecraft isn't initialized yet
    if (!spacecraft) return;
    
    const spacecraftPosition = spacecraft.position.clone();
    
    // Check Moon proximity first (direct global position)
    const moonPosition = moonGroup.position.clone();
    const distanceToMoon = moonPosition.distanceTo(spacecraftPosition);
    // console.log("Distance to moon:", distanceToMoon);
    
    // Define entry threshold directly in this function
    const moonEntryThreshold = 500; // Distance threshold for Moon entry
    
    if (distanceToMoon < moonRadius + moonEntryThreshold && !isMoonSurfaceActive) {
        // If close enough - activate moon surface
        isMoonSurfaceActive = true;
        console.log("Moon surface active - distance:", distanceToMoon.toFixed(2));
        
        // Initialize the Moon surface (if needed)
        // initMoonSurface();
    } else if (distanceToMoon >= moonRadius + moonEntryThreshold * 1.2 && isMoonSurfaceActive) {
        // Add a small buffer (20% larger) to avoid oscillation at the boundary
        // If moving away from Moon, exit Moon surface
        isMoonSurfaceActive = false;
        console.log("Exiting Moon surface - distance:", distanceToMoon.toFixed(2));
    }
    
    // Check Earth proximity (separate check)
    const earthPosition = earthGroup.position.clone();
    const distanceToEarth = earthPosition.distanceTo(spacecraftPosition);

    // Define Earth entry threshold
    const earthEntryThreshold = 500; // Distance threshold for Earth entry
    
    if (distanceToEarth < earthRadius + earthEntryThreshold && !isEarthSurfaceActive) {
        // If close enough - activate Earth surface
        isEarthSurfaceActive = true;
        console.log("Earth surface active - distance:", distanceToEarth.toFixed(2));
        
        // Initialize the Earth surface (if needed)
        // initEarthSurface();
    } else if (distanceToEarth >= earthRadius + earthEntryThreshold * 1.2 && isEarthSurfaceActive) {
        // Add a small buffer (20% larger) to avoid oscillation at the boundary
        // If moving away from Earth, exit Earth surface
        isEarthSurfaceActive = false;
        console.log("Exiting Earth surface - distance:", distanceToEarth.toFixed(2));
    }
    
    // Debug distances
    // console.log(`Distances - Moon: ${distanceToMoon.toFixed(2)}, Earth: ${distanceToEarth.toFixed(2)}`);
}

export function exitEarthSurface() {
    console.log("Exiting Earth's surface!");
    isEarthSurfaceActive = false;
    
    // Remove the persistent surface message if it exists
    const persistentMessage = document.getElementById('earth-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Position spacecraft away from Earth to avoid immediate re-entry
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    spacecraft.position.set(
        earthGroup.position.x + directionVector.x * (earthRadius * 4),
        earthGroup.position.y + directionVector.y * (earthRadius * 4),
        earthGroup.position.z + directionVector.z * (earthRadius * 4)
    );
    
    // Reset spacecraft rotation to look toward the center of the solar system
    spacecraft.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Show the space container again
    const spaceContainer = document.getElementById('space-container');
    if (spaceContainer) {
        spaceContainer.style.display = 'block';
        console.log('Showing space-container');
    }
    
    // Make coordinates display visible again
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.display = 'block';
    }
    
    // Make sure keys object is properly reset
    if (keys) {
        // Reset all movement keys
        Object.keys(keys).forEach(key => keys[key] = false);
        console.log('Reset keys object:', keys);
    }
    
    // Reset the earthInitialized flag in main.js
    if (typeof window.resetEarthInitialized === 'function') {
        window.resetEarthInitialized();
    } else {
        console.warn('resetEarthInitialized function not found on window object');
    }
    
    // Restart the main animation loop
    if (typeof window.animate === 'function') {
        window.animate();  // Restart the main animation loop using the window.animate function
    } else {
        console.warn('animate function not found on window object');
    }
}

export function exitMoonSurface() {
    console.log("Exiting Moon's surface!");
    isMoonSurfaceActive = false;
    
    // Remove the persistent surface message if it exists
    const persistentMessage = document.getElementById('moon-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Position spacecraft away from Moon to avoid immediate re-entry
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    spacecraft.position.set(
        moonGroup.position.x + directionVector.x * (moonRadius * 4),
        moonGroup.position.y + directionVector.y * (moonRadius * 4),
        moonGroup.position.z + directionVector.z * (moonRadius * 4)
    );
    
    // Reset spacecraft rotation to look toward the center of the solar system
    spacecraft.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Show the space container again
    const spaceContainer = document.getElementById('space-container');
    if (spaceContainer) {
        spaceContainer.style.display = 'block';
        console.log('Showing space-container');
    }
    
    // Make coordinates display visible again
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.display = 'block';
    }
    
    // Make sure keys object is properly reset
    if (keys) {
        // Reset all movement keys
        Object.keys(keys).forEach(key => keys[key] = false);
        console.log('Reset keys object:', keys);
    }
    
    // Reset the moonInitialized flag in main.js
    if (typeof window.resetMoonInitialized === 'function') {
        window.resetMoonInitialized();
    } else {
        console.warn('resetMoonInitialized function not found on window object');
    }
    
    // Restart the main animation loop
    if (typeof window.animate === 'function') {
        window.animate();  // Restart the main animation loop using the window.animate function
    } else {
        console.warn('animate function not found on window object');
    }
}

///////////////////// Solar System Setup /////////////////////

const textureLoader = new THREE.TextureLoader();

// Skybox setup
const skyboxTexture = textureLoader.load('skybox/galaxy5.jpeg');
const skyboxGeometry = new THREE.BoxGeometry(250000, 250000, 250000);
const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide,
    depthWrite: false, // Prevent depth interference
    depthTest: false   // Avoid rendering issues
});
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
skybox.position.set(0, 0, 0); // Ensure centered at origin
scene.add(skybox);

// --- Sun Setup ---
const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunRadius = 10000;
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunTexture = textureLoader.load('skybox/2k_sun.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({
    map: sunTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
    side: THREE.FrontSide
});
export const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sunGroup.add(sun);

// Blazing effect
const blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.5 },
        baseColor: { value: new THREE.Vector3(1.0, 0.5, 0.0) },
        noiseScale: { value: 2.0 }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 baseColor;
        uniform float noiseScale;
        varying vec3 vNormal;
        varying vec3 vPosition;
        float noise(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        void main() {
            vec3 pos = vPosition * noiseScale;
            float n = noise(pos + time * 0.5);
            float glow = sin(time * 5.0 + length(vPosition) * 2.0) * 0.5 + 0.5;
            float pulse = (n * 0.5 + glow * 0.5) * intensity * 0.5;
            vec3 color = baseColor * (1.0 + pulse * 0.5);
            float alpha = clamp(pulse * 0.8, 0.2, 0.9);
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const blazingGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 64, 64);
const blazingEffect = new THREE.Mesh(blazingGeometry, blazingMaterial);
sunGroup.add(blazingEffect);

// Halo
const haloGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
sunGroup.add(halo);

// Sun light
const sunLight = new THREE.PointLight(0xffffff, 2, 45000);
sunGroup.add(sunLight);

sunGroup.position.set(0, 0, 0);

function animateSun() {
    blazingMaterial.uniforms.time.value += 0.02;
    blazingEffect.scale.setScalar(0.9 + Math.sin(blazingMaterial.uniforms.time.value * 1.0) * 0.05);
    requestAnimationFrame(animateSun);
}
animateSun();


// Planet definitions and randomization
const planetGroups = [];
const positionRange = 100000; // Not used directly, kept for reference

// --- Mercury Setup ---
const mercuryGroup = new THREE.Group();
scene.add(mercuryGroup);
const mercuryRadius = 1000;
const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
const mercuryTexture = textureLoader.load('skybox/2k_mercury.jpg');
const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
mercuryGroup.add(mercury);
planetGroups.push({ group: mercuryGroup, z: 20000 });

// --- Venus Setup ---
const venusGroup = new THREE.Group();
scene.add(venusGroup);
const venusRadius = 2000;
const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
const venusTexture = textureLoader.load('skybox/2k_venus_surface.jpg');
const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const venus = new THREE.Mesh(venusGeometry, venusMaterial);
venusGroup.add(venus);
const venusAtmosphereThickness = 50;
const venusAtmosphereRadius = venusRadius + venusAtmosphereThickness;
const venusAtmosphereGeometry = new THREE.SphereGeometry(venusAtmosphereRadius, 64, 64);
const venusAtmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const venusAtmosphere = new THREE.Mesh(venusAtmosphereGeometry, venusAtmosphereMaterial);
venusGroup.add(venusAtmosphere);
const cloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const venusCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x8B8000
});
const venusCloudGeometry = new THREE.SphereGeometry(venusAtmosphereRadius + 5, 64, 64);
const venusCloudMesh = new THREE.Mesh(venusCloudGeometry, venusCloudMaterial);
venusGroup.add(venusCloudMesh);
planetGroups.push({ group: venusGroup, z: 27000 });

function animateVenusClouds() {
    venusCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateVenusClouds);
}
animateVenusClouds();

// --- Earth Setup ---
const earthGroup = new THREE.Group();
scene.add(earthGroup);
const earthRadius = 2000;
const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
const earthTexture = textureLoader.load('skybox/2k_earth_daymap.jpg');
const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const planet = new THREE.Mesh(earthGeometry, earthMaterial);
earthGroup.add(planet);
const atmosphereThickness = 50;
const atmosphereRadius = earthRadius + atmosphereThickness;
const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64);
const atmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
earthGroup.add(atmosphere);
const earthCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
});
const earthCloudGeometry = new THREE.SphereGeometry(atmosphereRadius + 5, 64, 64);
const earthCloudMesh = new THREE.Mesh(earthCloudGeometry, earthCloudMaterial);
earthGroup.add(earthCloudMesh);
planetGroups.push({ group: earthGroup, z: 40000 });

function animateEarthClouds() {
    earthCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateEarthClouds);
}
animateEarthClouds();

// --- Moon Setup ---
const moonGroup = new THREE.Group();
scene.add(moonGroup); // Add Moon directly to the scene instead of as a child of Earth
const moonRadius = 500;
const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
const moonTexture = textureLoader.load('skybox/2k_moon.jpg');
const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const moon = new THREE.Mesh(moonGeometry, moonMaterial);
moonGroup.add(moon);

// Position the Moon globally, but still relative to Earth's orbit
const moonOrbitRadius = 5000;
const moonAngle = Math.random() * Math.PI * 2; // Random angle in radians

// Get Earth's global position
const earthGlobalX = earthGroup.position.x;
const earthGlobalY = earthGroup.position.y;
const earthGlobalZ = earthGroup.position.z;

// Set moon position globally, but at the correct distance from Earth
moonGroup.position.set(
    earthGlobalX + Math.cos(moonAngle) * moonOrbitRadius, // Global X position
    earthGlobalY + Math.sin(moonAngle) * moonOrbitRadius, // Global Y position
    earthGlobalZ                                          // Same Z plane as Earth
);

// Create a function to update Moon's position if Earth moves
function updateMoonPosition() {
    // Only update if both Earth and Moon exist
    if (earthGroup && moonGroup) {
        const currentEarthX = earthGroup.position.x;
        const currentEarthY = earthGroup.position.y;
        const currentEarthZ = earthGroup.position.z;
        
        // Keep relative position but update global coordinates
        moonGroup.position.set(
            currentEarthX + Math.cos(moonAngle) * moonOrbitRadius,
            currentEarthY + Math.sin(moonAngle) * moonOrbitRadius,
            currentEarthZ
        );
    }
}

// Call this in the animation loop somewhere
export { updateMoonPosition };

// Animate Moon's rotation
function animateMoon() {
    moon.rotation.y += 0.0003; // Rotate slower than Earth
    requestAnimationFrame(animateMoon);
}
animateMoon();

// --- Mars Setup ---
const marsGroup = new THREE.Group();
scene.add(marsGroup);
const marsRadius = 1500;
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
const marsTexture = textureLoader.load('skybox/2k_mars.jpg');
const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
marsGroup.add(mars);
const redCloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const marsCloudMaterial = new THREE.MeshStandardMaterial({
    map: redCloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x3B2A2A
});
const marsCloudGeometry = new THREE.SphereGeometry(marsRadius + 5, 64, 64);
const marsCloudMesh = new THREE.Mesh(marsCloudGeometry, marsCloudMaterial);
marsGroup.add(marsCloudMesh);
planetGroups.push({ group: marsGroup, z: 50000 });

function animateMarsClouds() {
    marsCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateMarsClouds);
}
animateMarsClouds();

// --- Jupiter Setup ---
const jupiterGroup = new THREE.Group();
scene.add(jupiterGroup);
const jupiterRadius = 5000;
const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32);
const jupiterTexture = textureLoader.load('skybox/2k_jupiter.jpg');
const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: jupiterTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiterGroup.add(jupiter);
planetGroups.push({ group: jupiterGroup, z: 60000 });

function animateJupiterClouds() {
    requestAnimationFrame(animateJupiterClouds);
}
animateJupiterClouds();

// --- Saturn Setup ---
const saturnGroup = new THREE.Group();
scene.add(saturnGroup);
const saturnRadius = 4000;
const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32);
const saturnTexture = textureLoader.load('skybox/2k_saturn.jpg');
const saturnMaterial = new THREE.MeshStandardMaterial({
    map: saturnTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturnGroup.add(saturn);
const ringTexture = textureLoader.load('skybox/saturn_rings.png');
const ringRadius = 5000;
const ringThickness = 20;
const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + ringThickness, 64);
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
});
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2;
saturnGroup.add(saturnRings);
planetGroups.push({ group: saturnGroup, z: 80000 });

// --- Uranus Setup ---
const uranusGroup = new THREE.Group();
scene.add(uranusGroup);
const uranusRadius = 3000;
const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32);
const uranusTexture = textureLoader.load('skybox/2k_uranus.jpg');
const uranusMaterial = new THREE.MeshStandardMaterial({
    map: uranusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const uranus = new THREE.Mesh(uranusGeometry, uranusMaterial);
uranusGroup.add(uranus);
planetGroups.push({ group: uranusGroup, z: 95000 });

// --- Neptune Setup ---
const neptuneGroup = new THREE.Group();
scene.add(neptuneGroup);
const neptuneRadius = 3000;
const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32);
const neptuneTexture = textureLoader.load('skybox/2k_neptune.jpg');
const neptuneMaterial = new THREE.MeshStandardMaterial({
    map: neptuneTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptuneGroup.add(neptune);
planetGroups.push({ group: neptuneGroup, z: 110000 });

// Randomize planet positions
planetGroups.forEach(planet => {
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const radius = planet.z; // Use original Z as radius
    planet.group.position.set(
        Math.cos(angle) * radius, // X
        Math.sin(angle) * radius, // Y
        0                         // Z = 0, XY plane
    );
    console.log(`${planet.group.name || 'Planet'} position:`, planet.group.position); // Debug
});


// Concentric circles (already updated to remove radial lines)
function createConcentricCircles() {
    const sunPosition = sunGroup.position; // (0, 0, 0)
    planetGroups.forEach(planet => {
        const planetPos = planet.group.position;
        const distance = sunPosition.distanceTo(planetPos);
        const angle = Math.atan2(planetPos.y, planetPos.x);

        const circleGeometry = new THREE.CircleGeometry(distance, 64);
        const vertices = circleGeometry.attributes.position.array;
        const ringVertices = new Float32Array(vertices.length - 3);
        for (let i = 3; i < vertices.length; i++) {
            ringVertices[i - 3] = vertices[i];
        }
        const ringGeometry = new THREE.BufferGeometry();
        ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringVertices, 3));
        const circleMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const circle = new THREE.LineLoop(ringGeometry, circleMaterial);

        circle.position.copy(sunPosition);
        circle.rotation.x = Math.PI / 2;
        circle.rotation.y = angle;
        scene.add(circle);
    });
}

// createConcentricCircles(); // ** TOGGLE ORBITAL LINES ON AND OFF **

// Planet labels
const labelData = [
    { group: mercuryGroup, name: 'Mercury', radius: 1000 },
    { group: venusGroup, name: 'Venus', radius: 2000 },
    { group: earthGroup, name: 'Earth', radius: 2000 },
    { group: moonGroup, name: 'Moon', radius: 500 },
    { group: marsGroup, name: 'Mars', radius: 1500 },
    { group: jupiterGroup, name: 'Jupiter', radius: 5000 },
    { group: saturnGroup, name: 'Saturn', radius: 4000 },
    { group: uranusGroup, name: 'Uranus', radius: 3000 },
    { group: neptuneGroup, name: 'Neptune', radius: 3000 }
];

// Create and store label elements
const labels = [];
labelData.forEach(planet => {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planet.name;
    document.body.appendChild(label); // Add to DOM
    labels.push({
        element: label,
        planetGroup: planet.group,
        radius: planet.radius
    });
});

// Create a special distance indicator for Earth
const earthDistanceIndicator = document.createElement('div');
earthDistanceIndicator.className = 'distance-indicator';
earthDistanceIndicator.style.color = 'white';
earthDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
earthDistanceIndicator.style.fontSize = '18px';
earthDistanceIndicator.style.textAlign = 'center';
earthDistanceIndicator.style.position = 'absolute';
earthDistanceIndicator.style.display = 'none'; // Initially hidden
document.body.appendChild(earthDistanceIndicator);

// Create a distance indicator for the Moon
const moonDistanceIndicator = document.createElement('div');
moonDistanceIndicator.className = 'distance-indicator';
moonDistanceIndicator.style.color = 'white';
moonDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
moonDistanceIndicator.style.fontSize = '18px';
moonDistanceIndicator.style.textAlign = 'center';
moonDistanceIndicator.style.position = 'absolute';
moonDistanceIndicator.style.display = 'none'; // Initially hidden
document.body.appendChild(moonDistanceIndicator);

// Function to update label positions
export function updatePlanetLabels() {
    // If on surface, hide all planet labels
    if (isMoonSurfaceActive || isEarthSurfaceActive) {
        labels.forEach(label => {
            label.element.style.display = 'none';
        });
        earthDistanceIndicator.style.display = 'none';
        moonDistanceIndicator.style.display = 'none';
        return;
    }

    const vector = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition); // Get camera's world position

    // Calculate distance to Earth for the indicator
    const earthPosition = earthGroup.position.clone();
    const spacecraftPosition = spacecraft.position.clone();
    const distanceToEarth = earthPosition.distanceTo(spacecraftPosition);
    const distanceToEntry = Math.max(0, distanceToEarth - (earthRadius + 500)); // 500 is the entry threshold
    
    // Update the Earth distance indicator text
    earthDistanceIndicator.textContent = `EARTH ENTRY: ${Math.round(distanceToEntry)}`;

    // Calculate distance to Moon for the indicator - using direct position since Moon is now in global coordinates
    const moonPosition = moonGroup.position.clone();
    const distanceToMoon = moonPosition.distanceTo(spacecraftPosition);
    const moonEntryDistance = Math.max(0, distanceToMoon - (moonRadius + 500)); // 200 is the entry threshold
    
    // Update the Moon distance indicator text
    moonDistanceIndicator.textContent = `MOON ENTRY: ${Math.round(moonEntryDistance)}`;

    labels.forEach(label => {
        // Get planet's world position
        label.planetGroup.getWorldPosition(vector);
        
        // Offset above the planet's surface
        vector.y += label.radius * 1.2;

        // Check if the planet is in front of the camera
        const directionToPlanet = vector.clone().sub(cameraPosition);
        const cameraForward = new THREE.Vector3(0, 0, -1); // Camera looks along negative Z
        cameraForward.applyQuaternion(camera.quaternion); // Align with camera rotation
        const dot = directionToPlanet.dot(cameraForward);

        if (dot > 0) { // Planet is in front of the camera
            // Project 3D position to 2D screen coordinates
            vector.project(camera);

            // Convert to screen space
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

            // Position the label
            label.element.style.left = `${x}px`;
            label.element.style.top = `${y}px`;
            label.element.style.transform = 'translateX(-50%)';
            label.element.style.display = 'block'; // Show the label
            
            // If this is Earth, position the distance indicator below it
            if (label.planetGroup === earthGroup) {
                earthDistanceIndicator.style.left = `${x}px`;
                earthDistanceIndicator.style.top = `${y + 35}px`; // Increased from 20px to 35px for more spacing
                earthDistanceIndicator.style.transform = 'translateX(-50%)';
                earthDistanceIndicator.style.display = 'block'; // Show the distance indicator
            }
            
            // If this is the Moon, position the distance indicator below it
            if (label.planetGroup === moonGroup) {
                moonDistanceIndicator.style.left = `${x}px`;
                moonDistanceIndicator.style.top = `${y + 35}px`;
                moonDistanceIndicator.style.transform = 'translateX(-50%)';
                moonDistanceIndicator.style.display = 'block'; // Show the distance indicator
            }
        } else {
            // Hide the label if the planet is behind the camera
            label.element.style.display = 'none';
            
            // If this is Earth, also hide the distance indicator
            if (label.planetGroup === earthGroup) {
                earthDistanceIndicator.style.display = 'none';
            }
            
            // If this is the Moon, also hide the distance indicator
            if (label.planetGroup === moonGroup) {
                moonDistanceIndicator.style.display = 'none';
            }
        }
    });
}

// Stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 50000;
const starRange = 250000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * starRange;
    starPositions[i + 1] = (Math.random() - 0.5) * starRange;
    starPositions[i + 2] = (Math.random() - 0.5) * starRange;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
export const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

export function updateStars() {
    const spacecraftZ = spacecraft.position.z;
    const positions = stars.geometry.attributes.position.array;
    const halfRange = starRange / 2;
    for (let i = 0; i < starCount * 3; i += 3) {
        const starZ = positions[i + 2];
        positions[i + 2] -= 0.1;
        if (starZ < spacecraftZ - halfRange) {
            positions[i] = (Math.random() - 0.5) * starRange;
            positions[i + 1] = (Math.random() - 0.5) * starRange;
            positions[i + 2] = spacecraftZ + halfRange + (Math.random() * starRange);
        }
    }
    stars.geometry.attributes.position.needsUpdate = true;
}

export const PLANET_RADIUS = earthRadius;
export const PLANET_POSITION = earthGroup.position;

// Hyperspace
let isHyperspaceActive = false;
function activateHyperspace() {
    if (!isHyperspaceActive) {
        isHyperspaceActive = true;
        console.log("Hyperspace activated!");
        setTimeout(deactivateHyperspace, 2000);
    }
}

function deactivateHyperspace() {
    if (isHyperspaceActive) {
        isHyperspaceActive = false;
        // console.log("Hyperspace deactivated!");
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') activateHyperspace();
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') deactivateHyperspace();
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}