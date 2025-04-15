// src/ui.js

////////// GENERAL APPEARANCE//////////

export const planetaryBlue = '#4fc3f7';

////////// CONTROLS DROPDOWN //////////

// Controls Dropdown (press Enter prompt in top left corner)
export function setupControlsDropdown() {
    const controlsPrompt = document.getElementById('controls-prompt');
    const controlsDropdown = document.getElementById('controls-dropdown');
    
    if (!controlsPrompt || !controlsDropdown) return;
    
    // Hide controls prompt on welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen && welcomeScreen.style.display !== 'none') {
        controlsPrompt.style.display = 'none';
    }
}

// Toggle controls dropdown between visible and hidden
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

// Edit controls dropdown content based on current scene (space vs surface)
export function updateControlsDropdown(isEarthSurfaceActive, isMoonSurfaceActive) {
    
    console.log(`updateControlsDropdown called: EarthActive=${isEarthSurfaceActive}, MoonActive=${isMoonSurfaceActive}`); // Log input state
    const controlsDropdown = document.getElementById('controls-dropdown');
    if (!controlsDropdown) {
        console.error('Controls dropdown element not found!');
        return;
    }

    // Select the <p> tag using its class
    const hyperspaceOption = controlsDropdown.querySelector('.hyperspace-option');

    if (hyperspaceOption) {
        console.log('Found hyperspace option element:', hyperspaceOption); // Log element found
        const shouldHide = isEarthSurfaceActive || isMoonSurfaceActive;
        console.log(`Should hide hyperspace? ${shouldHide}`); // Log calculated hide state

        console.log('Hyperspace option display BEFORE:', hyperspaceOption.style.display); // Log style before

        // Use style.display for <p> elements
        hyperspaceOption.style.display = shouldHide ? 'none' : 'block';

        console.log('Hyperspace option display AFTER:', hyperspaceOption.style.display); // Log style after
    } else {
        console.warn('Hyperspace option element (.hyperspace-option) not found inside #controls-dropdown'); // Log if not found
    }
}

// Show controls prompt when game starts
export function showControlsPrompt() {
    const controlsPrompt = document.getElementById('controls-prompt');
    if (controlsPrompt) {
        controlsPrompt.style.display = 'block';
    }
}


///// EXPLORATION / CELESTIAL BODY INFO /////

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

// Create the info box design
export const planetInfoBox = document.createElement('div');
planetInfoBox.className = 'planet-info-box';
planetInfoBox.style.position = 'absolute';
planetInfoBox.style.fontFamily = 'Orbitron, sans-serif';
planetInfoBox.style.fontSize = '16px';
planetInfoBox.style.color = 'white';
planetInfoBox.style.backgroundColor = 'rgba(1, 8, 36, 0.8)';
planetInfoBox.style.border = `2px solid ${planetaryBlue}`;
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

// Create the exploration counter design
export const explorationCounter = document.createElement('div');
explorationCounter.className = 'exploration-counter';
explorationCounter.style.position = 'fixed';
explorationCounter.style.top = '20px';
explorationCounter.style.right = '20px';
explorationCounter.style.padding = '10px 15px';
explorationCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
explorationCounter.style.color = planetaryBlue;
explorationCounter.style.fontFamily = 'Orbitron, sans-serif';
explorationCounter.style.fontSize = '16px';
explorationCounter.style.borderRadius = '5px';
explorationCounter.style.border = `1px solid ${planetaryBlue}`;
explorationCounter.style.zIndex = '1000';
explorationCounter.style.display = 'none'; // Initially hidden until game starts


///// Special Countdown Indicators for Enterable Objects /////

// Earth
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

// Moon
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
moonDistanceIndicator.style.zIndex = '9998'; // Ensure it's always just below the earth distance indicator
document.body.appendChild(moonDistanceIndicator);


///// Surface Message / Button Prompts /////
export const moonMsg = document.createElement('div');
moonMsg.id = 'moon-surface-message';
moonMsg.style.position = 'fixed';
moonMsg.style.top = '20px';
moonMsg.style.right = '20px';
moonMsg.style.color = '#b3e5fc'; // Changed from white to light blue
moonMsg.style.fontFamily = 'Orbitron, sans-serif';
moonMsg.style.fontSize = '16px';
moonMsg.style.padding = '10px';
moonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
moonMsg.style.borderRadius = '5px';
moonMsg.style.zIndex = '9999';
moonMsg.style.boxShadow = '0 0 10px rgba(79, 195, 247, 0.3)'; // Added subtle blue glow
moonMsg.style.border = '1px solid rgba(79, 195, 247, 0.3)'; // Added subtle border
moonMsg.innerHTML = 'MOON SURFACE<br>Press ESC to return to space<br>Press R to reset position';
