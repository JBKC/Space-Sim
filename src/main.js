// MAIN ANIMATION FILE - ORCHESTRATES THE GAME

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { createRateLimitedGameLoader } from './gameLoader.js';
import { loadingManager, textureLoadingManager, updateAssetDisplay } from './loaders.js';

// Import state environment functions
import {
    getEarthSurfaceActive,
    getMoonSurfaceActive,
    setEarthSurfaceActive,
    setMoonSurfaceActive,
    getSpaceInitialized,
    setSpaceInitialized,
    getEarthInitialized,
    setEarthInitialized,
    getMoonInitialized,
    setMoonInitialized,
    getEarthTransition,
    getMoonTransition,
    setEarthTransition,
    setMoonTransition
} from './stateEnv.js';

// Space scene imports
import { 
    exitEarthSurface,
    exitMoonSurface,
    init as initSpace,
    update as updateSpace,
    renderer as spaceRenderer,
    scene as spaceScene,
    camera as spaceCamera,
    renderScene as renderSpaceScene,
    startHyperspace,
} from './spaceEnvs/setup.js';

// Earth scene imports
import { 
    init as initEarthSurface, 
    update as updateEarthSurface,
    scene as earthScene,
    camera as earthCamera,
    renderer as earthRenderer,
    resetPosition as resetEarthPosition,  // Import the generic reset position function
    resetSanFranInitialized,  // Import the new function to reset the San Fran initialization flag
} from './planetEnvs/sanFranCesium.js';
// } from './planetEnvs/washingtonCesium.js';

// Moon scene imports
import { 
    init as initMoonSurface, 
    update as updateMoonSurface,
    scene as moonScene,
    camera as moonCamera,
    renderer as moonRenderer,
    renderScene as renderMoonScene,
    resetPosition as resetMoonPosition,  // Import the generic reset position function
} from './planetEnvs/moonCesium.js';


import { resetMovementInputs } from './movement.js';
import { keys } from './inputControls.js';
import { 
    setupControlsDropdown, 
    showControlsPrompt,
    updateControlsDropdown,
    moonMsg
} from './ui.js';

// Import keyboard control functions
import {
    getBoostState,
    getHyperspaceState
} from './inputControls.js';

/// TO SIMPLIFY / REMOVE

let isAnimating = false;
let isFirstEarthEntry = true;


// Added delta time calculation for smoother animations
let lastFrameTime = 0;

// Make the reset functions available globally to avoid circular imports
window.resetEarthInitialized = function() {
    setEarthInitialized(false);
    console.log('Reset Earth surface initialization state');
    
    // Also reset the Washington initialization flag
    resetSanFranInitialized();
};

// Add resetMoonInitialized function
window.resetMoonInitialized = function() {
    setMoonInitialized(false);
    console.log('Reset Moon surface initialization state');
};

// Expose hyperspace function globally for access from inputControls.js
window.startHyperspace = startHyperspace;



/////////////// INITLIZATION OF HIGH-LEVEL GAME ELEMENTS ///////////////

// Initialize main menu screen
document.addEventListener('DOMContentLoaded', () => {
    const exploreButton = document.querySelector('#explore-button');
    if (exploreButton) {
        // Use rate-limited version for initial game loading
        exploreButton.addEventListener('click', () => rateLimitedStartGame('free'));
        console.log('Space Simulation Started');
    } else {
        console.error('Explore button not found!');
    }
});

