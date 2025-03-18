// src/main.js
import { 
    scene, 
    camera, 
    renderer, 
    updateStars, 
    spacecraft, 
    updatePlanetLabels, 
    checkPlanetProximity, 
    renderScene, 
    isMoonSurfaceActive,
    exitEarthSurface,
    updateMoonPosition
} from './setup.js';

import { updateCamera, updateMovement, setGameMode, resetMovementInputs, keys } from './movement.js'; // Added keys import
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';
import { updateLasers, fireLasers, startFiring, stopFiring } from './lasers.js';
import { updateReticle } from './reticle.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Explicitly import Three.js module

// import Earth surface functions
// import { 
//     init as initEarthSurface, 
//     update as updateEarthSurface,
//     earthScene,
//     earthCamera,
//     tiles,
//     earthRenderer
// } from './earth3D.js';

// import moon surface functions
import { 
    init as initEarthSurface, 
    update as updateEarthSurface,
    moonScene as earthScene,
    moonCamera as earthCamera,
    tiles,
    moonRenderer as earthRenderer
} from './moon3D.js';

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;
let earthInitialized = false;  // Move to top-level scope for exports

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
    // Enhanced ESC key to exit Moon surface
    if (event.code === 'Escape' && isMoonSurfaceActive) {
        console.log('ESC pressed - exiting Moon surface');
        
        // // Show transition message
        // const transitionMsg = document.createElement('div');
        // transitionMsg.style.position = 'fixed';
        // transitionMsg.style.top = '50%';
        // transitionMsg.style.left = '50%';
        // transitionMsg.style.transform = 'translate(-50%, -50%)';
        // transitionMsg.style.color = 'white';
        // transitionMsg.style.fontFamily = 'Orbitron, sans-serif';
        // transitionMsg.style.fontSize = '24px';
        // transitionMsg.style.padding = '20px';
        // transitionMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        // transitionMsg.style.borderRadius = '10px';
        // transitionMsg.style.zIndex = '9999';
        // transitionMsg.textContent = 'Returning to space...';
        // document.body.appendChild(transitionMsg);
        
        // // Remove message after transition
        // setTimeout(() => {
        //     document.body.removeChild(transitionMsg);
        // }, 2000);
        
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

let debugMode = true;

// Make the reset function available globally to avoid circular imports
window.resetEarthInitialized = function() {
    earthInitialized = false;
    console.log('Reset Moon surface initialization state');
};

// Main animation loop
function animate() {

    if (!isAnimating) {
        console.log("Animation stopped - isAnimating is false");
        return;
    }
    requestAnimationFrame(animate);

    // CASE 0 = space view
    if (!isMoonSurfaceActive) {
        // If we just exited the moon surface, make sure space container is visible
        const spaceContainer = document.getElementById('space-container');
        if (spaceContainer && spaceContainer.style.display === 'none') {
            spaceContainer.style.display = 'block';
            console.log('Restored space-container visibility');
        }

        // Check if spacecraft is near celestial body
        checkPlanetProximity();

        // Update Moon's position relative to Earth using global coordinates
        updateMoonPosition();
        
        updateMovement(isBoosting, isHyperspace);
        updateStars();
        updateCamera(camera, isHyperspace);
        updateLasers();
        updateReticle();
        updatePlanetLabels();
        
        // Continuous laser firing logic
        if (isSpacePressed && !isHyperspace) {
            const currentTime = Date.now();
            if (currentTime - lastFired >= fireRate) {
                fireLasers();
                lastFired = currentTime;
                console.log('Lasers fired');
            }
        }
        
        // Update hyperspace streaks if active
        if (isHyperspace) {
            updateStreaks();
        }
        
        // Update coordinates display - only show in space mode
        const coordsDiv = document.getElementById('coordinates');
        if (coordsDiv) {
            coordsDiv.style.display = 'block';
            const pos = spacecraft.position;
            coordsDiv.textContent = `X: ${pos.x.toFixed(0)}, Y: ${pos.y.toFixed(0)}, Z: ${pos.z.toFixed(0)}`;
        }
        
        updateUI();
        
        // Use the new rendering function instead of directly rendering the scene
        renderScene();
    }
    
    // CASE 1 = moon surface view
    else if (isMoonSurfaceActive) {
        try {
            // Only initialize Earth once
            if (!earthInitialized) {
                console.log('Initializing Moon surface');
                const earthObjects = initEarthSurface();
                earthInitialized = true;
                console.log('Moon surface initialized successfully', earthObjects);

                // Hide space container to see surface scene
                const spaceContainer = document.getElementById('space-container');
                if (spaceContainer) {
                    spaceContainer.style.display = 'none';
                    console.log('Hid space-container');
                }
                
                // Show Moon surface message
                const moonMsg = document.createElement('div');
                moonMsg.id = 'earth-surface-message';
                moonMsg.style.position = 'fixed';
                moonMsg.style.top = '20px';
                moonMsg.style.right = '20px';
                moonMsg.style.color = 'white';
                moonMsg.style.fontFamily = 'Orbitron, sans-serif';
                moonMsg.style.fontSize = '16px';
                moonMsg.style.padding = '10px';
                moonMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                moonMsg.style.borderRadius = '5px';
                moonMsg.style.zIndex = '9999';
                moonMsg.innerHTML = 'MOON SURFACE<br>Press ESC to return to space';
                document.body.appendChild(moonMsg);
                
                // Hide coordinates display in moon surface mode
                const coordsDiv = document.getElementById('coordinates');
                if (coordsDiv) {
                    coordsDiv.style.display = 'none';
                }
            }
            
            // Update Earth components
            const earthUpdated = updateEarthSurface();              // main update function that updates spacecraft, camera, tiles, world matrices
            // if (debugMode && earthUpdated) {
            //     console.log("Earth surface updated successfully");
            // }
            
            // Render the earth scene with the earth camera using our renderer
            earthRenderer.render(earthScene, earthCamera);
            
            // if (debugMode) {
            //     console.log("Frame rendered");
            // }
        } catch (e) {
            console.error('Animation loop error:', e);
        }
    }
}