// Import THREE.js (assuming it's included elsewhere)
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Earth surface environment
export const earthSurfaceScene = new THREE.Scene();
earthSurfaceScene.background = new THREE.Color(0x87CEFA); // Brighter blue sky (changed from 0xC9E6FF)

// Create a flat surface for Earth environment with texture
const surfaceGeometry = new THREE.PlaneGeometry(100000, 100000, 100, 100);
// Try to load the texture, but use a color if it fails
let surfaceTexture;
try {
    surfaceTexture = textureLoader.load('skybox/grass_texture.jpg');
    surfaceTexture.wrapS = THREE.RepeatWrapping;
    surfaceTexture.wrapT = THREE.RepeatWrapping;
    surfaceTexture.repeat.set(100, 100); // Repeat the texture many times
} catch (e) {
    console.warn("Failed to load grass texture, using color instead:", e);
    surfaceTexture = null;
}

const surfaceMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2F4F2F, // Dark forest green (changed from 0x228B22)
    side: THREE.DoubleSide,
    map: surfaceTexture,
    roughness: 0.8,
    metalness: 0.1
});
const earthSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
earthSurface.rotation.x = -Math.PI / 2; // Rotate to be horizontal
earthSurface.position.y = -100; // Position below the spacecraft
earthSurfaceScene.add(earthSurface);

// Add some simple terrain features (hills)
for (let i = 0; i < 50; i++) {
    const hillGeometry = new THREE.ConeGeometry(
        Math.random() * 100 + 50, // Random radius between 50 and 150
        Math.random() * 200 + 100, // Random height between 100 and 300
        8 // Octagonal base
    );
    const hillMaterial = new THREE.MeshStandardMaterial({
        color: 0x2F4F2F, // Dark forest green (changed from 0x228B22)
        roughness: 0.9,
        metalness: 0.0
    });
    const hill = new THREE.Mesh(hillGeometry, hillMaterial);
    
    // Random position on the surface
    hill.position.set(
        (Math.random() - 0.5) * 8000, // X position
        -50, // Y position (slightly embedded in the ground)
        (Math.random() - 0.5) * 8000  // Z position
    );
    
    // Rotate to stand upright - FIXED: removed incorrect rotation
    // The cone's point should be up by default
    
    earthSurfaceScene.add(hill);
}

