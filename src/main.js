// src/main.js

// Main setup imports
import { 
    updateStars, 
    updatePlanetLabels, 
    checkPlanetProximity, 
    isSanFranSurfaceActive as importedSanFranSurfaceActive,
    isWashingtonSurfaceActive as importedWashingtonSurfaceActive,
    isMoonSurfaceActive as importedMoonSurfaceActive, // Uncommented Moon surface access
    exitEarthSurface,
    exitMoonSurface, // Uncommented Moon surface access
    updateMoonPosition,
    init as initSpace,
    update as updateSpace,
    renderer as spaceRenderer,
    scene as spaceScene,
    camera as spaceCamera,
    spacecraft,
    renderScene
} from './setup.js';

// Import the rate limiter for initial game loading only
import { createRateLimitedGameLoader } from './gameLoader.js';

// Import THREE.js from node_modules instead of CDN
import * as THREE from 'three';

// import earth surface functions
import { 
    init as initSanFranSurface, 
    update as updateSanFranSurface,
    scene as sanFranScene,
    camera as sanFranCamera,
    // tiles as earthTiles,
    renderer as sanFranRenderer,
    spacecraft as sanFranSpacecraft,  // Import the spacecraft from the 3D scene
    resetPosition as resetSanFranPosition,  // Import the generic reset position function
    resetSanFranInitialized  // Import the new function to reset the Washington initialization flag
// } from './washington3D.js';
} from './sanFran3D.js';

import { 
    init as initWashingtonSurface, 
    update as updateWashingtonSurface,
    scene as washingtonScene,
    camera as washingtonCamera,
    // tiles as earthTiles,
    renderer as washingtonRenderer,
    spacecraft as washingtonSpacecraft,  // Import the spacecraft from the 3D scene
    resetPosition as resetWashingtonPosition,  // Import the generic reset position function
    resetWashingtonInitialized  // Import the new function to reset the Washington initialization flag
} from './washington3D.js';
// } from './sanFran3D.js';
// 
import { 
    init as initMoonSurface, 
    update as updateMoonSurface,
    scene as moonScene,
    camera as moonCamera,
    // tiles as earthTiles,
    renderer as moonRenderer,
    spacecraft as moonSpacecraft,  // Import the spacecraft from the 3D scene
    resetPosition as resetMoonPosition,  // Import the generic reset position function
    resetMoonInitialized  // Import the new function to reset the Moon initialization flag
} from './moon3D.js';


import { setGameMode, resetMovementInputs, keys } from './movement.js'; // Added keys import
import { 
    setupUIElements, 
    setupDirectionalIndicator, 
    updateDirectionalIndicator, 
    showRaceModeUI, 
    hideRaceModeUI, 
    updateUI,
    showControlsPrompt,
    updateControlsDropdown,
    toggleSurfaceSelector,
    initSurfaceSelectors
} from './ui.js';

// Import the reticle functions but we won't initialize them here
import { setReticleVisibility } from './reticle.js';

// Import laser functionality
import { fireLaser, updateLasers, clearAllLasers } from './laser.js';

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;
let spaceInitialized = false;
let sanFranInitialized = false;  // Move to top-level scope for exports
let washingtonInitialized = false;  // Move to top-level scope for exports
let moonInitialized = false;  // Move to top-level scope for exports
// Remove the local isMoonSurfaceActive variable to use the imported one
// Add a flag to track first Earth entry in a session
let isFirstSanFranEntry = true;
let isFirstWashingtonEntry = true;
// Add a flag to track first Moon entry in a session
let isFirstMoonEntry = true;

// Laser firing variables
let lastFired = 0;
const fireRate = 100; // 100ms interval (10 shots per second)

// Hyperspace streak effect variables
let streakLines = [];
const streakCount = 20; // Reduced number of streaks for sparsity
const streakLength = 50; // Length of each streak
const streakSpeed = 500; // Speed of streaks moving past the camera

// Added delta time calculation for smoother animations
let lastFrameTime = 0;

// Track previous state to detect changes for transitions
let prevSanFranSurfaceActive = false;
let prevWashingtonSurfaceActive = false;
let prevMoonSurfaceActive = false;
// Initialize UI elements and directional indicator
setupUIElements();
setupDirectionalIndicator();

// Expose functions to the window object for access from other modules
window.toggleSurfaceSelector = toggleSurfaceSelector;
window.resetSanFranInitialized = () => { sanFranInitialized = false; };
window.resetWashingtonInitialized = () => { washingtonInitialized = false; };
window.resetMoonInitialized = () => { moonInitialized = false; };
window.animate = animate;

// Function to ensure wings are open at startup
function initializeWingsOpen() {
    // Check every 500ms for 5 seconds to ensure spacecraft is fully loaded
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkAndSetWings = function() {
        if (spacecraft && spacecraft.setWingsOpen) {
            console.log("🔄 STARTUP: Setting wings to OPEN position in main.js");
            spacecraft.setWingsOpen(true);
            return true;
        } else {
            console.log(`Waiting for spacecraft to initialize (attempt ${attempts+1}/${maxAttempts})`);
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkAndSetWings, 500);
            }
            return false;
        }
    };
    
    // Start the check process
    setTimeout(checkAndSetWings, 500);
}

// Initialize the surface selection UI
function initEarthSurfaceSelection() {
    initSurfaceSelectors(
        // San Francisco selected callback
        () => {
            console.log('San Francisco surface selected');
            setSanFranSurfaceActive(true);
            setWashingtonSurfaceActive(false);
        },
        // Washington selected callback
        () => {
            console.log('Washington surface selected');
            setSanFranSurfaceActive(false);
            setWashingtonSurfaceActive(true);
        }
    );
}

