// src/main.js

// Main setup imports
import { 
    updateStars, 
    updatePlanetLabels, 
    checkPlanetProximity, 
    isMoonSurfaceActive,
    exitEarthSurface,
    updateMoonPosition,
    updateMoonOrbit,
    init as initSpace,
    update as updateSpace,
    renderer as spaceRenderer,
    scene as spaceScene,
    camera as spaceCamera,
    spacecraft,
    renderScene
} from './setup.js';

// import moon surface functions
import { 
    init as initEarthSurface, 
    update as updateEarthSurface,
    moonScene as earthScene,
    moonCamera as earthCamera,
    tiles,
    moonRenderer as earthRenderer
} from './moon3D.js';

import { setGameMode, resetMovementInputs } from './movement.js'; // Added keys import
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator, showRaceModeUI, hideRaceModeUI, updateUI } from './ui.js';

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Explicitly import Three.js module

let gameMode = null;
let isAnimating = false;
let isBoosting = false;
let isHyperspace = false;
let isSpacePressed = false;
let spaceInitialized = false;
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
    }
    if (event.code === 'ArrowUp') {
        isBoosting = true;
        console.log('Boost activated - speed should increase');
        
        // Visual indication for debug purposes
        const coordsDiv = document.getElementById('coordinates');
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        }
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        startHyperspace();
    }
    // Enhanced ESC key to exit Moon surface
    if (event.code === 'Escape' && isMoonSurfaceActive) {
        console.log('ESC pressed - exiting Moon surface');
        exitEarthSurface();
    }
});

// Keyup event listeners for controls
document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        isSpacePressed = false;
    }
    if (event.code === 'ArrowUp') {
        isBoosting = false;
        console.log('Boost deactivated - speed should return to normal');
        
        // Reset visual indication
        const coordsDiv = document.getElementById('coordinates');
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        }
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
    
    // Show coordinates when game starts
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.display = 'block';
    }

    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    spaceCamera.aspect = window.innerWidth / window.innerHeight;
    spaceCamera.updateProjectionMatrix();
    spaceRenderer.setSize(window.innerWidth, window.innerHeight);
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
        spaceScene.add(line);
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
        spaceCamera.getWorldPosition(cameraPosition);
        streak.line.position.copy(cameraPosition);
        streak.line.rotation.copy(spaceCamera.rotation);
    });
}

// Function to start hyperspace with progress bar and streaks
function startHyperspace() {
    if (isHyperspace) return;
    
    isHyperspace = true;
    console.log('Entering hyperspace... Speed should increase dramatically!');

    // Create hyperspace streaks
    createStreaks();

    // Visual indication for debug purposes
    const coordsDiv = document.getElementById('coordinates');
    if (coordsDiv) {
        coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
        coordsDiv.style.fontWeight = 'bold';
    }

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
        console.log('Exiting hyperspace... Speed should return to normal');
        resetMovementInputs();
        
        // Reset visual indication
        if (coordsDiv) {
            coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
            coordsDiv.style.fontWeight = 'normal';
        }
        
        // Clean up streaks
        streakLines.forEach(streak => spaceScene.remove(streak.line));
        streakLines = [];
    }, 2000);
}
s
let debugMode = true;

// Make the reset function available globally to avoid circular ismports
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

        try {
            // Initialize space scene (including spacecraft) once
            if (!spaceInitialized) {
                console.log('Initializing Outer Space');
                const spaceObjects = initSpace();
                spaceInitialized = true;
                console.log('Space initialized successfully', spaceObjects);
            }
            
            // Main frame update function - pass isBoosting and isHyperspace values
            updateSpace(isBoosting, isHyperspace);
            
            // Debug logging for hyperspace and boost state
            if (isHyperspace) {
                console.log('Hyperspace active - speed should increase');
            }
            if (isBoosting) {
                console.log('Boosting active');
            }

            // ALL THIS BELOW BELONGS IN INIT
            // Update Moon's position relative to Earth using global coordinates
            updateMoonPosition();
            
            // Update the Moon's orbit visualization
            updateMoonOrbit();
            
            // Update hyperspace streaks if active
            if (isHyperspace) {
                updateStreaks();
            }
            
            // Update coordinates display - only show in space mode
            const coordsDiv = document.getElementById('coordinates');
            if (coordsDiv && spacecraft) {
                coordsDiv.style.display = 'block';
                coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
                const pos = spacecraft.position;
                coordsDiv.textContent = `X: ${pos.x.toFixed(0)}, Y: ${pos.y.toFixed(0)}, Z: ${pos.z.toFixed(0)}`;
            } else if (coordsDiv) {
                coordsDiv.style.display = 'block';
                coordsDiv.style.color = '#4fc3f7'; // Keep blue color consistent
                coordsDiv.textContent = 'Spacecraft initializing...';
            }
            
            updateUI();
            
            renderScene();

        
        } catch (e) {
            console.error('Animation loop error:', e);
        }
    }
    
    // CASE 1 = moon surface view
    if (isMoonSurfaceActive) {
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
            
            // Main update function that updates spacecraft, camera, tiles, world matrices
            const earthUpdated = updateEarthSurface();              

            // Render the earth scene with the earth camera using our renderer
            earthRenderer.render(earthScene, earthCamera);
            
        } catch (e) {
            console.error('Animation loop error:', e);
        }
    }
}