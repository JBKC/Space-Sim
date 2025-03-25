
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { updateMovement, keys } from './movement.js';
import { createSpacecraft } from './spacecraft.js';
import { createReticle } from './reticle.js';
import { fireLaser, updateLasers } from './laser.js';
import { updateControlsDropdown } from './ui.js';
import { 
    spaceCamera, 
    cockpitCamera,
    createCameraState, 
    updateTargetOffsets,
    updateCameraOffsets,
    createForwardRotation
} from './camera.js';

// General initialization - scene, camera, renderer
// do outside of init function as scene is required by multiple other files
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);

// Create camera state for the space scene
const cameraState = createCameraState('space');
const smoothFactor = 0.1; // Exactly the same as SanFran3D

// set up renderer for default space view
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('space-container').appendChild(renderer.domElement);
let spaceInitialized = false;
let isBoosting = false;
let isHyperspace = false;

// Create a raycaster for planet detection
const raycaster = new THREE.Raycaster();
let lastHoveredPlanet = null;

// Create planet info data
const planetInfo = {
    'mercury': {
        composition: 'Metallic core, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '38% of Earth'
    },
    'venus': {
        composition: 'Rocky, iron core',
        atmosphere: 'Thick CO₂, sulfuric acid',
        gravity: '90% of Earth'
    },
    'earth': {
        composition: 'Iron core, silicate mantle',
        atmosphere: 'Nitrogen, oxygen',
        gravity: '1.98 m/s²'
    },
    'moon': {
        composition: 'Rocky, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '16% of Earth'
    },
    'mars': {
        composition: 'Rocky, iron-nickel core',
        atmosphere: 'Thin CO₂',
        gravity: '38% of Earth'
    },
    'asteroid belt': {
        composition: 'Silicate rock, metals, carbon',
        atmosphere: 'None (vacuum of space)',
        gravity: 'Negligible'
    },
    'jupiter': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Dynamic storms',
        gravity: '250% of Earth'
    },
    'saturn': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Fast winds, methane',
        gravity: '107% of Earth'
    },
    'uranus': {
        composition: 'Icy, hydrogen, helium',
        atmosphere: 'Methane haze',
        gravity: '89% of Earth'
    },
    'neptune': {
        composition: 'Icy, rocky core',
        atmosphere: 'Methane clouds',
        gravity: '114% of Earth'
    },
    'imperial star destroyer': {
        affiliation: 'Empire',
        manufacturer: 'Kuat Drive Yards',
        crew: '40,000'
    },
    'lucrehulk': {
        affiliation: 'Confederacy of Independent Systems',
        manufacturer: 'Hoersch-Kessel Drive',
        crew: '200,000'
    }
};

// Create a planet info box
const planetInfoBox = document.createElement('div');
planetInfoBox.className = 'planet-info-box';
planetInfoBox.style.position = 'absolute';
planetInfoBox.style.fontFamily = 'Orbitron, sans-serif';
planetInfoBox.style.fontSize = '16px';
planetInfoBox.style.color = 'white';
planetInfoBox.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
planetInfoBox.style.border = '2px solid #4fc3f7';
planetInfoBox.style.borderRadius = '5px';
planetInfoBox.style.padding = '15px';
planetInfoBox.style.width = '320px';
planetInfoBox.style.pointerEvents = 'none';
planetInfoBox.style.zIndex = '1000';
planetInfoBox.style.display = 'none'; // Hidden by default
// Ensure the box isn't positioned off-screen initially
planetInfoBox.style.right = '';
planetInfoBox.style.left = '';
planetInfoBox.style.top = '';
document.body.appendChild(planetInfoBox);

// Add after planetInfoBox declaration (around line 134)
// Create exploration counter
const explorationCounter = document.createElement('div');
explorationCounter.className = 'exploration-counter';
explorationCounter.style.position = 'fixed';
explorationCounter.style.top = '20px';
explorationCounter.style.right = '20px';
explorationCounter.style.padding = '10px 15px';
explorationCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
explorationCounter.style.color = '#4fc3f7';
explorationCounter.style.fontFamily = 'Orbitron, sans-serif';
explorationCounter.style.fontSize = '16px';
explorationCounter.style.borderRadius = '5px';
explorationCounter.style.border = '1px solid #4fc3f7';
explorationCounter.style.zIndex = '1000';
explorationCounter.style.display = 'none'; // Initially hidden until game starts
document.body.appendChild(explorationCounter);

// Array of all celestial objects that can be explored (11 total as requested)
const celestialObjects = [
    'mercury',
    'venus',
    'earth',
    'moon',
    'mars',
    // 'asteroid belt', // Removed as requested
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'imperial star destroyer', // Counts as one object total
    'lucrehulk'
];

// Initialize explored objects - reset every time
let exploredObjects = {};

// Initialize with all objects unexplored
function resetExploredObjects() {
    celestialObjects.forEach(object => {
        exploredObjects[object] = false;
    });
    updateExplorationCounter();
}

// Update the counter display
function updateExplorationCounter() {
    const count = Object.values(exploredObjects).filter(Boolean).length;
    const total = Object.keys(exploredObjects).length;
    explorationCounter.innerHTML = `Celestial Objects Discovered: <span style="color: white; font-weight: bold;">${count}/${total}</span>`;
    
    // Check if all objects have been explored
    if (count === total) {
        // All objects explored - permanent blue glow effect
        explorationCounter.style.boxShadow = '0 0 15px 5px #4fc3f7';
        explorationCounter.style.border = '2px solid #4fc3f7';
        explorationCounter.style.backgroundColor = 'rgba(0, 20, 40, 0.8)';
        // Add a congratulatory message
        explorationCounter.innerHTML = `<span style="color: #4fc3f7; font-weight: bold;">ALL CELESTIAL OBJECTS DISCOVERED</span>`;
    } 
    // Otherwise, add temporary visual flourish when a new object is discovered
    else if (count > 0) {
        explorationCounter.style.boxShadow = '0 0 10px #4fc3f7';
        setTimeout(() => {
            // Only remove the glow if we haven't completed everything
            if (Object.values(exploredObjects).filter(Boolean).length !== total) {
                explorationCounter.style.boxShadow = 'none';
            }
        }, 2000);
    }
}

// Function to mark an object as explored
function markAsExplored(objectName) {
    if (objectName && !exploredObjects[objectName]) {
        exploredObjects[objectName] = true;
        updateExplorationCounter();
        // Discovery notification popup removed as requested
    }
}

// Reset explored objects on startup - no persistence
resetExploredObjects();

// Load explored objects on startup
// loadExploredObjects(); // Removing this line as the function no longer exists

