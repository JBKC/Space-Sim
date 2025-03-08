// src/gameLogic.js
import { scene, spacecraft } from './setup.js';

export const sphereGeometry = new THREE.SphereGeometry(8, 32, 32);
export const regularSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
});
export const goldSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.5
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
    const target = new THREE.Mesh(sphereGeometry, targetMaterial);
    target.position.copy(position);
    return target;
}

export function initializeTargetChallenge() {
    targets.forEach(target => scene.remove(target));
    targets = [];

    score = 0;
    challengeStarted = false;
    challengeComplete = false;
    currentTargetIndex = 0;
    updateScoreDisplay();
    updateTimerDisplay();

    spawnNextTarget();
}

const targetPositions = [
    { x: 0, y: 0, z: 0 },
    { x: 15, y: 5, z: 15 },
    { x: -10, y: -10, z: 30 },
    { x: -25, y: 15, z: 45 },
    { x: 0, y: 20, z: 60 },
    { x: 20, y: -15, z: 75 },
    { x: 30, y: 5, z: 90 },
    { x: -5, y: -25, z: 105 },
    { x: -20, y: 0, z: 120 },
    { x: 0, y: 0, z: 135 }
];

export function spawnNextTarget() {
    if (currentTargetIndex >= challengeTargetCount) return;

    const isFinalTarget = currentTargetIndex === challengeTargetCount - 1;
    let baseZ = spacecraft.position.z + targetSpawnDistance;
    const targetData = targetPositions[currentTargetIndex];
    const position = new THREE.Vector3(
        targetData.x,
        targetData.y,
        baseZ + targetData.z
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
            timerElement.textContent = `Time: ${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
        }
    }
}

export function showFinalTime() {
    const finalTimeElement = document.getElementById('finalTime');
    if (finalTimeElement) {
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        const minutes = Math.floor(totalTime / 60);
        const seconds = (totalTime % 60).toFixed(2);

        finalTimeElement.innerHTML = `CHALLENGE COMPLETE!<br>Your Time: ${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
        finalTimeElement.style.display = 'block';

        setTimeout(() => {
            finalTimeElement.style.display = 'none';
            initializeTargetChallenge();
        }, 20000);
    }
}

export function triggerGreenGlow() {
    const glowOverlay = document.getElementById('glow-overlay');
    if (glowOverlay) {
        glowOverlay.style.opacity = '1';
        setTimeout(() => glowOverlay.style.opacity = '0', 300);
    }
}

export function triggerGoldGlow() {
    const goldOverlay = document.getElementById('gold-overlay');
    if (goldOverlay) {
        goldOverlay.style.opacity = '1';
        setTimeout(() => goldOverlay.style.opacity = '0', 1000);
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
            triggerGoldGlow();
            endTime = performance.now();
            challengeComplete = true;
            showFinalTime();
        } else {
            triggerGreenGlow();
            spawnNextTarget();
        }

        updateScoreDisplay();
    }
}

export function updateGame() {
    if (challengeStarted && !challengeComplete) {
        updateTimerDisplay();
    }
    checkCollisions();
}