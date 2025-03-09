// src/setup.js
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Create massive planet
const planetRadius = 2000;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 64, 64);
planetGeometry.computeBoundingSphere();

// Load planet texture
const textureLoader = new THREE.TextureLoader();
const planetTexture = textureLoader.load('skybox/Naboo.png');
planetTexture.wrapS = THREE.ClampToEdgeWrapping;
planetTexture.wrapT = THREE.ClampToEdgeWrapping;

// Simple material with texture
const planetMaterial = new THREE.MeshBasicMaterial({
    map: planetTexture,
    side: THREE.FrontSide
});

export const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 3000);
planet.rotation.y = Math.PI;
scene.add(planet);

// Optimize renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

// Lighting setup for the planet
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1, 1, -1).normalize();
scene.add(directionalLight);

// Create black background
scene.background = new THREE.Color(0x000000);

// X-wing spacecraft with enhanced detail
export const spacecraft = new THREE.Group();

// Materials with PBR properties
const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.8,
    roughness: 0.3,
    envMapIntensity: 1.0
});

const paintMaterial = new THREE.MeshStandardMaterial({
    color: 0xe5e5e5,
    metalness: 0.2,
    roughness: 0.7
});

const redPaintMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    metalness: 0.2,
    roughness: 0.7
});

const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.2
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 0,
    transmission: 1,
    transparent: true,
    opacity: 0.3,
    envMapIntensity: 1.0
});

// Engine glow material with emissive properties
export const engineGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff00ff,  // Pink-purple base color
    emissive: 0xff00ff,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.9
});

// Boost flame material
export const boostFlameMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.0 }
    },
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        float rand(vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        
        void main() {
            float t = time * 3.0;
            
            // Create pulsing glow effect
            float pulse = (sin(t) * 0.5 + 0.5) * 0.3;
            float glow = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
            
            // Core color (bright pink-purple)
            vec3 coreColor = vec3(1.0, 0.0, 1.0);
            // Outer color (lighter pink-purple)
            vec3 outerColor = vec3(0.8, 0.2, 1.0);
            
            // Mix colors based on glow intensity
            vec3 color = mix(outerColor, coreColor, glow + pulse);
            
            // Apply boost intensity with gentler effect
            glow *= (1.0 + intensity * 1.5);
            color *= (1.0 + intensity * 0.5);
            
            // Make normal mode bright and boost mode slightly brighter
            color *= 1.5 + intensity * 0.5;
            
            gl_FragColor = vec4(color, (glow + pulse) * (0.7 + intensity * 0.3));
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});

// Light material for glowing effects
export const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.7
});

// Main fuselage with more detail
const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12);
const fuselage = new THREE.Mesh(fuselageGeometry, paintMaterial);
fuselage.rotation.z = Math.PI / 2;
spacecraft.add(fuselage);

// Add fuselage details
const fuselageDetailGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
const fuselageDetails = [];
const detailPositions = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
detailPositions.forEach(pos => {
    const detail = new THREE.Mesh(fuselageDetailGeometry, metalMaterial);
    detail.rotation.z = Math.PI / 2;
    detail.position.z = pos;
    fuselage.add(detail);
});

// Enhanced nose cone
const noseGeometry = new THREE.CylinderGeometry(0.3, 0.05, 1.2, 12);
const nose = new THREE.Mesh(noseGeometry, paintMaterial);
nose.position.z = 2.35;
nose.rotation.x = Math.PI / 2;
spacecraft.add(nose);

// Nose detail rings
const noseRingGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 24);
const noseRing1 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing1.position.z = 2.0;
spacecraft.add(noseRing1);

const noseRing2 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing2.position.z = 2.3;
spacecraft.add(noseRing2);

// Enhanced cockpit
const cockpitGeometry = new THREE.SphereGeometry(0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitOuter = new THREE.Mesh(cockpitGeometry, metalMaterial);
cockpitOuter.position.set(0, 0.25, 0);
spacecraft.add(cockpitOuter);

const cockpitGlassGeometry = new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitGlass = new THREE.Mesh(cockpitGlassGeometry, glassMaterial);
cockpitGlass.position.set(0, 0.25, 0);
spacecraft.add(cockpitGlass);

// Enhanced engines with glow
const engineGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12);
const enginePositions = [
    { x: 0.4, y: 0.3, z: -1 },  // Moved to rear of craft
    { x: -0.4, y: 0.3, z: -1 },
    { x: 0.4, y: -0.3, z: -1 },
    { x: -0.4, y: -0.3, z: -1 }
];

enginePositions.forEach(pos => {
    // Engine housing
    const engine = new THREE.Mesh(engineGeometry, metalMaterial);
    engine.position.set(pos.x, pos.y, pos.z);
    engine.rotation.x = Math.PI / 2;
    spacecraft.add(engine);

    // Engine intake ring
    const intakeGeometry = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
    const intake = new THREE.Mesh(intakeGeometry, darkMetalMaterial);
    intake.position.set(pos.x, pos.y, pos.z - 0.4);
    spacecraft.add(intake);

    // Engine inner glow
    const innerGlowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
    const innerGlow = new THREE.Mesh(innerGlowGeometry, engineGlowMaterial);
    innerGlow.position.set(pos.x, pos.y, pos.z + 0.35);
    innerGlow.rotation.x = Math.PI / 2;
    spacecraft.add(innerGlow);

    // Engine glow sphere - increased base size
    const glowSphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
    glowSphere.position.set(pos.x, pos.y, pos.z - 0.4);
    glowSphere.visible = true;
    spacecraft.add(glowSphere);
});

