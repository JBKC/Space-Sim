// Procedural Terrain Sandbox with Fractal Noise, Realistic Lighting, Mars-Themed Colors, and Shadows

import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js';
import { updateMovement, keys } from '../../../src/movement.js';
import { createSpacecraft } from '../../../src/spacecraft.js';
import { 
    spaceCamera, 
    cockpitCamera,
    createCameraState, 
    updateTargetOffsets,
    updateCameraOffsets,
    createForwardRotation
} from '../../../src/camera.js';
import config from './config.js';
// Import loading managers for tracking asset loading
import { loadingManager, textureLoadingManager } from '../../../src/loaders.js';

// General initialization - scene, camera, renderer
// do outside of init function as scene is required by multiple other files
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250000);
camera.position.set(100, 100, -100);
camera.lookAt(0, 0, 0);

// Create camera state for the space scene
const cameraState = createCameraState('space');
const smoothFactor = 0.1; // Exactly the same as SanFran3D

// set up renderer for default space view
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('space-container').appendChild(renderer.domElement);
let spaceInitialized = false;
let isBoosting = false;
let isHyperspace = false;


function updateCamera(camera, isHyperspace) {
    if (!spacecraft) {
        console.warn("Spacecraft not initialized yet, skipping updateCamera");
        return;
    }

    // Create a fixed pivot at the center of the spacecraft
    const spacecraftCenter = new THREE.Object3D();
    spacecraft.add(spacecraftCenter);
    spacecraftCenter.updateMatrixWorld();

    // Check if we're in first-person view
    const isFirstPerson = spacecraft.isFirstPersonView && typeof spacecraft.isFirstPersonView === 'function' ? spacecraft.isFirstPersonView() : false;
    
    // Debug log - only log 1% of the time to avoid spam
    // if (Math.random() < 0.01) {
    //     console.log(
    //         "🎥 CAMERA DEBUG: isFirstPerson =", isFirstPerson, 
    //         "| isFirstPersonView() =", spacecraft.isFirstPersonView(), 
    //         "| isFirstPersonView exists:", typeof spacecraft.isFirstPersonView === 'function'
    //     );
    // }

    // Update target offsets based on keys, hyperspace state and view mode
    const viewMode = isFirstPerson ? 'cockpit' : 'space';
    updateTargetOffsets(cameraState, keys, viewMode, isHyperspace);
    
    // Update current offsets by interpolating toward targets
    updateCameraOffsets(cameraState, rotation);
    
    // Get the world position of the spacecraft's center
    const pivotPosition = new THREE.Vector3();
    spacecraftCenter.getWorldPosition(pivotPosition);
    
    // Calculate camera offset based on state
    let offset = new THREE.Vector3();
    
    if (isHyperspace) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.hyperspace);
        } else {
            offset.copy(cockpitCamera.hyperspace);
        }
    } else if (keys.up) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.boost);
        } else {
            offset.copy(cockpitCamera.boost);
        }
    } else if (keys.down) {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.slow);
        } else {
            offset.copy(cockpitCamera.slow);
        }
    } else {
        if (!isFirstPerson) {
            offset.copy(spaceCamera.base);
        } else {
            offset.copy(cockpitCamera.base);
        }
    }
    
    // Apply spacecraft's rotation to the offset
    const quaternion = spacecraft.quaternion.clone();
    offset.applyQuaternion(quaternion);
    
    // Calculate final camera position by adding offset to pivot
    const finalPosition = new THREE.Vector3().addVectors(pivotPosition, offset);
    
    // Update camera position with smooth interpolation
    camera.position.lerp(finalPosition, smoothFactor);
    
    // Make camera look at the spacecraft's forward direction
    camera.quaternion.copy(spacecraft.quaternion);
    
    // Apply the 180-degree rotation to look forward
    const adjustment = createForwardRotation();
    camera.quaternion.multiply(adjustment);
    
    // Apply FOV changes from camera state
    camera.fov = cameraState.currentFOV;
    camera.updateProjectionMatrix();
    
    // Remove the temporary pivot (to avoid cluttering the scene)
    spacecraft.remove(spacecraftCenter);
}

// Renderer settings
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = true;
renderer.sortObjects = false;
renderer.physicallyCorrectLights = false;


// LIGHTING


const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
directionalLight.position.set(-1, -1, -1,);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

scene.background = new THREE.Color(0x000000);


export function renderScene() {
    // just the single procedural scene to render
    renderer.render(scene, camera);
}

// Define spacecraft
let spacecraft, engineGlowMaterial, lightMaterial;
let topRightWing, bottomRightWing, topLeftWing, bottomLeftWing;
let wingsOpen = true;
let wingAnimation = 0;
let updateEngineEffects;
const wingTransitionFrames = 30;

// Export spacecraft variables for other modules
export { spacecraft, engineGlowMaterial, lightMaterial, topRightWing, bottomRightWing, topLeftWing, bottomLeftWing, wingsOpen, wingAnimation, updateEngineEffects };

