// Contains design / aesthetic elements for the VR space environment
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadTextureFromRegistry, universalScaleFactor } from '../appConfig/loaders.js';

// Advanced space environment elements
let spaceDustParticles = [];
let nebulaeClouds = [];

const SPACE_RADIUS = 250000; // Scale of the space environment

const COLORS = {
    deepPurple: new THREE.Color(0x1a0033),
    deepNavy: new THREE.Color(0x000033),
    desaturatedTeal: new THREE.Color(0x003344),
    indigo: new THREE.Color(0x2a2a88),
    lavender: new THREE.Color(0x9987db),
    icyBlue: new THREE.Color(0x88ccff),
    icyCyan: new THREE.Color(0x00ccdd),
    mutedOrange: new THREE.Color(0xcc6633),
    mutedPink: new THREE.Color(0xcc6688)
};

// 1. Create a sphere with a radial gradient shader for the background
function createGradientSphere() {
    // Create a large sphere to serve as our gradient background
    const sphereGeometry = new THREE.SphereGeometry(SPACE_RADIUS * 0.7, 32, 32);
    
    // Create a custom shader material for the gradient
    const gradientMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorCenter: { value: COLORS.icyBlue },
            colorEdge: { value: COLORS.icyCyan }
        },
        vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorCenter;
            uniform vec3 colorEdge;
            varying vec3 vPosition;
            void main() {
                // Calculate normalized distance from center (0-1)
                float dist = length(vPosition) / ${SPACE_RADIUS.toFixed(1)};
                
                // Create gradient
                vec3 color = mix(colorCenter, colorEdge, smoothstep(0.0, 0.8, dist));
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
        fog: false
    });
    
    const spaceGradientSphere = new THREE.Mesh(sphereGeometry, gradientMaterial);
    spaceGradientSphere.renderOrder = -1000; // Render before everything else
    console.log("Created gradient sphere background");
    
    return spaceGradientSphere;
}

// 2. Create volumetric nebulae clouds
function createNebulaeClouds() {
    const nebulaCount = 8;
    const nebulaTexture = loadTextureFromRegistry('particle', 'nebula_cloud');
    const createdNebulae = [];
    
    for (let i = 0; i < nebulaCount; i++) {
        // Create a plane for each nebula cloud
        const size = SPACE_RADIUS * (0.1 + Math.random() * 0.2); // Vary sizes
        const geometry = new THREE.PlaneGeometry(size, size);
        
        // Pick a color from our palette
        const colors = [
            COLORS.deepPurple, COLORS.indigo, COLORS.lavender,
            COLORS.icyBlue, COLORS.mutedOrange, COLORS.mutedPink
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Create material with noise texture and transparency
        const material = new THREE.MeshBasicMaterial({
            map: nebulaTexture,
            color: color,
            transparent: true,
            opacity: 0.15 + Math.random() * 0.15, // Subtle opacity
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
                
        const nebula = new THREE.Mesh(geometry, material);
        
        // Position the nebula randomly in space, but far away
        const distance = SPACE_RADIUS * 0.4;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        nebula.position.x = distance * Math.sin(phi) * Math.cos(theta);
        nebula.position.y = distance * Math.sin(phi) * Math.sin(theta);
        nebula.position.z = distance * Math.cos(phi);
        
        // Random rotation
        nebula.rotation.x = Math.random() * Math.PI;
        nebula.rotation.y = Math.random() * Math.PI;
        nebula.rotation.z = Math.random() * Math.PI;
        
        createdNebulae.push({
            mesh: nebula,
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.0001, // Slow rotation
                y: (Math.random() - 0.5) * 0.0001,
                z: (Math.random() - 0.5) * 0.0001
            }
        });
    }
    
    console.log(`Created ${nebulaCount} volumetric nebula clouds`);
    nebulaeClouds = createdNebulae;
    return createdNebulae[0].mesh; // Return one nebula for export
}

// 3. Create space dust particles
function createSpaceDust() {
    const particleCount = 3000;
    const particleTexture = loadTextureFromRegistry('particle', 'glow');
    const createdDustParticles = [];
    let particleSystem;
    
    // Create three layers of space dust at different distances
    const layers = [
        { distance: SPACE_RADIUS * 0.2, count: particleCount * 0.5, size: 200, color: COLORS.icyCyan },
        { distance: SPACE_RADIUS * 0.4, count: particleCount * 0.3, size: 300, color: COLORS.lavender },
        { distance: SPACE_RADIUS * 0.6, count: particleCount * 0.2, size: 400, color: COLORS.mutedPink }
    ];
    
    layers.forEach(layer => {
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);
        const sizes = new Float32Array(layer.count);
        
        for (let i = 0; i < layer.count; i++) {
            const i3 = i * 3;
            
            // Distribute particles in a spherical shell
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = layer.distance * (0.8 + Math.random() * 0.4); // Some variance in distance
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Vary individual particle colors slightly
            const brightness = 0.5 + Math.random() * 0.5; // Vary brightness
            colors[i3] = layer.color.r * brightness;
            colors[i3 + 1] = layer.color.g * brightness;
            colors[i3 + 2] = layer.color.b * brightness;
            
            // Vary the size
            sizes[i] = (0.5 + Math.random() * 0.5) * layer.size;
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 1, // Will be overridden by size attribute
            map: particleTexture,
            transparent: true,
            opacity: 0.5,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });
        
        // Use a custom shader to apply size attribute
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                `attribute float size;
                void main() {`
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                'gl_PointSize = size;',
                'gl_PointSize = size * ( 300.0 / -mvPosition.z );'
            );
        };
        
        particleSystem = new THREE.Points(particles, material);
        particleSystem.sortParticles = true;
        
        createdDustParticles.push({
            system: particleSystem,
            initialPositions: positions.slice(),
            driftSpeed: 0.0005, // Slow drift speed
            layer: layer
        });
    });
    
    console.log("Created space dust particle systems");
    spaceDustParticles = createdDustParticles;
    return particleSystem;
}

