// Handles keyboard inputs and keyboard-related states

// Define keys object here instead of importing from movement.js
export const keys = { 
    w: false, 
    s: false, 
    a: false, 
    d: false, 
    left: false, 
    right: false, 
    up: false, 
    down: false, 
    space: false,
    shift: false,
    c: false 
};

let controlsInitialized = false;
// State tracking
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;

/**
 * Activates hyperspace mode if conditions are met
 * @param {boolean} isEarthSurfaceActive - Whether earth surface mode is active
 * @param {boolean} isMoonSurfaceActive - Whether moon surface mode is active
 */
function activateHyperspace(isEarthSurfaceActive, isMoonSurfaceActive) {
    // Don't activate hyperspace on planet surfaces
    if (!isHyperspace && !isEarthSurfaceActive && !isMoonSurfaceActive) {
        isHyperspace = true;
        console.log("Hyperspace activated!");
        setTimeout(deactivateHyperspace, 2000);
    }
}

/**
 * Deactivates hyperspace mode
 */
function deactivateHyperspace() {
    if (isHyperspace) {
        isHyperspace = false;
    }
}

/**
 * Set hyperspace state
 * @param {boolean} state - New hyperspace state
 */
export function setHyperspaceState(state) {
    isHyperspace = !!state; // Convert to boolean
    return isHyperspace;
}

/**
 * Reset all key states to false
 */
export function resetKeyStates() {
    keys.w = false;
    keys.s = false;
    keys.a = false;
    keys.d = false;
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
    keys.space = false;
    keys.shift = false;
    keys.c = false;
}

/**
 * Initialize event listeners
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
            case 'Shift': keys.shift = true; break;
            case 'c': case 'C': keys.c = true; break;
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
            case 'c': keys.c = false; break;
        }
    });

    // Add hyperspace activation on Shift key
    window.addEventListener('keydown', (event) => {
        // Only activate hyperspace if not on Earth's surface
        if (event.key === 'Shift' && !isEarthSurfaceActive) {
            activateHyperspace(isEarthSurfaceActive, isMoonSurfaceActive);
        }
    });

    // ** No keyUp event for hyperspace - we want it last a set time, rather than stopping when key is released **
    
    controlsInitialized = true;
    return true;
}


 // Sets up the control dependencies (dependency injection)
/**
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
 * @param {Function} dependencies.toggleCameraView - Function to toggle camera view
 */

///// ASSIGN CONTROLS TO KEYS /////
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
        startHyperspace,
        toggleCameraView
    } = dependencies;
    
    // Main keydown event listener for game controls
    document.addEventListener('keydown', (event) => {
        // Check if we're in the welcome screen (main menu)
        const welcomeScreen = document.getElementById('welcome-screen');
        const isInMainMenu = welcomeScreen && welcomeScreen.style.display !== 'none';
        
        // Skip handling most keys when in main menu except
        if (isInMainMenu) {
            return;
        }

        // BOOSTING
        if (event.code === 'ArrowUp') {
            isBoosting = true;
            }
       
        // HYPERSPACE
        if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !isEarthSurfaceActive && !isInMainMenu) {
            startHyperspace();
        }

        // CHANGE VIEW 3RD / 1ST PERSON
        if (event.code === 'KeyC') {
            console.log('===== TOGGLE COCKPIT VIEW =====');
            
            // Earth scene
            if (isEarthSurfaceActive && earthSpacecraft) {
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

        // Reset position in Earth surface mode
        if (event.code === 'KeyR' && isEarthSurfaceActive) {
            console.log('R pressed - resetting position');
            resetEarthPosition();
        }
        // Reset position in Moon surface mode
        if (event.code === 'KeyR' && isMoonSurfaceActive) {
            console.log('R pressed - resetting position');
            resetMoonPosition();
        }
        
        // Enhanced ESC key to exit Moon surface or Earth surface
        if (event.code === 'Escape') {
            if (isEarthSurfaceActive) {
                console.log('ESC pressed - exiting surface');
                exitEarthSurface();
            } else if (isMoonSurfaceActive) {
                console.log('ESC pressed - exiting surface');
                exitMoonSurface();
            }
        }
    });

    // Keyup listener for boosting (lasts as long as it's pressed down)
    document.addEventListener('keyup', (event) => {

        if (event.code === 'ArrowUp') {
            isBoosting = false;
        }
    });
}

/**
 * Returns whether hyperspace is currently active
 * @returns {boolean} - Hyperspace active state
 */
export function getHyperspaceState() {
    return isHyperspace;
}

/**
 * Returns whether boost is currently active
 * @returns {boolean} - Boost active state
 */
export function getBoostState() {
    return isBoosting;
}


/**
 * Resets the initialized state (useful for test/debug)
 */
export function resetControlsInitialized() {
    controlsInitialized = false;
}











