// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// X-wing spacecraft
const spacecraft = new THREE.Group();

// Main body (fuselage)
const bodyGeometry = new THREE.BoxGeometry(0.6, 0.4, 3.5);
const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xb0b0b0 });
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
spacecraft.add(body);

// Nose cone
const noseGeometry = new THREE.ConeGeometry(0.2, 1.0, 8);
const noseMaterial = new THREE.MeshBasicMaterial({ color: 0xff4040 });
const nose = new THREE.Mesh(noseGeometry, noseMaterial);
nose.position.set(0, 0, 2.25);
nose.rotation.x = Math.PI / 2;
spacecraft.add(nose);

// Cockpit
const cockpitGeometry = new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
cockpit.position.set(0, 0.25, 0);
spacecraft.add(cockpit);

// Engines
const engineGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8);
const engineMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
const engine1 = new THREE.Mesh(engineGeometry, engineMaterial);
engine1.position.set(0.4, 0.3, -1.95);
engine1.rotation.x = Math.PI / 2;
spacecraft.add(engine1);

const engine2 = new THREE.Mesh(engineGeometry, engineMaterial);
engine2.position.set(-0.4, 0.3, -1.95);
engine2.rotation.x = Math.PI / 2;
spacecraft.add(engine2);

const engine3 = new THREE.Mesh(engineGeometry, engineMaterial);
engine3.position.set(0.4, -0.3, -1.95);
engine3.rotation.x = Math.PI / 2;
spacecraft.add(engine3);

const engine4 = new THREE.Mesh(engineGeometry, engineMaterial);
engine4.position.set(-0.4, -0.3, -1.95);
engine4.rotation.x = Math.PI / 2;
spacecraft.add(engine4);

// Engine glow (will brighten during boost)
const engineGlowGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
const engineGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const engineGlow1 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
engineGlow1.position.set(0.4, 0.3, -2.25);
engineGlow1.rotation.x = Math.PI / 2;
spacecraft.add(engineGlow1);

const engineGlow2 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
engineGlow2.position.set(-0.4, 0.3, -2.25);
engineGlow2.rotation.x = Math.PI / 2;
spacecraft.add(engineGlow2);

const engineGlow3 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
engineGlow3.position.set(0.4, -0.3, -2.25);
engineGlow3.rotation.x = Math.PI / 2;
spacecraft.add(engineGlow3);

const engineGlow4 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
engineGlow4.position.set(-0.4, -0.3, -2.25);
engineGlow4.rotation.x = Math.PI / 2;
spacecraft.add(engineGlow4);

// Engine lights (will brighten during boost)
const lightGeometry = new THREE.SphereGeometry(0.15, 8, 8);
const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff66ff });
const light1 = new THREE.Mesh(lightGeometry, lightMaterial);
light1.position.set(0.4, 0.3, -2.25);
spacecraft.add(light1);

const light2 = new THREE.Mesh(lightGeometry, lightMaterial);
light2.position.set(-0.4, 0.3, -2.25);
spacecraft.add(light2);

const light3 = new THREE.Mesh(lightGeometry, lightMaterial);
light3.position.set(0.4, -0.3, -2.25);
spacecraft.add(light3);

const light4 = new THREE.Mesh(lightGeometry, lightMaterial);
light4.position.set(-0.4, -0.3, -2.25);
spacecraft.add(light4);

// Create wings (start in X-formation)
function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ; // Initial X-formation rotation

    const wingGeometry = new THREE.BoxGeometry(2.5, 0.05, 0.8);
    const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 });
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    wing.position.set(1.25, 0, 0);
    wingGroup.add(wing);

    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.3);
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.position.set(0.6, 0, 0);
    wingGroup.add(stripe);

    const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const wingTipMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const wingTip = new THREE.Mesh(wingTipGeometry, wingTipMaterial);
    wingTip.position.set(2.5, 0, 0);
    wingTip.rotation.z = Math.PI / 2;
    wingGroup.add(wingTip);

    const cannonGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);
    const cannonMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
    cannon.position.set(3.0, 0, 0.2);
    cannon.rotation.x = Math.PI / 2;
    wingGroup.add(cannon);

    const cannon2 = new THREE.Mesh(cannonGeometry, cannonMaterial);
    cannon2.position.set(3.0, 0, -0.2);
    cannon2.rotation.x = Math.PI / 2;
    wingGroup.add(cannon2);

    return wingGroup;
}

// Add wings (start in X-formation)
const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
spacecraft.add(topRightWing);

const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
spacecraft.add(bottomRightWing);

const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
spacecraft.add(topLeftWing);

const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
spacecraft.add(bottomLeftWing);

// Wing struts
function createStrut(x, y, z, rotationZ) {
    const strutGeometry = new THREE.BoxGeometry(0.6, 0.05, 0.05);
    const strutMaterial = new THREE.MeshBasicMaterial({ color: 0x999999 });
    const strut = new THREE.Mesh(strutGeometry, strutMaterial);
    strut.position.set(x, y, z - 0.5);
    strut.rotation.z = rotationZ;
    return strut;
}

