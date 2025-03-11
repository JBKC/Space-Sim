// src/main.js
import { scene, camera, renderer, updateStars, spacecraft, updatePlanetLabels } from './setup.js';
import { updateCamera, updateMovement, setGameMode, resetMovementInputs } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;

// Initialize UI elements and directional indicator
setupUIElements();
setupDirectionalIndicator();

// Keydown event listeners for controls
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        startFiring();
    }
    if (event.code === 'ArrowUp') {
        isBoosting = true;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        startHyperspace();
    }
});

// Keyup event listeners for controls
document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        stopFiring();
    }
    if (event.code === 'ArrowUp') {
        isBoosting = false;
    }
});

// Debug logging for spacebar (laser firing)
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        console.log('Space pressed. Game mode:', gameMode);
        if (!gameMode) {
            console.log('Not firing lasers: No game mode selected');
            return;
        }
        console.log('Attempting to fire lasers...');
        try {
            fireLasers();
            console.log('Lasers fired successfully');
        } catch (error) {
            console.error('Error firing lasers:', error);
        }
        isSpacePressed = true;
    }
});

// Initialize game mode selection on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const exploreButton = document.querySelector('#explore-button');
    if (exploreButton) {
        exploreButton.addEventListener('click', () => startGame('free'));
        console.log('Explore button initialized');
    } else {
        console.error('Explore button not found!');
    }
});

// Start the game with the selected mode
function startGame(mode) {
    console.log('Starting game in mode:', mode);
    gameMode = mode;
    setGameMode(mode);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }

    if (gameMode === 'race') {
        showRaceModeUI();
        initializeTargetChallenge();
    } else {
        hideRaceModeUI();
    }

    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

// Main animation loop
function animate() {
    if (!isAnimating) return;
    
    requestAnimationFrame(animate);

    updateMovement(isBoosting, isHyperspace);
    updateStars();
    updateCamera(camera, isHyperspace);
    updateLasers();
    updateReticle();
    updatePlanetLabels();

    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        const pos = spacecraft.position;
        coordsDiv.textContent = `X: ${pos.x.toFixed(0)}, Y: ${pos.y.toFixed(0)}, Z: ${pos.z.toFixed(0)}`;
    }

    if (gameMode === 'race') {
        updateGame();
        updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera);
    }

    updateUI();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Function to start exploration mode (placeholder)
function startExploration() {
    console.log('Exploring the galaxy...');
}

// Function to start hyperspace with progress bar
function startHyperspace() {
    if (isHyperspace) return;
    isHyperspace = true;
    console.log('Entering hyperspace...');

    const progressContainer = document.getElementById('hyperspace-progress-container');
    const progressBar = document.getElementById('hyperspace-progress');
    const bar = progressBar.querySelector('.bar');
    const label = document.getElementById('hyperspace-progress-label');

    if (!progressContainer || !progressBar || !bar || !label) {
        console.error('Hyperspace progress elements not found:', {
            progressContainer,
            progressBar,
            bar,
            label
        });
        return;
    }

    progressContainer.style.display = 'block'; // Show the container
    bar.style.width = '100%'; // Start at 100% for right-to-left unfilling

    // Debug: Log visibility and positioning
    console.log('Progress container display:', progressContainer.style.display);
    console.log('Label visibility:', label.style.display, 'Text:', label.textContent);
    console.log('Label position:', label.style.top, label.style.left);

    let progress = 100;
    const interval = setInterval(() => {
        progress -= (100 / (2000 / 16)); // Decrease from 100% to 0% over 2 seconds
        bar.style.width = `${progress}%`;
        if (progress <= 0) {
            clearInterval(interval);
            progressContainer.style.display = 'none';
        }
    }, 16); // Approx. 60 FPS

    setTimeout(() => {
        isHyperspace = false;
        console.log('Exiting hyperspace...');
        resetMovementInputs();
    }, 2000);
}