// Keydown event listeners for controls
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = true;
        // Also update the keys object used by scenes
        if (spacecraft && spacecraft.userData) {
            spacecraft.userData.keys = spacecraft.userData.keys || {};
            spacecraft.userData.keys.space = true;
        }
    }
    if (event.code === 'ArrowUp') {
        isBoosting = true;
        console.log('Boost activated - speed should increase');
        
        // Visual indication for debug purposes
        const coordsDiv = document.getElementById('coordinates');
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        }
    }
    // Only allow hyperspace if not on Earth's surface
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !importedSanFranSurfaceActive && !importedWashingtonSurfaceActive) {
        startHyperspace();
    }
    // Reset position in Earth surface mode
    if (event.code === 'KeyR' && importedSanFranSurfaceActive) {
        console.log('R pressed - resetting position in San Francisco');
        resetSanFranPosition();
    }
    // Reset position in Moon surface mode
    if (event.code === 'KeyR' && importedMoonSurfaceActive) {
        console.log('R pressed - resetting position on the Moon');
        resetMoonPosition();
    }
    if (event.code === 'KeyR' && importedWashingtonSurfaceActive) {
        console.log('R pressed - resetting position in Washington');
        resetWashingtonPosition();
    }
    // Exit surface view with ESC key
    if (event.code === 'Escape') {
        if (importedSanFranSurfaceActive || importedWashingtonSurfaceActive) {
            console.log('ESC pressed - exiting Earth surface');
            exitEarthSurface();
            
            // Reset the first entry flags so next time we enter Earth surfaces, they're treated as a first entry
            isFirstSanFranEntry = true;
            isFirstWashingtonEntry = true;
        } else if (importedMoonSurfaceActive) {
            console.log('ESC pressed - exiting Moon surface');
            exitMoonSurface();
            
            // Reset the first entry flag so next time we enter Moon, it's treated as a first entry
            isFirstMoonEntry = true;
        }
        
        // Also hide the surface selector if it's visible
        toggleSurfaceSelector(false);
    }
    // Toggle first-person/third-person view with 'C' key
    if (event.code === 'KeyC') {
        console.log('===== C KEY PRESSED - TOGGLE COCKPIT VIEW =====');
        console.log('Is on San Fran surface:', importedSanFranSurfaceActive);
        console.log('Has spacecraft:', !!spacecraft);
        console.log('Has San Fran spacecraft:', !!sanFranSpacecraft);
        
        if (importedSanFranSurfaceActive && sanFranSpacecraft) {
            console.log('C pressed - toggling cockpit view in San Fran scene');
            if (typeof sanFranSpacecraft.toggleView === 'function') {
                const result = sanFranSpacecraft.toggleView(sanFranCamera, (isFirstPerson) => {
                    // Reset camera state based on new view mode
                    console.log(`Resetting San Fran camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                    console.log('San Fran camera reset callback executed');
                    // If you have access to San Fran's camera state, reset it here
                });
                console.log('Earth toggle view result:', result);
            } else {
                console.warn('Toggle view function not available on Earth spacecraft');
            }
        } else if (importedWashingtonSurfaceActive && washingtonSpacecraft) {
            console.log('C pressed - toggling cockpit view in Washington scene');
            if (typeof washingtonSpacecraft.toggleView === 'function') {
                const result = washingtonSpacecraft.toggleView(washingtonCamera, (isFirstPerson) => {
                    // Reset camera state based on new view mode
                    console.log(`Resetting Washington camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                    console.log('Washington camera reset callback executed');
                    // If you have access to Washington's camera state, reset it here
                }); 
                console.log('Washington toggle view result:', result);
            } else {
                console.warn('Toggle view function not available on Washington spacecraft');
            }
        } else if (importedMoonSurfaceActive && moonSpacecraft) {
            console.log('C pressed - toggling cockpit view in Moon scene');
            if (typeof moonSpacecraft.toggleView === 'function') {
                const result = moonSpacecraft.toggleView(moonCamera, (isFirstPerson) => {
                    // Reset camera state based on new view mode
                    console.log(`Resetting Moon camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                    console.log('Moon camera reset callback executed');
                    // If you have access to Moon's camera state, reset it here
                });
                console.log('Moon toggle view result:', result);
            } else {
                console.warn('Toggle view function not available on Moon spacecraft');
            }
        } else if (spacecraft) {
            console.log('C pressed - toggling cockpit view in Space scene');
            if (typeof spacecraft.toggleView === 'function') {
                const result = spacecraft.toggleView(spaceCamera, (isFirstPerson) => {
                    // Reset camera state based on new view mode
                    console.log(`Resetting space camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                    // Use the imported createCameraState function
                    const viewMode = isFirstPerson ? 'cockpit' : 'space';
                    
                    // Reset camera state with new view mode
                    spaceCamera.position.copy(spaceCamera.position);
                    spaceCamera.quaternion.copy(spaceCamera.quaternion);
                });
                console.log('Toggle view result:', result);
            } else {
                console.warn('Toggle view function not available on Space spacecraft');
            }
        }
    }
});

// Keyup event listeners for controls
document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        // Also update the keys object used by scenes
        if (spacecraft && spacecraft.userData) {
            spacecraft.userData.keys = spacecraft.userData.keys || {};
            spacecraft.userData.keys.space = false;
        }
    }
    if (event.code === 'ArrowUp') {
        isBoosting = false;
        console.log('Boost deactivated - speed should return to normal');
        
        // Reset visual indication
        const coordsDiv = document.getElementById('coordinates');
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        }
    }
});

// Initialize game mode selection on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const exploreButton = document.querySelector('#explore-button');
    if (exploreButton) {
        // Use rate-limited version for initial game loading
        exploreButton.addEventListener('click', () => rateLimitedStartGame('free'));
        console.log('Explore button initialized with rate limiting');
    } else {
        console.error('Explore button not found!');
    }
});

// Start the game with the selected mode
function startGame(mode) {
    console.log(`Starting game in ${mode} mode`);
    gameMode = mode;
    
    // Hide the welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // Initialize UI elements for each mode
    if (mode === 'race') {
        showRaceModeUI();
    } else if (mode === 'exploration') {
        hideRaceModeUI();
    }
    
    // Show coordinates display
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.display = 'block';
    }
    
    // Initialize space scene if not already
    if (!spaceInitialized) {
        initSpace();
        spaceInitialized = true;
    }
    
    // Set up control prompts and Earth surface selection UI
    showControlsPrompt();
    initEarthSurfaceSelection();
    
    // Start the animation loop if not already running
    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
    
    // Ensure wings are open at startup
    initializeWingsOpen();
}

