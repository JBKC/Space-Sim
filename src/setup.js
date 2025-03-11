// Import GLTFLoader

// Scene setup
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Load skybox texture
const skyboxTexture = new THREE.TextureLoader().load('skybox/galaxy5.jpeg');

// Create skybox geometry
const skyboxGeometry = new THREE.BoxGeometry(250000, 250000, 250000); // Adjust size as needed
const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide // Render the inside of the box
});

// Create the skybox mesh
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
scene.add(skybox); // Add skybox to the scene

// Create massive planet
const planetRadius = 2000;
const atmosphereThickness = 50; // Thickness of the atmosphere
const atmosphereRadius = planetRadius + atmosphereThickness; // Radius for the atmosphere
const planetGeometry = new THREE.SphereGeometry(planetRadius, 64, 64);
const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64); // Atmosphere geometry

const textureLoader = new THREE.TextureLoader();
const planetTexture = textureLoader.load('skybox/2k_earth_daymap.jpg');
planetTexture.wrapS = THREE.ClampToEdgeWrapping;
planetTexture.wrapT = THREE.ClampToEdgeWrapping;

const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

export const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 40000);
planet.rotation.y = Math.PI + Math.PI;
scene.add(planet);

// Create atmosphere material using MeshStandardMaterial
const atmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff, // Light blue color for atmosphere
    transparent: true,
    opacity: 0.2, // Adjust opacity to make it less dominant
    side: THREE.DoubleSide // Ensure it is visible from both sides
});

const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
atmosphere.position.set(0, 0, 40000); // Ensure it has the same origin as the planet
scene.add(atmosphere); // Add atmosphere to the scene


// Load sun texture
const sunTexture = textureLoader.load('skybox/2k_sun.jpg'); // Load the sun texture

// Create the sun
const sunRadius = planetRadius * 5; 
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunMaterial = new THREE.MeshStandardMaterial({
    map: sunTexture, // Use the sun texture
    emissive: 0xffffff, // Set emissive color to white
    emissiveIntensity: 0.4, // Adjust emissive intensity
    side: THREE.FrontSide
});

// Create the sun mesh
export const sun = new THREE.Mesh(sunGeometry, sunMaterial); // Export sun for collision use
sun.position.set(0, 0, 0); // Set the position of the sun to the center of the skybox
scene.add(sun); // Add sun to the scene

// Create a point light at the sun's position
const sunLight = new THREE.PointLight(0xffffff, 2, 45000); // Increased intensity for a stronger glow
sunLight.position.copy(sun.position); // Position the light at the sun's position
scene.add(sunLight); // Add the light to the scene

// Blazing effect using a shader material
const blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.5 }, // Reduced intensity for a less extreme effect
        baseColor: { value: new THREE.Vector3(1.0, 0.5, 0.0) }, // Orange base
        noiseScale: { value: 2.0 } // Control noise detail
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 baseColor;
        uniform float noiseScale;
        varying vec3 vNormal;
        varying vec3 vPosition;

        float noise(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        void main() {
            vec3 pos = vPosition * noiseScale;
            float n = noise(pos + time * 0.5); // Animated noise
            float glow = sin(time * 5.0 + length(vPosition) * 2.0) * 0.5 + 0.5;
            float pulse = (n * 0.5 + glow * 0.5) * intensity * 0.5; // Reduced pulse effect
            vec3 color = baseColor * (1.0 + pulse * 0.5);
            float alpha = clamp(pulse * 0.8, 0.2, 0.9); // Dynamic opacity
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// Create a blazing sphere around the sun
const blazingGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 64, 64);
const blazingEffect = new THREE.Mesh(blazingGeometry, blazingMaterial);
blazingEffect.position.copy(sun.position); // Align with sun
scene.add(blazingEffect); // Add blazing effect to the scene

// Animation loop for the blazing effect
function animateSun() {
    blazingMaterial.uniforms.time.value += 0.02; // Update time for animation
    blazingEffect.scale.setScalar(0.9 + Math.sin(blazingMaterial.uniforms.time.value * 1.0) * 0.05); // Subtle pulsing
    requestAnimationFrame(animateSun);
}
animateSun(); // Start the animation

// If you have a halo effect, ensure it is also centered
const haloGeometry = new THREE.SphereGeometry(1.2, 32, 32); // Slightly larger than the sun
const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 }); // Semi-transparent halo
const halo = new THREE.Mesh(haloGeometry, haloMaterial);

