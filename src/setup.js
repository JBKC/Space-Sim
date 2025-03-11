// Import THREE.js (assuming it's included elsewhere)
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Skybox setup
const skyboxTexture = textureLoader.load('skybox/galaxy5.jpeg');
const skyboxGeometry = new THREE.BoxGeometry(250000, 250000, 250000);
const skyboxMaterial = new THREE.MeshBasicMaterial({ map: skyboxTexture, side: THREE.BackSide });
const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
scene.add(skybox);

// --- Sun Setup ---
const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunRadius = 10000;
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunTexture = textureLoader.load('skybox/2k_sun.jpg');
const sunMaterial = new THREE.MeshStandardMaterial({
    map: sunTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
    side: THREE.FrontSide
});
export const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sunGroup.add(sun);

// Blazing effect
const blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.5 },
        baseColor: { value: new THREE.Vector3(1.0, 0.5, 0.0) },
        noiseScale: { value: 2.0 }
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
            float n = noise(pos + time * 0.5);
            float glow = sin(time * 5.0 + length(vPosition) * 2.0) * 0.5 + 0.5;
            float pulse = (n * 0.5 + glow * 0.5) * intensity * 0.5;
            vec3 color = baseColor * (1.0 + pulse * 0.5);
            float alpha = clamp(pulse * 0.8, 0.2, 0.9);
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const blazingGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 64, 64);
const blazingEffect = new THREE.Mesh(blazingGeometry, blazingMaterial);
sunGroup.add(blazingEffect);

// Halo
const haloGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
sunGroup.add(halo);

// Sun light
const sunLight = new THREE.PointLight(0xffffff, 2, 45000);
sunGroup.add(sunLight);

sunGroup.position.set(0, 0, 0);

function animateSun() {
    blazingMaterial.uniforms.time.value += 0.02;
    blazingEffect.scale.setScalar(0.9 + Math.sin(blazingMaterial.uniforms.time.value * 1.0) * 0.05);
    requestAnimationFrame(animateSun);
}
animateSun();


// ... [All your existing setup.js code up to planet definitions] ...

// Planet definitions and randomization
const planetGroups = [];
const positionRange = 100000; // Not used directly, kept for reference

// --- Mercury Setup ---
const mercuryGroup = new THREE.Group();
scene.add(mercuryGroup);
const mercuryRadius = 1000;
const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
const mercuryTexture = textureLoader.load('skybox/2k_mercury.jpg');
const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
mercuryGroup.add(mercury);
planetGroups.push({ group: mercuryGroup, z: 20000 });

// --- Venus Setup ---
const venusGroup = new THREE.Group();
scene.add(venusGroup);
const venusRadius = 2000;
const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
const venusTexture = textureLoader.load('skybox/2k_venus_surface.jpg');
const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const venus = new THREE.Mesh(venusGeometry, venusMaterial);
venusGroup.add(venus);
const venusAtmosphereThickness = 50;
const venusAtmosphereRadius = venusRadius + venusAtmosphereThickness;
const venusAtmosphereGeometry = new THREE.SphereGeometry(venusAtmosphereRadius, 64, 64);
const venusAtmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const venusAtmosphere = new THREE.Mesh(venusAtmosphereGeometry, venusAtmosphereMaterial);
venusGroup.add(venusAtmosphere);
const cloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const venusCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x8B8000
});
const venusCloudGeometry = new THREE.SphereGeometry(venusAtmosphereRadius + 5, 64, 64);
const venusCloudMesh = new THREE.Mesh(venusCloudGeometry, venusCloudMaterial);
venusGroup.add(venusCloudMesh);
planetGroups.push({ group: venusGroup, z: 27000 });

function animateVenusClouds() {
    venusCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateVenusClouds);
}
animateVenusClouds();

// --- Earth Setup ---
const earthGroup = new THREE.Group();
scene.add(earthGroup);
const planetRadius = 2000;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 64, 64);
const planetTexture = textureLoader.load('skybox/2k_earth_daymap.jpg');
const planetMaterial = new THREE.MeshStandardMaterial({
    map: planetTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const planet = new THREE.Mesh(planetGeometry, planetMaterial);
earthGroup.add(planet);
const atmosphereThickness = 50;
const atmosphereRadius = planetRadius + atmosphereThickness;
const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64);
const atmosphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
earthGroup.add(atmosphere);
const earthCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
});
const earthCloudGeometry = new THREE.SphereGeometry(atmosphereRadius + 5, 64, 64);
const earthCloudMesh = new THREE.Mesh(earthCloudGeometry, earthCloudMaterial);
earthGroup.add(earthCloudMesh);
planetGroups.push({ group: earthGroup, z: 40000 });

