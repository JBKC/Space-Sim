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
        controlsPrompt.textContent = 'Press Enter to hide controls';
    } else {
        controlsDropdown.style.display = 'none';
        controlsPrompt.textContent = 'Press Enter to view controls';
    }
}

// Update controls dropdown content based on current scene
export function updateControlsDropdown(isEarthSurfaceActive) {
    const controlsDropdown = document.getElementById('controls-dropdown');
    if (!controlsDropdown) return;
    
    const hyperspaceOption = controlsDropdown.querySelector('.hyperspace-option');
    if (hyperspaceOption) {
        // Hide the hyperspace option when on Earth's surface
        hyperspaceOption.style.display = isEarthSurfaceActive ? 'none' : 'block';
    }
}

// Show controls prompt when game starts
export function showControlsPrompt() {
    const controlsPrompt = document.getElementById('controls-prompt');
    if (controlsPrompt) {
        controlsPrompt.style.display = 'block';
    }
}

export function showRaceModeUI() {
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    if (scoreElement) scoreElement.style.display = 'block';
    if (timerElement) timerElement.style.display = 'block';
}

export function hideRaceModeUI() {
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    if (scoreElement) scoreElement.style.display = 'none';
    if (timerElement) timerElement.style.display = 'none';
}

export function setupDirectionalIndicator() {
    let arrowIndicator = document.getElementById('arrow-indicator');
    if (!arrowIndicator) {
        arrowIndicator = document.createElement('div');
        arrowIndicator.id = 'arrow-indicator';
        arrowIndicator.style.position = 'absolute';
        arrowIndicator.style.width = '60px';
        arrowIndicator.style.height = '60px';
        arrowIndicator.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%2300B7FF\'><path d=\'M12 2L4 14h16L12 2z\'/></svg>")';
        arrowIndicator.style.backgroundSize = 'contain';
        arrowIndicator.style.backgroundRepeat = 'no-repeat';
        arrowIndicator.style.pointerEvents = 'none';
        arrowIndicator.style.zIndex = '1005';
        arrowIndicator.style.display = 'none';
        document.body.appendChild(arrowIndicator);
    }

    let goldenArrowIndicator = document.getElementById('golden-arrow-indicator');
    if (!goldenArrowIndicator) {
        goldenArrowIndicator = document.createElement('div');
        goldenArrowIndicator.id = 'golden-arrow-indicator';
        goldenArrowIndicator.style.position = 'absolute';
        goldenArrowIndicator.style.width = '30px';
        goldenArrowIndicator.style.height = '30px';
        goldenArrowIndicator.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ffd700\'><path d=\'M12 2L4 14h16L12 2z\'/></svg>")';
        goldenArrowIndicator.style.backgroundSize = 'contain';
        goldenArrowIndicator.style.backgroundRepeat = 'no-repeat';
        goldenArrowIndicator.style.pointerEvents = 'none';
        goldenArrowIndicator.style.zIndex = '1005';
        goldenArrowIndicator.style.display = 'none';
        document.body.appendChild(goldenArrowIndicator);
    }
}

let previousAngle = 0;
const smoothingFactor = 0.1;

export function updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera) {
    const arrowIndicator = document.getElementById('arrow-indicator');
    const goldenArrowIndicator = document.getElementById('golden-arrow-indicator');

    if (!arrowIndicator || !goldenArrowIndicator || targets.length === 0 || challengeComplete) {
        if (arrowIndicator) arrowIndicator.style.display = 'none';
        if (goldenArrowIndicator) goldenArrowIndicator.style.display = 'none';
        return;
    }

    const nextTarget = targets[0];
    const isFinalTarget = (score === challengeTargetCount - 1);
    const activeIndicator = isFinalTarget ? goldenArrowIndicator : arrowIndicator;
    const inactiveIndicator = isFinalTarget ? arrowIndicator : goldenArrowIndicator;

    inactiveIndicator.style.display = 'none';

    const targetPosition = nextTarget.position.clone();
    const vector = targetPosition.project(camera);

    const x = (vector.x + 1) / 2 * window.innerWidth;
    const y = -(vector.y - 1) / 2 * window.innerHeight;

    const margin = 50;
    const isOnScreen = (
        x >= -margin &&
        x <= window.innerWidth + margin &&
        y >= -margin &&
        y <= window.innerHeight + margin &&
        vector.z < 1
    );

    if (isOnScreen) {
        activeIndicator.style.display = 'none';
    } else {
        activeIndicator.style.display = 'block';

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        let targetAngle = Math.atan2(y - centerY, x - centerX);

        const normalizeAngle = (angle) => {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        };

        targetAngle = normalizeAngle(targetAngle);
        const prevAngleNormalized = normalizeAngle(previousAngle);

        let angleDiff = targetAngle - prevAngleNormalized;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const smoothedAngle = prevAngleNormalized + angleDiff * smoothingFactor;
        previousAngle = smoothedAngle;

        const radius = Math.min(window.innerWidth, window.innerHeight) / 2 - 30;
        const edgeX = centerX + Math.cos(smoothedAngle) * radius;
        const edgeY = centerY + Math.sin(smoothedAngle) * radius;

        activeIndicator.style.left = (edgeX - 15) + 'px';
        activeIndicator.style.top = (edgeY - 15) + 'px';
        activeIndicator.style.transform = `rotate(${smoothedAngle + Math.PI / 2}rad)`;
    }
}

// Add the missing updateUI function
export function updateUI() {
    // Update any UI elements that need to be refreshed each frame
    // Currently empty as we don't have any UI elements that need constant updates
    // This function is called in the animation loop for future UI updates
}