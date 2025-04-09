// Defines and initializes the space scene

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { updateSpaceMovement, keys } from './movement.js';
import { createSpacecraft } from './spacecraft.js';
import { createReticle, setReticleVisibility } from './reticle.js';
import { updateControlsDropdown } from './ui.js';
import { 
    spaceCamera, 
    cockpitCamera,
    createCameraState, 
    updateTargetOffsets,
    updateCameraOffsets,
    createForwardRotation
} from './camera.js';
import config from './config.js';
import { loadingManager, textureLoadingManager } from './loaders.js';
import { stars, starCount, starRange, starPositions, starColors, starSizes } from './solarSystemEnv';
// Import the controls module
import { initControls, getHyperspaceState } from './controls.js';


// General initialization
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const textureLoader = new THREE.TextureLoader(textureLoadingManager);
const loader = new GLTFLoader();

renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('space-container').appendChild(renderer.domElement);
// Renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

let isBoosting = false;
let isHyperspace = false;


// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);

// Create camera state for the space scene
const cameraState = createCameraState('space');
const smoothFactor = 0.1;

// Rotation configuration for camera
const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

// Camera update function
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

// Export key objects
export { 
    renderer, 
    scene, 
    camera, 
    rotation,
    cameraState
};


/// SCENE SETUP ///

// Delegate render to each surface scene
let spaceInitialized = false;
export let isEarthSurfaceActive = false;
export let isMoonSurfaceActive = false;

export function renderScene() {
    if (isMoonSurfaceActive) {
        // nothing to do here - space scene is not active
        console.log("Moon surface active, deferring rendering");
    } else if (isEarthSurfaceActive) {
        // nothing to do here - space scene is not active
        console.log("Earth surface active, deferring rendering");
    } else {
        // Only render space scene if neither moon nor earth surfaces are active
        renderer.render(scene, camera);
    }
}

// Array of all celestial objects that can be explored
const celestialObjects = [
    'mercury',
    'venus',
    'earth',
    'moon',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'imperial star destroyer', // Counts as one object total
    'lucrehulk'
];

// Create a raycaster for planet detection
const raycaster = new THREE.Raycaster();
let lastHoveredPlanet = null;

// Create data for popups on all celestial objects
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
        gravity: '9.81 m/s²'
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
        affiliation: 'Galactic Empire',
        manufacturer: 'Kuat Drive Yards',
        crew: '40,000'
    },
    'lucrehulk': {
        affiliation: 'Confederacy of Independent Systems',
        manufacturer: 'Hoersch-Kessel Drive',
        crew: '200,000'
    }
};

// Create the popup UI
const planetInfoBox = document.createElement('div');
planetInfoBox.className = 'planet-info-box';
planetInfoBox.style.position = 'absolute';
planetInfoBox.style.fontFamily = 'Orbitron, sans-serif';
planetInfoBox.style.fontSize = '16px';
planetInfoBox.style.color = 'white';
planetInfoBox.style.backgroundColor = 'rgba(1, 8, 36, 0.8)';
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

// Create exploration counter (number of celestial objects discovered)
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



