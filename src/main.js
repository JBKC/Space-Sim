// src/main.js
import { 
    scene, 
    camera, 
    renderer, 
    updateStars, 
    spacecraft, 
    updatePlanetLabels, 
    checkEarthProximity, 
    renderScene, 
    isEarthSurfaceActive,
    exitEarthSurface,
} from './setup.js';
import { updateCamera, updateMovement, setGameMode, resetMovementInputs, keys } from './movement.js'; // Added keys import
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Explicitly import Three.js module

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;

// Laser firing variables
let lastFired = 0;
const fireRate = 100; // 100ms interval (10 shots per second)

// Hyperspace streak effect variables
let streakLines = [];
const streakCount = 20; // Reduced number of streaks for sparsity
const streakLength = 50; // Length of each streak
const streakSpeed = 500; // Speed of streaks moving past the camera

// Initialize UI elements and directional indicator
setupUIElements();
setupDirectionalIndicator();

// Keydown event listeners for controls
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        startFiring(); // Start continuous firing
    }
    if (event.code === 'ArrowUp') {
        isBoosting = true;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        startHyperspace();
    }
    // Add escape key to exit Earth surface
    if (event.code === 'Escape' && isEarthSurfaceActive) {
        exitEarthSurface();
    }
});

// Keyup event listeners for controls
document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
        stopFiring(); // Stop continuous firing
    }
    if (event.code === 'ArrowUp') {
        isBoosting = false;
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

// Function to create hyperspace streak lines
function createStreaks() {
    streakLines = [];
    for (let i = 0; i < streakCount; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // Two points per line (start and end)
        positions[0] = (Math.random() - 0.5) * 100; // Start X
        positions[1] = (Math.random() - 0.5) * 100; // Start Y
        positions[2] = -100 - Math.random() * streakLength; // Start Z (far in front)
        positions[3] = positions[0]; // End X (same as start for now)
        positions[4] = positions[1]; // End Y
        positions[5] = positions[2] + streakLength; // End Z (length ahead)

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0xffffff, // Solid white
            linewidth: 4, // Increased thickness for thicker streaks
        });

        const line = new THREE.Line(geometry, material);
        scene.add(line);
        streakLines.push({ line, positions: positions });
    }
}

// Function to update hyperspace streaks
function updateStreaks() {
    streakLines.forEach((streak, index) => {
        const positions = streak.positions;

        // Move the entire streak backward
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 2] += streakSpeed * 0.016; // Move along Z (backward)
        }

        // If the end of the streak goes too far behind, reset it to the front
        if (positions[5] > 100) {
            positions[0] = (Math.random() - 0.5) * 100; // New start X
            positions[1] = (Math.random() - 0.5) * 100; // New start Y
            positions[2] = -100 - Math.random() * streakLength; // New start Z
            positions[3] = positions[0]; // End X
            positions[4] = positions[1]; // End Y
            positions[5] = positions[2] + streakLength; // End Z
        }

        streak.line.geometry.attributes.position.needsUpdate = true;

        // Position and rotate with the camera
        const cameraPosition = new THREE.Vector3();
        camera.getWorldPosition(cameraPosition);
        streak.line.position.copy(cameraPosition);
        streak.line.rotation.copy(camera.rotation);
    });
}

// Function to start hyperspace with progress bar and streaks
function startHyperspace() {
    if (isHyperspace) return;
    isHyperspace = true;
    console.log('Entering hyperspace...');

    // Create hyperspace streaks
    createStreaks();

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
        // Clean up streaks
        streakLines.forEach(streak => scene.remove(streak.line));
        streakLines = [];
    }, 2000);
}



// Main animation loop with continuous firing
function animate() {

    if (!isAnimating) return;
    
    requestAnimationFrame(animate);

    updateMovement(isBoosting, isHyperspace);
    updateStars();
    updateCamera(camera, isHyperspace);
    updateLasers();
    updateReticle();
    updatePlanetLabels();

    // Check if spacecraft is near Earth
    if (!isEarthSurfaceActive) {
        checkEarthProximity();
    }

    // Continuous laser firing logic
    if (isSpacePressed && !isHyperspace) {
        const currentTime = Date.now();
        if (currentTime - lastFired >= fireRate) {
            fireLasers();
            lastFired = currentTime;
            console.log('Lasers fired at:', new Date().toISOString());
        }
    }

    // Update hyperspace streaks if active
    if (isHyperspace) {
        updateStreaks();
    }

    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        if (isEarthSurfaceActive) {
            // Hide coordinates when on Earth's surface
            coordsDiv.style.display = 'none';
        } else {
            // Show coordinates and update them when in space
            coordsDiv.style.display = 'block';
            const pos = spacecraft.position;
            coordsDiv.textContent = `X: ${pos.x.toFixed(0)}, Y: ${pos.y.toFixed(0)}, Z: ${pos.z.toFixed(0)}`;
        }
    }

    updateUI();
    
    // Use the new rendering function instead of directly rendering the scene
    renderScene();
}