// Update function for engine effects - more subtle scaling
let engineTime = 0;
export function updateEngineEffects(isBoost) {
    engineTime += 0.016;
    
    spacecraft.traverse((child) => {
        if (child.material === boostFlameMaterial) {
            child.material.uniforms.time.value = engineTime;
            child.material.uniforms.intensity.value = isBoost ? 1.0 : 0.0;
            child.scale.setScalar(isBoost ? 1.5 : 1.0);  // More subtle size difference
        }
    });
}

// Enhanced wing creation function
export function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ;

    // Main wing with beveled edges
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.1);
    wingShape.lineTo(2.5, -0.15);
    wingShape.lineTo(2.5, 0.15);
    wingShape.lineTo(0, 0.1);
    wingShape.lineTo(0, -0.1);

    const wingExtrudeSettings = {
        steps: 1,
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 3
    };

    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    const wing = new THREE.Mesh(wingGeometry, paintMaterial);
    wingGroup.add(wing);

    // Wing stripes
    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.08);
    const stripe1 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe1.position.set(0.6, 0, 0);
    wingGroup.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe2.position.set(1.2, 0, 0);
    wingGroup.add(stripe2);

    // Enhanced wing tip with details
    const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
    const wingTip = new THREE.Mesh(wingTipGeometry, metalMaterial);
    wingTip.position.set(2.5, 0, 0);
    wingTip.rotation.z = Math.PI / 2;
    wingGroup.add(wingTip);

    // Enhanced cannons
    const cannonGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8);
    const cannonPositions = [
        { x: 3.0, y: 0, z: 0.2 },
        { x: 3.0, y: 0, z: -0.2 }
    ];

    cannonPositions.forEach(pos => {
        const cannon = new THREE.Mesh(cannonGeometry, darkMetalMaterial);
        cannon.position.set(pos.x, pos.y, pos.z);
        cannon.rotation.x = Math.PI / 2;
        wingGroup.add(cannon);

        // Cannon detail rings
        const ringGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
        const positions = [-0.4, -0.2, 0, 0.2, 0.4];
        positions.forEach(ringPos => {
            const ring = new THREE.Mesh(ringGeometry, metalMaterial);
            ring.position.set(pos.x, pos.y, pos.z + ringPos);
            ring.rotation.x = Math.PI / 2;
            wingGroup.add(ring);
        });
    });

    return wingGroup;
}

// Add enhanced wings
export const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
export const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
export const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
export const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
spacecraft.add(topRightWing);
spacecraft.add(bottomRightWing);
spacecraft.add(topLeftWing);
spacecraft.add(bottomLeftWing);

// Add wing support struts with detail
function createEnhancedStrut(x, y, z, rotationZ) {
    const strutGroup = new THREE.Group();
    
    // Main strut
    const strutGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.08);
    const strut = new THREE.Mesh(strutGeometry, metalMaterial);
    strut.position.set(x, y, z - 0.5);
    strut.rotation.z = rotationZ;
    strutGroup.add(strut);

    // Strut details
    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detail1 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail1.position.set(x - 0.25, y, z - 0.5);
    detail1.rotation.z = rotationZ;
    strutGroup.add(detail1);

    const detail2 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
    detail2.position.set(x + 0.25, y, z - 0.5);
    detail2.rotation.z = rotationZ;
    strutGroup.add(detail2);

    return strutGroup;
}

spacecraft.add(createEnhancedStrut(0, 0.15, 0, 0));
spacecraft.add(createEnhancedStrut(0, -0.15, 0, 0));

// Add additional surface details
function addSurfaceDetails() {
    // Panel lines
    const panelLineGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.5);
    const panelLineMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5,
        roughness: 0.8
    });

    // Add panel lines to fuselage
    for (let i = 0; i < 8; i++) {
        const panelLine = new THREE.Mesh(panelLineGeometry, panelLineMaterial);
        panelLine.position.set(0.2, 0.1, -1 + i * 0.5);
        spacecraft.add(panelLine);
    }

    // Add technical details
    const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const detailPositions = [
        { x: 0.2, y: 0.2, z: -1 },
        { x: -0.2, y: 0.2, z: -1 },
        { x: 0.2, y: -0.2, z: -1 },
        { x: -0.2, y: -0.2, z: -1 }
    ];

    detailPositions.forEach(pos => {
        const detail = new THREE.Mesh(detailGeometry, darkMetalMaterial);
        detail.position.set(pos.x, pos.y, pos.z);
        spacecraft.add(detail);
    });
}

addSurfaceDetails();

// Add lighting for the model
const xwingLight = new THREE.PointLight(0xffffff, 0.5);
xwingLight.position.set(0, 2, 0);
spacecraft.add(xwingLight);

// Set spacecraft initial position
spacecraft.position.set(0, 0, 0);
scene.add(spacecraft);

// Export planet radius and position for collision detection
export const PLANET_RADIUS = planetRadius;
export const PLANET_POSITION = planet.position;

// Infinite stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 10000;
const starRange = 6000; // Increased range to match planet scale
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