// Create rate-limited version of startGame - ONLY for initial game loading
const rateLimitedStartGame = createRateLimitedGameLoader(startGame);

// Handle window resize
window.addEventListener('resize', () => {
    spaceCamera.aspect = window.innerWidth / window.innerHeight;
    spaceCamera.updateProjectionMatrix();
    spaceRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Function to start exploration mode (placeholder)
function startExploration() {
    console.log('Exploring the galaxy...');
}

// Function to create hyperspace streak lines
function createStreaks() {
    streakLines = [];
    for (let i = 0; i < streakCount; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // Two points per line (start and end)
        positions[0] = (Math.random() - 0.5) * 100; // Start X
        positions[1] = (Math.random() - 0.5) * 100; // Start Y
        positions[2] = -100 - Math.random() * streakLength; // Start Z (far in front)
        positions[3] = positions[0]; // End X (same as start for now)
        positions[4] = positions[1]; // End Y
        positions[5] = positions[2] + streakLength; // End Z (length ahead)

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0xffffff, // Solid white
            linewidth: 4, // Increased thickness for thicker streaks
        });

        const line = new THREE.Line(geometry, material);
        spaceScene.add(line);
        streakLines.push({ line, positions: positions });
    }
}

// Function to update hyperspace streaks
function updateStreaks() {
    streakLines.forEach((streak, index) => {
        const positions = streak.positions;

        // Move the entire streak backward
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 2] += streakSpeed * 0.016; // Move along Z (backward)
        }

        // If the end of the streak goes too far behind, reset it to the front
        if (positions[5] > 100) {
            positions[0] = (Math.random() - 0.5) * 100; // New start X
            positions[1] = (Math.random() - 0.5) * 100; // New start Y
            positions[2] = -100 - Math.random() * streakLength; // New start Z
            positions[3] = positions[0]; // End X
            positions[4] = positions[1]; // End Y
            positions[5] = positions[2] + streakLength; // End Z
        }

        streak.line.geometry.attributes.position.needsUpdate = true;

        // Position and rotate with the camera
        const cameraPosition = new THREE.Vector3();
        spaceCamera.getWorldPosition(cameraPosition);
        streak.line.position.copy(cameraPosition);
        streak.line.rotation.copy(spaceCamera.rotation);
    });
}

// Function to start hyperspace with progress bar and streaks
function startHyperspace() {
    // Don't activate hyperspace if already in hyperspace or on Earth's surface
    if (isHyperspace || importedSanFranSurfaceActive || importedWashingtonSurfaceActive) return;
    
    isHyperspace = true;
    // Make sure to set the global isHyperspace flag immediately so other modules can detect it
    window.isHyperspace = true;
    console.log('🚀 ENTERING HYPERSPACE - Wings should CLOSE!');
    console.log('Setting window.isHyperspace =', window.isHyperspace);

    // Create hyperspace streaks
    createStreaks();

    // Visual indication for debug purposes
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        coordsDiv.style.fontWeight = 'bold';
    }

    const progressContainer = document.getElementById('hyperspace-progress-container');
    const progressBar = document.getElementById('hyperspace-progress');
    const bar = progressBar.querySelector('.bar');
    const label = document.getElementById('hyperspace-progress-label');

    if (!progressContainer || !progressBar || !bar || !label) {
        console.error('Hyperspace progress elements not found:', {
            progressContainer,
            progressBar,
            bar,
            label
        });
        return;
    }

    // Force visibility and higher z-index
    progressContainer.style.display = 'block'; // Show the container
    progressContainer.style.zIndex = '10000'; // Ensure it's above everything else
    progressContainer.style.opacity = '1'; // Ensure full opacity
    progressContainer.style.visibility = 'visible'; // Force visibility
    bar.style.width = '100%'; // Start at 100% for right-to-left unfilling

    // Add glow effect to make it more visible
    bar.style.boxShadow = '0 0 10px 2px #ffffff';
    
    // Debug: Log visibility and positioning
    console.log('Progress container display:', progressContainer.style.display);
    console.log('Label visibility:', label.style.display, 'Text:', label.textContent);
    console.log('Label position:', label.style.top, label.style.left);
    console.log('Z-index:', progressContainer.style.zIndex);

    // Calculate total hyperspace duration in milliseconds
    const hyperspaceDuration = 2000; // 2 seconds

    // Use requestAnimationFrame for smoother animation tied to display refresh rate
    const startTime = performance.now();
    const endTime = startTime + hyperspaceDuration;

    // Animation function using timestamps for precise timing
    const animateProgress = (timestamp) => {
        // Calculate how much time has elapsed
        const elapsed = timestamp - startTime;
        
        // Calculate the remaining percentage
        const remaining = Math.max(0, 100 * (1 - elapsed / hyperspaceDuration));
        
        // Update the bar width
        bar.style.width = `${remaining}%`;
        
        // Continue animation if we haven't reached the end time
        if (timestamp < endTime) {
            requestAnimationFrame(animateProgress);
        } else {
            // Ensure the bar is completely empty at the end
            bar.style.width = '0%';
            // Hide the container at exactly the end of hyperspace
            progressContainer.style.display = 'none';
        }
    };

    // Start the animation
    requestAnimationFrame(animateProgress);

    // Set a timeout for exiting hyperspace that matches the exact duration
    setTimeout(() => {
        // Exit hyperspace
        isHyperspace = false;
        window.isHyperspace = false;
        console.log('🚀 EXITING HYPERSPACE - Wings should OPEN!');
        console.log('Setting window.isHyperspace =', window.isHyperspace);
        resetMovementInputs();
        
        // Reset visual indication
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
            coordsDiv.style.fontWeight = 'normal';
        }
        
        // Clean up streaks
        streakLines.forEach(streak => spaceScene.remove(streak.line));
        streakLines = [];
        
        // Force hide progress bar to ensure it doesn't linger
        progressContainer.style.display = 'none';
    }, hyperspaceDuration);
}

