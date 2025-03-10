import { scene, spacecraft } from './setup.js';

const laserLength = 100;
const laserThickness = 0.15;
const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9
});

const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

let activeLasers = [];
let isFiring = false;
let firingInterval = null;

// Create virtual objects to track wingtips
const wingtipObjects = [
    new THREE.Object3D(), // Right top
    new THREE.Object3D(), // Right bottom
    new THREE.Object3D(), // Left top
    new THREE.Object3D()  // Left bottom
];

// Attach these objects as children to the spacecraft, so they move with it
const wingtipOffsets = [
    new THREE.Vector3(2.5, 0.15, -2), // Right top
    new THREE.Vector3(2.5, -0.15, -2), // Right bottom
    new THREE.Vector3(-2.5, 0.15, -2), // Left top
    new THREE.Vector3(-2.5, -0.15, -2) // Left bottom
];

wingtipObjects.forEach((obj, index) => {
    obj.position.copy(wingtipOffsets[index]);
    spacecraft.add(obj); // Parent wingtips to the spacecraft
});

function createLaser(startPosition, direction) {
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.position.copy(startPosition);
    laser.lookAt(startPosition.clone().add(direction));
    laser.position.add(direction.clone().multiplyScalar(laserLength / 2));

    laser.userData = {
        direction: direction.clone(),
        speed: 2,
        lifetime: 1000,
        startTime: performance.now()
    };

    return laser;
}

export function fireLasers() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);

    wingtipObjects.forEach(wingtip => {
        const worldPos = new THREE.Vector3();
        wingtip.getWorldPosition(worldPos);

        const laser = createLaser(worldPos, forward);
        scene.add(laser);
        activeLasers.push(laser);
    });
}

export function startFiring() {
    if (isFiring) return;
    isFiring = true;
    firingInterval = setInterval(fireLasers, 100);
}

export function stopFiring() {
    isFiring = false;
    clearInterval(firingInterval);
}

export function updateLasers() {
    const currentTime = performance.now();
    
    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const laser = activeLasers[i];
        laser.position.add(laser.userData.direction.clone().multiplyScalar(laser.userData.speed));
        
        if (currentTime - laser.userData.startTime > laser.userData.lifetime) {
            scene.remove(laser);
            activeLasers.splice(i, 1);
        }
    }
}
 