// Add some trees (simple cones with cylinders)
for (let i = 0; i < 400; i++) {
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(5, 5, 30, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x5C4033, // Darker brown for tree trunks (changed from 0x8B4513)
        roughness: 0.9
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    
    // Tree top
    const topGeometry = new THREE.ConeGeometry(20, 50, 8);
    const topMaterial = new THREE.MeshStandardMaterial({
        color: 0x004000, // Darker green for tree tops (changed from 0x006400)
        roughness: 0.8
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 40; // Position on top of trunk
    
    // Create tree group
    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(top);
    
    // Random position on the surface
    tree.position.set(
        (Math.random() - 0.5) * 8000, // X position
        -100, // Y position (on the ground)
        (Math.random() - 0.5) * 8000  // Z position
    );
    
    earthSurfaceScene.add(tree);
}

// Add mountains at the edges of the map to mark boundaries
function createMountainRange() {
    // Create mountains along the perimeter of a 10,000 x 10,000 square
    const mapSize = 5000; // Half the width of the 10,000 square (from center to edge)
    const mountainCount = 60; // Number of mountains to create
    const spacing = mapSize * 2 / mountainCount; // Space between mountains
    
    // Mountain properties
    const mountainColors = [0x4B6455, 0x3A4E40, 0x2F4F2F]; // Different shades of dark green
    
    // Create mountains along each edge of the square map
    for (let i = 0; i < mountainCount; i++) {
        // Calculate position along the perimeter
        const position = -mapSize + (i * spacing);
        
        // Create mountains at each of the four edges
        createMountain(position, -mapSize, mountainColors); // Bottom edge
        createMountain(position, mapSize, mountainColors);  // Top edge
        createMountain(-mapSize, position, mountainColors); // Left edge
        createMountain(mapSize, position, mountainColors);  // Right edge
    }
}

function createMountain(x, z, colors) {
    // Randomize mountain properties
    const height = Math.random() * 800 + 400; // Height between 400 and 1200
    const radius = Math.random() * 300 + 200; // Base radius between 200 and 500
    const segments = 8; // Octagonal base for performance
    
    // Create the mountain geometry
    const mountainGeometry = new THREE.ConeGeometry(radius, height, segments);
    
    // Randomly select a color from the available colors
    const colorIndex = Math.floor(Math.random() * colors.length);
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: colors[colorIndex],
        roughness: 0.9,
        metalness: 0.1
    });
    
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    
    // Position the mountain
    mountain.position.set(
        x + (Math.random() * 400 - 200), // Add some randomness to x position
        height / 2 - 100, // Position y so the base is at ground level
        z + (Math.random() * 400 - 200)  // Add some randomness to z position
    );
    
    // FIXED: removed incorrect rotation - cones should point up by default
    
    // Add to scene
    earthSurfaceScene.add(mountain);
}

// Create the mountain ranges
createMountainRange();

// Add ambient light to Earth surface scene
const earthAmbientLight = new THREE.AmbientLight(0xffffff, 0.5);
earthSurfaceScene.add(earthAmbientLight);

// Add directional light to Earth surface scene (sunlight)
const earthDirectionalLight = new THREE.DirectionalLight(0xffffff, 1);
earthDirectionalLight.position.set(1, 1, 1);
earthSurfaceScene.add(earthDirectionalLight);

// Add fog to create depth
earthSurfaceScene.fog = new THREE.FogExp2(0x87CEFA, 0.0003); // Updated fog color to match sky

// Flag to track which scene is active
export let isEarthSurfaceActive = false;
// Flag to track if transition is in progress
export let isTransitionInProgress = false;

// Function to check if spacecraft is near Earth
export function checkEarthProximity() {
    // Calculate distance between spacecraft and Earth
    const earthPosition = earthGroup.position.clone();
    const spacecraftPosition = spacecraft.position.clone();
    const distance = earthPosition.distanceTo(spacecraftPosition);
    
    // Start transition when within detection zone but before actual transition
    if (distance < planetRadius + 800 && !isEarthSurfaceActive && !isTransitionInProgress) {
        // Start the pre-transition effect while still in space
        startAtmosphereTransition();
    }
    
    // Actual transition to surface happens at a closer distance
    if (distance < planetRadius + 500 && !isEarthSurfaceActive && isTransitionInProgress) {
        // Only transition to surface after the mist has built up
        const overlay = document.getElementById('transition-overlay');
        if (overlay && parseFloat(getComputedStyle(overlay).opacity) > 0.3) {
            transitionToEarthSurface();
        }
    }
}

// Function to start the atmosphere transition effect while still in space
function startAtmosphereTransition() {
    console.log("Approaching Earth's atmosphere...");
    isTransitionInProgress = true;
    
    // Create a transition overlay element with initial transparency
    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(135, 206, 250, 0)'; // Start transparent
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none'; // Don't block user interaction
    overlay.style.zIndex = '999';
    document.body.appendChild(overlay);
    
    // Gradually increase the mist over 0.75 seconds (reduced from 1 second)
    const transitionDuration = 1000;
    const startTime = performance.now();
    
    function animatePreTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        
        // Gradually increase overlay opacity
        overlay.style.opacity = (0.6 * progress).toString();
        
        if (progress < 1 && !isEarthSurfaceActive) {
            requestAnimationFrame(animatePreTransition);
        }
    }
    
    // Start the animation
    animatePreTransition();
}

