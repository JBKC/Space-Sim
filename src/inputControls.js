// Handles keyboard inputs and keyboard-related states
// STATE BASED APPROACH - meaning that variables are locally set and updated here, rather than passed around to individual scripts

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
    c: false,
    r: false,
    escape: false
};

// Previous key states to detect changes
const prevKeys = { ...keys };

let controlsInitialized = false;

// State tracking
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;
let isViewToggleRequested = false;
let isResetPositionRequested = false;
let isExitSurfaceRequested = false;


///// HYPERSPACE FUNCTIONS /////

/**
 * Set hyperspace state GLOBALLY by calling this function
 * @param {boolean} state - New hyperspace state
 */
export function setHyperspaceState(state) {
    isHyperspace = !!state; // Convert to boolean
    return isHyperspace;
}

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
 * Deactivates hyperspace automatically after timeout
 */
function deactivateHyperspace() {
    if (isHyperspace) {
        isHyperspace = false;
    }
}

///// GENERAL INPUT INITIALIZATION /////

/**
 * Reset all key states to false - used by movement.js
 */
export function resetKeyStates() {
    Object.keys(keys).forEach(key => {
        keys[key] = false;
        prevKeys[key] = false;
    });
    
    // Reset action flags
    isViewToggleRequested = false;
    isResetPositionRequested = false;
    isExitSurfaceRequested = false;
}

/**
 * Update the prevKeys object to match the current keys state
 * Ensures that a key press is registed as a one-time action
 */
export function updatePreviousKeyStates() {
    Object.keys(keys).forEach(key => {
        prevKeys[key] = keys[key];
    });
    
    // Reset one-time action flags
    isViewToggleRequested = false;
    isResetPositionRequested = false;
    isExitSurfaceRequested = false;
}

/**
 * Initialize event listeners - i.e. intialize the input controls
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
        
        // Check if we're in the welcome screen (main menu)
        const welcomeScreen = document.getElementById('welcome-screen');
        const isInMainMenu = welcomeScreen && welcomeScreen.style.display !== 'none';
        
        // Skip handling most keys when in main menu
        if (isInMainMenu) {
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case 'w': keys.w = true; break;
            case 's': keys.s = true; break;
            case 'a': keys.a = true; break;
            case 'd': keys.d = true; break;
            case 'arrowleft': keys.left = true; break;
            case 'arrowright': keys.right = true; break;
            case 'arrowup': 
                keys.up = true; 
                isBoosting = true;
                break;
            case 'arrowdown': keys.down = true; break;
            case ' ': 
                keys.space = true; 
                isSpacePressed = true;
                break;
            case 'shift': 
                keys.shift = true; 
                if (!isEarthSurfaceActive && !isInMainMenu) {
                    activateHyperspace(isEarthSurfaceActive, isMoonSurfaceActive);
                }
                break;
            case 'c': 
                keys.c = true; 
                // Only trigger the view toggle on initial key press
                if (!prevKeys.c) {
                    isViewToggleRequested = true;
                    console.log('View toggle requested');
                }
                break;
            case 'r': 
                keys.r = true; 
                // Only trigger reset on initial key press
                if (!prevKeys.r) {
                    isResetPositionRequested = true;
                    console.log('Reset position requested');
                }
                break;
            case 'escape': 
                keys.escape = true; 
                // Only trigger exit on initial key press
                if (!prevKeys.escape) {
                    isExitSurfaceRequested = true;
                    console.log('Exit surface requested');
                }
                break;
        }
    });

    // Track when keys are released (keyup)
    document.addEventListener('keyup', (event) => {
        if (!keys) return;
        switch (event.key.toLowerCase()) {
            case 'w': keys.w = false; break;
            case 's': keys.s = false; break;
            case 'a': keys.a = false; break;
            case 'd': keys.d = false; break;
            case 'arrowleft': keys.left = false; break;
            case 'arrowright': keys.right = false; break;
            case 'arrowup': 
                keys.up = false; 
                isBoosting = false;
                break;
            case 'arrowdown': keys.down = false; break;
            case ' ': 
                keys.space = false; 
                isSpacePressed = false;
                break;
            case 'shift': keys.shift = false; break;
            case 'c': keys.c = false; break;
            case 'r': keys.r = false; break;
            case 'escape': keys.escape = false; break;
        }
    });
    
    controlsInitialized = true;
    return true;
}


///// FUNCTIONS THAT CHECK AND RETURN INPUT STATE /////

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
 * Returns whether view toggle was requested this frame (3rd / 1st person)
 * @returns {boolean} - View toggle request state
 */
export function getViewToggleRequested() {
    return isViewToggleRequested;
}

/**
 * Returns whether a position reset (R) was requested this frame (applicable to planet surfaces)
 * @returns {boolean} - Position reset request state
 */
export function getResetPositionRequested() {
    return isResetPositionRequested;
}

/**
 * Returns whether an exit surface (Esc) was requested this frame
 * @returns {boolean} - Exit surface request state
 */
export function getExitSurfaceRequested() {
    return isExitSurfaceRequested;
}