// Set the halo position to match the sun
halo.position.copy(sun.position); // Centered with the sun

// Add the halo to the scene
scene.add(halo);

// Renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1, 1, -1).normalize();
scene.add(directionalLight);

const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
sideLight.position.set(-1, -1, 1).normalize();
scene.add(sideLight);

scene.background = new THREE.Color(0x000000);

// X-wing spacecraft
export const spacecraft = new THREE.Group();

// Materials
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

export const engineGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.9
});

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
            float pulse = (sin(t) * 0.5 + 0.5) * 0.3;
            float glow = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
            vec3 coreColor = vec3(1.0, 0.0, 1.0);
            vec3 outerColor = vec3(0.8, 0.2, 1.0);
            vec3 color = mix(outerColor, coreColor, glow + pulse);
            glow *= (1.0 + intensity * 1.5);
            color *= (1.0 + intensity * 0.5);
            color *= 1.5 + intensity * 0.5;
            gl_FragColor = vec4(color, (glow + pulse) * (0.7 + intensity * 0.3));
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
});

export const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.7
});

// Fuselage
const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12);
const fuselage = new THREE.Mesh(fuselageGeometry, paintMaterial);
fuselage.rotation.z = Math.PI / 2;
spacecraft.add(fuselage);

const fuselageDetailGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
const detailPositions = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
detailPositions.forEach(pos => {
    const detail = new THREE.Mesh(fuselageDetailGeometry, metalMaterial);
    detail.rotation.z = Math.PI / 2;
    detail.position.z = pos;
    fuselage.add(detail);
});

// Nose
const noseGeometry = new THREE.CylinderGeometry(0.3, 0.05, 1.2, 12);
const nose = new THREE.Mesh(noseGeometry, paintMaterial);
nose.position.z = 2.35;
nose.rotation.x = Math.PI / 2;
spacecraft.add(nose);

const noseRingGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 24);
const noseRing1 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing1.position.z = 2.0;
spacecraft.add(noseRing1);

const noseRing2 = new THREE.Mesh(noseRingGeometry, metalMaterial);
noseRing2.position.z = 2.3;
spacecraft.add(noseRing2);

// Cockpit
const cockpitGeometry = new THREE.SphereGeometry(0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitOuter = new THREE.Mesh(cockpitGeometry, metalMaterial);
cockpitOuter.position.set(0, 0.25, 0);
spacecraft.add(cockpitOuter);

const cockpitGlassGeometry = new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
const cockpitGlass = new THREE.Mesh(cockpitGlassGeometry, glassMaterial);
cockpitGlass.position.set(0, 0.25, 0);
spacecraft.add(cockpitGlass);

// Engines
const engineGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12);
const enginePositions = [
    { x: 0.4, y: 0.3, z: -1 },
    { x: -0.4, y: 0.3, z: -1 },
    { x: 0.4, y: -0.3, z: -1 },
    { x: -0.4, y: -0.3, z: -1 }
];

enginePositions.forEach(pos => {
    const engine = new THREE.Mesh(engineGeometry, metalMaterial);
    engine.position.set(pos.x, pos.y, pos.z);
    engine.rotation.x = Math.PI / 2;
    spacecraft.add(engine);

    const intakeGeometry = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
    const intake = new THREE.Mesh(intakeGeometry, darkMetalMaterial);
    intake.position.set(pos.x, pos.y, pos.z - 0.4);
    spacecraft.add(intake);

    const innerGlowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
    const innerGlow = new THREE.Mesh(innerGlowGeometry, engineGlowMaterial);
    innerGlow.position.set(pos.x, pos.y, pos.z + 0.35);
    innerGlow.rotation.x = Math.PI / 2;
    spacecraft.add(innerGlow);

    const glowSphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
    glowSphere.position.set(pos.x, pos.y, pos.z - 0.4);
    glowSphere.visible = true;
    spacecraft.add(glowSphere);
});

let engineTime = 0;
export function updateEngineEffects(isBoost) {
    engineTime += 0.016;
    spacecraft.traverse((child) => {
        if (child.material === boostFlameMaterial) {
            child.material.uniforms.time.value = engineTime;
            child.material.uniforms.intensity.value = isBoost ? 1.0 : 0.0;
            child.scale.setScalar(isBoost ? 1.5 : 1.0);
        }
    });
}