spacecraft.add(createStrut(0, 0.15, 0, 0));
spacecraft.add(createStrut(0, -0.15, 0, 0));

scene.add(spacecraft);

// Infinite stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 10000;
const starRange = 2000; // Increased for larger field
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * starRange;     // X
    starPositions[i + 1] = (Math.random() - 0.5) * starRange; // Y
    starPositions[i + 2] = (Math.random() - 0.5) * starRange; // Z
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Update stars for infinite effect
function updateStars() {
    const spacecraftZ = spacecraft.position.z;
    const positions = stars.geometry.attributes.position.array;
    const halfRange = starRange / 2;

    for (let i = 0; i < starCount * 3; i += 3) {
        const starZ = positions[i + 2];
        if (starZ < spacecraftZ - halfRange || starZ > spacecraftZ + halfRange) {
            positions[i] = (Math.random() - 0.5) * starRange;     // X
            positions[i + 1] = (Math.random() - 0.5) * starRange; // Y
            positions[i + 2] = spacecraftZ - halfRange + (Math.random() * starRange); // Z
        }
    }
    stars.geometry.attributes.position.needsUpdate = true;
}

// Enhanced spherical target system
const sphereGeometry = new THREE.SphereGeometry(8, 32, 32);
const regularSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
});
const goldSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.5
});

let targets = [];
const targetSpawnDistance = 75;
const challengeTargetCount = 10;
let score = 0;
let challengeStarted = false;
let challengeComplete = false;
let startTime = 0;
let endTime = 0;
let currentTargetIndex = 0;

// Create a spherical target
function createSphereTarget(position, isFinalTarget) {
    const targetMaterial = isFinalTarget ? goldSphereMaterial : regularSphereMaterial;
    const target = new THREE.Mesh(sphereGeometry, targetMaterial);
    target.position.copy(position);
    return target;
}

