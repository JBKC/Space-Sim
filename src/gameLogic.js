// src/gameLogic.js
import { scene, spacecraft } from './setup.js';

export const sphereGeometry = new THREE.SphereGeometry(8, 32, 32);
export const haloGeometry = new THREE.SphereGeometry(12, 32, 32);

// Main target material (translucent blue matching UI)
export const regularSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x00B7FF,
    transparent: true,
    opacity: 0.7
});

// Halo material (more solid blue)
export const regularHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0x00B7FF,
    transparent: true,
    opacity: 0.4
});

// Final target materials (golden with halo)
export const goldSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.5
});

export const goldHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.3
});

export let targets = [];
export const targetSpawnDistance = 75;
export const challengeTargetCount = 10;
export let score = 0;
export let challengeStarted = false;
export let challengeComplete = false;
export let startTime = 0;
export let endTime = 0;
export let currentTargetIndex = 0;

export function createSphereTarget(position, isFinalTarget) {
    const targetMaterial = isFinalTarget ? goldSphereMaterial : regularSphereMaterial;
    const haloMaterial = isFinalTarget ? goldHaloMaterial : regularHaloMaterial;
    
    // Create target group
    const targetGroup = new THREE.Group();
    
    // Create inner sphere (main target)
    const target = new THREE.Mesh(sphereGeometry, targetMaterial);
    targetGroup.add(target);
    
    // Create halo sphere
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    targetGroup.add(halo);
    
    // Position the group
    targetGroup.position.copy(position);
    
    return targetGroup;
}

export function initializeTargetChallenge() {
    // Remove existing targets
    targets.forEach(target => scene.remove(target));
    targets = [];

    // Reset game state
    score = 0;
    challengeStarted = false;
    challengeComplete = false;
    currentTargetIndex = 0;
    startTime = 0;
    endTime = 0;

    // Reset UI
    updateScoreDisplay();
    updateTimerDisplay();
    
    // Show game UI
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    if (scoreElement) scoreElement.style.display = 'block';
    if (timerElement) timerElement.style.display = 'block';

    // Spawn first target
    spawnNextTarget();
}

const targetPositions = [
    { x: 0, y: 0, z: 100 },          // First target, straight ahead
    { x: 15, y: 50, z: 175 },       // Start climbing
    { x: -10, y: 200, z: 250 },      // Continue up
    { x: -25, y: 300, z: 375 },      // High point
    { x: 40, y: 400, z: 500 },       // Begin curved descent
    { x: 20, y: 450, z: 600 },      // Peak height
    { x: 30, y: 400, z: 700 },      // Start descending
    { x: -5, y: 300, z: 800 },      // Continuing descent
    { x: -20, y: 200, z: 850 },     // Final approach
    { x: 0, y: 100, z: 900 }        // Final target, safe distance from planet
];

export function spawnNextTarget() {
    if (currentTargetIndex >= challengeTargetCount) return;

    const isFinalTarget = currentTargetIndex === challengeTargetCount - 1;
    const targetData = targetPositions[currentTargetIndex];
    const position = new THREE.Vector3(
        targetData.x,
        targetData.y,
        targetData.z
    );

    const target = createSphereTarget(position, isFinalTarget);
    scene.add(target);
    targets.push(target);
    currentTargetIndex++;
}

export function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Targets Hit: ${score}/${challengeTargetCount}`;
    }
}

export function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        if (!challengeStarted || challengeComplete) {
            timerElement.textContent = 'Time: --:--';
        } else {
            const currentTime = performance.now();
            const elapsedTime = (currentTime - startTime) / 1000;
            const minutes = Math.floor(elapsedTime / 60);
            const seconds = (elapsedTime % 60).toFixed(2);
            timerElement.textContent = `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(5, '0')}`;
        }
    }
}

export function showVictoryScreen() {
    const victoryScreen = document.getElementById('victory-screen');
    const victoryTime = document.getElementById('victory-time');
    const glowOverlay = document.getElementById('glow-overlay');
    
    if (victoryScreen && victoryTime) {
        const totalTime = (endTime - startTime) / 1000;
        const minutes = Math.floor(totalTime / 60);
        const seconds = (totalTime % 60).toFixed(2);
        victoryTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(5, '0')}`;
        
        // Show the victory screen with flex display
        victoryScreen.style.display = 'flex';
        
        // Add victory glow effect
        if (glowOverlay) {
            glowOverlay.classList.add('victory');
            glowOverlay.style.opacity = '1';
        }
    }
}

export function checkCollisions() {
    if (challengeComplete || targets.length === 0) return;

    const spacecraftPosition = spacecraft.position.clone();
    const target = targets[0];
    const distance = spacecraftPosition.distanceTo(target.position);
    const targetRadius = 8;

    if (distance < targetRadius) {
        if (!challengeStarted) {
            challengeStarted = true;
            startTime = performance.now();
        }

        score += 1;
        const wasLastTarget = score === challengeTargetCount;

        scene.remove(target);
        targets.shift();

        if (wasLastTarget) {
            endTime = performance.now();
            challengeComplete = true;
            showVictoryScreen();
            // Disable spacecraft controls by setting velocity to 0
            if (spacecraft.userData && spacecraft.userData.velocity) {
                spacecraft.userData.velocity.set(0, 0, 0);
            }
        } else {
            triggerGreenGlow();
            spawnNextTarget();
        }

        updateScoreDisplay();
    }
}

export function triggerGreenGlow() {
    const glowOverlay = document.getElementById('glow-overlay');
    if (glowOverlay) {
        glowOverlay.style.opacity = '1';
        setTimeout(() => glowOverlay.style.opacity = '0', 300);
    }
}

export function updateGame() {
    if (challengeStarted && !challengeComplete) {
        updateTimerDisplay();
    }
    checkCollisions();
}