// Function to transition to Earth surface environment
export function transitionToEarthSurface() {
    console.log("Entering Earth's atmosphere!");
    isEarthSurfaceActive = true;
    
    // Clear any existing spacecraft from the Earth surface scene
    earthSurfaceScene.children.forEach(child => {
        if (child.type === 'Group' && child !== earthSurface) {
            earthSurfaceScene.remove(child);
        }
    });
    
    // Create a new spacecraft for the Earth surface scene
    const earthSpacecraft = new THREE.Group();
    earthSpacecraft.name = "EarthSurfaceSpacecraft";
    
    // Copy the original spacecraft's children
    spacecraft.children.forEach(child => {
        const childClone = child.clone();
        // Preserve the original name if it exists
        if (child.name) {
            childClone.name = child.name;
        }
        earthSpacecraft.add(childClone);
    });
    
    // Position the spacecraft at the top of the screen with a steep downward angle
    // Higher Y position and negative Z position (coming from top of screen)
    earthSpacecraft.position.set(0, 4000, -2000); // High altitude and behind (negative Z)
    
    // Set rotation to point downward at approximately 45 degrees
    const pitchAngle = -Math.PI * 0.25; // Negative angle for downward pitch from top of screen
    earthSpacecraft.rotation.set(pitchAngle, 0, 0);
    
    // Add to scene
    earthSurfaceScene.add(earthSpacecraft);
    
    // Get the existing overlay from the pre-transition
    const existingOverlay = document.getElementById('transition-overlay');
    
    // Create a more gradual transition effect with fog
    const transitionDuration = 1000; // 0.75 seconds to clear the fog (reduced from 1 second)
    const startTime = performance.now();
    
    // Store original fog density for restoration after effect
    const originalFogDensity = 0.0003;
    
    // Create initial fog with higher density
    earthSurfaceScene.fog = new THREE.FogExp2(0x87CEFA, 0.02);
    
    // Store original camera position for animation
    const originalCameraPosition = new THREE.Vector3(0, 0, 10); // Default camera position
    
    // Animate the transition - fog clearing phase only
    function animateTransition() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        
        // Gradually decrease fog density back to original
        const currentFogDensity = 0.02 - (0.02 - originalFogDensity) * progress;
        earthSurfaceScene.fog.density = currentFogDensity;
        
        // Gradually decrease overlay opacity
        if (existingOverlay) {
            existingOverlay.style.opacity = (0.6 * (1 - progress)).toString();
        }
        
        // Animate spacecraft descending from the top
        if (earthSpacecraft) {
            // Calculate new position - gradually descending and moving forward
            const newY = 4000 - (4000 - 1500) * progress; // From 4000 to 1500
            const newZ = -2000 + (2000 + 500) * progress; // From -2000 to 500 (coming from top/back to front)
            
            // Update spacecraft position
            earthSpacecraft.position.set(0, newY, newZ);
            
            // Gradually level out the spacecraft as it descends
            const newPitch = -Math.PI * 0.25 + (Math.PI * 0.45) * progress; // From -45° to +20°
            earthSpacecraft.rotation.set(newPitch, 0, 0);
            
            // Move camera closer to spacecraft during transition
            if (camera) {
                // Calculate camera offset - start further away, move closer
                const cameraDistance = 10 - 5 * progress; // Move camera from 10 units to 5 units away
                
                // Update camera position relative to spacecraft
                // We don't directly set camera position here as it's managed by the camera controls
                // Instead we'll use this value in the movement.js file
            }
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateTransition);
        } else {
            // Transition complete, remove overlay
            if (existingOverlay) {
                document.body.removeChild(existingOverlay);
            }
            
            // Ensure fog is back to original settings
            earthSurfaceScene.fog.density = originalFogDensity;
            
            // Reset transition flag
            isTransitionInProgress = false;
            
            // Display the persistent message
            displayEarthSurfaceMessage();
        }
    }
    
    // Start the animation
    animateTransition();
}

// Function to display the Earth surface message (extracted from transitionToEarthSurface)
function displayEarthSurfaceMessage() {
    // Display a message to the user
    const message = document.createElement('div');
    message.id = 'earth-surface-message';
    message.style.position = 'absolute';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.color = 'white';
    message.style.fontFamily = 'Orbitron, sans-serif';
    message.style.fontSize = '18px';
    message.style.textAlign = 'center';
    message.style.padding = '8px 15px';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    message.style.borderRadius = '5px';
    message.style.zIndex = '1000';
    message.textContent = 'Press ESC to leave Earth\'s atmosphere';
    document.body.appendChild(message);
}