// Wing creation
export function createWing(x, y, z, rotationZ) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(x, y, z);
    wingGroup.rotation.z = rotationZ;

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

    const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.08);
    const stripe1 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe1.position.set(0.6, 0, 0);
    wingGroup.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
    stripe2.position.set(1.2, 0, 0);
    wingGroup.add(stripe2);

    const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
    const wingTip = new THREE.Mesh(wingTipGeometry, metalMaterial);
    wingTip.position.set(2.5, 0, 0);
    wingTip.rotation.z = Math.PI / 2;
    wingGroup.add(wingTip);

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

export const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
export const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
export const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
export const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
spacecraft.add(topRightWing);
spacecraft.add(bottomRightWing);
spacecraft.add(topLeftWing);
spacecraft.add(bottomLeftWing);

// Struts
function createEnhancedStrut(x, y, z, rotationZ) {
    const strutGroup = new THREE.Group();
    const strutGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.08);
    const strut = new THREE.Mesh(strutGeometry, metalMaterial);
    strut.position.set(x, y, z - 0.5);
    strut.rotation.z = rotationZ;
    strutGroup.add(strut);

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

// Surface details
function addSurfaceDetails() {
    const panelLineGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.5);
    const panelLineMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5,
        roughness: 0.8
    });

    for (let i = 0; i < 8; i++) {
        const panelLine = new THREE.Mesh(panelLineGeometry, panelLineMaterial);
        panelLine.position.set(0.2, 0.1, -1 + i * 0.5);
        spacecraft.add(panelLine);
    }

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

const xwingLight = new THREE.PointLight(0xffffff, 0.5);
xwingLight.position.set(0, 2, 0);
spacecraft.add(xwingLight);

// Set the starting position of the spacecraft with an offset
spacecraft.position.set(3000, 1000, 45000); // New position with offsets

// Make the spacecraft look towards the center point between the Earth and the Sun
const centerPoint = new THREE.Vector3(0, 0, 10000); // Midpoint between the sun and the planet
spacecraft.lookAt(centerPoint); // Orient the spacecraft to face the center point

// Add the spacecraft to the scene
scene.add(spacecraft);

// Laser setup
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

// Create virtual objects to track wingtips, parented to each wing
const wingtipObjects = [
    new THREE.Object3D(), // Right top
    new THREE.Object3D(), // Right bottom
    new THREE.Object3D(), // Left top
    new THREE.Object3D()  // Left bottom
];

// Updated offsets to match cannon tips
const wingtipOffsets = [
    new THREE.Vector3(3.0, 0, 0.2),  // Right top cannon
    new THREE.Vector3(3.0, 0, -0.2), // Right bottom cannon
    new THREE.Vector3(-3.0, 0, 0.2), // Left top cannon
    new THREE.Vector3(-3.0, 0, -0.2) // Left bottom cannon
];

// Parent wingtip objects to their respective wings
wingtipObjects[0].position.copy(wingtipOffsets[0]);
topRightWing.add(wingtipObjects[0]);

wingtipObjects[1].position.copy(wingtipOffsets[1]);
bottomRightWing.add(wingtipObjects[1]);

wingtipObjects[2].position.copy(wingtipOffsets[2]);
topLeftWing.add(wingtipObjects[2]);

wingtipObjects[3].position.copy(wingtipOffsets[3]);
bottomLeftWing.add(wingtipObjects[3]);

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

    wingtipObjects.forEach(obj => {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.05),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        obj.add(marker);
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

// Stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 100000;
const starRange = 250000;
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
        
        positions[i + 2] -= 0.1;

        if (starZ < spacecraftZ - halfRange) {
            positions[i] = (Math.random() - 0.5) * starRange;
            positions[i + 1] = (Math.random() - 0.5) * starRange;
            positions[i + 2] = spacecraftZ + halfRange + (Math.random() * starRange);
        }
    }
    stars.geometry.attributes.position.needsUpdate = true;
}

export const PLANET_RADIUS = planetRadius;
export const PLANET_POSITION = planet.position;

// Load cloud texture for Earth
const cloudTexture = textureLoader.load('skybox/Earth-clouds.png'); // Load the cloud texture
cloudTexture.wrapS = THREE.RepeatWrapping; // Repeat the texture
cloudTexture.wrapT = THREE.RepeatWrapping; // Repeat the texture

