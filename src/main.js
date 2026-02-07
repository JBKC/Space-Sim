// MAIN ANIMATION FILE - ORCHESTRATES THE GAME

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { createRateLimitedGameLoader } from './appConfig/gameLoader.js';
import { loadingManager, textureLoadingManager, resetLoadingStats, updateAssetDisplay } from './appConfig/loaders.js';


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
    checkPlanetProximity,
    updateStreaks,
    streakLines,
    updatePlanetLabels
} from './spaceEnvs/setup.js';

// Import VR test environment
import {
    init as initSpaceVR,
    startVRMode as startSpaceVRMode,
    dispose as disposeSpaceVR,
    calibrateVR
} from './VR/setupVR.js';

// Earth scene imports (set to San Francisco)
import { 
    init as initEarthSurface, 
    update as updateEarthSurface,
    renderer as earthRenderer,
    renderScene as renderEarthScene,
    resetPosition as resetEarthPosition,
} from './planetEnvs/sanFranCesium.js';
// } from './planetEnvs/washingtonCesium.js';

// Moon scene imports
import { 
    init as initMoonSurface, 
    update as updateMoonSurface,
    renderer as moonRenderer,
    renderScene as renderMoonScene,
    resetPosition as resetMoonPosition,
} from './planetEnvs/moonCesium.js';


import { resetMovementInputs } from './movement.js';
import { keys } from './inputControls.js';
import { 
    setupControlsDropdown, 
    showControlsPrompt,
    updateControlsDropdown,
    toggleControlsDropdown,
    earthMsg,
    moonMsg,
    // import VR-related UI
    createVRStatusIndicator,
    updateVRStatus
} from './ui.js';

// Import keyboard control functions
import {
    getBoostState,
    getHyperspaceState,
    getControlsToggleRequested
} from './inputControls.js';


/////////////// GENERAL INITIALIZATION ///////////////

let isAnimating = false;
let lastFrameTime = 0;

// Make the reset functions available globally to avoid circular imports
window.resetEarthInitialized = function() {
    setEarthInitialized(false);
    console.log('Reset Earth surface initialization state');
};

// Add resetMoonInitialized function
window.resetMoonInitialized = function() {
    setMoonInitialized(false);
    console.log('Reset Moon surface initialization state');
};

// Expose hyperspace function globally for access from inputControls.js
window.startHyperspace = startHyperspace;


/////////////// VR INITIALIZATION ///////////////

// Global XR session flag
window.isInXRSession = false;

// Expose the XR animation loop initializer globally
window.initXRAnimationLoop = function() {
    console.log("Global initXRAnimationLoop function called");
    initXRAnimationLoop();
};

// Store the animation callback for direct access if needed
window.initXRAnimationLoop._cachedCallback = null;

// Expose functions globally
window.updateVRStatus = updateVRStatus;


/////////////// INITLIZATION OF HIGH-LEVEL GAME ELEMENTS ///////////////

// Initialize main menu screen
document.addEventListener('DOMContentLoaded', () => {
    const exploreButton = document.querySelector('#explore-button');
    const exploreVRButton = document.querySelector('#explore-vr-button');
    
    // Initialize relevant game mode

    if (exploreButton) {
        // Use rate-limited version for initial game loading in normal mode
        exploreButton.addEventListener('click', () => rateLimitedStartGame('normal'));
        console.log('Normal mode button initialized');
    } else {
        console.error('Explore button not found!');
    }
    
    if (exploreVRButton) {
        // Use rate-limited version for initial game loading in VR mode
        exploreVRButton.addEventListener('click', () => rateLimitedStartGame('vr'));
        console.log('VR mode button initialized');
    } else {
        console.error('Explore VR button not found!');
    }
    
    // Create a debug panel for WebXR in Quest browser
    createXRDebugPanel();
});


