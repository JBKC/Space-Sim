
// Initializes solar system physical assets
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { loadingManager, textureLoadingManager } from './loaders.js';
import config from './config.js';

const textureLoader = new THREE.TextureLoader(textureLoadingManager);
const loader = new GLTFLoader();

export const cloudTexture = textureLoader.load(`${config.textures.path}/Earth-clouds.png`);
const collisionMaterialInvisible = new THREE.MeshBasicMaterial({ visible: false });
export const planetGroups = [];


///// Skybox
const skyboxTexture = textureLoader.load(`${config.textures.skybox}/galaxy5.jpeg`);
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
const sunTexture = textureLoader.load(`${config.textures.path}/2k_sun.jpg`);
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
const mercuryTexture = textureLoader.load(`${config.textures.path}/2k_mercury.jpg`);
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
const venusTexture = textureLoader.load(`${config.textures.path}/2k_venus_surface.jpg`);
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
const earthTexture = textureLoader.load(`${config.textures.path}/2k_earth_daymap.jpg`);
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
const moonTexture = textureLoader.load(`${config.textures.path}/2k_moon.jpg`);
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

// Get Earth's global position
const earthGlobalX = earthGroup.position.x;
const earthGlobalY = earthGroup.position.y;
const earthGlobalZ = earthGroup.position.z;

// Set moon position globally, but at the correct distance from Earth
moonGroup.position.set(
    earthGlobalX + Math.cos(moonAngle) * moonOrbitRadius, // Global X position
    earthGlobalY + Math.sin(moonAngle) * moonOrbitRadius, // Global Y position
    earthGlobalZ                                          // Same Z plane as Earth
);


// --- Mars Setup ---
export const marsGroup = new THREE.Group();
const marsRadius = 1500;
const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
const marsTexture = textureLoader.load(`${config.textures.path}/2k_mars.jpg`);
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

const redCloudTexture = textureLoader.load(`${config.textures.path}/Earth-clouds.png`);
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

function animateMarsClouds() {
    marsCloudMesh.rotation.y += 0.0005;
    requestAnimationFrame(animateMarsClouds);
}
animateMarsClouds();