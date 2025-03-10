// src/main.js
import { scene, camera, renderer, updateStars, spacecraft } from './setup.js';
import { updateCamera, updateMovement, setGameMode } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';

let gameMode = null; // 'race' or 'free'
let isAnimating = false; // Track if animation is running

// Initialize game
setupUIElements();
setupDirectionalIndicator();


let isSpacePressed = false;

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        startFiring();
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        stopFiring();
    }
});

// Add this to your main.js file:

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
    const raceButton = document.querySelector('#race-mode');
    const freeRoamButton = document.querySelector('#free-roam');

    if (raceButton && freeRoamButton) {
        raceButton.addEventListener('click', () => startGame('race'));
        freeRoamButton.addEventListener('click', () => startGame('free'));
        console.log('Game mode buttons initialized');
    } else {
        console.error('Game mode buttons not found!');
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

    updateMovement();
    updateStars();
    updateCamera(camera);
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