// Add a debug click event to help troubleshoot
document.addEventListener('keydown', (event) => {
    if (event.key === 'i') {
        // Test the info box display on 'i' key press
        console.log('Manual info box test triggered');
        showStarDestroyerInfo();
    }
    if (event.key === 'l') {
        // Test the Lucrehulk info box display on 'l' key press
        console.log('Manual Lucrehulk info box test triggered');
        showLucrehulkInfo();
    }
});

// Variable to track if Earth surface is active
export let isEarthSurfaceActive = false;

export { 
    renderer, 
    scene, 
    camera, 
    rotation,
    cameraState
};

// Rotation configuration for camera
const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

// Camera update function exactly matching SanFran3D's implementation
function updateCamera(camera, isHyperspace) {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Create a fixed pivot at the center of the spacecraft
    const spacecraftCenter = new THREE.Object3D();
    spacecraft.add(spacecraftCenter);
    spacecraftCenter.updateMatrixWorld();

    // Check if we're in first-person view
    const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? spacecraft.isFirstPersonView() : false;
    
    // Debug log - only log 1% of the time to avoid spam
    // if (Math.random() < 0.01) {
    //     console.log(
    //         "🎥 CAMERA DEBUG: isFirstPerson =", isFirstPerson, 
    //         "| isFirstPersonView() =", spacecraft.isFirstPersonView(), 
    //         "| isFirstPersonView exists:", typeof spacecraft.isFirstPersonView === 'function'
    //     );
    // }

    // Update target offsets based on keys, hyperspace state and view mode
    const viewMode = isFirstPerson ? 'cockpit' : 'space';
    updateTargetOffsets(cameraState, keys, viewMode, isHyperspace);
    
    // Update current offsets by interpolating toward targets
    updateCameraOffsets(cameraState, rotation);
    
    // Get the world position of the spacecraft's center
    const pivotPosition = new THREE.Vector3();
    spacecraftCenter.getWorldPosition(pivotPosition);
    
    // Calculate camera offset based on state
    let offset = new THREE.Vector3();
    
    if (isHyperspace) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.hyperspace);
        } else {
            offset.copy(cockpitCamera.hyperspace);
        }
    } else if (keys.up) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.boost);
        } else {
            offset.copy(cockpitCamera.boost);
        }
    } else if (keys.down) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.slow);
        } else {
            offset.copy(cockpitCamera.slow);
        }
    } else {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.base);
        } else {
            offset.copy(cockpitCamera.base);
        }
    }
    
    // Apply spacecraft's rotation to the offset
    const quaternion = spacecraft.quaternion.clone();
    offset.applyQuaternion(quaternion);
    
    // Calculate final camera position by adding offset to pivot
    const finalPosition = new THREE.Vector3().addVectors(pivotPosition, offset);
    
    // Update camera position with smooth interpolation
    camera.position.lerp(finalPosition, smoothFactor);
    
    // Make camera look at the spacecraft's forward direction
    camera.quaternion.copy(spacecraft.quaternion);
    
    // Apply the 180-degree rotation to look forward
    const adjustment = createForwardRotation();
    camera.quaternion.multiply(adjustment);
    
    // Apply FOV changes from camera state
    camera.fov = cameraState.currentFOV;
    camera.updateProjectionMatrix();
    
    // Remove the temporary pivot (to avoid cluttering the scene)
    spacecraft.remove(spacecraftCenter);
}

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