// Function to exit Earth surface environment and return to space
export function exitEarthSurface() {
    console.log("Exiting Earth's atmosphere!");
    isEarthSurfaceActive = false;
    isTransitionInProgress = false;
    
    // Remove the persistent Earth surface message if it exists
    const persistentMessage = document.getElementById('earth-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Position spacecraft away from Earth to avoid immediate re-entry
    // Calculate a position that's 3x the planet radius + 1000 units away from Earth
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    spacecraft.position.set(
        earthGroup.position.x + directionVector.x * (planetRadius * 3 + 1000),
        earthGroup.position.y + directionVector.y * (planetRadius * 3 + 1000),
        earthGroup.position.z + directionVector.z * (planetRadius * 3 + 1000)
    );
    
    // Reset spacecraft rotation to look toward the center of the solar system
    spacecraft.lookAt(new THREE.Vector3(0, 0, 0));
}

// Function to render the appropriate scene
export function renderScene() {
    if (isEarthSurfaceActive) {
        renderer.render(earthSurfaceScene, camera);
    } else {
        renderer.render(scene, camera);
    }
}

// Texture loader
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


// ... [All your existing setup.js code up to planet definitions] ...

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
const planetRadius = 2000;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 64, 64);
const planetTexture = textureLoader.load('skybox/2k_earth_daymap.jpg');
const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const planet = new THREE.Mesh(planetGeometry, planetMaterial);
earthGroup.add(planet);
const atmosphereThickness = 50;
const atmosphereRadius = planetRadius + atmosphereThickness;
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

// Function to update label positions
export function updatePlanetLabels() {
    // If on Earth's surface, hide all planet labels
    if (isEarthSurfaceActive) {
        labels.forEach(label => {
            label.element.style.display = 'none';
        });
        earthDistanceIndicator.style.display = 'none';
        return;
    }

    const vector = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition); // Get camera's world position

    // Calculate distance to Earth for the indicator
    const earthPosition = earthGroup.position.clone();
    const spacecraftPosition = spacecraft.position.clone();
    const distanceToEarth = earthPosition.distanceTo(spacecraftPosition);
    const distanceToEntry = Math.max(0, distanceToEarth - (planetRadius + 500)); // 500 is the entry threshold
    
    // Update the distance indicator text
    earthDistanceIndicator.textContent = `DISTANCE TO ENTRY: ${Math.round(distanceToEntry)}`;

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
        } else {
            // Hide the label if the planet is behind the camera
            label.element.style.display = 'none';
            
            // If this is Earth, also hide the distance indicator
            if (label.planetGroup === earthGroup) {
                earthDistanceIndicator.style.display = 'none';
            }
        }
    });
}

// ... [Rest of your setup.js: renderer settings, spacecraft, hyperspace] ...



// Exports

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

// ... [Spacecraft setup unchanged] ...

// X-wing spacecraft
export const spacecraft = new THREE.Group();

// Materials
const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0 });
const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, metalness: 0.2, roughness: 0.7 });
const redPaintMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.2, roughness: 0.7 });
const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, transmission: 1, transparent: true, opacity: 0.3, envMapIntensity: 1.0 });
export const engineGlowMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
export const boostFlameMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 0.0 } },
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        varying vec3 vPosition;
        varying vec3 vNormal;
        float rand(vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        void main() {
            float t = time * 3.0;
            float pulse = (sin(t) * 0.5 + 0.5) * 0.3;
            float glow = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
            vec3 coreColor = vec3(1.0, 0.0, 1.0);
            vec3 outerColor = vec3(0.8, 0.2, 1.0);
            vec3 color = mix(outerColor, coreColor, glow + pulse);
            glow *= (1.0 + intensity * 1.5);
            color *= (1.0 + intensity * 0.5);
            color *= 1.5 + intensity * 0.5;
            gl_FragColor = vec4(color, (glow + pulse) * (0.7 + intensity * 0.3));
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});
export const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

// Fuselage
const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12);
const fuselage = new THREE.Mesh(fuselageGeometry, paintMaterial);
fuselage.rotation.z = Math.PI / 2;
spacecraft.add(fuselage);

const fuselageDetailGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
const detailPositions = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
detailPositions.forEach(pos => {
    const detail = new THREE.Mesh(fuselageDetailGeometry, metalMaterial);
    detail.rotation.z = Math.PI / 2;
    detail.position.z = pos;
    fuselage.add(detail);
});

// Nose
const noseGeometry = new THREE.CylinderGeometry(0.3, 0.05, 1.2, 12);
const nose = new THREE.Mesh(noseGeometry, paintMaterial);
nose.position.z = 2.35;
nose.rotation.x = Math.PI / 2;
spacecraft.add(nose);

const noseRingGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 24);
const noseRing1 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing1.position.z = 2.0;
spacecraft.add(noseRing1);

