// Script that initializes solar system physical assets

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { 
    loadingManager, 
    textureLoadingManager, 
    createEnhancedTextureLoader,
    modelLoader,
    loadModelFromRegistry,
    loadTexture
 } from '../appConfig/loaders.js';

 import config from '../appConfig/config.js';

// Create a texture loader that tries multiple paths
const textureLoader = createEnhancedTextureLoader(config);
const loader = new GLTFLoader();

export const planetGroups = [];
// Use the new explicit texture loading for Earth clouds 
const cloudTexture = loadTexture('planets', 'earthClouds');
const collisionMaterialInvisible = new THREE.MeshBasicMaterial({ visible: false });




//////////////////////////////////////////////////////////////////////////////////////////////////////////////


///// Skybox
// Use the new explicit texture loading for skybox
const skyboxTexture = loadTexture('skybox', 'galaxy');
const skyboxGeometry = new THREE.BoxGeometry(250000, 250000, 250000);
const skyboxMaterial = new THREE.MeshBasicMaterial({
    map: skyboxTexture,
    side: THREE.BackSide,
    depthWrite: false, // Prevent depth interference
    depthTest: false,  // Avoid rendering issues
    color: 0x555555    // Add darker color tint to make the skybox darker (was previously white/0xffffff by default)
});
export const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
skybox.position.set(0, 0, 0); // Ensure centered at origin


///// Stars
const starGeometry = new THREE.BufferGeometry();
export const starCount = 1000000;
export const starRange = 500000;
export const starPositions = new Float32Array(starCount * 3);
export const starColors = new Float32Array(starCount * 3);
export const starSizes = new Float32Array(starCount);

// Create stars with varying distances and initial brightness
for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    
    // Random position in a large sphere around the origin
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = starRange * Math.pow(Math.random(), 1/3); // Cube root for even volumetric distribution
    
    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i3 + 2] = radius * Math.cos(phi);
    
    // Store initial bright white color (will be attenuated based on distance)
    starColors[i3] = 1.0;     // R
    starColors[i3 + 1] = 1.0; // G
    starColors[i3 + 2] = 1.0; // B
    
    // Vary star sizes slightly (between 1 and 3)
    starSizes[i] = 1 + Math.random() * 2;
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starMaterial = new THREE.PointsMaterial({ 
    color: 0xffffff,
    size: 25,
    vertexColors: true, // Use the color attribute
    sizeAttenuation: true, // Make distant stars smaller
    transparent: true,
    opacity: 1.0 // Full opacity
});

export const stars = new THREE.Points(starGeometry, starMaterial);

// --- Sun Setup ---
export const sunGroup = new THREE.Group();

const sunRadius = 10000;
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
// Use the new explicit texture loading for sun
const sunTexture = loadTexture('planets', 'sun');
const sunMaterial = new THREE.MeshStandardMaterial({
    map: sunTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.3, // Reduced from 0.4 to 0.3
    side: THREE.FrontSide
});
export const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sunGroup.add(sun);

// Blazing effect
export const blazingMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        intensity: { value: 0.4 }, // Reduced from 0.5 to 0.4
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
export const blazingEffect = new THREE.Mesh(blazingGeometry, blazingMaterial);
sunGroup.add(blazingEffect);

// Halo
const haloGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
sunGroup.add(halo);

// Sun light
const sunLight = new THREE.PointLight(0xffffdd, 1.2, 35000); // Slightly more focused with a warmer color
sunLight.castShadow = true; // Enable shadow casting
sunLight.shadow.bias = -0.0001; // Reduce shadow acne
sunGroup.add(sunLight);

sunGroup.position.set(0, 0, 0);

