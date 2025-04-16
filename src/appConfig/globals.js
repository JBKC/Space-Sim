/**
 * globals.js - Central place to store global references to key objects
 * 
 * This allows components to access key objects without circular dependencies.
 * Used by stateEnv.js to access spacecraft and camera for view toggling.
 */

// Store references to key objects
export const globals = {
    spacecraft: null,
    camera: null,
    setSpacecraft(ref) {
        this.spacecraft = ref;
        // Also set on window for backward compatibility
        window.spacecraft = ref;
        return ref;
    },
    setCamera(ref) {
        this.camera = ref;
        // Also set on window for backward compatibility
        window.camera = ref;
        return ref;
    }
};

// Helper functions to easily set and get global references
export function setGlobalSpacecraft(spacecraft) {
    return globals.setSpacecraft(spacecraft);
}

export function setGlobalCamera(camera) {
    return globals.setCamera(camera);
}

export function getGlobalSpacecraft() {
    return globals.spacecraft;
}

export function getGlobalCamera() {
    return globals.camera;
} 