const noseRing2 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing2.position.z = 2.3;
spacecraft.add(noseRing2);

// Cockpit
const cockpitGeometry = new THREE.SphereGeometry(0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitOuter = new THREE.Mesh(cockpitGeometry, metalMaterial);
cockpitOuter.position.set(0, 0.25, 0);
spacecraft.add(cockpitOuter);

const cockpitGlassGeometry = new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitGlass = new THREE.Mesh(cockpitGlassGeometry, glassMaterial);
cockpitGlass.position.set(0, 0.25, 0);
spacecraft.add(cockpitGlass);

// Engines
const engineGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12);
const enginePositions = [
    { x: 0.4, y: 0.3, z: -1 },
    { x: -0.4, y: 0.3, z: -1 },
    { x: 0.4, y: -0.3, z: -1 },
    { x: -0.4, y: -0.3, z: -1 }
];
enginePositions.forEach(pos => {
    const engine = new THREE.Mesh(engineGeometry, metalMaterial);
    engine.position.set(pos.x, pos.y, pos.z);
    engine.rotation.x = Math.PI / 2;
    spacecraft.add(engine);

    const intakeGeometry = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
    const intake = new THREE.Mesh(intakeGeometry, darkMetalMaterial);
    intake.position.set(pos.x, pos.y, pos.z - 0.4);
    spacecraft.add(intake);

    const innerGlowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
    const innerGlow = new THREE.Mesh(innerGlowGeometry, engineGlowMaterial);
    innerGlow.position.set(pos.x, pos.y, pos.z + 0.35);
    innerGlow.rotation.x = Math.PI / 2;
    spacecraft.add(innerGlow);

    const glowSphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
    glowSphere.position.set(pos.x, pos.y, pos.z - 0.4);
    glowSphere.visible = true;
    spacecraft.add(glowSphere);
});

let engineTime = 0;
export function updateEngineEffects(isBoost) {
    engineTime += 0.016;
    spacecraft.traverse((child) => {
        if (child.material === boostFlameMaterial) {
            child.material.uniforms.time.value = engineTime;
            child.material.uniforms.intensity.value = isBoost ? 1.0 : 0.0;
            child.scale.setScalar(isBoost ? 1.5 : 1.0);
        }
    });
}

// Wing creation
export function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ;

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.1);
    wingShape.lineTo(2.5, -0.15);
    wingShape.lineTo(2.5, 0.15);
    wingShape.lineTo(0, 0.1);
    wingShape.lineTo(0, -0.1);

    const wingExtrudeSettings = { steps: 1, depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    const wing = new THREE.Mesh(wingGeometry, paintMaterial);
    wingGroup.add(wing);

    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.08);
    const stripe1 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe1.position.set(0.6, 0, 0);
    wingGroup.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe2.position.set(1.2, 0, 0);
    wingGroup.add(stripe2);

    const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
    const wingTip = new THREE.Mesh(wingTipGeometry, metalMaterial);
    wingTip.position.set(2.5, 0, 0);
    wingTip.rotation.z = Math.PI / 2;
    wingGroup.add(wingTip);

    const cannonGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8);
    const cannonPositions = [{ x: 3.0, y: 0, z: 0.2 }, { x: 3.0, y: 0, z: -0.2 }];
    cannonPositions.forEach(pos => {
        const cannon = new THREE.Mesh(cannonGeometry, darkMetalMaterial);
        cannon.position.set(pos.x, pos.y, pos.z);
        cannon.rotation.x = Math.PI / 2;
        wingGroup.add(cannon);

        const ringGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
        const positions = [-0.4, -0.2, 0, 0.2, 0.4];
        positions.forEach(ringPos => {
            const ring = new THREE.Mesh(ringGeometry, metalMaterial);
            ring.position.set(pos.x, pos.y, pos.z + ringPos);
            ring.rotation.x = Math.PI / 2;
            wingGroup.add(ring);
        });
    });

    return wingGroup;
}

export const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
topRightWing.name = "topRightWing";
export const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
bottomRightWing.name = "bottomRightWing";
export const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
topLeftWing.name = "topLeftWing";
export const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
bottomLeftWing.name = "bottomLeftWing";
spacecraft.add(topRightWing);
spacecraft.add(bottomRightWing);
spacecraft.add(topLeftWing);
spacecraft.add(bottomLeftWing);