// Initialize explored objects - reset every time
let exploredObjects = {};
// Initialize with all objects unexplored
function resetExploredObjects() {
    celestialObjects.forEach(object => {
        exploredObjects[object] = false;
    });
    updateExplorationCounter();
}
// Function to mark an object as explored
function markAsExplored(objectName) {
    if (objectName && !exploredObjects[objectName]) {
        exploredObjects[objectName] = true;
        updateExplorationCounter();
        // Discovery notification popup removed as requested
    }
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
// Reset explored objects on startup
resetExploredObjects();



// Lighting

const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
directionalLight.position.set(-1, -1, -1,);
scene.add(directionalLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
scene.background = new THREE.Color(0x000000);



// Add spacecraft to scene

let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
let updateEngineEffects;
const wingTransitionFrames = 30;
export { spacecraft, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, wingsOpen, wingAnimation, updateEngineEffects };

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

    // Make sure wings are open by defaul (attack position)
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

/// STATE / ANIMATION FUNCTIONS ///
export function init() {
    console.log("Space initialization started");
    
    if (spaceInitialized) {
        console.log("Space already initialized, skipping");
        return { scene: scene, camera: camera, renderer: renderer };
    }

    initSpacecraft();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    // Initialize controls passing the surface states
    initControls(isEarthSurfaceActive, isMoonSurfaceActive);

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

// Performs the animation update for the spacecraft / environment (called from main.js)
// currently set to make updates at around 60fps
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

        // Check if hyperspace is active from the controls module
        const isHyperspaceFromControls = getHyperspaceState();
        // Use either passed hyperspace flag or hyperspace state from controls module
        const combinedHyperspaceState = isHyperspace || isHyperspaceFromControls;

        // Use the passed isBoosting and the combined hyperspace state
        updateSpaceMovement(isBoosting, combinedHyperspaceState);
        updateCamera(camera, combinedHyperspaceState);

        // Update spacecraft effects
        if (updateEngineEffects) {
            console.log("Calling updateEngineEffects with isBoosting:", isBoosting, "keys.up:", keys.up, "keys.down:", keys.down);
            updateEngineEffects(isBoosting || keys.up, keys.down);
        } else {
            console.warn("updateEngineEffects function is not available:", updateEngineEffects);
        }
        
        // Wing position control - check if conditions changed
        if (spacecraft && spacecraft.setWingsOpen) {
            const shouldWingsBeOpen = !isBoosting && !combinedHyperspaceState;
            
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

// Check if we're approaching enterable planets
export function checkPlanetProximity() {
    // Get spacecraft position
    const position = spacecraft.position.clone();
    
    // Skip proximity check when on a surface
    if (isEarthSurfaceActive || isMoonSurfaceActive) {
        // Make sure distance indicators are hidden when on surface
        if (earthDistanceIndicator) earthDistanceIndicator.style.display = 'none';
        if (moonDistanceIndicator) moonDistanceIndicator.style.display = 'none';
        
        // Also hide the planet info box if visible
        if (planetInfoBox) planetInfoBox.style.display = 'none';
        
        return;
    }
    
    // Check Moon proximity first (direct global position)
    const moonPosition = moonGroup.position.clone();
    const distanceToMoon = moonPosition.distanceTo(position);
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
    const distanceToEarth = earthPosition.distanceTo(position);

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
}

export function exitEarthSurface() {
    console.log("Exiting Earth's surface!");
    isEarthSurfaceActive = false;
    
    // Update the controls dropdown to show hyperspace option again
    updateControlsDropdown(false, false);
    
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

    // Re-initialize the reticle for the spacecraft in space
    if (spacecraft) {
        console.log("Re-creating and re-attaching reticle to spacecraft after Earth exit");
        // First, check if there's an existing reticle to clean up
        if (spacecraft.userData && spacecraft.userData.reticle) {
            // Remove old reticle from scene if it exists
            scene.remove(spacecraft.userData.reticle);
        }
        
        // Create a new reticle and attach it to the spacecraft
        const reticleComponent = createReticle(scene, spacecraft);
        spacecraft.userData.reticle = reticleComponent.reticle;
        spacecraft.userData.updateReticle = reticleComponent.update;
        spacecraft.userData.reticle.visible = true;
        
        // Reset the warning flag so we get warned if the reticle is missing
        window.setupReticleWarningLogged = false;
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
    
    // Reset both initialization flags for Earth surface using main.js reset function
    if (typeof window.resetEarthInitialized === 'function') {
        window.resetEarthInitialized();
        console.log('Both Earth and washington mountains initialization flags have been reset');
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
    
    // Re-initialize the reticle for the spacecraft in space
    if (spacecraft) {
        console.log("Re-creating and re-attaching reticle to spacecraft after Moon exit");
        // First, check if there's an existing reticle to clean up
        if (spacecraft.userData && spacecraft.userData.reticle) {
            // Remove old reticle from scene if it exists
            scene.remove(spacecraft.userData.reticle);
        }
        
        // Create a new reticle and attach it to the spacecraft
        const reticleComponent = createReticle(scene, spacecraft);
        spacecraft.userData.reticle = reticleComponent.reticle;
        spacecraft.userData.updateReticle = reticleComponent.update;
        spacecraft.userData.reticle.visible = true;
        
        // Reset the warning flag so we get warned if the reticle is missing
        window.setupReticleWarningLogged = false;
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
    
    // Make sure keys object is properly reset
    if (keys) {
        // Reset all movement keys
        Object.keys(keys).forEach(key => keys[key] = false);
        console.log('Reset keys object:', keys);
    }
    
    // Reset the moonInitialized flag in main.js
    if (typeof window.resetMoonInitialized === 'function') {
        window.resetMoonInitialized();
        console.log('Both Moon and moonCesium initialization flags have been reset');
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

import { skybox } from './solarSystemEnv';
import { sunGroup, blazingMaterial, blazingEffect } from './solarSystemEnv';
import { planetGroups } from './solarSystemEnv';

import { mercuryGroup, mercuryCollisionSphere } from './solarSystemEnv';
import { venusGroup, venusCollisionSphere, venusCloudMesh } from './solarSystemEnv';
import { earthGroup, earthCollisionSphere, earthCloudMesh, earthRadius } from './solarSystemEnv';
import { moonGroup, moon, moonCollisionSphere, moonRadius, moonAngle, moonOrbitRadius } from './solarSystemEnv';
import { marsGroup, marsCollisionSphere, marsCloudMesh } from './solarSystemEnv';
import { jupiterGroup, jupiterCollisionSphere } from './solarSystemEnv';
import { saturnGroup, saturnCollisionSphere } from './solarSystemEnv';
import { uranusGroup, uranusCollisionSphere } from './solarSystemEnv';
import { neptuneGroup, neptuneCollisionSphere } from './solarSystemEnv';
import { starDestroyerGroup, collisionBox1, collisionBox2 } from './solarSystemEnv';
import { lucrehulkGroup, lucrehulkCollisionBox } from './solarSystemEnv';

import { asteroidBeltGroup, asteroidCollisionSphere } from './solarSystemEnv';


// Add all elements to scene
scene.add(skybox);
scene.add(stars);
scene.add(sunGroup);

scene.add(mercuryGroup);
scene.add(venusGroup);
scene.add(earthGroup);
scene.add(moonGroup);
scene.add(marsGroup);
scene.add(jupiterGroup);
scene.add(saturnGroup);
scene.add(uranusGroup);
scene.add(neptuneGroup);
scene.add(starDestroyerGroup);
scene.add(lucrehulkGroup);

// Asteroid belt NOT a part of the planetGroups array
scene.add(asteroidBeltGroup);


///// Various animations /////

// Update stars with brightness interpolation and even distribution
function updateStars() {
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

function animateSun() {
    blazingMaterial.uniforms.time.value += 0.02;
    blazingEffect.scale.setScalar(0.9 + Math.sin(blazingMaterial.uniforms.time.value * 1.0) * 0.05);
    requestAnimationFrame(animateSun);
}
animateSun();


function animateVenusClouds() {
    venusCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateVenusClouds);
}
animateVenusClouds();


function animateEarthClouds() {
    earthCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateEarthClouds);
}
animateEarthClouds();

// Update Moon's position if Earth moves
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

// Call this in main.js
export { updateMoonPosition };

// Animate Moon's rotation
function animateMoon() {
    moon.rotation.y += 0.0003; // Rotate slower than Earth
    requestAnimationFrame(animateMoon);
}
animateMoon();

function animateMarsClouds() {
    marsCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateMarsClouds);
}
animateMarsClouds();


// Randomize planet positions (around fixed orbital radius)
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

// Center the asteroid belt at the origin (0,0,0)
const asteroidBelt = planetGroups.find(planet => planet.group.name === "asteroidBelt");
if (asteroidBelt) {
    asteroidBelt.group.position.set(0, 0, 0);
    console.log("Asteroid belt centered at origin:", asteroidBelt.group.position);
}

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
createConcentricCircles(); // ** TOGGLE ORBITAL LINES ON AND OFF **


///// Text Labels for Planets /////

// NOTE - required to show info box, as the box will position itself based on the label's position.
// Necessary even for Star Wars objects, despite lack of labels, in order to see the info box.
const labelData = [
    { group: mercuryGroup, name: 'Mercury', radius: 1000 },
    { group: venusGroup, name: 'Venus', radius: 2000 },
    { group: earthGroup, name: 'Earth', radius: 2000 },
    { group: moonGroup, name: 'Moon', radius: 500 },
    { group: marsGroup, name: 'Mars', radius: 1500 },
    { group: jupiterGroup, name: 'Jupiter', radius: 5000 },
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

// Function to update label positions
export function updatePlanetLabels() {
    // If on surface, hide all planet labels
    if (isEarthSurfaceActive || isMoonSurfaceActive) {
        labels.forEach(label => {
            label.element.style.display = 'none';
        });
        
        // Also hide distance indicators when on surface
        earthDistanceIndicator.style.display = 'none';
        moonDistanceIndicator.style.display = 'none';
        
        // Hide planet info box as well
        planetInfoBox.style.display = 'none';
        
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
    
    // Update the Earth distance indicator text with simplified formatting
    if (distanceToEntry <= 10000) {
        // Format the text with more prominent styling
        if (distanceToEntry <= 1000) {
            // Imminent entry - show in red
            earthDistanceIndicator.style.color = '#ff0000';
            earthDistanceIndicator.style.fontSize = '24px';
            earthDistanceIndicator.style.fontWeight = 'bold';
            earthDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 0, 0, 1.0), 0 0 25px rgba(255, 0, 0, 1.0)';
            earthDistanceIndicator.textContent = `EARTH ENTRY: ${Math.round(distanceToEntry)}`;
            // Add urgent animation
            earthDistanceIndicator.classList.remove('distance-indicator-pulse');
            earthDistanceIndicator.classList.add('distance-indicator-urgent');
        } else {
            // Standard display - white
            earthDistanceIndicator.style.color = 'white';
            earthDistanceIndicator.style.fontSize = '20px';
            earthDistanceIndicator.style.fontWeight = 'normal';
            earthDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 255, 255, 1.0), 0 0 25px rgba(79, 195, 247, 1.0)';
            earthDistanceIndicator.textContent = `EARTH ENTRY: ${Math.round(distanceToEntry)}`;
            // Remove animations
            earthDistanceIndicator.classList.remove('distance-indicator-pulse');
            earthDistanceIndicator.classList.remove('distance-indicator-urgent');
        }
    } else {
        // Reset styling for normal display
        earthDistanceIndicator.style.color = 'white';
        earthDistanceIndicator.style.fontSize = '18px';
        earthDistanceIndicator.style.fontWeight = 'normal';
        earthDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 255, 255, 1.0), 0 0 25px rgba(79, 195, 247, 1.0)';
        earthDistanceIndicator.textContent = `EARTH ENTRY: ${Math.round(distanceToEntry)}`;
        // Remove animations
        earthDistanceIndicator.classList.remove('distance-indicator-pulse');
        earthDistanceIndicator.classList.remove('distance-indicator-urgent');
    }

    // Calculate distance to Moon for the indicator - using direct position since Moon is now in global coordinates
    const moonPosition = moonGroup.position.clone();
    const distanceToMoon = moonPosition.distanceTo(spacecraftPosition);
    const moonEntryDistance = Math.max(0, distanceToMoon - (moonRadius + 500));
    
    // Update the Moon distance indicator text with simplified formatting
    if (moonEntryDistance <= 10000) {
        // Format the text with more prominent styling
        if (moonEntryDistance <= 1000) {
            // Imminent entry - show in red
            moonDistanceIndicator.style.color = '#ff0000';
            moonDistanceIndicator.style.fontSize = '24px';
            moonDistanceIndicator.style.fontWeight = 'bold';
            moonDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 0, 0, 1.0), 0 0 25px rgba(255, 0, 0, 1.0)';
            moonDistanceIndicator.textContent = `MOON ENTRY: ${Math.round(moonEntryDistance)}`;
            // Add urgent animation
            moonDistanceIndicator.classList.remove('distance-indicator-pulse');
            moonDistanceIndicator.classList.add('distance-indicator-urgent');
        } else {
            // Standard display - white
            moonDistanceIndicator.style.color = 'white';
            moonDistanceIndicator.style.fontSize = '20px';
            moonDistanceIndicator.style.fontWeight = 'normal';
            moonDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 255, 255, 1.0), 0 0 25px rgba(79, 195, 247, 1.0)';
            moonDistanceIndicator.textContent = `MOON ENTRY: ${Math.round(moonEntryDistance)}`;
            // Remove animations
            moonDistanceIndicator.classList.remove('distance-indicator-pulse');
            moonDistanceIndicator.classList.remove('distance-indicator-urgent');
        }
    } else {
        // Reset styling for normal display
        moonDistanceIndicator.style.color = 'white';
        moonDistanceIndicator.style.fontSize = '18px';
        moonDistanceIndicator.style.fontWeight = 'normal';
        moonDistanceIndicator.style.textShadow = '0 0 15px rgba(255, 255, 255, 1.0), 0 0 25px rgba(79, 195, 247, 1.0)';
        moonDistanceIndicator.textContent = `MOON ENTRY: ${Math.round(moonEntryDistance)}`;
        // Remove animations
        moonDistanceIndicator.classList.remove('distance-indicator-pulse');
        moonDistanceIndicator.classList.remove('distance-indicator-urgent');
    }

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
            
            // If this is Moon, position the distance indicator below it
            if (label.planetGroup === moonGroup) {
                moonDistanceIndicator.style.left = `${x}px`;
                moonDistanceIndicator.style.top = `${y + 35}px`; // 35px spacing just like Earth
                moonDistanceIndicator.style.transform = 'translateX(-50%)';
                moonDistanceIndicator.style.display = 'block'; // Show the distance indicator
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
            
            // If this is Moon, also hide the distance indicator
            if (label.planetGroup === moonGroup) {
                moonDistanceIndicator.style.display = 'none';
            }
        }
    });

    // If the hovered planet is not visible, hide the info box
    if (lastHoveredPlanet && !hoveredPlanetVisible) {
        planetInfoBox.style.display = 'none';
    }
}

export const EARTH_RADIUS = earthRadius;
export const EARTH_POSITION = earthGroup.position;


///// Detecting when celestial objects are discovered /////

// Add a function to detect when the reticle intersects with planets -> show the info box
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
        { name: 'jupiter', mesh: jupiterCollisionSphere },
        { name: 'saturn', mesh: saturnCollisionSphere },
        { name: 'uranus', mesh: uranusCollisionSphere },
        { name: 'neptune', mesh: neptuneCollisionSphere },
        { name: 'imperial star destroyer', mesh: collisionBox1 },
        { name: 'imperial star destroyer', mesh: collisionBox2 },
        { name: 'lucrehulk', mesh: lucrehulkCollisionBox }
    ];
    
    // Flag to track if we're hovering over any celestial body (called planet for ease)
    let planetDetected = false;
    
    // Check intersections with all planets
    for (const planetObj of planetDetectionList) {
        // Use simple detection for all objects now that we have collision boxes
        const intersects = raycaster.intersectObject(planetObj.mesh, false);
        
        if (intersects.length > 0) {
            // Planet was detected by the reticle
            planetDetected = true;
            
            
            if (lastHoveredPlanet !== planetObj.name) {
                console.log(`${planetObj.name} detected`);
                lastHoveredPlanet = planetObj.name;
                
                // Mark the object as explored when info box is shown
                markAsExplored(planetObj.name);
                
                // Update info box content if we have info for this planet
                if (planetInfo[planetObj.name]) {
                    const info = planetInfo[planetObj.name];
                    
                    // Dynamic selector for info box based on celestial object type
                    if (info.composition && info.atmosphere && info.gravity) {
                        // Planet format
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
                    } else {
                        // Star Wars format
                        planetInfoBox.innerHTML = `
                            <div style="text-align: center; margin-bottom: 10px; font-size: 20px; color: #4fc3f7;">
                                ${planetObj.name.toUpperCase()}
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
                    }
                    
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
    
    
    // If no planet was detected but we had one before, clear the hover state
    if (!planetDetected && lastHoveredPlanet) {
        console.log(`${lastHoveredPlanet} no longer detected`);
        
        // Clear the hovered planet state and hide the info box immediately for all objects
        lastHoveredPlanet = null;
        planetInfoBox.style.display = 'none'; // Hide the info box
        
    }
}



///// Special Countdown Indicators for Enterable Objects /////

// Earth
const earthDistanceIndicator = document.createElement('div');
earthDistanceIndicator.className = 'distance-indicator';
earthDistanceIndicator.style.color = 'white';
earthDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
earthDistanceIndicator.style.fontSize = '18px';
earthDistanceIndicator.style.textAlign = 'center';
earthDistanceIndicator.style.position = 'absolute';
earthDistanceIndicator.style.display = 'none'; // Initially hidden
earthDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
earthDistanceIndicator.style.padding = '5px 10px';
earthDistanceIndicator.style.borderRadius = '5px';
earthDistanceIndicator.style.zIndex = '9999'; // Ensure it's on top of other elements
document.body.appendChild(earthDistanceIndicator);

// Moon
const moonDistanceIndicator = document.createElement('div');
moonDistanceIndicator.className = 'distance-indicator';
moonDistanceIndicator.style.color = 'white';
moonDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
moonDistanceIndicator.style.fontSize = '18px';
moonDistanceIndicator.style.textAlign = 'center';
moonDistanceIndicator.style.position = 'absolute';
moonDistanceIndicator.style.display = 'none'; // Initially hidden
moonDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
moonDistanceIndicator.style.padding = '5px 10px';
moonDistanceIndicator.style.borderRadius = '5px';
moonDistanceIndicator.style.zIndex = '9998'; // Ensure it's always just below the earth distance indicator
document.body.appendChild(moonDistanceIndicator);




/////////////////////


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}