// Track if controls have been initialized
let controlsInitialized = false;

// Initialize spacecraft
function initSpacecraft() {
    const spacecraftComponents = createSpacecraft(scene);
    spacecraft = spacecraftComponents.spacecraft;
    engineGlowMaterial = spacecraftComponents.engineGlowMaterial;
    lightMaterial = spacecraftComponents.lightMaterial;
    topRightWing = spacecraftComponents.topRightWing;
    bottomRightWing = spacecraftComponents.bottomRightWing;
    topLeftWing = spacecraftComponents.topLeftWing;
    bottomLeftWing = spacecraftComponents.bottomLeftWing;

    // Expose the toggleView function for cockpit view
    spacecraft.toggleView = spacecraftComponents.toggleView;
    
    // Store the isFirstPersonView state for camera logic
    spacecraft.isFirstPersonView = function() {
        // Add a direct reference to the spacecraftComponents object
        return this._spacecraftComponents ? this._spacecraftComponents.isFirstPersonView : false;
    };
    
    // Expose animation functions
    spacecraft.updateAnimations = spacecraftComponents.updateAnimations;
    spacecraft.setWingsOpen = spacecraftComponents.setWingsOpen;
    spacecraft.toggleWings = spacecraftComponents.toggleWings;
    spacecraft.setWingsPosition = spacecraftComponents.setWingsPosition;
    
    // Store a direct reference to the spacecraftComponents
    spacecraft._spacecraftComponents = spacecraftComponents;

    // Make sure wings are open by default (set timeout to ensure model is loaded)
    setTimeout(() => {
        if (spacecraft && spacecraft.setWingsOpen) {
            // console.log("Setting wings to OPEN position in setup.js");
            spacecraft.setWingsOpen(true);
        }
    }, 1000); // 1 second delay to ensure model is fully loaded and processed

    // Verify reticle creation
    if (spacecraftComponents.reticle) {
        console.log("Reticle was successfully created with spacecraft in setup.js");
    } else {
        console.warn("Reticle not found in spacecraft components");
    }

    spacecraft.position.set(40000, 40000, 40000);
    const centerPoint = new THREE.Vector3(0, 0, 10000);
    spacecraft.lookAt(centerPoint);
    spacecraft.name = 'spacecraft'; // Add a name for easier lookup
    scene.add(spacecraft); // Make sure to add it to the scene

    updateEngineEffects = spacecraftComponents.updateEngineEffects;
}

function initControls() {
    // Only set up event listeners once
    if (controlsInitialized) {
        console.log("Controls already initialized, skipping");
        return;
    }
    
    console.log("Initializing controls with keys object:", keys);
    
    document.addEventListener('keydown', (event) => {
        if (!keys) return; // Guard against keys not being defined
        switch (event.key) {
            case 'w': keys.w = true; break;
            case 's': keys.s = true; break;
            case 'a': keys.a = true; break;
            case 'd': keys.d = true; break;
            case 'ArrowLeft': keys.left = true; break;
            case 'ArrowRight': keys.right = true; break;
            case 'ArrowUp': keys.up = true; break;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (!keys) return; // Guard against keys not being defined
        switch (event.key) {
            case 'w': keys.w = false; break;
            case 's': keys.s = false; break;
            case 'a': keys.a = false; break;
            case 'd': keys.d = false; break;
            case 'ArrowLeft': keys.left = false; break;
            case 'ArrowRight': keys.right = false; break;
            case 'ArrowUp': keys.up = false; break;
        }
    });
    
    controlsInitialized = true;
}

/// MASTER FUNCTION called by main.js
export function init() {
    console.log("Space initialization started");
    
    if (spaceInitialized) {
        console.log("Space already initialized, skipping");
        return { scene: scene, camera: camera, renderer: renderer };
    }

    initSpacecraft();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    initControls();

    spaceInitialized = true;
    console.log("Space initialization complete");
    
    return { 
        scene: scene, 
        camera: camera, 
        renderer: renderer, 
    };
}

export function update(isBoosting, isHyperspace, deltaTime = 0.016) {
    try {
        if (!spaceInitialized) {
            console.log("Space not initialized yet");
            return false;
        }

        // Handle laser firing if spacebar is pressed
        if (keys.space && spacecraft) {
            // LASER FIRING DISABLED
            // fireLaser(spacecraft, scene, 'space', isBoosting);
        }

        // Use the passed isBoosting and isHyperspace parameters
        updateMovement(isBoosting, isHyperspace);
        updateCamera(camera, isHyperspace);
        
        // Handle laser updates
        if (typeof updateLasers === 'function') {
            updateLasers(deltaTime);
        }

        // Update spacecraft effects
        if (updateEngineEffects) {
            updateEngineEffects(isBoosting);
        }
        
        // Wing position control - check if conditions changed
        if (spacecraft && spacecraft.setWingsOpen) {
            const shouldWingsBeOpen = !isBoosting && !isHyperspace;
            
            // // Log wing state changes at a low frequency to avoid console spam
            // if (Math.random() < 0.01) {
            //     console.log(`Wing state check: boosting=${isBoosting}, hyperspace=${isHyperspace}, shouldBeOpen=${shouldWingsBeOpen}`);
            // }
            
            // The setWingsOpen function now has smooth animations and handles state management internally
            // It will only trigger an animation if the target state is different from the current state
            spacecraft.setWingsOpen(shouldWingsBeOpen);
        }
        
        // Update animation mixer (Only in space scene)
        if (spacecraft.updateAnimations) {
            spacecraft.updateAnimations(deltaTime);
        }
        
        // Update reticle position if available
        if (spacecraft && spacecraft.userData && spacecraft.userData.updateReticle) {
            // console.log("Updating reticle in setup.js");
            spacecraft.userData.updateReticle(isBoosting, keys.down);  // Pass both boost and slow states
        } else {
            // Only log this warning once to avoid console spam
            if (!window.setupReticleWarningLogged) {
                console.warn("Reticle update function not found on spacecraft userData in setup.js", spacecraft);
                window.setupReticleWarningLogged = true;
            }
        }
        
        // Update cockpit elements if in first-person view
        if (spacecraft && spacecraft.updateCockpit) {
            spacecraft.updateCockpit(deltaTime);
        }
        
        return true;
    } catch (error) {
        console.error("Error in space update:", error);
        return false;
    }
}


///////////////////// Terrain Scene Setup /////////////////////

// Shader setup
const uniforms = {
  uTime: { value: 0 },
  uNoiseScale: { value: 0.05 },
  uDisplacementStrength: { value: 10.0 },
  uDetail: { value: 3.0 },
  uLacunarity: { value: 2.0 },
  uLowHeight: { value: 0.0 },
  uHighHeight: { value: 1.0 },
  uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }
};

