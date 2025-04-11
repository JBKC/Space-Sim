// src/ui.js
export function setupUIElements() {
    let scoreElement = document.getElementById('score');
    if (!scoreElement) {
        scoreElement = document.createElement('div');
        scoreElement.id = 'score';
        scoreElement.style.position = 'absolute';
        scoreElement.style.top = '20px';
        scoreElement.style.left = '20px';
        scoreElement.style.color = 'white';
        scoreElement.style.fontFamily = 'Orbitron, Arial, sans-serif';
        scoreElement.style.fontSize = '24px';
        scoreElement.style.fontWeight = 'bold';
        scoreElement.style.zIndex = '1001';
        scoreElement.style.display = 'none'; // Hidden by default
        document.body.appendChild(scoreElement);
    }

    let timerElement = document.getElementById('timer');
    if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.id = 'timer';
        timerElement.style.position = 'absolute';
        timerElement.style.top = '55px';
        timerElement.style.left = '20px';
        timerElement.style.color = 'white';
        timerElement.style.fontFamily = 'Orbitron, Arial, sans-serif';
        timerElement.style.fontSize = '24px';
        timerElement.style.fontWeight = 'bold';
        timerElement.style.zIndex = '1001';
        timerElement.style.display = 'none'; // Hidden by default
        document.body.appendChild(timerElement);
    }

    // Create glow overlays
    let glowOverlay = document.getElementById('glow-overlay');
    if (!glowOverlay) {
        glowOverlay = document.createElement('div');
        glowOverlay.id = 'glow-overlay';
        glowOverlay.style.position = 'fixed';
        glowOverlay.style.top = '0';
        glowOverlay.style.left = '0';
        glowOverlay.style.width = '100%';
        glowOverlay.style.height = '100%';
        glowOverlay.style.backgroundColor = 'rgba(0, 183, 255, 0.2)';
        glowOverlay.style.opacity = '0';
        glowOverlay.style.transition = 'opacity 0.3s';
        glowOverlay.style.pointerEvents = 'none';
        glowOverlay.style.zIndex = '1000';
        document.body.appendChild(glowOverlay);
    }
    
    // Setup controls dropdown
    setupControlsDropdown();
}

// Setup controls dropdown functionality
function setupControlsDropdown() {
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
