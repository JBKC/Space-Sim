// spaceVR.js - Minimal VR test environment with just a spacebox

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadTextureFromRegistry, universalScaleFactor } from '../appConfig/loaders.js';
import { initVRControllers, updateVRMovement, getControllerDebugInfo, setupCameraRig } from './movementVR.js';
import { createStars, updateStars } from './starsVR.js';

// Core scene elements
let scene, camera, renderer;
let cameraRig; // Reference to the camera rig
let cockpit; // X-Wing cockpit model

// Advanced space environment elements
let spaceDustParticles = [];
let nebulaeClouds = [];
let galaxyBackdrop;
let directionalLightCone;
let spaceGradientSphere;

// Star system
let starSystem;

// Track if the scene is initialized
let initialized = false;

// Movement tracking
let lastFrameTime = 0;

// Constants
const SPACE_RADIUS = 125000; // Scale of the space environment
const COCKPIT_SCALE = 0.5; // Scale factor for the cockpit model

// Advanced space environment colors
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

// Initialize the minimal VR scene
export function init() {
    console.log("Initializing minimal VR test environment");
    
    if (initialized) {
        console.log("VR test environment already initialized, skipping");
        return { scene, camera, renderer };
    }
    
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.00001); // Very subtle exponential fog
    
    // Create perspective camera with improved near/far planes
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150000);
    camera.position.set(0, 0, 0);
    
    // Create renderer with adjusted settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        logarithmicDepthBuffer: true // Add logarithmic depth buffer to help with draw distance issues
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000011); // Very dark navy blue
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Enable XR
    renderer.xr.enabled = true;
    
    // Initialize VR controllers for movement
    initVRControllers(renderer);
    
    // Get space container and append renderer
    const container = document.getElementById('space-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }
    
    // Create advanced space environment elements
    createCinematicSpaceEnvironment();
    
    // Create stars with dynamic brightness
    starSystem = createStars();
    scene.add(starSystem.stars);
    console.log("Added dynamic star system to VR environment");
    
    // Remove any existing planet labels from DOM
    clearAllUIElements();
    
    // Add window resize handler
    window.addEventListener('resize', onWindowResize, false);
    
    // Create camera rig for separating head tracking from movement
    cameraRig = setupCameraRig(scene, camera);
    
    // Load X-Wing cockpit model
    loadCockpitModel();
    
    // Add subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x111133, 0.5);
    scene.add(ambientLight);
    
    // Add directional light for cockpit illumination
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, -1);
    scene.add(directionalLight);
    
    // Mark as initialized
    initialized = true;
    console.log("VR test environment initialized");
    
    return { scene, camera, renderer };
}

// Create a cinematic space environment following guidelines
function createCinematicSpaceEnvironment() {
    console.log("Creating cinematic space environment");
    
    // 1. Deep Radial Gradient Sphere for background
    createGradientSphere();
    
    // 2. Volumetric Nebulae Clouds
    createNebulaeClouds();
    
    // 3. Space Dust Particles
    createSpaceDust();
    
    // 4. Directional Light Cone / Volumetric Light
    createLightCone();
    
    // 5. Distant Galaxy Backdrop
    createGalaxyBackdrop();
}

// 1. Create a sphere with a radial gradient shader for the background
function createGradientSphere() {
    // Create a large sphere to serve as our gradient background
    const sphereGeometry = new THREE.SphereGeometry(SPACE_RADIUS * 0.95, 32, 32);
    
    // Create a custom shader material for the gradient
    const gradientMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorCenter: { value: COLORS.deepPurple },
            colorEdge: { value: COLORS.desaturatedTeal }
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
    
    spaceGradientSphere = new THREE.Mesh(sphereGeometry, gradientMaterial);
    spaceGradientSphere.renderOrder = -1000; // Render before everything else
    scene.add(spaceGradientSphere);
    console.log("Created gradient sphere background");
}

// 2. Create volumetric nebulae clouds
function createNebulaeClouds() {
    const nebulaCount = 8;
    const nebulaTexture = loadTextureFromRegistry('particle', 'nebula_cloud');
    
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
        
        scene.add(nebula);
        nebulaeClouds.push({
            mesh: nebula,
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.0001, // Slow rotation
                y: (Math.random() - 0.5) * 0.0001,
                z: (Math.random() - 0.5) * 0.0001
            }
        });
    }
    
    console.log(`Created ${nebulaCount} volumetric nebula clouds`);
}