const vertexShader = `
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uNoiseScale;
  uniform float uDisplacementStrength;
  uniform float uDetail;
  uniform float uLacunarity;
  uniform float uLowHeight;
  uniform float uHighHeight;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float base = noise(p);
    float detail = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int i = 1; i < 8; i++) {
      if (i >= int(uDetail)) break;
      freq *= uLacunarity;
      amp *= 0.5;
      detail += amp * noise(p * freq);
    }
    return base + detail;
  }

  void main() {
    vec3 pos = position;
    float height = fbm(pos.xz * uNoiseScale);
    float displaced = clamp(height, uLowHeight, uHighHeight);
    pos.y += displaced * uDisplacementStrength;
    vHeight = height;
    vPosition = pos;

    vec3 transformedNormal = normalize(normalMatrix * normal);
    vNormal = transformedNormal;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform vec3 uLightDir;
  uniform float uLowHeight;
  uniform float uHighHeight;

  void main() {
    vec3 yellow = vec3(0.72, 0.35, 0.1); // reddish sand
    vec3 mid = vec3(0.35, 0.15, 0.08);   // darker rock
    vec3 high = vec3(0.15, 0.07, 0.04);  // deepest rock tone

    vec3 baseColor = mix(yellow, mid, smoothstep(0.2, 0.6, vHeight));
    baseColor = mix(baseColor, high, smoothstep(0.6, 1.0, vHeight));

    if (vHeight < uLowHeight) {
      baseColor = yellow;
    }

    if (vHeight > uHighHeight) {
      baseColor = high; // ✅ Match high clamp to rock brown
    }

    float lighting = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
    vec3 litColor = baseColor * 0.4 + baseColor * lighting * 0.6;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  side: THREE.DoubleSide,
  wireframe: false,
});

const geometry = new THREE.PlaneGeometry(100, 100, 256, 256);
geometry.rotateX(-Math.PI / 2);

const terrain = new THREE.Mesh(geometry, material);
terrain.castShadow = true;
terrain.receiveShadow = true;
scene.add(terrain);

// GUI
const gui = new GUI();
gui.add(uniforms.uNoiseScale, 'value', 0.001, 0.2).name('Noise Scale');
gui.add(uniforms.uDisplacementStrength, 'value', 0.0, 50.0).name('Displacement');
gui.add(uniforms.uDetail, 'value', 1, 8, 1).name('Detail (Octaves)');
gui.add(uniforms.uLacunarity, 'value', 1.0, 4.0).name('Lacunarity');
gui.add(uniforms.uLowHeight, 'value', 0.0, 1.5).name('Low Height Plane'); // ✅ Extended range
gui.add(uniforms.uHighHeight, 'value', 0.0, 1.5).name('High Height Plane'); // ✅ Unchanged

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  uniforms.uTime.value += 0.01;
  renderer.render(scene, camera);
}
animate();
