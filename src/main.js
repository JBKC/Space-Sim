// src/main.js
import { scene, camera, renderer, updateStars, spacecraft } from './setup.js';
import { updateCamera, updateMovement, setGameMode } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';

let gameMode = null; // 'race' or 'free'
let isAnimating = false; // Track if animation is running
let isBoosting = false; // Track if the boost is active
let isHyperspace = false; // Track if hyperspace is active

// Initialize game
setupUIElements();
setupDirectionalIndicator();

let isSpacePressed = false;

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        startFiring();
    }

    // Start boosting when the Up Arrow key is pressed
    if (event.code === 'ArrowUp') {
        isBoosting = true; // Set boosting to true
    }

    // Start hyperspace when Shift key is pressed
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        startHyperspace();
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        stopFiring();
    }

    // Stop boosting when the Up Arrow key is released
    if (event.code === 'ArrowUp') {
        isBoosting = false; // Set boosting to false
    }
});

// Debug logging for spacebar press
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

// Initialize game mode selection
document.addEventListener('DOMContentLoaded', () => {
    const exploreButton = document.querySelector('#explore-button');

    if (exploreButton) {
        exploreButton.addEventListener('click', () => startGame('free'));
        console.log('Explore button initialized');
    } else {
        console.error('Explore button not found!');
    }
});

function startGame(mode) {
    console.log('Starting game in mode:', mode);
    gameMode = mode;
    setGameMode(mode); // Set game mode in movement.js
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }

    // Handle UI and game initialization based on mode
    if (gameMode === 'race') {
        showRaceModeUI();
        initializeTargetChallenge();
    } else {
        hideRaceModeUI();
    }

    // Start animation only when game mode is selected
    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

function animate() {
    if (!isAnimating) return; // Stop animation if game mode not selected
    
    requestAnimationFrame(animate);

    updateMovement(isBoosting, isHyperspace); // Pass the boosting and hyperspace state to the movement function
    updateStars();
    updateCamera(camera, isHyperspace); // Pass isHyperspace to updateCamera
    updateLasers();
    updateReticle();

    // Only update game logic and directional indicator in race mode
    if (gameMode === 'race') {
        updateGame();
        updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera);
    }

    // Update UI
    updateUI();

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Function to start exploring the galaxy
function startExploration() {
    console.log('Exploring the galaxy...');
    // Add your exploration logic here
}

// Function to start hyperspace
function startHyperspace() {
    if (isHyperspace) return; // Prevent multiple activations
    isHyperspace = true; // Set hyperspace to active
    console.log('Entering hyperspace...');

    // Debugging log
    console.log('isHyperspace:', isHyperspace);

    // Set the speed to 10x normal speed
    const originalSpeed = 1.0; // Assuming base speed is 1.0
    const hyperspaceSpeed = originalSpeed * 10;

    setTimeout(() => {
        isHyperspace = false; // Reset hyperspace state after 1 second
        console.log('Exiting hyperspace...');
        // Debugging log
        console.log('isHyperspace:', isHyperspace);
    }, 2000); // Duration of hyperspace
}