// Function to create cloud layer for Earth
function createCloudLayerForEarth() {
    const cloudMaterial = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.5, // Adjust opacity for a subtle effect
        side: THREE.DoubleSide
    });

    const cloudGeometry = new THREE.SphereGeometry(atmosphereRadius + 5, 64, 64); // Slightly above the planet
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.position.set(0, 0, planet.position.z); // Position it at the same height as the planet
    scene.add(cloudMesh); // Add cloud mesh to the scene

    // Animate clouds to rotate slowly
    function animateClouds() {
        cloudMesh.rotation.y += 0.0005; // Adjust speed for a subtle swirl
        requestAnimationFrame(animateClouds); // Continue the animation
    }
    animateClouds(); // Start the cloud animation
}

// Create clouds for Earth
createCloudLayerForEarth();

// Create Mercury
const mercuryRadius = 1000; // Radius of Mercury
const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32); // Geometry for Mercury

// Load Mercury texture
const mercuryTexture = textureLoader.load('skybox/2k_mercury.jpg'); // Updated texture path

const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture, // Use the updated Mercury texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Mercury mesh
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
mercury.position.set(0, 0, 20000); // Position Mercury 20,000 units from the Sun
scene.add(mercury); // Add Mercury to the scene

// Create Venus
const venusRadius = 2000; // Radius of Venus
const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32); // Geometry for Venus

// Load Venus texture
const venusTexture = textureLoader.load('skybox/2k_venus_surface.jpg'); // Updated texture path

const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture, // Use the updated Venus texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Venus mesh
const venus = new THREE.Mesh(venusGeometry, venusMaterial);
venus.position.set(0, 0, 27000); // Position Venus 25,000 units from the Sun
scene.add(venus); // Add Venus to the scene

// Create atmosphere material for Venus
const venusAtmosphereThickness = 50; // Thickness of the atmosphere
const venusAtmosphereRadius = venusRadius + venusAtmosphereThickness; // Radius for the atmosphere
const venusAtmosphereGeometry = new THREE.SphereGeometry(venusAtmosphereRadius, 64, 64); // Atmosphere geometry

const venusAtmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00, // Change to yellow color for atmosphere
    transparent: true,
    opacity: 0.2, // Adjust opacity to make it less dominant
    side: THREE.DoubleSide // Ensure it is visible from both sides
});

const venusAtmosphere = new THREE.Mesh(venusAtmosphereGeometry, venusAtmosphereMaterial);
venusAtmosphere.position.set(0, 0, 27000); // Position it at the same height as Venus
scene.add(venusAtmosphere); // Add atmosphere to the scene

// Create cloud layer material for yellow-brown clouds for Venus
const venusCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture, // Use the same cloud texture as Earth
    transparent: true,
    opacity: 0.5, // Adjust opacity for a subtle effect
    side: THREE.DoubleSide,
    color: 0xD2B48C // Yellow-brown color for Venus clouds
});

// Create cloud sphere slightly above the atmosphere for Venus
const venusCloudGeometry = new THREE.SphereGeometry(venusAtmosphereRadius + 5, 64, 64); // Slightly above the atmosphere
const venusCloudMesh = new THREE.Mesh(venusCloudGeometry, venusCloudMaterial);
venusCloudMesh.position.set(0, 0, 27000); // Position it at the same height as Venus
scene.add(venusCloudMesh); // Add cloud mesh to the scene

// Animate clouds to rotate slowly for Venus
function animateVenusClouds() {
    venusCloudMesh.rotation.y += 0.0003; // Adjust speed for a subtle swirl
    requestAnimationFrame(animateVenusClouds); // Continue the animation
}
animateVenusClouds(); // Start the cloud animation

// Create Mars
const marsRadius = 1500; // Radius of Mars
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32); // Geometry for Mars

// Load Mars texture
const marsTexture = textureLoader.load('skybox/2k_mars.jpg'); // Correct texture path for Mars

const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture, // Use the Mars texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Mars mesh
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
mars.position.set(0, 0, 50000); // Position Mars 40,000 units from the Sun
scene.add(mars); // Add Mars to the scene

// Create Jupiter
const jupiterRadius = 5000; // Radius of Jupiter
const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32); // Geometry for Jupiter

// Load Jupiter texture
const jupiterTexture = textureLoader.load('skybox/2k_jupiter.jpg'); // Correct texture path for Jupiter

const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: jupiterTexture, // Use the Jupiter texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Jupiter mesh
const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiter.position.set(0, 0, 60000); // Position Jupiter 60,000 units from the Sun
scene.add(jupiter); // Add Jupiter to the scene

