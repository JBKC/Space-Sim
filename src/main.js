// src/main.js

// Main setup imports
import { 
    updateStars, 
    updatePlanetLabels, 
    checkPlanetProximity, 
    isMoonSurfaceActive, // Uncommented Moon surface access
    isEarthSurfaceActive,
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

// import earth surface functions
import { 
    init as initEarthSurface, 
    update as updateEarthSurface,
    scene as earthScene,
    camera as earthCamera,
    // tiles as earthTiles,
    renderer as earthRenderer,
    spacecraft as earthSpacecraft,  // Import the spacecraft from the 3D scene
    resetPosition as resetEarthPosition,  // Import the generic reset position function
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
    updateControlsDropdown
} from './ui.js';

// Import the reticle functions but we won't initialize them here
import { setReticleVisibility } from './reticle.js';

// Import laser functionality
import { fireLaser, updateLasers, clearAllLasers } from './laser.js';

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Explicitly import Three.js module

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;
let spaceInitialized = false;
let earthInitialized = false;  // Move to top-level scope for exports
let moonInitialized = false;  // Move to top-level scope for exports
// Remove the local isMoonSurfaceActive variable to use the imported one
// Add a flag to track first Earth entry in a session
let isFirstEarthEntry = true;
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
let prevEarthSurfaceActive = false;
let prevMoonSurfaceActive = false;
// Initialize UI elements and directional indicator
setupUIElements();
setupDirectionalIndicator();

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
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !isEarthSurfaceActive) {
        startHyperspace();
    }
    // Reset position in Earth surface mode
    if (event.code === 'KeyR' && isEarthSurfaceActive) {
        console.log('R pressed - resetting position in San Francisco');
        resetEarthPosition();
    }
    // Reset position in Moon surface mode
    if (event.code === 'KeyR' && isMoonSurfaceActive) {
        console.log('R pressed - resetting position on the Moon');
        resetMoonPosition();
    }
    // Toggle first-person/third-person view with 'C' key
    if (event.code === 'KeyC') {
        console.log('===== C KEY PRESSED - TOGGLE COCKPIT VIEW =====');
        console.log('Is on Earth surface:', isEarthSurfaceActive);
        console.log('Has spacecraft:', !!spacecraft);
        console.log('Has earth spacecraft:', !!earthSpacecraft);
        
        if (isEarthSurfaceActive && earthSpacecraft) {
            console.log('C pressed - toggling cockpit view in Earth scene');
            if (typeof earthSpacecraft.toggleView === 'function') {
                const result = earthSpacecraft.toggleView(earthCamera, (isFirstPerson) => {
                    // Reset camera state based on new view mode
                    console.log(`Resetting Earth camera state for ${isFirstPerson ? 'cockpit' : 'third-person'} view`);
                    console.log('Earth camera reset callback executed');
                    // If you have access to Earth's camera state, reset it here
                });
                console.log('Earth toggle view result:', result);
            } else {
                console.warn('Toggle view function not available on Earth spacecraft');
            }
        } else if (isMoonSurfaceActive && moonSpacecraft) {
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
    // Enhanced ESC key to exit Moon surface or Earth surface
    if (event.code === 'Escape') {
        if (isMoonSurfaceActive) {
            console.log('ESC pressed - exiting Moon surface');
            exitMoonSurface();
            // Reset the first entry flag so next time we enter Moon, it's treated as a first entry
            isFirstMoonEntry = true;
        } else if (isEarthSurfaceActive) {
            console.log('ESC pressed - exiting Earth surface');
            exitEarthSurface();
            // Reset the first entry flag so next time we enter Earth, it's treated as a first entry
            isFirstEarthEntry = true;
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
    console.log('Starting game in mode:', mode);
    gameMode = mode;
    setGameMode(mode);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // Show coordinates when game starts
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.display = 'block';
    }
    
    // Show the controls prompt and initialize dropdown state
    showControlsPrompt();
    updateControlsDropdown(isEarthSurfaceActive);

    // Ensure wings are open at startup
    initializeWingsOpen();

    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
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
    if (isHyperspace || isEarthSurfaceActive) return;
    
    isHyperspace = true;
    // Make sure to set the global isHyperspace flag immediately so other modules can detect it
    window.isHyperspace = true;
    // console.log('🚀 ENTERING HYPERSPACE - Wings should CLOSE!');
    // console.log('Setting window.isHyperspace =', window.isHyperspace);

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

    progressContainer.style.display = 'block'; // Show the container
    bar.style.width = '100%'; // Start at 100% for right-to-left unfilling

    // Debug: Log visibility and positioning
    console.log('Progress container display:', progressContainer.style.display);
    console.log('Label visibility:', label.style.display, 'Text:', label.textContent);
    console.log('Label position:', label.style.top, label.style.left);

    let progress = 100;
    const interval = setInterval(() => {
        progress -= (100 / (2000 / 16)); // Decrease from 100% to 0% over 2 seconds
        bar.style.width = `${progress}%`;
        if (progress <= 0) {
            clearInterval(interval);
            progressContainer.style.display = 'none';
        }
    }, 16); // Approx. 60 FPS

    setTimeout(() => {
        isHyperspace = false;
        window.isHyperspace = false;
        // console.log('🚀 EXITING HYPERSPACE - Wings should OPEN!');
        // console.log('Setting window.isHyperspace =', window.isHyperspace);
        resetMovementInputs();
        
        // Reset visual indication
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
            coordsDiv.style.fontWeight = 'normal';
        }
        
        // Clean up streaks
        streakLines.forEach(streak => spaceScene.remove(streak.line));
        streakLines = [];
    }, 2000);
}

let debugMode = true;

// Make the reset functions available globally to avoid circular imports
window.resetEarthInitialized = function() {
    earthInitialized = false;
    console.log('Reset Earth surface initialization state');
};

window.resetMoonInitialized = function() {
    moonInitialized = false;
    console.log('Reset Moon surface initialization state');
};

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
            if (isMoonSurfaceActive) {
                activeScene = moonScene;
                activeSpacecraft = moonSpacecraft || spacecraft;
                sceneType = 'moon';
            }
            */
            if (isEarthSurfaceActive) {
                activeScene = earthScene;
                activeSpacecraft = earthSpacecraft || spacecraft;
                sceneType = 'sanFran';
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
        if (!isEarthSurfaceActive && !isMoonSurfaceActive) {
            // If we just exited a planet surface, make sure space container is visible
            const spaceContainer = document.getElementById('space-container');
            if (spaceContainer && spaceContainer.style.display === 'none') {
                spaceContainer.style.display = 'block';
                console.log('Restored space-container visibility');
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
                }
                
                // Update coordinates display - only show in space mode
                const coordsDiv = document.getElementById('coordinates');
                if (coordsDiv) {
                    if (spacecraft) {
                        // Format coordinates to 1 decimal place
                        coordsDiv.textContent = `X: ${spacecraft.position.x.toFixed(1)}, Y: ${spacecraft.position.y.toFixed(1)}, Z: ${spacecraft.position.z.toFixed(1)}`;
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

        // CASE 1 = earth surface view
        if (isEarthSurfaceActive && !isMoonSurfaceActive) {
            try {
                // Detect if we just entered Earth's surface
                if (!prevEarthSurfaceActive) {
                    // Show transition before initializing Earth surface
                    showEarthTransition(() => {
                        // Initialize Earth once the transition is complete
                        if (!earthInitialized) {
                            console.log('Initializing Earth surface');
                            const earthObjects = initEarthSurface();
                            earthInitialized = true;
                            console.log('Earth surface initialized successfully', earthObjects);
    
                            // Hide space container to see surface scene
                            const spaceContainer = document.getElementById('space-container');
                            if (spaceContainer) {
                                spaceContainer.style.display = 'none';
                                console.log('Hid space-container');
                            }
                            
                            // Show Earth surface message
                            const earthMsg = document.createElement('div');
                            earthMsg.id = 'earth-surface-message';
                            earthMsg.style.position = 'fixed';
                            earthMsg.style.top = '20px';
                            earthMsg.style.right = '20px';
                            earthMsg.style.color = 'white';
                            earthMsg.style.fontFamily = 'Orbitron, sans-serif';
                            earthMsg.style.fontSize = '16px';
                            earthMsg.style.padding = '10px';
                            earthMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                            earthMsg.style.borderRadius = '5px';
                            earthMsg.style.zIndex = '9999';
                            earthMsg.innerHTML = 'EARTH SURFACE<br>Press ESC to return to space<br>Press R to reset position';
                            document.body.appendChild(earthMsg);
                            
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
                            resetEarthPosition();
                            
                            // Set first entry flag to false AFTER the initial position reset
                            if (isFirstEarthEntry) {
                                console.log('First Earth entry completed');
                                isFirstEarthEntry = false;
                            }
                        }, 200);
                    });
                }
                
                // If Earth is already initialized, update and render
                if (earthInitialized) {
                    // If this is the first time entering Earth in this session, reset position to ensure proper loading
                    if (isFirstEarthEntry) {
                        console.log('First Earth entry this session - ensuring proper position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Executing first-entry position reset');
                            resetEarthPosition();
                            isFirstEarthEntry = false;
                        }, 200);
                    }
                    
                    // Main update function that updates spacecraft, camera, tiles, world matrices
                    const earthUpdated = updateEarthSurface(deltaTime);              
    
                    // Render the earth scene with the earth camera using our renderer
                    earthRenderer.render(earthScene, earthCamera);
                }
            } catch (e) {
                console.error('Earth surface animation error:', e);
            }
        }
        
        // Update the hyperspace option in the controls dropdown when scene changes
        if (prevEarthSurfaceActive !== isEarthSurfaceActive) {
            updateControlsDropdown(isEarthSurfaceActive);
            
            // Hide hyperspace progress bar when on Earth's surface
            const progressContainer = document.getElementById('hyperspace-progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none'; // Always hide when scene changes
            }
        }
        
        // CASE 2 = moon surface view
        if (!isEarthSurfaceActive && isMoonSurfaceActive) {
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
                            moonMsg.style.color = 'white';
                            moonMsg.style.fontFamily = 'Orbitron, sans-serif';
                            moonMsg.style.fontSize = '16px';
                            moonMsg.style.padding = '10px';
                            moonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                            moonMsg.style.borderRadius = '5px';
                            moonMsg.style.zIndex = '9999';
                            moonMsg.innerHTML = 'MOON SURFACE<br>Press ESC to return to space<br>Press R to reset position';
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
        if (prevMoonSurfaceActive !== isMoonSurfaceActive) {
            updateControlsDropdown(isMoonSurfaceActive);
            
            // Hide hyperspace progress bar when on Moon's surface
            const progressContainer = document.getElementById('hyperspace-progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none'; // Always hide when scene changes
            }
        }


    } catch (e) {
        console.error('Main animation loop error:', e);
    }

    // Update previous state for next frame
    prevEarthSurfaceActive = isEarthSurfaceActive;
    prevMoonSurfaceActive = isMoonSurfaceActive;
}

// Function to show the blue transition effect when entering Earth's atmosphere
function showEarthTransition(callback) {
    const transitionElement = document.getElementById('earth-transition');
    
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