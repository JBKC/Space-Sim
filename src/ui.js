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
        // Check if the welcome screen is currently displayed
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen && welcomeScreen.style.display !== 'none') {
            return; // Do nothing if the welcome screen is visible
        }

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

let previousAngle = 0;
const smoothingFactor = 0.1;

export function initUI(startGameCallback) {
    const welcomeScreen = document.getElementById('welcome-screen');
    const exploreButton = document.getElementById('explore-button');
    const controlsPrompt = document.getElementById('controls-prompt');
    const controlsDropdown = document.getElementById('controls-dropdown');

    // --- Welcome screen button --- 
    if (exploreButton && welcomeScreen) {
        exploreButton.addEventListener('click', () => {
            startGameCallback('free'); // Use the passed callback
            welcomeScreen.style.display = 'none';
            if (controlsPrompt) controlsPrompt.style.display = 'block'; // Show prompt after start
            console.log('Explore button clicked, starting game.');
        });
    }

    // --- Controls Dropdown Toggle (Enter Key) --- 
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Check if welcome screen is visible
            if (welcomeScreen && welcomeScreen.style.display !== 'none') {
                console.log('Enter pressed, but welcome screen is visible. Ignoring.');
                return; // Do nothing if welcome screen is up
            }
            
            // Toggle dropdown if welcome screen is hidden
            if (controlsDropdown) {
                const isVisible = controlsDropdown.style.display === 'block';
                controlsDropdown.style.display = isVisible ? 'none' : 'block';
                console.log(`Enter pressed, toggling controls dropdown to ${isVisible ? 'hidden' : 'visible'}`);
            }
        }
    });

    // --- Controls Dropdown Toggle (Click Prompt) ---
    if (controlsPrompt && controlsDropdown) {
        controlsPrompt.addEventListener('click', () => {
            const isVisible = controlsDropdown.style.display === 'block';
            controlsDropdown.style.display = isVisible ? 'none' : 'block';
            console.log(`Controls prompt clicked, toggling controls dropdown to ${isVisible ? 'hidden' : 'visible'}`);
        });
    }
}