///// FUNCITON THAT LOADS UP GAME WHEN EXPLORE BUTTON IS PRESSED /////
function startGame() {

    // hide welcome screen 
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // show optimization stats
    stats.dom.style.display = 'block';
    fpsDisplay.style.display = 'block';
    assetDisplay.style.display = 'block';
    
    // Show the controls prompt and initialize dropdown state
    showControlsPrompt();
    updateControlsDropdown(getEarthSurfaceActive(), getMoonSurfaceActive());

    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

// Use rate limiter to start game
const rateLimitedStartGame = createRateLimitedGameLoader(startGame);

// Initialize FPS counter
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
stats.dom.style.cssText = 'position:absolute;bottom:0;left:0;opacity:0.9;z-index:10000;display:none;'; // Start hidden
document.body.appendChild(stats.dom);
// Create a custom FPS display element
const fpsDisplay = document.createElement('div');
fpsDisplay.id = 'fps-display';
fpsDisplay.style.cssText = 'position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.6);color:#0ff;font-family:monospace;font-size:16px;font-weight:bold;padding:5px 10px;border-radius:5px;z-index:10000;display:none;'; // Start hidden
fpsDisplay.textContent = 'FPS: 0';
document.body.appendChild(fpsDisplay);

// Create an asset loader display
const assetDisplay = document.createElement('div');
assetDisplay.id = 'asset-display';
assetDisplay.style.cssText = 'position:absolute;bottom:45px;left:10px;background:rgba(0,0,0,0.6);color:#0fa;font-family:monospace;font-size:14px;font-weight:bold;padding:5px 10px;border-radius:5px;z-index:10000;display:none;'; // Start hidden
assetDisplay.innerHTML = 'Assets: 0/0<br>Textures: 0/0';
document.body.appendChild(assetDisplay);

// Initialize variables for FPS calculation
let frameCount = 0;
let lastFpsUpdateTime = 0;
const fpsUpdateInterval = 500; // Update numerical display every 500ms

// Initialize UI elements
setupControlsDropdown();

// Handle window resize
window.addEventListener('resize', () => {
    spaceCamera.aspect = window.innerWidth / window.innerHeight;
    spaceCamera.updateProjectionMatrix();
    spaceRenderer.setSize(window.innerWidth, window.innerHeight);
});



///////////// ANIMATION FUNCTIONS /////////////


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

// Catch-all function to hide all space scene elements when entering planet surface
function hideSpaceScene() {
    // Hide space container to see surface scene
    const spaceContainer = document.getElementById('space-container');
    if (spaceContainer) {
        spaceContainer.style.display = 'none';
        console.log('Hid space-container');
    }
    
    // Hide exploration counter
    const explorationCounter = document.querySelector('.exploration-counter');
    if (explorationCounter) {
        explorationCounter.style.display = 'none';
    }
    
    // Hide hyperspace progress container
    const progressContainer = document.getElementById('hyperspace-progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    // Hide any planet info boxes
    const planetInfoBox = document.querySelector('.planet-info-box');
    if (planetInfoBox) {
        planetInfoBox.style.display = 'none';
    }
    
    // Hide any distance indicators
    const distanceIndicators = document.querySelectorAll('.distance-indicator');
    distanceIndicators.forEach(indicator => {
        indicator.style.display = 'none';
    });
    
    // Catchall to hide other UI elements
    const otherUIElements = document.querySelectorAll('[class*="popup"], [class*="tooltip"], [class*="notification"], .info-box, [id*="indicator"]');
    otherUIElements.forEach(element => {
        if (element.id !== 'moon-surface-message' && element.id !== 'controls-prompt' && element.id !== 'controls-dropdown') {
            element.style.display = 'none';
        }
    });

}

///// MAIN ANIMATION LOOP - EACH CALL IS A SINGLE FRAME /////
function animate(currentTime = 0) {
    if (!isAnimating) {
        console.log("Animation stopped - isAnimating is false");
        return;
    }
    
    requestAnimationFrame(animate);
    
    // Begin stats measurement for this frame
    stats.begin();


    // Calculate delta time in seconds for smooth movement
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;
    
    // Update frame counter for custom FPS display
    frameCount++;
    
    // Update numerical FPS display every interval
    if (currentTime - lastFpsUpdateTime > fpsUpdateInterval) {
        // Calculate FPS: frames / elapsed time in seconds
        const fps = Math.round(frameCount / ((currentTime - lastFpsUpdateTime) / 1000));
        
        // Update the FPS display
        fpsDisplay.textContent = `FPS: ${fps}`;
        
        // Color code based on performance
        if (fps > 50) {
            fpsDisplay.style.color = '#0f0'; // Good FPS - green
        } else if (fps > 30) {
            fpsDisplay.style.color = '#ff0'; // Okay FPS - yellow
        } else {
            fpsDisplay.style.color = '#f00'; // Poor FPS - red
        }
        
        // Reset counters
        lastFpsUpdateTime = currentTime;
        frameCount = 0;
        
    }

    // Get current environment states at the beginning of each frame
    const isSpaceInitialized = getSpaceInitialized();
    const isEarthSurfaceActive = getEarthSurfaceActive();
    const isMoonSurfaceActive = getMoonSurfaceActive();


    try {
        // CASE 0 = default space view
        if (!isEarthSurfaceActive && !isMoonSurfaceActive) {

            // If we just exited a planet surface, make sure space container is visible
            const spaceContainer = document.getElementById('space-container');
            if (spaceContainer && spaceContainer.style.display === 'none') {
                spaceContainer.style.display = 'block';
                console.log('Restored space-container visibility');
            }

            try {
                // Initialize space scene (pulled from setup.js)
                if (!isSpaceInitialized) {
                    console.log('Initializing Outer Space');
                    const spaceObjects = initSpace();
                    setSpaceInitialized(true);
                    console.log('Space initialized successfully', spaceObjects);
                }
                
                // APPLY STATE-BASED UPDATES //

                const isBoosting = getBoostState();
                const isHyperspace = getHyperspaceState();
                
                // Perform main space updates (pulled from setup.js)
                updateSpace(isBoosting, isHyperspace, deltaTime);
                
                // Forcing function to ensure hyperspace progress bar visible
                if (isHyperspace) {
                    const progressContainer = document.getElementById('hyperspace-progress-container');
                    if (progressContainer && progressContainer.style.display !== 'block') {
                        console.log('Force-restoring hyperspace progress visibility during active hyperspace');
                        progressContainer.style.display = 'block';
                        progressContainer.style.zIndex = '10000';
                        progressContainer.style.opacity = '1';
                        progressContainer.style.visibility = 'visible';
                    }
                }
                
                updateControlsDropdown(getEarthSurfaceActive(), getMoonSurfaceActive());

                // Get space scene and camera from renderSpaceScene function (pulled from setup.js)
                const spaceSceneInfo = renderSpaceScene();
                
                // RENDER SCENE //
                if (spaceSceneInfo) {
                    spaceRenderer.render(spaceSceneInfo.scene, spaceSceneInfo.camera);
                }
            } catch (e) {
                console.error('Space animation error:', e);
            }
        }

        // CASE 1 = earth surface view
        if (isEarthSurfaceActive && !isMoonSurfaceActive) {
            try {
                // Reset movement inputs immediately to prevent stuck key states
                resetMovementInputs();
                
                // Detect if we just entered Earth's surface using the transition flag
                if (getEarthTransition()) {
                    // Reset movement inputs immediately to prevent stuck key states
                    resetMovementInputs();
                    
                    // Show transition before initializing Earth surface
                    showEarthTransition(() => {
                        // Reset movement inputs again after transition to ensure clean state
                        resetMovementInputs();
                        
                        // Initialize Earth once the transition is complete
                        if (!getEarthInitialized()) {
                            console.log('Initializing Earth surface');
                            const earthObjects = initEarthSurface();
                            setEarthInitialized(true);
                            console.log('Earth surface initialized successfully', earthObjects);
                            
                            // Also reset the Earth-specific keys
                            resetEarthKeys();
                            
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
                            
                            // Hide any other UI elements that should not be visible on planet surface
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
                            
                            // Set transition flag to false after successful initialization
                            setEarthTransition(false);
                            console.log('Earth transition complete, flag set to false');
                        }
                        
                        // Reset position to starting point over San Francisco every time we enter Earth surface
                        console.log('Scheduling automatic position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Automatically resetting position to starting point');
                            resetEarthPosition();
                            
                            // Ensure no keys are stuck after position reset
                            resetMovementInputs();
                            resetEarthKeys(); // Reset Earth-specific keys too
                            
                            // Set first entry flag to false AFTER the initial position reset
                            if (isFirstEarthEntry) {
                                console.log('First Earth entry completed');
                                isFirstEarthEntry = false;
                            }
                        }, 200);
                    });
                }
                
                // If Earth is already initialized, update and render
                if (getEarthInitialized()) {
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
        
        // CASE 2 = moon surface view
        if (!isEarthSurfaceActive && isMoonSurfaceActive) {

            try {
                // console.log(isMoonSurfaceActive, getMoonTransition(), getMoonInitialized());
                
                // Check if moonTransition = true (transition needed, not already on surface)
                if (getMoonTransition()) {
                    console.log('🌙 MOON TRANSITION......');
                    
                    // Show transition before initializing Moon surface
                    showMoonTransition(() => {
                        resetMovementInputs();         

                        // Initialize scene if not already initialized
                        if (!getMoonInitialized()) {
                            console.log('Initializing Moon surface');
                            initMoonSurface();
                            setMoonInitialized(true);
                            console.log('Moon surface initialized.');

                            // We are now operating with the moon container / renderer

                            // Reset spacecraft position consistently, each time moon is entered
                            console.log('Scheduling position reset for Moon entry');
                            setTimeout(() => {
                                console.log('Executing automatic Moon position reset');
                                resetMoonPosition(); 
                                // Ensure movement inputs are reset *after* position reset
                                resetMovementInputs(); 
                            }, 200); // Short delay to ensure scene is ready

                            // Set transition flag to false AFTER initialization and scheduling reset
                            setMoonTransition(false);
                            console.log('Moon transition complete, flag set to false');

                            hideSpaceScene();

                            // Show moon surface message
                            document.body.appendChild(moonMsg);
                        }
                    });
                }
                
                // ELSE IF we are already on the moon surface (initialized and transition done), update and render
                else if (isMoonSurfaceActive && getMoonInitialized() && !getMoonTransition()) {
                    
                    // Force moon DOM to the front as a failsafe
                    if (moonRenderer.domElement.style.display === 'none') {
                        moonRenderer.domElement.style.display = 'block';
                    }
                    if (!document.body.contains(moonRenderer.domElement)) {
                        document.body.appendChild(moonRenderer.domElement);
                    }

                    // APPLY STATE-BASED UPDATES //
                    const isBoosting = getBoostState();        
                    updateMoonSurface(isBoosting, deltaTime);
                    updateControlsDropdown(getEarthSurfaceActive(), getMoonSurfaceActive());
                    const moonSceneInfo = renderMoonScene();

                    // RENDER SCENE //
                    if (moonSceneInfo) {
                        moonRenderer.render(moonSceneInfo.scene, moonSceneInfo.camera);
                    }                
                }
            } catch (e) {
                console.error('Moon surface animation error:', e);
            }
        }

    } catch (error) {
        console.error("Error in animate loop:", error);
    }
    
    // End stats measurement for this frame
    stats.end();

}