function animateEarthClouds() {
    earthCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateEarthClouds);
}
animateEarthClouds();

// --- Mars Setup ---
const marsGroup = new THREE.Group();
scene.add(marsGroup);
const marsRadius = 1500;
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
const marsTexture = textureLoader.load('skybox/2k_mars.jpg');
const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
marsGroup.add(mars);
const redCloudTexture = textureLoader.load('skybox/Earth-clouds.png');
const marsCloudMaterial = new THREE.MeshStandardMaterial({
    map: redCloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x3B2A2A
});
const marsCloudGeometry = new THREE.SphereGeometry(marsRadius + 5, 64, 64);
const marsCloudMesh = new THREE.Mesh(marsCloudGeometry, marsCloudMaterial);
marsGroup.add(marsCloudMesh);
planetGroups.push({ group: marsGroup, z: 50000 });

function animateMarsClouds() {
    marsCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateMarsClouds);
}
animateMarsClouds();

// --- Jupiter Setup ---
const jupiterGroup = new THREE.Group();
scene.add(jupiterGroup);
const jupiterRadius = 5000;
const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32);
const jupiterTexture = textureLoader.load('skybox/2k_jupiter.jpg');
const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: jupiterTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiterGroup.add(jupiter);
planetGroups.push({ group: jupiterGroup, z: 60000 });

function animateJupiterClouds() {
    requestAnimationFrame(animateJupiterClouds);
}
animateJupiterClouds();

// --- Saturn Setup ---
const saturnGroup = new THREE.Group();
scene.add(saturnGroup);
const saturnRadius = 4000;
const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32);
const saturnTexture = textureLoader.load('skybox/2k_saturn.jpg');
const saturnMaterial = new THREE.MeshStandardMaterial({
    map: saturnTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturnGroup.add(saturn);
const ringTexture = textureLoader.load('skybox/saturn_rings.png');
const ringRadius = 5000;
const ringThickness = 20;
const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + ringThickness, 64);
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
});
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2;
saturnGroup.add(saturnRings);
planetGroups.push({ group: saturnGroup, z: 80000 });