let debugMode = true;

// Add a global function to directly toggle wings for debugging
window.toggleWings = function() {
    if (spacecraft && spacecraft.toggleWings) {
        console.log("Manually toggling wings via global function");
        const result = spacecraft.toggleWings();
        console.log(result);
        return result;
    } else {
        console.error("spacecraft.toggleWings function not available");
        return "Error: Wings cannot be toggled";
    }
};

// Add a global function to directly set wing position for debugging
window.setWingsPosition = function(position) {
    if (spacecraft && spacecraft.setWingsPosition) {
        console.log(`Manually setting wing position to ${position} via global function`);
        const result = spacecraft.setWingsPosition(position);
        console.log(result);
        return result;
    } else {
        console.error("spacecraft.setWingsPosition function not available");
        return "Error: Wings position cannot be set";
    }
};

// Add a global function to animate wings for testing (animates from closed to open or vice versa)
window.animateWings = function(duration = 500) {
    if (!spacecraft) {
        console.error("spacecraft not available");
        return "Error: Wings cannot be animated";
    }
    
    if (spacecraft.setWingsOpen) {
        // Get current state
        const isCurrentlyOpen = spacecraft._spacecraftComponents?.animationState === 'open';
        
        // Toggle to opposite state - setWingsOpen now has smooth animations built-in
        console.log(`Animating wings from ${isCurrentlyOpen ? 'open' : 'closed'} to ${isCurrentlyOpen ? 'closed' : 'open'}`);
        spacecraft.setWingsOpen(!isCurrentlyOpen);
        
        return `Wings animating to ${isCurrentlyOpen ? 'closed' : 'open'} position`;
    } else if (spacecraft.setWingsPosition) {
        // Fall back to the original implementation if setWingsOpen is not available
        const startTime = performance.now();
        const startPos = spacecraft._spacecraftComponents?.animationState === 'open' ? 1 : 0;
        const endPos = startPos > 0.5 ? 0 : 1;
        
        console.log(`Animating wings from ${startPos} to ${endPos} over ${duration}ms`);
        
        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(1, elapsed / duration);
            
            // Use an easing function for smoother animation
            const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
            const currentPos = startPos + (endPos - startPos) * easedProgress;
            
            spacecraft.setWingsPosition(currentPos);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
        return `Animating wings from ${startPos} to ${endPos}`;
    } else {
        console.error("No wing animation methods available");
        return "Error: Wings cannot be animated";
    }
};

