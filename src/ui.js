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


let previousAngle = 0;
const smoothingFactor = 0.1;

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
