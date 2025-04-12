// Simple state management for environment states

// Surface activity states
let isEarthSurfaceActive = false;
let isMoonSurfaceActive = false;
let spaceInitialized = false;

// Get current surface states
export function getEarthSurfaceActive() {
    return isEarthSurfaceActive;
}

export function getMoonSurfaceActive() {
    return isMoonSurfaceActive;
}

export function getSpaceInitialized() {
    return spaceInitialized;
}

// Set surface states
export function setEarthSurfaceActive(active) {
    isEarthSurfaceActive = active;
    return isEarthSurfaceActive;
}

export function setMoonSurfaceActive(active) {
    isMoonSurfaceActive = active;
    return isMoonSurfaceActive;
}

export function setSpaceInitialized(initialized) {
    spaceInitialized = initialized;
    return spaceInitialized;
}