// Main animation loop
function animate(currentTime = 0) {
    if (!isAnimating) {
        console.log("Animation stopped - isAnimating is false");
        return;
    }
    
    requestAnimationFrame(animate);

    // Calculate delta time in seconds for smooth movement
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    try {
        // Handle laser firing when spacebar is pressed
        if (isSpacePressed) {
            // Get the current active scene and spacecraft
            let activeScene = spaceScene;
            let activeSpacecraft = spacecraft;
            let sceneType = 'space';
            
            /* Moon surface access disabled
            if (importedMoonSurfaceActive) {
                activeScene = moonScene;
                activeSpacecraft = moonSpacecraft || spacecraft;
                sceneType = 'moon';
            }
            */
            if (importedSanFranSurfaceActive) {
                activeScene = sanFranScene;
                activeSpacecraft = sanFranSpacecraft || spacecraft;
                sceneType = 'sanFran';
            }
            if (importedWashingtonSurfaceActive) {
                activeScene = washingtonScene;
                activeSpacecraft = washingtonSpacecraft || spacecraft;
                sceneType = 'washington';
            }
            
            // Don't fire lasers if in space scene and hyperspace is active
            if (!(sceneType === 'space' && isHyperspace)) {
                // Get the key states
                const slowMode = document.querySelector('[data-key="ArrowDown"]')?.classList.contains('active') || false;
                // LASER FIRING DISABLED
                // fireLaser(activeSpacecraft, activeScene, sceneType, isBoosting, keys.down);
            }
        }
        
        // Update laser positions and cleanup expired lasers
        updateLasers(deltaTime);

        // CASE 0 = normal space view
        if (!importedSanFranSurfaceActive && !importedWashingtonSurfaceActive && !importedMoonSurfaceActive) {
            // If we just exited a planet surface, make sure space container is visible
            const spaceContainer = document.getElementById('space-container');
            if (spaceContainer && spaceContainer.style.display === 'none') {
                spaceContainer.style.display = 'block';
                console.log('Restored space-container visibility');
            }
            
            // Fix for controls dropdown visibility - check if controls should be visible
            const controlsPrompt = document.getElementById('controls-prompt');
            const controlsDropdown = document.getElementById('controls-dropdown');
            if (controlsPrompt && controlsDropdown && controlsPrompt.textContent === 'Press Enter to hide controls') {
                controlsDropdown.style.display = 'block';
                controlsDropdown.style.zIndex = '10000'; // Ensure it's above everything else
                console.log('Force-restoring controls dropdown visibility');
            }

            try {
                // Initialize space scene if needed
                if (!spaceInitialized) {
                    console.log('Initializing Outer Space');
                    const spaceObjects = initSpace();
                    spaceInitialized = true;
                    console.log('Space initialized successfully', spaceObjects);
                }
                
                // Main frame update function - pass isBoosting and isHyperspace values
                updateSpace(isBoosting, isHyperspace, deltaTime);
                
                // Update Moon's position relative to Earth using global coordinates
                updateMoonPosition();
                
                // Update hyperspace streaks if active
                if (isHyperspace) {
                    updateStreaks();
                    
                    // Make doubly sure the hyperspace progress bar is visible during hyperspace
                    const progressContainer = document.getElementById('hyperspace-progress-container');
                    if (progressContainer && progressContainer.style.display !== 'block') {
                        console.log('Force-restoring hyperspace progress visibility during active hyperspace');
                        progressContainer.style.display = 'block';
                        progressContainer.style.zIndex = '10000';
                        progressContainer.style.opacity = '1';
                        progressContainer.style.visibility = 'visible';
                    }
                }
                
                // Update coordinates display - only show in space mode
                const coordsDiv = document.getElementById('coordinates');
                if (coordsDiv) {
                    if (spacecraft) {
                        // Format coordinates to 1 decimal place
                        coordsDiv.textContent = `X: ${spacecraft.position.x.toFixed(1)}, Y: ${spacecraft.position.y.toFixed(1)}, Z: ${spacecraft.position.z.toFixed(1)}`;
                        
                        // Console log the spacecraft global coordinates
                        // console.log(`Spacecraft Global Coordinates: X: ${spacecraft.position.x.toFixed(1)}, Y: ${spacecraft.position.y.toFixed(1)}, Z: ${spacecraft.position.z.toFixed(1)}`);
                    }
                    coordsDiv.style.display = 'block';
                }
                
                // Ensure exploration counter is visible in space view
                const explorationCounter = document.querySelector('.exploration-counter');
                if (explorationCounter) {
                    explorationCounter.style.display = 'block';
                }
                
                // Render the scene
                renderScene();
            } catch (e) {
                console.error('Space animation error:', e);
            }
        }

        // CASE 1 = San Fran surface view
        if (importedSanFranSurfaceActive && !importedWashingtonSurfaceActive && !importedMoonSurfaceActive) {
            try {
                // Detect if we just entered San Fran's surface
                if (!prevSanFranSurfaceActive) {
                    // Show transition before initializing San Fran surface
                    showSanFranTransition(() => {
                        // Initialize San Fran once the transition is complete
                        if (!sanFranInitialized) {
                            console.log('Initializing San Fran surface');
                            const sanFranObjects = initSanFranSurface();
                            sanFranInitialized = true;
                            console.log('San Fran surface initialized successfully', sanFranObjects);
    
                            // Hide space container to see surface scene
                            const spaceContainer = document.getElementById('space-container');
                            if (spaceContainer) {
                                spaceContainer.style.display = 'none';
                                console.log('Hid space-container');
                            }
                            
                            // Show San Fran surface message
                            const sanFranMsg = document.createElement('div');
                            sanFranMsg.id = 'sanFran-surface-message';
                            sanFranMsg.style.position = 'fixed';
                            sanFranMsg.style.top = '20px';
                            sanFranMsg.style.right = '20px';
                            sanFranMsg.style.color = 'white';
                            sanFranMsg.style.fontFamily = 'Orbitron, sans-serif';
                            sanFranMsg.style.fontSize = '16px';
                            sanFranMsg.style.padding = '10px';
                            sanFranMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                            sanFranMsg.style.borderRadius = '5px';
                            sanFranMsg.style.zIndex = '9999';
                            sanFranMsg.innerHTML = 'SAN FRAN SURFACE<br>Press ESC to return to space<br>Press R to reset position';
                            document.body.appendChild(sanFranMsg);
                            
                            // Hide coordinates display in earth surface mode
                            const coordsDiv = document.getElementById('coordinates');
                            if (coordsDiv) {
                                coordsDiv.style.display = 'none';
                            }
                            
                            // Hide exploration counter on Earth's surface
                            const explorationCounter = document.querySelector('.exploration-counter');
                            if (explorationCounter) {
                                explorationCounter.style.display = 'none';
                            }
                            
                            // Hide hyperspace progress container on Earth's surface
                            const progressContainer = document.getElementById('hyperspace-progress-container');
                            if (progressContainer) {
                                progressContainer.style.display = 'none';
                            }
                            
                            // Clean up any existing hyperspace streaks
                            if (streakLines && streakLines.length > 0) {
                                streakLines.forEach(streak => spaceScene.remove(streak.line));
                                streakLines = [];
                                isHyperspace = false;
                            }
                            
                            // Hide any planet info boxes that might be visible
                            const planetInfoBox = document.querySelector('.planet-info-box');
                            if (planetInfoBox) {
                                planetInfoBox.style.display = 'none';
                            }
                            
                            // Hide any distance indicators
                            const distanceIndicators = document.querySelectorAll('.distance-indicator');
                            distanceIndicators.forEach(indicator => {
                                indicator.style.display = 'none';
                            });
                            
                            // Hide any reticle display
                            if (spacecraft && spacecraft.userData && spacecraft.userData.reticle) {
                                spacecraft.userData.reticle.visible = false;
                            }
                            
                            // Clear any active lasers
                            if (typeof clearAllLasers === 'function') {
                                clearAllLasers();
                            }
                            
                            // Hide any other UI elements that should not be visible on moon surface
                            // Look for elements by class that might contain 'popup', 'tooltip', or 'notification'
                            const otherUIElements = document.querySelectorAll('[class*="popup"], [class*="tooltip"], [class*="notification"]');
                            otherUIElements.forEach(element => {
                                element.style.display = 'none';
                            });
                            
                            // Ensure keyboard focus is on the page after scene change
                            setTimeout(() => {
                                window.focus();
                                document.body.focus();
                                console.log('Set keyboard focus after Earth initialization');
                            }, 300);
                        }
                        
                        // Reset position to starting point over San Francisco every time we enter Earth surface
                        console.log('Scheduling automatic position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Automatically resetting position to starting point');
                            resetSanFranPosition();
                            
                            // Set first entry flag to false AFTER the initial position reset
                            if (isFirstSanFranEntry) {
                                console.log('First San Fran entry completed');
                                isFirstSanFranEntry = false;
                            }
                        }, 200);
                    });
                }
                
                // If San Fran is already initialized, update and render
                if (sanFranInitialized) {
                    // If this is the first time entering San Fran in this session, reset position to ensure proper loading
                    if (isFirstSanFranEntry) {
                        console.log('First San Fran entry this session - ensuring proper position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Executing first-entry position reset');
                            resetSanFranPosition();
                            isFirstSanFranEntry = false;
                        }, 200);
                    }
                    
                    // Main update function that updates spacecraft, camera, tiles, world matrices
                    const sanFranUpdated = updateSanFranSurface(deltaTime);              
    
                    // Render the San Fran scene with the San Fran camera using our renderer
                    sanFranRenderer.render(sanFranScene, sanFranCamera);
                }
            } catch (e) {
                console.error('San Fran surface animation error:', e);
            }
        }
        
        // Update the hyperspace option in the controls dropdown when scene changes
        if (prevSanFranSurfaceActive !== importedSanFranSurfaceActive) {
            updateControlsDropdown(importedSanFranSurfaceActive, importedMoonSurfaceActive);
            
            // Hide hyperspace progress bar when on Earth's surface
            const progressContainer = document.getElementById('hyperspace-progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none'; // Always hide when scene changes
            }
        }

        // CASE 1.5 = Washington surface view
        if (!importedSanFranSurfaceActive && importedWashingtonSurfaceActive && !importedMoonSurfaceActive) {
            try {
                // Detect if we just entered Washington's surface
                if (!prevWashingtonSurfaceActive) {
                    // Show transition before initializing Washington surface
                    showWashingtonTransition(() => {
                        // Initialize Washington once the transition is complete
                        if (!washingtonInitialized) {
                            console.log('Initializing Washington surface');
                            const washingtonObjects = initWashingtonSurface();
                            washingtonInitialized = true;
                            console.log('Washington surface initialized successfully', washingtonObjects);
    
                            // Hide space container to see surface scene
                            const spaceContainer = document.getElementById('space-container');
                            if (spaceContainer) {
                                spaceContainer.style.display = 'none';
                                console.log('Hid space-container');
                            }
                            
                            // Show Washington surface message
                            const washingtonMsg = document.createElement('div');
                            washingtonMsg.id = 'washington-surface-message';
                            washingtonMsg.style.position = 'fixed';
                            washingtonMsg.style.top = '20px';
                            washingtonMsg.style.right = '20px';
                            washingtonMsg.style.color = 'white';
                            washingtonMsg.style.fontFamily = 'Orbitron, sans-serif';
                            washingtonMsg.style.fontSize = '16px';
                            washingtonMsg.style.padding = '10px';
                            washingtonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                            washingtonMsg.style.borderRadius = '5px';
                            washingtonMsg.style.zIndex = '9999';
                            washingtonMsg.innerHTML = 'WASHINGTON SURFACE<br>Press ESC to return to space<br>Press R to reset position';
                            document.body.appendChild(washingtonMsg);
                            
                            // Hide coordinates display in earth surface mode
                            const coordsDiv = document.getElementById('coordinates');
                            if (coordsDiv) {
                                coordsDiv.style.display = 'none';
                            }
                            
                            // Hide exploration counter on Earth's surface
                            const explorationCounter = document.querySelector('.exploration-counter');
                            if (explorationCounter) {
                                explorationCounter.style.display = 'none';
                            }
                            
                            // Hide hyperspace progress container on Earth's surface
                            const progressContainer = document.getElementById('hyperspace-progress-container');
                            if (progressContainer) {
                                progressContainer.style.display = 'none';
                            }
                            
                            // Clean up any existing hyperspace streaks
                            if (streakLines && streakLines.length > 0) {
                                streakLines.forEach(streak => spaceScene.remove(streak.line));
                                streakLines = [];
                                isHyperspace = false;
                            }
                            
                            // Hide any planet info boxes that might be visible
                            const planetInfoBox = document.querySelector('.planet-info-box');
                            if (planetInfoBox) {
                                planetInfoBox.style.display = 'none';
                            }
                            
                            // Hide any distance indicators
                            const distanceIndicators = document.querySelectorAll('.distance-indicator');
                            distanceIndicators.forEach(indicator => {
                                indicator.style.display = 'none';
                            });
                            
                            // Hide any reticle display
                            if (spacecraft && spacecraft.userData && spacecraft.userData.reticle) {
                                spacecraft.userData.reticle.visible = false;
                            }
                            
                            // Clear any active lasers
                            if (typeof clearAllLasers === 'function') {
                                clearAllLasers();
                            }
                            
                            // Hide any other UI elements that should not be visible on moon surface
                            // Look for elements by class that might contain 'popup', 'tooltip', or 'notification'
                            const otherUIElements = document.querySelectorAll('[class*="popup"], [class*="tooltip"], [class*="notification"]');
                            otherUIElements.forEach(element => {
                                element.style.display = 'none';
                            });
                            
                            // Ensure keyboard focus is on the page after scene change
                            setTimeout(() => {
                                window.focus();
                                document.body.focus();
                                console.log('Set keyboard focus after Earth initialization');
                            }, 300);
                        }
                        
                        // Reset position to starting point over San Francisco every time we enter Earth surface
                        console.log('Scheduling automatic position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Automatically resetting position to starting point');
                            resetWashingtonPosition();
                            
                            // Set first entry flag to false AFTER the initial position reset
                            if (isFirstWashingtonEntry) {
                                console.log('First Washington entry completed');
                                isFirstWashingtonEntry = false;
                            }
                        }, 200);
                    });
                }
                
                // If Washington is already initialized, update and render
                if (washingtonInitialized) {
                    // If this is the first time entering Washington in this session, reset position to ensure proper loading
                    if (isFirstWashingtonEntry) {
                        console.log('First Washington entry this session - ensuring proper position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Executing first-entry position reset');
                            resetWashingtonPosition();
                            isFirstWashingtonEntry = false;
                        }, 200);
                    }
                    
                    // Main update function that updates spacecraft, camera, tiles, world matrices
                    const washingtonUpdated = updateWashingtonSurface(deltaTime);              
    
                    // Render the Washington scene with the Washington camera using our renderer
                    washingtonRenderer.render(washingtonScene, washingtonCamera);
                }
            } catch (e) {
                console.error('Washington surface animation error:', e);
            }
        }
        
        // Update the hyperspace option in the controls dropdown when scene changes
        if (prevWashingtonSurfaceActive !== importedWashingtonSurfaceActive) {
            updateControlsDropdown(importedWashingtonSurfaceActive, importedMoonSurfaceActive);
            
            // Hide hyperspace progress bar when on Earth's surface
            const progressContainer = document.getElementById('hyperspace-progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none'; // Always hide when scene changes
            }
        }
        
        // CASE 2 = moon surface view
        if (!importedSanFranSurfaceActive && !importedWashingtonSurfaceActive && importedMoonSurfaceActive) {
            try {
                // Detect if we just entered moon's surface
                if (!prevMoonSurfaceActive) {
                    // Show transition before initializing Moon surface
                    showMoonTransition(() => {
                        // Initialize Moon once the transition is complete
                        if (!moonInitialized) {
                            console.log('Initializing Moon surface');
                            const moonObjects = initMoonSurface();
                            moonInitialized = true;
                            console.log('Moon surface initialized successfully', moonObjects);
    
                            // Hide space container to see surface scene
                            const spaceContainer = document.getElementById('space-container');
                            if (spaceContainer) {
                                spaceContainer.style.display = 'none';
                                console.log('Hid space-container');
                            }
                            
                            // Show moon surface message
                            const moonMsg = document.createElement('div');
                            moonMsg.id = 'moon-surface-message';
                            moonMsg.style.position = 'fixed';
                            moonMsg.style.top = '20px';
                            moonMsg.style.right = '20px';
                            moonMsg.style.color = '#b3e5fc'; // Changed from white to light blue
                            moonMsg.style.fontFamily = 'Orbitron, sans-serif';
                            moonMsg.style.fontSize = '16px';
                            moonMsg.style.padding = '10px';
                            moonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                            moonMsg.style.borderRadius = '5px';
                            moonMsg.style.zIndex = '9999';
                            moonMsg.style.boxShadow = '0 0 10px rgba(79, 195, 247, 0.3)'; // Added subtle blue glow
                            moonMsg.style.border = '1px solid rgba(79, 195, 247, 0.3)'; // Added subtle border
                            moonMsg.innerHTML = 'MOON SURFACE<br>Press ESC to return to space<br>Press R to reset position';
                            
                            // Make sure no animation classes are applied
                            moonMsg.classList.remove('distance-indicator-urgent');
                            
                            document.body.appendChild(moonMsg);
                            
                            // Hide coordinates display in moon surface mode
                            const coordsDiv = document.getElementById('coordinates');
                            if (coordsDiv) {
                                coordsDiv.style.display = 'none';
                            }
                            
                            // Hide exploration counter on moon's surface
                            const explorationCounter = document.querySelector('.exploration-counter');
                            if (explorationCounter) {
                                explorationCounter.style.display = 'none';
                            }
                            
                            // Hide hyperspace progress container on moon's surface
                            const progressContainer = document.getElementById('hyperspace-progress-container');
                            if (progressContainer) {
                                progressContainer.style.display = 'none';
                            }
                            
                            // Clean up any existing hyperspace streaks
                            if (streakLines && streakLines.length > 0) {
                                streakLines.forEach(streak => spaceScene.remove(streak.line));
                                streakLines = [];
                                isHyperspace = false;
                            }
                            
                            // Hide any planet info boxes that might be visible
                            const planetInfoBox = document.querySelector('.planet-info-box');
                            if (planetInfoBox) {
                                planetInfoBox.style.display = 'none';
                            }
                            
                            // Hide any distance indicators
                            const distanceIndicators = document.querySelectorAll('.distance-indicator');
                            distanceIndicators.forEach(indicator => {
                                indicator.style.display = 'none';
                            });
                            
                            // Hide any reticle display
                            if (spacecraft && spacecraft.userData && spacecraft.userData.reticle) {
                                spacecraft.userData.reticle.visible = false;
                            }
                            
                            // Clear any active lasers
                            if (typeof clearAllLasers === 'function') {
                                clearAllLasers();
                            }
                            
                            // Hide any other UI elements that should not be visible on moon surface
                            // Look for elements by class that might contain 'popup', 'tooltip', or 'notification'
                            const otherUIElements = document.querySelectorAll('[class*="popup"], [class*="tooltip"], [class*="notification"], .info-box, [id*="indicator"]');
                            otherUIElements.forEach(element => {
                                if (element.id !== 'moon-surface-message' && element.id !== 'controls-prompt' && element.id !== 'controls-dropdown') {
                                    element.style.display = 'none';
                                }
                            });
                            
                            // Ensure keyboard focus is on the page after scene change
                            setTimeout(() => {
                                window.focus();
                                document.body.focus();
                                console.log('Set keyboard focus after Moon initialization');
                            }, 300);
                        }
                        
                        // Reset position to starting point over San Francisco every time we enter moon surface
                        console.log('Scheduling automatic position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Automatically resetting position to starting point');
                            resetMoonPosition();
                            
                            // Set first entry flag to false AFTER the initial position reset
                            if (isFirstMoonEntry) {
                                console.log('First Moon entry completed');
                                isFirstMoonEntry = false;
                            }
                        }, 200);
                    });
                }
                
                // If Moon is already initialized, update and render
                if (moonInitialized) {
                    // If this is the first time entering moon in this session, reset position to ensure proper loading
                    if (isFirstMoonEntry) {
                        console.log('First Moon entry this session - ensuring proper position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Executing first-entry position reset');
                            resetMoonPosition();
                            isFirstMoonEntry = false;
                        }, 200);
                    }
                    
                    // Main update function that updates spacecraft, camera, tiles, world matrices
                    const moonUpdated = updateMoonSurface(deltaTime);              
    
                    // Render the Moon scene with the Moon camera using our renderer
                    moonRenderer.render(moonScene, moonCamera);
                }
            } catch (e) {
                console.error('Moon surface animation error:', e);
            }
        }
        
        // Update the hyperspace option in the controls dropdown when scene changes
        if (prevMoonSurfaceActive !== importedMoonSurfaceActive) {
            updateControlsDropdown(importedSanFranSurfaceActive, importedWashingtonSurfaceActive, importedMoonSurfaceActive);
            
            // Hide hyperspace progress bar when on Moon's surface
            const progressContainer = document.getElementById('hyperspace-progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none'; // Always hide when scene changes
            }
            
            // If we just entered moon surface, ensure all space UI elements are hidden
            if (importedMoonSurfaceActive) {
                // Hide any planet info boxes that might be visible
                const planetInfoBox = document.querySelector('.planet-info-box');
                if (planetInfoBox) {
                    planetInfoBox.style.display = 'none';
                }
                
                // Make sure all distance indicators are hidden
                const distanceIndicators = document.querySelectorAll('.distance-indicator');
                distanceIndicators.forEach(indicator => {
                    indicator.style.display = 'none';
                });
                
                // Hide any reticle display
                if (spacecraft && spacecraft.userData && spacecraft.userData.reticle) {
                    spacecraft.userData.reticle.visible = false;
                }
                
                // Clear any active lasers
                if (typeof clearAllLasers === 'function') {
                    clearAllLasers();
                }
                
                // Hide any coordinates display
                const coordsDiv = document.getElementById('coordinates');
                if (coordsDiv) {
                    coordsDiv.style.display = 'none';
                }
                
                // Hide any exploration counter
                const explorationCounter = document.querySelector('.exploration-counter');
                if (explorationCounter) {
                    explorationCounter.style.display = 'none';
                }
                
                // Hide any other UI elements that should not be visible on moon surface
                const otherUIElements = document.querySelectorAll('[class*="popup"], [class*="tooltip"], [class*="notification"], .info-box, [id*="indicator"]');
                otherUIElements.forEach(element => {
                    if (element.id !== 'moon-surface-message' && element.id !== 'controls-prompt' && element.id !== 'controls-dropdown') {
                        element.style.display = 'none';
                    }
                });
            }
        }


    } catch (e) {
        console.error('Main animation loop error:', e);
    }

    // Update previous state for next frame
    prevSanFranSurfaceActive = importedSanFranSurfaceActive;
    prevWashingtonSurfaceActive = importedWashingtonSurfaceActive;
    prevMoonSurfaceActive = importedMoonSurfaceActive;
}

