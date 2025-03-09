// src/main.js
import { scene, camera, renderer, updateStars } from './setup.js';
import { updateCamera, updateMovement } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI } from './ui.js';
import { updateLasers } from './lasers.js';

let gameMode = null; // 'race' or 'free'

// Initialize game
setupUIElements();
setupDirectionalIndicator();

// Track spacebar state
window.isSpacePressed = false;
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
        window.isSpacePressed = true;
        console.log('Spacebar pressed');
    }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        window.isSpacePressed = false;
        console.log('Spacebar released');
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

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    updateMovement();
    updateStars();
    updateCamera(camera);
    updateLasers();
    
    // Only update game logic and directional indicator in race mode
    if (gameMode === 'race') {
        updateGame();
        updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});