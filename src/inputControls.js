// Handles all keyboard inputs AND keyboard-related states

// Import keys object from movement.js to maintain shared state across files
import { keys } from './movement.js';

// Flag to track if controls have been initialized
let controlsInitialized = false;

// Hyperspace functionality 
let isHyperspaceActive = false;

// State variables that were previously in main.js
let isBoosting = false;
let isSpacePressed = false;

/**
 * Activates hyperspace mode if conditions are met
 * @param {boolean} isEarthSurfaceActive - Whether earth surface mode is active
 * @param {boolean} isMoonSurfaceActive - Whether moon surface mode is active
 */
function activateHyperspace(isEarthSurfaceActive, isMoonSurfaceActive) {
    // Don't activate hyperspace on planet surfaces
    if (!isHyperspaceActive && !isEarthSurfaceActive && !isMoonSurfaceActive) {
        isHyperspaceActive = true;
        console.log("Hyperspace activated!");
        setTimeout(deactivateHyperspace, 2000);
    }
}

/**
 * Deactivates hyperspace mode
 */
function deactivateHyperspace() {
    if (isHyperspaceActive) {
        isHyperspaceActive = false;
    }
}

/**
 * Initialize keyboard controls and event listeners
 * @returns {boolean} - Whether controls were initialized
 */
export function initControls(isEarthSurfaceActive, isMoonSurfaceActive) {
    if (controlsInitialized) {
        console.log("Controls already initialized, skipping");
        return false;
    }
    
    console.log("Initializing controls with keys object:", keys);
    
    // Track when keys are pressed (keydown)
    document.addEventListener('keydown', (event) => {
        if (!keys) return;
        switch (event.key) {
            case 'w': keys.w = true; break;
            case 's': keys.s = true; break;
            case 'a': keys.a = true; break;
            case 'd': keys.d = true; break;
            case 'ArrowLeft': keys.left = true; break;
            case 'ArrowRight': keys.right = true; break;
            case 'ArrowUp': keys.up = true; break;
            case 'ArrowDown': keys.down = true; break;
            case 'Shift': keys.shift = false; break;
        }
    });

    // Track when keys are released (keyup)
    document.addEventListener('keyup', (event) => {
        if (!keys) return;
        switch (event.key) {
            case 'w': keys.w = false; break;
            case 's': keys.s = false; break;
            case 'a': keys.a = false; break;
            case 'd': keys.d = false; break;
            case 'ArrowLeft': keys.left = false; break;
            case 'ArrowRight': keys.right = false; break;
            case 'ArrowUp': keys.up = false; break;
            case 'ArrowDown': keys.down = false; break;
            case 'Shift': keys.shift = false; break;
        }
    });

    // Add global hyperspace key handlers
    window.addEventListener('keydown', (event) => {
        // Only activate hyperspace if not on Earth's surface
        if (event.key === 'Shift' && !isEarthSurfaceActive) {
            activateHyperspace(isEarthSurfaceActive, isMoonSurfaceActive);
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.key === 'Shift') {
            deactivateHyperspace();
        }
    });
    
    controlsInitialized = true;
    return true;
}

/**
 * Sets up the main game controls for handling various key presses
 * 
 * @param {Object} dependencies - Dependencies needed by the controls
 * @param {Object} dependencies.spacecraft - The main spacecraft object
 * @param {Object} dependencies.earthSpacecraft - The Earth spacecraft object
 * @param {Object} dependencies.moonSpacecraft - The Moon spacecraft object
 * @param {Object} dependencies.spaceCamera - The space camera
 * @param {Object} dependencies.earthCamera - The Earth camera
 * @param {Object} dependencies.moonCamera - The Moon camera
 * @param {boolean} dependencies.isEarthSurfaceActive - Whether Earth surface is active
 * @param {boolean} dependencies.isMoonSurfaceActive - Whether Moon surface is active
 * @param {Function} dependencies.resetEarthPosition - Function to reset Earth position
 * @param {Function} dependencies.resetMoonPosition - Function to reset Moon position
 * @param {Function} dependencies.exitEarthSurface - Function to exit Earth surface
 * @param {Function} dependencies.exitMoonSurface - Function to exit Moon surface
 * @param {Function} dependencies.startHyperspace - Function to start hyperspace
 */
export function setupGameControls(dependencies) {
    const {
        spacecraft, 
        earthSpacecraft, 
        moonSpacecraft,
        spaceCamera,
        earthCamera,
        moonCamera,
        isEarthSurfaceActive,
        isMoonSurfaceActive,
        resetEarthPosition,
        resetMoonPosition,
        exitEarthSurface,
        exitMoonSurface,
        startHyperspace
    } = dependencies;
    
    // Main keydown event listener for game controls
    document.addEventListener('keydown', (event) => {
        // Check if we're in the welcome screen (main menu)
        const welcomeScreen = document.getElementById('welcome-screen');
        const isInMainMenu = welcomeScreen && welcomeScreen.style.display !== 'none';
        
        // Skip handling most keys when in main menu except for game start (Enter key)
        if (isInMainMenu && event.key !== 'Enter') {
            return;
        }
        
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
            // Visual indication for debug purposes
            const coordsDiv = document.getElementById('coordinates');
            if (coordsDiv) {
                coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
            }
        }
        // Only allow hyperspace if not on Earth's surface and not in main menu
        if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !isEarthSurfaceActive && !isInMainMenu) {
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
            } else if (isEarthSurfaceActive) {
                console.log('ESC pressed - exiting Earth surface');
                exitEarthSurface();
            }
        }
    });

    // Keyup event listener
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
            // Reset visual indication
            const coordsDiv = document.getElementById('coordinates');
            if (coordsDiv) {
                coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
            }
        }
    });
}

/**
 * Returns whether hyperspace is currently active
 * @returns {boolean} - Hyperspace active state
 */
export function getHyperspaceState() {
    return isHyperspaceActive;
}

/**
 * Returns whether boost is currently active
 * @returns {boolean} - Boost active state
 */
export function getBoostState() {
    return isBoosting;
}

/**
 * Returns whether space key is currently pressed
 * @returns {boolean} - Space key state
 */
export function getSpaceKeyState() {
    return isSpacePressed;
}

/**
 * Resets the initialized state (useful for test/debug)
 */
export function resetControlsInitialized() {
    controlsInitialized = false;
}

// Export keys object to maintain compatibility with existing code
export { keys }; 