// Function to show the blue transition effect when entering Earth's atmosphere
function showSanFranTransition(callback) {
    const transitionElement = document.getElementById('sanFran-transition');
    
    if (!transitionElement) {
        console.error('Earth transition element not found');
        if (callback) callback();
        return;
    }
    
    // Make the transition element visible but with opacity 0
    transitionElement.style.display = 'block';
    
    // Force a reflow to ensure the display change is applied before changing opacity
    transitionElement.offsetHeight;
    
    // Set opacity to 1 to start the fade-in transition
    transitionElement.style.opacity = '1';
    
    // Wait for the transition to complete (0.5 second)
    setTimeout(() => {
        // After transition completes, reset the element and call the callback
        transitionElement.style.opacity = '0';
        
        // Wait for fade-out to complete before hiding
        setTimeout(() => {
            transitionElement.style.display = 'none';
        }, 500);
        
        // Execute the callback if provided
        if (callback) callback();
    }, 500);
}

// Function to show the blue transition effect when entering Washington's atmosphere
function showWashingtonTransition(callback) {
    const transitionElement = document.getElementById('washington-transition');
    
    if (!transitionElement) {
        console.error('Earth transition element not found');
        if (callback) callback();
        return;
    }
    
    // Make the transition element visible but with opacity 0
    transitionElement.style.display = 'block';
    
    // Force a reflow to ensure the display change is applied before changing opacity
    transitionElement.offsetHeight;
    
    // Set opacity to 1 to start the fade-in transition
    transitionElement.style.opacity = '1';
    
    // Wait for the transition to complete (0.5 second)
    setTimeout(() => {
        // After transition completes, reset the element and call the callback
        transitionElement.style.opacity = '0';
        
        // Wait for fade-out to complete before hiding
        setTimeout(() => {
            transitionElement.style.display = 'none';
        }, 500);
        
        // Execute the callback if provided
        if (callback) callback();
    }, 500);
}

