// controls.js - Handles all keyboard input operations for the game

// Import keys object from movement.js to maintain shared state across files
import { keys } from './movement.js';

// Flag to track if controls have been initialized
let controlsInitialized = false;

// Hyperspace functionality 
let isHyperspaceActive = false;

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
            case 'ArrowDown': keys.down = false; break;
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
 * Returns whether hyperspace is currently active
 * @returns {boolean} - Hyperspace active state
 */
export function getHyperspaceState() {
    return isHyperspaceActive;
}

/**
 * Resets the initialized state (useful for test/debug)
 */
export function resetControlsInitialized() {
    controlsInitialized = false;
}

// Export keys object to maintain compatibility with existing code
export { keys }; 