// --- Mercury Setup ---
export const mercuryGroup = new THREE.Group();
const mercuryRadius = 1000;
const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
// Use the new explicit texture loading for Mercury
const mercuryTexture = loadTexture('planets', 'mercury');
const mercuryMaterial = new THREE.MeshStandardMaterial({
    map: mercuryTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
mercuryGroup.add(mercury);

// Add collision sphere for Mercury (50% larger)
const mercuryCollisionGeometry = new THREE.SphereGeometry(mercuryRadius * 1.5, 16, 16);
export const mercuryCollisionSphere = new THREE.Mesh(mercuryCollisionGeometry, collisionMaterialInvisible);
mercuryGroup.add(mercuryCollisionSphere);

planetGroups.push({ group: mercuryGroup, z: 20000 });

// --- Venus Setup ---
export const venusGroup = new THREE.Group();
const venusRadius = 2000;
const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
// Use the new explicit texture loading for Venus
const venusTexture = loadTexture('planets', 'venus');
const venusMaterial = new THREE.MeshStandardMaterial({
    map: venusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const venus = new THREE.Mesh(venusGeometry, venusMaterial);
venusGroup.add(venus);

// Add collision sphere for Venus (50% larger)
const venusCollisionGeometry = new THREE.SphereGeometry(venusRadius * 1.5, 16, 16);
export const venusCollisionSphere = new THREE.Mesh(venusCollisionGeometry, collisionMaterialInvisible);
venusGroup.add(venusCollisionSphere);

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

const venusCloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x8B8000
});
const venusCloudGeometry = new THREE.SphereGeometry(venusAtmosphereRadius + 5, 64, 64);
export const venusCloudMesh = new THREE.Mesh(venusCloudGeometry, venusCloudMaterial);
venusGroup.add(venusCloudMesh);
planetGroups.push({ group: venusGroup, z: 27000 });


// --- Earth Setup ---
export const earthGroup = new THREE.Group();
export const earthRadius = 2000;
const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
// Use the new explicit texture loading for Earth
const earthTexture = loadTexture('planets', 'earth');
const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const planet = new THREE.Mesh(earthGeometry, earthMaterial);
earthGroup.add(planet);

// Add collision sphere for Earth (50% larger)
const earthCollisionGeometry = new THREE.SphereGeometry(earthRadius * 1.5, 16, 16);
export const earthCollisionSphere = new THREE.Mesh(earthCollisionGeometry, collisionMaterialInvisible);
earthGroup.add(earthCollisionSphere);

const atmosphereThickness = 50;
const atmosphereRadius = earthRadius + atmosphereThickness;
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
export const earthCloudMesh = new THREE.Mesh(earthCloudGeometry, earthCloudMaterial);
earthGroup.add(earthCloudMesh);
planetGroups.push({ group: earthGroup, z: 40000 });


// --- Moon Setup ---
export const moonGroup = new THREE.Group();
export const moonRadius = 500;
const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
// Use the new explicit texture loading for Moon
const moonTexture = loadTexture('planets', 'moon');
const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
export const moon = new THREE.Mesh(moonGeometry, moonMaterial);
moonGroup.add(moon);

// Add collision sphere for Moon (50% larger)
const moonCollisionGeometry = new THREE.SphereGeometry(moonRadius * 1.5, 16, 16);
export const moonCollisionSphere = new THREE.Mesh(moonCollisionGeometry, collisionMaterialInvisible);
moonGroup.add(moonCollisionSphere);

// Position the Moon globally, but still relative to Earth's orbit
export const moonOrbitRadius = 5000;
export const moonAngle = Math.random() * Math.PI * 2; // Random angle in radians


// Function that positions the Moon RELATIVE TO EARTH
export function updateMoonPosition() {
    const angle = Math.random() * Math.PI * 2;

    moonGroup.position.set(
        earthGroup.position.x + Math.cos(angle) * moonOrbitRadius,
        earthGroup.position.y + Math.sin(angle) * moonOrbitRadius,
        earthGroup.position.z // Keep it on Earth's orbital Z-plane
    );
}


// --- Mars Setup ---
export const marsGroup = new THREE.Group();
const marsRadius = 1500;
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
// Use the new explicit texture loading for Mars
const marsTexture = loadTexture('planets', 'mars');
const marsMaterial = new THREE.MeshStandardMaterial({
    map: marsTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const mars = new THREE.Mesh(marsGeometry, marsMaterial);
marsGroup.add(mars);

// Add collision sphere for Mars (50% larger)
const marsCollisionGeometry = new THREE.SphereGeometry(marsRadius * 1.5, 16, 16);
export const marsCollisionSphere = new THREE.Mesh(marsCollisionGeometry, collisionMaterialInvisible);
marsGroup.add(marsCollisionSphere);

const redCloudTexture = loadTexture('planets', 'earthClouds');
const marsCloudMaterial = new THREE.MeshStandardMaterial({
    map: redCloudTexture,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    color: 0x3B2A2A
});
const marsCloudGeometry = new THREE.SphereGeometry(marsRadius + 5, 64, 64);
export const marsCloudMesh = new THREE.Mesh(marsCloudGeometry, marsCloudMaterial);
marsGroup.add(marsCloudMesh);
planetGroups.push({ group: marsGroup, z: 50000 });


// --- Jupiter Setup ---
export const jupiterGroup = new THREE.Group();
const jupiterRadius = 4500;
const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32);
// Use the new explicit texture loading for Jupiter
const jupiterTexture = loadTexture('planets', 'jupiter');
const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: jupiterTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiterGroup.add(jupiter);

// Add collision sphere for Jupiter (50% larger)
const jupiterCollisionGeometry = new THREE.SphereGeometry(jupiterRadius * 1.5, 16, 16);
export const jupiterCollisionSphere = new THREE.Mesh(jupiterCollisionGeometry, collisionMaterialInvisible);
jupiterGroup.add(jupiterCollisionSphere);

planetGroups.push({ group: jupiterGroup, z: 60000 });


// --- Saturn Setup ---
export const saturnGroup = new THREE.Group();
const saturnRadius = 4000;
const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32);
// Use the new explicit texture loading for Saturn
const saturnTexture = loadTexture('planets', 'saturn');
const saturnMaterial = new THREE.MeshStandardMaterial({
    map: saturnTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturnGroup.add(saturn);

// Add collision sphere for Saturn (50% larger)
const saturnCollisionGeometry = new THREE.SphereGeometry(saturnRadius * 1.5, 16, 16);
export const saturnCollisionSphere = new THREE.Mesh(saturnCollisionGeometry, collisionMaterialInvisible);
saturnGroup.add(saturnCollisionSphere);


// Create 2 concentric Saturn rings
// Use the new explicit texture loading for Saturn's rings
const ringTexture = loadTexture('planets', 'saturnRing');

const ringOuterRadius = 8000;
const ringInnerRadius = 6000;
const tubeRadius = (ringOuterRadius - ringInnerRadius) / 2;
const ringRadius = ringInnerRadius + tubeRadius;
// Torus geometry
const ringGeometry = new THREE.TorusGeometry(
    ringRadius,      // radius of the entire torus
    tubeRadius,      // thickness of the tube
    2,               // radial segments
    64               // tubular segments
);

// Create a material for the rings
const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    flatShading: true
});

// Create the ring mesh and position it correctly
const saturnRings = new THREE.Mesh(ringGeometry, ringMaterial);
saturnRings.rotation.x = Math.PI / 2;  // Align with Saturn's equator
saturnGroup.add(saturnRings);

// Add a second, smaller ring
const ringOuterRadius2 = 5200;
const ringInnerRadius2 = 4400;
const tubeRadius2 = (ringOuterRadius2 - ringInnerRadius2) / 2;
const ringRadius2 = ringInnerRadius2 + tubeRadius2;
const ringGeometry2 = new THREE.TorusGeometry(
    ringRadius2,     // radius of the entire torus
    tubeRadius2,     // thickness of the tube
    2,               // radial segments
    64               // tubular segments
);

const ringMaterial2 = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    flatShading: true
});