// Render function that delegates to each surface scene
// Update the renderScene function to avoid initializing earth3D multiple times
export function renderScene() {
    if (isMoonSurfaceActive) {
        // nothing to do here
        console.log("Moon surface active, deferring rendering");
    } else {
        // Render space scene
        renderer.render(scene, camera);
    }
    
    if (isEarthSurfaceActive) {
        // nothing to do here
        console.log("Earth surface active, deferring rendering");
    } else {
        // Render space scene
        // console.log("Rendering space scene");
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

    // Expose the toggleView function for cockpit view
    spacecraft.toggleView = spacecraftComponents.toggleView;
    
    // Store the isFirstPersonView state for camera logic
    spacecraft.isFirstPersonView = function() {
        // Add a direct reference to the spacecraftComponents object
        return this._spacecraftComponents ? this._spacecraftComponents.isFirstPersonView : false;
    };
    
    // Expose animation functions
    spacecraft.updateAnimations = spacecraftComponents.updateAnimations;
    spacecraft.setWingsOpen = spacecraftComponents.setWingsOpen;
    spacecraft.toggleWings = spacecraftComponents.toggleWings;
    spacecraft.setWingsPosition = spacecraftComponents.setWingsPosition;
    
    // Store a direct reference to the spacecraftComponents
    spacecraft._spacecraftComponents = spacecraftComponents;

    // Make sure wings are open by default (set timeout to ensure model is loaded)
    setTimeout(() => {
        if (spacecraft && spacecraft.setWingsOpen) {
            // console.log("Setting wings to OPEN position in setup.js");
            spacecraft.setWingsOpen(true);
        }
    }, 1000); // 1 second delay to ensure model is fully loaded and processed

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

    // Show exploration counter when game starts
    explorationCounter.style.display = 'block';
    
    // Reset the counter each time the game starts
    resetExploredObjects();

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
        
        // Check if reticle is hovering over a planet (only in space mode)
        checkReticleHover();

        // Handle laser firing if spacebar is pressed
        if (keys.space && spacecraft) {
            // LASER FIRING DISABLED
            // fireLaser(spacecraft, scene, 'space', isBoosting);
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
        
        // Wing position control - check if conditions changed
        if (spacecraft && spacecraft.setWingsOpen) {
            const shouldWingsBeOpen = !isBoosting && !isHyperspace;
            
            // // Log wing state changes at a low frequency to avoid console spam
            // if (Math.random() < 0.01) {
            //     console.log(`Wing state check: boosting=${isBoosting}, hyperspace=${isHyperspace}, shouldBeOpen=${shouldWingsBeOpen}`);
            // }
            
            // The setWingsOpen function now has smooth animations and handles state management internally
            // It will only trigger an animation if the target state is different from the current state
            spacecraft.setWingsOpen(shouldWingsBeOpen);
        }
        
        // Update animation mixer (Only in space scene)
        if (spacecraft.updateAnimations) {
            spacecraft.updateAnimations(deltaTime);
        }
        
        // Update reticle position if available
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            // console.log("Updating reticle in setup.js");
            spacecraft.userData.updateReticle(isBoosting, keys.down);  // Pass both boost and slow states
        } else {
            // Only log this warning once to avoid console spam
            if (!window.setupReticleWarningLogged) {
                console.warn("Reticle update function not found on spacecraft userData in setup.js", spacecraft);
                window.setupReticleWarningLogged = true;
            }
        }
        
        // Update cockpit elements if in first-person view
        if (spacecraft && spacecraft.updateCockpit) {
            spacecraft.updateCockpit(deltaTime);
        }

        updateStars();
        updatePlanetLabels();
        
        return true;
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
    
    // Update the controls dropdown to show hyperspace option again
    updateControlsDropdown(false);
    
    // Remove the persistent surface message if it exists
    const persistentMessage = document.getElementById('earth-surface-message');
    if (persistentMessage) {
        document.body.removeChild(persistentMessage);
    }
    
    // Remove the reset position message if it exists
    const resetMessage = document.getElementById('reset-position-message');
    if (resetMessage) {
        document.body.removeChild(resetMessage);
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

    const reticleComponent = createReticle(scene, spacecraft);
    spacecraft.userData.reticle = reticleComponent.reticle;
    spacecraft.userData.updateReticle = reticleComponent.update;

        // Verify reticle creation
    if (spacecraftComponents.reticle) {
        console.log("Reticle was successfully created with spacecraft in sanFran3D.js");
    } else {
        console.warn("Reticle not found in spacecraft components");
    }
    
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
    
    // Make exploration counter visible again when returning to space
    explorationCounter.style.display = 'block';
    
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

// Initialize loader for 3D models (moved here to be available for all model loading)
const loader = new GLTFLoader();

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

// Add collision sphere for Mercury (50% larger)
const mercuryCollisionGeometry = new THREE.SphereGeometry(mercuryRadius * 1.5, 16, 16);
const collisionMaterialInvisible = new THREE.MeshBasicMaterial({ visible: false });
const mercuryCollisionSphere = new THREE.Mesh(mercuryCollisionGeometry, collisionMaterialInvisible);
mercuryGroup.add(mercuryCollisionSphere);

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

// Add collision sphere for Venus (50% larger)
const venusCollisionGeometry = new THREE.SphereGeometry(venusRadius * 1.5, 16, 16);
const venusCollisionSphere = new THREE.Mesh(venusCollisionGeometry, collisionMaterialInvisible);
venusGroup.add(venusCollisionSphere);

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

// Add collision sphere for Earth (50% larger)
const earthCollisionGeometry = new THREE.SphereGeometry(earthRadius * 1.5, 16, 16);
const earthCollisionSphere = new THREE.Mesh(earthCollisionGeometry, collisionMaterialInvisible);
earthGroup.add(earthCollisionSphere);

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

// Add collision sphere for Moon (50% larger)
const moonCollisionGeometry = new THREE.SphereGeometry(moonRadius * 1.5, 16, 16);
const moonCollisionSphere = new THREE.Mesh(moonCollisionGeometry, collisionMaterialInvisible);
moonGroup.add(moonCollisionSphere);

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

// Add collision sphere for Mars (50% larger)
const marsCollisionGeometry = new THREE.SphereGeometry(marsRadius * 1.5, 16, 16);
const marsCollisionSphere = new THREE.Mesh(marsCollisionGeometry, collisionMaterialInvisible);
marsGroup.add(marsCollisionSphere);

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

// --- Asteroid Belt Setup ---
const asteroidBeltGroup = new THREE.Group();
asteroidBeltGroup.name = "asteroidBelt";
scene.add(asteroidBeltGroup);

// Create a collision box for the asteroid belt center for hover detection
const asteroidCollisionGeometry = new THREE.SphereGeometry(3000, 32, 32);
const asteroidCollisionMaterial = new THREE.MeshBasicMaterial({ 
    visible: false // Invisible collision box
});

const asteroidCollisionSphere = new THREE.Mesh(asteroidCollisionGeometry, asteroidCollisionMaterial);
asteroidCollisionSphere.name = "asteroidBeltCollision";
asteroidBeltGroup.add(asteroidCollisionSphere);

// Position the asteroid belt group to orbit around the sun (0,0,0)
// This ensures it's properly centered on the sun unlike other planets that use random angles
asteroidBeltGroup.position.set(0, 0, 0);

// The number of asteroids to create
const asteroidCount = 100;
let asteroidModels = [];

// Load asteroid models
loader.load(
    './asteroids_pack_metallic_version/scene.gltf',
    (gltf) => {
        console.log('Asteroid pack loaded successfully');
        
        // Extract the individual asteroid models from the pack
        gltf.scene.traverse((child) => {
            // Find mesh objects that represent individual asteroids
            if (child.isMesh) {
                // Clone each asteroid to use for instancing
                const asteroid = child.clone();
                asteroidModels.push(asteroid);
            }
        });
        
        // Now create multiple asteroids distributed in a belt pattern
        if (asteroidModels.length > 0) {
            // Create a belt around the orbit radius with some variation
            const orbitRadius = 55000;
            const beltWidth = 10000;  // Width of the asteroid belt
            const beltHeight = 3000;  // Height of the asteroid belt
            
            for (let i = 0; i < asteroidCount; i++) {
                // Pick a random asteroid model from the loaded ones
                const randomIndex = Math.floor(Math.random() * asteroidModels.length);
                const asteroidModel = asteroidModels[randomIndex].clone();
                
                // Random position within the belt
                const angle = Math.random() * Math.PI * 2;
                const radiusVariation = (Math.random() - 0.5) * beltWidth;
                const heightVariation = (Math.random() - 0.5) * beltHeight;
                const asteroidRadius = orbitRadius + radiusVariation;
                
                // Position in a circular pattern with some variation
                // Use x and z as the orbital plane with y as height variation
                // This ensures asteroids orbit around the sun at (0,0,0)
                const x = Math.cos(angle) * asteroidRadius;
                const z = Math.sin(angle) * asteroidRadius;
                const y = heightVariation;
                
                // Random scale between 200 and 600
                const scale = 200 + Math.random() * 400;
                asteroidModel.scale.set(scale, scale, scale);
                
                // Random rotation
                asteroidModel.rotation.x = Math.random() * Math.PI * 2;
                asteroidModel.rotation.y = Math.random() * Math.PI * 2;
                asteroidModel.rotation.z = Math.random() * Math.PI * 2;
                
                // Set position
                asteroidModel.position.set(x, y, z);
                
                // Add to the group
                asteroidBeltGroup.add(asteroidModel);
            }
            
            console.log(`Created ${asteroidCount} asteroids in the belt`);
        } else {
            console.warn('No asteroid models found in the loaded GLTF');
            
            // Create a fallback visualization of the asteroid belt
            createFallbackAsteroidBelt();
        }
    },
    (xhr) => {
        console.log(`Loading asteroid pack: ${(xhr.loaded / xhr.total) * 100}% loaded`);
    },
    (error) => {
        console.error('Error loading asteroid pack:', error);
        
        // Create a fallback visualization if the model fails to load
        createFallbackAsteroidBelt();
    }
);

// Fallback asteroid belt creation using simple geometry
function createFallbackAsteroidBelt() {
    console.log('Creating fallback asteroid belt visualization');
    
    const orbitRadius = 55000;
    const beltWidth = 10000;
    const beltHeight = 3000;
    
    for (let i = 0; i < asteroidCount; i++) {
        // Create a simple asteroid with random geometry
        const asteroidGeometry = new THREE.IcosahedronGeometry(1, 0); // Simple low-poly asteroid shape
        const asteroidMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888, 
            metalness: 0.7,
            roughness: 0.6,
            flatShading: true
        });
        
        const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
        
        // Random position within the belt
        const angle = Math.random() * Math.PI * 2;
        const radiusVariation = (Math.random() - 0.5) * beltWidth;
        const heightVariation = (Math.random() - 0.5) * beltHeight;
        const asteroidRadius = orbitRadius + radiusVariation;
        
        // Position in a circular pattern with some variation
        // Use x and z as the orbital plane with y as height variation
        // This ensures asteroids orbit around the sun at (0,0,0)
        const x = Math.cos(angle) * asteroidRadius;
        const z = Math.sin(angle) * asteroidRadius;
        const y = heightVariation;
        
        // Random scale between 200 and 600
        const scale = 200 + Math.random() * 400;
        asteroid.scale.set(scale, scale, scale);
        
        // Random rotation
        asteroid.rotation.x = Math.random() * Math.PI * 2;
        asteroid.rotation.y = Math.random() * Math.PI * 2;
        asteroid.rotation.z = Math.random() * Math.PI * 2;
        
        // Set position
        asteroid.position.set(x, y, z);
        
        // Add to the group
        asteroidBeltGroup.add(asteroid);
    }
}

// Add to planet groups with orbit radius of 55000 (between Mars at 50000 and Jupiter at 60000)
planetGroups.push({ group: asteroidBeltGroup, z: 55000 });

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

// Add collision sphere for Jupiter (50% larger)
const jupiterCollisionGeometry = new THREE.SphereGeometry(jupiterRadius * 1.5, 16, 16);
const jupiterCollisionSphere = new THREE.Mesh(jupiterCollisionGeometry, collisionMaterialInvisible);
jupiterGroup.add(jupiterCollisionSphere);

planetGroups.push({ group: jupiterGroup, z: 60000 });

function animateJupiterClouds() {
    requestAnimationFrame(animateJupiterClouds);
}
animateJupiterClouds();

// --- Imperial Star Destroyer Setup ---
const starDestroyerGroup = new THREE.Group();
starDestroyerGroup.name = "imperialStarDestroyer"; // Add name for reference
scene.add(starDestroyerGroup);

// Create collision boxes for the Star Destroyers (for efficient raycast detection)
// Increased size to fully encompass both ships with plenty of overhang
const collisionGeometry = new THREE.BoxGeometry(10000, 3000, 8000);
const collisionMaterial = new THREE.MeshBasicMaterial({ 
    visible: false // Invisible collision box
});

const collisionBox1 = new THREE.Mesh(collisionGeometry, collisionMaterial);
collisionBox1.position.set(-7000, 2000, 0);
collisionBox1.name = "starDestroyer1Collision";
starDestroyerGroup.add(collisionBox1);

// Single larger collision box that covers both Star Destroyers
const collisionBox2 = new THREE.Mesh(collisionGeometry, collisionMaterial);
collisionBox2.position.set(0, 0, 0);
collisionBox2.name = "starDestroyer2Collision";
starDestroyerGroup.add(collisionBox2);

// Load the Star Destroyer model using GLTFLoader
let starDestroyer; // Store reference to the first model
let starDestroyer2; // Store reference to the second model

// Load the first Star Destroyer
loader.load(
    './star_wars_imperial_ii_star_destroyer/scene.gltf',
    (gltf) => {
        starDestroyer = gltf.scene;
        
        // Scale the model appropriately (reduced by factor of 100)
        starDestroyer.scale.set(8, 8, 8);
        
        // Rotate to face forward in its orbit
        starDestroyer.rotation.y = Math.PI;
        
        // Offset the first destroyer
        starDestroyer.position.copy(collisionBox1.position);
        
        // Add to the group
        starDestroyerGroup.add(starDestroyer);
        
        console.log('First Imperial Star Destroyer loaded successfully');
        
        // Load the second Star Destroyer after the first one is loaded
        loadSecondStarDestroyer();
    },
    (xhr) => {
        console.log(`Loading Star Destroyer: ${(xhr.loaded / xhr.total) * 100}% loaded`);
    },
    (error) => {
        console.error('Error loading Star Destroyer:', error);
        
        // Fallback: Create a placeholder if model fails to load
        const placeholderGeometry = new THREE.BoxGeometry(2000, 500, 4000);
        const placeholderMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            metalness: 0.8,
            roughness: 0.2
        });
        const placeholderMesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
        placeholderMesh.position.copy(collisionBox1.position);
        starDestroyerGroup.add(placeholderMesh);
        starDestroyer = placeholderMesh;
        console.log('Using placeholder for first Star Destroyer');
        
        // Still try to load the second Star Destroyer
        loadSecondStarDestroyer();
    }
);

