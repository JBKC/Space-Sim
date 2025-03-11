// src/main.js
import { scene, camera, renderer, updateStars, spacecraft, updatePlanetLabels } from './setup.js';
import { updateCamera, updateMovement, setGameMode, resetMovementInputs } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';

let gameMode = null; // 'race' or 'free'
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;

setupUIElements();
setupDirectionalIndicator();

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

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        stopFiring();
    }
    if (event.code === 'ArrowUp') {
        isBoosting = false;
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function startExploration() {
    console.log('Exploring the galaxy...');
}

function startHyperspace() {
    if (isHyperspace) return;
    isHyperspace = true;
    console.log('Entering hyperspace...');

    setTimeout(() => {
        isHyperspace = false;
        console.log('Exiting hyperspace...');
        resetMovementInputs(); // Reset movement inputs when hyperspace ends
    }, 2000);
}