// Create Saturn
const saturnRadius = 4000; // Radius of Saturn
const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32); // Geometry for Saturn

// Load Saturn texture (you can replace this with the actual texture path)
const saturnTexture = textureLoader.load('skybox/2k_saturn.jpg'); // Replace with actual texture path

const saturnMaterial = new THREE.MeshStandardMaterial({
    map: saturnTexture, // Use the Saturn texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Saturn mesh
const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturn.position.set(0, 0, 80000); // Position Saturn 70,000 units from the Sun
scene.add(saturn); // Add Saturn to the scene

// Load ring texture
const ringTexture = textureLoader.load('skybox/saturn_rings.png'); // Replace with the actual texture path

// Create ring geometry
const ringRadius = 5000; // Radius of the ring (slightly larger than Saturn)
const ringThickness = 20; // Increased thickness of the ring
const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + ringThickness, 64); // Create ring geometry

// Create ring material
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture, // Use the loaded ring texture
    side: THREE.DoubleSide, // Ensure visibility from both sides
    transparent: true, // Allow for transparency
    opacity: 0.8 // Set opacity for the ring
});

// Create the ring mesh
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2; // Rotate the rings to be flat
saturnRings.position.set(0, 0, 80000); // Position the rings at the same height as Saturn

// Add the rings to the scene
scene.add(saturnRings);

// Create Uranus
const uranusRadius = 3000; // Radius of Uranus
const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32); // Geometry for Uranus

// Load Uranus texture (you can replace this with the actual texture path)
const uranusTexture = textureLoader.load('skybox/2k_uranus.jpg'); // Replace with actual texture path