// Struts
function createEnhancedStrut(x, y, z, rotationZ) {
    const strutGroup = new THREE.Group();
    const strutGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.08);
    const strut = new THREE.Mesh(strutGeometry, metalMaterial);
    strut.position.set(x, y, z - 0.5);
    strut.rotation.z = rotationZ;
    strutGroup.add(strut);

    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detail1 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail1.position.set(x - 0.25, y, z - 0.5);
    detail1.rotation.z = rotationZ;
    strutGroup.add(detail1);

    const detail2 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail2.position.set(x + 0.25, y, z - 0.5);
    detail2.rotation.z = rotationZ;
    strutGroup.add(detail2);

    return strutGroup;
}

spacecraft.add(createEnhancedStrut(0, 0.15, 0, 0));
spacecraft.add(createEnhancedStrut(0, -0.15, 0, 0));

// Surface details
function addSurfaceDetails() {
    const panelLineGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.5);
    const panelLineMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.8 });
    for (let i = 0; i < 8; i++) {
        const panelLine = new THREE.Mesh(panelLineGeometry, panelLineMaterial);
        panelLine.position.set(0.2, 0.1, -1 + i * 0.5);
        spacecraft.add(panelLine);
    }

    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detailPositions = [
        { x: 0.2, y: 0.2, z: -1 },
        { x: -0.2, y: 0.2, z: -1 },
        { x: 0.2, y: -0.2, z: -1 },
        { x: -0.2, y: -0.2, z: -1 }
    ];
    detailPositions.forEach(pos => {
        const detail = new THREE.Mesh(detailGeometry, darkMetalMaterial);
        detail.position.set(pos.x, pos.y, pos.z);
        spacecraft.add(detail);
    });
}

addSurfaceDetails();

const xwingLight = new THREE.PointLight(0xffffff, 0.5);
xwingLight.position.set(0, 2, 0);
spacecraft.add(xwingLight);

spacecraft.position.set(40000, 40000, 40000);
const centerPoint = new THREE.Vector3(0, 0, 10000);
spacecraft.lookAt(centerPoint);
scene.add(spacecraft);

// Laser setup
const laserLength = 100;
const laserThickness = 0.15;
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

let activeLasers = [];
let isFiring = false;
let firingInterval = null;

const wingtipObjects = [
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D()
];
const wingtipOffsets = [
    new THREE.Vector3(3.0, 0, 0.2),
    new THREE.Vector3(3.0, 0, -0.2),
    new THREE.Vector3(-3.0, 0, 0.2),
    new THREE.Vector3(-3.0, 0, -0.2)
];
wingtipObjects[0].position.copy(wingtipOffsets[0]);
topRightWing.add(wingtipObjects[0]);
wingtipObjects[1].position.copy(wingtipOffsets[1]);
bottomRightWing.add(wingtipObjects[1]);
wingtipObjects[2].position.copy(wingtipOffsets[2]);
topLeftWing.add(wingtipObjects[2]);
wingtipObjects[3].position.copy(wingtipOffsets[3]);
bottomLeftWing.add(wingtipObjects[3]);

function createLaser(startPosition, direction) {
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.position.copy(startPosition);
    laser.lookAt(startPosition.clone().add(direction));
    laser.position.add(direction.clone().multiplyScalar(laserLength / 2));
    laser.userData = { direction: direction.clone(), speed: 2, lifetime: 1000, startTime: performance.now() };
    return laser;
}

export function fireLasers() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);
    wingtipObjects.forEach(obj => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        obj.add(marker);
    });
}

export function startFiring() {
    if (isFiring) return;
    isFiring = true;
    firingInterval = setInterval(fireLasers, 100);
}

export function stopFiring() {
    isFiring = false;
    clearInterval(firingInterval);
}

export function updateLasers() {
    const currentTime = performance.now();
    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const laser = activeLasers[i];
        laser.position.add(laser.userData.direction.clone().multiplyScalar(laser.userData.speed));
        if (currentTime - laser.userData.startTime > laser.userData.lifetime) {
            scene.remove(laser);
            activeLasers.splice(i, 1);
        }
    }
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

export const PLANET_RADIUS = planetRadius;
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
        console.log("Hyperspace deactivated!");
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') activateHyperspace();
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') deactivateHyperspace();
});