// 4. Create directional light cone
function createLightCone() {
    // Create a cone geometry pointing in the -Z direction
    const coneGeometry = new THREE.ConeGeometry(SPACE_RADIUS * 0.1, SPACE_RADIUS * 0.3, 32, 1, true);
    
    // Create a custom shader material for the gradient light cone
    const coneMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorStart: { value: new THREE.Color(0x00ccff) },
            colorEnd: { value: new THREE.Color(0x2a2a88) },
            time: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorStart;
            uniform vec3 colorEnd;
            uniform float time;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            // Simplex noise function
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                
                // First corner
                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);
                
                // Other corners
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;
                
                // Permutations
                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    
                // Gradients: 7x7 points over a square, mapped onto an octahedron
                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;
                
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                
                vec4 x = x_ * ns.x + ns.yyyy;
                vec4 y = y_ * ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                
                vec4 s0 = floor(b0) * 2.0 + 1.0;
                vec4 s1 = floor(b1) * 2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                
                vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
                
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                
                // Normalise gradients
                vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                
                // Mix final noise value
                vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }
            
            void main() {
                // Distance along the cone (0 at tip, 1 at base)
                float dist = vPosition.z / ${(SPACE_RADIUS * 0.3).toFixed(1)};
                dist = 1.0 - dist; // Reverse direction (1 at tip, 0 at base)
                
                // Add noise to the cone
                float noise = snoise(vPosition * 0.001 + vec3(0.0, 0.0, time * 0.1)) * 0.3;
                
                // Radial falloff (brighter in center, dimmer at edges)
                float radialDist = length(vPosition.xy) / ${(SPACE_RADIUS * 0.1).toFixed(1)};
                float radialFalloff = 1.0 - smoothstep(0.0, 0.9, radialDist);
                
                // Combine colors with distance
                vec3 color = mix(colorStart, colorEnd, smoothstep(0.0, 1.0, dist));
                
                // Apply noise and radial falloff
                float alpha = (0.05 + noise * 0.1) * radialFalloff * (1.0 - dist * 0.8);
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    
    const directionalLightCone = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Position the cone so its tip is at the origin, pointing along -Z
    directionalLightCone.position.z = -SPACE_RADIUS * 0.15;
    directionalLightCone.rotation.x = Math.PI; // Rotate to point backward
    
    console.log("Created directional light cone");
    return directionalLightCone;
}