///// FUNCITON THAT LOADS UP GAME DEPENDING WHICH BUTTON IS PRESSED /////
async function startGame(mode = 'normal') {
    console.log(`Starting game in ${mode} mode`);

    // Hide the top navigation once the user enters the actual game/VR mode.
    // This nav is only meant for the landing pages (Home + Games welcome screen).
    const topNav = document.querySelector('.top-nav');
    if (topNav) {
        topNav.style.display = 'none';
    }

    // hide welcome screen 
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // Handle UI elements differently based on mode

    if (mode === 'vr') {
        
        // Set global VR mode flag
        window.isInXRSession = true;

        console.log('VR mode enabled - asset display will be suppressed');
        
        // Hide FPS readout
        stats.dom.style.display = 'none';
        fpsDisplay.style.display = 'none';
        
        // Hide controls prompt and dropdown
        const controlsPrompt = document.getElementById('controls-prompt');
        if (controlsPrompt) {
            controlsPrompt.style.display = 'none';
        }
        
        const controlsDropdown = document.getElementById('controls-dropdown');
        if (controlsDropdown) {
            controlsDropdown.style.display = 'none';
        }
        
        // Hide asset loading display
        const assetDisplay = document.querySelector('#asset-display');
        if (assetDisplay) {
            assetDisplay.style.display = 'none';
            console.log('Hid asset-display');
        }
        
        // Show only VR-specific UI elements
        // Initialize VR status indicator
        createVRStatusIndicator();
        
        // Update XR debug info if available
        if (typeof window.updateXRDebugInfo === 'function') {
            window.updateXRDebugInfo();
        }
        
        // Make XR debug button visible
        const xrDebugButton = document.getElementById('xr-debug-button');
        if (xrDebugButton) {
            xrDebugButton.style.display = 'block';
        }

        console.log("Initializing VR test environment");

        await calibrateVR();

        initSpaceVR();

        startSpaceVRMode();


    } else {

        // Normal, non-VR mode
        stats.dom.style.display = 'block';
        fpsDisplay.style.display = 'block';
        
        // Show the controls prompt and initialize dropdown state
        showControlsPrompt();
        updateControlsDropdown(getEarthSurfaceActive(), getMoonSurfaceActive());
        
        // Hide any existing VR UI elements
        const vrStatusContainer = document.getElementById('vr-status-container');
        if (vrStatusContainer) {
            vrStatusContainer.style.display = 'none';
        }
        
        // Hide XR debug button
        const xrDebugButton = document.getElementById('xr-debug-button');
        if (xrDebugButton) {
            xrDebugButton.style.display = 'none';
        }

        // Start animation loop for normal mode
        if (!isAnimating) {
            isAnimating = true;
            animate();
        }
    }
}

// Use rate limiter to start game (stops multiple game loads from same machine)
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

// Initialize the detailed asset display
document.addEventListener('DOMContentLoaded', () => {
    // Call once to create the element
    updateAssetDisplay();
});

// VR only - function to create a debug panel for WebXR diagnostics (bottom right of screen)
function createXRDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'xr-debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: #0ff;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 10000;
        display: none;
    `;
    
    // Button to toggle the debug panel
    const toggleButton = document.createElement('button');
    toggleButton.id = 'xr-debug-button';
    toggleButton.textContent = 'XR Debug';
    toggleButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: #0ff;
        border: 1px solid #0ff;
        border-radius: 5px;
        padding: 5px 10px;
        font-family: monospace;
        z-index: 10001;
        cursor: pointer;
        display: none; /* Initially hidden until VR mode is activated */
    `;
    
    // Toggle debug panel visibility
    toggleButton.addEventListener('click', () => {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
        updateXRDebugInfo();
    });
    
    document.body.appendChild(debugPanel);
    document.body.appendChild(toggleButton);
    
    // Function to update the debug panel with WebXR information
    window.updateXRDebugInfo = function() {

        if (debugPanel.style.display === 'none') return;
        const info = [];
        
        // Check for basic WebXR availability
        // NOTE - navigator.xr is built into browsers - no need for module import
        info.push(`navigator.xr: ${navigator.xr ? 'Available' : 'Not Available'}`);
        
        // User agent
        info.push(`User Agent: ${navigator.userAgent}`);
        
        // Device detection
        const isQuestBrowser =  
            navigator.userAgent.includes('Quest') || 
            navigator.userAgent.includes('Oculus') ||
            (navigator.userAgent.includes('Mobile VR') && navigator.userAgent.includes('Android'));
        info.push(`Quest Browser: ${isQuestBrowser ? 'Detected' : 'Not Detected'}`);
        
        // Session state
        info.push(`XR Session Active: ${window.isInXRSession ? 'Yes' : 'No'}`);
        
        // Quest special mode
        if (isQuestBrowser && !navigator.xr) {
            info.push(`<span style="color:#ff0">Using Quest Special VR Mode</span>`);
            info.push(`<span style="color:#ff0">This mode bypasses standard WebXR API</span>`);
        }
        
        // Feature detection
        if (navigator.xr) {
            // Add async checks that will update later
            info.push('Checking session support types...');
            
            // Get all supported session types
            Promise.all([
                checkSessionSupport('inline'),
                checkSessionSupport('immersive-vr'),
                checkSessionSupport('immersive-ar')
            ]).then(results => {
                // Replace the placeholder with actual results
                const supportInfo = [
                    `inline: ${results[0] ? 'Supported' : 'Not Supported'}`,
                    `immersive-vr: ${results[1] ? 'Supported' : 'Not Supported'}`,
                    `immersive-ar: ${results[2] ? 'Supported' : 'Not Supported'}`
                ];
                
                // Update the debug panel
                debugPanel.innerHTML = info.join('<br>') + '<br>Session Types:<br>- ' + supportInfo.join('<br>- ');
            });
        }
        
        // Initial display
        debugPanel.innerHTML = info.join('<br>');
    };
    
    // Helper to check session support
    function checkSessionSupport(type) {
        if (!navigator.xr) return Promise.resolve(false);
        
        return navigator.xr.isSessionSupported(type)
            .then(supported => {
                console.log(`XR session type '${type}': ${supported ? 'Supported' : 'Not Supported'}`);
                return supported;
            })
            .catch(err => {
                console.error(`Error checking '${type}' support:`, err);
                return false;
            });
    }
}

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