// 3. Create space dust particles
function createSpaceDust() {
    const particleCount = 3000;
    const particleTexture = loadTextureFromRegistry('particle', 'glow');
    
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
        
        const particleSystem = new THREE.Points(particles, material);
        particleSystem.sortParticles = true;
        scene.add(particleSystem);
        
        spaceDustParticles.push({
            system: particleSystem,
            initialPositions: positions.slice(),
            driftSpeed: 0.0005, // Slow drift speed
            layer: layer
        });
    });
    
    console.log("Created space dust particle systems");
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
    
    directionalLightCone = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Position the cone so its tip is at the origin, pointing along -Z
    directionalLightCone.position.z = -SPACE_RADIUS * 0.15;
    directionalLightCone.rotation.x = Math.PI; // Rotate to point backward
    
    scene.add(directionalLightCone);
    console.log("Created directional light cone");
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
    
    galaxyBackdrop = new THREE.Mesh(geometry, material);
    
    // Position the galaxy far in the distance
    galaxyBackdrop.position.set(
        SPACE_RADIUS * 0.3,
        SPACE_RADIUS * 0.1,
        -SPACE_RADIUS * 0.5
    );
    
    // Make sure it's facing the camera
    galaxyBackdrop.lookAt(0, 0, 0);
    
    scene.add(galaxyBackdrop);
    console.log("Created galaxy backdrop");
}

// Load X-Wing cockpit model
function loadCockpitModel() {
    const loader = new GLTFLoader();
    
    loader.load(
        // Path to the model
        '/src/assets/models/x-wing_cockpit_lowres.glb',
        
        // Called when the model is loaded
        function(gltf) {
            cockpit = gltf.scene;
            
            // Scale and position the cockpit around the camera
            cockpit.scale.set(COCKPIT_SCALE, COCKPIT_SCALE, COCKPIT_SCALE);
            
            // Adjust position slightly to position the pilot's seat correctly
            cockpit.position.set(0, -0.4, 0);
            
            // Add the cockpit to the camera rig
            if (cameraRig) {
                // Add cockpit to the rig so it moves with the player
                cameraRig.add(cockpit);
                
                // Position it just in front of the camera
                cockpit.position.z = -0.2;
                
                // Ensure cockpit renders with proper materials
                cockpit.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.metalness = 0.3;
                        child.material.roughness = 0.7;
                        
                        // Set renderOrder to ensure cockpit renders after everything else
                        child.renderOrder = 1000;
                    }
                });
                
                console.log("X-Wing cockpit model loaded and added to camera rig");
            } else {
                console.error("Camera rig not available, cockpit not attached");
            }
        },
        
        // Called while loading is in progress
        function(xhr) {
            const percent = (xhr.loaded / xhr.total) * 100;
            console.log('Loading cockpit model: ' + percent.toFixed(0) + '%');
        },
        
        // Called if there's an error
        function(error) {
            console.error('Error loading cockpit model:', error);
        }
    );
}

// Remove all UI elements
function clearAllUIElements() {
    // Remove any existing planet labels from DOM
    const planetLabels = document.querySelectorAll('.planet-label');
    planetLabels.forEach(label => {
        if (label.parentNode) {
            label.parentNode.removeChild(label);
        }
    });
    
    // Hide any planet info boxes
    const planetInfoBox = document.querySelector('.planet-info-box');
    if (planetInfoBox) {
        planetInfoBox.style.display = 'none';
    }
    
    // Hide any distance indicators
    const distanceIndicators = document.querySelectorAll('.distance-indicator');
    distanceIndicators.forEach(indicator => {
        indicator.style.display = 'none';
    });
    
    // Hide exploration counter if it exists
    const explorationCounter = document.querySelector('.exploration-counter');
    if (explorationCounter) {
        explorationCounter.style.display = 'none';
    }
    
    // Hide hyperspace progress container
    const progressContainer = document.getElementById('hyperspace-progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    // Find and hide any possible black boxes or unexpected elements
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        // Hide any elements that might be positioned in front of the camera
        if (div.style.zIndex > 1000 && div.id !== 'space-container') {
            div.style.display = 'none';
        }
    });
    
    console.log("Cleared all UI elements");
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop - update movement based on VR controller inputs
export function update(timestamp) {
    // Calculate delta time for smooth movement
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    
    // Update the time uniform for shaders
    if (directionalLightCone && directionalLightCone.material && directionalLightCone.material.uniforms) {
        directionalLightCone.material.uniforms.time.value = timestamp * 0.001;
    }
    
    // Slowly rotate nebula clouds
    nebulaeClouds.forEach(nebula => {
        nebula.mesh.rotation.x += nebula.rotationSpeed.x;
        nebula.mesh.rotation.y += nebula.rotationSpeed.y;
        nebula.mesh.rotation.z += nebula.rotationSpeed.z;
    });
    
    // Animate space dust particles with gentle drift
    spaceDustParticles.forEach(particleSystem => {
        const positions = particleSystem.system.geometry.attributes.position.array;
        const initialPositions = particleSystem.initialPositions;
        
        for (let i = 0; i < positions.length; i += 3) {
            // Apply a sine wave drift to each particle
            const time = timestamp * particleSystem.driftSpeed;
            const offset = Math.sin(time + i * 0.01) * 200;
            
            positions[i] = initialPositions[i] + offset;
            positions[i + 1] = initialPositions[i + 1] + Math.sin(time * 0.7 + i * 0.02) * 200;
            positions[i + 2] = initialPositions[i + 2] + Math.sin(time * 0.5 + i * 0.03) * 200;
        }
        
        particleSystem.system.geometry.attributes.position.needsUpdate = true;
    });
    
    // Apply VR movement and rotation
    if (camera) {
        updateVRMovement(camera, deltaTime);
    }
    
    // Update stars brightness based on camera position
    if (starSystem && starSystem.stars) {
        // Use cameraRig position for star updates to ensure proper movement tracking
        const positionForStars = cameraRig ? cameraRig.position : camera.position;
        updateStars(starSystem.stars, positionForStars);
    }
    
    // Update galaxy backdrop to slowly rotate
    if (galaxyBackdrop) {
        galaxyBackdrop.rotation.z += 0.0001;
    }
    
    // Update gradient sphere to follow camera
    if (spaceGradientSphere && cameraRig) {
        spaceGradientSphere.position.copy(cameraRig.position);
    }
    
    // Log controller state occasionally (for debugging)
    if (Math.random() < 0.01) { // Only log about 1% of the time to avoid console spam
        const debugInfo = getControllerDebugInfo();
        if (debugInfo.leftController.connected || debugInfo.rightController.connected) {
            console.log("VR Controller State:", debugInfo);
        }
    }
}