// 5. Create distant galaxy backdrop
function createGalaxyBackdrop() {
    // Create a large quad for the galaxy
    const size = SPACE_RADIUS * 0.5;
    const geometry = new THREE.PlaneGeometry(size, size);
    
    // Load a galaxy texture or use a procedural one
    const galaxyTexture = loadTextureFromRegistry('skybox', 'galaxy_core');
    
    // Create material with emissive properties
    const material = new THREE.MeshBasicMaterial({
        map: galaxyTexture,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: new THREE.Color(0xff8866) // Warm orange-pink for galaxy core
    });
    
    const galaxyBackdrop = new THREE.Mesh(geometry, material);
    
    // Position the galaxy far in the distance
    galaxyBackdrop.position.set(
        SPACE_RADIUS * 0.3,
        SPACE_RADIUS * 0.1,
        -SPACE_RADIUS * 0.5
    );
    
    // Make sure it's facing the camera
    galaxyBackdrop.lookAt(0, 0, 0);
    
    console.log("Created galaxy backdrop");
    return galaxyBackdrop;
}

// Create a cinematic space environment element-by-element
const spaceGradientSphere = createGradientSphere();
const nebula = createNebulaeClouds();
const particleSystem = createSpaceDust();
const directionalLightCone = createLightCone();
const galaxyBackdrop = createGalaxyBackdrop();

// Export VR space environment elements
export {
    SPACE_RADIUS,
    COLORS,
    spaceGradientSphere,
    nebula,
    nebulaeClouds,
    particleSystem,
    spaceDustParticles,
    directionalLightCone,
    galaxyBackdrop
};



///// STARS /////

// starsVR.js - Handles star generation and updates for VR environment

// Star configuration constants
const STAR_COUNT = 600000; // Tripled from 200,000 to 600,000 for more immersive space environment
const STAR_SIZE = 25;

// Create stars
export function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    
    // Create stars with varying distances and initial brightness
    for (let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        
        // Random position in a large sphere around the origin
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = SPACE_RADIUS * Math.pow(Math.random(), 1/3); // Cube root for even volumetric distribution
        
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
    
    const starMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff,
        size: STAR_SIZE * universalScaleFactor,
        vertexColors: true, // Use the color attribute
        sizeAttenuation: true, // Make distant stars smaller
        transparent: true,
        opacity: 1.0 // Full opacity
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    console.log(`VR stars created: ${STAR_COUNT} points`);
    
    return {
        stars,
        count: STAR_COUNT,
        range: SPACE_RADIUS
    };
}

// Update stars brightness based on distance to camera
export function updateStars(stars, cameraPosition) {
    if (!stars || !stars.geometry) return;
    
    const positions = stars.geometry.attributes.position.array;
    const colors = stars.geometry.attributes.color.array;
    
    // Update star brightness based on distance to camera
    for (let i = 0; i < STAR_COUNT * 3; i += 3) {
        // Calculate distance from camera to this star
        const dx = positions[i] - cameraPosition.x;
        const dy = positions[i + 1] - cameraPosition.y;
        const dz = positions[i + 2] - cameraPosition.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Check if star is too far from the camera (beyond view range)
        if (distance > SPACE_RADIUS * 0.8) {
            // Respawn the star in a new random position in a full sphere around the camera
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = SPACE_RADIUS * 0.4 * Math.pow(Math.random(), 1/3);
            
            // Position relative to camera
            positions[i] = cameraPosition.x + radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = cameraPosition.y + radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = cameraPosition.z + radius * Math.cos(phi);
        }
        
        // Recalculate distance after possible respawn
        const newDx = positions[i] - cameraPosition.x;
        const newDy = positions[i + 1] - cameraPosition.y;
        const newDz = positions[i + 2] - cameraPosition.z;
        const newDistance = Math.sqrt(newDx*newDx + newDy*newDy + newDz*newDz);
        
        // More extreme interpolation based on distance
        // Stars closer than 8% of range are at full brightness
        // Stars further than 25% of range are at minimum brightness
        const minDistance = SPACE_RADIUS * 0.08;
        const maxDistance = SPACE_RADIUS * 0.25;
        let brightness = 1.0;
        
        if (newDistance > minDistance) {
            // More dramatic falloff - distant stars are barely visible (only 5% brightness)
            brightness = 1.0 - Math.min(1.0, (newDistance - minDistance) / (maxDistance - minDistance)) * 0.95;
        }
        
        // Apply brightness to RGB values
        colors[i] = brightness; // R
        colors[i + 1] = brightness; // G
        colors[i + 2] = brightness; // B
    }
    
    // Update the geometry attributes
    stars.geometry.attributes.position.needsUpdate = true;
    stars.geometry.attributes.color.needsUpdate = true;
} 