import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Load the Mars terrain model
const loader = new GLTFLoader();
loader.load(
  './blender_templates/mars_terrain_export.glb',
  (gltf) => {
    const model = gltf.scene;
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    
    // Apply custom material to the terrain
    model.traverse((child) => {
      if (child.isMesh) {
        // Create a custom Mars-like material
        const marsMaterial = new THREE.MeshStandardMaterial({
          color: 0xc1440e,          // Reddish-orange base color
          roughness: 0.8,           // Fairly rough surface
          metalness: 0.2,           // Slight metallic look for minerals
          flatShading: false,       // Use smooth shading
          side: THREE.DoubleSide    // Render both sides
        });
        
        // Apply the material
        child.material = marsMaterial;
        
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    // Scale the model if needed
    // model.scale.set(0.5, 0.5, 0.5);
    
    scene.add(model);
    
    // Hide loading text
    document.getElementById('loading').style.display = 'none';
  },
  (xhr) => {
    const percent = (xhr.loaded / xhr.total) * 100;
    document.getElementById('loading').textContent = `Loading: ${Math.round(percent)}%`;
  },
  (error) => {
    console.error('An error occurred while loading the model:', error);
    document.getElementById('loading').textContent = 'Error loading model';
  }
);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate(); 