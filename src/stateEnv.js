// State management for Environments
import { getGlobalSpacecraft, getGlobalCamera } from './appConfig/globals.js';

// What environment is currently initialized?
let spaceInitialized = false;
let earthInitialized = false;
let moonInitialized = false;

// Are we currently on the surface of a planet?
let isEarthSurfaceActive = false;
let isMoonSurfaceActive = false;

// Do we need a trasition? (true = not on surface, false = already on surface)
let earthTransition = true;
let moonTransition = true;

// Are we currently in first person view?
let isFirstPersonView = false;


////// GET CURRENT STATES //////

export function getSpaceInitialized() {
    return spaceInitialized;
}

export function getEarthInitialized() {
    return earthInitialized;
}

export function getMoonInitialized() {
    return moonInitialized;
}

export function getEarthSurfaceActive() {
    return isEarthSurfaceActive;
}

export function getMoonSurfaceActive() {
    return isMoonSurfaceActive;
}

export function getEarthTransition() {
    return earthTransition;
}

export function getMoonTransition() {
    return moonTransition;
}

export function getFirstPersonView() {
    return isFirstPersonView;
}


////// SET CURRENT STATES //////

export function setSpaceInitialized(initialized) {
    spaceInitialized = initialized;
    return spaceInitialized;
}

export function setEarthInitialized(initialized) {
    earthInitialized = initialized;
    return earthInitialized;
}

export function setMoonInitialized(initialized) {
    moonInitialized = initialized;
    return moonInitialized;
}

export function setEarthSurfaceActive(active) {
    isEarthSurfaceActive = active;

    if (active) {
        earthTransition = false;
        // If entering Earth and in first-person view, schedule a double toggle to fix view
        if (isFirstPersonView) {
            scheduleDoubleViewToggle();
        }
    }
    return isEarthSurfaceActive;
}

export function setMoonSurfaceActive(active) {
    isMoonSurfaceActive = active;

    if (active) {
        moonTransition = false;
        // If entering Moon and in first-person view, schedule a double toggle to fix view
        if (isFirstPersonView) {
            scheduleDoubleViewToggle();
        }
    }
    return isMoonSurfaceActive;
}

// Add setters for transition flags
export function setEarthTransition(value) {
    earthTransition = !!value; // Ensure boolean
    return earthTransition;
}

export function setMoonTransition(value) {
    moonTransition = !!value; // Ensure boolean
    return moonTransition;
}

export function setFirstPersonView(value) {
    isFirstPersonView = !!value; // Ensure boolean
    return isFirstPersonView;
}

export function toggleFirstPersonView() {
    isFirstPersonView = !isFirstPersonView;
    return isFirstPersonView;
}

// FAILSAFE FUNCTION that simulates a double toggle of the view to fix camera issues when entering a planet in first-person view
function scheduleDoubleViewToggle() {
    console.log("Scheduling double key press of 'C' to fix first-person camera position");
    
    // Map for key codes
    const KEY_CODES = { 'c': 67 };
    
    // Helper function to simulate keyboard events
    const simulateKeyEvent = (eventType, key) => {
        const keyCode = KEY_CODES[key.toLowerCase()];
        
        try {
            // Create the event with appropriate properties
            const event = new KeyboardEvent(eventType, {
                bubbles: true,
                cancelable: true,
                key: key,
                code: 'Key' + key.toUpperCase(),
                keyCode: keyCode,
                which: keyCode,
                shiftKey: false,
                ctrlKey: false,
                altKey: false,
                metaKey: false
            });
            
            // Dispatch the event
            document.dispatchEvent(event);
            return true;
        } catch (error) {
            console.error('Error simulating keyboard event:', error);
            return false;
        }
    };
    
    // Helper function to press and release a key
    const pressKey = (key) => {
        return new Promise(resolve => {
            // Press down
            simulateKeyEvent('keydown', key);
            
            // Release after a short delay
            setTimeout(() => {
                simulateKeyEvent('keyup', key);
                resolve();
            }, 100);
        });
    };
    
    // Execute the double toggle
    setTimeout(async () => {
        console.log("⚡ Simulating first 'C' key press to toggle view");
        await pressKey('c');
        
        setTimeout(async () => {
            console.log("⚡ Simulating second 'C' key press to toggle view back");
            await pressKey('c');
            console.log("✅ Double toggle completed");
        }, 100);    // delay between key presses
    }, 1000); // delay after transition starts
}
