// src/ui.js
export function setupUIElements() {
    let scoreElement = document.getElementById('score');
    if (!scoreElement) {
        scoreElement = document.createElement('div');
        scoreElement.id = 'score';
        scoreElement.style.position = 'absolute';
        scoreElement.style.top = '20px';
        scoreElement.style.left = '20px';
        scoreElement.style.color = 'white';
        scoreElement.style.fontFamily = 'Arial, sans-serif';
        scoreElement.style.fontSize = '24px';
        scoreElement.style.fontWeight = 'bold';
        scoreElement.style.zIndex = '1001';
        document.body.appendChild(scoreElement);
    }

    let timerElement = document.getElementById('timer');
    if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.id = 'timer';
        timerElement.style.position = 'absolute';
        timerElement.style.top = '55px';
        timerElement.style.left = '20px';
        timerElement.style.color = 'white';
        timerElement.style.fontFamily = 'Arial, sans-serif';
        timerElement.style.fontSize = '24px';
        timerElement.style.fontWeight = 'bold';
        timerElement.style.zIndex = '1001';
        document.body.appendChild(timerElement);
    }

    let finalTimeElement = document.getElementById('finalTime');
    if (!finalTimeElement) {
        finalTimeElement = document.createElement('div');
        finalTimeElement.id = 'finalTime';
        finalTimeElement.style.position = 'absolute';
        finalTimeElement.style.top = '50%';
        finalTimeElement.style.left = '50%';
        finalTimeElement.style.transform = 'translate(-50%, -50%)';
        finalTimeElement.style.color = 'gold';
        finalTimeElement.style.fontFamily = 'Arial, sans-serif';
        finalTimeElement.style.fontSize = '48px';
        finalTimeElement.style.fontWeight = 'bold';
        finalTimeElement.style.textAlign = 'center';
        finalTimeElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.7)';
        finalTimeElement.style.zIndex = '1002';
        finalTimeElement.style.display = 'none';
        document.body.appendChild(finalTimeElement);
    }

    let glowOverlay = document.getElementById('glow-overlay');
    if (!glowOverlay) {
        glowOverlay = document.createElement('div');
        glowOverlay.id = 'glow-overlay';
        glowOverlay.style.position = 'absolute';
        glowOverlay.style.top = '0';
        glowOverlay.style.left = '0';
        glowOverlay.style.width = '100%';
        glowOverlay.style.height = '100%';
        glowOverlay.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
        glowOverlay.style.pointerEvents = 'none';
        glowOverlay.style.opacity = '0';
        glowOverlay.style.transition = 'opacity 0.3s ease';
        glowOverlay.style.zIndex = '1000';
        document.body.appendChild(glowOverlay);
    }

    let goldOverlay = document.getElementById('gold-overlay');
    if (!goldOverlay) {
        goldOverlay = document.createElement('div');
        goldOverlay.id = 'gold-overlay';
        goldOverlay.style.position = 'absolute';
        goldOverlay.style.top = '0';
        goldOverlay.style.left = '0';
        goldOverlay.style.width = '100%';
        goldOverlay.style.height = '100%';
        goldOverlay.style.backgroundColor = 'rgba(255, 215, 0, 0.4)';
        goldOverlay.style.pointerEvents = 'none';
        goldOverlay.style.opacity = '0';
        goldOverlay.style.transition = 'opacity 0.5s ease';
        goldOverlay.style.zIndex = '1000';
        document.body.appendChild(goldOverlay);
    }
}

export function setupDirectionalIndicator() {
    let arrowIndicator = document.getElementById('arrow-indicator');
    if (!arrowIndicator) {
        arrowIndicator = document.createElement('div');
        arrowIndicator.id = 'arrow-indicator';
        arrowIndicator.style.position = 'absolute';
        arrowIndicator.style.width = '60px';
        arrowIndicator.style.height = '60px';
        arrowIndicator.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%2300ff00\'><path d=\'M12 2L4 14h16L12 2z\'/></svg>")';
        arrowIndicator.style.backgroundSize = 'contain';
        arrowIndicator.style.backgroundRepeat = 'no-repeat';
        arrowIndicator.style.pointerEvents = 'none';
        arrowIndicator.style.zIndex = '1005';
        arrowIndicator.style.display = 'none';
        document.body.appendChild(arrowIndicator);
    }

    let goldenArrowIndicator = document.getElementById('golden-arrow-indicator');
    if (!goldenArrowIndicator) {
        goldenArrowIndicator = document.createElement('div');
        goldenArrowIndicator.id = 'golden-arrow-indicator';
        goldenArrowIndicator.style.position = 'absolute';
        goldenArrowIndicator.style.width = '30px';
        goldenArrowIndicator.style.height = '30px';
        goldenArrowIndicator.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23ffd700\'><path d=\'M12 2L4 14h16L12 2z\'/></svg>")';
        goldenArrowIndicator.style.backgroundSize = 'contain';
        goldenArrowIndicator.style.backgroundRepeat = 'no-repeat';
        goldenArrowIndicator.style.pointerEvents = 'none';
        goldenArrowIndicator.style.zIndex = '1005';
        goldenArrowIndicator.style.display = 'none';
        document.body.appendChild(goldenArrowIndicator);
    }
}

let previousAngle = 0;
const smoothingFactor = 0.1;

export function updateDirectionalIndicator(targets, score, challengeTargetCount, challengeComplete, camera) {
    const arrowIndicator = document.getElementById('arrow-indicator');
    const goldenArrowIndicator = document.getElementById('golden-arrow-indicator');

    if (!arrowIndicator || !goldenArrowIndicator || targets.length === 0 || challengeComplete) {
        if (arrowIndicator) arrowIndicator.style.display = 'none';
        if (goldenArrowIndicator) goldenArrowIndicator.style.display = 'none';
        return;
    }

    const nextTarget = targets[0];
    const isFinalTarget = (score === challengeTargetCount - 1);
    const activeIndicator = isFinalTarget ? goldenArrowIndicator : arrowIndicator;
    const inactiveIndicator = isFinalTarget ? arrowIndicator : goldenArrowIndicator;

    inactiveIndicator.style.display = 'none';

    const targetPosition = nextTarget.position.clone();
    const vector = targetPosition.project(camera);

    const x = (vector.x + 1) / 2 * window.innerWidth;
    const y = -(vector.y - 1) / 2 * window.innerHeight;

    const margin = 50;
    const isOnScreen = (
        x >= -margin &&
        x <= window.innerWidth + margin &&
        y >= -margin &&
        y <= window.innerHeight + margin &&
        vector.z < 1
    );

    if (isOnScreen) {
        activeIndicator.style.display = 'none';
    } else {
        activeIndicator.style.display = 'block';

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        let targetAngle = Math.atan2(y - centerY, x - centerX);

        const normalizeAngle = (angle) => {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        };

        targetAngle = normalizeAngle(targetAngle);
        const prevAngleNormalized = normalizeAngle(previousAngle);

        let angleDiff = targetAngle - prevAngleNormalized;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const smoothedAngle = prevAngleNormalized + angleDiff * smoothingFactor;
        previousAngle = smoothedAngle;

        const radius = Math.min(window.innerWidth, window.innerHeight) / 2 - 30;
        const edgeX = centerX + Math.cos(smoothedAngle) * radius;
        const edgeY = centerY + Math.sin(smoothedAngle) * radius;

        activeIndicator.style.left = (edgeX - 15) + 'px';
        activeIndicator.style.top = (edgeY - 15) + 'px';
        activeIndicator.style.transform = `rotate(${smoothedAngle + Math.PI / 2}rad)`;
    }
}