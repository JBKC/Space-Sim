// src/ui.js

// Setup controls dropdown functionality
export function setupControlsDropdown() {
    const controlsPrompt = document.getElementById('controls-prompt');
    const controlsDropdown = document.getElementById('controls-dropdown');
    
    if (!controlsPrompt || !controlsDropdown) return;
    
    // Hide controls prompt on welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen && welcomeScreen.style.display !== 'none') {
        controlsPrompt.style.display = 'none';
    }
    
    // Toggle dropdown on Enter key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            toggleControlsDropdown();
        }
    });
    
    // Toggle dropdown when clicking the prompt
    controlsPrompt.addEventListener('click', toggleControlsDropdown);
}

// Export the toggle function to be accessible from other modules
export function toggleControlsDropdown() {
    const controlsDropdown = document.getElementById('controls-dropdown');
    const controlsPrompt = document.getElementById('controls-prompt');
    if (!controlsDropdown || !controlsPrompt) return;
    
    if (controlsDropdown.style.display === 'none' || controlsDropdown.style.display === '') {
        controlsDropdown.style.display = 'block';
        controlsDropdown.style.zIndex = '10000'; // Ensure it's above everything else
        controlsPrompt.textContent = 'Press Enter to hide controls';
        
        // Log for debugging
        console.log('Controls dropdown visibility: ', controlsDropdown.style.display);
        console.log('Controls dropdown z-index: ', controlsDropdown.style.zIndex);
        console.log('Controls dropdown position: ', controlsDropdown.style.position);
    } else {
        controlsDropdown.style.display = 'none';
        controlsPrompt.textContent = 'Press Enter to view controls';
    }
}

// Update controls dropdown content based on current scene
export function updateControlsDropdown(isEarthSurfaceActive, isMoonSurfaceActive) {
    const controlsDropdown = document.getElementById('controls-dropdown');
    if (!controlsDropdown) return;
    
    const hyperspaceOption = controlsDropdown.querySelector('.hyperspace-option');
    if (hyperspaceOption) {
        // Hide hyperspace option when on Earth's or Moon's surface
        hyperspaceOption.style.display = (isEarthSurfaceActive || isMoonSurfaceActive) ? 'none' : 'block';
    }
    
}

// Show controls prompt when game starts
export function showControlsPrompt() {
    const controlsPrompt = document.getElementById('controls-prompt');
    if (controlsPrompt) {
        controlsPrompt.style.display = 'block';
    }
}


// ===============================
// PLANET AND SPACE UI ELEMENTS
// ===============================

// Create the planet info box
export const planetInfoBox = document.createElement('div');
planetInfoBox.className = 'planet-info-box';
planetInfoBox.style.position = 'absolute';
planetInfoBox.style.fontFamily = 'Orbitron, sans-serif';
planetInfoBox.style.fontSize = '16px';
planetInfoBox.style.color = 'white';
planetInfoBox.style.backgroundColor = 'rgba(1, 8, 36, 0.8)';
planetInfoBox.style.border = '2px solid #4fc3f7';
planetInfoBox.style.borderRadius = '5px';
planetInfoBox.style.padding = '15px';
planetInfoBox.style.width = '320px';
planetInfoBox.style.pointerEvents = 'none';
planetInfoBox.style.zIndex = '1000';
planetInfoBox.style.display = 'none'; // Hidden by default
// Ensure the box isn't positioned off-screen initially
planetInfoBox.style.right = '';
planetInfoBox.style.left = '';
planetInfoBox.style.top = '';
document.body.appendChild(planetInfoBox);

// Create the planet labels container array
export const labels = [];

// Create the Earth distance indicator
export const earthDistanceIndicator = document.createElement('div');
earthDistanceIndicator.className = 'distance-indicator';
earthDistanceIndicator.style.color = 'white';
earthDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
earthDistanceIndicator.style.fontSize = '18px';
earthDistanceIndicator.style.textAlign = 'center';
earthDistanceIndicator.style.position = 'absolute';
earthDistanceIndicator.style.display = 'none'; // Initially hidden
earthDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
earthDistanceIndicator.style.padding = '5px 10px';
earthDistanceIndicator.style.borderRadius = '5px';
earthDistanceIndicator.style.zIndex = '9999'; // Ensure it's on top of other elements
document.body.appendChild(earthDistanceIndicator);

// Create the Moon distance indicator
export const moonDistanceIndicator = document.createElement('div');
moonDistanceIndicator.className = 'distance-indicator';
moonDistanceIndicator.style.color = 'white';
moonDistanceIndicator.style.fontFamily = 'Orbitron, sans-serif';
moonDistanceIndicator.style.fontSize = '18px';
moonDistanceIndicator.style.textAlign = 'center';
moonDistanceIndicator.style.position = 'absolute';
moonDistanceIndicator.style.display = 'none'; // Initially hidden
moonDistanceIndicator.style.backgroundColor = 'rgba(1, 8, 36, 0.6)';
moonDistanceIndicator.style.padding = '5px 10px';
moonDistanceIndicator.style.borderRadius = '5px';
moonDistanceIndicator.style.zIndex = '9998'; // Just below Earth indicator
document.body.appendChild(moonDistanceIndicator);

// Variable to track the last hovered planet
export let lastHoveredPlanet = null;