///// MAIN ANIMATION LOOP - Standard mode /////
// Each call is a single frame
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
                    
                    // Reset loading stats for new scene
                    resetLoadingStats();
                    
                    const spaceObjects = initSpace();
                    setSpaceInitialized(true);
                    console.log('Space initialized successfully', spaceObjects);
                }
                
                // APPLY STATE-BASED UPDATES //

                const isBoosting = getBoostState();
                const isHyperspace = getHyperspaceState();
                
                // Check if controls toggle is requested (Enter key pressed)
                if (getControlsToggleRequested()) {
                    toggleControlsDropdown();
                }
                
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
                    
                    // Explicit call to update streaks in the main animation loop
                    if (typeof updateStreaks === 'function' && streakLines && streakLines.length > 0) {
                        updateStreaks(deltaTime);
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
                
                // Detect if we just entered Earth's surface using the transition flag
                if (getEarthTransition()) {
                    console.log('🌏 EARTH TRANSITION......');

                    // Reset loading stats for new scene
                    resetLoadingStats();
                    
                    // Show transition before initializing Earth surface
                    showEarthTransition(() => {
                        resetMovementInputs();
                        
                        // Hide all other scene elements
                        hideSpaceScene();
                        if (moonRenderer && moonRenderer.domElement) {
                            moonRenderer.domElement.style.display = 'none';
                            // If moon renderer is still in the DOM, remove it
                            if (document.body.contains(moonRenderer.domElement)) {
                                document.body.removeChild(moonRenderer.domElement);
                            }
                        }

                        if (moonRenderer && moonRenderer.domElement) {
                            moonRenderer.domElement.style.display = 'none';
                            // If moon renderer is still in the DOM, remove it
                            if (document.body.contains(moonRenderer.domElement)) {
                                document.body.removeChild(moonRenderer.domElement);
                            }
                        }
                        
                        // Initialize Earth once the transition is complete
                        if (!getEarthInitialized()) {
                            console.log('Initializing Earth surface');
                            initEarthSurface();
                            setEarthInitialized(true);
                            console.log('Earth surface initialized.');
                            
                        
                        // Reset position to starting point over San Francisco every time we enter Earth surface
                        console.log('Scheduling automatic position reset with 200ms delay');
                        setTimeout(() => {
                            console.log('Automatically resetting position to starting point');
                            resetEarthPosition();
                                // Ensure movement inputs are reset *after* position reset
                            resetMovementInputs();
                            }, 200); 

                            // Set transition flag to false AFTER initialization and scheduling reset
                            setEarthTransition(false);
                            console.log('Earth transition complete, flag set to false');

                            // Show Earth surface message
                            document.body.appendChild(earthMsg);
                        }   
                    });
                }

                // ELSE IF we are already on the Earth surface (initialized and transition done), update and render
                else if (isEarthSurfaceActive && getEarthInitialized() && !getEarthTransition()) {

                    // Force Earth DOM to the front as a failsafe
                    if (earthRenderer.domElement.style.display === 'none') {
                        earthRenderer.domElement.style.display = 'block';
                    }
                    if (!document.body.contains(earthRenderer.domElement)) {
                        document.body.appendChild(earthRenderer.domElement);
                    }

                    // APPLY STATE-BASED UPDATES //
                    const isBoosting = getBoostState();        
                    
                    // Check if controls toggle is requested (Enter key pressed)
                    if (getControlsToggleRequested()) {
                        toggleControlsDropdown();
                    }
                    
                    updateEarthSurface(isBoosting, deltaTime);
                    updateControlsDropdown(getEarthSurfaceActive(), getMoonSurfaceActive());
                    const earthSceneInfo = renderEarthScene();

                    // RENDER SCENE //
                    if (earthSceneInfo) {
                        earthRenderer.render(earthSceneInfo.scene, earthSceneInfo.camera);
                    }                
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
                    console.log('🌑 MOON TRANSITION......');
                    
                    // Reset loading stats for new scene
                    resetLoadingStats();
                    
                    // Show transition before initializing Moon surface
                    showMoonTransition(() => {
                        resetMovementInputs();
                        
                        // Hide all other scene elements
                        hideSpaceScene();
                        if (earthRenderer && earthRenderer.domElement) {
                            earthRenderer.domElement.style.display = 'none';
                            // If earth renderer is still in the DOM, remove it
                            if (document.body.contains(earthRenderer.domElement)) {
                                document.body.removeChild(earthRenderer.domElement);
                            }
                        }
                        
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
                    
                    // Check if controls toggle is requested (Enter key pressed)
                    if (getControlsToggleRequested()) {
                        toggleControlsDropdown();
                    }
                    
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

/////// VR INITIALIZATION AND ANIMATION LOOP ///////
function initXRAnimationLoop() {
    if (!getSpaceInitialized()) {
        console.warn("Cannot initialize XR loop - space scene not initialized");
        return;
    }
    
    console.log("Initializing XR animation loop - space scene is initialized");
    
    // Stop the regular animation loop
    isAnimating = false;
    console.log("Regular animation loop stopped");
    
    // Check if we're on Quest browser with no navigator.xr
    const isQuestBrowser = 
        navigator.userAgent.includes('Quest') || 
        navigator.userAgent.includes('Oculus') ||
        (navigator.userAgent.includes('Mobile VR') && navigator.userAgent.includes('Android'));
    
    const usingQuestSpecialMode = isQuestBrowser && !navigator.xr;
    if (usingQuestSpecialMode) {
        console.log("Using Quest special mode for XR animation loop");
        
        // Show VR mode activated message
        const vrActivatedMsg = document.createElement('div');
        vrActivatedMsg.id = 'vr-activated-message';
        vrActivatedMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: #00ccff;
            padding: 20px;
            border-radius: 10px;
            font-size: 24px;
            font-family: sans-serif;
            text-align: center;
            z-index: 10000;
            transition: opacity 2s;
        `;
        vrActivatedMsg.textContent = "VR Mode Activated";
        document.body.appendChild(vrActivatedMsg);
        
        // Fade out the message after 2 seconds
        setTimeout(() => {
            vrActivatedMsg.style.opacity = 0;
            // Remove after fade
            setTimeout(() => vrActivatedMsg.remove(), 2000);
        }, 2000);
    }
    
    // Core animation loop for VR
    function xrAnimationCallback(timestamp, xrFrame) {
        // Begin stats measurement for this frame
        stats.begin();
        
        try {
            // Calculate delta time in seconds for smooth movement
            const deltaTime = (timestamp - lastFrameTime) / 1000;
            lastFrameTime = timestamp;
            
            // Update frame counter for custom FPS display
            frameCount++;
            
            // Update numerical FPS display every interval
            if (timestamp - lastFpsUpdateTime > fpsUpdateInterval) {
                const fps = Math.round(frameCount / ((timestamp - lastFpsUpdateTime) / 1000));
                fpsDisplay.textContent = `FPS: ${fps}`;
                
                if (fps > 50) {
                    fpsDisplay.style.color = '#0f0'; // Good FPS - green
                } else if (fps > 30) {
                    fpsDisplay.style.color = '#ff0'; // Okay FPS - yellow
                } else {
                    fpsDisplay.style.color = '#f00'; // Poor FPS - red
                }
                
                lastFpsUpdateTime = timestamp;
                frameCount = 0;
            }
            
            
            // Get boost and hyperspace states
            const isBoosting = getBoostState();
            const isHyperspace = getHyperspaceState();
            
            
            // Hyperspace-specific updates
            if (isHyperspace) {
                const progressContainer = document.getElementById('hyperspace-progress-container');
                if (progressContainer && progressContainer.style.display !== 'block') {
                    progressContainer.style.display = 'block';
                    progressContainer.style.zIndex = '10000';
                    progressContainer.style.opacity = '1';
                    progressContainer.style.visibility = 'visible';
                }
                
                if (typeof updateStreaks === 'function' && streakLines && streakLines.length > 0) {
                    updateStreaks(deltaTime);
                }
            }
            
            
        } catch (error) {
            console.error("Error in XR animation loop:", error);
        }
        
        // End stats measurement for this frame
        stats.end();
        
        // Request next frame (fallback for Quest special mode)
        if (usingQuestSpecialMode && window.isInXRSession) {
            requestAnimationFrame(xrAnimationCallback);
        }
    }
    
    // Store the callback for direct access if needed
    window.initXRAnimationLoop._cachedCallback = xrAnimationCallback;
    
    // Start the animation loop
    if (usingQuestSpecialMode) {
        // For Quest special mode, we use requestAnimationFrame for better control
        console.log("Setting up Quest special mode animation using requestAnimationFrame");
        requestAnimationFrame(xrAnimationCallback);
    } else {
        // For standard WebXR, use the renderer's setAnimationLoop
        console.log("Setting animation loop on space renderer");
        spaceRenderer.setAnimationLoop(xrAnimationCallback);
    }
    
    console.log("WebXR animation loop initialized for space scene");
}