// Function to show the mooon transition effect when entering moon's surface
function showMoonTransition(callback) {
    const transitionElement = document.getElementById('moon-transition');
    
    if (!transitionElement) {
        console.error('Moon transition element not found');
        if (callback) callback();
        return;
    }
    
    // Make the transition element visible but with opacity 0
    transitionElement.style.display = 'block';
    
    // Force a reflow to ensure the display change is applied before changing opacity
    transitionElement.offsetHeight;
    
    // Set opacity to 1 to start the fade-in transition
    transitionElement.style.opacity = '1';
    
    // Wait for the transition to complete (0.5 second)
    setTimeout(() => {
        // After transition completes, reset the element and call the callback
        transitionElement.style.opacity = '0';
        
        // Wait for fade-out to complete before hiding
        setTimeout(() => {
            transitionElement.style.display = 'none';
        }, 500);
        
        // Execute the callback if provided
        if (callback) callback();
    }, 500);
}

// Create functions to update the surface state in setup.js
function setSanFranSurfaceActive(value) {
    importedSanFranSurfaceActive = value;
    if (typeof window.setSanFranSurfaceActive === 'function') {
        window.setSanFranSurfaceActive(value);
    }
}

function setWashingtonSurfaceActive(value) {
    importedWashingtonSurfaceActive = value;
    if (typeof window.setWashingtonSurfaceActive === 'function') {
        window.setWashingtonSurfaceActive(value);
    }
}

function setMoonSurfaceActive(value) {
    importedMoonSurfaceActive = value;
    if (typeof window.setMoonSurfaceActive === 'function') {
        window.setMoonSurfaceActive(value);
    }
}