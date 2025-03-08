// src/setup.js
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// X-wing spacecraft
export const spacecraft = new THREE.Group();

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

// Engine glow (export material for boost effects)
export const engineGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const engineGlowGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
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

// Engine lights (export material for boost effects)
export const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff66ff });
const lightGeometry = new THREE.SphereGeometry(0.15, 8, 8);
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
export function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ;

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

// Add wings
// ... Previous code in setup.js up to wing creation ...

// Add wings
export const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
export const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
export const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
export const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
spacecraft.add(topRightWing);
spacecraft.add(bottomRightWing); // Fixed to bottomRightWing
spacecraft.add(topLeftWing);
spacecraft.add(bottomLeftWing); // Fixed to bottomLeftWing

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
const starRange = 2000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i += 3) {
 starPositions[i] = (Math.random() - 0.5) * starRange;
 starPositions[i + 1] = (Math.random() - 0.5) * starRange;
 starPositions[i + 2] = (Math.random() - 0.5) * starRange;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
export const stars = new THREE.Points(starGeometry, starMaterial);
 scene.add(stars);

export function updateStars() {
 const spacecraftZ = spacecraft.position.z;
 const positions = stars.geometry.attributes.position.array;
 const halfRange = starRange / 2;

 for (let i = 0; i < starCount * 3; i += 3) {
 const starZ = positions[i + 2];
 if (starZ < spacecraftZ - halfRange || starZ > spacecraftZ + halfRange) {
 positions[i] = (Math.random() - 0.5) * starRange;
 positions[i + 1] = (Math.random() - 0.5) * starRange;
 positions[i + 2] = spacecraftZ - halfRange + (Math.random() * starRange);
 }
 }
 stars.geometry.attributes.position.needsUpdate = true;
}