// --- Uranus Setup ---
const uranusGroup = new THREE.Group();
scene.add(uranusGroup);
const uranusRadius = 3000;
const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32);
const uranusTexture = textureLoader.load('skybox/2k_uranus.jpg');
const uranusMaterial = new THREE.MeshStandardMaterial({
    map: uranusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const uranus = new THREE.Mesh(uranusGeometry, uranusMaterial);
uranusGroup.add(uranus);
planetGroups.push({ group: uranusGroup, z: 95000 });

// --- Neptune Setup ---
const neptuneGroup = new THREE.Group();
scene.add(neptuneGroup);
const neptuneRadius = 3000;
const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32);
const neptuneTexture = textureLoader.load('skybox/2k_neptune.jpg');
const neptuneMaterial = new THREE.MeshStandardMaterial({
    map: neptuneTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptuneGroup.add(neptune);
planetGroups.push({ group: neptuneGroup, z: 110000 });

// Randomize planet positions
planetGroups.forEach(planet => {
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const radius = planet.z; // Use original Z as radius
    planet.group.position.set(
        Math.cos(angle) * radius, // X
        Math.sin(angle) * radius, // Y
        0                         // Z = 0, XY plane
    );
    console.log(`${planet.group.name || 'Planet'} position:`, planet.group.position); // Debug
});


// Concentric circles (already updated to remove radial lines)
function createConcentricCircles() {
    const sunPosition = sunGroup.position; // (0, 0, 0)
    planetGroups.forEach(planet => {
        const planetPos = planet.group.position;
        const distance = sunPosition.distanceTo(planetPos);
        const angle = Math.atan2(planetPos.y, planetPos.x);

        const circleGeometry = new THREE.CircleGeometry(distance, 64);
        const vertices = circleGeometry.attributes.position.array;
        const ringVertices = new Float32Array(vertices.length - 3);
        for (let i = 3; i < vertices.length; i++) {
            ringVertices[i - 3] = vertices[i];
        }
        const ringGeometry = new THREE.BufferGeometry();
        ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringVertices, 3));
        const circleMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const circle = new THREE.LineLoop(ringGeometry, circleMaterial);

        circle.position.copy(sunPosition);
        circle.rotation.x = Math.PI / 2;
        circle.rotation.y = angle;
        scene.add(circle);
    });
}

createConcentricCircles();

// Planet labels
const labelData = [
    { group: mercuryGroup, name: 'Mercury', radius: 1000 },
    { group: venusGroup, name: 'Venus', radius: 2000 },
    { group: earthGroup, name: 'Earth', radius: 2000 },
    { group: marsGroup, name: 'Mars', radius: 1500 },
    { group: jupiterGroup, name: 'Jupiter', radius: 5000 },
    { group: saturnGroup, name: 'Saturn', radius: 4000 },
    { group: uranusGroup, name: 'Uranus', radius: 3000 },
    { group: neptuneGroup, name: 'Neptune', radius: 3000 }
];

// Create and store label elements
const labels = [];
labelData.forEach(planet => {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planet.name;
    document.body.appendChild(label); // Add to DOM
    labels.push({
        element: label,
        planetGroup: planet.group,
        radius: planet.radius
    });
});

// Function to update label positions
export function updatePlanetLabels() {
    const vector = new THREE.Vector3();
    labels.forEach(label => {
        // Get planet's world position
        label.planetGroup.getWorldPosition(vector);
        
        // Offset above the planet's surface
        vector.y += label.radius * 1.2; // Slightly above (adjust multiplier as needed)

        // Project 3D position to 2D screen coordinates
        vector.project(camera);

        // Convert to screen space (0 to 1 -> pixel coordinates)
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        // Position the label
        label.element.style.left = `${x}px`;
        label.element.style.top = `${y}px`;
        
        // Center the label horizontally
        label.element.style.transform = 'translateX(-50%)';
    });
}

// ... [Rest of your setup.js: renderer settings, spacecraft, hyperspace] ...



// Exports

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

// ... [Spacecraft setup unchanged] ...

// X-wing spacecraft
export const spacecraft = new THREE.Group();

// Materials
const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0 });
const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, metalness: 0.2, roughness: 0.7 });
const redPaintMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.2, roughness: 0.7 });
const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, transmission: 1, transparent: true, opacity: 0.3, envMapIntensity: 1.0 });
export const engineGlowMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
export const boostFlameMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 0.0 } },
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
export const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

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

    const wingExtrudeSettings = { steps: 1, depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
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
    const cannonPositions = [{ x: 3.0, y: 0, z: 0.2 }, { x: 3.0, y: 0, z: -0.2 }];
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
    const panelLineMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.8 });
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

spacecraft.position.set(50000, 50000, 50000);
const centerPoint = new THREE.Vector3(0, 0, 10000);
spacecraft.lookAt(centerPoint);
scene.add(spacecraft);

// Laser setup
const laserLength = 100;
const laserThickness = 0.15;
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

let activeLasers = [];
let isFiring = false;
let firingInterval = null;

const wingtipObjects = [
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D()
];
const wingtipOffsets = [
    new THREE.Vector3(3.0, 0, 0.2),
    new THREE.Vector3(3.0, 0, -0.2),
    new THREE.Vector3(-3.0, 0, 0.2),
    new THREE.Vector3(-3.0, 0, -0.2)
];
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
    laser.userData = { direction: direction.clone(), speed: 2, lifetime: 1000, startTime: performance.now() };
    return laser;
}

export function fireLasers() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(spacecraft.quaternion);
    wingtipObjects.forEach(obj => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
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
const starCount = 50000;
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
export const PLANET_POSITION = earthGroup.position;

// Hyperspace
let isHyperspaceActive = false;
function activateHyperspace() {
    if (!isHyperspaceActive) {
        isHyperspaceActive = true;
        console.log("Hyperspace activated!");
        setTimeout(deactivateHyperspace, 2000);
    }
}

function deactivateHyperspace() {
    if (isHyperspaceActive) {
        isHyperspaceActive = false;
        console.log("Hyperspace deactivated!");
    }
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') activateHyperspace();
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') deactivateHyperspace();
});