// Add a createPlanetLabel function to centralize label creation
export function createPlanetLabel(planetName, planetGroup, radius) {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planetName;
    
    // Hide Star Destroyer and Lucrehulk labels visually while keeping them in the DOM
    if (planetName === 'Imperial Star Destroyer' || planetName === 'Lucrehulk') {
        label.style.opacity = '0'; // Make invisible but keep it in the DOM for positioning
        label.style.pointerEvents = 'none'; // Ensure it doesn't interfere with interaction
    }
    
    document.body.appendChild(label); // Add to DOM
    
    labels.push({
        element: label,
        planetGroup: planetGroup,
        radius: radius
    });
    
    return label;
}

// ===============================
// PLANET INFO DATA
// ===============================

// Create data for popups on all celestial objects
export const planetInfo = {
    'mercury': {
        composition: 'Metallic core, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '38% of Earth'
    },
    'venus': {
        composition: 'Rocky, iron core',
        atmosphere: 'Thick CO₂, sulfuric acid',
        gravity: '90% of Earth'
    },
    'earth': {
        composition: 'Iron core, silicate mantle',
        atmosphere: 'Nitrogen, oxygen',
        gravity: '9.81 m/s²'
    },
    'moon': {
        composition: 'Rocky, silicate crust',
        atmosphere: 'Thin exosphere',
        gravity: '16% of Earth'
    },
    'mars': {
        composition: 'Rocky, iron-nickel core',
        atmosphere: 'Thin CO₂',
        gravity: '38% of Earth'
    },
    'asteroid belt': {
        composition: 'Silicate rock, metals, carbon',
        atmosphere: 'None (vacuum of space)',
        gravity: 'Negligible'
    },
    'jupiter': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Dynamic storms',
        gravity: '250% of Earth'
    },
    'saturn': {
        composition: 'Hydrogen, helium',
        atmosphere: 'Fast winds, methane',
        gravity: '107% of Earth'
    },
    'uranus': {
        composition: 'Icy, hydrogen, helium',
        atmosphere: 'Methane haze',
        gravity: '89% of Earth'
    },
    'neptune': {
        composition: 'Icy, rocky core',
        atmosphere: 'Methane clouds',
        gravity: '114% of Earth'
    },
    'imperial star destroyer': {
        affiliation: 'Galactic Empire',
        manufacturer: 'Kuat Drive Yards',
        crew: '40,000'
    },
    'lucrehulk': {
        affiliation: 'Confederacy of Independent Systems',
        manufacturer: 'Hoersch-Kessel Drive',
        crew: '200,000'
    }
};

// ===============================
// EXPLORATION TRACKER
// ===============================

// Define all celestial objects that can be discovered
export const celestialObjects = [
    'mercury',
    'venus',
    'earth',
    'moon',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'imperial star destroyer', // Counts as one object total
    'lucrehulk'
];

// Create exploration counter (number of celestial objects discovered)
export const explorationCounter = document.createElement('div');
explorationCounter.className = 'exploration-counter';
explorationCounter.style.position = 'fixed';
explorationCounter.style.top = '20px';
explorationCounter.style.right = '20px';
explorationCounter.style.padding = '10px 15px';
explorationCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
explorationCounter.style.color = '#4fc3f7';
explorationCounter.style.fontFamily = 'Orbitron, sans-serif';
explorationCounter.style.fontSize = '16px';
explorationCounter.style.borderRadius = '5px';
explorationCounter.style.border = '1px solid #4fc3f7';
explorationCounter.style.zIndex = '1000';
explorationCounter.style.display = 'none'; // Initially hidden until game starts
document.body.appendChild(explorationCounter);

// Initialize explored objects - resets every time
let exploredObjects = {};

// Initialize with all objects unexplored
export function resetExploredObjects() {
    celestialObjects.forEach(object => {
        exploredObjects[object] = false;
    });
    updateExplorationCounter();
}

// Function to mark an object as explored
export function markAsExplored(objectName) {
    if (objectName && !exploredObjects[objectName]) {
        exploredObjects[objectName] = true;
        updateExplorationCounter();
    }
}

// Update the exploration counter display
export function updateExplorationCounter() {
    const count = Object.values(exploredObjects).filter(Boolean).length;
    const total = Object.keys(exploredObjects).length;
    explorationCounter.innerHTML = `Celestial Objects Discovered: <span style="color: white; font-weight: bold;">${count}/${total}</span>`;
    
    // Check if all objects have been explored
    if (count === total) {
        // All objects explored - permanent blue glow effect
        explorationCounter.style.boxShadow = '0 0 15px 5px #4fc3f7';
        explorationCounter.style.border = '2px solid #4fc3f7';
        explorationCounter.style.backgroundColor = 'rgba(0, 20, 40, 0.8)';
        // Add a congratulatory message
        explorationCounter.innerHTML = `<span style="color: #4fc3f7; font-weight: bold;">ALL CELESTIAL OBJECTS DISCOVERED</span>`;
    } 
    // Otherwise, add temporary visual flourish when a new object is discovered
    else if (count > 0) {
        explorationCounter.style.boxShadow = '0 0 10px #4fc3f7';
        setTimeout(() => {
            // Only remove the glow if we haven't completed everything
            if (Object.values(exploredObjects).filter(Boolean).length !== total) {
                explorationCounter.style.boxShadow = 'none';
            }
        }, 2000);
    }
}
