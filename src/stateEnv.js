// Simple state management for environment states

// Surface activity states
let spaceInitialized = false;
let isEarthSurfaceActive = false;
let isMoonSurfaceActive = false;

// Initialization states
let earthInitialized = false;
let moonInitialized = false;

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

// Get initialization states
export function getEarthInitialized() {
    return earthInitialized;
}

export function getMoonInitialized() {
    return moonInitialized;
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

// Set initialization states
export function setEarthInitialized(initialized) {
    earthInitialized = initialized;
    return earthInitialized;
}

export function setMoonInitialized(initialized) {
    moonInitialized = initialized;
    return moonInitialized;
}