// HTML elements setup
function setupUIElements() {
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

// Initialize the first target
function initializeTargetChallenge() {
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

// Predefined target positions
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

// Spawn next target
function spawnNextTarget() {
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

// Update score display
function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Targets Hit: ${score}/${challengeTargetCount}`;
    }
}

// Update timer display
function updateTimerDisplay() {
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

// Show final time
function showFinalTime() {
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
        }, 5000);
    }
}

// Flash effects
function triggerGreenGlow() {
    const glowOverlay = document.getElementById('glow-overlay');
    if (glowOverlay) {
        glowOverlay.style.opacity = '1';
        setTimeout(() => glowOverlay.style.opacity = '0', 300);
    }
}

function triggerGoldGlow() {
    const goldOverlay = document.getElementById('gold-overlay');
    if (goldOverlay) {
        goldOverlay.style.opacity = '1';
        setTimeout(() => goldOverlay.style.opacity = '0', 1000);
    }
}

// Collision detection for spherical targets
function checkCollisions() {
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

// Game update
function updateGame() {
    if (challengeStarted && !challengeComplete) {
        updateTimerDisplay();
    }
    checkCollisions();
}

// Setup UI and initialize challenge
setupUIElements();
initializeTargetChallenge();

// Movement and boost variables
const baseSpeed = 0.3;
const boostSpeed = 0.9;
let currentSpeed = baseSpeed;
const turnSpeed = 0.015;
const keys = { w: false, s: false, a: false, d: false, left: false, right: false, up: false };
let boostDuration = 0;
const boostMaxDuration = 120;

// Wing animation variables
let wingsOpen = true;
let wingAnimation = 0;
const wingTransitionFrames = 30;

// Keyboard controls
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w': keys.w = true; break;
        case 's': keys.s = true; break;
        case 'a': keys.a = true; break;
        case 'd': keys.d = true; break;
        case 'ArrowLeft': keys.left = true; break;
        case 'ArrowRight': keys.right = true; break;
        case 'ArrowUp':
            if (!keys.up && boostDuration === 0) {
                keys.up = true;
                boostDuration = boostMaxDuration;
                if (wingsOpen) {
                    wingsOpen = false;
                    wingAnimation = wingTransitionFrames;
                }
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w': keys.w = false; break;
        case 's': keys.s = false; break;
        case 'a': keys.a = false; break;
        case 'd': keys.d = false; break;
        case 'ArrowLeft': keys.left = false; break;
        case 'ArrowRight': keys.right = false; break;
        case 'ArrowUp':
            keys.up = false;
            if (!wingsOpen) {
                wingsOpen = true;
                wingAnimation = wingTransitionFrames;
            }
            break;
    }
});

// Rotation setup
const rotation = {
    pitch: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    pitchAxis: new THREE.Vector3(1, 0, 0),
    yawAxis: new THREE.Vector3(0, 1, 0),
    rollAxis: new THREE.Vector3(0, 0, 1)
};

// Third-person camera setup
const cameraOffset = new THREE.Vector3(0, 2, -7);
let smoothFactor = 0.1;

const cameraTarget = new THREE.Object3D();
spacecraft.add(cameraTarget);
cameraTarget.position.set(0, 0, 0);

const cameraRig = new THREE.Object3D();
scene.add(cameraRig);

// Update camera
function updateCamera() {
    const targetPosition = new THREE.Vector3();
    spacecraft.getWorldPosition(targetPosition);

    const localOffset = cameraOffset.clone();
    const cameraPosition = localOffset.clone().applyMatrix4(spacecraft.matrixWorld);

    camera.position.lerp(cameraPosition, smoothFactor);
    camera.quaternion.copy(spacecraft.quaternion);

    const adjustment = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, Math.PI, 0)
    );
    camera.quaternion.multiply(adjustment);
}

// Directional indicator setup
function setupDirectionalIndicator() {
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

// Update directional indicator
// Add global variables for smoothing the arrow
let previousAngle = 0; // Store the previous angle for interpolation
const smoothingFactor = 0.1; // Adjust this value (0-1) for faster/slower smoothing

function updateDirectionalIndicator() {
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

        // Normalize angles to handle wrapping (e.g., -π to π)
        const normalizeAngle = (angle) => {
            while (angle > Math.PI) angle -= 2 * Math.PI;
            while (angle < -Math.PI) angle += 2 * Math.PI;
            return angle;
        };

        targetAngle = normalizeAngle(targetAngle);
        const prevAngleNormalized = normalizeAngle(previousAngle);

        // Calculate the shortest angular distance, handling wrap-around
        let angleDiff = targetAngle - prevAngleNormalized;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Smoothly interpolate the angle
        const smoothedAngle = prevAngleNormalized + angleDiff * smoothingFactor;
        previousAngle = smoothedAngle;

        // Calculate position on the edge of the screen
        const radius = Math.min(window.innerWidth, window.innerHeight) / 2 - 30;
        const edgeX = centerX + Math.cos(smoothedAngle) * radius;
        const edgeY = centerY + Math.sin(smoothedAngle) * radius;

        // Update indicator position and rotation
        activeIndicator.style.left = (edgeX - 15) + 'px';
        activeIndicator.style.top = (edgeY - 15) + 'px';
        activeIndicator.style.transform = `rotate(${smoothedAngle + Math.PI / 2}rad)`;
    }
}
// Initialize directional indicator
setupDirectionalIndicator();

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (boostDuration > 0) {
        currentSpeed = boostSpeed;
        engineGlowMaterial.color.setHex(0xff6600);
        lightMaterial.color.setHex(0xff99ff);
        boostDuration--;
    } else {
        currentSpeed = baseSpeed;
        engineGlowMaterial.color.setHex(0xff3300);
        lightMaterial.color.setHex(0xff66ff);
    }

    spacecraft.translateZ(currentSpeed);
    updateStars();

    rotation.pitch.identity();
    rotation.yaw.identity();
    rotation.roll.identity();

    if (keys.w) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, turnSpeed);
    if (keys.s) rotation.pitch.setFromAxisAngle(rotation.pitchAxis, -turnSpeed);
    if (keys.a) rotation.roll.setFromAxisAngle(rotation.rollAxis, -turnSpeed * 2);
    if (keys.d) rotation.roll.setFromAxisAngle(rotation.rollAxis, turnSpeed * 2);
    if (keys.left) rotation.yaw.setFromAxisAngle(rotation.yawAxis, turnSpeed);
    if (keys.right) rotation.yaw.setFromAxisAngle(rotation.yawAxis, -turnSpeed);

    const combinedRotation = new THREE.Quaternion()
        .copy(rotation.roll)
        .multiply(rotation.pitch)
        .multiply(rotation.yaw);

    spacecraft.quaternion.multiply(combinedRotation);

    if (wingAnimation > 0) {
        const targetAngle = wingsOpen ? Math.PI / 8 : 0;
        const angleStep = (Math.PI / 8) / wingTransitionFrames;

        if (wingsOpen) {
            topRightWing.rotation.z = Math.max(topRightWing.rotation.z - angleStep, -Math.PI / 8);
            bottomRightWing.rotation.z = Math.min(bottomRightWing.rotation.z + angleStep, Math.PI / 8);
            topLeftWing.rotation.z = Math.min(topLeftWing.rotation.z + angleStep, Math.PI + Math.PI / 8);
            bottomLeftWing.rotation.z = Math.max(bottomLeftWing.rotation.z - angleStep, Math.PI - Math.PI / 8);
        } else {
            topRightWing.rotation.z = Math.min(topRightWing.rotation.z + angleStep, 0);
            bottomRightWing.rotation.z = Math.max(bottomRightWing.rotation.z - angleStep, 0);
            topLeftWing.rotation.z = Math.max(topLeftWing.rotation.z - angleStep, Math.PI);
            bottomLeftWing.rotation.z = Math.min(bottomLeftWing.rotation.z + angleStep, Math.PI);
        }
        wingAnimation--;
    }

    updateCamera();
    updateGame();
    updateDirectionalIndicator();

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});