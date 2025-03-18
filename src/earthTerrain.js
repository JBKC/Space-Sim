// Earth surface environment
export const earthSurfaceScene = new THREE.Scene();
earthSurfaceScene.background = new THREE.Color(0x87CEFA); // Brighter blue sky (changed from 0xC9E6FF)

// Import necessary variables from setup.js
// We'll use a function to get these values to avoid circular dependencies
let setupModule;

// This function will be called after setup.js is fully loaded
export function initializeEarthTerrain(setup) {
    setupModule = setup;
    // Create the mountain ranges now that we have access to the setup module
    createMountainRange();
}

// Create a flat surface for Earth environment with texture
const surfaceGeometry = new THREE.PlaneGeometry(100000, 100000, 100, 100);
// Try to load the texture, but use a color if it fails
let surfaceTexture;
try {
    // We'll load the texture after initialization
    surfaceTexture = null;
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
    if (!setupModule) return; // Wait until setup module is available
    
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
    
    // Now that setup is available, load the texture
    if (setupModule.textureLoader) {
        try {
            surfaceTexture = setupModule.textureLoader.load('skybox/grass_texture.jpg');
            surfaceTexture.wrapS = THREE.RepeatWrapping;
            surfaceTexture.wrapT = THREE.RepeatWrapping;
            surfaceTexture.repeat.set(100, 100); // Repeat the texture many times
            surfaceMaterial.map = surfaceTexture;
            surfaceMaterial.needsUpdate = true;
        } catch (e) {
            console.warn("Failed to load grass texture, using color instead:", e);
        }
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
export let isMoonSurfaceActive = false;
// Flag to track if transition is in progress
export let isTransitionInProgress = false;

// Function to check if spacecraft is near Earth
export function checkPlanetProximity() {
    if (!setupModule) return; // Wait until setup module is available
    
    // Calculate distance between spacecraft and Earth
    const earthPosition = setupModule.earthGroup.position.clone();
    const spacecraftPosition = setupModule.spacecraft.position.clone();
    const distance = earthPosition.distanceTo(spacecraftPosition);
    
    // Start transition when within detection zone but before actual transition
    if (distance < setupModule.earthRadius + 800 && !isMoonSurfaceActive && !isTransitionInProgress) {
        // Start the pre-transition effect while still in space
        startAtmosphereTransition();
    }
    
    // Actual transition to surface happens at a closer distance
    if (distance < setupModule.earthRadius + 500 && !isMoonSurfaceActive && isTransitionInProgress) {
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
        
        if (progress < 1 && !isMoonSurfaceActive) {
            requestAnimationFrame(animatePreTransition);
        }
    }
    
    // Start the animation
    animatePreTransition();
}

// Function to transition to Earth surface environment
export function transitionToEarthSurface() {
    if (!setupModule) return; // Wait until setup module is available
    
    console.log("Entering Earth's atmosphere!");
    isMoonSurfaceActive = true;
    
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
    setupModule.spacecraft.children.forEach(child => {
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
            if (setupModule.camera) {
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
    if (!setupModule) return; // Wait until setup module is available
    
    console.log("Exiting Earth's atmosphere!");
    isMoonSurfaceActive = false;
    isTransitionInProgress = false;
    
    // Remove the persistent Earth surface message if it exists
    const persistentMessage = document.getElementById('earth-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Position spacecraft away from Earth to avoid immediate re-entry
    // Calculate a position that's 3x the planet radius + 1000 units away from Earth
    const directionVector = new THREE.Vector3(1, 1, 1).normalize();
    setupModule.spacecraft.position.set(
        setupModule.earthGroup.position.x + directionVector.x * (setupModule.earthRadius * 3 + 1000),
        setupModule.earthGroup.position.y + directionVector.y * (setupModule.earthRadius * 3 + 1000),
        setupModule.earthGroup.position.z + directionVector.z * (setupModule.earthRadius * 3 + 1000)
    );
    
    // Reset spacecraft rotation to look toward the center of the solar system
    setupModule.spacecraft.lookAt(new THREE.Vector3(0, 0, 0));
}

// Function to render the appropriate scene
export function renderScene() {
    if (!setupModule) return; // Wait until setup module is available
    
    if (isMoonSurfaceActive) {
        setupModule.renderer.render(earthSurfaceScene, setupModule.camera);
    } else {
        setupModule.renderer.render(setupModule.scene, setupModule.camera);
    }
} 