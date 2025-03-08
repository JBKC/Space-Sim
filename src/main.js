// src/main.js
import { scene, camera, renderer, updateStars } from './setup.js';
import { updateCamera, updateMovement } from './movement.js';
import { initializeTargetChallenge, updateGame, targets, score, challengeTargetCount, challengeComplete } from './gameLogic.js';
import { setupUIElements, setupDirectionalIndicator, updateDirectionalIndicator } from './ui.js';

// Initialize game
setupUIElements();
setupDirectionalIndicator();
initializeTargetChallenge();

function startGame() {
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.display = 'none';
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    updateMovement();
    updateStars();
    updateCamera(camera);
    updateGame();
    updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera);

    renderer.render(scene, camera);
}

document.getElementById('play-button').addEventListener('click', startGame);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});