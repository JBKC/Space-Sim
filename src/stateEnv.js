// State management for Environments

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
    }
    return isEarthSurfaceActive;
}

export function setMoonSurfaceActive(active) {
    isMoonSurfaceActive = active;

    if (active) {
        moonTransition = false;
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