// Function to load the second Star Destroyer
function loadSecondStarDestroyer() {
    loader.load(
        './star_wars_imperial_ii_star_destroyer/scene.gltf',
        (gltf) => {
            starDestroyer2 = gltf.scene;
            
            // Scale the model appropriately (same as the first)
            starDestroyer2.scale.set(8, 8, 8);
            
            // Rotate to face forward in its orbit (same as the first)
            starDestroyer2.rotation.y = Math.PI;
            
            // Offset the second destroyer slightly to the right
            starDestroyer2.position.copy(collisionBox2.position);
            
            // Add to the same group as the first destroyer
            starDestroyerGroup.add(starDestroyer2);
            
            console.log('Second Imperial Star Destroyer loaded successfully');
        },
        (xhr) => {
            console.log(`Loading Second Star Destroyer: ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
            console.error('Error loading Second Star Destroyer:', error);
            
            // Fallback: Create a placeholder if model fails to load
            const placeholderGeometry = new THREE.BoxGeometry(2000, 500, 4000);
            const placeholderMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x888888,
                metalness: 0.8,
                roughness: 0.2
            });
            const placeholderMesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
            placeholderMesh.position.copy(collisionBox2.position);
            starDestroyerGroup.add(placeholderMesh);
            starDestroyer2 = placeholderMesh;
            console.log('Using placeholder for second Star Destroyer');
        }
    );
}

// Add to planet groups with orbit radius of 70000
planetGroups.push({ group: starDestroyerGroup, z: 70000 });

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

// Add collision sphere for Saturn (50% larger)
const saturnCollisionGeometry = new THREE.SphereGeometry(saturnRadius * 1.5, 16, 16);
const saturnCollisionSphere = new THREE.Mesh(saturnCollisionGeometry, collisionMaterialInvisible);
saturnGroup.add(saturnCollisionSphere);

// Load the ring texture
const ringTexture = textureLoader.load('skybox/2k_saturn_ring_alpha.png');

// Create the 3D rings using a torus geometry instead of a flat ring
const ringOuterRadius = 8000;
const ringInnerRadius = 6000;
const tubeRadius = (ringOuterRadius - ringInnerRadius) / 2;
const ringRadius = ringInnerRadius + tubeRadius;
const ringGeometry = new THREE.TorusGeometry(
    ringRadius,      // radius of the entire torus
    tubeRadius,      // thickness of the tube
    2,               // radial segments (lower for performance)
    64               // tubular segments
);

// Create a material for the rings
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    flatShading: true
});

// Create the ring mesh and position it correctly
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2;  // Align with Saturn's equator
saturnGroup.add(saturnRings);

// Add a second ring with slightly different parameters for visual depth
const ringOuterRadius2 = 5200;
const ringInnerRadius2 = 4400;
const tubeRadius2 = (ringOuterRadius2 - ringInnerRadius2) / 2;
const ringRadius2 = ringInnerRadius2 + tubeRadius2;
const ringGeometry2 = new THREE.TorusGeometry(
    ringRadius2,     // radius of the entire torus
    tubeRadius2,     // thickness of the tube
    2,               // radial segments
    64               // tubular segments
);

const ringMaterial2 = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    flatShading: true
});

const saturnRings2 = new THREE.Mesh(ringGeometry2, ringMaterial2);
saturnRings2.rotation.x = Math.PI / 2;  // Align with Saturn's equator
saturnGroup.add(saturnRings2);

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

// Add collision sphere for Uranus (50% larger)
const uranusCollisionGeometry = new THREE.SphereGeometry(uranusRadius * 1.5, 16, 16);
const uranusCollisionSphere = new THREE.Mesh(uranusCollisionGeometry, collisionMaterialInvisible);
uranusGroup.add(uranusCollisionSphere);

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

// Add collision sphere for Neptune (50% larger)
const neptuneCollisionGeometry = new THREE.SphereGeometry(neptuneRadius * 1.5, 16, 16);
const neptuneCollisionSphere = new THREE.Mesh(neptuneCollisionGeometry, collisionMaterialInvisible);
neptuneGroup.add(neptuneCollisionSphere);

planetGroups.push({ group: neptuneGroup, z: 110000 });

// --- Lucrehulk Setup ---
const lucrehulkGroup = new THREE.Group();
lucrehulkGroup.name = "lucrehulk"; // Add name for reference
scene.add(lucrehulkGroup);

// Create collision box for the Lucrehulk (for efficient raycast detection)
// Making it large and circular to match the Lucrehulk's donut shape
const lucrehulkCollisionGeometry = new THREE.CylinderGeometry(5000, 5000, 2000, 32);
const lucrehulkCollisionMaterial = new THREE.MeshBasicMaterial({ 
    visible: false // Invisible collision box
});

const lucrehulkCollisionBox = new THREE.Mesh(lucrehulkCollisionGeometry, lucrehulkCollisionMaterial);
lucrehulkCollisionBox.rotation.x = Math.PI / 2; // Rotate to make the circular face forward
lucrehulkCollisionBox.name = "lucrehulkCollision";
lucrehulkGroup.add(lucrehulkCollisionBox);

// Load the Lucrehulk model using GLTFLoader
let lucrehulkModel; // Store reference to the model

// Load the Lucrehulk
loader.load(
    './lucrehulk/scene.gltf',
    (gltf) => {
        lucrehulkModel = gltf.scene;
        
        // Scale the model appropriately - using a smaller scale than initially set
        lucrehulkModel.scale.set(100, 100, 100);
        
        // Rotate to face forward in its orbit
        lucrehulkModel.rotation.y = Math.PI;
        
        // Add to the group
        lucrehulkGroup.add(lucrehulkModel);
        
        console.log('Lucrehulk battleship loaded successfully');
    },
    (xhr) => {
        console.log(`Loading Lucrehulk: ${(xhr.loaded / xhr.total) * 100}% loaded`);
    },
    (error) => {
        console.error('Error loading Lucrehulk:', error);
        
        // Fallback: Create a placeholder if model fails to load
        const placeholderGeometry = new THREE.TorusGeometry(3000, 1000, 16, 32);
        const placeholderMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xbbbbbb,
            metalness: 0.9,
            roughness: 0.2
        });
        const placeholderMesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
        placeholderMesh.rotation.x = Math.PI / 2; // Make it face forward
        lucrehulkGroup.add(placeholderMesh);
        lucrehulkModel = placeholderMesh;
        console.log('Using placeholder for Lucrehulk');
    }
);

// Add to planet groups with orbit radius of 35000 (between Venus at 27000 and Earth at 40000)
planetGroups.push({ group: lucrehulkGroup, z: 35000 });

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
    // Asteroid Belt removed from labels
    { group: jupiterGroup, name: 'Jupiter', radius: 5000 },
    // Star Destroyer removed from labels but will still be hoverable
    { group: saturnGroup, name: 'Saturn', radius: 4000 },
    { group: uranusGroup, name: 'Uranus', radius: 3000 },
    { group: neptuneGroup, name: 'Neptune', radius: 3000 },
    { group: starDestroyerGroup, name: 'Imperial Star Destroyer', radius: 5000 },
    { group: lucrehulkGroup, name: 'Lucrehulk', radius: 5000 }
];

// Create and store label elements
const labels = [];
labelData.forEach(planet => {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planet.name;
    
    // Hide Star Destroyer and Lucrehulk labels visually while keeping them in the DOM
    if (planet.name === 'Imperial Star Destroyer' || planet.name === 'Lucrehulk') {
        label.style.opacity = '0'; // Make invisible but keep it in the DOM for positioning
        label.style.pointerEvents = 'none'; // Ensure it doesn't interfere with interaction
    }
    
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
    if (isEarthSurfaceActive) {
        labels.forEach(label => {
            label.element.style.display = 'none';
        });
        earthDistanceIndicator.style.display = 'none';
        moonDistanceIndicator.style.display = 'none';
        planetInfoBox.style.display = 'none'; // Also hide the planet info box
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
    const moonEntryDistance = Math.max(0, distanceToMoon - (moonRadius + 500));
    
    // Update the Moon distance indicator text
    // moonDistanceIndicator.textContent = `MOON ENTRY: ${Math.round(moonEntryDistance)}`;

    // To track if the currently hovered planet is visible
    let hoveredPlanetVisible = false;

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
            
            // Update the info box position if we're currently hovering over this planet
            if (lastHoveredPlanet && lastHoveredPlanet === label.element.textContent.toLowerCase()) {
                hoveredPlanetVisible = true;
                if (planetInfoBox.style.display === 'block') {
                    planetInfoBox.style.left = `${x + 170}px`; // Adjusted for larger box
                    planetInfoBox.style.top = `${y}px`;
                    planetInfoBox.style.transform = 'translateY(-50%)';
                }
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

    // If the hovered planet is not visible, hide the info box
    if (lastHoveredPlanet && !hoveredPlanetVisible) {
        planetInfoBox.style.display = 'none';
    }
}

// Stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 1000000; // Keep the doubled number of stars
const starRange = 500000;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);

// Create stars with varying distances and initial brightness
for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    
    // Random position in a large sphere around the origin
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = starRange * Math.pow(Math.random(), 1/3); // Cube root for even volumetric distribution
    
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
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starMaterial = new THREE.PointsMaterial({ 
    color: 0xffffff,
    size: 25,
    vertexColors: true, // Use the color attribute
    sizeAttenuation: true, // Make distant stars smaller
    transparent: true,
    opacity: 1.0 // Full opacity
});

export const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Modified updateStars function with more extreme brightness interpolation and even distribution
export function updateStars() {
    const spacecraftPosition = spacecraft.position.clone();
    const positions = stars.geometry.attributes.position.array;
    const colors = stars.geometry.attributes.color.array;
    
    // First update star positions
    for (let i = 0; i < starCount * 3; i += 3) {
        // Calculate distance from spacecraft to this star
        const dx = positions[i] - spacecraftPosition.x;
        const dy = positions[i + 1] - spacecraftPosition.y;
        const dz = positions[i + 2] - spacecraftPosition.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Check if star is too far from the spacecraft (beyond view range)
        if (distance > starRange * 0.8) {
            // Respawn the star in a new random position in a full sphere around the spacecraft
            // This maintains even distribution everywhere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            // Use cube root for even volumetric distribution, and ensure some stars are closer
            const radius = starRange * 0.4 * Math.pow(Math.random(), 1/3);
            
            // Position relative to spacecraft
            positions[i] = spacecraftPosition.x + radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = spacecraftPosition.y + radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = spacecraftPosition.z + radius * Math.cos(phi);
        }
        
        // Recalculate distance after possible respawn
        const newDx = positions[i] - spacecraftPosition.x;
        const newDy = positions[i + 1] - spacecraftPosition.y;
        const newDz = positions[i + 2] - spacecraftPosition.z;
        const newDistance = Math.sqrt(newDx*newDx + newDy*newDy + newDz*newDz);
        
        // More extreme interpolation based on distance
        // Stars closer than 8% of range are at full brightness
        // Stars further than 25% of range are at minimum brightness (much less visible)
        const minDistance = starRange * 0.08;
        const maxDistance = starRange * 0.25;
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

export const PLANET_RADIUS = earthRadius;
export const PLANET_POSITION = earthGroup.position;

// Hyperspace
let isHyperspaceActive = false;
function activateHyperspace() {
    // Don't activate hyperspace if on Earth's surface
    if (!isHyperspaceActive && !isEarthSurfaceActive) {
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
    // Only activate hyperspace if not on Earth's surface
    if (event.key === 'Shift' && !isEarthSurfaceActive) activateHyperspace();
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

// Create a function to display the Star Destroyer info box
let starDestroyerInfoTimer = null;
function showStarDestroyerInfo() {
    if (!planetInfo['imperial star destroyer']) return;
    
    // Clear any existing timer
    if (starDestroyerInfoTimer) {
        clearTimeout(starDestroyerInfoTimer);
        starDestroyerInfoTimer = null;
    }
    
    const info = planetInfo['imperial star destroyer'];
    
    // Update content
    planetInfoBox.innerHTML = `
        <div style="text-align: center; margin-bottom: 10px; font-size: 20px; color: #4fc3f7; text-transform: uppercase;">
            Imperial-class Star Destroyer
        </div>
        <div style="margin-bottom: 8px;">
            <span style="color: #4fc3f7;">Affiliation:</span> ${info.affiliation}
        </div>
        <div style="margin-bottom: 8px;">
            <span style="color: #4fc3f7;">Manufacturer:</span> ${info.manufacturer}
        </div>
        <div>
            <span style="color: #4fc3f7;">Crew:</span> ${info.crew}
        </div>
    `;
    
    // Apply fixed positioning to ensure it's visible
    // This positions it at the center-right of the screen
    planetInfoBox.style.position = 'fixed';
    planetInfoBox.style.left = 'auto';
    planetInfoBox.style.right = '50px';
    planetInfoBox.style.top = '50%';
    planetInfoBox.style.transform = 'translateY(-50%)';
    planetInfoBox.style.zIndex = '9999'; // Very high z-index to ensure visibility
    
    // Make sure it's visible
    planetInfoBox.style.display = 'block';
    
    // Apply very visible debug styling (can remove later)
    planetInfoBox.style.boxShadow = '0 0 10px 5px #4fc3f7';
    
    console.log('Star Destroyer info box should be visible now');
    
    // Force a layout reflow
    void planetInfoBox.offsetWidth;
    
    // Remove the timeout that keeps the info visible
    /*
    // Set a timer to keep the info visible for a few seconds even if hover is lost
    starDestroyerInfoTimer = setTimeout(() => {
        if (lastHoveredPlanet !== 'imperial star destroyer') {
            planetInfoBox.style.display = 'none';
        }
        starDestroyerInfoTimer = null;
    }, 5000); // Keep visible for 5 seconds
    */
}

// Create a function to display the Lucrehulk info box
let lucrehulkInfoTimer = null;
function showLucrehulkInfo() {
    if (!planetInfo['lucrehulk']) return;
    
    // Clear any existing timer
    if (lucrehulkInfoTimer) {
        clearTimeout(lucrehulkInfoTimer);
        lucrehulkInfoTimer = null;
    }
    
    const info = planetInfo['lucrehulk'];
    
    // Update content
    planetInfoBox.innerHTML = `
        <div style="text-align: center; margin-bottom: 10px; font-size: 20px; color: #4fc3f7; text-transform: uppercase;">
            Lucrehulk-class Battleship
        </div>
        <div style="margin-bottom: 8px;">
            <span style="color: #4fc3f7;">Affiliation:</span> ${info.affiliation}
        </div>
        <div style="margin-bottom: 8px;">
            <span style="color: #4fc3f7;">Manufacturer:</span> ${info.manufacturer}
        </div>
        <div>
            <span style="color: #4fc3f7;">Crew:</span> ${info.crew}
        </div>
    `;
    
    // Apply fixed positioning to ensure it's visible
    // This positions it at the center-right of the screen
    planetInfoBox.style.position = 'fixed';
    planetInfoBox.style.left = 'auto';
    planetInfoBox.style.right = '50px';
    planetInfoBox.style.top = '50%';
    planetInfoBox.style.transform = 'translateY(-50%)';
    planetInfoBox.style.zIndex = '9999'; // Very high z-index to ensure visibility
    
    // Make sure it's visible
    planetInfoBox.style.display = 'block';
    
    // Apply very visible debug styling (can remove later)
    planetInfoBox.style.boxShadow = '0 0 10px 5px #4fc3f7';
    
    console.log('Lucrehulk info box should be visible now');
    
    // Force a layout reflow
    void planetInfoBox.offsetWidth;
    
    // Remove the timeout that keeps the info visible
    /*
    // Set a timer to keep the info visible for a few seconds even if hover is lost
    lucrehulkInfoTimer = setTimeout(() => {
        if (lastHoveredPlanet !== 'lucrehulk') {
            planetInfoBox.style.display = 'none';
        }
        lucrehulkInfoTimer = null;
    }, 5000); // Keep visible for 5 seconds
    */
}

// Add a variable to track the last time we detected a Star Destroyer
let lastStarDestroyerDetectionTime = 0;
let starDestroyerDebounceTime = 0; // Set to 0 to disable debounce effect

// Add a variable to track the last time we detected a Lucrehulk
let lastLucrehulkDetectionTime = 0;
let lucrehulkDebounceTime = 0; // Set to 0 to disable debounce effect

// Add a function to detect when the reticle intersects with planets
export function checkReticleHover() {
    if (!spacecraft || !camera || isEarthSurfaceActive) {
        // If on a planetary surface, ensure exploration counter is hidden
        if (isEarthSurfaceActive) {
            explorationCounter.style.display = 'none';
        }
        return;
    }

    // Cast a ray from the camera center forward
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, direction);
    
    // Create a list of all planets and their meshes
    const planetDetectionList = [
        { name: 'mercury', mesh: mercuryCollisionSphere },
        { name: 'venus', mesh: venusCollisionSphere },
        { name: 'earth', mesh: earthCollisionSphere },
        { name: 'moon', mesh: moonCollisionSphere },
        { name: 'mars', mesh: marsCollisionSphere },
        // Include asteroid belt in detection but not counting toward explored objects
        { name: 'asteroid belt', mesh: asteroidCollisionSphere },
        { name: 'jupiter', mesh: jupiterCollisionSphere },
        { name: 'saturn', mesh: saturnCollisionSphere },
        { name: 'uranus', mesh: uranusCollisionSphere },
        { name: 'neptune', mesh: neptuneCollisionSphere },
        { name: 'imperial star destroyer', mesh: collisionBox1 },
        { name: 'imperial star destroyer', mesh: collisionBox2 },
        { name: 'lucrehulk', mesh: lucrehulkCollisionBox }
    ];
    
    // Flag to track if we're hovering over any planet
    let planetDetected = false;
    let starDestroyerDetected = false;
    let lucrehulkDetected = false;
    
    // Check intersections with all planets
    for (const planetObj of planetDetectionList) {
        // Use simple detection for all objects now that we have collision boxes
        const intersects = raycaster.intersectObject(planetObj.mesh, false);
        
        if (intersects.length > 0) {
            // Planet was detected by the reticle
            planetDetected = true;
            
            // Special handling for Star Destroyer
            if (planetObj.name === 'imperial star destroyer') {
                starDestroyerDetected = true;
                lastStarDestroyerDetectionTime = Date.now();
            }
            
            // Special handling for Lucrehulk
            if (planetObj.name === 'lucrehulk') {
                lucrehulkDetected = true;
                lastLucrehulkDetectionTime = Date.now();
            }
            
            if (lastHoveredPlanet !== planetObj.name) {
                console.log(`${planetObj.name} detected`);
                lastHoveredPlanet = planetObj.name;
                
                // Mark the object as explored when info box is shown
                markAsExplored(planetObj.name);
                
                // Handle Star Destroyer specially
                if (planetObj.name === 'imperial star destroyer') {
                    // Reset any previous info box state
                    planetInfoBox.style.display = 'none';
                    
                    // Force a small delay to ensure DOM updates
                    setTimeout(() => {
                        showStarDestroyerInfo();
                        console.log('Called showStarDestroyerInfo with delay');
                    }, 10);
                    
                    // Skip the rest of the loop to avoid overriding
                    break;
                }
                
                // Handle Lucrehulk specially
                if (planetObj.name === 'lucrehulk') {
                    // Reset any previous info box state
                    planetInfoBox.style.display = 'none';
                    
                    // Force a small delay to ensure DOM updates
                    setTimeout(() => {
                        showLucrehulkInfo();
                        console.log('Called showLucrehulkInfo with delay');
                    }, 10);
                    
                    // Skip the rest of the loop to avoid overriding
                    break;
                }
                
                // Update info box content if we have info for this planet
                if (planetInfo[planetObj.name]) {
                    const info = planetInfo[planetObj.name];
                    
                    // For regular planets
                    planetInfoBox.innerHTML = `
                        <div style="text-align: center; margin-bottom: 10px; font-size: 20px; color: #4fc3f7;">
                            ${planetObj.name.toUpperCase()}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="color: #4fc3f7;">Composition:</span> ${info.composition}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="color: #4fc3f7;">Atmosphere:</span> ${info.atmosphere}
                        </div>
                        <div>
                            <span style="color: #4fc3f7;">Gravity:</span> ${info.gravity}
                        </div>
                    `;
                    
                    // Find the corresponding label to position the info box
                    let labelFound = false;
                    for (const label of labels) {
                        // Map planet name to its corresponding group
                        let planetGroup;
                        switch(planetObj.name) {
                            case 'mercury': planetGroup = mercuryGroup; break;
                            case 'venus': planetGroup = venusGroup; break;
                            case 'earth': planetGroup = earthGroup; break;
                            case 'moon': planetGroup = moonGroup; break;
                            case 'mars': planetGroup = marsGroup; break;
                            case 'asteroid belt': planetGroup = asteroidBeltGroup; break;
                            case 'jupiter': planetGroup = jupiterGroup; break;
                            case 'saturn': planetGroup = saturnGroup; break;
                            case 'uranus': planetGroup = uranusGroup; break;
                            case 'neptune': planetGroup = neptuneGroup; break;
                            case 'imperial star destroyer': planetGroup = starDestroyerGroup; break;
                            case 'lucrehulk': planetGroup = lucrehulkGroup; break;
                        }
                        
                        // Check if this label corresponds to the detected planet
                        if (label.planetGroup === planetGroup) {
                            labelFound = true;
                            let positionFound = false;
                            
                            // If the label is visible, position the info box next to it
                            if (label.element.style.display !== 'none') {
                                const labelRect = label.element.getBoundingClientRect();
                                const labelX = labelRect.left + labelRect.width / 2;
                                const labelY = labelRect.top;
                                
                                // Position the info box to the right of the label
                                planetInfoBox.style.position = 'absolute';
                                planetInfoBox.style.right = '';
                                planetInfoBox.style.left = `${labelX + 170}px`; // Adjusted for larger box
                                planetInfoBox.style.top = `${labelY}px`;
                                planetInfoBox.style.transform = 'translateY(-50%)';
                                positionFound = true;
                            }
                            
                            // If label is not visible, use object's 3D position projected to screen
                            if (!positionFound) {
                                // Get the object's world position
                                const vector = new THREE.Vector3();
                                planetGroup.getWorldPosition(vector);
                                
                                // Project to screen coordinates
                                vector.project(camera);
                                
                                // Convert to screen space
                                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                                const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                                
                                // Position the info box next to the projected position
                                planetInfoBox.style.position = 'fixed';
                                planetInfoBox.style.right = '';
                                planetInfoBox.style.left = `${x + 170}px`; // Adjusted for larger box
                                planetInfoBox.style.top = `${y}px`;
                                planetInfoBox.style.transform = 'translateY(-50%)';
                                positionFound = true;
                            }
                            
                            // For backward compatibility or extreme cases when no position can be found
                            if (!positionFound) {
                                // Use a fixed position as fallback
                                planetInfoBox.style.position = 'fixed';
                                planetInfoBox.style.right = '50px';
                                planetInfoBox.style.left = 'auto';
                                planetInfoBox.style.top = '50%';
                                planetInfoBox.style.transform = 'translateY(-50%)';
                            }
                            
                            // Always show the info box
                            planetInfoBox.style.display = 'block';
                            break;
                        }
                    }
                    
                    // If no label was found for this planet, use a fallback positioning
                    if (!labelFound) {
                        // Determine which group we need
                        let planetGroup;
                        switch(planetObj.name) {
                            case 'mercury': planetGroup = mercuryGroup; break;
                            case 'venus': planetGroup = venusGroup; break;
                            case 'earth': planetGroup = earthGroup; break;
                            case 'moon': planetGroup = moonGroup; break;
                            case 'mars': planetGroup = marsGroup; break;
                            case 'asteroid belt': planetGroup = asteroidBeltGroup; break;
                            case 'jupiter': planetGroup = jupiterGroup; break;
                            case 'saturn': planetGroup = saturnGroup; break;
                            case 'uranus': planetGroup = uranusGroup; break;
                            case 'neptune': planetGroup = neptuneGroup; break;
                            case 'imperial star destroyer': planetGroup = starDestroyerGroup; break;
                            case 'lucrehulk': planetGroup = lucrehulkGroup; break;
                        }
                        
                        if (planetGroup) {
                            // Get the object's world position
                            const vector = new THREE.Vector3();
                            planetGroup.getWorldPosition(vector);
                            
                            // Project to screen coordinates
                            vector.project(camera);
                            
                            // Convert to screen space
                            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                            
                            // Position the info box next to the projected position
                            planetInfoBox.style.position = 'fixed';
                            planetInfoBox.style.right = '';
                            planetInfoBox.style.left = `${x + 170}px`; // Adjusted for larger box
                            planetInfoBox.style.top = `${y}px`;
                            planetInfoBox.style.transform = 'translateY(-50%)';
                        } else {
                            // If we can't find the group, use a default fixed position
                            planetInfoBox.style.position = 'fixed';
                            planetInfoBox.style.right = '50px';
                            planetInfoBox.style.left = 'auto';
                            planetInfoBox.style.top = '50%';
                            planetInfoBox.style.transform = 'translateY(-50%)';
                        }
                        
                        // Always show the info box
                        planetInfoBox.style.display = 'block';
                    }
                }
            }
            
            // Break out of the loop since we found an intersection
            break;
        }
    }
    
    // Check for debounced Star Destroyer detection
    if (!starDestroyerDetected && 
        lastHoveredPlanet === 'imperial star destroyer' && 
        Date.now() - lastStarDestroyerDetectionTime < starDestroyerDebounceTime) {
        // We're within the debounce time, so we're still considered hovering
        planetDetected = true;
    }
    
    // Check for debounced Lucrehulk detection
    if (!lucrehulkDetected && 
        lastHoveredPlanet === 'lucrehulk' && 
        Date.now() - lastLucrehulkDetectionTime < lucrehulkDebounceTime) {
        // We're within the debounce time, so we're still considered hovering
        planetDetected = true;
    }
    
    // If no planet was detected but we had one before, clear the hover state
    if (!planetDetected && lastHoveredPlanet) {
        console.log(`${lastHoveredPlanet} no longer detected`);
        
        // Clear the hovered planet state and hide the info box immediately for all objects
        lastHoveredPlanet = null;
        planetInfoBox.style.display = 'none'; // Hide the info box
        
        /* Removing special treatment for ships
        // Don't immediately clear special ship info - they have their own timers
        // Don't immediately clear special ship info - they have their own timers
        if (lastHoveredPlanet !== 'imperial star destroyer' && lastHoveredPlanet !== 'lucrehulk') {
            lastHoveredPlanet = null;
            planetInfoBox.style.display = 'none'; // Hide the info box
        } else if ((lastHoveredPlanet === 'imperial star destroyer' && !starDestroyerInfoTimer) ||
                  (lastHoveredPlanet === 'lucrehulk' && !lucrehulkInfoTimer)) {
            // If we don't have an active timer, clear it after the debounce period
            lastHoveredPlanet = null;
        }
        */
    }
}