const saturnRings2 = new THREE.Mesh(ringGeometry2, ringMaterial2);
saturnRings2.rotation.x = Math.PI / 2;  // Align with Saturn's equator
saturnGroup.add(saturnRings2);

planetGroups.push({ group: saturnGroup, z: 80000 });


// --- Uranus Setup ---
export const uranusGroup = new THREE.Group();
const uranusRadius = 3000;
const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32);
// Use the new explicit texture loading for Uranus
const uranusTexture = loadTexture('planets', 'uranus');
const uranusMaterial = new THREE.MeshStandardMaterial({
    map: uranusTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const uranus = new THREE.Mesh(uranusGeometry, uranusMaterial);
uranusGroup.add(uranus);

// Add collision sphere for Uranus (50% larger)
const uranusCollisionGeometry = new THREE.SphereGeometry(uranusRadius * 1.5, 16, 16);
export const uranusCollisionSphere = new THREE.Mesh(uranusCollisionGeometry, collisionMaterialInvisible);
uranusGroup.add(uranusCollisionSphere);

planetGroups.push({ group: uranusGroup, z: 95000 });

// --- Neptune Setup ---
export const neptuneGroup = new THREE.Group();
const neptuneRadius = 3000;
const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32);
// Use the new explicit texture loading for Neptune
const neptuneTexture = loadTexture('planets', 'neptune');
const neptuneMaterial = new THREE.MeshStandardMaterial({
    map: neptuneTexture,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.8
});
const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptuneGroup.add(neptune);

// Add collision sphere for Neptune (50% larger)
const neptuneCollisionGeometry = new THREE.SphereGeometry(neptuneRadius * 1.5, 16, 16);
export const neptuneCollisionSphere = new THREE.Mesh(neptuneCollisionGeometry, collisionMaterialInvisible);
neptuneGroup.add(neptuneCollisionSphere);

planetGroups.push({ group: neptuneGroup, z: 110000 });


/////// Star Wars elements are still part of the planetGroups array (as they have)

// --- Imperial Star Destroyer Setup ---
export const starDestroyerGroup = new THREE.Group();
starDestroyerGroup.name = "imperialStarDestroyer"; // Add name for reference

// Create the collision boxes that define the positions of the Star Destroyers (and then load the assets into them afterwards)
const collisionGeometry = new THREE.BoxGeometry(10000, 3000, 8000);
export const collisionBox1 = new THREE.Mesh(collisionGeometry, collisionMaterialInvisible);
collisionBox1.position.set(0, 0, 0);
collisionBox1.name = "starDestroyer1Collision";
starDestroyerGroup.add(collisionBox1);

export const collisionBox2 = new THREE.Mesh(collisionGeometry, collisionMaterialInvisible);
collisionBox2.position.set(-7000, 2000, 0);
collisionBox2.name = "starDestroyer2Collision";
starDestroyerGroup.add(collisionBox2);

// Load 2 Star Destroyer models using GLTFLoader

// Load the first Star Destroyer
console.log('Loading First Star Destroyer from registry');

// Load first Star Destroyer using registry
loadModelFromRegistry(
    'ships', 
    'starDestroyerII',
    
    // Success callback
    (gltf) => {
        const starDestroyer = gltf.scene;
        starDestroyer.scale.set(8, 8, 8);
        starDestroyer.rotation.y = Math.PI;
        starDestroyer.position.copy(collisionBox1.position);
        starDestroyerGroup.add(starDestroyer);
        console.log('First Imperial Star Destroyer loaded successfully from registry');
    },
    (xhr) => {
        console.log(`Loading Star Destroyer: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
    },
    (error) => {
        console.error('Error loading Star Destroyer from registry:', error);
    }
);

// Load second Star Destroyer using registry
loadModelFromRegistry(
    'ships',
    'starDestroyerII',
    (gltf) => {
        const secondStarDestroyer = gltf.scene;
        secondStarDestroyer.scale.set(8, 8, 8);
        secondStarDestroyer.rotation.y = Math.PI;
        secondStarDestroyer.position.copy(collisionBox2.position);
        starDestroyerGroup.add(secondStarDestroyer);
        console.log('Second Imperial Star Destroyer loaded successfully from registry');
    },
    (xhr) => {
        console.log(`Loading Star Destroyer 2: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
    },
    (error) => {
        console.error('Error loading Star Destroyer 2 from registry:', error);
    }
);

// Add to planet groups between Jupiter and Saturn
planetGroups.push({ group: starDestroyerGroup, z: 70000 });


// --- Lucrehulk Setup ---
export const lucrehulkGroup = new THREE.Group();
lucrehulkGroup.name = "lucrehulk"; // Add name for reference

// Create collision box for the Lucrehulk (for efficient raycast detection)
const lucrehulkCollisionGeometry = new THREE.CylinderGeometry(5000, 5000, 2000, 32);
export const lucrehulkCollisionBox = new THREE.Mesh(lucrehulkCollisionGeometry, collisionMaterialInvisible);
lucrehulkCollisionBox.rotation.x = Math.PI / 2; // Rotate to make the circular face forward
lucrehulkCollisionBox.name = "lucrehulkCollision";
lucrehulkGroup.add(lucrehulkCollisionBox);

// Load Lucrehulk using the registry
loadModelFromRegistry(
    'ships', // Category from modelRegistry.js
    'lucrehulk', // Name from modelRegistry.js
    
    // Success callback
    (gltf) => {
        const lucrehulkModel = gltf.scene;
        lucrehulkModel.scale.set(100, 100, 100);
        lucrehulkModel.rotation.y = Math.PI;
        lucrehulkGroup.add(lucrehulkModel);
        console.log('Lucrehulk battleship loaded successfully from registry');
    },
    (xhr) => { // onProgress callback (optional)
        console.log(`Loading Lucrehulk: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
    },
    (error) => { // onError callback
        console.error('Error loading Lucrehulk from registry:', error);
    }
);

// Add to planet groups between Venus and Earth orbits
planetGroups.push({ group: lucrehulkGroup, z: 35000 });




// --- Asteroid Belt Setup ---
// NOTE - Asteroid NOT a part of the planetGroups array
export const asteroidBeltGroup = new THREE.Group();
asteroidBeltGroup.name = "asteroidBelt";

// Create a collision box for the asteroid belt center for hover detection
const asteroidCollisionGeometry = new THREE.SphereGeometry(3000, 32, 32);
export const asteroidCollisionSphere = new THREE.Mesh(asteroidCollisionGeometry, collisionMaterialInvisible);
asteroidBeltGroup.add(asteroidCollisionSphere);

// Asteroid properties
const asteroidCount = 100;
const radius = 55000;           // Radius of the belt
const asteroidScale = 200;
asteroidBeltGroup.position.set(0, 0, 0);

// Load asteroid models
console.log('Loading asteroids from registry');

// Use the model registry for asteroid loading
loadModelFromRegistry(
    'environment',
    'asteroidPack',
    (gltf) => {
        console.log('Asteroid pack loaded successfully from registry');
        const asteroidModel = gltf.scene;

        // Apply random orientation to give impression of dense belt
        const tiltX = (Math.random() * Math.PI * 2) - Math.PI;
        const tiltZ = (Math.random() * Math.PI * 2) - Math.PI;

        for (let i = 0; i < asteroidCount; i++) {

            // Positon in a ring with slight random variation around a defined radius
            const angle = (i / asteroidCount) * Math.PI * 2;
            const randomRadius = radius * (0.9 + Math.random() * 0.2);

            const xFlat = Math.cos(angle) * randomRadius;
            const zFlat = Math.sin(angle) * randomRadius;
            const yFlat = (Math.random() - 0.5) * 5000;

            // Apply tilt around X
            const yTiltX = yFlat * Math.cos(tiltX) - zFlat * Math.sin(tiltX);
            const zTiltX = yFlat * Math.sin(tiltX) + zFlat * Math.cos(tiltX);

            // Then tilt around Z
            const xTilt = xFlat * Math.cos(tiltZ) - yTiltX * Math.sin(tiltZ);
            const yTilt = xFlat * Math.sin(tiltZ) + yTiltX * Math.cos(tiltZ);
            const zTilt = zTiltX;

            const asteroid = asteroidModel.clone();
            const scale = asteroidScale * (0.5 + Math.random());

            asteroid.scale.set(scale, scale, scale);
            asteroid.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            asteroid.position.set(xTilt, yTilt, zTilt);
            asteroidBeltGroup.add(asteroid);
        }
    },
    (xhr) => {
        console.log(`Loading asteroids: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
    },
    (error) => {
        console.error('Error loading asteroid model from registry:', error);
    }
);