// Render function
export function renderScene() {
    return { scene, camera };
}

// Start VR animation loop
export function startVRMode() {
    console.log("Starting VR mode animation loop");
    
    // Ensure all UI elements are cleared
    clearAllUIElements();
    
    // Create XR animation loop
    function xrAnimationLoop(timestamp, frame) {
        // Update movement based on controllers
        update(timestamp);
        
        // Render the scene
        renderer.render(scene, camera);
    }
    
    // Set the animation loop
    renderer.setAnimationLoop(xrAnimationLoop);
    console.log("VR animation loop set");
    
    // Automatically enter VR after a short delay
    setTimeout(() => {
        // Create and click a VR button
        const vrButton = VRButton.createButton(renderer);
        document.body.appendChild(vrButton);
        
        // Make sure button is removed from DOM after clicking
        vrButton.addEventListener('click', () => {
            // Remove the button right after clicking
            setTimeout(() => {
                if (vrButton.parentNode) {
                    vrButton.parentNode.removeChild(vrButton);
                }
            }, 100);
        });
        
        vrButton.click();
    }, 1000);
}

// Clean up
export function dispose() {
    renderer.setAnimationLoop(null);
    
    // Remove window resize listener
    window.removeEventListener('resize', onWindowResize);
    
    // Remove renderer from DOM
    if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    
    // Dispose all geometries and materials
    
    // Clean up space gradient sphere
    if (spaceGradientSphere) {
        if (spaceGradientSphere.geometry) spaceGradientSphere.geometry.dispose();
        if (spaceGradientSphere.material) spaceGradientSphere.material.dispose();
        scene.remove(spaceGradientSphere);
    }
    
    // Clean up nebulae
    nebulaeClouds.forEach(nebula => {
        if (nebula.mesh.geometry) nebula.mesh.geometry.dispose();
        if (nebula.mesh.material) {
            if (nebula.mesh.material.map) nebula.mesh.material.map.dispose();
            nebula.mesh.material.dispose();
        }
        scene.remove(nebula.mesh);
    });
    
    // Clean up space dust particles
    spaceDustParticles.forEach(particleSystem => {
        if (particleSystem.system.geometry) particleSystem.system.geometry.dispose();
        if (particleSystem.system.material) {
            if (particleSystem.system.material.map) particleSystem.system.material.map.dispose();
            particleSystem.system.material.dispose();
        }
        scene.remove(particleSystem.system);
    });
    
    // Clean up directional light cone
    if (directionalLightCone) {
        if (directionalLightCone.geometry) directionalLightCone.geometry.dispose();
        if (directionalLightCone.material) directionalLightCone.material.dispose();
        scene.remove(directionalLightCone);
    }
    
    // Clean up galaxy backdrop
    if (galaxyBackdrop) {
        if (galaxyBackdrop.geometry) galaxyBackdrop.geometry.dispose();
        if (galaxyBackdrop.material) {
            if (galaxyBackdrop.material.map) galaxyBackdrop.material.map.dispose();
            galaxyBackdrop.material.dispose();
        }
        scene.remove(galaxyBackdrop);
    }
    
    // Clean up cockpit model
    if (cockpit) {
        cockpit.traverse(function(child) {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
        scene.remove(cockpit);
    }
    
    // Reset arrays
    nebulaeClouds = [];
    spaceDustParticles = [];
    
    initialized = false;
    console.log("VR test environment disposed");
} 