const uranusMaterial = new THREE.MeshStandardMaterial({
    map: uranusTexture, // Use the Uranus texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Uranus mesh
const uranus = new THREE.Mesh(uranusGeometry, uranusMaterial);
uranus.position.set(0, 0, 95000); // Position Uranus 95,000 units from the Sun
scene.add(uranus); // Add Uranus to the scene

// Create Neptune
const neptuneRadius = 3000; // Radius of Neptune
const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32); // Geometry for Neptune

// Load Neptune texture (you can replace this with the actual texture path)
const neptuneTexture = textureLoader.load('skybox/2k_neptune.jpg'); // Replace with actual texture path

const neptuneMaterial = new THREE.MeshStandardMaterial({
    map: neptuneTexture, // Use the Neptune texture
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});

// Create the Neptune mesh
const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptune.position.set(0, 0, 110000); // Position Neptune 110,000 units from the Sun
scene.add(neptune); // Add Neptune to the scene

// Create cloud layer material for dusty brown/red clouds for Mars
const redCloudTexture = textureLoader.load('skybox/Earth-clouds.png'); // Load the cloud texture
redCloudTexture.wrapS = THREE.RepeatWrapping; // Repeat the texture
redCloudTexture.wrapT = THREE.RepeatWrapping; // Repeat the texture

// Function to create dusty brown/red cloud layer for Mars
function createDustyBrownCloudLayer(planetRadius, positionZ) {
    const dustyBrownCloudMaterial = new THREE.MeshStandardMaterial({
        map: redCloudTexture,
        transparent: true,
        opacity: 0.5, // Adjust opacity for a subtle effect
        side: THREE.DoubleSide,
        color: 0x8B4513 // Dusty brown color
    });

    const cloudGeometry = new THREE.SphereGeometry(planetRadius + 5, 64, 64); // Slightly above the planet
    const cloudMesh = new THREE.Mesh(cloudGeometry, dustyBrownCloudMaterial);
    cloudMesh.position.set(0, 0, positionZ); // Position it at the same height as the planet
    scene.add(cloudMesh); // Add cloud mesh to the scene

    // Animate clouds to rotate slowly
    function animateClouds() {
        cloudMesh.rotation.y += 0.0005; // Adjust speed for a subtle swirl
        requestAnimationFrame(animateClouds); // Continue the animation
    }
    animateClouds(); // Start the cloud animation
}

// Create dusty brown clouds for Mars
createDustyBrownCloudLayer(marsRadius, mars.position.z);

// Load cloud texture for Jupiter
const jupiterCloudTexture = textureLoader.load('skybox/Earth-clouds.png'); // Load the cloud texture
jupiterCloudTexture.wrapS = THREE.RepeatWrapping; // Repeat the texture
jupiterCloudTexture.wrapT = THREE.RepeatWrapping; // Repeat the texture

// Function to create dark brown cloud layer for Jupiter
function createDarkCloudLayer(planetRadius, positionZ) {
    const darkCloudMaterial = new THREE.MeshStandardMaterial({
        map: jupiterCloudTexture,
        transparent: true,
        opacity: 0.5, // Adjust opacity for a subtle effect
        side: THREE.DoubleSide,
        color: 0x8B4513 // Darker brown color for Jupiter
    });

    const cloudGeometry = new THREE.SphereGeometry(planetRadius + 5, 64, 64); // Slightly above the planet
    const cloudMesh = new THREE.Mesh(cloudGeometry, darkCloudMaterial);
    cloudMesh.position.set(0, 0, positionZ); // Position it at the same height as the planet
    scene.add(cloudMesh); // Add cloud mesh to the scene

    // Animate clouds to rotate slowly
    function animateClouds() {
        cloudMesh.rotation.y += 0.0005; // Adjust speed for a subtle swirl
        requestAnimationFrame(animateClouds); // Continue the animation
    }
    animateClouds(); // Start the cloud animation
}

// Create dark clouds for Jupiter
createDarkCloudLayer(jupiterRadius, jupiter.position.z);

// Function to create very deep brown cloud layer for Mars
function createVeryDeepBrownCloudLayer(planetRadius, positionZ) {
    const veryDeepBrownCloudMaterial = new THREE.MeshStandardMaterial({
        map: redCloudTexture,
        transparent: true,
        opacity: 0.5, // Adjust opacity for a subtle effect
        side: THREE.DoubleSide,
        color: 0x4B3D3D // Very deep brown color for Mars
    });

    const cloudGeometry = new THREE.SphereGeometry(planetRadius + 5, 64, 64); // Slightly above the planet
    const cloudMesh = new THREE.Mesh(cloudGeometry, veryDeepBrownCloudMaterial);
    cloudMesh.position.set(0, 0, positionZ); // Position it at the same height as the planet
    scene.add(cloudMesh); // Add cloud mesh to the scene

    // Animate clouds to rotate slowly
    function animateClouds() {
        cloudMesh.rotation.y += 0.0005; // Adjust speed for a subtle swirl
        requestAnimationFrame(animateClouds); // Continue the animation
    }
    animateClouds(); // Start the cloud animation
}

// Create very deep brown clouds for Mars
createVeryDeepBrownCloudLayer(marsRadius, mars.position.z);

// Update Mars' cloud color to very dark brown
function createVeryDarkBrownCloudLayer(planetRadius, positionZ) {
    const veryDarkBrownCloudMaterial = new THREE.MeshStandardMaterial({
        map: redCloudTexture,
        transparent: true,
        opacity: 0.5, // Adjust opacity for a subtle effect
        side: THREE.DoubleSide,
        color: 0x3B2A2A // Very dark brown color for Mars
    });

    const cloudGeometry = new THREE.SphereGeometry(planetRadius + 5, 64, 64); // Slightly above the planet
    const cloudMesh = new THREE.Mesh(cloudGeometry, veryDarkBrownCloudMaterial);
    cloudMesh.position.set(0, 0, positionZ); // Position it at the same height as the planet
    scene.add(cloudMesh); // Add cloud mesh to the scene

    // Animate clouds to rotate slowly
    function animateClouds() {
        cloudMesh.rotation.y += 0.0005; // Adjust speed for a subtle swirl
        requestAnimationFrame(animateClouds); // Continue the animation
    }
    animateClouds(); // Start the cloud animation
}

// Create very dark brown clouds for Mars
createVeryDarkBrownCloudLayer(marsRadius, mars.position.z);


// Hyperspace variables
let isHyperspaceActive = false;
let hyperspaceInterval = null;

// Function to activate hyperspace
function activateHyperspace() {
    if (!isHyperspaceActive) {
        isHyperspaceActive = true;
        // Start hyperspace effect (e.g., increase speed, change visuals)
        console.log("Hyperspace activated!");
        // You can add your hyperspace logic here
    }
}

// Function to deactivate hyperspace
function deactivateHyperspace() {
    if (isHyperspaceActive) {
        isHyperspaceActive = false;
        // Stop hyperspace effect
        console.log("Hyperspace deactivated!");
        // You can add logic to revert hyperspace effects here
    }
}

// Event listeners for Shift key
window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
        activateHyperspace();
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        deactivateHyperspace();
    }
});